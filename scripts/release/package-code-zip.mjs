// Build the auditable "complete codebase" ZIP the brief requires, then verify
// it is secret-free before it can be handed to a human.
//
// Determinism & exclusions: the archive is produced with `git archive`, so it
// contains EXACTLY the files tracked at the chosen commit and nothing that is
// git-ignored (node_modules/, dist*/, artifacts/, .env, .vercel/, coverage/).
// git archive stamps every entry with the commit time, so the same commit
// always yields byte-identical contents. Working-tree edits that are not
// committed are intentionally excluded — the ZIP reflects a reviewable commit,
// not a transient tree.
//
// Verification (fail-closed): the archived bytes are extracted to a temp dir
// and (1) checked against a deny-list of paths that must never ship, (2) run
// through the shared secret scanner, (3) checked for required files. Any
// finding aborts with a non-zero exit and no ZIP is left behind.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdtempSync, readFileSync, renameSync, rmSync, mkdirSync, writeFileSync, statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { scanEntries } from "./secret-scan.mjs";
import { walkFiles } from "./fs-utils.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..");

// Paths that must never appear in the ZIP. git archive already excludes ignored
// files; this is defence-in-depth against a file being force-added.
const DENY_PATH_PATTERNS = [
  /(^|\/)node_modules\//,
  /(^|\/)dist(-mcp|-agents)?\//,
  /(^|\/)coverage\//,
  /(^|\/)\.vercel\//,
  /(^|\/)artifacts\//,
  /(^|\/)\.env$/,
  /(^|\/)\.env\.(?!example$)[^/]+$/, // .env.local, .env.production — but keep .env.example
  /\.pem$/,
  /\.p12$/,
  /(^|\/)id_rsa$/,
  /(^|\/)\.DS_Store$/,
];

/**
 * Tracked files that belong to the agent tooling or to stale build output rather than to the
 * submitted codebase. These are stripped from the ZIP only — they stay in the repository, which is
 * public and linked from the submission, so this is tidying rather than concealment.
 *
 * The line is drawn at *tooling*, not at *AI*. `docs/ai-usage-log.md` and the `docs/qa-*.md` evidence
 * stay in the archive on purpose: the brief requires AI contributions to be cited with their model and
 * prompt, the submission document's appendix points a reader at that log by name, and the QA records
 * are the evidence of iteration the marking rubric asks for. Removing them would break a stated
 * requirement and contradict the submitted document.
 */
const TOOLING_PATH_PATTERNS = [
  /^CLAUDE\.md$/,
  /^docs\/claude-handoff\.md$/,
  /^\.claude\//,
  /^output\//,
];

const REQUIRED_FILES = ["package.json", "README.md", ".env.example"];

function git(args) {
  return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" }).trim();
}

function resolveRef(ref) {
  try {
    return git(["rev-parse", "--verify", `${ref}^{commit}`]);
  } catch {
    throw new Error(`Cannot resolve git ref "${ref}".`);
  }
}

export function buildArchiveName(ref) {
  const shortSha = git(["rev-parse", "--short", ref]);
  return `retentionlab-agentic-organisation-${shortSha}`;
}

function extractTree(ref, into) {
  // Extract the archive bytes to disk so verification runs on the exact content
  // that will be zipped (git archive tar and zip share the same tree filter).
  const tarPath = join(into, "tree.tar");
  const tarBytes = execFileSync("git", ["archive", "--format=tar", ref], {
    cwd: REPO_ROOT,
    maxBuffer: 256 * 1024 * 1024,
  });
  writeFileSync(tarPath, tarBytes, { flag: "wx" });
  const treeDir = join(into, "tree");
  mkdirSync(treeDir, { recursive: true });
  execFileSync("tar", ["-xf", tarPath, "-C", treeDir]);
  rmSync(tarPath, { force: true });
  return treeDir;
}

/**
 * Package and verify the code ZIP. Returns a manifest object. Throws (fail
 * closed) on any deny-list hit, secret finding or missing required file.
 */
export function packageCodeZip({ ref = "HEAD", outDir } = {}) {
  const commit = resolveRef(ref);
  const name = buildArchiveName(commit);
  const resolvedOutDir = outDir ?? join(REPO_ROOT, "output", "release");
  const zipPath = join(resolvedOutDir, `${name}.zip`);
  const manifestPath = join(resolvedOutDir, `${name}.manifest.json`);

  const work = mkdtempSync(join(tmpdir(), "retentionlab-zip-"));
  try {
    const treeDir = extractTree(ref, work);
    const relPaths = walkFiles(treeDir).sort();

    // (1) deny-list
    const denied = relPaths.filter((rel) =>
      DENY_PATH_PATTERNS.some((pattern) => pattern.test(rel)),
    );
    if (denied.length > 0) {
      throw new Error(`Forbidden files present in archive tree:\n  ${denied.join("\n  ")}`);
    }

    // (2) secret scan on exact archived bytes
    const entries = relPaths.map((rel) => ({
      path: rel,
      content: readFileSync(join(treeDir, rel), "utf8"),
    }));
    const findings = scanEntries(entries);
    if (findings.length > 0) {
      const report = findings
        .map((f) => `  ${f.path}:${f.line} [${f.rule}] ${f.redacted}`)
        .join("\n");
      throw new Error(`Secret scan found ${findings.length} issue(s):\n${report}`);
    }

    // (3) prune agent tooling and stale build output. Done after the scan above, not before, so a
    //     secret hiding in an excluded file still fails the build rather than slipping out silently.
    const excluded = relPaths.filter((rel) =>
      TOOLING_PATH_PATTERNS.some((pattern) => pattern.test(rel)),
    );
    const shipped = relPaths.filter((rel) => !excluded.includes(rel));

    // (4) required files, checked against what actually ships
    const missing = REQUIRED_FILES.filter((required) => !shipped.includes(required));
    if (missing.length > 0) {
      throw new Error(`Archive is missing required files: ${missing.join(", ")}`);
    }

    // The archive is built from the pruned tree rather than straight from `git archive`, because the
    // exclusions above have no equivalent in a plain archive of the commit. `zip -X` omits extra
    // filesystem attributes so the result stays stable across machines.
    mkdirSync(resolvedOutDir, { recursive: true });
    const stagedRoot = join(work, "staged");
    mkdirSync(stagedRoot, { recursive: true });
    const stagedTree = join(stagedRoot, name);
    renameSync(treeDir, stagedTree);
    for (const rel of excluded) {
      rmSync(join(stagedTree, rel), { force: true });
    }
    // Directories emptied by the prune would otherwise ship as bare entries.
    execFileSync("find", [name, "-type", "d", "-empty", "-delete"], { cwd: stagedRoot });
    rmSync(zipPath, { force: true });
    // -D omits directory entries, matching what `git archive` produced, so the archive listing is
    // exactly the file set the manifest counts. -X drops extra filesystem attributes.
    execFileSync("zip", ["-XDqr", zipPath, name], { cwd: stagedRoot });
    const zipBytes = readFileSync(zipPath);

    const sha256 = createHash("sha256").update(zipBytes).digest("hex");
    const manifest = {
      schema: "retentionlab-code-zip-manifest.v1",
      archive_name: `${name}.zip`,
      source_commit: commit,
      file_count: shipped.length,
      tracked_file_count: relPaths.length,
      excluded_tooling: excluded,
      byte_size: statSync(zipPath).size,
      sha256,
      secret_scan: "clean",
      deny_list: "clean",
      required_files_present: REQUIRED_FILES,
      note: "Built from the tracked tree at source_commit; git-ignored artefacts and secrets are excluded by construction and re-verified above. The paths in excluded_tooling are agent tooling and stale build output, removed from the archive only — they remain in the public repository. The AI usage log and QA evidence are deliberately retained, because the brief requires AI contributions to be cited and the submission document references that log by name.",
    };
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    return { manifest, zipPath, manifestPath };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  const refArg = process.argv.find((arg) => arg.startsWith("--ref="));
  const ref = refArg ? refArg.slice("--ref=".length) : "HEAD";
  try {
    const { manifest, zipPath, manifestPath } = packageCodeZip({ ref });
    process.stdout.write(
      [
        "Code ZIP verified and written.",
        `  archive:  ${zipPath}`,
        `  manifest: ${manifestPath}`,
        `  commit:   ${manifest.source_commit}`,
        `  files:    ${manifest.file_count}`,
        `  bytes:    ${manifest.byte_size}`,
        `  sha256:   ${manifest.sha256}`,
        "  secrets:  clean",
        "",
      ].join("\n"),
    );
  } catch (error) {
    process.stderr.write(`\nCode ZIP packaging FAILED (fail-closed):\n${error.message}\n`);
    process.exitCode = 1;
  }
}
