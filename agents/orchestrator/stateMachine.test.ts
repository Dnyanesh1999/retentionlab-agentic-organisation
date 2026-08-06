import { describe, expect, it } from "vitest";

import {
  type ArtifactReference,
  type ManagerOutcome,
  type OrchestratorEvent,
  type OrchestratorStage,
} from "./contracts.js";
import { OrchestratorError } from "./errors.js";
import {
  applyEvent,
  assertManagerOutcome,
  EMPTY_STATE,
  expectedStage,
  firstIncompleteStage,
  invalidationSet,
  managerDownstream,
  replay,
  type OrchestratorState,
} from "./stateMachine.js";
import { approveOutcome, fakeSha, FIXED_PRODUCED_AT, rejectOutcome, reviseOutcome, TEST_ACCOUNT, TEST_RUN_ID } from "./testFixture.js";

const AT = FIXED_PRODUCED_AT;

function ref(stage: OrchestratorStage, version: number): ArtifactReference {
  return { stage, version, sha256: fakeSha(`${stage}:${version}`), status_label: "ok", produced_at: AT };
}

function started(requiresHuman = true): OrchestratorState {
  return applyEvent(EMPTY_STATE, {
    type: "run_started",
    run_id: TEST_RUN_ID,
    account_slug: TEST_ACCOUNT,
    requires_human_approval: requiresHuman,
    created_at: AT,
  });
}

function completeStage(state: OrchestratorState, stage: OrchestratorStage, version: number): OrchestratorState {
  const reason = state.stages[stage].attempt > 0 ? "revision_rerun_start" : "sequential_start";
  let next = applyEvent(state, { type: "stage_started", stage, version, reason, created_at: AT });
  next = applyEvent(next, { type: "stage_completed", stage, version, artifact: ref(stage, version), created_at: AT });
  return next;
}

// Drives researcher -> designer -> maker -> communicator (all completed) in strict order; the Manager
// stage is left pending. The Manager can no longer be "completed" on its own — it seals atomically via
// manager_decided — so this is the correct pre-decision fixture.
function throughCommunicatorCompleted(state: OrchestratorState): OrchestratorState {
  let next = completeStage(state, "researcher", 1);
  next = completeStage(next, "designer", 1);
  next = completeStage(next, "maker", 1);
  next = completeStage(next, "communicator", 1);
  return next;
}

// Starts the Manager stage (active) at the given version.
function managerActive(state: OrchestratorState, version = 1): OrchestratorState {
  const reason = state.stages.manager.attempt > 0 ? "revision_rerun_start" : "sequential_start";
  return applyEvent(state, { type: "stage_started", stage: "manager", version, reason, created_at: AT });
}

// Seals the Manager (completion + decision) in one atomic manager_decided event.
function decideManager(state: OrchestratorState, outcome: ManagerOutcome, version = 1): OrchestratorState {
  return applyEvent(state, { type: "manager_decided", version, artifact: ref("manager", version), outcome, created_at: AT });
}

// Convenience: drive to a Manager that is active (started, awaiting its atomic decision).
function throughManagerActive(state: OrchestratorState): OrchestratorState {
  return managerActive(throughCommunicatorCompleted(state), 1);
}

function expectCode(fn: () => unknown, code: OrchestratorError["code"]): void {
  try {
    fn();
    throw new Error("expected an OrchestratorError");
  } catch (error) {
    expect(error).toBeInstanceOf(OrchestratorError);
    expect((error as OrchestratorError).code).toBe(code);
  }
}

describe("Gate 9 state machine — strict order", () => {
  it("advances through the five stages in exact order", () => {
    let state = started();
    expect(expectedStage(state)).toBe("researcher");
    state = completeStage(state, "researcher", 1);
    expect(expectedStage(state)).toBe("designer");
    state = completeStage(state, "designer", 1);
    expect(expectedStage(state)).toBe("maker");
    state = completeStage(state, "maker", 1);
    expect(expectedStage(state)).toBe("communicator");
    state = completeStage(state, "communicator", 1);
    expect(expectedStage(state)).toBe("manager");
  });

  it("refuses to skip a stage", () => {
    const state = started();
    expectCode(
      () => applyEvent(state, { type: "stage_started", stage: "designer", version: 1, reason: "sequential_start", created_at: AT }),
      "OUT_OF_ORDER_STAGE",
    );
  });

  it("refuses to reorder — cannot run maker before designer completes", () => {
    const state = completeStage(started(), "researcher", 1);
    // designer is expected, maker is out of order
    expectCode(
      () => applyEvent(state, { type: "stage_started", stage: "maker", version: 1, reason: "sequential_start", created_at: AT }),
      "OUT_OF_ORDER_STAGE",
    );
  });

  it("requires run_started first and only once", () => {
    expectCode(
      () => applyEvent(EMPTY_STATE, { type: "stage_started", stage: "researcher", version: 1, reason: "sequential_start", created_at: AT }),
      "RUN_NOT_STARTED",
    );
    expectCode(
      () => applyEvent(started(), { type: "run_started", run_id: TEST_RUN_ID, account_slug: TEST_ACCOUNT, requires_human_approval: true, created_at: AT }),
      "RUN_ALREADY_STARTED",
    );
  });
});

describe("Gate 9 state machine — duplicate & stale completion", () => {
  it("rejects double completion of the same stage", () => {
    const state = completeStage(started(), "researcher", 1);
    expectCode(
      () => applyEvent(state, { type: "stage_completed", stage: "researcher", version: 1, artifact: ref("researcher", 1), created_at: AT }),
      "STAGE_NOT_ACTIVE",
    );
  });

  it("rejects a re-start of a completed stage", () => {
    const state = completeStage(started(), "researcher", 1);
    // researcher completed; expected stage is now designer, so a researcher restart is out of order
    expectCode(
      () => applyEvent(state, { type: "stage_started", stage: "researcher", version: 2, reason: "sequential_start", created_at: AT }),
      "OUT_OF_ORDER_STAGE",
    );
  });

  it("rejects a stale version on start", () => {
    const state = applyEvent(started(), { type: "stage_started", stage: "researcher", version: 1, reason: "sequential_start", created_at: AT });
    // researcher is active v1; completing with a wrong version is stale
    expectCode(
      () => applyEvent(state, { type: "stage_completed", stage: "researcher", version: 2, artifact: ref("researcher", 2), created_at: AT }),
      "STALE_VERSION",
    );
  });

  it("rejects an out-of-order start version", () => {
    const state = started();
    expectCode(
      () => applyEvent(state, { type: "stage_started", stage: "researcher", version: 2, reason: "sequential_start", created_at: AT }),
      "STALE_VERSION",
    );
  });

  it("rejects an artefact reference that does not match the completing stage", () => {
    const state = applyEvent(started(), { type: "stage_started", stage: "researcher", version: 1, reason: "sequential_start", created_at: AT });
    expectCode(
      () => applyEvent(state, { type: "stage_completed", stage: "researcher", version: 1, artifact: ref("designer", 1), created_at: AT }),
      "ILLEGAL_EVENT",
    );
  });
});

describe("Gate 9 state machine — terminal states", () => {
  it("awaits human approval on approve and refuses further progress", () => {
    const active = throughManagerActive(started());
    const state = decideManager(active, approveOutcome());
    expect(state.status).toBe("awaiting_human_approval");
    expect(state.stages.manager.status).toBe("completed");
    expect(state.stages.manager.current?.version).toBe(1);
    expect(firstIncompleteStage(state)).toEqual({ kind: "terminal", status: "awaiting_human_approval" });
    // No external action / no further stage may start.
    expectCode(
      () => applyEvent(state, { type: "stage_started", stage: "researcher", version: 2, reason: "revision_rerun_start", created_at: AT }),
      "TERMINAL_RUN",
    );
  });

  it("marks the run rejected and refuses progress (rejection terminality)", () => {
    const active = throughManagerActive(started());
    const state = decideManager(active, rejectOutcome("designer"));
    expect(state.status).toBe("rejected");
    expect(state.stages.manager.status).toBe("completed");
    expectCode(
      () => applyEvent(state, { type: "stage_started", stage: "designer", version: 2, reason: "revision_rerun_start", created_at: AT }),
      "TERMINAL_RUN",
    );
  });

  it("marks the run failed on executor failure and refuses progress", () => {
    let state = applyEvent(started(), { type: "stage_started", stage: "researcher", version: 1, reason: "sequential_start", created_at: AT });
    state = applyEvent(state, { type: "stage_failed", stage: "researcher", version: 1, error: "boom", created_at: AT });
    expect(state.status).toBe("failed");
    expectCode(
      () => applyEvent(state, { type: "stage_started", stage: "researcher", version: 2, reason: "revision_rerun_start", created_at: AT }),
      "TERMINAL_RUN",
    );
  });

  it("refuses approval when the run does not require a human", () => {
    const active = throughManagerActive(started(false));
    expectCode(() => decideManager(active, approveOutcome()), "GOVERNANCE_VIOLATION");
  });

  it("rejects a Manager decision before the Manager stage is active", () => {
    // researcher completed, Manager still pending — sealing a decision is illegal.
    const state = completeStage(started(), "researcher", 1);
    expectCode(() => decideManager(state, approveOutcome()), "STAGE_NOT_ACTIVE");
  });

  it("rejects a bare stage_completed for the Manager (it seals only via manager_decided)", () => {
    const active = throughManagerActive(started());
    expectCode(
      () => applyEvent(active, { type: "stage_completed", stage: "manager", version: 1, artifact: ref("manager", 1), created_at: AT }),
      "ILLEGAL_EVENT",
    );
  });

  it("rejects a stale-version Manager decision", () => {
    const active = throughManagerActive(started());
    expectCode(() => decideManager(active, approveOutcome(), 2), "STALE_VERSION");
  });

  it("rejects a manager_decided whose artefact does not reference the Manager stage/version", () => {
    const active = throughManagerActive(started());
    expectCode(
      () => applyEvent(active, { type: "manager_decided", version: 1, artifact: ref("designer", 1), outcome: approveOutcome(), created_at: AT }),
      "ILLEGAL_EVENT",
    );
  });
});

describe("Gate 9 state machine — revision propagation & versioning", () => {
  it("computes downstream and invalidation sets deterministically", () => {
    expect(managerDownstream("designer")).toEqual(["maker", "communicator"]);
    expect(invalidationSet("designer")).toEqual(["designer", "maker", "communicator", "manager"]);
    expect(managerDownstream("communicator")).toEqual([]);
    expect(invalidationSet("communicator")).toEqual(["communicator", "manager"]);
  });

  it("routes a revision, increments versions, invalidates only target+downstream+manager, preserves history", () => {
    let state = throughManagerActive(started());
    state = decideManager(state, reviseOutcome("designer"));
    expect(state.status).toBe("revision_required");
    // The revising Manager pass is itself completed and preserved in history before routing.
    expect(state.stages.manager.status).toBe("completed");
    expect(state.pending_revision?.required_changes).toEqual(["Tighten the designer output before re-review."]);

    state = applyEvent(state, {
      type: "revision_routed",
      target_stage: "designer",
      invalidated_stages: invalidationSet("designer"),
      created_at: AT,
    });
    expect(state.status).toBe("in_progress");

    // Researcher untouched; designer/maker/communicator/manager invalidated.
    expect(state.stages.researcher.status).toBe("completed");
    expect(state.stages.designer.status).toBe("invalidated");
    expect(state.stages.maker.status).toBe("invalidated");
    expect(state.stages.communicator.status).toBe("invalidated");
    expect(state.stages.manager.status).toBe("invalidated");

    // Superseded artefacts preserved in history; current pointer cleared.
    expect(state.stages.designer.history).toHaveLength(1);
    expect(state.stages.designer.current).toBeNull();

    // Resume points at the target and only the target carries the required changes.
    expect(firstIncompleteStage(state)).toEqual({ kind: "start_stage", stage: "designer", version: 2 });
    expect(state.stages.designer.pending_required_changes).toEqual(["Tighten the designer output before re-review."]);
    expect(state.stages.maker.pending_required_changes).toBeNull();

    // Version increments on rerun; prior artefact stays in history.
    state = completeStage(state, "designer", 2);
    expect(state.stages.designer.history).toHaveLength(2);
    expect(state.stages.designer.current?.version).toBe(2);
    expect(state.stages.designer.history[0]?.version).toBe(1);
  });

  it("rejects a manager_decided revise whose downstream disagrees with the runtime computation", () => {
    const active = throughManagerActive(started());
    const badRevise: ManagerOutcome = {
      decision: "revise",
      target_stage: "designer",
      downstream_stages_to_rerun: ["communicator"], // wrong: should be [maker, communicator]
      required_changes: ["x"],
      governance: { human_approval_required: true, permitted_next_action: "route_targeted_revision" },
    };
    expectCode(() => decideManager(active, badRevise), "DOWNSTREAM_MISMATCH");
    // The bad decision was refused; the Manager stays active and the run stays recoverable.
    expect(active.stages.manager.status).toBe("active");
  });

  it("rejects a revision_routed with the wrong invalidation set", () => {
    let state = throughManagerActive(started());
    state = decideManager(state, reviseOutcome("maker"));
    expectCode(
      () => applyEvent(state, {
        type: "revision_routed",
        target_stage: "maker",
        invalidated_stages: ["maker", "manager"], // wrong: missing communicator
        created_at: AT,
      }),
      "ILLEGAL_EVENT",
    );
  });
});

describe("Gate 9 state machine — manager outcome governance", () => {
  it("rejects an approval that does not require a human", () => {
    const state = throughCommunicatorCompleted(started());
    expectCode(
      () => assertManagerOutcome(state, {
        decision: "approve",
        governance: { human_approval_required: false, permitted_next_action: "await_human_approval" },
      }),
      "GOVERNANCE_VIOLATION",
    );
  });

  it("rejects an approval permitting anything but await_human_approval", () => {
    const state = throughCommunicatorCompleted(started());
    expectCode(
      () => assertManagerOutcome(state, {
        decision: "approve",
        governance: { human_approval_required: true, permitted_next_action: "auto_send" },
      }),
      "GOVERNANCE_VIOLATION",
    );
  });

  it("accepts a well-formed approval", () => {
    const state = throughCommunicatorCompleted(started());
    expect(() => assertManagerOutcome(state, approveOutcome())).not.toThrow();
  });

  it("rejects a revise whose declared downstream disagrees with the computed set", () => {
    const state = throughCommunicatorCompleted(started());
    expectCode(
      () => assertManagerOutcome(state, {
        decision: "revise",
        target_stage: "designer",
        downstream_stages_to_rerun: ["communicator"],
        required_changes: ["x"],
        governance: { human_approval_required: true, permitted_next_action: "route_targeted_revision" },
      }),
      "DOWNSTREAM_MISMATCH",
    );
  });
});

describe("Gate 9 state machine — replay determinism", () => {
  it("replays an event stream into the same state", () => {
    const events: OrchestratorEvent[] = [
      { type: "run_started", run_id: TEST_RUN_ID, account_slug: TEST_ACCOUNT, requires_human_approval: true, created_at: AT },
      { type: "stage_started", stage: "researcher", version: 1, reason: "sequential_start", created_at: AT },
      { type: "stage_completed", stage: "researcher", version: 1, artifact: ref("researcher", 1), created_at: AT },
    ];
    const state = replay(events);
    expect(state.stages.researcher.status).toBe("completed");
    expect(expectedStage(state)).toBe("designer");
    expect(state.event_count).toBe(3);
  });

  it("rehydration re-detects a logically inconsistent (skipping) history", () => {
    const events: OrchestratorEvent[] = [
      { type: "run_started", run_id: TEST_RUN_ID, account_slug: TEST_ACCOUNT, requires_human_approval: true, created_at: AT },
      { type: "stage_started", stage: "designer", version: 1, reason: "sequential_start", created_at: AT },
    ];
    expectCode(() => replay(events), "OUT_OF_ORDER_STAGE");
  });
});

describe("Gate 9 state machine — atomic Manager seal is crash-safe by construction", () => {
  // The full canonical event stream of a single approving pass, in order. Every non-empty PREFIX of
  // this is a "valid persisted history at some crash point" — the reducer must fold each to a
  // resumable state, never a manual-repair limbo.
  const fullApprovePass: OrchestratorEvent[] = [
    { type: "run_started", run_id: TEST_RUN_ID, account_slug: TEST_ACCOUNT, requires_human_approval: true, created_at: AT },
    { type: "stage_started", stage: "researcher", version: 1, reason: "sequential_start", created_at: AT },
    { type: "stage_completed", stage: "researcher", version: 1, artifact: ref("researcher", 1), created_at: AT },
    { type: "stage_started", stage: "designer", version: 1, reason: "sequential_start", created_at: AT },
    { type: "stage_completed", stage: "designer", version: 1, artifact: ref("designer", 1), created_at: AT },
    { type: "stage_started", stage: "maker", version: 1, reason: "sequential_start", created_at: AT },
    { type: "stage_completed", stage: "maker", version: 1, artifact: ref("maker", 1), created_at: AT },
    { type: "stage_started", stage: "communicator", version: 1, reason: "sequential_start", created_at: AT },
    { type: "stage_completed", stage: "communicator", version: 1, artifact: ref("communicator", 1), created_at: AT },
    { type: "stage_started", stage: "manager", version: 1, reason: "sequential_start", created_at: AT },
    { type: "manager_decided", version: 1, artifact: ref("manager", 1), outcome: approveOutcome(), created_at: AT },
  ];

  it("every valid prefix folds to a resumable state — no prefix requires manual repair", () => {
    for (let cut = 1; cut <= fullApprovePass.length; cut += 1) {
      const prefix = fullApprovePass.slice(0, cut);
      const state = replay(prefix);
      // firstIncompleteStage must not throw for any valid prefix: it either resumes a stage,
      // routes, or reports terminal. There is no "await_manager_decision"/manual-repair outcome.
      expect(() => firstIncompleteStage(state)).not.toThrow();
    }
  });

  it("the prefix ending immediately BEFORE the atomic seal resumes the active Manager (no limbo)", () => {
    // Crash right after the Manager stage_started, before manager_decided was appended.
    const prefix = fullApprovePass.slice(0, fullApprovePass.length - 1);
    const state = replay(prefix);
    expect(state.status).toBe("in_progress");
    expect(state.stages.manager.status).toBe("active");
    // Resume re-runs the active Manager; the outcome was never persisted, so nothing was lost.
    expect(firstIncompleteStage(state)).toEqual({ kind: "resume_active", stage: "manager", version: 1 });
  });

  it("the prefix ending AT the atomic seal is already terminal — resume executes nothing", () => {
    const state = replay(fullApprovePass);
    expect(state.status).toBe("awaiting_human_approval");
    expect(state.stages.manager.status).toBe("completed");
    expect(firstIncompleteStage(state)).toEqual({ kind: "terminal", status: "awaiting_human_approval" });
  });

  it("there is no legal single event that completes the Manager without also sealing its decision", () => {
    // The only completed-Manager producer is manager_decided; a bare stage_completed is refused, so a
    // completed Manager and an in_progress run can never coexist in any valid history.
    const active = throughManagerActive(started());
    expectCode(
      () => applyEvent(active, { type: "stage_completed", stage: "manager", version: 1, artifact: ref("manager", 1), created_at: AT }),
      "ILLEGAL_EVENT",
    );
  });
});
