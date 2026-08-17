// The appendix is a citation record submitted for assessment, so the properties worth testing are
// honesty properties: it must cover every entry, must not invent a field the log does not carry, and
// must not silently drop one. A cosmetic regression in the markdown matters far less than an entry
// quietly vanishing from the index.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildAiUsageAppendix } from "./build-ai-usage-appendix.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..");
const LOG_PATH = join(REPO_ROOT, "docs", "ai-usage-log.md");

const result = buildAiUsageAppendix();
const markdown = readFileSync(result.markdown_path, "utf8");
const log = readFileSync(LOG_PATH, "utf8");

test("covers every entry heading in the log", () => {
  const headings = [...log.matchAll(/^## Entry (\d+)\s+—/gm)].map((match) => Number(match[1]));

  assert.equal(result.entry_count, headings.length);
  assert.deepEqual(
    result.entries.map((entry) => entry.number),
    headings.sort((a, b) => a - b),
  );
});

test("numbers the entries contiguously from 1", () => {
  result.entries.forEach((entry, index) => {
    assert.equal(entry.number, index + 1, `entry at position ${index} is numbered ${entry.number}`);
  });
});

test("every entry carries the three fields the brief requires", () => {
  assert.equal(result.required_fields_complete, true);
  assert.deepEqual(result.entries_missing_required, []);

  for (const entry of result.entries) {
    assert.ok(entry.date, `entry ${entry.number} has no date`);
    assert.ok(entry.tools, `entry ${entry.number} names no tool or model`);
    assert.ok(entry.prompt, `entry ${entry.number} records no prompt`);
  }
});

test("reports a narrative gap rather than hiding it", () => {
  // Entry 039 records its work in prose sections instead of the standard field labels. The appendix
  // must say so out loud; a future entry that drops a field must surface the same way.
  for (const gap of result.entries_missing_narrative) {
    const label = `Entry ${String(gap.number).padStart(3, "0")}`;
    assert.ok(
      markdown.includes(`- ${label} (`),
      `${label} has a missing narrative field but is not disclosed in the appendix`,
    );
  }
});

test("never invents a value the log does not carry", () => {
  for (const entry of result.entries) {
    for (const key of ["contribution", "verification", "student_responsibility"]) {
      if (entry[key] === null) continue;
      assert.ok(entry[key].length > 0, `entry ${entry.number} has an empty ${key}`);
    }
  }
  // A field the log omits must reach the markdown as an explicit "not recorded", never as blank.
  assert.ok(!/\*\*Verification\.\*\*\s*\n/.test(markdown), "an empty Verification block was emitted");
  assert.ok(!/\*\*Date\.\*\*\s*\n/.test(markdown), "an empty Date block was emitted");
});

test("lists model identifiers and excludes repository paths", () => {
  assert.ok(result.model_identifiers.length > 0);

  for (const identifier of result.model_identifiers) {
    assert.ok(identifier.includes("/"), `${identifier} is not provider/model shaped`);
    assert.ok(!/\.(md|ts|tsx|mjs|json|sql|css|html|yml)$/i.test(identifier), `${identifier} is a file path`);
    assert.ok(log.includes(`\`${identifier}\``), `${identifier} does not appear in the log`);
  }

  // The worker model is the one identifier the pipeline actually runs on, so its absence would mean
  // the collector had stopped working.
  assert.ok(result.model_identifiers.includes("nvidia/nemotron-3-super-120b-a12b:free"));
  assert.ok(!result.model_identifiers.some((id) => id.startsWith("docs/")));
});

test("does not mistake a backticked field label for a model", () => {
  // This log discusses its own field labels in backticks, and the first version of the collector
  // reported `Tool/model` and `Tools/models` as models. Path exclusion alone did not catch them.
  for (const notAModel of ["Tool/model", "Tools/models", "a/b", "provider/x"]) {
    assert.ok(
      !result.model_identifiers.includes(notAModel),
      `${notAModel} was collected as a model identifier`,
    );
  }

  for (const identifier of result.model_identifiers) {
    assert.equal(identifier, identifier.toLowerCase(), `${identifier} is not lowercase`);
    const [provider, model] = identifier.split("/");
    assert.ok(provider.length >= 3 && model.length >= 3, `${identifier} has a stub segment`);
  }
});

test("keeps every prompt on a single line so the index table cannot break", () => {
  for (const entry of result.entries) {
    assert.ok(!entry.prompt.includes("\n"), `entry ${entry.number} has a multi-line prompt`);
    assert.ok(!entry.tools.includes("\n"), `entry ${entry.number} has a multi-line tool field`);
  }
});
