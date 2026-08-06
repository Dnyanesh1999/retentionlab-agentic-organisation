// @vitest-environment node

import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { communicationPlanSchema, type CommunicationPlan } from "../communicator/contracts.js";
import { recoveryDesignSpecificationSchema, type RecoveryDesignSpecification } from "../designer/contracts.js";
import { recoveryRoomArtifactSchema, type RecoveryRoomArtifact } from "../maker/contracts.js";
import { type ManagerDecisionDraft } from "../manager/contracts.js";
import type { ManagerModelAdapter } from "../manager/model.js";
import { runManager } from "../manager/run.js";
import { makeManagerDecisionDraft, makeManagerInput } from "../manager/testFixture.js";
import { researchBriefSchema, type ResearchBrief } from "../researcher/contracts.js";

import { artifactPath, compactArtifactHash } from "./artifactStore.js";
import { STAGE_ORDER, type ArtifactReference, type OrchestratorStage } from "./contracts.js";
import { createFileEventStore, type EventStore } from "./eventStore.js";
import { createLivePipelineExecutors, isLivePipelineError, type PipelineProducers } from "./livePipeline.js";
import { createOrchestrator } from "./orchestrator.js";
import { writeRunInput } from "./runInput.js";

const FIXED_NOW = new Date("2026-08-06T04:00:00.000Z");
const OBJECTIVE = "Compose a consent-safe recovery experience for this account and route it for human approval.";

type Chain = ReturnType<typeof makeManagerInput>;
type CallCounter = Record<OrchestratorStage, number>;

function zeroCalls(): CallCounter {
  return { researcher: 0, designer: 0, maker: 0, communicator: 0, manager: 0 };
}

function stubManagerModel(draft: ManagerDecisionDraft): ManagerModelAdapter {
  return {
    requestedModel: "example/manager-free",
    generate: async () => ({ text: JSON.stringify(draft), resolvedModel: "example/manager-free" }),
  };
}

// Fake producers that build a genuinely SHA-256-linked chain: each downstream producer recomputes its
// predecessor digest from the artefact the adapter loaded off disk, so lineage stays consistent with
// the store's own compact hashing convention. The manager producer drives the REAL runManager +
// deriveManagerOutcome path with a stubbed model.
function testProducers(chain: Chain, managerModel: ManagerModelAdapter, calls: CallCounter): PipelineProducers {
  return {
    researcher: async () => {
      calls.researcher += 1;
      return chain.research_brief;
    },
    designer: async (ctx) => {
      calls.designer += 1;
      const brief: ResearchBrief = researchBriefSchema.parse(ctx.predecessors.get("researcher"));
      return {
        ...chain.design_specification,
        run_id: brief.run_id,
        account_slug: brief.account_slug,
        source: { ...chain.design_specification.source, research_artifact_sha256: compactArtifactHash(researchBriefSchema, brief) },
      };
    },
    maker: async (ctx) => {
      calls.maker += 1;
      const spec: RecoveryDesignSpecification = recoveryDesignSpecificationSchema.parse(ctx.predecessors.get("designer"));
      return {
        ...chain.recovery_room_artifact,
        run_id: spec.run_id,
        account_slug: spec.account_slug,
        source: { ...chain.recovery_room_artifact.source, design_artifact_sha256: compactArtifactHash(recoveryDesignSpecificationSchema, spec) },
      };
    },
    communicator: async (ctx) => {
      calls.communicator += 1;
      const maker: RecoveryRoomArtifact = recoveryRoomArtifactSchema.parse(ctx.predecessors.get("maker"));
      return {
        ...chain.communication_plan,
        run_id: maker.run_id,
        account_slug: maker.account_slug,
        source: {
          ...chain.communication_plan.source,
          maker_artifact_sha256: compactArtifactHash(recoveryRoomArtifactSchema, maker),
          implementation_commit_sha: maker.implementation_evidence.commit_sha,
        },
      };
    },
    manager: async (ctx) => {
      calls.manager += 1;
      return runManager({
        input: {
          run_id: ctx.runId,
          research_brief: researchBriefSchema.parse(ctx.predecessors.get("researcher")),
          design_specification: recoveryDesignSpecificationSchema.parse(ctx.predecessors.get("designer")),
          recovery_room_artifact: recoveryRoomArtifactSchema.parse(ctx.predecessors.get("maker")),
          communication_plan: communicationPlanSchema.parse(ctx.predecessors.get("communicator")),
        },
        model: managerModel,
        now: ctx.now,
      });
    },
  };
}

async function setup(options: { managerDraft?: ManagerDecisionDraft } = {}) {
  const runDir = await mkdtemp(join(tmpdir(), "retentionlab-pipeline-"));
  const chain = makeManagerInput();
  await writeRunInput(runDir, {
    run_id: chain.run_id,
    account_slug: chain.research_brief.account_slug,
    objective: OBJECTIVE,
    initiated_at: "2026-08-06T00:00:00.000Z",
  });
  const calls = zeroCalls();
  const store = createFileEventStore(runDir);
  const producers = testProducers(chain, stubManagerModel(options.managerDraft ?? makeManagerDecisionDraft()), calls);
  const orchestrator = createOrchestrator({
    store,
    executors: createLivePipelineExecutors({ runDir, producers, now: () => FIXED_NOW }),
    now: () => FIXED_NOW,
  });
  return { runDir, chain, calls, store, orchestrator, jsonlPath: join(runDir, `${chain.run_id}.jsonl`) };
}

// Fresh process restart: a NEW executor/orchestrator over the same run directory, with a NEW call
// counter, so an adopted or reloaded artefact is provably not re-produced.
function restart(runDir: string, chain: Chain, store: EventStore, options: { managerDraft?: ManagerDecisionDraft } = {}) {
  const calls = zeroCalls();
  const producers = testProducers(chain, stubManagerModel(options.managerDraft ?? makeManagerDecisionDraft()), calls);
  const orchestrator = createOrchestrator({
    store,
    executors: createLivePipelineExecutors({ runDir, producers, now: () => FIXED_NOW }),
    now: () => FIXED_NOW,
  });
  return { calls, orchestrator };
}

// Drop trailing event lines back to (and including) the last envelope whose event matches `predicate`,
// modelling a crash that lost later appends (a valid shorter prefix per the store's tail-truncation
// non-claim). Durable artefact files on disk are left in place.
async function truncateEventsAfter(jsonlPath: string, predicate: (type: string) => boolean): Promise<void> {
  const lines = (await readFile(jsonlPath, "utf8")).split("\n").filter((line) => line.length > 0);
  let keep = lines.length;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const parsed = JSON.parse(lines[i] ?? "{}") as { event?: { type?: string } };
    if (parsed.event?.type && predicate(parsed.event.type)) {
      keep = i + 1;
      break;
    }
  }
  await writeFile(jsonlPath, `${lines.slice(0, keep).join("\n")}\n`, "utf8");
}

function reviseDraft(): ManagerDecisionDraft {
  return {
    ...makeManagerDecisionDraft(),
    decision: "revise",
    revision_directive: {
      target_stage: "communicator",
      required_changes: ["Tighten the invitation copy so it never implies an individual-level cause."],
      reason: "The communicator copy needs a bounded, consent-safe clarification before a human can review it.",
    },
  };
}

async function readFailedError(store: EventStore, runId: string): Promise<string> {
  const envelopes = await store.readEnvelopes(runId);
  for (const { event } of envelopes) {
    if (event.type === "stage_failed") return event.error;
  }
  throw new Error("expected a stage_failed event");
}

describe("live five-agent composition", () => {
  it("drives all five real stages in strict order and halts at human approval", async () => {
    const { orchestrator, calls, runDir, chain } = await setup();
    const result = await orchestrator.start({ run_id: chain.run_id, account_slug: chain.research_brief.account_slug, requires_human_approval: true });

    expect(result.status).toBe("awaiting_human_approval");
    expect(calls).toEqual({ researcher: 1, designer: 1, maker: 1, communicator: 1, manager: 1 });
    for (const stage of STAGE_ORDER) {
      expect(existsSync(artifactPath(runDir, stage, 1))).toBe(true);
    }
  });

  it("reloads durable predecessors after a process restart and never re-runs a completed stage", async () => {
    const first = await setup();
    await first.orchestrator.start({ run_id: first.chain.run_id, account_slug: first.chain.research_brief.account_slug, requires_human_approval: true });

    // Model a crash that lost every append after the manager started AND lost the manager's own output
    // before it was durably written: the manager is active with no artefact on disk.
    await truncateEventsAfter(first.jsonlPath, (type) => type === "stage_started");
    await rm(artifactPath(first.runDir, "manager", 1));

    const second = restart(first.runDir, first.chain, createFileEventStore(first.runDir));
    const result = await second.orchestrator.resume(first.chain.run_id);

    expect(result.status).toBe("awaiting_human_approval");
    // Researcher/Designer/Maker/Communicator were reloaded from disk, not re-produced; only the manager,
    // whose durable output was lost, is re-produced from the reloaded predecessors.
    expect(second.calls.researcher).toBe(0);
    expect(second.calls.designer).toBe(0);
    expect(second.calls.maker).toBe(0);
    expect(second.calls.communicator).toBe(0);
    expect(second.calls.manager).toBe(1);
  });

  it("adopts a valid unsealed artefact on resume without spending a model call", async () => {
    const first = await setup();
    await first.orchestrator.start({ run_id: first.chain.run_id, account_slug: first.chain.research_brief.account_slug, requires_human_approval: true });

    const communicatorFile = artifactPath(first.runDir, "communicator", 1);
    const before = await readFile(communicatorFile, "utf8");

    // Crash boundary: the Communicator wrote a valid v1 artefact, but the completion event was lost —
    // a torn tail where the Communicator is active with its durable artefact still present.
    await truncateCommunicatorActive(first.jsonlPath);

    const second = restart(first.runDir, first.chain, createFileEventStore(first.runDir));
    const result = await second.orchestrator.resume(first.chain.run_id);

    expect(result.status).toBe("awaiting_human_approval");
    expect(second.calls.communicator).toBe(0); // adopted, not re-produced
    expect(await readFile(communicatorFile, "utf8")).toBe(before); // never overwritten
  });

  it("fails closed when an unsealed artefact belongs to the wrong run", async () => {
    const { runDir, chain, store, orchestrator, jsonlPath } = await setup();
    await orchestrator.start({ run_id: chain.run_id, account_slug: chain.research_brief.account_slug, requires_human_approval: true });
    await truncateCommunicatorActive(jsonlPath);

    const communicatorFile = artifactPath(runDir, "communicator", 1);
    const plan = JSON.parse(await readFile(communicatorFile, "utf8")) as CommunicationPlan;
    await writeFile(communicatorFile, JSON.stringify({ ...plan, run_id: "00000000-0000-4000-8000-000000000000" }, null, 2), "utf8");

    const restarted = restart(runDir, chain, createFileEventStore(runDir));
    const result = await restarted.orchestrator.resume(chain.run_id);
    expect(result.status).toBe("failed");
    expect(await readFailedError(store, chain.run_id)).toContain("belongs to run");
    expect(restarted.calls.communicator).toBe(0);
  });

  it("fails closed when an unsealed artefact breaks predecessor lineage", async () => {
    const { runDir, chain, store, orchestrator, jsonlPath } = await setup();
    await orchestrator.start({ run_id: chain.run_id, account_slug: chain.research_brief.account_slug, requires_human_approval: true });
    await truncateCommunicatorActive(jsonlPath);

    const communicatorFile = artifactPath(runDir, "communicator", 1);
    const plan = JSON.parse(await readFile(communicatorFile, "utf8")) as CommunicationPlan;
    const tampered = { ...plan, source: { ...plan.source, maker_artifact_sha256: "f".repeat(64) } };
    await writeFile(communicatorFile, JSON.stringify(tampered, null, 2), "utf8");

    const restarted = restart(runDir, chain, createFileEventStore(runDir));
    const result = await restarted.orchestrator.resume(chain.run_id);
    expect(result.status).toBe("failed");
    expect(await readFailedError(store, chain.run_id)).toContain("lineage");
  });

  it("fails closed when a durable predecessor disagrees with orchestration state", async () => {
    const { runDir, chain, store, orchestrator, jsonlPath } = await setup();
    await orchestrator.start({ run_id: chain.run_id, account_slug: chain.research_brief.account_slug, requires_human_approval: true });
    await truncateCommunicatorActive(jsonlPath);

    // Corrupt the Maker predecessor so its on-disk digest no longer matches the committed reference.
    const makerFile = artifactPath(runDir, "maker", 1);
    const artifact = JSON.parse(await readFile(makerFile, "utf8")) as RecoveryRoomArtifact;
    await writeFile(makerFile, JSON.stringify({ ...artifact, status: "needs_design_revision" }, null, 2), "utf8");

    const restarted = restart(runDir, chain, createFileEventStore(runDir));
    const result = await restarted.orchestrator.resume(chain.run_id);
    expect(result.status).toBe("failed");
    expect(await readFailedError(store, chain.run_id)).toMatch(/hashes to|orchestration state/);
  });

  it("preserves the Manager approval boundary and takes no external action", async () => {
    const { orchestrator, chain, store } = await setup();
    const result = await orchestrator.start({ run_id: chain.run_id, account_slug: chain.research_brief.account_slug, requires_human_approval: true });
    expect(result.status).toBe("awaiting_human_approval");

    const envelopes = await store.readEnvelopes(chain.run_id);
    const decided = envelopes.map((envelope) => envelope.event).find((event) => event.type === "manager_decided");
    expect(decided?.type).toBe("manager_decided");
    if (decided?.type === "manager_decided" && decided.outcome.decision === "approve") {
      expect(decided.outcome.governance.human_approval_required).toBe(true);
      expect(decided.outcome.governance.permitted_next_action).toBe("await_human_approval");
    } else {
      throw new Error("expected an approve outcome");
    }
  });

  it("fails closed on a revision rerun instead of pretending required_changes were applied", async () => {
    const { orchestrator, chain, store, calls } = await setup({ managerDraft: reviseDraft() });
    const result = await orchestrator.start({ run_id: chain.run_id, account_slug: chain.research_brief.account_slug, requires_human_approval: true });

    expect(result.status).toBe("failed");
    expect(await readFailedError(store, chain.run_id)).toContain("required_changes");
    // The Communicator produced its v1 once; the v2 rerun failed BEFORE any producer call.
    expect(calls.communicator).toBe(1);
    const envelopes = await store.readEnvelopes(chain.run_id);
    expect(envelopes.some((envelope) => envelope.event.type === "revision_routed")).toBe(true);
  });

  it("never adopts a schema-valid, correct-lineage artefact already present at the revision target version", async () => {
    // Drive a clean run so every predecessor artefact (incl. the Maker v1 the Communicator lineage
    // links to) is durable on disk.
    const { runDir, chain, store, orchestrator } = await setup();
    await orchestrator.start({ run_id: chain.run_id, account_slug: chain.research_brief.account_slug, requires_human_approval: true });

    // Plant a leftover/copied Communicator artefact at the REVISION TARGET version (v2). It is
    // byte-for-byte the accepted v1: schema-valid, correct run/account, and its embedded Maker lineage
    // digest matches the still-current Maker v1. The ONLY thing wrong with adopting it is that no
    // required_changes were actually applied — exactly the silent-adoption trap.
    const v1Bytes = await readFile(artifactPath(runDir, "communicator", 1), "utf8");
    await writeFile(artifactPath(runDir, "communicator", 2), v1Bytes, "utf8");

    const state = await store.loadState(chain.run_id);
    const makerRef = state.stages.maker.current;
    if (!makerRef) throw new Error("expected a completed Maker artefact");

    const calls = zeroCalls();
    const executors = createLivePipelineExecutors({
      runDir,
      producers: testProducers(chain, stubManagerModel(makeManagerDecisionDraft()), calls),
      now: () => FIXED_NOW,
    });
    const completed = new Map<OrchestratorStage, ArtifactReference>([["maker", makerRef]]);

    await expect(executors.communicator({
      run_id: chain.run_id,
      account_slug: chain.research_brief.account_slug,
      stage: "communicator",
      version: 2,
      requires_human_approval: true,
      completed_artifacts: completed,
      required_changes: ["Tighten the invitation copy so it never implies an individual-level cause."],
    })).rejects.toSatisfy((error: unknown) => isLivePipelineError(error) && error.code === "REVISION_UNSUPPORTED");

    // Not adopted (would have returned a result, not thrown), not re-produced, and the planted file was
    // never overwritten.
    expect(calls.communicator).toBe(0);
    expect(await readFile(artifactPath(runDir, "communicator", 2), "utf8")).toBe(v1Bytes);
  });
});

// Truncate the event log to the exact torn tail where the Communicator is active (its stage_started is
// the last surviving event) with its durable v1 artefact still on disk.
async function truncateCommunicatorActive(jsonlPath: string): Promise<void> {
  const lines = (await readFile(jsonlPath, "utf8")).split("\n").filter((line) => line.length > 0);
  const kept: string[] = [];
  for (const line of lines) {
    kept.push(line);
    const parsed = JSON.parse(line) as { event?: { type?: string; stage?: string } };
    if (parsed.event?.type === "stage_started" && parsed.event.stage === "communicator") break;
  }
  await writeFile(jsonlPath, `${kept.join("\n")}\n`, "utf8");
}
