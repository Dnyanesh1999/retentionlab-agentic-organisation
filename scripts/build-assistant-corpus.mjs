#!/usr/bin/env node
/**
 * Build the assistant's retrieval corpus from the committed Gate 9 artefacts.
 *
 * Why generated rather than imported at runtime: the Edge Function must be
 * self-contained when deployed, and reaching up out of `supabase/functions/`
 * into `design/specifications/` is not something to discover is unsupported
 * during a deploy. The generated file lives beside the function, and
 * `scripts/build-assistant-corpus.node-test.mjs` fails if it drifts from this
 * generator.
 *
 * Nothing here widens what is public. Every source file below is already
 * imported by `gate9Run.ts` and therefore already ships in full to every
 * browser that loads the case record; this only reorganises that same material
 * into retrievable passages.
 *
 * Run with: npm run assistant:corpus
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const specs = join(root, "design", "specifications");
const target = join(root, "supabase", "functions", "retentionlab-assistant", "corpus.json");

const read = (name) => JSON.parse(readFileSync(join(specs, name), "utf8"));

const transcript = read("gate-9-live-pipeline-transcript.v1.json");
const brief = read("gate-9-live-research-brief.v1.json");
const manager = read("gate-9-live-manager-decision.v1.json");
const communication = read("gate-9-live-communication-plan.v2.json");

/**
 * A chunk must be publishable and complete.
 *
 * The digest check keeps hashes out of what the model can see, so it cannot
 * quote one. The `undefined` check is the more mundane but likelier failure:
 * a mistyped field path silently renders the string "undefined" into a passage
 * the model would then faithfully quote back as fact. That must break the
 * build, not ship.
 */
function assertPublishable(chunk) {
  if (/[0-9a-f]{64}/i.test(chunk.text)) {
    throw new Error(`Chunk ${chunk.id} contains a full digest and must not be published to the model.`);
  }
  if (/\bundefined\b|\bnull\b|\bNaN\b/.test(chunk.text)) {
    throw new Error(
      `Chunk ${chunk.id} rendered a missing value into its text: ${JSON.stringify(chunk.text)}`,
    );
  }
  return chunk;
}

/** Read a required field, failing loudly rather than rendering "undefined". */
function required(value, path) {
  if (value === undefined || value === null) {
    throw new Error(`Required artefact field is missing: ${path}`);
  }
  return value;
}

const governance = required(manager.governance, "manager.governance");
const channels = required(brief.consent_boundaries?.allowed_channels, "brief.consent_boundaries.allowed_channels");
const failures = required(transcript.failed_stage_retries, "transcript.failed_stage_retries");

const chunks = [
  {
    id: "manager-decision",
    source: "manager.operational-decision.v1",
    text: [
      `The Manager decision was ${required(manager.decision, "manager.decision")}.`,
      `Human approval required: ${governance.human_approval_required}.`,
      `Autonomous external actions: ${governance.autonomous_external_actions}.`,
      `Permitted next action: ${governance.permitted_next_action}.`,
      "The organisation stops at this boundary and a named human decides what happens next.",
    ].join(" "),
    keywords: ["manager", "decision", "decide", "approve", "verdict", "outcome", "next action"],
  },
  {
    id: "autonomy",
    source: "manager.operational-decision.v1 · governance",
    text: [
      "No stage may send, publish, deploy or mutate customer data on its own.",
      `Autonomous external actions are ${governance.autonomous_external_actions} for this run.`,
      "Nothing was sent to any customer at any point in this case.",
    ].join(" "),
    keywords: ["autonomous", "automatic", "alone", "without a human", "send", "sent", "act"],
  },
  {
    id: "consent",
    source: "researcher.research-brief.v1 · consent_boundaries",
    text: [
      `The sealed consent boundary allows the following channels: ${channels.join(", ") || "none"}.`,
      "A channel being allowed is not permission to use it; a named human must still approve.",
    ].join(" "),
    keywords: ["consent", "channel", "email", "contact", "customer", "message", "communicate"],
  },
  {
    id: "lineage",
    source: "gate-9 transcript · lineage",
    text: [
      "Each stage verifies the exact stored hash of its predecessor before using its output.",
      "A stage whose predecessor hash does not match fails closed rather than proceeding.",
      "The chain for this case was verified end to end across all five stages.",
    ].join(" "),
    keywords: ["chain", "lineage", "verified", "hash", "link", "evidence", "predecessor"],
  },
  {
    id: "failure-history",
    source: "gate-9 transcript · failed_stage_retries",
    text: failures.length
      ? [
          `This run recorded ${failures.length} stage failure(s) before completing.`,
          "Failures are append-only and are never rewritten or hidden.",
          "A retry restarts only the failed stage, from its last sealed checkpoint.",
        ].join(" ")
      : "No stage failure was recorded for this run. Any failure would have been kept append-only.",
    keywords: ["fail", "failed", "failure", "retry", "error", "recover", "communicator", "designer"],
  },
  {
    id: "five-agents",
    source: "gate-9 transcript · stages",
    text: [
      "The organisation has exactly five bounded agents in a fixed order:",
      "Researcher, Designer, Maker, Communicator, then Manager.",
      "Each one hands a sealed artefact to the next and cannot skip ahead or run twice in parallel.",
    ].join(" "),
    keywords: ["agent", "agents", "stage", "stages", "five", "order", "pipeline", "researcher", "designer", "maker", "communicator"],
  },
  {
    id: "communication",
    source: "communicator.communication-plan.v2",
    text: [
      `The Communicator prepared a view-only invitation carrying ${
        required(communication.message_claims, "communication.message_claims").length
      } claims, each supported by sealed evidence.`,
      `The plan targets the ${channels[0]} channel, which is the consented one.`,
      "It was never sent. Preparing a message and sending one are separate things, and only the second needs a human.",
    ].join(" "),
    keywords: ["communicator", "message", "invitation", "claim", "claims", "draft", "wrote"],
  },
  {
    id: "evidence-rules",
    source: "researcher.research-brief.v1 · provenance",
    text: [
      "The Researcher may cite only evidence returned by tools in its own session.",
      "Every later stage may cite only evidence inherited through the verified chain.",
      "No stage may introduce a fact from outside that record.",
    ].join(" "),
    keywords: ["evidence", "cite", "source", "provenance", "tool", "research", "invent"],
  },
];

const corpus = { chunks: chunks.map(assertPublishable) };
writeFileSync(target, `${JSON.stringify(corpus, null, 2)}\n`, "utf8");

console.log(`Assistant corpus written: ${corpus.chunks.length} chunks → ${target}`);
