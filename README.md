# RetentionLab

RetentionLab is a consent-first, five-agent customer-retention organisation for fictional B2B SaaS accounts. It is being built for the H9CEAI Final Project: Build an Agentic Organisation.

The assessed pipeline is fixed and unbroken:

`Researcher → Designer → Maker → Communicator → Manager`

## Delivery status

- Gate 0 — compliance and architecture: complete
- Gate 1 — application shell and design system: complete
- Gate 2 — live Supabase data: complete
- Gate 3 — MCP evidence tools: complete
- Gates 4–8 — five agents, implemented in order: pending
- Gate 9 — orchestration and revisions: pending
- Gate 10 — deployment and assessment evidence: pending

No interface state may be described as live until the runtime Supabase query and MCP tool path have been implemented and verified.

## Planned deployment

- Public application: GitHub Pages
- Server-side API and MCP endpoint: Vercel Functions
- Live queryable synthetic data: Supabase Postgres
- LLM gateway: OpenRouter, called only from the server

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

### Deploying to GitHub Pages (manual)

The build is Pages-ready: `vite.config.ts` sets `base: "./"`, the app is hash-routed, and
`npm run release:pages` emits `.nojekyll` and a `404.html` SPA fallback into `dist/`.

1. In the repository: **Settings → Pages → Source: GitHub Actions**.
2. Push to `main` (or run the **Deploy to GitHub Pages** workflow manually). The included
   `.github/workflows/deploy-pages.yml` builds and publishes `dist/`.
3. To make the live Supabase gateway reachable from the public page, set the browser-safe
   `VITE_*` values as repository **Variables** (never Secrets). With none set, the app still
   deploys and renders its non-live shell.

Full brief-to-evidence traceability and the honest list of remaining external/manual steps
are in `docs/gate-10-release-readiness.md`.
