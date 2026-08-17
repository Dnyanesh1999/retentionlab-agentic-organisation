// What must and must not be inside the submitted code ZIP.
//
// The exclusions are agent tooling, so they are safe to drop. The inclusions are not a matter of
// taste: the brief requires AI contributions to be cited with their model and prompt, the submission
// document's appendix points a reader at `docs/ai-usage-log.md` by name, and the QA records are the
// evidence of iteration the rubric asks for. A future tidy-up that removes them would break a stated
// requirement, so it should break this test first.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { packageCodeZip } from "./package-code-zip.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..");

const work = mkdtempSync(join(tmpdir(), "retentionlab-zip-test-"));
let entries = [];
let manifest = null;

try {
  const result = packageCodeZip({ outDir: work });
  manifest = result.manifest;
  entries = execFileSync("unzip", ["-Z1", result.zipPath], { encoding: "utf8" })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    // Strip the "<archive-name>/" prefix so assertions read as repository paths.
    .map((line) => line.replace(/^[^/]+\//, ""));
} finally {
  rmSync(work, { recursive: true, force: true });
}

const has = (path) => entries.includes(path);

test("excludes agent tooling and stale build output", () => {
  for (const path of ["CLAUDE.md", "docs/claude-handoff.md", ".claude/launch.json"]) {
    assert.equal(has(path), false, `${path} should not ship in the submitted ZIP`);
  }
  assert.equal(
    entries.some((path) => path.startsWith("output/")),
    false,
    "output/ holds generated artefacts and should not ship",
  );
});

test("retains the AI usage log, which the brief requires and the submission references", () => {
  assert.equal(has("docs/ai-usage-log.md"), true);
});

test("retains the compliance matrix and the QA evidence of iteration", () => {
  assert.equal(has("docs/brief-compliance.md"), true);
  assert.equal(has("docs/submission-pipeline-evidence.md"), true);

  const qaRecords = entries.filter((path) => /^docs\/qa-.*\.md$/.test(path));
  assert.ok(qaRecords.length >= 20, `expected the QA record set, found ${qaRecords.length}`);
});

test("retains the code that proves the live data connection", () => {
  for (const path of [
    "supabase/functions/retentionlab-runs/researcher.ts",
    "supabase/functions/retentionlab-evidence/index.ts",
    "runtime/hosted/contracts.ts",
    "package.json",
    "README.md",
    ".env.example",
  ]) {
    assert.equal(has(path), true, `${path} must ship — it is part of the assessed codebase`);
  }
});

test("ships no environment file other than the example", () => {
  const envFiles = entries.filter((path) => /(^|\/)\.env($|\.)/.test(path));
  assert.deepEqual(envFiles, [".env.example"]);
});

test("records what it excluded, rather than dropping files silently", () => {
  assert.ok(Array.isArray(manifest.excluded_tooling));
  assert.ok(manifest.excluded_tooling.includes("CLAUDE.md"));
  assert.equal(manifest.file_count, entries.length);
  assert.ok(manifest.tracked_file_count > manifest.file_count);
});

test("the repository still contains the excluded files", () => {
  // The exclusion is tidying, not concealment: the repository is public and linked from the
  // submission, so these files remain readable there.
  const tracked = execFileSync("git", ["ls-files"], { cwd: REPO_ROOT, encoding: "utf8" }).split("\n");
  assert.ok(tracked.includes("CLAUDE.md"));
  assert.ok(tracked.includes("docs/claude-handoff.md"));
});
