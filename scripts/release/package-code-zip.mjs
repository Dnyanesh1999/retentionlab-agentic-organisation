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
import { mkdtempSync, readFileSync, rmSync, mkdirSync, writeFileSync, statSync } from "node:fs";
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
  execFileSync("sh", ["-c", `git archive --format=tar ${ref} > ${JSON.stringify(tarPath)}`], {
    cwd: REPO_ROOT,
  });
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
  const name = buildArchiveName(ref);
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

    // (3) required files
    const missing = REQUIRED_FILES.filter((required) => !relPaths.includes(required));
    if (missing.length > 0) {
      throw new Error(`Archive is missing required files: ${missing.join(", ")}`);
    }

    // Produce the verified ZIP deterministically from the same ref.
    mkdirSync(resolvedOutDir, { recursive: true });
    execFileSync(
      "sh",
      [
        "-c",
        `git archive --format=zip --prefix=${name}/ ${ref} > ${JSON.stringify(zipPath)}`,
      ],
      { cwd: REPO_ROOT },
    );

    const zipBytes = readFileSync(zipPath);
    const sha256 = createHash("sha256").update(zipBytes).digest("hex");
    const manifest = {
      schema: "retentionlab-code-zip-manifest.v1",
      archive_name: `${name}.zip`,
      source_commit: commit,
      file_count: relPaths.length,
      byte_size: statSync(zipPath).size,
      sha256,
      secret_scan: "clean",
      deny_list: "clean",
      required_files_present: REQUIRED_FILES,
      note: "git archive includes only tracked files at source_commit; git-ignored artefacts and secrets are excluded by construction and re-verified above.",
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
