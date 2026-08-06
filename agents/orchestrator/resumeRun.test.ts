import { describe, expect, it } from "vitest";

import { isOrchestratorError } from "./errors.js";
import { createMemoryEventStore } from "./eventStore.js";
import { createOrchestrator } from "./orchestrator.js";
import { resumeExplicitRun } from "./resumeRun.js";
import type { RunInputRecord } from "./runInput.js";
import { buildExecutors, FIXED_PRODUCED_AT, TEST_ACCOUNT, TEST_RUN_ID } from "./testFixture.js";

const fixedClock = () => new Date(FIXED_PRODUCED_AT);

function runInput(overrides: Partial<RunInputRecord> = {}): RunInputRecord {
  return {
    run_id: TEST_RUN_ID,
    account_slug: TEST_ACCOUNT,
    objective: "Compose a consent-safe recovery experience and route it for human approval.",
    initiated_at: "2026-08-06T00:00:00.000Z",
    ...overrides,
  };
}

describe("resumeExplicitRun — pre-genesis bootstrap", () => {
  it("bootstraps a full strict pipeline when run input exists but the event log was never created", async () => {
    const store = createMemoryEventStore();
    const build = buildExecutors();
    const orchestrator = createOrchestrator({ store, executors: build.executors, now: fixedClock });

    // The exact pre-genesis prefix: durable run input, no event history yet.
    expect(await store.exists(TEST_RUN_ID)).toBe(false);

    const result = await resumeExplicitRun({ store, orchestrator, runId: TEST_RUN_ID, runInput: runInput() });

    // Bootstrapped into a normal strict pipeline that runs all five stages to the human boundary.
    expect(result.status).toBe("awaiting_human_approval");
    expect(build.calls.map((call) => call.stage)).toEqual([
      "researcher",
      "designer",
      "maker",
      "communicator",
      "manager",
    ]);
    // The genesis event was created and carries the immutable run input's account + mandated approval.
    const envelopes = await store.readEnvelopes(TEST_RUN_ID);
    const [genesis] = envelopes;
    expect(genesis?.event.type).toBe("run_started");
    if (genesis?.event.type === "run_started") {
      expect(genesis.event.account_slug).toBe(TEST_ACCOUNT);
      expect(genesis.event.requires_human_approval).toBe(true);
    }
  });

  it("resumes normally (does not re-start) when an event log already exists", async () => {
    const store = createMemoryEventStore();
    const first = buildExecutors();
    await createOrchestrator({ store, executors: first.executors, now: fixedClock }).start({
      run_id: TEST_RUN_ID,
      account_slug: TEST_ACCOUNT,
    });

    // A fresh orchestrator resumes the already-sealed run; the bootstrap path must not fire and no
    // stage is re-produced.
    const second = buildExecutors();
    const orchestrator = createOrchestrator({ store, executors: second.executors, now: fixedClock });
    const result = await resumeExplicitRun({ store, orchestrator, runId: TEST_RUN_ID, runInput: runInput() });

    expect(result.status).toBe("awaiting_human_approval");
    expect(second.calls).toHaveLength(0);
  });

  it("fails closed when the durable run input is for a different run id", async () => {
    const store = createMemoryEventStore();
    const build = buildExecutors();
    const orchestrator = createOrchestrator({ store, executors: build.executors, now: fixedClock });

    await expect(
      resumeExplicitRun({
        store,
        orchestrator,
        runId: TEST_RUN_ID,
        runInput: runInput({ run_id: "00000000-0000-4000-8000-000000000000" }),
      }),
    ).rejects.toSatisfy((error: unknown) => isOrchestratorError(error) && error.code === "RUN_INPUT_MISMATCH");

    // Nothing was started or produced on the mismatch.
    expect(build.calls).toHaveLength(0);
    expect(await store.exists(TEST_RUN_ID)).toBe(false);
  });
});
