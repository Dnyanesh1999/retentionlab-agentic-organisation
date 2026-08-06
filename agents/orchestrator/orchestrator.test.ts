import { describe, expect, it } from "vitest";

import { type ManagerOutcome, type OrchestratorEvent } from "./contracts.js";
import { OrchestratorError } from "./errors.js";
import { createMemoryEventStore, type EventStore } from "./eventStore.js";
import { createOrchestrator } from "./orchestrator.js";
import {
  approveOutcome,
  buildExecutors,
  fakeSha,
  FIXED_PRODUCED_AT,
  rejectOutcome,
  reviseOutcome,
  TEST_ACCOUNT,
  TEST_RUN_ID,
} from "./testFixture.js";

const AT = FIXED_PRODUCED_AT;
const fixedClock = () => new Date(AT);

function makeOrchestrator(store: EventStore, overrides: Parameters<typeof buildExecutors>[0] = {}) {
  const build = buildExecutors(overrides);
  const orchestrator = createOrchestrator({ store, executors: build.executors, now: fixedClock });
  return { orchestrator, calls: build.calls };
}

async function eventTypes(store: EventStore): Promise<OrchestratorEvent["type"][]> {
  const envelopes = await store.readEnvelopes(TEST_RUN_ID);
  return envelopes.map((envelope) => envelope.event.type);
}

// Appends a raw event to a memory store to model a process crash between two committed events.
async function seed(store: EventStore, events: OrchestratorEvent[]): Promise<void> {
  const [head, ...rest] = events;
  if (!head || head.type !== "run_started") throw new Error("seed must start with run_started");
  await store.createRun(TEST_RUN_ID, head);
  for (const event of rest) await store.append(TEST_RUN_ID, event);
}

const startInput = { run_id: TEST_RUN_ID, account_slug: TEST_ACCOUNT };

describe("Orchestrator — happy path", () => {
  it("drives the five stages in strict order to awaiting_human_approval", async () => {
    const store = createMemoryEventStore();
    const { orchestrator, calls } = makeOrchestrator(store);
    const result = await orchestrator.start(startInput);

    expect(result.status).toBe("awaiting_human_approval");
    expect(calls.map((call) => call.stage)).toEqual([
      "researcher",
      "designer",
      "maker",
      "communicator",
      "manager",
    ]);
    expect(await eventTypes(store)).toEqual([
      "run_started",
      "stage_started",
      "stage_completed",
      "stage_started",
      "stage_completed",
      "stage_started",
      "stage_completed",
      "stage_started",
      "stage_completed",
      "stage_started",
      // The Manager seals completion + decision in one atomic event (no separate stage_completed).
      "manager_decided",
    ]);
    // Each executor sees exactly its completed predecessors.
    expect(calls[0]?.predecessors).toEqual([]);
    expect(calls[4]?.predecessors).toEqual(["researcher", "designer", "maker", "communicator"]);
  });

  it("refuses to start the same run twice (no overwrite of an accepted history)", async () => {
    const store = createMemoryEventStore();
    const { orchestrator } = makeOrchestrator(store);
    await orchestrator.start(startInput);
    await expect(orchestrator.start(startInput)).rejects.toMatchObject({ code: "RUN_EXISTS" });
  });
});

describe("Orchestrator — approval boundary", () => {
  it("resuming a completed approval executes no external action", async () => {
    const store = createMemoryEventStore();
    const first = makeOrchestrator(store);
    await first.orchestrator.start(startInput);

    // A fresh orchestrator resumes the same durable run: it must not execute anything.
    const second = makeOrchestrator(store);
    const inspected = await second.orchestrator.inspect(TEST_RUN_ID);
    expect(inspected.plan).toEqual({ kind: "terminal", status: "awaiting_human_approval" });

    const resumed = await second.orchestrator.resume(TEST_RUN_ID);
    expect(resumed.status).toBe("awaiting_human_approval");
    expect(second.calls).toHaveLength(0);
  });

  it("rejects an approval whose governance permits an external action", async () => {
    const store = createMemoryEventStore();
    const badApproval: ManagerOutcome = {
      decision: "approve",
      governance: { human_approval_required: true, permitted_next_action: "auto_send" },
    };
    const { orchestrator } = makeOrchestrator(store, { managerOutcomes: [badApproval] });
    await expect(orchestrator.start(startInput)).rejects.toMatchObject({ code: "GOVERNANCE_VIOLATION" });
  });
});

describe("Orchestrator — crash-safe resume", () => {
  it("resumes a crash mid-researcher without a duplicate start", async () => {
    const store = createMemoryEventStore();
    await seed(store, [
      { type: "run_started", run_id: TEST_RUN_ID, account_slug: TEST_ACCOUNT, requires_human_approval: true, created_at: AT },
      { type: "stage_started", stage: "researcher", version: 1, reason: "sequential_start", created_at: AT },
    ]);

    const { orchestrator, calls } = makeOrchestrator(store);
    const inspected = await orchestrator.inspect(TEST_RUN_ID);
    expect(inspected.plan).toEqual({ kind: "resume_active", stage: "researcher", version: 1 });

    const result = await orchestrator.resume(TEST_RUN_ID);
    expect(result.status).toBe("awaiting_human_approval");
    // researcher re-ran at v1; there is still exactly one researcher stage_started in the log.
    const startedResearcher = (await store.readEnvelopes(TEST_RUN_ID)).filter(
      (envelope) => envelope.event.type === "stage_started" && envelope.event.stage === "researcher",
    );
    expect(startedResearcher).toHaveLength(1);
    expect(calls[0]).toMatchObject({ stage: "researcher", version: 1 });
  });

  it("resumes between stages and does not re-run completed stages", async () => {
    const store = createMemoryEventStore();
    await seed(store, [
      { type: "run_started", run_id: TEST_RUN_ID, account_slug: TEST_ACCOUNT, requires_human_approval: true, created_at: AT },
      { type: "stage_started", stage: "researcher", version: 1, reason: "sequential_start", created_at: AT },
      { type: "stage_completed", stage: "researcher", version: 1, artifact: { stage: "researcher", version: 1, sha256: fakeSha("researcher:1"), status_label: "completed", produced_at: AT }, created_at: AT },
    ]);

    const { orchestrator, calls } = makeOrchestrator(store);
    const inspected = await orchestrator.inspect(TEST_RUN_ID);
    expect(inspected.plan).toEqual({ kind: "start_stage", stage: "designer", version: 1 });

    const result = await orchestrator.resume(TEST_RUN_ID);
    expect(result.status).toBe("awaiting_human_approval");
    expect(calls.map((call) => call.stage)).toEqual(["designer", "maker", "communicator", "manager"]);
  });
});

describe("Orchestrator — atomic Manager seal is crash-safe on resume", () => {
  // Drive the four pre-Manager stages plus the Manager start, then leave the run interrupted at the
  // exact moment BEFORE the atomic manager_decided append. This is the boundary Codex flagged.
  async function seedThroughManagerStarted(store: EventStore): Promise<void> {
    await seed(store, [
      { type: "run_started", run_id: TEST_RUN_ID, account_slug: TEST_ACCOUNT, requires_human_approval: true, created_at: AT },
      { type: "stage_started", stage: "researcher", version: 1, reason: "sequential_start", created_at: AT },
      { type: "stage_completed", stage: "researcher", version: 1, artifact: { stage: "researcher", version: 1, sha256: fakeSha("researcher:1"), status_label: "completed", produced_at: AT }, created_at: AT },
      { type: "stage_started", stage: "designer", version: 1, reason: "sequential_start", created_at: AT },
      { type: "stage_completed", stage: "designer", version: 1, artifact: { stage: "designer", version: 1, sha256: fakeSha("designer:1"), status_label: "ready_for_maker", produced_at: AT }, created_at: AT },
      { type: "stage_started", stage: "maker", version: 1, reason: "sequential_start", created_at: AT },
      { type: "stage_completed", stage: "maker", version: 1, artifact: { stage: "maker", version: 1, sha256: fakeSha("maker:1"), status_label: "ready_for_communication", produced_at: AT }, created_at: AT },
      { type: "stage_started", stage: "communicator", version: 1, reason: "sequential_start", created_at: AT },
      { type: "stage_completed", stage: "communicator", version: 1, artifact: { stage: "communicator", version: 1, sha256: fakeSha("communicator:1"), status_label: "ready_for_manager", produced_at: AT }, created_at: AT },
      { type: "stage_started", stage: "manager", version: 1, reason: "sequential_start", created_at: AT },
    ]);
  }

  it("resumes a crash immediately BEFORE the atomic Manager append — no manual repair, no lost outcome", async () => {
    const store = createMemoryEventStore();
    await seedThroughManagerStarted(store);

    // The Manager was left active; the decision was never persisted, so re-running it loses nothing.
    const { orchestrator, calls } = makeOrchestrator(store);
    const inspected = await orchestrator.inspect(TEST_RUN_ID);
    expect(inspected.plan).toEqual({ kind: "resume_active", stage: "manager", version: 1 });

    const resumed = await orchestrator.resume(TEST_RUN_ID);
    expect(resumed.status).toBe("awaiting_human_approval");
    // Only the Manager was re-run; the four completed predecessors were not.
    expect(calls.map((call) => call.stage)).toEqual(["manager"]);

    // The durable log now seals atomically: exactly one manager_decided, and never a bare Manager
    // stage_completed or a split decision event.
    const types = await eventTypes(store);
    expect(types.filter((t) => t === "manager_decided")).toHaveLength(1);
    expect(types.at(-1)).toBe("manager_decided");
    expect(types.filter((t) => t === "stage_completed")).toHaveLength(4); // only the non-Manager stages
  });

  it("proves no valid persisted prefix strands a completed-but-undecided Manager (manual repair unreachable)", async () => {
    // Run to completion, then replay every prefix of the durable log: none may throw a manual-repair.
    const store = createMemoryEventStore();
    await makeOrchestrator(store).orchestrator.start(startInput);
    const envelopes = await store.readEnvelopes(TEST_RUN_ID);

    for (let cut = 1; cut <= envelopes.length; cut += 1) {
      const prefixStore = createMemoryEventStore();
      const [head, ...rest] = envelopes.slice(0, cut).map((e) => e.event);
      if (!head || head.type !== "run_started") throw new Error("prefix must start with run_started");
      await prefixStore.createRun(TEST_RUN_ID, head);
      for (const event of rest) await prefixStore.append(TEST_RUN_ID, event);

      // Inspect must never throw a manual-repair invariant for any real crash point.
      const { orchestrator } = makeOrchestrator(prefixStore);
      await expect(orchestrator.inspect(TEST_RUN_ID)).resolves.toBeDefined();
    }
  });

  it("resuming a crash AT the atomic seal (approve) executes no external action", async () => {
    const store = createMemoryEventStore();
    // A full, already-sealed approving run — as if the process died right after manager_decided landed.
    await makeOrchestrator(store).orchestrator.start(startInput);

    const second = makeOrchestrator(store);
    const resumed = await second.orchestrator.resume(TEST_RUN_ID);
    expect(resumed.status).toBe("awaiting_human_approval");
    expect(second.calls).toHaveLength(0);
  });

  it("resuming a crash AT the atomic seal (revise) routes deterministically and never re-calls the sealed Manager", async () => {
    // Seed a durable log that ends exactly at manager_decided(revise): revision_required, unrouted.
    const store = createMemoryEventStore();
    await seedThroughManagerStarted(store);
    await store.append(TEST_RUN_ID, {
      type: "manager_decided",
      version: 1,
      artifact: { stage: "manager", version: 1, sha256: fakeSha("manager:1"), status_label: "decided", produced_at: AT },
      outcome: reviseOutcome("designer"),
      created_at: AT,
    });

    const state = await store.loadState(TEST_RUN_ID);
    expect(state.status).toBe("revision_required");

    // Resume routes the revision from the durable outcome (no Manager re-call to recover the decision),
    // reruns designer/maker/communicator and the fresh Manager pass, then approves.
    const { orchestrator, calls } = makeOrchestrator(store, { managerOutcomes: [approveOutcome()] });
    const resumed = await orchestrator.resume(TEST_RUN_ID);
    expect(resumed.status).toBe("awaiting_human_approval");
    // researcher untouched; the target + downstream + a new Manager pass rerun.
    expect(calls.map((call) => call.stage)).toEqual(["designer", "maker", "communicator", "manager"]);
    expect(resumed.state.stages.researcher.current?.version).toBe(1);
    expect(resumed.state.stages.designer.current?.version).toBe(2);
    expect(resumed.state.stages.manager.current?.version).toBe(2);
  });

  it("resuming a crash AT the atomic seal (reject) stays terminal and executes nothing", async () => {
    const store = createMemoryEventStore();
    await seedThroughManagerStarted(store);
    await store.append(TEST_RUN_ID, {
      type: "manager_decided",
      version: 1,
      artifact: { stage: "manager", version: 1, sha256: fakeSha("manager:1"), status_label: "decided", produced_at: AT },
      outcome: rejectOutcome("maker"),
      created_at: AT,
    });

    const { orchestrator, calls } = makeOrchestrator(store);
    const resumed = await orchestrator.resume(TEST_RUN_ID);
    expect(resumed.status).toBe("rejected");
    expect(calls).toHaveLength(0);
  });
});

describe("Orchestrator — executor failure", () => {
  it("records a failed stage and stops (failure terminality)", async () => {
    const store = createMemoryEventStore();
    const { orchestrator, calls } = makeOrchestrator(store, { failOnAttempt: { maker: 1 } });
    const result = await orchestrator.start(startInput);
    expect(result.status).toBe("failed");
    expect(calls.map((call) => call.stage)).toEqual(["researcher", "designer", "maker"]);
    expect(await eventTypes(store)).toContain("stage_failed");
    // A failed run refuses further resume progress.
    const resumed = await orchestrator.resume(TEST_RUN_ID);
    expect(resumed.status).toBe("failed");
  });

  it("rejects an invalid (non-hex) artefact hash", async () => {
    const store = createMemoryEventStore();
    const { orchestrator } = makeOrchestrator(store, { shaOverride: { researcher: "z".repeat(64) } });
    await expect(orchestrator.start(startInput)).rejects.toThrow();
  });

  it("rejects a non-Manager stage that leaks a manager_outcome", async () => {
    const store = createMemoryEventStore();
    const { orchestrator } = makeOrchestrator(store, { leakManagerOutcome: "designer" });
    await expect(orchestrator.start(startInput)).rejects.toMatchObject({ code: "UNEXPECTED_MANAGER_OUTCOME" });
  });
});

describe("Orchestrator — revision propagation", () => {
  it("routes a Manager revision, reruns target+downstream+manager, increments versions, preserves history", async () => {
    const store = createMemoryEventStore();
    const { orchestrator, calls } = makeOrchestrator(store, {
      managerOutcomes: [reviseOutcome("designer"), approveOutcome()],
    });
    const result = await orchestrator.start(startInput);
    expect(result.status).toBe("awaiting_human_approval");

    // First pass all five, then designer/maker/communicator/manager re-run (researcher untouched).
    expect(calls.map((call) => call.stage)).toEqual([
      "researcher", "designer", "maker", "communicator", "manager",
      "designer", "maker", "communicator", "manager",
    ]);

    const designerCalls = calls.filter((call) => call.stage === "designer");
    expect(designerCalls.map((call) => call.version)).toEqual([1, 2]);
    // The target stage receives the bounded required changes on rerun; a downstream stage does not.
    expect(designerCalls[1]?.required_changes).toEqual(["Tighten the designer output before re-review."]);
    const makerRerun = calls.filter((call) => call.stage === "maker")[1];
    expect(makerRerun?.required_changes).toBeNull();

    // Superseded history preserved: designer has two artefacts, v2 current.
    const state = result.state;
    expect(state.stages.designer.history.map((ref) => ref.version)).toEqual([1, 2]);
    expect(state.stages.designer.current?.version).toBe(2);
    // Researcher stayed at v1 and was never re-run.
    expect(state.stages.researcher.current?.version).toBe(1);
    expect(calls.filter((call) => call.stage === "researcher")).toHaveLength(1);

    // The durable log carries the routing events. Both Manager passes seal atomically via
    // manager_decided (the first a revise, the second an approve); routing sits between them.
    const types = await eventTypes(store);
    expect(types.filter((t) => t === "manager_decided")).toHaveLength(2);
    expect(types).toContain("revision_routed");
    expect(types.at(-1)).toBe("manager_decided");
    // Neither the pre-split decision events nor a bare Manager stage_completed ever appear.
    expect(types).not.toContain("approval_awaited");
    expect(types).not.toContain("revision_required");
  });

  it("halts on a Manager reject (rejection terminality)", async () => {
    const store = createMemoryEventStore();
    const reject: ManagerOutcome = {
      decision: "reject",
      target_stage: "maker",
      downstream_stages_to_rerun: ["communicator"],
      required_changes: ["The maker output is unsafe."],
      governance: { human_approval_required: true, permitted_next_action: "halt_and_route_revision" },
    };
    const { orchestrator } = makeOrchestrator(store, { managerOutcomes: [reject] });
    const result = await orchestrator.start(startInput);
    expect(result.status).toBe("rejected");
    const rejectTypes = await eventTypes(store);
    expect(rejectTypes).toContain("manager_decided");
    expect(rejectTypes).not.toContain("run_rejected");
    // Terminal: resume executes nothing further.
    const resumed = await orchestrator.resume(TEST_RUN_ID);
    expect(resumed.status).toBe("rejected");
  });

  it("rejects a revision directive whose downstream disagrees with the runtime", async () => {
    const store = createMemoryEventStore();
    const badRevise: ManagerOutcome = {
      decision: "revise",
      target_stage: "designer",
      downstream_stages_to_rerun: ["communicator"], // wrong: runtime computes [maker, communicator]
      required_changes: ["x"],
      governance: { human_approval_required: true, permitted_next_action: "route_targeted_revision" },
    };
    const { orchestrator } = makeOrchestrator(store, { managerOutcomes: [badRevise] });
    await expect(orchestrator.start(startInput)).rejects.toMatchObject({ code: "DOWNSTREAM_MISMATCH" });
    // The Manager completion was refused before sealing; the run stays recoverable (manager active).
    const state = await store.loadState(TEST_RUN_ID);
    expect(state.stages.manager.status).toBe("active");
  });

  it("requires the Manager executor to return an outcome", async () => {
    const store = createMemoryEventStore();
    // Force the manager to return no outcome by supplying an empty queue is not possible; instead use a
    // custom executor set that omits the manager outcome.
    const build = buildExecutors();
    const executors = {
      ...build.executors,
      manager: async () => ({ sha256: fakeSha("manager:1"), status_label: "decided", produced_at: AT }),
    };
    const orchestrator = createOrchestrator({ store, executors, now: fixedClock });
    await expect(orchestrator.start(startInput)).rejects.toMatchObject({ code: "MISSING_MANAGER_OUTCOME" });
  });
});

describe("Orchestrator — error surface", () => {
  it("exposes OrchestratorError instances with codes", async () => {
    const store = createMemoryEventStore();
    const { orchestrator } = makeOrchestrator(store);
    await expect(orchestrator.resume(TEST_RUN_ID)).rejects.toBeInstanceOf(OrchestratorError);
  });
});
