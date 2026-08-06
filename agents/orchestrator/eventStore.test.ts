import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { type OrchestratorEvent } from "./contracts.js";
import { OrchestratorError } from "./errors.js";
import {
  buildEnvelope,
  createFileEventStore,
  createMemoryEventStore,
  parseAndVerifyChain,
} from "./eventStore.js";
import { approveOutcome, fakeSha, FIXED_PRODUCED_AT, TEST_ACCOUNT, TEST_RUN_ID } from "./testFixture.js";

const AT = FIXED_PRODUCED_AT;
const runStarted: OrchestratorEvent = {
  type: "run_started",
  run_id: TEST_RUN_ID,
  account_slug: TEST_ACCOUNT,
  requires_human_approval: true,
  created_at: AT,
};
const researcherStarted: OrchestratorEvent = {
  type: "stage_started",
  stage: "researcher",
  version: 1,
  reason: "sequential_start",
  created_at: AT,
};

function expectCode(promise: Promise<unknown>, code: OrchestratorError["code"]): Promise<void> {
  return promise.then(
    () => { throw new Error("expected an OrchestratorError"); },
    (error) => {
      expect(error).toBeInstanceOf(OrchestratorError);
      expect((error as OrchestratorError).code).toBe(code);
    },
  );
}

describe("Gate 9 event store — append-only semantics", () => {
  it("exclusive-creates a run and refuses to overwrite it", async () => {
    const store = createMemoryEventStore();
    await store.createRun(TEST_RUN_ID, runStarted);
    await expectCode(store.createRun(TEST_RUN_ID, runStarted), "RUN_EXISTS");
  });

  it("appends and rehydrates state by replaying the verified chain", async () => {
    const store = createMemoryEventStore();
    await store.createRun(TEST_RUN_ID, runStarted);
    await store.append(TEST_RUN_ID, researcherStarted);
    const state = await store.loadState(TEST_RUN_ID);
    expect(state.started).toBe(true);
    expect(state.stages.researcher.status).toBe("active");
  });

  it("reports a missing run", async () => {
    const store = createMemoryEventStore();
    await expectCode(store.loadState(TEST_RUN_ID), "RUN_NOT_FOUND");
  });
});

describe("Gate 9 event store — integrity detection", () => {
  async function seeded() {
    const store = createMemoryEventStore();
    await store.createRun(TEST_RUN_ID, runStarted);
    await store.append(TEST_RUN_ID, researcherStarted);
    return store;
  }

  it("detects corrupted (non-JSON) history", async () => {
    const store = await seeded();
    const lines = store.rawLines(TEST_RUN_ID);
    store.overwriteLines(TEST_RUN_ID, [lines[0]!, "{not json"]);
    await expectCode(store.readEnvelopes(TEST_RUN_ID), "CORRUPTED_HISTORY");
  });

  it("detects a tampered event body (recomputed hash mismatch)", async () => {
    const store = await seeded();
    const lines = store.rawLines(TEST_RUN_ID);
    const parsed = JSON.parse(lines[1]!) as { event: { version: number } };
    parsed.event.version = 99; // mutate the payload but keep the stored hash
    store.overwriteLines(TEST_RUN_ID, [lines[0]!, JSON.stringify(parsed)]);
    await expectCode(store.readEnvelopes(TEST_RUN_ID), "TAMPERED_HISTORY");
  });

  it("detects a broken hash chain (reordered/spliced line)", async () => {
    const store = await seeded();
    const lines = store.rawLines(TEST_RUN_ID);
    // Re-hash line 1 as if standalone but keep the genuine prev_hash mismatch by swapping in a foreign
    // envelope whose prev_hash does not chain.
    const foreign = buildEnvelope(1, "a".repeat(64), researcherStarted);
    store.overwriteLines(TEST_RUN_ID, [lines[0]!, JSON.stringify(foreign)]);
    await expectCode(store.readEnvelopes(TEST_RUN_ID), "TAMPERED_HISTORY");
  });

  it("detects a duplicated / mis-sequenced line", async () => {
    const store = await seeded();
    const lines = store.rawLines(TEST_RUN_ID);
    store.overwriteLines(TEST_RUN_ID, [lines[0]!, lines[1]!, lines[1]!]);
    await expectCode(store.readEnvelopes(TEST_RUN_ID), "DUPLICATE_SEQUENCE");
  });

  it("parseAndVerifyChain accepts a genuine chain", async () => {
    const store = await seeded();
    const envelopes = parseAndVerifyChain(store.rawLines(TEST_RUN_ID));
    expect(envelopes.map((envelope) => envelope.seq)).toEqual([0, 1]);
  });
});

describe("Gate 9 event store — atomic Manager seal integrity", () => {
  // A full approving chain, ending in the atomic manager_decided seal.
  async function sealedRun() {
    const store = createMemoryEventStore();
    await store.createRun(TEST_RUN_ID, runStarted);
    const stages = ["researcher", "designer", "maker", "communicator"] as const;
    for (const stage of stages) {
      await store.append(TEST_RUN_ID, { type: "stage_started", stage, version: 1, reason: "sequential_start", created_at: AT });
      await store.append(TEST_RUN_ID, { type: "stage_completed", stage, version: 1, artifact: { stage, version: 1, sha256: fakeSha(`${stage}:1`), status_label: "ok", produced_at: AT }, created_at: AT });
    }
    await store.append(TEST_RUN_ID, { type: "stage_started", stage: "manager", version: 1, reason: "sequential_start", created_at: AT });
    await store.append(TEST_RUN_ID, {
      type: "manager_decided",
      version: 1,
      artifact: { stage: "manager", version: 1, sha256: fakeSha("manager:1"), status_label: "decided", produced_at: AT },
      outcome: approveOutcome(),
      created_at: AT,
    });
    return store;
  }

  it("validates a manager_decided event normally through the hash chain and replays to terminal", async () => {
    const store = await sealedRun();
    const envelopes = parseAndVerifyChain(store.rawLines(TEST_RUN_ID));
    expect(envelopes.at(-1)?.event.type).toBe("manager_decided");
    const state = await store.loadState(TEST_RUN_ID);
    expect(state.status).toBe("awaiting_human_approval");
    expect(state.stages.manager.status).toBe("completed");
  });

  it("detects tampering with a sealed Manager outcome (hash mismatch)", async () => {
    const store = await sealedRun();
    const lines = store.rawLines(TEST_RUN_ID);
    const last = lines.length - 1;
    const parsed = JSON.parse(lines[last]!) as { event: { outcome: { governance: { permitted_next_action: string } } } };
    // Flip the sealed governance to permit an external action, keeping the stored hash.
    parsed.event.outcome.governance.permitted_next_action = "auto_send";
    store.overwriteLines(TEST_RUN_ID, [...lines.slice(0, last), JSON.stringify(parsed)]);
    await expectCode(store.readEnvelopes(TEST_RUN_ID), "TAMPERED_HISTORY");
  });

  it("a cleanly tail-truncated chain remains a VALID prefix (documented non-claim), not tampering", async () => {
    // Honesty check: dropping the trailing sealed line yields a valid earlier prefix — the chain does
    // NOT flag it, because there is no separate durable head/length marker. It resumes safely (the
    // Manager is left active) rather than requiring manual repair.
    const store = await sealedRun();
    const lines = store.rawLines(TEST_RUN_ID);
    const truncated = lines.slice(0, lines.length - 1);
    const envelopes = parseAndVerifyChain(truncated); // does not throw
    expect(envelopes.at(-1)?.event.type).toBe("stage_started");
    store.overwriteLines(TEST_RUN_ID, truncated);
    const state = await store.loadState(TEST_RUN_ID);
    expect(state.status).toBe("in_progress");
    expect(state.stages.manager.status).toBe("active");
  });
});

describe("Gate 9 event store — file backend", () => {
  it("persists to JSONL, refuses overwrite, and rehydrates from disk", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gate9-store-"));
    const store = createFileEventStore(dir);
    await store.createRun(TEST_RUN_ID, runStarted);
    await store.append(TEST_RUN_ID, researcherStarted);

    const onDisk = await readFile(join(dir, `${TEST_RUN_ID}.jsonl`), { encoding: "utf8" });
    expect(onDisk.trim().split("\n")).toHaveLength(2);

    await expectCode(store.createRun(TEST_RUN_ID, runStarted), "RUN_EXISTS");

    const state = await store.loadState(TEST_RUN_ID);
    expect(state.stages.researcher.status).toBe("active");
  });

  it("detects on-disk tampering on the next read", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gate9-store-"));
    const store = createFileEventStore(dir);
    await store.createRun(TEST_RUN_ID, runStarted);
    const path = join(dir, `${TEST_RUN_ID}.jsonl`);
    const original = await readFile(path, { encoding: "utf8" });
    const parsed = JSON.parse(original.trim()) as { event: { account_slug: string } };
    parsed.event.account_slug = "tampered-account";
    await writeFile(path, `${JSON.stringify(parsed)}\n`, { encoding: "utf8" });
    await expectCode(store.readEnvelopes(TEST_RUN_ID), "TAMPERED_HISTORY");
  });
});
