// One command that runs the automatable Gate 10 release checks and writes a
// consolidated evidence report. It fails closed: any hard check that fails sets
// a non-zero exit code.
//
// Scope (honest boundaries):
//   - Runs: repository secret scan, verified code-ZIP packaging, and — if a
//     build exists in dist/ — the GitHub Pages build check.
//   - Does NOT run: the Vitest/typecheck/lint/build suite (drive those via
//     their own npm scripts) or any deploy. It does NOT contact GitHub,
//     Vercel or Supabase, and it makes no claim about live-URL reachability.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { scanRepository } from "./scan-repo.mjs";
import { packageCodeZip } from "./package-code-zip.mjs";
import { checkPagesBuild } from "./check-pages-build.mjs";
import { buildAiUsageAppendix } from "./build-ai-usage-appendix.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..");
const OUT_DIR = join(REPO_ROOT, "output", "release");

const results = [];
let hardFailure = false;

function record(name, status, detail) {
  results.push({ check: name, status, detail });
  const glyph = status === "pass" ? "✓" : status === "skip" ? "–" : "✗";
  process.stdout.write(`  ${glyph} ${name}: ${detail}\n`);
  if (status === "fail") hardFailure = true;
}

process.stdout.write("Gate 10 release checks\n");

// 1. Repository secret scan (security gate).
try {
  const { fileCount, findings } = scanRepository();
  if (findings.length === 0) {
    record("secret-scan-repo", "pass", `clean across ${fileCount} tracked files`);
  } else {
    record("secret-scan-repo", "fail", `${findings.length} finding(s) — run npm run release:scan`);
  }
} catch (error) {
  record("secret-scan-repo", "fail", error.message);
}

// 2. Verified code ZIP (secret-free complete-codebase artefact).
let zipManifest = null;
try {
  const { manifest } = packageCodeZip();
  zipManifest = manifest;
  record(
    "code-zip",
    "pass",
    `${manifest.file_count} files, ${manifest.byte_size} bytes, sha256 ${manifest.sha256.slice(0, 12)}…`,
  );
} catch (error) {
  record("code-zip", "fail", error.message.split("\n")[0]);
}

// 3. Pages build check (only if a build exists; skipped otherwise).
let pagesReport = null;
if (existsSync(join(REPO_ROOT, "dist", "index.html"))) {
  try {
    pagesReport = checkPagesBuild();
    record(
      "pages-build",
      "pass",
      `relative base, JS ${pagesReport.js_bytes}/${pagesReport.js_budget_bytes} bytes, 404 fallback written`,
    );
  } catch (error) {
    record("pages-build", "fail", error.message.split("\n")[0]);
  }
} else {
  record("pages-build", "skip", "no dist/ — run `npm run build` then `npm run release:pages`");
}

// 4. AI-usage appendix. The brief requires every AI contribution to be cited with its model and
//    prompt; this regenerates that appendix from docs/ai-usage-log.md so the submission copy cannot
//    drift from the log. It fails only if an entry lacks a field the brief actually demands.
let appendixReport = null;
try {
  const appendix = buildAiUsageAppendix();
  appendixReport = {
    entry_count: appendix.entry_count,
    required_fields_complete: appendix.required_fields_complete,
    model_identifiers: appendix.model_identifiers,
    entries_missing_required: appendix.entries_missing_required,
    entries_missing_narrative: appendix.entries_missing_narrative,
  };
  const gaps = appendix.entries_missing_narrative.length;
  record(
    "ai-usage-appendix",
    appendix.required_fields_complete ? "pass" : "fail",
    appendix.required_fields_complete
      ? `${appendix.entry_count} entries cited, ${appendix.model_identifiers.length} model identifiers` +
        (gaps > 0 ? `, ${gaps} narrative gap(s) disclosed` : "")
      : `${appendix.entries_missing_required.length} entr(y/ies) missing a required citation field`,
  );
} catch (error) {
  record("ai-usage-appendix", "fail", error.message.split("\n")[0]);
}

const report = {
  schema: "retentionlab-gate-10-release-checks.v1",
  checks: results,
  code_zip: zipManifest,
  pages_build: pagesReport,
  ai_usage_appendix: appendixReport,
  not_covered_here: [
    "vitest/typecheck/lint/build (run their own npm scripts)",
    "live GitHub Pages URL reachability",
    "live Supabase / OpenRouter connectivity",
  ],
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, "gate-10-release-checks.json"), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`\nReport written to output/release/gate-10-release-checks.json\n`);

if (hardFailure) {
  process.stderr.write("\nOne or more release checks FAILED.\n");
  process.exitCode = 1;
}
