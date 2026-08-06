# Gate 9 QA — Orchestration slice 1 (deterministic backbone)

Date: 6 August 2026

Scope: `agents/orchestrator`. This slice implements the deterministic orchestration backbone that
sequences the five existing runtimes — Researcher (Nia Calder) → Designer (Luca Moretti) → Maker
(Noor Patel) → Communicator (Maeve Quinn) → Manager (Elias Grant). It does **not** make any live
OpenRouter call and does not yet produce a live full-pipeline transcript. Stage executors are
injectable so a later CLI/live pipeline can compose the five agents unchanged.

## What this slice delivers

### 1. Strict typed contracts (`contracts.ts`)

- The fixed five-stage order and the revisable subset (`researcher…communicator`; the Manager never
  revises itself).
- `RunStatus` (`in_progress`, `awaiting_human_approval`, `revision_required`, `rejected`, `failed`)
  and per-stage `StageStatus` (`pending`, `active`, `completed`, `superseded`, `invalidated`,
  `failed`) with explicit `attempt`/`version` counters.
- Immutable, content-addressed `ArtifactReference` (SHA-256, `status_label`, `produced_at`).
- A `ManagerOutcome` view and `deriveManagerOutcome`, projected from the sealed
  `ManagerOperationalDecision`, so the live Manager runtime wires in without change.
- An append-only `OrchestratorEvent` union and a tamper-evident `EventEnvelope`
  (`seq`, `prev_hash`, `hash`).

### 2. Deterministic state machine (`stateMachine.ts`)

A pure `applyEvent(state, event)` reducer with no I/O, no clock and no hidden mutation. It:

- enforces `run_started` first and exactly once;
- refuses to skip or reorder stages (`expectedStage` is the only startable stage);
- rejects stale/out-of-order start and completion versions;
- rejects double completion (completing a non-active stage);
- refuses any progress after a terminal state (`awaiting_human_approval`, `rejected`, `failed`);
- seals the Manager atomically: a single `manager_decided` event both completes the Manager stage
  (its immutable artefact reference) and records the validated `ManagerOutcome`, applying it to the
  correct terminal (`awaiting_human_approval`/`rejected`) or `revision_required` state in one durable
  step. A bare `stage_completed` for the Manager is refused, so a completed Manager can never coexist
  with an `in_progress` run;
- recomputes revision downstream/invalidation sets and rejects any payload that disagrees.

`firstIncompleteStage` returns the resume plan; a completed approval resolves to a terminal
`awaiting_human_approval` plan and never to an executable stage. Because Manager completion and its
decision land as one event, there is no valid persisted prefix in which the Manager is completed but
its decision is missing — the earlier `await_manager_decision`/manual-repair state is unreachable and
has been removed.

### 3. Append-only JSONL event/checkpoint store (`eventStore.ts`)

- Exclusive-create (`wx`) for the genesis line — an accepted run history is never overwritten.
- Append-only for every subsequent event.
- Each line is one enveloped event; `hash` chains over `(seq, prev_hash, canonical event)`.
- `parseAndVerifyChain` detects corrupted (non-JSON / invalid), duplicated / mis-sequenced,
  chain-broken and content-tampered histories of any **retained** prefix.
- Rehydration replays the verified stream through the reducer, so a logically inconsistent history
  (e.g. a skipped stage) is also re-detected on load, and the `manager_decided` seal is re-validated
  through the hash chain on every load.
- A file backend and an in-memory backend share the same integrity logic.

**Tail truncation is a deliberate non-claim.** A cleanly tail-truncated chain (whole trailing lines
lost) is still a valid shorter prefix: there is no separate durable head/length marker, so the store
does not — and cannot — flag it as tampering. This is safe by construction, because every valid
prefix folds to a resumable state and the atomic `manager_decided` seal guarantees no prefix strands a
completed-but-undecided Manager. A partially written trailing line (a torn append) is rejected as
invalid JSON (`CORRUPTED_HISTORY`) rather than silently accepted.

### 4. Crash-safe resume (`orchestrator.ts`)

`start` and `resume` share a single `drive` loop. After replay the orchestrator continues from the
first incomplete stage; a stage left `active` by a crash is re-executed **without** emitting a
duplicate start event. A fully completed approval resumes only at `awaiting_human_approval` and
executes no external action.

The Manager boundary is the case Codex's integration review flagged, and it is now crash-safe by
construction. A crash **immediately before** the atomic `manager_decided` append leaves the Manager
`active`; resume simply re-runs it (the outcome was never persisted, so nothing is lost) and never
requires manual repair. A crash **at** the seal leaves a terminal or `revision_required` state; resume
routes deterministically from the durable outcome, never re-calling the sealed Manager and never
guessing its decision. There is no intermediate torn state between the two.

### 5. Manager revision routing

From the Manager outcome the orchestrator: targets exactly one stage; increments that stage's
attempt/version; invalidates only the target, its declared downstream and the Manager; preserves
every superseded artefact reference in stage history; and reruns in strict order through the Manager.
It rejects a directive whose runtime-computed downstream disagrees with the Manager payload, and
rejects an approval that either does not require a human or permits anything but
`await_human_approval`.

### 6. Injectable executors

`OrchestratorExecutors` is a record of five `StageExecutor` functions. This slice makes no live model
call; the deterministic backbone is fully exercised with pure, deterministic executors.

## Verification

- Focused orchestration suite: 63 Vitest tests passed across `stateMachine.test.ts`,
  `eventStore.test.ts` and `orchestrator.test.ts`, covering strict order, skipped/reordered stages,
  duplicate and stale completion, invalid hashes, corrupted/duplicated/tampered replay,
  interruption/resume at multiple stages — including immediately before and at the atomic Manager
  seal — a proof that every valid persisted prefix resumes without manual repair, hash-chain
  validation of the `manager_decided` seal, the documented tail-truncation non-claim, the approval
  boundary (no external action), revision and reject resume correctness, version increments, preserved
  superseded history and rejection/failure terminality.
- Full suite: 210 Vitest tests passed (was 147 at Gate 8).
- Agent TypeScript check (`tsc -p tsconfig.agents.json`): passed.
- Main TypeScript check (`tsc -b`): passed.
- ESLint: passed. Production build: passed.

## Explicitly out of scope for this slice

- No live OpenRouter call and no live full-pipeline transcript. The Gate 9 checklist item
  “Complete pipeline transcript proves cumulative work” remains **unchecked**; it is proven only by a
  later live composition of the five agents through this backbone.
- No change to frontend behaviour, Supabase, MCP, existing agent semantics, canonical accepted
  artefacts or secrets.

This isolated slice was implemented with Claude Opus 4.8 (Medium effort). Codex will review and
integrate it, and drive the subsequent live full-pipeline transcript.

## Correction after Codex integration review

Codex's integration review found one blocking correctness gap: the original Manager path appended
`stage_completed` and then a **separate** decision event (`approval_awaited` / `revision_required` /
`run_rejected`). A crash between those two appends replayed into an `await_manager_decision` state
that threw "manual repair required", violating the Gate 9 "interrupted runs resume safely" claim.

The fix replaces both appends with one atomic `manager_decided` event that carries the Manager
version, its immutable artefact reference and the validated `ManagerOutcome`. The pure reducer applies
that single durable event straight to the correct terminal or `revision_required` state, preserving
every strict-ordering, version, downstream and human-governance check. A bare `stage_completed` for
the Manager is now rejected, so the completed-but-undecided window no longer exists; the
`await_manager_decision`/manual-repair plan is unreachable and has been deleted. File- and
memory-store replay validate the `manager_decided` event through the hash chain like any other event.
The tamper-evidence documentation was also corrected to stop implying generic tail-truncation
detection, which the hash chain does not provide without a separate durable head marker.
