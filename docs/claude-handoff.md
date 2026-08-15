# Claude handoff — RetentionLab

Handoff date: 15 August 2026 (supersedes the 14 August Codex handoff)

This document lets a fresh Claude Code session continue without the prior conversation. Treat
repository code, committed QA evidence and live read-only checks as authoritative when they disagree
with any summary — including this one.

## 0. Start here — state on 15 August 2026

**The human-approval loop is closed and proven in production.** Run
`982ac99a-d9aa-47a6-ba61-09f366143715` was approved by the named human operator at **01:58:54 UTC on
15 August 2026**. Its status is `approved`, it has 29 events, and all eight earlier `run_failed` events
survived unchanged.

- PR #9 (human approval and portfolio promotion) is **merged**: `main` at `27df2a5`.
- PR #10 (motion primitive layer) is **merged**: `main` at `015e6d4`.
- Both are deployed. GitHub Pages serves the decision sheet, the promoted case and the motion layer;
  verified against the deployed asset hashes, not just a green workflow.
- `main` equals `origin/main` and the worktree is clean.

### Do these first, in this order

1. **Decide the stray run `4f505d07`.** A probe in an earlier session called `create_run` on
   `marble-current` to prove the account was released after approval; that created a real governed run
   which is executing or paused. Rejecting it through the Control Room both frees the account and gives
   the **`reject` path its first live proof** — currently it is covered by unit tests only. This side
   effect is disclosed in `docs/qa-human-approval.md` §5.3; do not quietly delete it.

   Note the trap: do **not** inspect it with the `get_run` gateway action to find out its state first.
   `get_run` calls `scheduleHostedWorker`, so reading the run resumes it and spends OpenRouter quota.
   Use the Control Room, or a read-only query in the Supabase SQL editor.
2. **Fill the gaps in §5.4 of `docs/qa-human-approval.md`**: the reject path, idempotent replay against
   production, and 390×844 QA of the decision sheet.
3. ~~Confirm reduced-motion parity in a real browser.~~ **Done against the deployed build — see §10.1**,
   including the counters. No item remains here.

### What is still the student's own work — do not write it

The academic reflection, the cited GDPR / EU AI Act submission section, and any first-person claim about
learning or authorship. `docs/brief-compliance.md` still records the submission section as pending.

## 1. Current outcome

RetentionLab is a portfolio-grade, consent-first agentic organisation for fictional B2B SaaS retention.
It has exactly five bounded agents:

`Researcher → Designer → Maker → Communicator → Manager`

The complete pipeline is hosted and live through Supabase Edge Functions. A production Marble Current
run completed all five stages, paused at the mandatory human-approval boundary, and was then approved
by an authenticated human operator. No customer communication or other external action occurred at any
point — `external_actions_permitted` is still `0`.

- Public site: <https://dnyanesh1999.github.io/retentionlab-agentic-organisation/#/control-room>
- GitHub repository: <https://github.com/Dnyanesh1999/retentionlab-agentic-organisation>
- Supabase project ref: `luwrufuouosytyhdqnme`
- Accepted production run: `982ac99a-d9aa-47a6-ba61-09f366143715`, status `approved`, 29 events
- Live migrations added 15 August: `20260814153107_add_human_approval_decision.sql` and
  `20260815005500_fix_decision_operator_ambiguity.sql`
- Five-agent production proof: `docs/qa-hosted-five-agent-pipeline.md`
- Approval and promotion proof: `docs/qa-human-approval.md`

## 2. What is implemented

### Live data and evidence

- Synthetic relational account data in Supabase Postgres.
- A protected no-store evidence Edge gateway.
- Seven read-only MCP evidence tools for the local assessed pipeline.
- A separate clarification gateway with private-schema storage and bounded capabilities.

### Hosted five-agent execution

- Idempotent hosted run creation and public-safe read projection.
- Strict stage order with service-only 140-second leases.
- Private versioned artefact storage and 64-character SHA-256 identities.
- Exact same-run, same-account predecessor lineage verification before successor model use.
- Append-only monotonically sequenced public events.
- Safe expired-lease recovery and explicit failed-stage checkpoint retry.
- Compact OpenRouter model deltas combined with deterministic policy compilers.
- Manager completion always stops at human approval with autonomous external actions false.
- Authenticated human decision at that boundary: a Supabase Auth operator, checked against a private
  allow-list, records one idempotent `approve`/`reject` against the exact stored Manager artefact hash.
  Approval promotes the sealed case record internally and sends nothing.

### Frontend

- `#/control-room`: live account directory, governed launch, honest running/error/completion motion,
  five-agent execution trace and “Retry from sealed checkpoint.”
- `#/portfolio`: the Case archive — the committed assessed Copper Finch snapshot plus an "Approved
  live cases" register fed by the hosted gateway. Rendered by `CaseArchiveScreen` in
  `src/features/design-lab/DesignLabView.tsx`, **not** by a `PortfolioView` component.
- `#/cases/approved/<run id>`: one approved live case, from the same bounded public projection.
- `#/cases/overview`: four-tab practical casebook for the accepted Copper Finch assessed run.
- `#/cases/recovery-room`: live Signal Garden customer experience.
- Responsive desktop/mobile UI, reduced-motion support, accessible states and sealed-record assistant.

### Motion primitive layer

`src/components/motion` holds the shared interaction layer. Every primitive resolves reduced motion
through the single `useResolvedReducedMotion` gate and has unit tests asserting its reduced-motion
behaviour. Do not add a primitive that skips that gate.

- `MotionConfigProvider`, `StaggerReveal`, `HandoffTrace`, `StateSwap`, `ProgressVeil` — the original set.
- `AnimatedNumber` — counts to a real figure. The wrapper is `role="img"` named with the exact final
  formatted value, so assistive technology never hears an intermediate frame. Never feed it a figure
  the page does not actually hold.
- `TextReveal` — word-by-word masked entrance. It renders its own heading element because the animated
  words are `aria-hidden`; the complete string is supplied as the accessible name.
- `Spotlight` — pointer-tracked wash; off for coarse pointers and under reduced motion.
- `ScrollProgress` — rail driven by real document scroll offset. It is `aria-hidden` and carries no
  `progressbar` role deliberately: a progress role here would read as work in progress.
- `SharedIndicator` — one underline travelling between items via `layoutId`. Used by the masthead nav
  and the case tabs. Each group needs its own `layoutId`.
- `SmoothScroll` — Lenis momentum scrolling, mounted once in `src/main.tsx`. Lazily imported, so the
  library is never fetched under reduced motion. `anchors` is off because this app routes on the hash
  and Lenis would otherwise claim every nav link. Any region that scrolls its own content must spread
  `LENIS_PREVENT` (see `src/components/motion/lenisPrevent.ts`) or the wheel will scroll the page
  instead; `.launch-sheet` and `.agent-inspector__scroll` already do.

Route transitions in `src/app/App.tsx` are entrance-only by design. An exit animation would need
`AnimatePresence mode="wait"` to avoid two `<main id="main-content">` landmarks coexisting, and
`mode="wait"` stalls navigation whenever animation frames are throttled, such as in a background tab.

### Assistant

`src/features/assistant` is the browser tier and `supabase/functions/retentionlab-assistant` is the
model tier. They are layered so that a model failure is an ordinary outcome, not an incident.

The rule the model tier exists to enforce: **the model may choose words, but it may not introduce
facts.** That is enforced in `runtime/assistant/contracts.ts`, after the model speaks — not requested in
a prompt. A reply is discarded whole unless it parses to a fixed shape, cites only chunks sent in that
same request, and every quoted span occurs verbatim in the chunk it cites. Unvalidated prose has no path
to the browser.

- Retrieval is deterministic and runs in code, so what the model may see is auditable and identical for
  the same question every time. If retrieval finds nothing, the model is **not called** — answering from
  nothing is when models invent.
- The corpus is generated by `npm run assistant:corpus` into `corpus.json` beside the function, so the
  deployed function is self-contained. `test:release` fails if it drifts. The generator refuses to emit
  a chunk containing a digest, or one that rendered a missing value as the string "undefined".
- The corpus widens nothing: every source artefact is already imported by `gate9Run.ts` and therefore
  already ships in full to every browser that loads the case record.
- The fallback ladder is model-cited → sealed record → evidence without prose → honest refusal. The
  sealed-record tier ships in the client bundle, so it answers with the backend entirely down. Never
  present a fallback as a model answer; provenance is always shown.

Deliberate limitation: the function holds **no service key and has no database access at all**. Its
entire world is the corpus file. Rate limiting is therefore an in-memory per-instance brake, not a
durable quota — a real limit would mean giving the function credentials and losing that isolation, to
defend against abuse whose only cost is model quota. Revisit that trade before widening what the
function can reach.

New Edge secret: `OPENROUTER_ASSISTANT_MODEL`. Deploy with the same flags as the run function:

```bash
npx supabase functions deploy retentionlab-assistant \
  --project-ref luwrufuouosytyhdqnme \
  --no-verify-jwt
```

### Separate local assessed runtime

`agents/orchestrator` is the reproducible local pipeline: strict state machine, hash-chained JSONL events,
crash-safe resume, immutable artefacts and transcript export. Do not confuse it with the hosted Supabase
run projection. Both are intentional evidence for the final project.

## 3. Production evidence and honest failure history

Accepted run `982ac99a-d9aa-47a6-ba61-09f366143715` ends with:

- Researcher sealed 7 cited observations and 2 hypotheses from 5 fresh tools.
- Designer sealed 3 principles, 3 journey steps and 10 reviewed components.
- Maker sealed 7 interaction states, 10 reviewed components and 3 evidence-backed claims.
- Communicator sealed a consent-bound `in_app` invitation with 3 evidence-linked claims; nothing sent.
- Manager verified the complete chain and produced `run_paused_for_approval`.

Earlier Designer and Communicator failures remain in that same append-only event stream. They are not
bugs to erase. The Communicator failures exposed an invalid email-only assumption. The current generic
invitation contract inherits the actual sealed Maker channel and succeeded with `in_app`.

A separate fresh run, `81fa6967-561f-42aa-9e46-eb20cc2b59d0`, failed closed at Researcher because the
free model returned an invalid ResearchBrief. Do not rewrite or present that run as successful.

## 4. Key files to read first

Read in this order:

1. `README.md`
2. `docs/project-handbook.md`
3. `docs/architecture.md`
4. `docs/qa-hosted-five-agent-pipeline.md`
5. `runtime/hosted/contracts.ts`
6. `supabase/functions/retentionlab-runs/index.ts`
7. `supabase/functions/retentionlab-runs/{researcher,designer,maker,communicator,manager}.ts`
8. `supabase/migrations/20260814133220_add_hosted_remaining_workers.sql`
9. `src/features/control-room/CommandCenterView.tsx`
10. `src/features/control-room/AgentExecutionTrace.tsx`
11. `src/features/control-room/controlRoomClient.ts`
12. `docs/ai-usage-log.md`

For the professor's original requirements, read
`/Users/dnyanesh/Downloads/H9CEAI_Final_Project_Agentic-Organisation_2026.pdf` and cross-check
`docs/brief-compliance.md` plus `docs/acceptance-gates.md` before changing project scope.

## 5. Critical invariants

Do not weaken these to make a demo pass:

1. Exactly five agents and exact order.
2. Researcher may cite only evidence returned in its current tool session.
3. Downstream stages may cite only inherited verified evidence.
4. A successor must receive the exact stored predecessor hash, not a recomputed or guessed substitute.
5. Public events contain bounded summaries only; private artefacts never reach browser roles.
6. Publishable credentials cannot claim/complete workers or read private artefacts.
7. A failed run remains failed until an explicit retry; failures stay append-only.
8. Retry restarts only the failed stage from sealed predecessors.
9. Manager cannot send, publish, deploy, mutate customer data or self-approve.
10. `requires_human_approval = true` and `external_actions_permitted = 0` remain database invariants.
11. Model prose never owns permissions, lineage, evidence identity or governance.
12. No fake progress: UI animation follows recorded `stage_started`/`stage_completed` events.

## 6. Recommended next feature

**Status: done, applied, deployed and merged to `main`.** Slices A, B and C below are implemented; both
migrations are live, an operator is seeded, the run function is redeployed, and the loop is proven in
production. See `docs/qa-human-approval.md` for exactly what is proven and §5.4 for the three probes
still outstanding. This section is kept for the reasoning, not as a to-do list.

Two details the original plan below did not anticipate, both resolved in the implementation:

- The browser never receives an artefact hash, so an operator could not attest to one. An
  authenticated `get_decision_context` action returns the sealed Manager hash plus governance flags and
  the consented channel to an allow-listed operator only.
- Approving had to move the run out of `awaiting_human_approval`, because
  `agent_runs_one_open_per_account_idx` treats that state as open and would have blocked the account
  permanently. Hence the new `approved` / `rejected` terminal statuses.

The original incremental plan follows for reference.

### Slice A — decision contract and database boundary

- Add an authenticated operator identity; the current public synthetic intake is intentionally not
  sufficient authority for approval.
- Add a service-side approval/reject/revision RPC with explicit run id, expected Manager artefact hash,
  decision, bounded rationale and idempotency key.
- Accept only a run currently at `awaiting_human_approval` with a sealed Manager artefact.
- Append a new decision event; never rewrite `run_paused_for_approval` or earlier failures.
- Keep all external actions disabled. “Approve” should initially mean approve the case record for
  internal portfolio/archive promotion, not send customer communication.
- Extend the shared hosted contract and adversarial tests before the UI.

### Slice B — Control Room human-decision UI

- Show a focused decision sheet only for authorised operators.
- Display Manager summary, verified-chain status, consented channel and zero-external-action boundary.
- Require an explicit rationale and confirmation; support loading, success, conflict and error states.
- Use the existing design language and restrained motion. Avoid a new dashboard or long text wall.

### Slice C — portfolio promotion

- After a successful human approval event, expose a bounded public-safe case summary through the run
  gateway and show it in `#/portfolio` as a real completed case.
- Do not expose raw private artefacts, full hashes or model prompts in the everyday portfolio card.
- Preserve the existing Copper Finch assessed snapshot; add the live approved case as a separate record.
- Add deep-link routing and empty/loading/error states, responsive QA and accessibility coverage.

If the user chooses a different next feature, retain these invariants and update this handoff.

## 7. Known limitations

- Public hosted-run *intake* is synthetic-demo only and lacks rate limiting. The approval path is
  operator-authenticated; intake deliberately is not.
- Human approval and hosted-case portfolio promotion are implemented, deployed and proven live. The
  `reject` path and idempotent replay are still unit-test-only; see `docs/qa-human-approval.md` §5.4.
- Manager-directed typed revision execution remains fail-closed. Precisely:
  `complete_agent_run_manager` requires `decision = 'approve'` and
  `permitted_next_action = 'await_human_approval'`, so a Manager `revise` outcome is rejected by the
  RPC and recorded as a Manager **stage failure**, not as a sealed revise decision. The human decision
  vocabulary is `approve` / `reject` only.
- The free OpenRouter route can return invalid structured output; schema validation and checkpoint retry
  contain this, but broader model-quality evaluation is still needed.
- The accepted public casebook is a committed assessed snapshot; it is separate from live hosted runs.
- A real organisation still needs authorisation, audit retention policy, observability, incident handling,
  privacy impact assessment and legal review.

## 8. Supabase operational warning — CONFIRMED THE HARD WAY

`npx supabase db push` **does not work on this project at all.** This was verified on 15 August:
`--dry-run` fails with `LegacyDbPushMissingLocalError`, because six local migrations are live remotely
under different timestamps:

| Local | Remote |
| --- | --- |
| `20260814104956` | `20260814105637` |
| `20260814105741` | `20260814105756` |
| `20260814120907` | `20260814121336` |
| `20260814123253` | `20260814123337` |
| `20260814124809` | `20260814125323` |
| `20260814133220` | `20260814134306` |

The CLI's own suggestion — `migration repair --status reverted` on the six remote records — would then
**replay six already-live migrations**. Do not follow it.

**The only working route:** write the SQL to a new forward-only migration file, `pbcopy < <file>`, and
have the student paste it into
`https://supabase.com/dashboard/project/luwrufuouosytyhdqnme/sql/new` and press Run. Batch DDL, any
seed and a verification `select` into one paste — the editor shows only the final statement's result.
Warn them not to copy anything else in between; copying a URL once wiped the clipboard mid-task.

There is no route for Claude to execute this SQL itself: `.env.local` holds no `SUPABASE_SECRET_KEY`,
and sending the keychain-stored CLI token to the Management API is blocked by the permission
classifier. That block is correct; do not attempt to work around it.

What Claude *can* do directly: `npx supabase migration list --project-ref luwrufuouosytyhdqnme`,
`npx supabase functions deploy`, and probing the deployed gateway with the publishable key.

### Testing gap that has already cost two production defects

Every test that touches an RPC mocks `fetch`, so **plpgsql bodies never execute locally** and there is
no local Postgres. A migration can be green across 417 Vitest and 29 Deno tests and still be broken.
Two defects shipped this way on 15 August — an ambiguous plpgsql identifier and a wrong gateway error
mapping — and both were found only by curl probes against the deployed function, in *refusal* branches
rather than happy paths. After any migration, probe every refusal path directly and assert exact status
codes. Full write-up in `docs/qa-human-approval.md` §4.5 and §5.1.

### Original warning, still applicable

Do not blindly run `npx supabase db push`.

Several migrations were applied through the hosted migration path, so local filenames and remote
recorded timestamps do not line up one-for-one. In particular, local
`20260814133220_add_hosted_remaining_workers.sql` is live remotely under the hosted migration record
created around `20260814134306`. First inspect `npx supabase migration list --project-ref
luwrufuouosytyhdqnme` and the remote schema. For a new database change, create one new forward-only
migration; do not edit or replay already-live migrations. Verify grants, `security definer` search paths,
RLS and anon/authenticated/service-role access explicitly.

Deploy the run function explicitly because local link metadata can be absent:

```bash
npx supabase functions deploy retentionlab-runs \
  --project-ref luwrufuouosytyhdqnme \
  --no-verify-jwt
```

`verify_jwt=false` is intentional for this function because it validates the configured publishable key
itself and keeps worker RPCs behind the service key. Do not remove that custom caller check.

## 9. Secrets and environment

`.env.local` exists locally and is ignored. Never print its values or paste them into prompts, logs,
commits, browser storage or documentation. Expected names include:

- `OPENROUTER_API_KEY`
- `OPENROUTER_RESEARCHER_MODEL`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_EVIDENCE_FUNCTION`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_EVIDENCE_FUNCTION`

Edge secrets are managed remotely. Browser code must never receive the OpenRouter or service key.

## 10. Verification commands

Hosted workers:

```bash
deno test --allow-net --no-lock --sloppy-imports --node-modules-dir=auto \
  supabase/functions/retentionlab-runs/researcher.test.ts \
  supabase/functions/retentionlab-runs/designer.test.ts \
  supabase/functions/retentionlab-runs/maker.test.ts \
  supabase/functions/retentionlab-runs/communicator.test.ts \
  supabase/functions/retentionlab-runs/manager.test.ts

deno check --no-lock --node-modules-dir=auto \
  supabase/functions/retentionlab-runs/index.ts
```

Application and release:

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

After committing the intended files, run `npm run release:check`; it packages `git archive HEAD`, so an
uncommitted change is not part of that proof. Never commit generated `dist/`, release ZIPs, `.env.local`,
root Deno lock churn or `supabase/functions/retentionlab-runs/deno.lock`.

Baseline on `main` after the motion layer (15 August 2026):

- 442 Vitest application tests passed.
- 29 hosted Deno worker tests passed.
- TypeScript, agent pipeline check, ESLint and production build passed.
- 16 release tests and 2 data tests passed.
- Secret scan clean across 329 tracked files.
- Pages build 608,200 bytes JavaScript against a 1,200,000-byte ceiling.
- 1280×800 and 390×844 browser QA on `#/control-room`, `#/portfolio` and `#/cases/overview`: zero page
  overflow and a clean console on a fresh tab.

Earlier baselines: `main` at `27df2a5` (PR #9) had 417 Vitest tests, 29 hosted worker tests, 315 tracked
files and 569,544 bytes. `main` at `9e9936d` had 399 Vitest tests, 15 hosted worker tests, 311 tracked
files and 553,387 bytes.

Note when verifying: do not run `npm install` while the Vite dev server is running. Doing so during this
work left `node_modules` in a state where the jest-dom matchers silently failed to register, which
presents as 113 tests failing with "Invalid Chai property: toBeInTheDocument" and is not a code defect.
`npm ci` restores it.

### 10.1 Reduced-motion proof against the deployed site

Do not toggle the operating system setting to check this. Chromium can force the media feature, which
makes the check reproducible and leaves the machine's accessibility settings alone:

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
URL="https://dnyanesh1999.github.io/retentionlab-agentic-organisation/#/control-room"

"$CHROME" --headless=new --disable-gpu --virtual-time-budget=5000 \
  --user-data-dir=/tmp/cr-normal --dump-dom "$URL" > /tmp/dom-normal.html

"$CHROME" --headless=new --disable-gpu --virtual-time-budget=5000 \
  --force-prefers-reduced-motion \
  --user-data-dir=/tmp/cr-reduced --dump-dom "$URL" > /tmp/dom-reduced.html
```

Observed on 15 August 2026 against the deployed `015e6d4` build:

| Signal | Default | Reduced |
| --- | --- | --- |
| `.scroll-progress` rail | 1 | **0** — not rendered |
| `.text-reveal__mask` word spans | 6 | **0** — heading is plain text |
| `<h1 data-reduced-motion="true">` | 0 | **1** |
| `.global-nav__underline` | 1 | 1 — still drawn, correctly, as a static rule |
| `class="lenis"` on `<html>` | 1 | **0** — Lenis never initialises, so the chunk is never fetched |

`AnimatedNumber` under reduced motion, from the same reduced dump — each counter renders its real
figure immediately, with no count:

| Accessible name | Rendered text | `data-reduced-motion` |
| --- | --- | --- |
| `14 days` | `14 days` | true |
| `€9.6K` | `€9.6K` | true |

One asymmetry is expected and is itself evidence: the counters appear only in the **reduced** dump. With
animation enabled, the directory's ready state is gated on animation frames that a headless virtual-time
budget does not advance, so the default dump is still on the loading skeleton. Under reduced motion the
swap is synchronous, so the real content is there at once.

This check is also what surfaced the `StateSwap` defect fixed in the same session: under reduced motion
it still ran a 160ms fade behind `AnimatePresence mode="wait"`, so the incoming state was held until the
outgoing one finished leaving, despite the component documenting an instant swap. Before that fix, the
reduced dump showed `data-state="ready"` while still rendering the skeleton at `opacity: 0`. Reduced
motion now bypasses the presence machinery entirely.

## 11. Git and publication

- Start from current `main`; pull before branching.
- Use a small `claude/<feature>` branch.
- Keep commits scoped and stage explicit files only.
- Open a PR, wait for checks, merge only after evidence is updated.
- GitHub Pages deploys from `main` through `.github/workflows/deploy-pages.yml`.
- Re-check the public URL after Pages succeeds.

For material AI work, append a factual entry to `docs/ai-usage-log.md`. Do not write the student's
first-person reflection or invent academic claims; those remain the student's responsibility.

## 12. First prompt for the new Claude session

Use this prompt verbatim if helpful:

> Read `CLAUDE.md` and `docs/claude-handoff.md` completely, starting with §0. Then check the live state
> yourself before trusting any summary: current branch, whether PR #9 is merged, the status of run
> `982ac99a-d9aa-47a6-ba61-09f366143715`, and what happened to the stray run `4f505d07`. Do not
> implement anything yet. Return: (1) the verified current state with evidence, (2) anything in this
> handoff that is now stale, with file or live evidence, and (3) a short plan for the next step —
> normally closing the §5.4 verification gaps and deciding the stray run. Preserve exactly five agents,
> private artefacts, append-only failures, exact hash lineage, synthetic data, mandatory human approval
> and zero autonomous external actions. Never write the student's reflection or academic claims.

### Working notes for whoever picks this up

- The student writes in Hinglish when they want the reasoning rather than the steps. Lead with why,
  then give short copy-pasteable instructions.
- Any step needing the operator credential is theirs, not yours. The password was never shared and
  should stay that way; a local script that prompts for it is the pattern that worked
  (`read -s`, token used in-process, never written down).
- The approval itself must always be performed by the named human. An AI performing it would falsify
  the project's central claim.

## 13. Definition of a successful handoff

Claude is ready to continue when it can correctly explain:

- why the hosted and local assessed pipelines both exist;
- which production run proves all five stages, and that it is now `approved` rather than paused;
- why Marble Current used `in_app` rather than email;
- where private artefacts and public summaries separate;
- why Manager completion is not human approval, and why authentication alone is not authorisation;
- why approval means internal promotion only and authorises no external action;
- why `supabase db push` cannot be used here and what the only working route is;
- why a green test run is not sufficient evidence before deploying SQL;
- which exact checks must pass before the next deployment.
