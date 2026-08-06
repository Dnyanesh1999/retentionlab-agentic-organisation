import { OrchestratorError } from "./errors.js";
import {
  REVISABLE_STAGE_ORDER,
  STAGE_ORDER,
  type ArtifactReference,
  type ManagerOutcome,
  type OrchestratorEvent,
  type OrchestratorStage,
  type RevisableStage,
  type RunStatus,
  type StageStatus,
} from "./contracts.js";

// ---------------------------------------------------------------------------
// Pure, deterministic transition core. No I/O, no clock, no hidden mutation.
// Every returned state is a fresh, deeply-cloned value; callers never observe
// aliasing. Illegal transitions throw a typed OrchestratorError.
// ---------------------------------------------------------------------------

export type StageState = {
  readonly stage: OrchestratorStage;
  readonly status: StageStatus;
  // Number of times this stage has been started. The active/last version equals `attempt`.
  readonly attempt: number;
  // The current accepted artefact (null when pending/active/invalidated/failed).
  readonly current: ArtifactReference | null;
  // Every artefact this stage has ever produced, oldest first. Superseded references are preserved
  // here forever — a revision never deletes history.
  readonly history: readonly ArtifactReference[];
  // Bounded required changes handed to the executor on the next rerun (target of a revision only).
  readonly pending_required_changes: readonly string[] | null;
};

export type PendingRevision = {
  readonly target_stage: RevisableStage;
  readonly downstream_stages: readonly RevisableStage[];
  readonly required_changes: readonly string[];
};

export type OrchestratorState = {
  readonly started: boolean;
  readonly run_id: string;
  readonly account_slug: string;
  readonly requires_human_approval: boolean;
  readonly status: RunStatus;
  readonly stages: Readonly<Record<OrchestratorStage, StageState>>;
  readonly pending_revision: PendingRevision | null;
  readonly event_count: number;
};

const TERMINAL_STATUSES: ReadonlySet<RunStatus> = new Set<RunStatus>([
  "awaiting_human_approval",
  "rejected",
  "failed",
]);

export function isTerminal(status: RunStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

// Stages a Manager revision on `target` must additionally re-run, per the four-stage chain the
// Manager itself reasons over (it never includes `manager`). e.g. designer -> [maker, communicator].
export function managerDownstream(target: RevisableStage): RevisableStage[] {
  return REVISABLE_STAGE_ORDER.slice(REVISABLE_STAGE_ORDER.indexOf(target) + 1);
}

// The full set the orchestrator invalidates on a revision: the target, its four-stage downstream, and
// the Manager (which always re-reviews). Ordered by STAGE_ORDER.
export function invalidationSet(target: RevisableStage): OrchestratorStage[] {
  return [target, ...managerDownstream(target), "manager"];
}

function emptyStage(stage: OrchestratorStage): StageState {
  return { stage, status: "pending", attempt: 0, current: null, history: [], pending_required_changes: null };
}

export function initialStages(): Record<OrchestratorStage, StageState> {
  return {
    researcher: emptyStage("researcher"),
    designer: emptyStage("designer"),
    maker: emptyStage("maker"),
    communicator: emptyStage("communicator"),
    manager: emptyStage("manager"),
  };
}

export const EMPTY_STATE: OrchestratorState = {
  started: false,
  run_id: "",
  account_slug: "",
  requires_human_approval: false,
  status: "in_progress",
  stages: initialStages(),
  pending_revision: null,
  event_count: 0,
};

// The earliest stage awaiting execution (pending or invalidated). Enforces no-skip / no-reorder:
// a stage is only startable when it is this stage. Returns null when nothing is executable (either a
// terminal run or a stage is currently active mid-execution).
export function expectedStage(state: OrchestratorState): OrchestratorStage | null {
  for (const stage of STAGE_ORDER) {
    const status = state.stages[stage].status;
    if (status === "pending" || status === "invalidated") return stage;
  }
  return null;
}

export type ResumePlan =
  | { readonly kind: "terminal"; readonly status: RunStatus }
  | { readonly kind: "route"; readonly target: RevisableStage }
  | { readonly kind: "resume_active"; readonly stage: OrchestratorStage; readonly version: number }
  | { readonly kind: "start_stage"; readonly stage: OrchestratorStage; readonly version: number };

// After replay, the first thing the orchestrator must do. A completed approval resolves to a terminal
// plan (`awaiting_human_approval`) and never to an executable stage, so resume performs no action.
export function firstIncompleteStage(state: OrchestratorState): ResumePlan {
  if (!state.started) {
    throw new OrchestratorError("RUN_NOT_STARTED", "Cannot resume a run that was never started.");
  }
  if (isTerminal(state.status)) {
    return { kind: "terminal", status: state.status };
  }
  if (state.status === "revision_required") {
    if (!state.pending_revision) {
      throw new OrchestratorError("REVISION_NOT_PENDING", "revision_required without a pending revision.");
    }
    return { kind: "route", target: state.pending_revision.target_stage };
  }
  // in_progress: a dangling active stage (crash mid-execution) resumes without a duplicate start.
  for (const stage of STAGE_ORDER) {
    if (state.stages[stage].status === "active") {
      return { kind: "resume_active", stage, version: state.stages[stage].attempt };
    }
  }
  const next = expectedStage(state);
  if (next) {
    return { kind: "start_stage", stage: next, version: state.stages[next].attempt + 1 };
  }
  // Unreachable by any valid event history. While in_progress there is always an active stage (a
  // dangling start) or a pending/invalidated one (expectedStage). The Manager is the only terminal
  // stage, and it completes exclusively via the atomic `manager_decided` event — which in the same
  // step leaves the run terminal (approve/reject) or revision_required, never in_progress. So a
  // completed Manager can never coexist with an in_progress run: there is no "decision missing" limbo
  // and no manual-repair state. A state that reaches here is structurally corrupt, not a torn write.
  throw new OrchestratorError(
    "ILLEGAL_EVENT",
    "Invariant violated: in_progress run with no executable stage. A valid history can never reach this.",
  );
}

// Validates a Manager outcome against the run's governance and the runtime-computed downstream set.
// Pure — throws OrchestratorError on any violation so the orchestrator can refuse to seal a bad
// decision before persisting it.
export function assertManagerOutcome(state: OrchestratorState, outcome: ManagerOutcome): void {
  if (outcome.decision === "approve") {
    if (!state.requires_human_approval) {
      throw new OrchestratorError(
        "GOVERNANCE_VIOLATION",
        "Approval rejected: an approval always awaits a human, but this run does not mandate human approval.",
      );
    }
    if (state.requires_human_approval && outcome.governance.human_approval_required !== true) {
      throw new OrchestratorError(
        "GOVERNANCE_VIOLATION",
        "Approval rejected: this run requires a human but the decision does not require human approval.",
      );
    }
    if (outcome.governance.human_approval_required !== true) {
      throw new OrchestratorError(
        "GOVERNANCE_VIOLATION",
        "Approval rejected: governance must require human approval.",
      );
    }
    if (outcome.governance.permitted_next_action !== "await_human_approval") {
      throw new OrchestratorError(
        "GOVERNANCE_VIOLATION",
        `Approval rejected: permitted_next_action must be await_human_approval, got "${outcome.governance.permitted_next_action}".`,
      );
    }
    return;
  }
  const computed = managerDownstream(outcome.target_stage);
  const declared = outcome.downstream_stages_to_rerun;
  const agrees = declared.length === computed.length && declared.every((s, i) => s === computed[i]);
  if (!agrees) {
    throw new OrchestratorError(
      "DOWNSTREAM_MISMATCH",
      `Revision rejected: Manager declared downstream [${declared.join(", ")}] but the runtime computes `
        + `[${computed.join(", ")}] for target ${outcome.target_stage}.`,
    );
  }
}

function withStage(
  state: OrchestratorState,
  stage: OrchestratorStage,
  next: StageState,
): OrchestratorState {
  return { ...state, stages: { ...state.stages, [stage]: next } };
}

function requireStarted(state: OrchestratorState): void {
  if (!state.started) {
    throw new OrchestratorError("RUN_NOT_STARTED", "The run has not been started.");
  }
}

function refuseAfterTerminal(state: OrchestratorState): void {
  if (isTerminal(state.status)) {
    throw new OrchestratorError(
      "TERMINAL_RUN",
      `Refusing progress: the run is already ${state.status} (terminal).`,
    );
  }
}

// The single reducer. (state, event) -> state, throwing on any illegal transition.
export function applyEvent(state: OrchestratorState, event: OrchestratorEvent): OrchestratorState {
  const bump = (next: OrchestratorState): OrchestratorState => ({ ...next, event_count: state.event_count + 1 });

  switch (event.type) {
    case "run_started": {
      if (state.started) {
        throw new OrchestratorError("RUN_ALREADY_STARTED", "run_started must be the first event exactly once.");
      }
      return bump({
        started: true,
        run_id: event.run_id,
        account_slug: event.account_slug,
        requires_human_approval: event.requires_human_approval,
        status: "in_progress",
        stages: initialStages(),
        pending_revision: null,
        event_count: state.event_count,
      });
    }

    case "stage_started": {
      requireStarted(state);
      refuseAfterTerminal(state);
      if (state.status !== "in_progress") {
        throw new OrchestratorError("ILLEGAL_EVENT", `Cannot start a stage while the run is ${state.status}.`);
      }
      const expected = expectedStage(state);
      if (event.stage !== expected) {
        throw new OrchestratorError(
          "OUT_OF_ORDER_STAGE",
          `Out-of-order start: expected ${expected ?? "no stage"}, got ${event.stage}. Stages cannot skip or reorder.`,
        );
      }
      const current = state.stages[event.stage];
      if (current.status !== "pending" && current.status !== "invalidated") {
        throw new OrchestratorError(
          "DOUBLE_COMPLETION",
          `Cannot start ${event.stage}: it is ${current.status}, not pending/invalidated.`,
        );
      }
      const expectedVersion = current.attempt + 1;
      if (event.version !== expectedVersion) {
        throw new OrchestratorError(
          "STALE_VERSION",
          `Stale start for ${event.stage}: expected version ${expectedVersion}, got ${event.version}.`,
        );
      }
      return bump(withStage(state, event.stage, { ...current, status: "active", attempt: expectedVersion }));
    }

    case "stage_completed": {
      requireStarted(state);
      refuseAfterTerminal(state);
      if (event.stage === "manager") {
        // The Manager stage seals atomically via `manager_decided` so its completion and decision are
        // one durable event. A bare stage_completed for the Manager would recreate the very
        // "completed-but-undecided" limbo this design eliminates; refuse it.
        throw new OrchestratorError(
          "ILLEGAL_EVENT",
          "The Manager stage completes only via manager_decided, never a bare stage_completed.",
        );
      }
      const current = state.stages[event.stage];
      if (current.status !== "active") {
        throw new OrchestratorError(
          "STAGE_NOT_ACTIVE",
          `Cannot complete ${event.stage}: it is ${current.status}, not active (rejects double completion).`,
        );
      }
      if (event.version !== current.attempt) {
        throw new OrchestratorError(
          "STALE_VERSION",
          `Stale completion for ${event.stage}: active version is ${current.attempt}, got ${event.version}.`,
        );
      }
      if (event.artifact.stage !== event.stage || event.artifact.version !== event.version) {
        throw new OrchestratorError(
          "ILLEGAL_EVENT",
          `Artefact reference does not match the completing stage/version for ${event.stage}.`,
        );
      }
      return bump(withStage(state, event.stage, {
        ...current,
        status: "completed",
        current: event.artifact,
        history: [...current.history, event.artifact],
        pending_required_changes: null,
      }));
    }

    case "stage_failed": {
      requireStarted(state);
      refuseAfterTerminal(state);
      const current = state.stages[event.stage];
      if (current.status !== "active") {
        throw new OrchestratorError(
          "STAGE_NOT_ACTIVE",
          `Cannot fail ${event.stage}: it is ${current.status}, not active.`,
        );
      }
      const failed = withStage(state, event.stage, { ...current, status: "failed" });
      return bump({ ...failed, status: "failed" });
    }

    case "manager_decided": {
      requireStarted(state);
      refuseAfterTerminal(state);
      // The Manager must be mid-execution: this single event both completes the stage and seals the
      // decision. That atomicity is the whole point — a completed Manager and its recorded outcome can
      // never be torn apart across two appends.
      const current = state.stages.manager;
      if (current.status !== "active") {
        throw new OrchestratorError(
          "STAGE_NOT_ACTIVE",
          `Cannot seal a Manager decision: the Manager stage is ${current.status}, not active.`,
        );
      }
      if (event.version !== current.attempt) {
        throw new OrchestratorError(
          "STALE_VERSION",
          `Stale Manager decision: active version is ${current.attempt}, got ${event.version}.`,
        );
      }
      if (event.artifact.stage !== "manager" || event.artifact.version !== event.version) {
        throw new OrchestratorError(
          "ILLEGAL_EVENT",
          "Artefact reference does not match the completing Manager stage/version.",
        );
      }
      // Governance + runtime-computed downstream agreement, validated on every replay through the
      // hash-verified chain (not just at seal time).
      assertManagerOutcome(state, event.outcome);
      // Complete the Manager stage; its artefact is preserved in history forever.
      const sealed = withStage(state, "manager", {
        ...current,
        status: "completed",
        current: event.artifact,
        history: [...current.history, event.artifact],
        pending_required_changes: null,
      });
      if (event.outcome.decision === "approve") {
        return bump({ ...sealed, status: "awaiting_human_approval" });
      }
      if (event.outcome.decision === "reject") {
        return bump({ ...sealed, status: "rejected" });
      }
      // revise: enter the deterministic routing state. downstream is recomputed by the runtime (not
      // trusted from the payload); assertManagerOutcome already proved the payload agrees.
      return bump({
        ...sealed,
        status: "revision_required",
        pending_revision: {
          target_stage: event.outcome.target_stage,
          downstream_stages: managerDownstream(event.outcome.target_stage),
          required_changes: event.outcome.required_changes,
        },
      });
    }

    case "revision_routed": {
      requireStarted(state);
      if (state.status !== "revision_required" || !state.pending_revision) {
        throw new OrchestratorError("REVISION_NOT_PENDING", "revision_routed requires a pending revision.");
      }
      if (event.target_stage !== state.pending_revision.target_stage) {
        throw new OrchestratorError(
          "ILLEGAL_EVENT",
          `revision_routed target ${event.target_stage} does not match pending ${state.pending_revision.target_stage}.`,
        );
      }
      const expectedInvalidation = invalidationSet(event.target_stage);
      const agrees = event.invalidated_stages.length === expectedInvalidation.length
        && event.invalidated_stages.every((s, i) => s === expectedInvalidation[i]);
      if (!agrees) {
        throw new OrchestratorError(
          "ILLEGAL_EVENT",
          `revision_routed invalidated [${event.invalidated_stages.join(", ")}] must equal `
            + `[${expectedInvalidation.join(", ")}].`,
        );
      }
      const nextStages = { ...state.stages };
      for (const stage of expectedInvalidation) {
        const prior = state.stages[stage];
        // Prior artefacts are preserved in `history`; only the current pointer is superseded.
        nextStages[stage] = {
          ...prior,
          status: "invalidated",
          current: null,
          pending_required_changes: stage === event.target_stage
            ? state.pending_revision.required_changes
            : null,
        };
      }
      // Predecessors of the target keep their completed artefacts untouched.
      return bump({
        ...state,
        status: "in_progress",
        pending_revision: null,
        stages: nextStages,
      });
    }

    default: {
      // Exhaustive: every event type is handled above.
      const exhaustive: never = event;
      throw new OrchestratorError("ILLEGAL_EVENT", `Unknown event ${JSON.stringify(exhaustive)}.`);
    }
  }
}

// Fold an ordered event stream into state, validating every transition. This is the replay path used
// on rehydrate; a semantically inconsistent history (duplicate completion, skipped stage, progress
// after a terminal state, …) throws here.
export function replay(events: readonly OrchestratorEvent[]): OrchestratorState {
  let state = EMPTY_STATE;
  for (const event of events) {
    state = applyEvent(state, event);
  }
  return state;
}
