# Gate 10 — live reachability re-verification

Date: **12 August 2026** (Europe/Dublin)

This record captures a fresh, read-only operational check of the services used by the
public RetentionLab experience. It contains no credentials and makes no claim about
future uptime. The accepted full five-agent OpenRouter run remains recorded separately in
`docs/qa-gate-9-live-pipeline-transcript.md`.

## Configuration preflight

Both secret-safe configuration scopes passed from the local, uncommitted-secret environment:

```text
npm run preflight      -> 3/3 required server variables satisfied
npm run preflight:all  -> 5/5 required server + browser variables satisfied
```

`SUPABASE_SECRET_KEY` was correctly absent because it is only needed for demo-data
generation, not for the normal evidence/agent runtime. Secret values were rendered only as
`set (hidden)`.

## Supabase Edge Function → Postgres

A direct `POST` to the deployed `retentionlab-evidence` Edge Function invoked
`get_account_snapshot` for the fictional Copper Finch account.

- HTTP `200` in 1,550 ms
- source: `Supabase Postgres`
- retrieval: `2026-08-12T13:01:37.892Z`
- cache policy: `no-store, max-age=0`; response envelope also reported `cache_mode: no-store`
- decoded shape: four product signals, two billing events, two support events and one
  preference profile
- no error or fallback evidence was returned

## Public GitHub Pages route

The unauthenticated public route
`https://dnyanesh1999.github.io/retentionlab-agentic-organisation/#/cases/recovery-room`
was opened in a real browser after the direct gateway check.

- the route rendered all four fresh aggregate readings and the support signal
- no browser console warnings or errors were recorded
- the public UI therefore proved that the Pages build contains the live browser-safe
  Supabase configuration, not merely that the Edge Function works in isolation

The check also exposed a stale shell label (`Live connection gate pending`) above the
working live experience. That contradiction was fixed in commit `603e1e1` and protected by
an application-shell regression test.

## OpenRouter

A minimal server-side completion request was made through the configured free router model.

- HTTP `200` in 1,222 ms
- resolved model: `inclusionai/ling-3.0-tiny:free`
- non-empty completion returned; no provider error

This is a reachability heartbeat only. The full typed five-agent transformation, validation,
failure recovery, lineage and Manager approval boundary are evidenced by the accepted Gate 9
run rather than inferred from this small request.

## Honest remaining external condition

These checks prove reachability at the recorded time. They do not prove the required
availability period by themselves. The public Pages site, Supabase project/Edge Functions and
OpenRouter configuration must remain available and be monitored for at least eight weeks
after submission.
