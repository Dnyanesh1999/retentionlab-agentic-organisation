// @vitest-environment node

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { communicationPlanSchema } from "../communicator/contracts.js";
import { recoveryDesignSpecificationSchema } from "../designer/contracts.js";
import { recoveryRoomArtifactSchema } from "../maker/contracts.js";
import { runManager } from "../manager/run.js";
import { makeManagerDecisionDraft, makeManagerInput } from "../manager/testFixture.js";
import type { ManagerModelAdapter } from "../manager/model.js";
import { researchBriefSchema } from "../researcher/contracts.js";

import { compactArtifactHash } from "./artifactStore.js";
import {
  type ArtifactReference,
  type OrchestratorEvent,
  type OrchestratorStage,
  type StageStatus,
} from "./contracts.js";
import { OrchestratorError } from "./errors.js";
import { createFileEventStore, createMemoryEventStore, type EventStore } from "./eventStore.js";
import { createLivePipelineExecutors, type PipelineProducers } from "./livePipeline.js";
import { createOrchestrator } from "./orchestrator.js";
import {
  applyEvent,
  EMPTY_STATE,
  failedStage,
  firstIncompleteStage,
  type OrchestratorState,
} from "./stateMachine.js";
import { buildPipelineTranscript, renderTranscriptMarkdown, serializePipelineTranscript } from "./transcript.js";
import { loadTranscriptSource } from "./transcriptSource.js";
import { buildExecutors, fakeSha, FIXED_PRODUCED_AT, TEST_ACCOUNT, TEST_RUN_ID } from "./testFixture.js";
import { writeRunInput } from "./runInput.js";

const AT = FIXED_PRODUCED_AT;
const fixedClock = () => new Date(AT);
const REASON = "Operator retry after deterministic validation correction on the failed communicator stage.";

// ------------------------------------------------------------------ pure reducer helpers

function ref(stage: OrchestratorStage, version: number): ArtifactReference {
  return { stage, version, sha256: fakeSha(`${stage}:${version}`), status_label: "ok", produced_at: AT };
}

function started(): OrchestratorState {
  return applyEvent(EMPTY_STATE, {
    type: "run_started",
    run_id: TEST_RUN_ID,
    account_slug: TEST_ACCOUNT,
    requires_human_approval: true,
    created_at: AT,
  });
}

function completeStage(state: OrchestratorState, stage: OrchestratorStage, version: number): OrchestratorState {
  const reason = state.stages[stage].attempt > 0 ? "revision_rerun_start" : "sequential_start";
  let next = applyEvent(state, { type: "stage_started", stage, version, reason, created_at: AT });
  next = applyEvent(next, { type: "stage_completed", stage, version, artifact: ref(stage, version), created_at: AT });
  return next;
}

// researcher/designer/maker completed, then communicator started and FAILED at v1: run is `failed`.
function failedAtCommunicator(): OrchestratorState {
  let state = completeStage(started(), "researcher", 1);
  state = completeStage(state, "designer", 1);
  state = completeStage(state, "maker", 1);
  state = applyEvent(state, { type: "stage_started", stage: "communicator", version: 1, reason: "sequential_start", created_at: AT });
  state = applyEvent(state, { type: "stage_failed", stage: "communicator", version: 1, error: "missing citation", created_at: AT });
  return state;
}

function retryEvent(stage: OrchestratorStage, failed_version: number, reason = REASON): OrchestratorEvent {
  return { type: "failed_stage_retry_requested", stage, failed_version, operator_reason: reason, created_at: AT };
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

describe("failed-stage recovery — pure reducer", () => {
  it("allows recovery of the failed communicator: invalidated, run returns to in_progress", () => {
    const failed = failedAtCommunicator();
    expect(failed.status).toBe("failed");
    expect(failedStage(failed)).toBe("communicator");

    const recovered = applyEvent(failed, retryEvent("communicator", 1));
    expect(recovered.status).toBe("in_progress");
    expect(recovered.stages.communicator.status).toBe("invalidated");
    expect(recovered.stages.communicator.current).toBeNull();
    expect(recovered.stages.communicator.pending_required_changes).toBeNull();
    // event_count advanced by exactly one append; nothing else lost.
    expect(recovered.event_count).toBe(failed.event_count + 1);
  });

  it("reruns at attempt/version +1 with NO fabricated Manager required_changes", () => {
    const recovered = applyEvent(failedAtCommunicator(), retryEvent("communicator", 1));
    // The failed attempt count is preserved, so the next start is failed_version + 1.
    expect(recovered.stages.communicator.attempt).toBe(1);
    expect(firstIncompleteStage(recovered)).toEqual({ kind: "start_stage", stage: "communicator", version: 2 });
    expect(recovered.stages.communicator.pending_required_changes).toBeNull();
  });

  it("preserves every predecessor artefact and the failure event/history", () => {
    const failed = failedAtCommunicator();
    const recovered = applyEvent(failed, retryEvent("communicator", 1));
    for (const stage of ["researcher", "designer", "maker"] as const) {
      expect(recovered.stages[stage].status).toBe("completed");
      expect(recovered.stages[stage].current?.version).toBe(1);
      expect(recovered.stages[stage].history).toEqual(failed.stages[stage].history);
    }
    // The communicator's own history is untouched (its failed v1 never produced an accepted artefact).
    expect(recovered.stages.communicator.history).toEqual(failed.stages.communicator.history);
    expect(recovered.stages.manager.status).toBe("pending");
  });

  it("rejects a retry of the WRONG stage", () => {
    // designer is completed, not failed — retrying it must be refused.
    expectCode(() => applyEvent(failedAtCommunicator(), retryEvent("designer", 1)), "RETRY_STAGE_MISMATCH");
  });

  it("rejects a retry with the WRONG failed version", () => {
    expectCode(() => applyEvent(failedAtCommunicator(), retryEvent("communicator", 2)), "STALE_VERSION");
  });

  it("rejects a retry of a non-failed (in_progress) run", () => {
    const inProgress = completeStage(started(), "researcher", 1);
    expect(inProgress.status).toBe("in_progress");
    expectCode(() => applyEvent(inProgress, retryEvent("designer", 1)), "RUN_NOT_FAILED");
  });

  it("refuses to retry a Manager APPROVAL terminal outcome", () => {
    let state = completeStage(started(), "researcher", 1);
    state = completeStage(state, "designer", 1);
    state = completeStage(state, "maker", 1);
    state = completeStage(state, "communicator", 1);
    state = applyEvent(state, { type: "stage_started", stage: "manager", version: 1, reason: "sequential_start", created_at: AT });
    state = applyEvent(state, {
      type: "manager_decided",
      version: 1,
      artifact: ref("manager", 1),
      outcome: { decision: "approve", governance: { human_approval_required: true, permitted_next_action: "await_human_approval" } },
      created_at: AT,
    });
    expect(state.status).toBe("awaiting_human_approval");
    expectCode(() => applyEvent(state, retryEvent("manager", 1)), "RUN_NOT_FAILED");
  });

  it("refuses to retry a Manager REJECTION terminal outcome", () => {
    let state = completeStage(started(), "researcher", 1);
    state = completeStage(state, "designer", 1);
    state = completeStage(state, "maker", 1);
    state = completeStage(state, "communicator", 1);
    state = applyEvent(state, { type: "stage_started", stage: "manager", version: 1, reason: "sequential_start", created_at: AT });
    state = applyEvent(state, {
      type: "manager_decided",
      version: 1,
      artifact: ref("manager", 1),
      outcome: {
        decision: "reject",
        target_stage: "communicator",
        downstream_stages_to_rerun: [],
        required_changes: ["unsafe"],
        governance: { human_approval_required: true, permitted_next_action: "halt_and_route_revision" },
      },
      created_at: AT,
    });
    expect(state.status).toBe("rejected");
    expectCode(() => applyEvent(state, retryEvent("communicator", 1)), "RUN_NOT_FAILED");
  });

  it("rejects a malformed history whose predecessor is not completed", () => {
    const failed = failedAtCommunicator();
    const malformed: OrchestratorState = {
      ...failed,
      stages: { ...failed.stages, maker: { ...failed.stages.maker, status: "invalidated" as StageStatus, current: null } },
    };
    expectCode(() => applyEvent(malformed, retryEvent("communicator", 1)), "ILLEGAL_EVENT");
  });

  it("rejects a malformed history whose downstream stage already holds an accepted artefact", () => {
    const failed = failedAtCommunicator();
    const malformed: OrchestratorState = {
      ...failed,
      stages: {
        ...failed.stages,
        manager: { ...failed.stages.manager, status: "completed" as StageStatus, current: ref("manager", 1), history: [ref("manager", 1)] },
      },
    };
    expectCode(() => applyEvent(malformed, retryEvent("communicator", 1)), "ILLEGAL_EVENT");
  });

  it("refuses a duplicate retry — the second finds an in_progress run", () => {
    const recovered = applyEvent(failedAtCommunicator(), retryEvent("communicator", 1));
    expectCode(() => applyEvent(recovered, retryEvent("communicator", 1)), "RUN_NOT_FAILED");
  });
});

// ------------------------------------------------------------------ orchestrator service (no live calls)

function makeOrchestrator(store: EventStore, overrides: Parameters<typeof buildExecutors>[0] = {}) {
  const build = buildExecutors(overrides);
  return { orchestrator: createOrchestrator({ store, executors: build.executors, now: fixedClock }), calls: build.calls };
}

async function eventTypes(store: EventStore): Promise<OrchestratorEvent["type"][]> {
  return (await store.readEnvelopes(TEST_RUN_ID)).map((envelope) => envelope.event.type);
}

const startInput = { run_id: TEST_RUN_ID, account_slug: TEST_ACCOUNT };

describe("Orchestrator.retryFailed — service boundary (injected executors only)", () => {
  it("recovers a failed communicator and drives strictly through the Manager to human approval", async () => {
    const store = createMemoryEventStore();
    // A single executor set: communicator throws on attempt 1, succeeds on the v2 rerun.
    const { orchestrator, calls } = makeOrchestrator(store, { failOnAttempt: { communicator: 1 } });

    const first = await orchestrator.start(startInput);
    expect(first.status).toBe("failed");
    expect(calls.map((c) => c.stage)).toEqual(["researcher", "designer", "maker", "communicator"]);

    const recovered = await orchestrator.retryFailed(TEST_RUN_ID, REASON);
    expect(recovered.status).toBe("awaiting_human_approval");

    // Only the communicator reran (v2), then the Manager ran for the first time (v1).
    expect(calls.map((c) => c.stage)).toEqual([
      "researcher", "designer", "maker", "communicator", // first pass (communicator v1 failed)
      "communicator", "manager", // recovery: v2 rerun then strict downstream through Manager
    ]);
    const communicatorCalls = calls.filter((c) => c.stage === "communicator");
    expect(communicatorCalls.map((c) => c.version)).toEqual([1, 2]);
    // The rerun carries NO fabricated Manager required_changes.
    expect(communicatorCalls[1]?.required_changes).toBeNull();

    // Predecessors untouched; communicator v2 current; Manager v1.
    expect(recovered.state.stages.researcher.current?.version).toBe(1);
    expect(recovered.state.stages.designer.current?.version).toBe(1);
    expect(recovered.state.stages.maker.current?.version).toBe(1);
    expect(recovered.state.stages.communicator.current?.version).toBe(2);
    expect(recovered.state.stages.manager.current?.version).toBe(1);

    // The append-only log preserves the failure event and records exactly one recovery event.
    const types = await eventTypes(store);
    expect(types.filter((t) => t === "stage_failed")).toHaveLength(1);
    expect(types.filter((t) => t === "failed_stage_retry_requested")).toHaveLength(1);
    expect(types.at(-1)).toBe("manager_decided");
  });

  it("refuses a duplicate retry once the run has recovered", async () => {
    const store = createMemoryEventStore();
    const { orchestrator } = makeOrchestrator(store, { failOnAttempt: { communicator: 1 } });
    await orchestrator.start(startInput);
    await orchestrator.retryFailed(TEST_RUN_ID, REASON);
    // Now awaiting_human_approval — a second recovery must fail closed with no new event.
    const before = (await store.readEnvelopes(TEST_RUN_ID)).length;
    await expect(orchestrator.retryFailed(TEST_RUN_ID, REASON)).rejects.toMatchObject({ code: "RUN_NOT_FAILED" });
    expect((await store.readEnvelopes(TEST_RUN_ID)).length).toBe(before);
  });

  it("refuses to retry a run that never failed (approval boundary)", async () => {
    const store = createMemoryEventStore();
    const { orchestrator } = makeOrchestrator(store);
    const result = await orchestrator.start(startInput);
    expect(result.status).toBe("awaiting_human_approval");
    await expect(orchestrator.retryFailed(TEST_RUN_ID, REASON)).rejects.toMatchObject({ code: "RUN_NOT_FAILED" });
  });

  it("rejects a too-short operator reason before appending anything", async () => {
    const store = createMemoryEventStore();
    const { orchestrator } = makeOrchestrator(store, { failOnAttempt: { communicator: 1 } });
    await orchestrator.start(startInput);
    const before = await eventTypes(store);
    await expect(orchestrator.retryFailed(TEST_RUN_ID, "too short")).rejects.toMatchObject({ code: "INVALID_OPERATOR_REASON" });
    // No recovery event was appended on the invalid reason.
    expect(await eventTypes(store)).toEqual(before);
    expect(before).not.toContain("failed_stage_retry_requested");
  });
});

// ------------------------------------------------------------------ live composition + transcript visibility

const LIVE_NOW = new Date("2026-08-06T04:00:00.000Z");

function stubManagerModel(): ManagerModelAdapter {
  const draft = makeManagerDecisionDraft();
  return { requestedModel: "example/manager-free", generate: async () => ({ text: JSON.stringify(draft), resolvedModel: "example/manager-free" }) };
}

// SHA-linked producers (as in the live-pipeline tests) whose Communicator FAILS on its first call and
// succeeds on the operator retry — modelling the audited Communicator validation failure and recovery.
function recoveringProducers(chain: ReturnType<typeof makeManagerInput>, calls: { communicator: number }): PipelineProducers {
  return {
    researcher: async () => chain.research_brief,
    designer: async (ctx) => {
      const brief = researchBriefSchema.parse(ctx.predecessors.get("researcher"));
      return { ...chain.design_specification, run_id: brief.run_id, account_slug: brief.account_slug, source: { ...chain.design_specification.source, research_artifact_sha256: compactArtifactHash(researchBriefSchema, brief) } };
    },
    maker: async (ctx) => {
      const spec = recoveryDesignSpecificationSchema.parse(ctx.predecessors.get("designer"));
      return { ...chain.recovery_room_artifact, run_id: spec.run_id, account_slug: spec.account_slug, source: { ...chain.recovery_room_artifact.source, design_artifact_sha256: compactArtifactHash(recoveryDesignSpecificationSchema, spec) } };
    },
    communicator: async (ctx) => {
      calls.communicator += 1;
      if (calls.communicator === 1) throw new Error("Communicator failed deterministic validation: an unsupported claim citation.");
      const maker = recoveryRoomArtifactSchema.parse(ctx.predecessors.get("maker"));
      return { ...chain.communication_plan, run_id: maker.run_id, account_slug: maker.account_slug, source: { ...chain.communication_plan.source, maker_artifact_sha256: compactArtifactHash(recoveryRoomArtifactSchema, maker), implementation_commit_sha: maker.implementation_evidence.commit_sha } };
    },
    manager: async (ctx) => runManager({
      input: {
        run_id: ctx.runId,
        research_brief: researchBriefSchema.parse(ctx.predecessors.get("researcher")),
        design_specification: recoveryDesignSpecificationSchema.parse(ctx.predecessors.get("designer")),
        recovery_room_artifact: recoveryRoomArtifactSchema.parse(ctx.predecessors.get("maker")),
        communication_plan: communicationPlanSchema.parse(ctx.predecessors.get("communicator")),
      },
      model: stubManagerModel(),
      now: ctx.now,
    }),
  };
}

async function setupRecoveringRun() {
  const runDir = await mkdtemp(join(tmpdir(), "retentionlab-recovery-"));
  const chain = makeManagerInput();
  await writeRunInput(runDir, { run_id: chain.run_id, account_slug: chain.research_brief.account_slug, objective: "Compose and route a consent-safe recovery experience for human approval.", initiated_at: "2026-08-06T00:00:00.000Z" });
  const calls = { communicator: 0 };
  const store = createFileEventStore(runDir);
  const orchestrator = createOrchestrator({ store, executors: createLivePipelineExecutors({ runDir, producers: recoveringProducers(chain, calls), now: () => LIVE_NOW }), now: () => LIVE_NOW });
  return { runDir, chain, calls, store, orchestrator };
}

describe("failed-stage recovery — live composition & transcript visibility", () => {
  it("reruns the failed stage as the next artefact version and completes through the Manager", async () => {
    const { runDir, chain, calls, orchestrator } = await setupRecoveringRun();
    const account = chain.research_brief.account_slug;

    const failed = await orchestrator.start({ run_id: chain.run_id, account_slug: account, requires_human_approval: true });
    expect(failed.status).toBe("failed");
    expect(calls.communicator).toBe(1);

    const recovered = await orchestrator.retryFailed(chain.run_id, REASON);
    expect(recovered.status).toBe("awaiting_human_approval");
    // The Communicator reran once more (v2); existing exclusive artefact adoption/lineage is unchanged.
    expect(calls.communicator).toBe(2);
    expect(recovered.state.stages.communicator.current?.version).toBe(2);
    expect(recovered.state.stages.manager.current?.version).toBe(1);

    // The retried stage wrote a NEW versioned artefact; the failed attempt left no accepted v1 file.
    const v2 = await readFile(join(runDir, "communicator.communication-plan.v2.json"), "utf8");
    expect(v2.length).toBeGreaterThan(0);
    await rm(runDir, { recursive: true, force: true });
  });

  it("records the failure and its operator reason in the transcript and Markdown; determinism holds", async () => {
    const { runDir, chain, store, orchestrator } = await setupRecoveringRun();
    const account = chain.research_brief.account_slug;
    await orchestrator.start({ run_id: chain.run_id, account_slug: account, requires_human_approval: true });
    await orchestrator.retryFailed(chain.run_id, REASON);

    const source = await loadTranscriptSource(runDir, store, chain.run_id);
    const transcript = buildPipelineTranscript(source);

    // The original failure is visible and marked recovered.
    expect(transcript.stage_failures).toHaveLength(1);
    expect(transcript.stage_failures[0]).toMatchObject({ stage: "communicator", version: 1, recovered: true });
    expect(transcript.stage_failures[0]?.error).toContain("deterministic validation");

    // The operator retry and its bounded reason are recorded alongside the failure it recovers.
    expect(transcript.failed_stage_retries).toHaveLength(1);
    expect(transcript.failed_stage_retries[0]).toMatchObject({ stage: "communicator", failed_version: 1, rerun_version: 2, operator_reason: REASON });
    expect(transcript.failed_stage_retries[0]?.failure_error).toContain("deterministic validation");

    // Markdown shows both the failure and the reason — the failure is never hidden.
    const markdown = renderTranscriptMarkdown(transcript);
    expect(markdown).toContain("## Failed-stage recovery");
    expect(markdown).toContain(REASON);
    expect(markdown).toContain("communicator v1 failed");

    // Deterministic: two builds over identical sources are byte-for-byte equal.
    expect(serializePipelineTranscript(buildPipelineTranscript(source))).toBe(serializePipelineTranscript(transcript));
    expect(renderTranscriptMarkdown(buildPipelineTranscript(source))).toBe(markdown);
    await rm(runDir, { recursive: true, force: true });
  });
});
