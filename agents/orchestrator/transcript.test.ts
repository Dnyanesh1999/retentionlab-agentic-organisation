// @vitest-environment node

import { existsSync } from "node:fs";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { communicationPlanSchema } from "../communicator/contracts.js";
import { recoveryDesignSpecificationSchema } from "../designer/contracts.js";
import { recoveryRoomArtifactSchema } from "../maker/contracts.js";
import { runManager } from "../manager/run.js";
import { makeManagerDecisionDraft, makeManagerInput } from "../manager/testFixture.js";
import { researchBriefSchema } from "../researcher/contracts.js";

import { compactArtifactHash } from "./artifactStore.js";
import { createFileEventStore } from "./eventStore.js";
import { createLivePipelineExecutors, type PipelineProducers } from "./livePipeline.js";
import { createOrchestrator } from "./orchestrator.js";
import { writeRunInput } from "./runInput.js";
import {
  buildPipelineTranscript,
  renderTranscriptMarkdown,
  serializePipelineTranscript,
  type TranscriptSource,
} from "./transcript.js";
import { loadTranscriptSource, writePipelineTranscript } from "./transcriptSource.js";
import type { ManagerModelAdapter } from "../manager/model.js";

const FIXED_NOW = new Date("2026-08-06T04:00:00.000Z");

function stubManagerModel(): ManagerModelAdapter {
  const draft = makeManagerDecisionDraft();
  return { requestedModel: "example/manager-free", generate: async () => ({ text: JSON.stringify(draft), resolvedModel: "example/manager-free" }) };
}

function producers(chain: ReturnType<typeof makeManagerInput>): PipelineProducers {
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

async function runToApproval() {
  const runDir = await mkdtemp(join(tmpdir(), "retentionlab-transcript-"));
  const chain = makeManagerInput();
  await writeRunInput(runDir, { run_id: chain.run_id, account_slug: chain.research_brief.account_slug, objective: "Compose and route a consent-safe recovery experience for human approval.", initiated_at: "2026-08-06T00:00:00.000Z" });
  const store = createFileEventStore(runDir);
  const orchestrator = createOrchestrator({ store, executors: createLivePipelineExecutors({ runDir, producers: producers(chain), now: () => FIXED_NOW }), now: () => FIXED_NOW });
  await orchestrator.start({ run_id: chain.run_id, account_slug: chain.research_brief.account_slug, requires_human_approval: true });
  const source = await loadTranscriptSource(runDir, store, chain.run_id);
  return { runDir, chain, store, source };
}

describe("pipeline transcript", () => {
  it("is deterministic: two builds over identical sources are byte-for-byte equal", async () => {
    const { source } = await runToApproval();
    const first = serializePipelineTranscript(buildPipelineTranscript(source));
    const second = serializePipelineTranscript(buildPipelineTranscript(source));
    expect(first).toBe(second);
    expect(renderTranscriptMarkdown(buildPipelineTranscript(source))).toBe(renderTranscriptMarkdown(buildPipelineTranscript(source)));
  });

  it("is source-backed: every cumulative-work metric is copied from a typed artefact", async () => {
    const { chain, source } = await runToApproval();
    const transcript = buildPipelineTranscript(source);

    const researcher = transcript.cumulative_work_proof.find((entry) => entry.stage === "researcher");
    expect(researcher?.metrics.observations).toBe(chain.research_brief.observations.length);
    expect(researcher?.metrics.hypotheses).toBe(chain.research_brief.hypotheses.length);

    const communicator = transcript.cumulative_work_proof.find((entry) => entry.stage === "communicator");
    expect(communicator?.metrics.message_claims).toBe(chain.communication_plan.message_claims.length);
    expect(communicator?.metrics.email_subject).toBe(chain.communication_plan.email_invitation.subject);

    // Events copied verbatim, hashes preserved.
    expect(transcript.events.length).toBe(source.envelopes.length);
    expect(transcript.events[0]?.hash).toBe(source.envelopes[0]?.hash);

    // Lineage links resolve to the recorded predecessor digests.
    for (const item of transcript.lineage) {
      for (const link of item.links) expect(link.matches_predecessor).toBe(true);
    }
  });

  it("records an approval that halts at human approval and takes no external action", async () => {
    const { source } = await runToApproval();
    const transcript = buildPipelineTranscript(source);
    expect(transcript.run.final_status).toBe("awaiting_human_approval");
    expect(transcript.manager_outcome.decision).toBe("approve");
    expect(transcript.manager_outcome.permitted_next_action).toBe("await_human_approval");
    expect(transcript.manager_outcome.autonomous_external_actions).toBe(false);

    const markdown = renderTranscriptMarkdown(transcript);
    expect(markdown).toContain("never sends, publishes, deploys, mutates customer data");
  });

  it("writes an immutable snapshot and never overwrites an accepted one", async () => {
    const { runDir, source } = await runToApproval();
    const first = await writePipelineTranscript(runDir, source);
    expect(first.reused).toBe(false);
    const jsonBytes = await readFile(first.jsonPath, "utf8");

    // Re-exporting the SAME verified state reuses the existing immutable snapshot byte-for-byte.
    const second = await writePipelineTranscript(runDir, source);
    expect(second.slug).toBe(first.slug);
    expect(second.jsonPath).toBe(first.jsonPath);
    expect(second.reused).toBe(true);
    expect(await readFile(second.jsonPath, "utf8")).toBe(jsonBytes);

    // If prior evidence at that immutable name ever diverges, a re-export FAILS CLOSED rather than
    // silently overwriting it.
    await writeFile(first.jsonPath, `${jsonBytes}// tampered`, "utf8");
    await expect(writePipelineTranscript(runDir, source)).rejects.toThrow(/immutable transcript snapshot/);
  });

  it("creates a distinct snapshot for a later verified state and leaves the earlier one intact", async () => {
    const { runDir, source } = await runToApproval();
    const earlier = await writePipelineTranscript(runDir, source);

    const last = source.envelopes.at(-1);
    if (!last) throw new Error("expected at least one envelope");
    // A later verified state: one more committed event (and a different final chain hash).
    const later: TranscriptSource = {
      ...source,
      state: { ...source.state, event_count: source.state.event_count + 1 },
      envelopes: [...source.envelopes, { ...last, seq: last.seq + 1, prev_hash: last.hash, hash: "f".repeat(64) }],
    };
    const laterWritten = await writePipelineTranscript(runDir, later);

    expect(laterWritten.slug).not.toBe(earlier.slug);
    expect(laterWritten.jsonPath).not.toBe(earlier.jsonPath);
    expect(laterWritten.reused).toBe(false);
    // The earlier immutable snapshot is untouched — a later state never overwrites prior evidence.
    expect(existsSync(earlier.jsonPath)).toBe(true);
    expect(existsSync(laterWritten.jsonPath)).toBe(true);
  });

  it("does not invent claims: the built transcript matches a written+reloaded copy", async () => {
    const { runDir, source } = await runToApproval();
    const transcript = buildPipelineTranscript(source);
    const path = join(runDir, "check-transcript.json");
    await writeFile(path, serializePipelineTranscript(transcript), "utf8");
    const reloaded = JSON.parse(await readFile(path, "utf8")) as unknown;
    expect(reloaded).toEqual(transcript);
  });
});
