# Operational runbook — deployment configuration preflight

This runbook covers the **deployment configuration preflight**: a single, fail-closed,
offline check that verifies the runtime environment the RetentionLab live path needs before
it is brought up. It closes the engineering side of the Gate 10 item *"Live Supabase
connections are reachable"* by giving the operator a repeatable readiness gate for the
**configuration** half — the half that can be proven locally and in CI without a deploy.

## Topology this preflight assumes (as currently implemented)

- The **MCP evidence server and the five agent runtimes are local server processes**
  (`npm run mcp:*`, `npm run agent:*`), not hosted functions.
- The **public Recovery Room (GitHub Pages) calls the Supabase Edge Functions directly**
  (`retentionlab-evidence`, `retentionlab-clarification`) using browser-safe `VITE_*`
  values.
- **`SUPABASE_SECRET_KEY` is data-generation-only.** It is consumed by
  `scripts/generate-demo-data.mjs` and configured *inside* the Supabase Edge Functions as
  their own function secret. The local evidence + agent runtime never reads it, and the
  real `.env.local` intentionally omits it — so it is **not** a hard requirement for a
  normal server preflight.
- A **hosted Vercel API is a future target, not a currently deployed dependency.**
  `VITE_API_BASE_URL` is a placeholder for that future API and is currently unused by the
  browser clients.

## What it proves — and what it deliberately does not

**Proves (offline, secret-safe):**

- Every runtime environment variable the live path depends on is present and well-shaped,
  validated by the same rules the real runtime loaders enforce (`mcp/config.ts`,
  `agents/*/config.ts`) and cross-checked against them in `ops/preflight.test.ts` so the
  matrix cannot silently drift.
- Fail-closed on every axis: any missing **required** variable, any **invalid** value, an
  unknown flag, or an invalid `--scope` all exit non-zero — the CLI never silently defaults.
- Secret-safe: a secret value (`SUPABASE_SECRET_KEY`, `OPENROUTER_API_KEY`) is never
  printed — only reported as `set (hidden)`. Non-secret URLs are previewed as scheme+host
  so the operator can eyeball the reachability target; keys show only a length and prefix
  marker.

**Deliberately does not:**

- Contact any network, so it makes **no** claim about live-endpoint reachability. Proving
  the running server and the public page actually reach Supabase/OpenRouter remains the
  separate, manual post-deploy step listed under *Remaining remote steps* below.
- Deploy, push, or read/write any remote Supabase/GitHub state.
- Read secrets from anywhere but the process environment (the npm script preloads
  `.env.local` if it exists; it is never committed and is covered by the secret scanner).

## How to run

```bash
npm run preflight            # server scope (default) — the local live-path server gate
npm run preflight:all        # server + core browser (VITE_*) live variables
npm run preflight -- --scope=browser   # public Pages repository Variables only
npm run preflight -- --json            # machine-readable, secret-free report (CI)
```

Exit code is `0` when the selected scope is satisfied, `1` otherwise (including on an
unknown flag or `--scope` value). Wire `npm run preflight` into CI or a pre-deploy step to
fail closed on a misconfigured environment.

## Environment variable matrix

**Server scope** — the local live-path server runtimes: the MCP evidence gateway and the
five OpenRouter agent runtimes.

| Variable | Requirement | Secret | Purpose |
|---|---|---|---|
| `SUPABASE_URL` | required | no | Supabase project origin for the evidence gateway |
| `SUPABASE_PUBLISHABLE_KEY` | required | no (public id) | Publishable key the gateway presents to the Edge Function |
| `OPENROUTER_API_KEY` | required | **yes** | Shared server-only key for all five agent runtimes |
| `SUPABASE_SECRET_KEY` | optional | **yes** | Data-generation-only (`generate-demo-data.mjs`); unused by the evidence/agent runtime |
| `SUPABASE_EVIDENCE_FUNCTION` | optional | no | Evidence Edge Function name (default `retentionlab-evidence`) |
| `OPENROUTER_{RESEARCHER,DESIGNER,MAKER,COMMUNICATOR,MANAGER}_MODEL` | optional | no | Per-agent model id (each defaults to a free model) |

**Browser scope** — public GitHub Pages **repository Variables** (never Secrets). The Pages
app calls the Supabase Edge Functions directly, so a live public route **requires** the
Supabase origin and publishable key; without them browser/all fails closed.

| Variable | Requirement | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | **required** | Supabase origin the browser evidence client queries directly |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | **required** | Public `sb_publishable_…` key the browser client presents |
| `VITE_SUPABASE_EVIDENCE_FUNCTION` | optional | Browser evidence function name (default `retentionlab-evidence`) |
| `VITE_SUPABASE_CLARIFICATION_FUNCTION` | optional | Browser clarification function name (default `retentionlab-clarification`) |
| `VITE_API_BASE_URL` | optional | Placeholder for a future Vercel API; currently unused by the browser clients |

`.env.example` lists every variable without a value; never place a secret in a `VITE_*`
slot — those are compiled into the public bundle.

## Remaining remote steps (manual, outside this preflight)

The preflight proves configuration shape. Proving the live path is actually reachable still
requires these operator actions, none performed here:

1. Provision the server variables in whatever environment runs the MCP/agent processes, and
   the browser `VITE_*` values as GitHub **repository Variables** (not Secrets). Run
   `SUPABASE_SECRET_KEY`-dependent demo-data generation separately with that key set.
2. Run `npm run preflight:all` against that environment and confirm it passes.
3. Run the live reachability proofs against the real endpoints: `npm run mcp:smoke`
   (MCP → Supabase evidence path) and a real Researcher run (`npm run agent:researcher`)
   for the OpenRouter path.
4. Confirm the public Pages app renders live evidence from the Supabase Edge Functions, and
   plan to keep the services live for ≥8 weeks after the deadline (continuity monitoring,
   per Gate 10).
