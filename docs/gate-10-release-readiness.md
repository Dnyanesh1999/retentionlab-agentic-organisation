# Gate 10 — release readiness and submission traceability

This document maps the final-project brief (H9CEAI, *Build an Agentic Organisation*)
to concrete, checkable evidence in this repository. It records what the automated
release slice **proves locally**, and — honestly — what remains a **manual/external**
step that only the student can complete (public deployment, live-connection proof,
and the independently authored reflection). Nothing here fabricates live evidence.

## How to run the release checks

```bash
npm run test:release     # secret-scanner + static responsive/routing invariants (node --test)
npm test                 # full Vitest suite incl. whole-app accessibility sweep
npm run typecheck
npm run lint
npm run build            # Vite production build
npm run release:pages    # hardens dist/ for Pages (.nojekyll, 404.html) + JS budget
npm run release:scan     # repo-wide secret scan (fail-closed)
npm run release:zip      # verified, secret-free complete-codebase ZIP
npm run release:check    # consolidated report -> output/release/gate-10-release-checks.json
```

## Technical Requirements (pass/fail gates in the brief)

| Brief technical requirement | Status | Evidence |
|---|---|---|
| At least one agent connects to a live external source, queried at moment of use | Implemented; **live proof is external** | MCP evidence tools (`mcp/`), Gate 3–9 runtimes; live run recorded in `docs/qa-gate-9-live-pipeline-transcript.md`. Reachability of the deployed endpoints is a manual post-deploy step. |
| Synthetic data lives in a real queryable source, fetched dynamically | Implemented | Supabase schema + `scripts/generate-demo-data.mjs`; `docs/data-layer-gate-2.md`. |
| Submit a ZIP of the **complete** codebase | **Automated** | `npm run release:zip` builds a `git archive` ZIP (tracked files only) and verifies it. Manifest: `output/release/*.manifest.json`. |
| Dynamic access verified (not hardcoded/cached) | Implemented | Guard tests across Gates 3–9; assessed live run transcript (Gate 9). |
| Submit a GitHub Pages URL, reachable ≥8 weeks | **Manual / external — NOT complete** | Build is Pages-ready (`base: "./"`, hash routing, `.nojekyll`, `404.html`, workflow `.github/workflows/deploy-pages.yml`). Enabling Pages, deploying, and keeping it live is the student's action. |
| **Do not commit any secret/API key/credential** | **Automated** | `npm run release:scan` (repo) and the ZIP verifier both fail closed. Scanner: `scripts/release/secret-scan.mjs` (+ 10 unit tests). Server-only vars are named without values in `.env.example`. |

## What to Submit — document section readiness

The brief requires **one** submission document (Word/PDF/PowerPoint, 1,500–2,500 words)
with five sections plus the code ZIP. This repo supplies grounded source material for
each section; the student assembles and writes the document.

| Required section (~words) | Source material in repo | Author |
|---|---|---|
| Your Organisation (~200) | `README.md`, `docs/architecture.md`, `docs/brief-compliance.md` | Student writes prose |
| Agent Designs (~500) | Five agent prompts/contracts under `agents/`; QA gates 4–8 | Student writes prose |
| The Pipeline in Action (~300 + evidence) | `docs/qa-gate-9-live-pipeline-transcript.md`, transcript JSON, `output/playwright/*` screenshots | Student writes prose + screenshots |
| GitHub Pages URL | Produced only after the student deploys (see manual steps) | Student |
| Regulatory & Ethical (~200) | Trust/consent design across agents; GDPR + EU AI Act treatment in QA docs | Student writes prose + current citations |
| Reflection (~300) | **Intentionally absent — must be the student's own words; brief forbids AI generation** | Student only |

## Automated quality dimensions (this slice)

- **Accessibility** — `src/app/releaseAccessibility.test.tsx` renders the whole `<App/>`
  across all public hash routes and asserts zero axe-core violations, plus a skip-link →
  `#main-content` landmark check. Colour contrast is excluded in jsdom (cannot compute
  painted contrast) and is verified manually in a real browser.
- **Security** — repo-wide and ZIP-wide secret scanning, fail-closed, with a deny-list of
  paths that must never ship (`.env`, `node_modules/`, `dist*/`, `*.pem`, …).
- **Responsive** — `scripts/release/static-audit.node-test.mjs` asserts the viewport meta,
  ≥3 CSS breakpoints incl. a phone-class one, and a `prefers-reduced-motion` block.
- **Performance** — `npm run release:pages` enforces a total-JS budget on `dist/`
  (currently ~437 KB vs a 1.2 MB ceiling) and flags regressions.

## Honest limitations (not completed by this slice)

1. **No deployment performed.** No push, no Pages publish, no Vercel/Supabase change. The
   Pages workflow is inert until the student enables Pages and pushes.
2. **Live-URL and live-connection reachability are unverified here.** They require the
   deployed environment and are the student's manual post-deploy checks.
3. **Colour-contrast and real-device responsive testing** are manual (documented in the
   Gate 6 QA slice); jsdom cannot substitute for a painted browser.
4. **The reflection is deliberately not written.** The brief requires the student's own,
   non-AI-generated words.
5. The ZIP reflects the **committed** tree at `HEAD`; uncommitted working-tree edits are
   excluded by design. Commit before packaging the final submission ZIP.

## Manual / external steps to close Gate 10

1. Deploy: enable GitHub Pages (Source: GitHub Actions) and push, or run `npm run build`
   and publish `dist/` manually. Confirm the URL loads without login.
2. Confirm live Supabase/OpenRouter connections are reachable from the deployed app and
   plan to keep them live for ≥8 weeks after the deadline.
3. Do a real-browser accessibility + responsive pass (contrast, zoom, phone/tablet/desktop).
4. Package the final ZIP from the submission commit: `npm run release:zip`.
5. Write the reflection and assemble the single submission document with all five sections,
   citing every AI-generated passage (model + prompt) per the AI Usage Policy.
