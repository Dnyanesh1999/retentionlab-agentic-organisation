// @vitest-environment node

import { existsSync } from "node:fs";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { isOrchestratorError } from "./errors.js";
import { acquireRunLock, RUN_LOCK_FILE, type RunLockDeps } from "./runLock.js";

const FIXED_NOW = new Date("2026-08-06T04:00:00.000Z");

function deps(overrides: Partial<RunLockDeps> = {}): RunLockDeps {
  return {
    now: () => FIXED_NOW,
    pid: 4321,
    host: "test-host",
    isProcessAlive: () => true,
    newToken: () => "token-fixed",
    ...overrides,
  };
}

async function tempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "retentionlab-lock-"));
}

describe("run lock", () => {
  it("grants an exclusive lock and releases it", async () => {
    const dir = await tempDir();
    const lock = await acquireRunLock(dir, deps());
    expect(existsSync(join(dir, RUN_LOCK_FILE))).toBe(true);
    await lock.release();
    expect(existsSync(join(dir, RUN_LOCK_FILE))).toBe(false);
  });

  it("refuses a second concurrent writer while the holder is alive", async () => {
    const dir = await tempDir();
    await acquireRunLock(dir, deps({ pid: 111 }));
    await expect(acquireRunLock(dir, deps({ pid: 222, isProcessAlive: () => true })))
      .rejects.toSatisfy((error: unknown) => isOrchestratorError(error) && error.code === "RUN_EXISTS");
  });

  it("refuses to steal a foreign-host lock even if its pid looks dead", async () => {
    const dir = await tempDir();
    await acquireRunLock(dir, deps({ host: "other-host", pid: 111 }));
    await expect(acquireRunLock(dir, deps({ host: "test-host", pid: 222, isProcessAlive: () => false })))
      .rejects.toSatisfy((error: unknown) => isOrchestratorError(error) && error.code === "RUN_EXISTS");
  });

  it("conservatively reclaims a same-host lock whose pid is provably dead", async () => {
    const dir = await tempDir();
    await acquireRunLock(dir, deps({ host: "test-host", pid: 111 }));
    const lock = await acquireRunLock(dir, deps({ host: "test-host", pid: 222, isProcessAlive: (pid) => pid !== 111, newToken: () => "token-b" }));
    const record = JSON.parse(await readFile(join(dir, RUN_LOCK_FILE), "utf8")) as { pid: number };
    expect(record.pid).toBe(222);
    await lock.release();
  });

  it("release never deletes a lock a different owner now holds", async () => {
    const dir = await tempDir();
    const lock = await acquireRunLock(dir, deps({ pid: 111, newToken: () => "token-a" }));

    // Simulate the original lock being replaced by a NEW owner acquiring the same path (e.g. after the
    // first file was removed and re-created). The on-disk record now carries a different token.
    const usurper = { pid: 222, host: "test-host", acquired_at: FIXED_NOW.toISOString(), token: "token-b" };
    await writeFile(join(dir, RUN_LOCK_FILE), `${JSON.stringify(usurper, null, 2)}\n`, "utf8");

    // The stale holder releases — it must NOT unlink the usurper's lock.
    await lock.release();
    expect(existsSync(join(dir, RUN_LOCK_FILE))).toBe(true);
    const survived = JSON.parse(await readFile(join(dir, RUN_LOCK_FILE), "utf8")) as { token: string };
    expect(survived.token).toBe("token-b");
  });

  it("release leaves a malformed lock untouched rather than deleting foreign state", async () => {
    const dir = await tempDir();
    const lock = await acquireRunLock(dir, deps({ newToken: () => "token-a" }));
    await writeFile(join(dir, RUN_LOCK_FILE), "{ not valid json", "utf8");
    await lock.release();
    expect(existsSync(join(dir, RUN_LOCK_FILE))).toBe(true);
  });
});
