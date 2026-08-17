// Generate the submission's AI-usage appendix from `docs/ai-usage-log.md`.
//
// The brief requires that all AI-generated content be cited — "which model, which prompts". The log
// has carried that since Entry 001, but as running prose: readable in the repository, not usable as
// an appendix a marker can scan. This script derives the appendix instead of anyone maintaining a
// second copy, so the two cannot drift.
//
// It invents nothing. Every value it emits is lifted verbatim from the log, and a field the log does
// not record is reported as a gap rather than filled in or quietly dropped. That is the same rule the
// pipeline applies to model output, applied to our own paperwork.
//
// Emits into output/release/:
//   - ai-usage-appendix.md   — the appendix to attach to the submission
//   - ai-usage-appendix.json — the same data structured, for anyone who wants to re-derive it
//
// Exit codes: 0 when every entry carries the three fields the brief actually demands (date, tool or
// model, and the prompt); 1 when one does not, or when the log cannot be parsed. Missing narrative
// fields (contribution, verification) are reported in the appendix's own completeness section and do
// not fail the build — they are a disclosure, not a defect.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..");
const LOG_PATH = join(REPO_ROOT, "docs", "ai-usage-log.md");
const OUT_DIR = join(REPO_ROOT, "output", "release");

/** The three the brief names explicitly. An entry missing one of these is not a citation. */
const REQUIRED_FIELDS = ["date", "tools", "prompt"];

/** Log field labels, normalised. Both singular and plural spellings appear across the 44 entries. */
const FIELD_ALIASES = new Map([
  ["date", "date"],
  ["tool/model", "tools"],
  ["tools/models", "tools"],
  ["user prompt", "prompt"],
  ["ai contribution", "contribution"],
  ["student responsibility", "student"],
  ["verification", "verification"],
]);

const ENTRY_HEADING = /^## Entry (\d+)\s+—\s+(.+)$/;
const FIELD_LINE = /^- ([A-Za-z][^:]{0,80}):\s*(.*)$/;

/** Structural problems throw, so an importing caller can record them rather than losing the process. */
function fail(message) {
  throw new Error(`AI usage appendix: ${message}`);
}

/** Collapse a wrapped field back into one line. Log fields wrap at ~110 columns. */
function unwrap(lines) {
  return lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseLog(source) {
  const lines = source.split("\n");
  const entries = [];
  let current = null;
  let field = null;
  let buffer = [];

  const flushField = () => {
    if (!current || !field) return;
    const value = unwrap(buffer);
    // First writer wins: a label repeated inside one entry is prose, not a second citation.
    if (value && !(field.key in current.fields)) current.fields[field.key] = value;
    if (value && field.key === "other") current.notes.push(`${field.label}: ${value}`);
    field = null;
    buffer = [];
  };

  for (const line of lines) {
    const heading = ENTRY_HEADING.exec(line);
    if (heading) {
      flushField();
      current = { number: Number(heading[1]), title: heading[2].trim(), fields: {}, notes: [] };
      entries.push(current);
      continue;
    }
    if (!current) continue;

    // A new `## ` of any other kind ends the entry region.
    if (line.startsWith("## ")) {
      flushField();
      current = null;
      continue;
    }

    const fieldLine = FIELD_LINE.exec(line);
    if (fieldLine) {
      flushField();
      const label = fieldLine[1].trim();
      const key = FIELD_ALIASES.get(label.toLowerCase()) ?? "other";
      field = { key, label };
      buffer = [fieldLine[2]];
      continue;
    }

    if (field) buffer.push(line);
  }
  flushField();

  return entries;
}

/**
 * Repository paths share the `a/b` shape with OpenRouter model identifiers, so they must be excluded
 * or the roster fills with filenames. Exclusion is by path-ness — a known source extension, or a
 * top-level directory of this repository as the first segment — never by a list of expected models.
 * A model we have never seen still appears; `docs/qa-human-approval.md` does not.
 */
const PATH_EXTENSION = /\.(md|ts|tsx|js|mjs|cjs|json|sql|css|html|yml|yaml|sh|zip|txt)$/i;
const REPO_DIRECTORIES = new Set([
  "agents", "artifacts", "config", "design", "design-system", "dist", "docs", "mcp", "node_modules",
  "ops", "output", "public", "runtime", "scripts", "src", "supabase", "test", "tests",
]);

function looksLikeRepositoryPath(candidate) {
  if (PATH_EXTENSION.test(candidate)) return true;
  return REPO_DIRECTORIES.has(candidate.split("/")[0].toLowerCase());
}

/**
 * Shape test for an OpenRouter-style identifier. Path exclusion alone is not enough: this log
 * discusses its own field labels in backticks, so `Tool/model` and a placeholder like `a/b` were both
 * collected as models on the first run. A real identifier is lowercase by convention, has two
 * substantial segments, and carries a version digit or a hyphenated name in its model segment.
 *
 * This tests shape, not membership. A provider or model never seen before still qualifies.
 */
function looksLikeModelIdentifier(candidate) {
  if (candidate !== candidate.toLowerCase()) return false;
  const [provider, model] = candidate.split("/");
  if (!provider || !model || provider.length < 3 || model.length < 3) return false;
  return /\d/.test(model) || model.includes("-");
}

/**
 * Model identifiers written in backticks anywhere in the log — the exact strings, collected
 * mechanically rather than curated, so a model used in a single measurement still appears.
 */
function collectModelIdentifiers(source) {
  const found = new Set();
  for (const match of source.matchAll(/`([a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._:-]*)`/gi)) {
    const candidate = match[1];
    if (looksLikeRepositoryPath(candidate)) continue;
    if (!looksLikeModelIdentifier(candidate)) continue;
    found.add(candidate);
  }
  return [...found].sort();
}

function escapeCell(value) {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function truncate(value, limit) {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit - 1).trimEnd()}…`;
}

/**
 * Parse the log and write both appendix artefacts. Returns a summary for the caller to record.
 * Throws on a structural problem (unparseable, duplicate or non-contiguous entry numbers); reports a
 * missing required field through `required_fields_complete` rather than throwing, so the caller
 * decides whether that is fatal.
 */
export function buildAiUsageAppendix() {
  const source = readFileSync(LOG_PATH, "utf8");
  const entries = parseLog(source);

  if (entries.length === 0) fail(`no entries parsed from ${LOG_PATH}`);

  const numbers = entries.map((entry) => entry.number);
  const duplicates = numbers.filter((value, index) => numbers.indexOf(value) !== index);
  if (duplicates.length > 0) fail(`duplicate entry numbers: ${[...new Set(duplicates)].join(", ")}`);

  const sorted = [...entries].sort((a, b) => a.number - b.number);
  for (let index = 0; index < sorted.length; index += 1) {
    if (sorted[index].number !== index + 1) {
      fail(`entry numbering is not contiguous: expected ${index + 1}, found ${sorted[index].number}`);
    }
  }

  const missingRequired = sorted
    .map((entry) => ({ entry, missing: REQUIRED_FIELDS.filter((key) => !entry.fields[key]) }))
    .filter((row) => row.missing.length > 0);

  const missingNarrative = sorted
    .map((entry) => ({
      entry,
      missing: ["contribution", "verification"].filter((key) => !entry.fields[key]),
    }))
    .filter((row) => row.missing.length > 0);

  const modelIdentifiers = collectModelIdentifiers(source);
  const dates = sorted.map((entry) => entry.fields.date).filter(Boolean);
  const last = String(sorted.length).padStart(3, "0");

  const summaryRows = sorted.map((entry) => [
    String(entry.number).padStart(3, "0"),
    escapeCell(entry.title),
    escapeCell(entry.fields.date ?? "— not recorded"),
    escapeCell(truncate(entry.fields.tools ?? "— not recorded", 150)),
  ]);

  const markdown = [
    "# Appendix — AI usage citation record",
    "",
    "**Generated file. Do not edit.** Produced by `npm run release:ai-appendix` from",
    "`docs/ai-usage-log.md`, which is the source of truth. Every value below is lifted verbatim from",
    "that log; nothing here is summarised or inferred by a model, and a field the log does not record is",
    "shown as *not recorded* rather than filled in.",
    "",
    "## 1. At a glance",
    "",
    `- Entries: **${sorted.length}**, numbered 001–${last} with no gaps.`,
    `- Every entry records a date, the tool or model used, and the prompt that drove it: **${missingRequired.length === 0 ? "yes" : "no"}**.`,
    `- First entry: ${dates[0] ?? "— not recorded"}. Latest entry: ${dates[dates.length - 1] ?? "— not recorded"}.`,
    `- Distinct model identifiers named in the log: **${modelIdentifiers.length}** (§3).`,
    "",
    "Two families of assistant built this repository, and the log distinguishes them per entry: OpenAI",
    "Codex (GPT-5 family) for the earlier gates, and Claude Code (Opus) for the later ones. They are",
    "separate from the models the five agents call at run time, which appear as OpenRouter identifiers",
    "in §3.",
    "",
    "## 2. Entry index",
    "",
    "| # | Work | Date | Tool / model |",
    "| --- | --- | --- | --- |",
    ...summaryRows.map((row) => `| ${row.join(" | ")} |`),
    "",
    "## 3. Model identifiers named in the log",
    "",
    modelIdentifiers.length === 0
      ? "None recorded."
      : modelIdentifiers.map((id) => `- \`${id}\``).join("\n"),
    "",
    "Collected mechanically from the log rather than curated, so a model used in a single measurement",
    "still appears. Presence here means the identifier was named in a logged entry — read that entry for",
    "whether it was adopted, rejected or only measured. Repository paths share the `a/b` shape and are",
    "excluded by path-ness, never by a list of expected models.",
    "",
    "## 4. Completeness disclosure",
    "",
    missingRequired.length === 0
      ? "Every entry carries the three fields the brief names: a date, the tool or model, and the prompt."
      : [
          "**The following entries are missing a field the brief requires:**",
          "",
          ...missingRequired.map((row) => `- Entry ${String(row.entry.number).padStart(3, "0")} — missing: ${row.missing.join(", ")}`),
        ].join("\n"),
    "",
    missingNarrative.length === 0
      ? "Every entry also records an AI contribution and a verification result."
      : [
          "The following entries do not carry the optional narrative fields. They are disclosed rather than",
          "hidden; in each case the entry records that work in its own prose sections instead of the standard",
          "field labels.",
          "",
          ...missingNarrative.map((row) => `- Entry ${String(row.entry.number).padStart(3, "0")} (${row.entry.title}) — no ${row.missing.join(" or ")} field.`),
        ].join("\n"),
    "",
    "## 5. Full entries",
    "",
  ].join("\n");

  const detail = sorted
    .map((entry) => {
      const parts = [
        `### Entry ${String(entry.number).padStart(3, "0")} — ${entry.title}`,
        "",
        `**Date.** ${entry.fields.date ?? "*not recorded*"}`,
        "",
        `**Tool / model.** ${entry.fields.tools ?? "*not recorded*"}`,
        "",
        `**Prompt that drove the work.** ${entry.fields.prompt ?? "*not recorded*"}`,
        "",
        `**What the AI contributed.** ${entry.fields.contribution ?? "*not recorded as a field — see the entry in `docs/ai-usage-log.md`*"}`,
        "",
        `**Student responsibility.** ${entry.fields.student ?? "*not recorded*"}`,
        "",
        `**Verification.** ${entry.fields.verification ?? "*not recorded as a field — see the entry in `docs/ai-usage-log.md`*"}`,
      ];
      if (entry.notes.length > 0) {
        parts.push("", "**Additional notes recorded in this entry.**", "", ...entry.notes.map((note) => `- ${note}`));
      }
      return parts.join("\n");
    })
    .join("\n\n---\n\n");

  const payload = {
    schema: "retentionlab-ai-usage-appendix.v1",
    source: "docs/ai-usage-log.md",
    generator: "scripts/release/build-ai-usage-appendix.mjs",
    entry_count: sorted.length,
    required_fields_complete: missingRequired.length === 0,
    entries_missing_required: missingRequired.map((row) => ({ number: row.entry.number, missing: row.missing })),
    entries_missing_narrative: missingNarrative.map((row) => ({ number: row.entry.number, missing: row.missing })),
    model_identifiers: modelIdentifiers,
    entries: sorted.map((entry) => ({
      number: entry.number,
      title: entry.title,
      date: entry.fields.date ?? null,
      tools: entry.fields.tools ?? null,
      prompt: entry.fields.prompt ?? null,
      contribution: entry.fields.contribution ?? null,
      student_responsibility: entry.fields.student ?? null,
      verification: entry.fields.verification ?? null,
      additional_notes: entry.notes,
    })),
  };

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  const markdownPath = join(OUT_DIR, "ai-usage-appendix.md");
  const jsonPath = join(OUT_DIR, "ai-usage-appendix.json");
  writeFileSync(markdownPath, `${markdown}${detail}\n`, "utf8");
  writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  return { ...payload, markdown_path: markdownPath, json_path: jsonPath };
}

// CLI entry point. Imported by run-release-checks.mjs, which handles its own reporting.
if (process.argv[1] && process.argv[1].endsWith("build-ai-usage-appendix.mjs")) {
  try {
    const result = buildAiUsageAppendix();
    const last = String(result.entry_count).padStart(3, "0");
    process.stdout.write("AI usage appendix\n");
    process.stdout.write(`  entries:            ${result.entry_count} (001–${last}, contiguous)\n`);
    process.stdout.write(`  model identifiers:  ${result.model_identifiers.length}\n`);
    process.stdout.write(`  required complete:  ${result.required_fields_complete ? "yes" : `no — ${result.entries_missing_required.length} entry/entries`}\n`);
    if (result.entries_missing_narrative.length > 0) {
      const numbers = result.entries_missing_narrative.map((row) => String(row.number).padStart(3, "0")).join(", ");
      process.stdout.write(`  disclosed gaps:     ${numbers} (narrative fields, reported in the appendix)\n`);
    }
    process.stdout.write(`  written:            ${result.markdown_path.replace(`${REPO_ROOT}/`, "")}\n`);
    process.stdout.write(`                      ${result.json_path.replace(`${REPO_ROOT}/`, "")}\n`);
    if (!result.required_fields_complete) {
      process.stderr.write("\nAn entry is missing a field the brief requires. Fix docs/ai-usage-log.md.\n");
      process.exit(1);
    }
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
