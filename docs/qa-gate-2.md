# Gate 2 QA — live Supabase data

Date: 5 August 2026  
Project: `RetentionLab`  
Project reference: `luwrufuouosytyhdqnme`  
Region: EU West (Ireland)  
API origin: `https://luwrufuouosytyhdqnme.supabase.co`

No secret or service-role key is stored in this document or the repository.

## Migration proof

- Remote migration: `20260805092903_create_retentionlab_evidence_schema`
- Seven public tables created successfully.
- RLS enabled on all seven tables.
- Generated TypeScript database types stored at `src/types/database.ts`.

## Live row proof

| Relation | Verified rows |
|---|---:|
| Ready generation runs | 1 |
| Accounts | 8 |
| Product signals | 32 |
| Billing events | 16 |
| Support events | 16 |
| Consent preferences | 8 |
| Vendor status events | 4 |
| Business evidence total | 84 |

## Access proof

The verification query checked Postgres privileges and catalog RLS state:

- `all_tables_have_rls = true`
- `anon_can_select_accounts = false`
- `authenticated_can_select_accounts = false`
- `service_role_can_select_accounts = true`
- browser-facing RLS policies: `0`

This is intentional deny-by-default behavior. Browser roles have neither grants nor permissive policies; the future MCP server will use a server-only secret and expose only allow-listed tool results.

## Fresh-query mutation proof

The controlled evidence row `product:copper-finch:active_users:2` was updated in Supabase:

1. Stored value before edit: `120.0000`
2. Value returned by the next database query: `121.0000`
3. Restored value: `120.0000`

This demonstrates that runtime results respond to the live source rather than a frontend fixture or cached prompt value. The test edit was restored immediately.

## Advisor review

Security advisor results contain only seven informational `rls_enabled_no_policy` notices. They are expected because the access model intentionally defines no browser policy and revokes browser grants. Reference: [Supabase linter 0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

Performance advisor results contain only informational `unused_index` notices. The project was newly created and its query workload had not started; the indexes support the documented Gate 3 access paths and should be reassessed after MCP query traces exist. Reference: [Supabase linter 0005](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

## Local verification

- Data-generator contract tests: 2 passed
- Frontend tests: 4 passed
- TypeScript typecheck: passed
- ESLint: passed
- Production build: passed
- Dependency audit: 0 vulnerabilities

