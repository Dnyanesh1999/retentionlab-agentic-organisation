# Gate 2 data-layer design

## Boundary

RetentionLab stores only generated, fictional account-level evidence. It does not store names, email addresses, phone numbers, free-form customer messages or any other real customer PII.

The browser does not query these tables. Gate 3 will add allow-listed MCP tools on the server; only those structured tool results will reach the orchestration layer and UI.

## Relational model

| Table | Purpose | Expected generated rows |
|---|---|---:|
| `demo_generation_runs` | Provenance, seed, generator version, readiness and row counts | 1 ready run |
| `accounts` | Fictional B2B SaaS account and renewal context | 8 |
| `product_signals` | Adoption and utilisation observations | 32 |
| `billing_events` | Invoice/payment evidence | 16 |
| `support_events` | Synthetic service cases and sentiment | 16 |
| `consent_preferences` | Outreach and personalisation boundaries | 8 |
| `vendor_status_events` | Fictional upstream-service conditions | 4 |

Every evidence row has a stable `evidence_key`, observation/source timestamps and a source-system label. Foreign keys cascade from each generation run, making a dataset replaceable as one bounded unit.

## Refresh safety

`scripts/generate-demo-data.mjs` creates a new generation run in `loading` state, writes and validates its relational rows, marks it `ready`, and only then removes older ready runs. A failed write is marked `failed`; it cannot silently replace the last valid dataset.

The generator is deterministic for a given seed and timestamp, while UUIDs identify each database instance. Generated evidence is written to Supabase and is never compiled into the frontend bundle.

## Access control

- RLS is enabled on every table in the exposed `public` schema.
- `public`, `anon` and `authenticated` receive no table privileges.
- Only `service_role` receives explicit CRUD privileges for the server-side generator and future MCP query layer.
- The secret key must stay in `SUPABASE_SECRET_KEY`, never a `VITE_*` variable.
- No permissive RLS policy exists for a browser role.

This deliberately treats Postgres privileges and RLS as separate controls, following the [Supabase API security guidance](https://supabase.com/docs/guides/api/securing-your-api) and [RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security). Explicit grants also account for Supabase's [2026 Data API exposure change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).

## Live proof — completed 5 August 2026

The dedicated `RetentionLab` project is active in Supabase EU West (Ireland). The following evidence is recorded in `docs/qa-gate-2.md`:

1. The migration applied successfully and appears in remote migration history.
2. The generator wrote 84 business rows plus one ready provenance row.
3. Anonymous and authenticated roles have no table read privilege.
4. Database security and performance advisors were reviewed.
5. A controlled source-row edit changed the next server-side query result, then the test value was restored.
