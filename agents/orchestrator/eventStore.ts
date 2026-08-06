import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  GENESIS_HASH,
  eventEnvelopeSchema,
  orchestratorEventSchema,
  type EventEnvelope,
  type OrchestratorEvent,
} from "./contracts.js";
import { OrchestratorError } from "./errors.js";
import { replay, type OrchestratorState } from "./stateMachine.js";

// ---------------------------------------------------------------------------
// Append-only JSONL event/checkpoint store with a tamper-evident hash chain.
//
// - Exclusive-create for the first line (a run file is never overwritten).
// - Append-only for every subsequent event.
// - Each line is one EventEnvelope { seq, prev_hash, hash, event }.
// - `hash` chains over (seq, prev_hash, canonical event), so any edit, reorder,
//   duplication or content tampering of a RETAINED prefix is detected on read.
//
// Tail truncation is a deliberate NON-claim. A cleanly tail-truncated chain (whole
// trailing lines lost) is still a valid shorter prefix — there is no separately
// durable head/length marker, so we do not and cannot detect it as tampering. This
// is safe by construction: every valid prefix folds to a resumable state, and the
// atomic `manager_decided` seal guarantees no prefix strands a completed-but-
// undecided Manager. A partially written trailing line (a torn append) is rejected
// as invalid JSON (`CORRUPTED_HISTORY`) rather than silently accepted.
// ---------------------------------------------------------------------------

function hashEnvelopeBody(seq: number, prevHash: string, event: OrchestratorEvent): string {
  // Canonical body: the event is re-serialized from its schema-parsed form so key order is stable and
  // independent of how the caller constructed the object.
  const canonicalEvent = JSON.stringify(orchestratorEventSchema.parse(event));
  return createHash("sha256").update(`${seq}\n${prevHash}\n${canonicalEvent}`).digest("hex");
}

export function buildEnvelope(seq: number, prevHash: string, event: OrchestratorEvent): EventEnvelope {
  return eventEnvelopeSchema.parse({
    seq,
    prev_hash: prevHash,
    hash: hashEnvelopeBody(seq, prevHash, event),
    event,
  });
}

function serializeEnvelope(envelope: EventEnvelope): string {
  return JSON.stringify(envelope);
}

// Parse and fully verify a JSONL run history. Throws a typed OrchestratorError on any corruption,
// inconsistency, duplication or tampering.
export function parseAndVerifyChain(lines: readonly string[]): EventEnvelope[] {
  const envelopes: EventEnvelope[] = [];
  let prevHash = GENESIS_HASH;

  lines.forEach((line, index) => {
    let raw: unknown;
    try {
      raw = JSON.parse(line);
    } catch {
      throw new OrchestratorError("CORRUPTED_HISTORY", `Line ${index} is not valid JSON.`);
    }

    const parsed = eventEnvelopeSchema.safeParse(raw);
    if (!parsed.success) {
      throw new OrchestratorError("CORRUPTED_HISTORY", `Line ${index} is not a valid event envelope: ${parsed.error.message}`);
    }
    const envelope = parsed.data;

    if (envelope.seq !== index) {
      throw new OrchestratorError(
        "DUPLICATE_SEQUENCE",
        `Sequence gap or duplicate at line ${index}: envelope.seq = ${envelope.seq}.`,
      );
    }
    if (envelope.prev_hash !== prevHash) {
      throw new OrchestratorError(
        "TAMPERED_HISTORY",
        `Broken hash chain at seq ${envelope.seq}: prev_hash does not match the previous line's hash.`,
      );
    }
    const recomputed = hashEnvelopeBody(envelope.seq, envelope.prev_hash, envelope.event);
    if (recomputed !== envelope.hash) {
      throw new OrchestratorError(
        "TAMPERED_HISTORY",
        `Content tampering detected at seq ${envelope.seq}: recomputed hash does not match the stored hash.`,
      );
    }

    envelopes.push(envelope);
    prevHash = envelope.hash;
  });

  return envelopes;
}

export interface EventStore {
  createRun(runId: string, event: OrchestratorEvent): Promise<void>;
  append(runId: string, event: OrchestratorEvent): Promise<void>;
  readEnvelopes(runId: string): Promise<EventEnvelope[]>;
  loadState(runId: string): Promise<OrchestratorState>;
  exists(runId: string): Promise<boolean>;
}

function splitLines(content: string): string[] {
  return content.split("\n").filter((line) => line.length > 0);
}

// Shared: compute the next envelope from an existing verified chain plus a new event.
function nextEnvelope(existing: readonly EventEnvelope[], event: OrchestratorEvent): EventEnvelope {
  const last = existing.at(-1);
  const seq = last ? last.seq + 1 : 0;
  const prevHash = last ? last.hash : GENESIS_HASH;
  return buildEnvelope(seq, prevHash, event);
}

// -------------------- File-backed store --------------------

const RUN_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function createFileEventStore(rootDir: string): EventStore {
  function runPath(runId: string): string {
    if (!RUN_ID_PATTERN.test(runId)) {
      throw new OrchestratorError("ILLEGAL_EVENT", `Refusing unsafe run id "${runId}".`);
    }
    return join(rootDir, `${runId}.jsonl`);
  }

  async function readLines(runId: string): Promise<string[]> {
    try {
      const content = await readFile(runPath(runId), { encoding: "utf8" });
      return splitLines(content);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new OrchestratorError("RUN_NOT_FOUND", `No run history for ${runId}.`);
      }
      throw error;
    }
  }

  return {
    async createRun(runId, event) {
      if (event.type !== "run_started") {
        throw new OrchestratorError("ILLEGAL_EVENT", "createRun requires a run_started event.");
      }
      await mkdir(rootDir, { recursive: true });
      const envelope = buildEnvelope(0, GENESIS_HASH, event);
      try {
        // Exclusive create: fails if the run file already exists, so an accepted history is never
        // overwritten.
        await writeFile(runPath(runId), `${serializeEnvelope(envelope)}\n`, { encoding: "utf8", flag: "wx" });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST") {
          throw new OrchestratorError("RUN_EXISTS", `Run ${runId} already exists; refusing to overwrite.`);
        }
        throw error;
      }
    },

    async append(runId, event) {
      const existing = parseAndVerifyChain(await readLines(runId));
      const envelope = nextEnvelope(existing, event);
      await appendFile(runPath(runId), `${serializeEnvelope(envelope)}\n`, { encoding: "utf8" });
    },

    async readEnvelopes(runId) {
      return parseAndVerifyChain(await readLines(runId));
    },

    async loadState(runId) {
      const envelopes = parseAndVerifyChain(await readLines(runId));
      return replay(envelopes.map((envelope) => envelope.event));
    },

    async exists(runId) {
      try {
        await readFile(runPath(runId), { encoding: "utf8" });
        return true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
        throw error;
      }
    },
  };
}

// -------------------- In-memory store (tests / composition) --------------------
//
// Holds raw JSONL lines so it faithfully models the file store, including deliberate tampering in
// adversarial tests. The `lines` map is exposed via `tamper` helpers for that purpose only.

export interface MemoryEventStore extends EventStore {
  rawLines(runId: string): string[];
  overwriteLines(runId: string, lines: string[]): void;
}

export function createMemoryEventStore(): MemoryEventStore {
  const runs = new Map<string, string[]>();

  function requireRun(runId: string): string[] {
    const lines = runs.get(runId);
    if (!lines) throw new OrchestratorError("RUN_NOT_FOUND", `No run history for ${runId}.`);
    return lines;
  }

  return {
    async createRun(runId, event) {
      if (event.type !== "run_started") {
        throw new OrchestratorError("ILLEGAL_EVENT", "createRun requires a run_started event.");
      }
      if (runs.has(runId)) {
        throw new OrchestratorError("RUN_EXISTS", `Run ${runId} already exists; refusing to overwrite.`);
      }
      runs.set(runId, [serializeEnvelope(buildEnvelope(0, GENESIS_HASH, event))]);
    },

    async append(runId, event) {
      const lines = requireRun(runId);
      const existing = parseAndVerifyChain(lines);
      lines.push(serializeEnvelope(nextEnvelope(existing, event)));
    },

    async readEnvelopes(runId) {
      return parseAndVerifyChain(requireRun(runId));
    },

    async loadState(runId) {
      const envelopes = parseAndVerifyChain(requireRun(runId));
      return replay(envelopes.map((envelope) => envelope.event));
    },

    async exists(runId) {
      return runs.has(runId);
    },

    rawLines(runId) {
      return [...requireRun(runId)];
    },

    overwriteLines(runId, lines) {
      runs.set(runId, [...lines]);
    },
  };
}
