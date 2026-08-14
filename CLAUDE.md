# RetentionLab — Claude Code instructions

Read `docs/claude-handoff.md` before changing this repository. It is the current handoff and source of
truth for live state, verified production evidence, remaining work and operational hazards.

## Non-negotiable product rules

- Preserve exactly five agents in order: Researcher → Designer → Maker → Communicator → Manager.
- Never invent live data, progress, lineage, tests, consent or completed external actions.
- Full artefacts stay private; the browser receives only bounded public events and summaries.
- Every downstream artefact must verify the exact SHA-256 predecessor stored for the same run/account.
- Human approval is mandatory. Autonomous customer communication and all other external actions remain
  disabled unless a future authenticated human-approval feature explicitly authorises one bounded step.
- Fail closed on invalid schemas, evidence, lineage, leases, permissions or model output.
- Preserve append-only failure history. Retry only the failed stage from its last sealed checkpoint.
- Use synthetic demo accounts only. Never add real customer data or credentials.

## Engineering rules

- Keep the practical Casebook/Control Room design system: Bricolage Grotesque + Manrope, warm neutral
  surfaces, forest accents, concise styled content, restrained meaningful motion and reduced-motion parity.
- Avoid generic dashboards, dense text walls, decorative complexity, fake timers and non-functional tabs.
- Build feature by feature with tests. Do not rewrite unrelated user work.
- Use `apply_patch` for hand edits. Use `rg`/`rg --files` for discovery.
- Never print, commit or expose `.env.local` values. Browser code may use only `VITE_*` publishable values.
- Run Deno worker checks with `--no-lock`; do not commit a generated nested function lockfile.
- Do not run `supabase db push` blindly. Read the migration warning in the handoff first.

## Required verification before publication

```bash
npm test -- --run
npm run typecheck
npm run agent:pipeline:check
npm run lint
npm run build
npm run test:release
npm run test:data
npm run release:scan
```

Run the five hosted worker tests and the final tracked-commit `npm run release:check` exactly as described
in `docs/claude-handoff.md`. Update `docs/ai-usage-log.md` and relevant QA evidence for material work.
