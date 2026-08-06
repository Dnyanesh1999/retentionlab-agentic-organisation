import { createHash } from "node:crypto";

import { type ManagerOutcome, type OrchestratorStage } from "./contracts.js";
import { managerDownstream } from "./stateMachine.js";
import type { OrchestratorExecutors, StageExecutionResult, StageExecutorContext } from "./orchestrator.js";

// Deterministic test scaffolding for the orchestration backbone. No live models, no wall-clock.

export const TEST_RUN_ID = "8f2c8a1e-4d3b-4a2f-9c1a-2b7e6d5c4a3b";
export const TEST_ACCOUNT = "signal-garden";
export const FIXED_PRODUCED_AT = "2026-08-06T04:00:00.000Z";

export function fakeSha(seed: string): string {
  return createHash("sha256").update(seed).digest("hex");
}

const STATUS_LABEL: Record<OrchestratorStage, string> = {
  researcher: "completed",
  designer: "ready_for_maker",
  maker: "ready_for_communication",
  communicator: "ready_for_manager",
  manager: "decided",
};

export function approveOutcome(): ManagerOutcome {
  return {
    decision: "approve",
    governance: { human_approval_required: true, permitted_next_action: "await_human_approval" },
  };
}

export function reviseOutcome(target: Parameters<typeof managerDownstream>[0]): ManagerOutcome {
  return {
    decision: "revise",
    target_stage: target,
    downstream_stages_to_rerun: managerDownstream(target),
    required_changes: [`Tighten the ${target} output before re-review.`],
    governance: { human_approval_required: true, permitted_next_action: "route_targeted_revision" },
  };
}

export function rejectOutcome(target: Parameters<typeof managerDownstream>[0]): ManagerOutcome {
  return {
    decision: "reject",
    target_stage: target,
    downstream_stages_to_rerun: managerDownstream(target),
    required_changes: [`The ${target} output is unsafe to proceed and must be reworked.`],
    governance: { human_approval_required: true, permitted_next_action: "halt_and_route_revision" },
  };
}

export type ExecutorCall = {
  readonly stage: OrchestratorStage;
  readonly version: number;
  readonly required_changes: readonly string[] | null;
  readonly predecessors: readonly OrchestratorStage[];
};

export type ExecutorBuild = {
  readonly executors: OrchestratorExecutors;
  readonly calls: ExecutorCall[];
};

export type ExecutorOverrides = {
  // A queue of Manager outcomes; the last is repeated. Defaults to a single approve.
  readonly managerOutcomes?: readonly ManagerOutcome[];
  // Stages that should throw on their nth (1-based) attempt, to model an executor crash.
  readonly failOnAttempt?: Partial<Record<OrchestratorStage, number>>;
  // Force a specific stage's returned sha256 (e.g. to model an unstable/invalid hash).
  readonly shaOverride?: Partial<Record<OrchestratorStage, string>>;
  // Make a non-Manager stage wrongly return a manager_outcome, to exercise the guard.
  readonly leakManagerOutcome?: OrchestratorStage;
};

export function buildExecutors(overrides: ExecutorOverrides = {}): ExecutorBuild {
  const calls: ExecutorCall[] = [];
  const managerOutcomes = overrides.managerOutcomes ?? [approveOutcome()];
  let managerIndex = 0;

  function executor(stage: OrchestratorStage): (ctx: StageExecutorContext) => Promise<StageExecutionResult> {
    return async (context) => {
      calls.push({
        stage,
        version: context.version,
        required_changes: context.required_changes,
        predecessors: [...context.completed_artifacts.keys()],
      });

      const failAt = overrides.failOnAttempt?.[stage];
      if (failAt !== undefined && failAt === context.version) {
        throw new Error(`Injected failure in ${stage} on attempt ${context.version}.`);
      }

      const sha256 = overrides.shaOverride?.[stage] ?? fakeSha(`${stage}:${context.version}`);
      const base: StageExecutionResult = {
        sha256,
        status_label: STATUS_LABEL[stage],
        produced_at: FIXED_PRODUCED_AT,
      };

      if (stage === "manager") {
        const outcome = managerOutcomes[Math.min(managerIndex, managerOutcomes.length - 1)] ?? approveOutcome();
        managerIndex += 1;
        return { ...base, manager_outcome: outcome };
      }

      if (overrides.leakManagerOutcome === stage) {
        return { ...base, manager_outcome: approveOutcome() };
      }
      return base;
    };
  }

  const executors: OrchestratorExecutors = {
    researcher: executor("researcher"),
    designer: executor("designer"),
    maker: executor("maker"),
    communicator: executor("communicator"),
    manager: executor("manager"),
  };

  return { executors, calls };
}
