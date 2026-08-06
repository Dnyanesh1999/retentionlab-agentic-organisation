import {
  operatorReasonSchema,
  OPERATOR_REASON_MAX,
  OPERATOR_REASON_MIN,
  type ArtifactReference,
  type ManagerOutcome,
  type OrchestratorEvent,
  type OrchestratorStage,
} from "./contracts.js";
import { OrchestratorError } from "./errors.js";
import type { EventStore } from "./eventStore.js";
import {
  applyEvent,
  assertManagerOutcome,
  failedStage,
  firstIncompleteStage,
  invalidationSet,
  type OrchestratorState,
  type ResumePlan,
} from "./stateMachine.js";

// ---------------------------------------------------------------------------
// Orchestrator service API. Composes the append-only store, the pure state
// machine, and five injectable stage executors. This slice performs no live
// model calls — executors are supplied by the caller. A later CLI/live pipeline
// wires the five existing agents (Nia -> Luca -> Noor -> Maeve -> Elias) as
// executors without changing anything here.
// ---------------------------------------------------------------------------

export type StageExecutorContext = {
  readonly run_id: string;
  readonly account_slug: string;
  readonly stage: OrchestratorStage;
  readonly version: number;
  readonly requires_human_approval: boolean;
  // Current accepted artefacts of all predecessor stages, keyed by stage.
  readonly completed_artifacts: ReadonlyMap<OrchestratorStage, ArtifactReference>;
  // Bounded required changes when this run is a revision rerun of the Manager's target stage.
  readonly required_changes: readonly string[] | null;
};

export type StageExecutionResult = {
  // SHA-256 of the produced artefact, using the repository JSON hashing convention.
  readonly sha256: string;
  // The produced artefact's own status field (e.g. "completed", "ready_for_maker", or the decision).
  readonly status_label: string;
  readonly produced_at: string;
  // Only the Manager returns this; the orchestrator refuses it from any other stage.
  readonly manager_outcome?: ManagerOutcome;
};

export type StageExecutor = (context: StageExecutorContext) => Promise<StageExecutionResult>;
export type OrchestratorExecutors = Readonly<Record<OrchestratorStage, StageExecutor>>;

export type DriveResult = {
  readonly state: OrchestratorState;
  readonly status: OrchestratorState["status"];
};

export type StartRunInput = {
  readonly run_id: string;
  readonly account_slug: string;
  // Defaults to true; the Manager governance mandates a human, and an approval never executes.
  readonly requires_human_approval?: boolean;
};

export interface Orchestrator {
  start(input: StartRunInput): Promise<DriveResult>;
  resume(runId: string): Promise<DriveResult>;
  // Operator-initiated recovery of a run stalled at `failed`. Appends ONE explicit
  // failed_stage_retry_requested event for the currently failed stage, then drives normally so the
  // stage reruns at attempt/version +1. Never emitted automatically; never takes an external action.
  retryFailed(runId: string, operatorReason: string): Promise<DriveResult>;
  inspect(runId: string): Promise<{ state: OrchestratorState; plan: ResumePlan }>;
}

export function createOrchestrator(options: {
  store: EventStore;
  executors: OrchestratorExecutors;
  now?: () => Date;
}): Orchestrator {
  const { store, executors } = options;
  const clock = options.now ?? (() => new Date());
  const nowIso = (): string => clock().toISOString();

  function completedArtifacts(state: OrchestratorState): ReadonlyMap<OrchestratorStage, ArtifactReference> {
    const map = new Map<OrchestratorStage, ArtifactReference>();
    for (const stage of Object.keys(state.stages) as OrchestratorStage[]) {
      const entry = state.stages[stage];
      if (entry.status === "completed" && entry.current) {
        map.set(stage, entry.current);
      }
    }
    return map;
  }

  // Persist one event and fold it locally. The store verifies the full chain on every append, so the
  // in-memory `state` and the durable log stay in lockstep.
  async function commit(state: OrchestratorState, runId: string, event: OrchestratorEvent): Promise<OrchestratorState> {
    await store.append(runId, event);
    return applyEvent(state, event);
  }

  async function drive(runId: string, initial: OrchestratorState): Promise<DriveResult> {
    let state = initial;

    // Bounded loop: the pipeline has five stages plus bounded revisions. The guard is a hard backstop
    // against a mis-specified executor; normal runs terminate far sooner.
    for (let guard = 0; guard < 256; guard += 1) {
      const plan = firstIncompleteStage(state);

      if (plan.kind === "terminal") {
        return { state, status: state.status };
      }

      if (plan.kind === "route") {
        const invalidated = invalidationSet(plan.target);
        state = await commit(state, runId, {
          type: "revision_routed",
          target_stage: plan.target,
          invalidated_stages: invalidated,
          created_at: nowIso(),
        });
        continue;
      }

      const { stage, version } = plan;

      if (plan.kind === "start_stage") {
        const reason = state.stages[stage].attempt > 0 ? "revision_rerun_start" : "sequential_start";
        state = await commit(state, runId, { type: "stage_started", stage, version, reason, created_at: nowIso() });
      }

      const stageState = state.stages[stage];
      const context: StageExecutorContext = {
        run_id: state.run_id,
        account_slug: state.account_slug,
        stage,
        version,
        requires_human_approval: state.requires_human_approval,
        completed_artifacts: completedArtifacts(state),
        required_changes: stageState.pending_required_changes,
      };

      let result: StageExecutionResult;
      try {
        result = await executors[stage](context);
      } catch (error) {
        const message = error instanceof Error ? error.message : "stage executor failed";
        state = await commit(state, runId, {
          type: "stage_failed",
          stage,
          version,
          error: message.slice(0, 500),
          created_at: nowIso(),
        });
        return { state, status: state.status };
      }

      const artifact: ArtifactReference = {
        stage,
        version,
        sha256: result.sha256,
        status_label: result.status_label,
        produced_at: result.produced_at,
      };

      if (stage === "manager") {
        const outcome = result.manager_outcome;
        if (!outcome) {
          throw new OrchestratorError("MISSING_MANAGER_OUTCOME", "The Manager executor must return a manager_outcome.");
        }
        // Governance + runtime-computed downstream agreement, before the decision is sealed. The reducer
        // re-validates on every replay, so a corrupt seal is caught on load as well.
        assertManagerOutcome(state, outcome);
        // ONE atomic append seals Manager completion, its immutable artefact and the validated outcome.
        // A crash before this append leaves the Manager `active` (resume re-runs it, re-deriving the
        // outcome that was never persisted); a crash after it leaves a terminal/revision state that
        // resumes with no re-call and no guessing. There is no intermediate torn state.
        state = await commit(state, runId, { type: "manager_decided", version, artifact, outcome, created_at: nowIso() });
        continue;
      }

      if (result.manager_outcome) {
        throw new OrchestratorError(
          "UNEXPECTED_MANAGER_OUTCOME",
          `Only the Manager may return a manager_outcome; ${stage} returned one.`,
        );
      }
      state = await commit(state, runId, { type: "stage_completed", stage, version, artifact, created_at: nowIso() });
    }

    throw new OrchestratorError("ILLEGAL_EVENT", "Orchestrator exceeded its bounded transition budget.");
  }

  return {
    async start(input) {
      const runId = input.run_id;
      const event: OrchestratorEvent = {
        type: "run_started",
        run_id: runId,
        account_slug: input.account_slug,
        requires_human_approval: input.requires_human_approval ?? true,
        created_at: nowIso(),
      };
      // Exclusive-create the authoritative genesis line, then drive from the rehydrated state so start
      // and resume share exactly one execution path.
      await store.createRun(runId, event);
      return drive(runId, await store.loadState(runId));
    },

    async resume(runId) {
      const state = await store.loadState(runId);
      return drive(runId, state);
    },

    async retryFailed(runId, operatorReason) {
      // Load the fully verified state from the durable log (hash-chain checked on read). The retry is a
      // deliberate operator action, so its reason is validated to bounded length before anything is
      // appended — a malformed reason never reaches the event log.
      const reason = operatorReasonSchema.safeParse(operatorReason);
      if (!reason.success) {
        throw new OrchestratorError(
          "INVALID_OPERATOR_REASON",
          `Failed-stage retry rejected: operator reason must be ${OPERATOR_REASON_MIN}–${OPERATOR_REASON_MAX} characters after trimming.`,
        );
      }
      const state = await store.loadState(runId);
      const target = failedStage(state);
      if (target === null) {
        throw new OrchestratorError(
          "RUN_NOT_FAILED",
          `Failed-stage retry rejected: run ${runId} is ${state.status} with no failed stage to recover.`,
        );
      }
      // The reducer re-validates every precondition (status, exact stage, version, predecessor and
      // downstream shape) when this event is folded, so a race between load and append fails closed.
      const next = await commit(state, runId, {
        type: "failed_stage_retry_requested",
        stage: target,
        failed_version: state.stages[target].attempt,
        operator_reason: reason.data,
        created_at: nowIso(),
      });
      return drive(runId, next);
    },

    async inspect(runId) {
      const state = await store.loadState(runId);
      return { state, plan: firstIncompleteStage(state) };
    },
  };
}
