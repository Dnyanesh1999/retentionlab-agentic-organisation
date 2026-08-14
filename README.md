# RetentionLab

RetentionLab is a consent-first, five-agent customer-retention organisation for fictional B2B SaaS accounts. It is being built for the H9CEAI Final Project: Build an Agentic Organisation.

The assessed pipeline is fixed and unbroken:

`Researcher → Designer → Maker → Communicator → Manager`

## Delivery status

- Gate 0 — compliance and architecture: complete
- Gate 1 — application shell and design system: complete
- Gate 2 — live Supabase data: complete
- Gate 3 — MCP evidence tools: complete
- Gates 4–8 — five agents, implemented and live-validated in order: complete
- Gate 9 — crash-safe orchestration and accepted cumulative transcript: complete
- Gate 10 — release readiness and public GitHub Pages deployment: complete; student submission remains open

No interface state may be described as live until the runtime Supabase query and MCP tool path have been implemented and verified.

## Deployment

- Public application: https://dnyanesh1999.github.io/retentionlab-agentic-organisation/
- Public evidence/clarification gateway: Supabase Edge Functions, called directly by the Pages app
- Server runtimes: Researcher is deployed as a protected Supabase Edge worker; Designer through Manager and the complete assessed orchestrator remain local server processes
- Live queryable synthetic data: Supabase Postgres
- LLM gateway: OpenRouter, called only from the server runtimes

## Local development

```bash
npm install
npm run dev
```

Quality gate:

```bash
npm run test:data
npm test
npm run typecheck
npm run lint
npm run build
npm audit --audit-level=moderate
```

Gate 2 database design and live-proof criteria are documented in `docs/data-layer-gate-2.md`. Server-only Supabase variables are listed without values in `.env.example`.

Gate 3 adds an official MCP v2 stdio server with seven read-only evidence tools. Build and run its live protocol proof with:

```bash
npm run mcp:build
npm run mcp:smoke
```

The application uses browser-native hash navigation rather than a routing package. This keeps GitHub Pages deep links while avoiding server/RSC functionality and the associated dependency advisories.

## Deployment configuration preflight

Fail-closed, offline check that the complete runtime environment (server Supabase/OpenRouter
variables and the browser-safe `VITE_*` gateway values) is present and well-shaped before the
live path is deployed. It contacts no network and never prints a secret.

```bash
npm run preflight        # server scope (default) — the hard gate for the live path
npm run preflight:all    # server + browser (VITE_*) variables
```

Full matrix, secret-safety guarantees and the remaining manual remote steps are documented in
`docs/ops-deployment-preflight.md`.

## Release readiness (Gate 10)

Local, fail-closed release checks. None of these deploy or contact live services.

```bash
npm run test:release   # secret-scanner unit tests + static responsive/routing audit
npm run release:scan   # repo-wide secret scan (fails closed on any credential)
npm run build          # Vite production build
npm run release:pages  # harden dist/ for Pages (.nojekyll, 404.html) + JS budget check
npm run release:zip    # verified, secret-free complete-codebase ZIP -> output/release/
npm run release:check  # runs scan + zip + pages and writes a consolidated JSON report
```

The verified ZIP is built from `git archive HEAD`, so it contains only tracked files and is
byte-stable per commit. Commit before packaging the final submission ZIP.

### GitHub Pages

The public Pages application is deployed from `main`. `vite.config.ts` sets `base: "./"`,
the app is hash-routed, and `npm run release:pages` emits `.nojekyll` and a `404.html`
SPA fallback into `dist/`.

1. In the repository: **Settings → Pages → Source: GitHub Actions**.
2. Push to `main` (or run the **Deploy to GitHub Pages** workflow manually). The included
   `.github/workflows/deploy-pages.yml` builds and publishes `dist/`.
3. To make the live Supabase gateway reachable from the public page, set the browser-safe
   `VITE_*` values as repository **Variables** (never Secrets). With none set, the app still
   deploys and renders its non-live shell.

Full brief-to-evidence traceability and the honest list of remaining external/manual steps
are in `docs/gate-10-release-readiness.md`. The latest point-in-time live service proof is
recorded in `docs/qa-gate-10-live-reachability.md`.

## Learn and present the project

The current public journey is deliberately small:

- `#/control-room` — live synthetic account selection, governed run launch and event-driven Researcher execution;
- `#/portfolio` — assessed case archive and entry point;
- `#/cases/overview` — the Copper Finch case, four functional tabs, five inline specialist evidence briefs and the sealed-record case assistant;
- `#/cases/recovery-room` — the live Signal Garden reached from the Experience tab.

The full system explanation, website guide, five-minute demonstration script, viva answers,
limitations and next-step roadmap are in `docs/project-handbook.md`.
