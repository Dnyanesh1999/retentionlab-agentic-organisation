# Authenticated human approval and portfolio promotion — QA

Date: 14 August 2026

Branch: `claude/human-approval-portfolio`

Supabase project: `luwrufuouosytyhdqnme`

## Status

Implemented and verified **locally**. The forward-only migration has **not** been applied and the run
function has **not** been redeployed. Every live probe in section 4 is therefore still outstanding, and
no claim in this document should be read as production evidence until that section is filled in.

## 1. What the slice adds

- `approved` and `rejected` terminal run statuses, reachable only from `awaiting_human_approval` and
  only through an authenticated human decision.
- `run_approved` / `run_rejected` append-only public events carrying a governed outcome sentence only.
- `private.approval_operators` (allow-list) and `private.agent_run_decisions` (decision record,
  including the operator's rationale), both revoked from every role including `service_role`.
- `public.record_agent_run_decision`, which refuses unless the run is at the approval boundary, the
  caller supplies the **exact** stored Manager artefact hash, and the operator is allow-listed.
- `public.get_agent_run_decision_context`, the bounded context an operator reviews before deciding.
- `public.list_promoted_agent_runs`, the public-safe approved-case projection.
- Gateway actions `get_decision_context`, `decide_run` (both operator-authenticated) and
  `list_promoted_cases` (publishable-key read).
- A Control Room decision sheet and an "Approved live cases" register in the Case archive.

## 2. Governance boundaries preserved

- Approval clears a sealed case record for **internal portfolio promotion**. It authorises no send,
  publish, deploy or customer data mutation. `requires_human_approval` and
  `external_actions_permitted` are never written by the decision path.
- The operator identity is never accepted from a request body. It is only the subject Supabase Auth
  returns for a bearer token the Edge Function verifies itself against `/auth/v1/user`. The token is
  never decoded locally and never logged.
- The publishable browser key remains insufficient authority to approve; it authenticates the caller,
  not the decision-maker.
- The decision RPC only ever inserts. It appends one event at `max(sequence) + 1` and never updates or
  deletes `run_paused_for_approval` or any earlier failure event.
- A replayed idempotency key returns the recorded decision unchanged and appends nothing.
- The operator's free-text rationale stays in `private.agent_run_decisions`. The public event carries a
  fixed governed sentence instead.
- The promoted-case projection exposes no artefact body, prompt, artefact hash, rationale or operator
  identity. A contract-level test asserts the rendered public record contains no 64-character digest.
- The browser session holds the access token in memory only — never `localStorage`, `sessionStorage`
  or a URL — so a refresh requires signing in again before another decision.

## 3. Local verification (all passing)

| Check | Result |
| --- | --- |
| `npm test -- --run` | 417 passed (60 files), up from 399 |
| `npm run typecheck` | pass |
| `npm run agent:pipeline:check` | pass |
| `npm run lint` | pass |
| `npm run build` | pass |
| `npm run test:release` | 16 passed |
| `npm run test:data` | 2 passed |
| `npm run release:scan` | clean across 309 tracked files |
| `npm run release:pages` | 569,544 / 1,200,000 bytes JS |
| Hosted Deno worker suite | 27 passed, up from 15 |
| `deno check` on `index.ts` | pass |

New adversarial coverage:

- `supabase/functions/retentionlab-runs/decision.test.ts` (12 tests) — missing/malformed bearer refused
  without any auth call; a rejected token refused; identity taken from the verified token rather than
  the caller; a caller-supplied `operator_user_id`, a non-lowercase or wrong-length hash, a `revise`
  decision and a short rationale all rejected by the input contract; each governance refusal mapped to
  a truthful 403/409; an unknown refusal reason refused rather than treated as success; one decision
  recorded against the exact sealed hash; a replay returning without a second write; no direct table
  write issued at all; and fail-closed behaviour on an unreachable or nonsense store.
- `runtime/hosted/contracts.test.ts` — decision events rejected if they carry a rationale, an operator
  id or a hash; sequence monotonicity still enforced once a decision event is appended.
- `src/features/control-room/CommandCenterView.test.tsx` — no decision boundary off the approval state;
  no decision control and **no decision-context fetch** while signed out; an approval recorded against
  the displayed hash only after an explicit confirm; a service refusal surfaced without claiming
  success; a context failure blocking a blind decision.
- `src/features/design-lab/approvedCases.test.tsx` — the assessed Copper Finch snapshot preserved beside
  approved live cases; an honest empty state; a visible failure state; and no 64-character digest,
  prompt version, rationale or operator string in the rendered public record.

## 4. Live verification — OUTSTANDING

Run after applying the migration and redeploying. Record actual observed results here; do not
pre-populate expected values.

1. `npx supabase migration list --project-ref luwrufuouosytyhdqnme` and inspect the remote schema
   before applying. Local `20260814133220_add_hosted_remaining_workers.sql` is live remotely under a
   hosted record created around `20260814134306`; do not replay it.
2. Apply only the new forward-only migration `20260814153107_add_human_approval_decision.sql`.
3. Seed one operator into `private.approval_operators` from a real Supabase Auth user, via the SQL
   editor. Never commit the credential.
4. `npx supabase functions deploy retentionlab-runs --project-ref luwrufuouosytyhdqnme --no-verify-jwt`.
5. Probes:
   - `decide_run` with no bearer → expect 401.
   - `decide_run` with a valid but non-allow-listed user → expect 403.
   - `decide_run` with a wrong expected hash → expect 409.
   - `decide_run` against a run not at the boundary → expect 409.
   - `decide_run` replayed with the same idempotency key → identical result, **no** second event.
   - publishable key against `rpc/record_agent_run_decision` → expect 401.
   - `get_decision_context` with no bearer → expect 401.
6. Approve run `982ac99a-d9aa-47a6-ba61-09f366143715` as the named human operator. Then confirm its
   `run_paused_for_approval` event and every earlier Designer and Communicator failure event are still
   present and unmodified, and that the run's account is again available for a new run.
7. Confirm the promoted case appears at `#/portfolio` and at `#/cases/approved/<run id>` with no hash,
   artefact or prompt leakage.
8. Desktop and 390×844 QA: zero horizontal overflow, zero console warning/error, reduced-motion parity.
9. Re-run the full command list in section 3, then `npm run release:check` on the tracked commit.

## 5. Known limitations after this slice

- Manager-directed typed revision execution remains fail-closed. Precisely:
  `complete_agent_run_manager` requires `decision = 'approve'` and
  `permitted_next_action = 'await_human_approval'`, so a Manager `revise` outcome is rejected by the
  RPC and recorded as a Manager **stage failure** — not as a sealed revise decision. The human decision
  vocabulary added here is deliberately `approve` / `reject` only; routing a typed revision back into
  the pipeline is still unimplemented.
- Operator sign-in has no rate limiting of its own beyond Supabase Auth's defaults.
- The session is memory-only, so a page refresh during a decision requires signing in again.
- Approved-case promotion is automatic on approval; there is no separate publication decision.
