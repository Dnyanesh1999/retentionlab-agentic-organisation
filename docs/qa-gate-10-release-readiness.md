# QA — Gate 10 release-readiness slice

Scope: a **local** release-readiness slice. It adds auditable, fail-closed release
tooling and evidence but performs **no deployment** and asserts **no live-URL or
live-connection** status. External/live gates and the student reflection remain open.

## What was added

| Area | Artefact | Test evidence |
|---|---|---|
| Secret scanning (shared) | `scripts/release/secret-scan.mjs` | `scripts/release/secret-scan.node-test.mjs` (9 tests) |
| Repo secret audit | `scripts/release/scan-repo.mjs` (`npm run release:scan`) | clean across 228 tracked files |
| Verified code ZIP | `scripts/release/package-code-zip.mjs` (`npm run release:zip`) | deny-list + secret scan + required-files, fail-closed; manifest w/ sha256 |
| Pages build hardening | `scripts/release/check-pages-build.mjs` (`npm run release:pages`) | relative base, favicon, JS budget; writes `.nojekyll` + `404.html` |
| Responsive/routing source audit | `scripts/release/static-audit.node-test.mjs` | 6 tests (viewport, breakpoints, reduced-motion, base, skip link) |
| Whole-app accessibility | `src/app/releaseAccessibility.test.tsx` | 4 tests — zero axe violations across `/cases/organisation`, `/portfolio`, `/governance` |
| Consolidated report | `scripts/release/run-release-checks.mjs` (`npm run release:check`) | `output/release/gate-10-release-checks.json` |
| Pages CI (inert) | `.github/workflows/deploy-pages.yml` | config only; runs when the student enables Pages |
| Traceability | `docs/gate-10-release-readiness.md` | brief → evidence map |

## Runs performed (this slice)

- `npm run test:release` → 15 tests pass (secret-scan 9, static-audit 6).
- `npm test` → 44 files, 256 tests pass (incl. the new whole-app accessibility sweep).
- `npm run typecheck` → clean. `npm run lint` → clean.
- `npm run build` → success; emitted JS ≈ 437 KB (budget 1.2 MB).
- `npm run release:check` → all three checks pass; report written.
- Fail-closed verified: a planted `sk-or-…` value is caught by the scanner; an empty
  `.env.example` slot is not flagged.

## Determinism & safety notes

- The ZIP is produced with `git archive HEAD`, so it contains only tracked files and is
  byte-stable per commit; git-ignored artefacts (`node_modules/`, `dist*/`, `.env`) are
  excluded by construction and re-verified by the deny-list.
- The scanner redacts every match it reports, so logs never re-leak a value.
- No live model or Supabase call is made by any release script.

## Post-slice deployment evidence

- GitHub Actions run `31229961659` completed both build and deploy jobs successfully on
  8 August 2026.
- Public URL: `https://dnyanesh1999.github.io/retentionlab-agentic-organisation/`.
- Browser verification against the deployed Organisation route found the correct heading,
  exactly five agent nodes, the 14-event immutable-snapshot notice, no stale foundation copy,
  and no horizontal overflow at desktop width.
- Deployed interactions verified: Communicator failure/retry recovery, Manager governance,
  and the deterministic evidence-chain answer in the read-only Manager dock.

## Still open (external / manual — not marked complete)

- ≥8-week public and live-connection reachability monitoring.
- Live Supabase/OpenRouter connection reachability from the deployed app.
- Real-browser colour-contrast and multi-device responsive verification.
- Student-authored reflection and final single submission document assembly.
