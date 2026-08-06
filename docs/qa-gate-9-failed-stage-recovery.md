# Gate 9 QA — Failed-stage recovery (audited operator retry)

Date: 6 August 2026

Scope: `agents/orchestrator`. This isolated slice adds a **bounded, append-only, operator-initiated
recovery** of a run stalled at `failed`. It exists to resume an audited live run whose Researcher,
Designer and Maker succeeded but whose Communicator **failed deterministic validation** before
`communicator.v1.3` was integrated. It changes no existing artefact and never edits or removes a
failure event. **No live OpenRouter or Supabase call is made during implementation.** Codex performs
the accepted live retry after integration.

## The problem

A stage that fails deterministic validation or throws at runtime records a `stage_failed` event and
leaves the run terminal at `failed`. Before this slice the only forward paths were to start a brand-new
run or resume — neither of which can move a `failed` run past the failed stage. The audited run needs a
way to **rerun exactly the failed stage** (once its underlying agent is corrected) while preserving the
full append-only history, including the failure itself.

## What this slice delivers

### 1. One explicit append-only recovery event (`contracts.ts`)

`failed_stage_retry_requested` records the failed `stage`, the exact prior `failed_version`, a bounded
`operator_reason` (20–300 chars, trimmed) and the injected `created_at`. It is **not** an automatic
retry: the normal drive loop never emits it. It is appended **only** by the dedicated recovery
API/CLI path. Every earlier event — including the `stage_failed` it recovers — is preserved verbatim.

### 2. Pure reducer rules (`stateMachine.ts`)

`applyEvent` accepts `failed_stage_retry_requested` **only** when:

- the overall run status is `failed` and exactly the named stage is `failed` (all others rejected with
  `RUN_NOT_FAILED` / `RETRY_STAGE_MISMATCH`);
- the event's `failed_version` equals the failed stage's recorded attempt (else `STALE_VERSION`);
- **every predecessor remains `completed` with an accepted artefact**, and **every downstream stage is
  still `pending`/`invalidated` with no accepted current artefact** (a malformed history is rejected
  with `ILLEGAL_EVENT`).

The event then moves the failed stage to `invalidated` (pending-for-rerun), **clears no history**,
preserves every predecessor and event, returns the run to `in_progress`, and — because `attempt` is
left unchanged — guarantees the next start uses **attempt/version + 1**. `pending_required_changes`
stays `null`, so the rerun carries **no fabricated Manager `required_changes`**.

Because a Manager approval leaves `awaiting_human_approval` and a rejection leaves `rejected` — both
non-`failed` terminal states — this path can **never** retry a Manager approval/rejection outcome; the
"status must be `failed`" precondition structurally excludes them. This is the single event permitted to
advance a terminal `failed` run; it does not weaken any other terminal-state or human-approval
governance. It is `failedStage` (a pure helper) that names the one recoverable stage.

### 3. `Orchestrator.retryFailed(runId, operatorReason)` (`orchestrator.ts`)

Loads the hash-verified state, validates the operator reason to 20–300 characters
(`INVALID_OPERATOR_REASON`) **before** any append, derives the currently failed stage/version, appends
the single recovery event, and drives normally. The reducer re-validates every precondition when the
event is folded, so a race between load and append fails closed. There is **no external customer
action**: the drive halts at `awaiting_human_approval` exactly as a normal run does.

### 4. CLI `--retry-failed <run-id>` (`pipelineCli.ts`)

A distinct, explicit-value run mode. It acquires the run lock, validates the immutable `run-input.json`
matches the requested id (`RUN_INPUT_MISMATCH`), **requires an existing event log** (`RUN_NOT_FOUND` if
absent — it never bootstraps a genesis event), calls `retryFailed` with a safe explicit
`--retry-reason` (or a bounded default describing operator recovery after validation/runtime
correction), then exports a new immutable transcript snapshot. It is **mutually exclusive** with `--run`
and never combines bootstrap-start behaviour with a failed retry.

### 5. Live pipeline behaviour (unchanged executors)

The retried stage receives `required_changes = null`, so the live executor does **not** hit the
`REVISION_UNSUPPORTED` guard and reruns as the next artefact version, writing a fresh
`<stage>.…v<version+1>.json` with exclusive creation. The failed attempt left no accepted artefact, so
there is no overwrite. Existing exclusive artefact adoption and predecessor-lineage checks are
untouched.

### 6. Transcript visibility (`transcript.ts`)

The transcript now carries `stage_failures` (every `stage_failed`, each flagged `recovered` when a later
operator retry targets its stage+version) and `failed_stage_retries` (each recovery with its bounded
operator reason and the failure error it recovers). The Markdown renders a **"Failed-stage recovery"**
section showing both the original failure and the operator reason — the failure is **never hidden** —
alongside the later successful attempt in the existing stage-attempts table. Construction stays pure and
deterministic (byte-for-byte identical rebuilds).

## Adversarial tests (`failedStageRecovery.test.ts`, 17 new)

Pure reducer: allowed Communicator recovery (invalidated, `in_progress`); rerun at version + 1 with no
required changes; preserved predecessors, history and the failure event; wrong stage
(`RETRY_STAGE_MISMATCH`); wrong version (`STALE_VERSION`); non-failed run (`RUN_NOT_FAILED`); Manager
**approval** and **rejection** refusal (`RUN_NOT_FAILED`); malformed history with an incomplete
predecessor and with a downstream stage already holding an accepted artefact (`ILLEGAL_EVENT`);
duplicate retry (`RUN_NOT_FAILED`).

Service boundary (injected executors, no live calls): recovers a failed Communicator and drives strictly
through the Manager to `awaiting_human_approval`; Communicator reruns v2 with `required_changes = null`;
predecessors untouched, versions correct, the log preserves the failure event and records exactly one
recovery event; duplicate retry after recovery fails closed with no new event; a never-failed (approval)
run refuses recovery; a too-short reason fails closed **before** any append.

Live composition + transcript: the retried Communicator reruns as v2 and completes through the Manager,
writing a new versioned artefact; the transcript and Markdown visibly record the failure (marked
recovered) and the bounded operator reason, and two builds are byte-for-byte identical.

## Verification

- Focused orchestration suite: **104 Vitest tests** passed (was 87), including the 17 new recovery
  tests across `stateMachine`, the orchestrator service, the live composition and the transcript.
- Full suite: **252 Vitest tests** passed (was 234).
- `agent:pipeline:check` (`tsc -p tsconfig.agents.json`): passed. Main `tsc -b`: passed. ESLint: passed.
  Production build: passed.

## Explicitly out of scope

- **No live retry.** The Gate 9 checklist item "Complete pipeline transcript proves cumulative work"
  remains **unchecked**; Codex performs the accepted live failed-stage retry after integration.
- No live application of Manager `required_changes` (that bounded typed path is still deferred and
  unchanged).
- No frontend, MCP, Supabase schema, or existing-artefact/event-log changes.

## Constraints honoured

Strict TypeScript/Zod with no `any`; injected clock; bounded typed errors; append-only history with no
mutation of any existing artefact or event; no automatic retry loop (a single explicit operator event
per recovery, re-validated on replay); and no weakening of terminal human-approval governance. This
isolated slice was implemented with Claude Opus 4.8 (Medium effort) in a dedicated worktree.
