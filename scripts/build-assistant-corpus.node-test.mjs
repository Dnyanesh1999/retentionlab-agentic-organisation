import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const corpusPath = join(root, "supabase", "functions", "retentionlab-assistant", "corpus.json");

function committedCorpus() {
  return JSON.parse(readFileSync(corpusPath, "utf8"));
}

test("the committed corpus matches what the generator produces", () => {
  const before = readFileSync(corpusPath, "utf8");
  execFileSync(process.execPath, [join(here, "build-assistant-corpus.mjs")], { cwd: root });
  const after = readFileSync(corpusPath, "utf8");

  // The Edge Function ships the committed file. If an artefact changes and the
  // corpus is not regenerated, the assistant would answer from a stale record
  // while claiming to quote the current one.
  assert.equal(after, before, "corpus.json is stale — run `npm run assistant:corpus`");
});

test("no chunk carries a full digest the model could quote back", () => {
  for (const chunk of committedCorpus().chunks) {
    assert.doesNotMatch(chunk.text, /[0-9a-f]{64}/i, `chunk ${chunk.id} contains a digest`);
  }
});

test("no chunk rendered a missing value into its prose", () => {
  // A mistyped field path yields the literal string "undefined", which the
  // model would faithfully quote as though it were a fact from the record.
  for (const chunk of committedCorpus().chunks) {
    assert.doesNotMatch(chunk.text, /\bundefined\b|\bnull\b|\bNaN\b/, `chunk ${chunk.id} has a missing value`);
  }
});

test("every chunk is citable: it has an id, a source and real text", () => {
  const seen = new Set();
  for (const chunk of committedCorpus().chunks) {
    assert.ok(chunk.id, "chunk is missing an id");
    assert.ok(!seen.has(chunk.id), `duplicate chunk id ${chunk.id}`);
    seen.add(chunk.id);
    assert.ok(chunk.source && chunk.source.length > 0, `chunk ${chunk.id} has no source`);
    assert.ok(chunk.text.length > 40, `chunk ${chunk.id} is too thin to cite`);
    assert.ok(Array.isArray(chunk.keywords) && chunk.keywords.length > 0, `chunk ${chunk.id} has no keywords`);
  }
});

test("the corpus states the governance facts the project must never contradict", () => {
  const text = committedCorpus().chunks.map((chunk) => chunk.text).join(" ");

  assert.match(text, /Autonomous external actions: false/);
  assert.match(text, /Human approval required: true/);
  assert.match(text, /exactly five bounded agents/);
});
