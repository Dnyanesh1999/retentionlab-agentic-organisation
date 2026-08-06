import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { z } from "zod";

import { OrchestratorError } from "./errors.js";

// ---------------------------------------------------------------------------
// Local exclusive single-writer lock for a run directory.
//
// Prevents two concurrent processes from driving the SAME run (which would race
// the append-only event log and the exclusive-create artefact writes). The lock is
// a `run.lock` file created with O_EXCL; the holder's identity is recorded so a
// STALE lock can be recovered conservatively.
//
// Stale-lock policy (deliberately conservative):
//   - Reclaim ONLY when the recorded host equals this host AND the recorded pid is
//     provably dead (`process.kill(pid, 0)` throws ESRCH).
//   - A lock held on a DIFFERENT host, or by a pid that is still alive (or whose
//     liveness cannot be determined, e.g. EPERM), is NEVER auto-reclaimed. The
//     caller is told to remove `run.lock` by hand after confirming no writer runs.
//
// Honest concurrency limits (NOT race-proof — do not overclaim):
//   - The lock never STEALS a live or foreign holder, so it excludes a concurrent
//     writer whose lock is intact. That is the guarantee we rely on.
//   - Stale reclamation of a provably-dead SAME-HOST lock is best-effort, not fully
//     serialized: two processes that both observe the same dead lock can each
//     unlink-then-recreate it and both proceed. The exclusive-create (`wx`) artefact
//     writes and the hash-chained event log remain the real single-writer backstop.
//   - Each holder stamps a cryptographically random ownership token into its record.
//     `release` re-reads the current lock and unlinks ONLY when that token still
//     matches; a missing, malformed, or differently-tokened lock is left untouched.
//     This makes release best-effort ownership-checked: it will not delete a lock that a
//     later reclaim already replaced with a differently-tokened record. It is NOT a
//     guarantee that release can never delete another owner's lock — read/compare/unlink
//     is a filesystem TOCTOU, so an external or manual replacement that lands between the
//     token comparison and the unlink can still be removed. The token check narrows this
//     window; it does not close it. The exclusive-create (`wx`) artefact writes and the
//     verified hash-chained event replay remain the real single-writer backstop.
// ---------------------------------------------------------------------------

export const RUN_LOCK_FILE = "run.lock";

const lockRecordSchema = z.object({
  pid: z.number().int().positive(),
  host: z.string().min(1),
  acquired_at: z.string().datetime({ offset: true }),
  // Cryptographically random per-acquisition owner id. Distinguishes THIS holder's lock file from any
  // later lock that happens to occupy the same path, so release only ever removes its own lock.
  token: z.string().min(1),
}).strict();

type LockRecord = z.infer<typeof lockRecordSchema>;

export type RunLock = {
  readonly path: string;
  release(): Promise<void>;
};

export type RunLockDeps = {
  readonly now: () => Date;
  readonly pid: number;
  readonly host: string;
  // Injectable liveness probe so tests never signal real processes. Returns true iff the pid is alive.
  readonly isProcessAlive: (pid: number) => boolean;
  // Injectable ownership-token source so tests can drive deterministic, distinct owners. Production
  // uses a cryptographically random UUID per acquisition.
  readonly newToken: () => string;
};

function defaultIsProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ESRCH") return false; // no such process — provably dead
    // EPERM (exists but not ours) or anything else: cannot prove death — treat as alive.
    return true;
  }
}

export function defaultRunLockDeps(): RunLockDeps {
  return {
    now: () => new Date(),
    pid: process.pid,
    host: hostname(),
    isProcessAlive: defaultIsProcessAlive,
    newToken: () => randomUUID(),
  };
}

// Release helper: unlink the lock ONLY if the current on-disk record still carries our ownership token.
// A missing, unreadable, malformed, or differently-tokened lock is left untouched. The token check is
// best-effort, not TOCTOU-proof: read/compare/unlink is not atomic, so a lock replaced by another owner
// in the gap between the comparison and the unlink can still be removed. It narrows, not closes, that
// window; the exclusive artefact writes and verified event replay are the real backstop.
async function releaseOwnedLock(path: string, token: string): Promise<void> {
  let raw: string;
  try {
    raw = await readFile(path, { encoding: "utf8" });
  } catch {
    return; // already gone or unreadable — nothing we own to remove
  }
  const parsed = lockRecordSchema.safeParse((() => {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  })());
  if (!parsed.success || parsed.data.token !== token) return; // malformed or a different owner — leave it
  await unlink(path).catch(() => undefined);
}

async function writeLock(path: string, record: LockRecord): Promise<boolean> {
  try {
    await writeFile(path, `${JSON.stringify(lockRecordSchema.parse(record), null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
    throw error;
  }
}

export async function acquireRunLock(runDir: string, deps: RunLockDeps = defaultRunLockDeps()): Promise<RunLock> {
  const path = join(runDir, RUN_LOCK_FILE);
  const record: LockRecord = { pid: deps.pid, host: deps.host, acquired_at: deps.now().toISOString(), token: deps.newToken() };

  if (await writeLock(path, record)) {
    return { path, release: () => releaseOwnedLock(path, record.token) };
  }

  // Lock exists — inspect the holder to decide whether it is safely reclaimable.
  let existingRaw: string;
  try {
    existingRaw = await readFile(path, { encoding: "utf8" });
  } catch {
    throw new OrchestratorError("RUN_EXISTS", `Run ${runDir} is locked and the lock is unreadable; remove ${RUN_LOCK_FILE} by hand once no writer is running.`);
  }
  const existing = lockRecordSchema.safeParse((() => {
    try {
      return JSON.parse(existingRaw);
    } catch {
      return null;
    }
  })());
  if (!existing.success) {
    throw new OrchestratorError("RUN_EXISTS", `Run ${runDir} holds a malformed lock; remove ${RUN_LOCK_FILE} by hand once no writer is running.`);
  }

  const holder = existing.data;
  const sameHost = holder.host === deps.host;
  const dead = sameHost && !deps.isProcessAlive(holder.pid);
  if (!dead) {
    throw new OrchestratorError(
      "RUN_EXISTS",
      `Run ${runDir} is locked by pid ${holder.pid} on ${holder.host} (since ${holder.acquired_at}). `
        + `Refusing to steal a live or foreign lock; remove ${RUN_LOCK_FILE} by hand once you confirm no writer is running.`,
    );
  }

  // The holder is provably dead on this host: reclaim by removing its lock and re-attempting exclusive
  // creation once. If another process wins the race in between, we surface the conflict rather than
  // proceeding.
  await unlink(path).catch(() => undefined);
  if (await writeLock(path, record)) {
    return { path, release: () => releaseOwnedLock(path, record.token) };
  }
  throw new OrchestratorError("RUN_EXISTS", `Run ${runDir} was re-locked by another writer during stale-lock recovery.`);
}
