# Gate 6 QA — Maker Slice 4

Date: 5–6 August 2026

Scope: live support evidence, optional clarification consent and private persistence

## Implemented boundary

The Signal Garden now includes one live, open workflow support case. Its collapsed sentence is
derived only from category, severity and status. Expansion reveals the exact case reference,
sentiment, unresolved date and evidence key; no summary, cause or recommendation is exposed.

“Clarify workflow friction?” appears only when the live preference permits recovery outreach and
the route has consumed a valid one-time capability from the URL fragment. The native modal uses
the approved copy, allows an empty optional observation, traps focus and returns focus to its
trigger. Close, Escape, backdrop and “Not now” never call the persistence client.

## Persistence and security proof

- Migration `20260805233206_create_clarification_consent_boundary` is applied remotely.
- Recovery sessions and submissions live in the non-exposed `private` schema with RLS enabled,
  no policies and no browser-role grants.
- Only `service_role` may execute the atomic `submit_recovery_clarification` RPC; it has no direct
  table grant.
- The separate `retentionlab-clarification` Edge Function validates exact origin, a 4 KB body
  ceiling, exact keys, maximum 500 characters, the publishable app key, capability and idempotency
  key. It returns a strict receipt and never echoes observation text.
- Capabilities are stored only as SHA-256 digests, expire quickly, bind to account and generation
  run, and are consumed atomically with the submission.
- Submissions record purpose, consent action/copy version and a 30-day retention deadline. The
  scheduled purge remains a Gate 10 operational task.
- Final Supabase advisors show only expected informational deny-all RLS notices and new unused
  index notices; there are no warning/error findings. See the [database linter reference](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## Live browser proof

- The first live run failed closed with `invalid_contract`; investigation found Supabase's
  `+00:00` support timestamp did not satisfy the public canonical-`Z` contract. The adapter now
  normalizes it, and the regression fixture uses the real offset shape.
- The capability was removed from the visible URL after initial route consumption and was never
  placed in browser storage.
- Live support values rendered as case `support:copper-finch:2-1`, sentiment `-0.267` and
  unresolved date `2026-07-27`.
- At 1280 × 720, the support strand, botanical connector and modal rendered without overlap.
- At 390 × 844, document width remained exactly 390 px and the modal stayed inside 12–378 px.
- The empty Share button was enabled and initial focus landed on the textarea.
- “Not now” closed the modal, returned focus to the clarification trigger, and a database query
  confirmed the session remained active with no submission.
- A second empty Share closed the modal and removed its trigger. Database proof showed one
  consumed session, a `NULL` observation and exact `share_observation` / `clarification-consent.v1`
  audit fields.

## Faithful comparison ledger

Compared directly with `signal-garden-clarification-concept-v2.png` and
`signal-garden-clarification-mobile-concept-v1.png`:

1. The support case remains part of the botanical inspection rail instead of becoming a dashboard
   card or sixth agent.
2. The thin green stem visually connects the evidence-bound support case to its single
   clarification affordance.
3. Warm paper, forest ink, serif display type and violet focus treatment match the accepted visual
   system.
4. The approved heading, body, label and both action labels are preserved verbatim.
5. Mobile actions stack at full width, text stays at 16 px or larger in the dialog and no horizontal
   overflow is introduced.

Intentional deviation: the desktop concept showed a docked lower-right panel, while production
uses a centered native modal with an inert, dimmed backdrop. This aligns desktop and mobile focus
semantics, avoids collision with variable live evidence height and makes the consent boundary
unambiguous. No avatar, chatbot bubble or invented agent identity was added.

## Automated verification

- Vitest: 106 tests across 24 files passed
- Deno Edge Function: 4 tests passed; `deno check` passed
- Typecheck, ESLint and production build: passed
- Live atomic/idempotent POST and strict receipt: passed
- Live decline/no-write and empty-share/write database checks: passed
- Desktop/mobile browser visual and overflow checks: passed
- `git diff --check`: passed
