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
