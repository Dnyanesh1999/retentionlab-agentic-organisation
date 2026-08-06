# Copilot review — Gate 6 Maker Slice 4

Date: 6 August 2026

Mode: final read-only review in the GitHub Copilot app, Auto model selection, isolated worktree
`dnyanesh1999-silver-potato` fast-forwarded to reviewed commit `1f48c2d`.

Copilot was told not to edit repository files, access environment files, reveal credentials,
approve Autopilot, commit or push. It read the consent UI/client, support adapter, Edge Function,
migration and QA record.

## Adjudication

1. **Rejected — unit-token mismatch (reported P0).** The source contract deliberately accepts
   `sessions_per_user` from Supabase and normalizes it to the public UI unit `frequency`. The live
   browser rendered `4.85 sessions/user`, and adapter tests cover both sides of the mapping.
2. **Rejected — malformed authorization header (reported P0).** Copilot's UI masked the runtime
   secret interpolation. The tracked source contains `authorization: ` followed by a runtime
   `Bearer ${secretKey}` template, no credential. Deno check, Edge tests, deployment and live POST
   all passed.
3. **Rejected — client/server JSON hash divergence (reported P1).** The browser does not compute or
   transmit a payload hash. The Edge Function strictly parses and reconstructs the normalized
   object in fixed key order, computes the only payload hash and sends it to the atomic RPC. Retry
   tests and live replay proof passed.
4. **Rejected — fragment edge/referrer leak (reported P1).** The capability is accepted only on the
   exact Recovery Room hash route and is synchronously removed with `replaceState`; malformed
   capabilities are also removed. URL fragments are not transmitted in HTTP referrers. Unit and
   live URL-removal checks passed.
5. **Already controlled — Vite secret configuration and grants (reported P2).** The browser client
   accepts only `sb_publishable_` keys. Tracked-file secret scanning passed. Live privilege queries
   confirmed no anon schema/table/RPC grants and service-only RPC execution; advisors confirmed
   deny-all RLS.
6. **Already tested — modal focus trap (reported P3).** `ClarificationDialog.test.tsx` explicitly
   verifies Tab and Shift+Tab wrapping, initial textarea focus and side-effect-free dismissals.
   Live browser QA confirmed focus return to the trigger.
7. **Accepted as intentional — UTC unresolved date (reported P3).** The support event contract uses
   a cited instant and displays its canonical UTC calendar date. Account-local time is neither
   supplied nor authorized by the current evidence contract, so converting it would invent context.
8. **Deferred — automated responsive visual regression (reported P3).** Slice 4 has measured 390 px
   browser overflow proof and stored desktop/mobile screenshots. A repeatable visual-regression
   gate remains appropriate for Slice 5's complete visual/accessibility QA.

No finding required a Slice 4 code change. The review did confirm the intended consent, atomic
single-use, RLS/RPC, timestamp and no-write-on-decline boundaries.
