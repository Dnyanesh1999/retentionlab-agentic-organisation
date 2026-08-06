// Repository-level secret audit. Scans every git-tracked file's content with
// the shared scanner and fails closed on any finding. This is the "no committed
// credentials" gate applied to the live working tree (the ZIP packager applies
// the same scanner to the archived bytes).

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { scanEntries } from "./secret-scan.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..");

export function scanRepository() {
  const listed = execFileSync("git", ["ls-files", "-z"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  const paths = listed.split("\0").filter(Boolean);
  const entries = [];
  for (const path of paths) {
    let content;
    try {
      content = readFileSync(join(REPO_ROOT, path), "utf8");
    } catch {
      continue; // unreadable/binary as utf8 — the scanner skips binaries anyway
    }
    entries.push({ path, content });
  }
  return { fileCount: entries.length, findings: scanEntries(entries) };
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  const { fileCount, findings } = scanRepository();
  if (findings.length > 0) {
    process.stderr.write(`Repository secret scan FAILED — ${findings.length} finding(s):\n`);
    for (const f of findings) {
      process.stderr.write(`  ${f.path}:${f.line} [${f.rule}] ${f.redacted}\n`);
    }
    process.exitCode = 1;
  } else {
    process.stdout.write(`Repository secret scan clean across ${fileCount} tracked file(s).\n`);
  }
}
