import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { OrchestratorError } from "./errors.js";

import { artifactPath } from "./artifactStore.js";
import { STAGE_ORDER } from "./contracts.js";
import type { EventStore } from "./eventStore.js";
import { ARTIFACT_SCHEMAS } from "./livePipeline.js";
import { readRunInput } from "./runInput.js";
import {
  artifactKey,
  buildPipelineTranscript,
  renderTranscriptMarkdown,
  serializePipelineTranscript,
  type PipelineTranscript,
  type TranscriptSource,
} from "./transcript.js";

// I/O boundary for the deterministic transcript builder: load run inputs, the verified event log,
// the replayed state and every durable artefact referenced in stage history, then hand the parsed
// data to the pure builder. Nothing here invents data; it only reads and validates.

// Immutable transcript snapshots. A transcript is EVIDENCE and is never overwritten. Each snapshot's
// file name is derived deterministically from the verified run state — the terminal/status label, the
// committed event count, and the final event-chain hash — so:
//   - the SAME verified state always maps to the SAME name (idempotent re-export), and
//   - a LATER state (more events / a different final hash) maps to a DISTINCT name (a new snapshot).
// Snapshots are created with exclusive creation (`wx`); a prior transcript is never replaced.
export const TRANSCRIPT_FILE_PREFIX = "pipeline-transcript";

export async function loadTranscriptSource(runDir: string, store: EventStore, runId: string): Promise<TranscriptSource> {
  const runInput = await readRunInput(runDir);
  const envelopes = await store.readEnvelopes(runId);
  const state = await store.loadState(runId);

  const artifacts = new Map<string, unknown>();
  for (const stage of STAGE_ORDER) {
    for (const ref of state.stages[stage].history) {
      const raw = await readFile(artifactPath(runDir, stage, ref.version), { encoding: "utf8" });
      const parsed = ARTIFACT_SCHEMAS[stage].parse(JSON.parse(raw));
      artifacts.set(artifactKey(stage, ref.version), parsed);
    }
  }

  return { runInput, envelopes, state, artifacts };
}

export type WrittenTranscript = {
  readonly transcript: PipelineTranscript;
  readonly slug: string;
  readonly jsonPath: string;
  readonly markdownPath: string;
  // true when an identical snapshot already existed on disk and was verified rather than rewritten.
  readonly reused: boolean;
};

// Deterministic, state-derived snapshot slug: the run's terminal/status label, its committed event
// count, and the first 16 hex of the final event-chain hash. Same verified state -> same slug; a later
// state -> a distinct slug.
export function transcriptSnapshotSlug(source: TranscriptSource): string {
  const finalHash = source.envelopes.at(-1)?.hash ?? "genesis";
  return `${source.state.status}.e${source.state.event_count}.${finalHash.slice(0, 16)}`;
}

// Write one immutable snapshot file. Exclusive creation guarantees a prior transcript is never
// overwritten. If a file already exists at this deterministic name it MUST be byte-for-byte the content
// we would have written (same verified state -> same bytes): we verify and reuse it. Any divergence
// fails closed rather than replacing prior evidence.
async function writeImmutableSnapshot(path: string, content: string): Promise<boolean> {
  try {
    await writeFile(path, content, { encoding: "utf8", flag: "wx" });
    return false;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  const existing = await readFile(path, { encoding: "utf8" });
  if (existing !== content) {
    throw new OrchestratorError(
      "RUN_EXISTS",
      `Refusing to overwrite immutable transcript snapshot ${path}: on-disk bytes differ from the rebuilt `
        + "transcript for the same verified state.",
    );
  }
  return true;
}

// Build and persist both transcript renderings as IMMUTABLE, state-versioned snapshots. Re-exporting an
// unchanged run verifies and reuses the existing snapshot without rewriting; a later state produces a
// new, distinctly named snapshot. A prior transcript is never overwritten.
export async function writePipelineTranscript(runDir: string, source: TranscriptSource): Promise<WrittenTranscript> {
  const transcript = buildPipelineTranscript(source);
  const slug = transcriptSnapshotSlug(source);
  const jsonPath = join(runDir, `${TRANSCRIPT_FILE_PREFIX}.${slug}.json`);
  const markdownPath = join(runDir, `${TRANSCRIPT_FILE_PREFIX}.${slug}.md`);
  const jsonReused = await writeImmutableSnapshot(jsonPath, serializePipelineTranscript(transcript));
  const markdownReused = await writeImmutableSnapshot(markdownPath, renderTranscriptMarkdown(transcript));
  return { transcript, slug, jsonPath, markdownPath, reused: jsonReused && markdownReused };
}
