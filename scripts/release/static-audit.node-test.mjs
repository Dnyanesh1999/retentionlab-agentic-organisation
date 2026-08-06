// Source-level release invariants for the responsive and Pages-routing gates.
// These assert properties of committed source (not build output), so they run
// in the normal test suite without a build step.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..");

const read = (rel) => readFileSync(join(REPO_ROOT, rel), "utf8");

test("index.html declares a responsive viewport", () => {
  const html = read("index.html");
  assert.match(html, /<meta[^>]+name="viewport"[^>]+width=device-width/);
});

test("index.html uses a relative favicon path for GitHub Pages subpaths", () => {
  const html = read("index.html");
  assert.match(html, /href="\.\/favicon\.svg"/);
});

test("vite is configured with a relative base so Pages project subpaths resolve", () => {
  const config = read("vite.config.ts");
  assert.match(config, /base:\s*["']\.\/["']/);
});

test("global stylesheet defines multiple responsive breakpoints", () => {
  const css = read("src/styles/global.css");
  const breakpoints = [...css.matchAll(/@media\s*\(max-width:\s*(\d+)px\)/g)].map((m) =>
    Number(m[1]),
  );
  const unique = [...new Set(breakpoints)];
  assert.ok(unique.length >= 3, `expected >=3 breakpoints, found ${unique.length}`);
  // A phone-class breakpoint must exist for the responsive gate.
  assert.ok(Math.min(...unique) <= 480, "expected a phone-class (<=480px) breakpoint");
});

test("global stylesheet honours prefers-reduced-motion", () => {
  const css = read("src/styles/global.css");
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

test("app shell exposes a skip-to-content link", () => {
  const app = read("src/app/App.tsx");
  assert.match(app, /skip-link/);
  assert.match(app, /#main-content/);
});
