# Claude handoff — RetentionLab

Handoff date: 14 August 2026

This document lets a fresh Claude Code session continue without relying on the prior Codex conversation.
Treat repository code, committed QA evidence and live read-only checks as authoritative when they disagree
with a summary.

## 1. Current outcome

RetentionLab is a portfolio-grade, consent-first agentic organisation for fictional B2B SaaS retention.
It has exactly five bounded agents:

`Researcher → Designer → Maker → Communicator → Manager`

The complete pipeline is hosted and live through Supabase Edge Functions. A production Marble Current
run completed all five stages and is paused at the mandatory human-approval boundary. No customer
communication or other external action occurred.

- Public site: <https://dnyanesh1999.github.io/retentionlab-agentic-organisation/#/control-room>
- GitHub repository: <https://github.com/Dnyanesh1999/retentionlab-agentic-organisation>
- Supabase project ref: `luwrufuouosytyhdqnme`
- Current `retentionlab-runs` Edge deployment: version `19`, active
- Accepted production run: `982ac99a-d9aa-47a6-ba61-09f366143715`
- Accepted status: `awaiting_human_approval`
- Main merge commit: `0a135b63d4b7748345ba9f6ddf32fc78a69dcbc1`
- Completing PR: <https://github.com/Dnyanesh1999/retentionlab-agentic-organisation/pull/7>
- Full production proof: `docs/qa-hosted-five-agent-pipeline.md`

At handoff, `main` equals `origin/main` and the worktree is clean before this handoff document is added.

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

**Status: implemented on `claude/human-approval-portfolio`, not yet applied or deployed.** Slices A, B
and C below are built and locally verified; see `docs/qa-human-approval.md` for exactly what is proven
and the outstanding live-probe list. The remaining work is: apply the one forward-only migration
`20260814153107_add_human_approval_decision.sql`, seed an operator into `private.approval_operators`,
redeploy the run function, and complete section 4 of that QA document.

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
- Human approval and hosted-case portfolio promotion are implemented but not yet applied or deployed.
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

## 8. Supabase operational warning

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

Baseline on `claude/human-approval-portfolio` (14 August 2026):

- 417 Vitest application tests passed.
- 27 hosted Deno worker tests passed.
- TypeScript, agent pipeline check, ESLint and production build passed.
- 16 release tests and 2 data tests passed.
- Secret scan clean across 309 tracked files.
- Pages build 569,544 bytes JavaScript against a 1,200,000-byte ceiling.

Baseline at the previous handoff (`main` at `9e9936d`): 399 Vitest tests, 15 hosted worker tests,
311 tracked files (the earlier "309 tracked files" line predated the handoff commit) and 553,387 bytes.
- Desktop and 390×844 browser QA: zero page overflow and zero console warning/error.

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

> Read `CLAUDE.md` and `docs/claude-handoff.md` completely, then inspect the referenced source and QA
> files. Confirm the current branch, clean worktree, live-vs-assessed architecture and non-negotiable
> governance boundaries. Do not implement yet. Return: (1) your verified understanding, (2) any stale or
> contradictory handoff claim backed by file evidence, and (3) a feature-by-feature plan for the
> authenticated human decision and portfolio promotion workflow. Preserve exactly five agents, private
> artefacts, append-only failures, exact hash lineage, synthetic data and zero autonomous external
> actions. Use Opus at medium effort if available and conserve tokens without reducing verification.

## 13. Definition of a successful handoff

Claude is ready to continue when it can correctly explain:

- why the hosted and local assessed pipelines both exist;
- which production run proves all five stages;
- why Marble Current used `in_app` rather than email;
- where private artefacts and public summaries separate;
- why Manager completion is not human approval;
- why an approved case is not yet dynamically promoted to Portfolio;
- how to add a forward-only migration without replaying live migration history;
- which exact checks must pass before the next deployment.
