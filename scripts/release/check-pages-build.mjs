// Verify a `vite build` output is GitHub Pages ready, then make it robust:
//   1. index.html exists and references assets with RELATIVE (`./`) paths, so
//      the app loads from a project subpath (username.github.io/repo/) as well
//      as a custom domain — this repo sets `base: "./"` in vite.config.ts.
//   2. No dev-only `/src/…` module reference leaked into the built HTML.
//   3. The favicon referenced by index.html is emitted.
//   4. A performance budget on the total emitted JavaScript.
// It then writes two Pages hygiene files into dist/:
//   - `.nojekyll` so GitHub Pages serves files/dirs beginning with `_`.
//   - `404.html` = a copy of index.html so any deep link falls back into the
//     hash-routed SPA instead of a Pages 404. (Hash routes already survive
//     reload; this covers a mistyped path segment before the '#'.)
//
// This does NOT deploy anything. It only validates and hardens local build
// output. Publishing remains a manual/CI step the student performs.

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..");
const DIST = join(REPO_ROOT, "dist");

// Total emitted JS budget (uncompressed). This app is a small hash-routed React
// SPA; a regression that balloons the bundle should surface here.
const JS_BUDGET_BYTES = 1_200_000;

function fail(message) {
  const error = new Error(message);
  error.isCheckFailure = true;
  throw error;
}

function listAllFiles(dir, base = dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listAllFiles(full, base));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

export function checkPagesBuild() {
  if (!existsSync(DIST)) {
    fail(`dist/ not found. Run "npm run build" before the Pages check.`);
  }

  const indexPath = join(DIST, "index.html");
  if (!existsSync(indexPath)) fail("dist/index.html is missing.");
  const html = readFileSync(indexPath, "utf8");

  // (1) relative asset base
  const assetRefs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  const rootAbsolute = assetRefs.filter(
    (ref) => ref.startsWith("/") && !ref.startsWith("//"),
  );
  if (rootAbsolute.length > 0) {
    fail(
      `index.html references root-absolute asset paths (breaks a project subpath on Pages): ${rootAbsolute.join(", ")}`,
    );
  }

  // (2) no dev module reference
  if (/["']\.?\/?src\/main\.tsx["']/.test(html) || /\/src\//.test(html)) {
    fail("index.html still references dev-only /src/ modules — build did not bundle.");
  }

  // (3) favicon emitted
  const favicon = assetRefs.find((ref) => /favicon/i.test(ref));
  if (favicon) {
    const faviconPath = join(DIST, favicon.replace(/^\.?\//, ""));
    if (!existsSync(faviconPath)) fail(`Referenced favicon "${favicon}" was not emitted to dist/.`);
  }

  // (4) JS budget
  const allFiles = listAllFiles(DIST);
  const jsBytes = allFiles
    .filter((file) => file.endsWith(".js"))
    .reduce((total, file) => total + statSync(file).size, 0);
  if (jsBytes > JS_BUDGET_BYTES) {
    fail(`Emitted JS ${jsBytes} bytes exceeds budget ${JS_BUDGET_BYTES} bytes.`);
  }

  // Harden for Pages.
  writeFileSync(join(DIST, ".nojekyll"), "");
  copyFileSync(indexPath, join(DIST, "404.html"));

  return {
    ok: true,
    index_html: true,
    relative_asset_base: true,
    favicon_emitted: Boolean(favicon),
    js_bytes: jsBytes,
    js_budget_bytes: JS_BUDGET_BYTES,
    nojekyll_written: true,
    spa_404_fallback_written: true,
    file_count: allFiles.length,
  };
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  try {
    const report = checkPagesBuild();
    process.stdout.write(
      [
        "GitHub Pages build check passed.",
        `  relative asset base: yes`,
        `  favicon emitted:     ${report.favicon_emitted ? "yes" : "n/a"}`,
        `  emitted JS:          ${report.js_bytes} / ${report.js_budget_bytes} bytes`,
        `  .nojekyll written:   yes`,
        `  404.html fallback:   yes`,
        "",
      ].join("\n"),
    );
  } catch (error) {
    process.stderr.write(`\nGitHub Pages build check FAILED:\n${error.message}\n`);
    process.exitCode = 1;
  }
}
