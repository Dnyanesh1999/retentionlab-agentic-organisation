# Authenticated human approval and portfolio promotion — QA

Date: 14 August 2026

Branch: `claude/human-approval-portfolio`

Supabase project: `luwrufuouosytyhdqnme`

## Status

Applied and deployed to production on 15 August 2026. Migrations
`20260814153107_add_human_approval_decision.sql` and
`20260815005500_fix_decision_operator_ambiguity.sql` are live; `retentionlab-runs` has been redeployed.
The unauthenticated probe set has passed against production (section 4). The operator-authenticated
probes and the approval itself are recorded in section 5.

Accepted run `982ac99a-d9aa-47a6-ba61-09f366143715` was at `awaiting_human_approval` with **28 events**
immediately before and after both migrations and the redeploy — neither touched it.

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

## 4. Live verification — production, 15 August 2026

### 4.1 Migration history hazard, confirmed

`npx supabase migration list --project-ref luwrufuouosytyhdqnme` reproduced exactly the hazard handoff
§8 warns about. Six local migrations have **no** remote record under their own name; their content is
live under differently-named remote records:

| Local | Remote |
| --- | --- |
| `20260814104956` | `20260814105637` |
| `20260814105741` | `20260814105756` |
| `20260814120907` | `20260814121336` |
| `20260814123253` | `20260814123337` |
| `20260814124809` | `20260814125323` |
| `20260814133220` | `20260814134306` |

Consequently `supabase db push` is unusable here: `--dry-run` fails with
`LegacyDbPushMissingLocalError` and suggests `migration repair --status reverted` for the six remote
records, which would then replay six already-live migrations. **Do not follow that suggestion.** Both
new migrations were applied through the dashboard SQL editor instead — the same hosted path the earlier
six took.

### 4.2 Schema verification after the first migration

`new_tables = 2`, `new_functions = 3`;
`agent_runs_status_allowed_check` includes `approved` and `rejected`;
`agent_runs_one_open_per_account_idx` remains `WHERE status = ANY (queued, in_progress,
awaiting_human_approval)` — so a decided run leaves the open set and its account is released.

### 4.3 Function deploy

`npx supabase functions deploy retentionlab-runs --project-ref luwrufuouosytyhdqnme --no-verify-jwt`
uploaded `index.ts`, the five workers and `decision.ts`. `verify_jwt=false` retained deliberately; the
function performs its own caller and operator checks.

### 4.4 Unauthenticated probes — all passed

| # | Probe | Observed |
| --- | --- | --- |
| P1 | `decide_run`, no bearer | **401** `Approval requires an authenticated operator` |
| P2 | `get_decision_context`, no bearer | **401** same |
| P3 | `decide_run`, forged bearer | **401** same |
| P4 | publishable key → `rpc/record_agent_run_decision` | **401** `permission denied for function` |
| P5 | publishable key → `rpc/get_agent_run_decision_context` | **401** `permission denied for function` |
| P6 | publishable key → `agent_run_decisions` table | **404** `Could not find the table` |
| P7 | `list_promoted_cases` | **200** `{"cases":[]}` |

P6 confirms the private decision table is not merely unreadable but invisible to browser roles. P7
confirms the promotion RPC is live and that the archive reports zero approved cases honestly.

### 4.5 Defect found and fixed by a live probe

An authenticated but **not** allow-listed operator received **502** from `decide_run` instead of the
intended **403**, while the equivalent check in `get_decision_context` correctly returned **403**.

Cause: `record_agent_run_decision` declared a record variable named `operator` and used `operator` as
the table alias in the same statement, so `operator.auth_user_id` was ambiguous and Postgres raised
42702 at runtime. `get_agent_run_decision_context` used an `exists` test with no record variable, which
is why only one of the two failed.

Fixed forward-only in `20260815005500_fix_decision_operator_ambiguity.sql`, which adopts the `exists`
shape and preserves every governance check unchanged. A scan of all migrations confirmed this was the
only occurrence of the pattern.

**Two honest observations.** The mocked worker tests could not have caught this — they stub the RPC, so
the plpgsql never executes; there is no local Postgres in this project's test setup. And the defect
failed *closed*: the function aborted, so nothing was recorded. A defect that failed open — recording a
decision against an unverified hash — would have been far more serious. The refusal paths are written
fail-closed throughout, and this is practical evidence of that.

### 4.6 Operator seeded

One row in `private.approval_operators`, bound to a confirmed Supabase Auth user. The credential was
created by the student in the dashboard and never entered this repository, any log, or any AI context.

### 4.7 Objective floor fix, confirmed live

`create_run` with a 17-character objective now returns **400**
`objective must contain 20 to 500 characters`. Before this slice the gateway accepted it and Postgres
rejected it, surfacing as an opaque 502.

## 5. Operator-authenticated probes

Run against production as the allow-listed operator. The operator's password was entered locally by
the student; it never entered this repository, any log, or any AI context.

| # | Probe | Observed |
| --- | --- | --- |
| P8 | `get_decision_context` as the allow-listed operator | **200**, `manager_artifact_sha256 = d253e409ec1984b5f316e831e85637d77dd0900aaf55e0f342753af21494e605`, `chain_verified = true` |
| P9 | `decide_run` with a wrong Manager hash | **409** `The supplied Manager artefact hash does not match the sealed record` |
| P10 | `get_decision_context` for a non-existent run | **502** initially — defect, see 5.1; **404** after the fix |

### 5.1 Second defect found and fixed by a live probe

An unknown run id returned **502** `Decision could not be recorded` instead of **404**. The RPC
correctly raised `P0002` and PostgREST correctly surfaced 404, but `callRpc` collapsed every non-OK
response into a single 502 with a message that also claimed a *write* had failed when the call was a
read.

No security impact: nothing leaked and nothing was recorded. But the error was untruthful in two ways
at once — wrong status and wrong operation — which is precisely what this project's error handling is
supposed to avoid.

Fixed in `decision.ts`: a 404 from the store is preserved as 404 `Run not found`, and each caller now
names the operation it was attempting, so a read failure no longer reports a failed write. Two
regression tests cover both. Redeployed and re-verified.

P9 is the single most important line in this document. It is live proof that the exact stored
predecessor hash governs the decision: an operator holding a valid token, correctly allow-listed, at a
run genuinely awaiting approval, was still refused because the hash they presented did not match the
sealed record.

## 5.2 The approval — recorded 15 August 2026, 01:58:54 UTC

The named human operator signed in through the Control Room, reviewed the sealed context, wrote a
rationale and confirmed. The decision sheet displayed
`d253e409ec1984b5f316e831e85637d77dd0900aaf55e0f342753af21494e605`, `SEALED CHAIN Verified`,
`CONSENTED CHANNEL in_app`, `PERMITTED NEXT ACTION await human approval` and `EXTERNAL ACTIONS 0` —
the same hash P8 returned, so the operator attested to the artefact they actually saw.

| # | Step | Observed |
| --- | --- | --- |
| P11 | Approval of `982ac99a…` | `status = approved`; last event `run_approved`, "No customer action was sent" |
| P13 | Event count | **28 → 29**, exactly one event appended |
| P14 | Earlier failures preserved | **8** `run_failed` events intact — 3 Designer (seq 5, 7, 9), 5 Communicator (seq 15, 17, 19, 21, 23), including seq 23 "email is not present in the sealed Maker channel". `run_paused_for_approval` also unchanged; sequence still strictly increasing |
| P15 | Account released | A fresh run was accepted on `marble-current` with a new id, proving the rebuilt open-run index frees a decided account |
| P16 | Promoted case | `list_promoted_cases` returns 1 case: Marble Current, 5 stage summaries, `external_actions_permitted = 0`. Leak checks on the raw payload: no 64-character digest, no rationale, no operator identity, no prompt |
| — | Public event stream | No 64-character digest present anywhere in the 29 events |

### 5.3a Second side effect, disclosed

Run `068c2a2b-24bc-4773-af3b-156e8b61e153` was created on `marble-current` at 01:41 on 16 August 2026.
It exists because the assistant told the student that pressing "Create hosted run" would resume the
existing run rather than create a new one. That was asserted without checking: `4f505d07` had been
`failed` since 15 August, not open, so the idempotent create had nothing to return and made a new run.

That run then carried the four retry attempts described in 5.4. Its `run_failed` events are append-only
and are not being removed. It is recorded here rather than quietly discarded, on the same principle as
5.3 below.

### 5.3 Probe side effect, disclosed

The P15 check was performed by actually calling `create_run`, which does not merely test the index — it
created a real governed run (`4f505d07…`) and scheduled its Researcher. This was an avoidable side
effect of the verification method: a read-only check of the index predicate would have proved the same
property without consuming model quota or opening a run on the account. It is recorded here rather than
quietly discarded. The run is synthetic, governed, and cannot take an external action; it is a
candidate for exercising the `reject` path, which the approval flow has not yet demonstrated live.

### 5.4 Not demonstrated live, and the decision behind that

- **The `reject` path (`run_rejected`, `status = rejected`) is covered by unit tests only, and stays
  that way deliberately.** A live rejection needs a run sitting at `awaiting_human_approval`. On
  16 August 2026 four attempts were made to bring one there. Each got further — past the model
  endpoint, past the JSON Schema, to a valid ResearchBrief — and each was then refused by the
  Researcher's citation-integrity guard, because the model named a real evidence key but attributed it
  to the wrong `source_tool`.

  That guard could have been relaxed to let a run through. It was not. The exact-`source_tool` claim is
  one of the strongest things this project asserts, and weakening it to manufacture a demonstration
  would have cost more than the demonstration is worth. The refusals are themselves evidence: two
  capable production models — `nvidia/nemotron-3-super-120b-a12b:free` and `openai/gpt-4o-mini` —
  attempted to mis-attribute evidence provenance, and the Researcher failed closed on both.

  What the `reject` path does have: 13 hosted Deno tests, including refusal on a wrong Manager hash,
  and probe P9 in section 5, where an authorised operator at a valid run was refused live for
  presenting a hash that did not match the sealed record.
- Idempotent replay of a decision key against production — covered by unit tests only. It was not run
  against `982ac99a…` because the run is now terminal, so a replay there would exercise the
  already-decided branch rather than the replay branch.
- Responsive and console QA of the decision sheet at 390×844.

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

## 6. Known limitations after this slice

- Manager-directed typed revision execution remains fail-closed. Precisely:
  `complete_agent_run_manager` requires `decision = 'approve'` and
  `permitted_next_action = 'await_human_approval'`, so a Manager `revise` outcome is rejected by the
  RPC and recorded as a Manager **stage failure** — not as a sealed revise decision. The human decision
  vocabulary added here is deliberately `approve` / `reject` only; routing a typed revision back into
  the pipeline is still unimplemented.
- Operator sign-in has no rate limiting of its own beyond Supabase Auth's defaults.
- The session is memory-only, so a page refresh during a decision requires signing in again.
- Approved-case promotion is automatic on approval; there is no separate publication decision.
