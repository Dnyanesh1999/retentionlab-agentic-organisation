# Gate 9 QA — Orchestration slice 2 (live five-agent composition)

Date: 6 August 2026

Scope: `agents/orchestrator`. This slice composes the five REAL runtimes —
Researcher (Nia Calder) → Designer (Luca Moretti) → Maker (Noor Patel) →
Communicator (Maeve Quinn) → Manager (Elias Grant) — through the slice-1 crash-safe
backbone, persists every typed artefact durably, and exports a deterministic pipeline
transcript. **No live OpenRouter or Supabase call is made during implementation.** Every
test drives the composition with injected fake agent dependencies. Codex performs and
reviews the accepted live full-pipeline run.

## What this slice delivers

### 1. Run-owned artefact store (`artifactStore.ts`)

- Every typed artefact is written under one run directory as `<stage>.<name>.v<version>.json`
  with **exclusive creation** (`wx`); an existing artefact is never overwritten.
- SHA-256 references use the repository **compact schema-parsed JSON convention**
  (`sha256(JSON.stringify(schema.parse(artifact)))`), so an orchestrator `ArtifactReference`
  and the lineage digest each downstream runtime embeds over the same artefact are
  byte-for-byte identical.
- `loadArtifactIfPresent` returns `null` **only** for an absent file (ENOENT); a torn,
  non-JSON or schema-invalid file throws (fail closed) rather than being silently accepted.

### 2. Live stage executors (`livePipeline.ts`)

- `createLiveProducers` wires the real `runResearcher`/`runDesigner`/`runMaker`/
  `runCommunicator`/`runManager` functions with their OpenRouter adapters, the live evidence
  client (Researcher) and the canonical `signal-garden-maker-implementation.v1.json`
  implementation evidence, schema-validated at startup. The Researcher's `objective` and
  frozen `initiated_at` come from a durable `run-input.json` sidecar, so its input is
  identical across a crash boundary.
- `createLivePipelineExecutors` composes injected producers into the orchestrator's five
  `StageExecutor`s over one deterministic core. The producers are the only live-service touch
  point and are injected, so tests never reach OpenRouter or Supabase.

### 3. Durable predecessor reload — never process memory

On every stage, each predecessor is **reloaded and re-hashed from disk** and compared to the
digest the committed orchestration state recorded. Any drift between disk and the event log
fails closed (`PREDECESSOR_HASH_MISMATCH` / `PREDECESSOR_MISSING_ON_DISK`). Resume therefore
depends only on durable state, not on anything held in the crashed process.

### 4. Active-stage crash-boundary adoption

An agent may write a valid versioned artefact immediately before a crash but before its
orchestration completion event. On resume the executor may **adopt** that durable, unsealed
artefact — but only after:

- schema validation,
- exact `run_id` / `account_slug` identity checks,
- stage/version pinning (the artefact lives at the exact `<stage>.…v<version>.json` path),
- predecessor **lineage** verification (the embedded predecessor SHA-256 equals the reloaded
  predecessor's recomputed digest), and
- a hash recomputation.

If any check fails, the executor **fails closed** (a typed `LivePipelineError`) rather than
overwrite or silently reuse. When an exact durable output is safely adoptable, it is adopted
**without spending another model call**.

**Revision guard precedes adoption.** The `REVISION_UNSUPPORTED` check (see §9) runs **before**
any adoption or production. Because no current live runner can consume Manager `required_changes`,
a copied or leftover schema-valid, correct-run, correct-lineage artefact already sitting at the
revision **target version** must never be adopted and falsely certified as having applied the
revision. On a revision rerun the executor fails closed first, so a stale/planted file at the
target version can never masquerade as a completed revision. An adversarial test plants exactly
such a file at the target version and proves the stage fails closed and does not adopt it.

### 5. Manager decision, seal and human boundary

The real `ManagerOperationalDecision` is projected through `deriveManagerOutcome` and sealed
by the atomic `manager_decided` event. A completed approval halts at
`awaiting_human_approval`; the pipeline never sends, publishes, deploys, mutates customer data
or triggers any external customer action.

### 6. Single-writer run lock (`runLock.ts`)

A local exclusive `run.lock` (O_EXCL) prevents two processes from driving the same run and
racing the append-only log and exclusive artefact writes. **Stale-lock recovery is
conservative and documented:** a lock is reclaimed only when the recorded host equals this
host **and** the recorded pid is provably dead (`process.kill(pid, 0)` → `ESRCH`). A
foreign-host lock, a live pid, or a pid whose liveness cannot be determined is never
auto-stolen; the operator is told to remove `run.lock` by hand after confirming no writer is
running.

**Ownership token on release (accurate concurrency claims).** Each acquisition stamps a
cryptographically random ownership token into the strict lock record (token generation is
injected so tests are deterministic). `release` re-reads and parses the *current* `run.lock`
and unlinks it **only when the token still matches**; a missing, malformed, or differently-tokened
lock is left untouched. This **narrows** the release-ownership race: a stale holder will not delete a
lock that a later reclaim has already replaced with a differently-tokened record. We do **not** claim
release can *never* delete another owner's lock — read/compare/unlink is a filesystem **TOCTOU**, so an
external or manual replacement that lands in the gap between the token comparison and the `unlink` can
still be removed; the token check narrows that window, it does not close it. Nor is the lock fully
race-proof overall: it never steals a live or foreign holder (so it excludes a concurrent writer whose
lock is intact), but stale reclamation of a provably-dead same-host lock is best-effort and not fully
serialized — two processes that both observe the same dead lock can each unlink-then-recreate it and
proceed. The **exclusive-create (`wx`) artefact writes and the verified hash-chained event replay
remain the real single-writer backstop.** An adversarial test replaces the lock file with a different
owner's token and proves `release` does not delete it (covering the reclaim-replacement case the token
check is designed for).

### 7. Deterministic transcript (`transcript.ts`, `transcriptSource.ts`)

`buildPipelineTranscript` is **pure**: given the run inputs, the ordered + hashed event log,
the replayed state and the parsed artefacts, it emits a transcript with no clock, no
randomness and **no invented claims** — every metric and string is copied straight out of a
typed artefact or an event envelope. It contains run identity, ordered event envelopes with
hashes, each stage's attempt/version with artefact path/hash/status/provenance, predecessor
lineage links, revision history, the final Manager outcome/governance, and a cumulative-work
proof whose per-handoff sentences are fixed templates filled only with copied counts and
labels. A concise Markdown rendering is produced from the same parsed data. I/O (loading
artefacts, writing files) is isolated in `transcriptSource.ts`.

**Immutable, state-versioned snapshots.** A transcript is evidence and is never overwritten.
`writePipelineTranscript` names each snapshot deterministically from the *verified* run state —
`pipeline-transcript.<status>.e<event_count>.<final-chain-hash-16>.{json,md}` — and writes it with
**exclusive creation** (`wx`). Re-exporting the **same** verified state maps to the **same** name and
is verified byte-for-byte and reused without rewriting (`reused: true`); if the on-disk bytes ever
diverged it **fails closed** rather than overwrite. A **later** state (more committed events / a
different final hash) maps to a **distinct** name and creates a new snapshot, leaving the earlier one
intact. The CLI prints the exact immutable snapshot slug and paths it wrote or reused. Tests prove an
accepted snapshot is not overwritten (and a divergent one fails closed) and that a later state creates
a distinct snapshot.

### 8. Executable CLI (`pipelineCli.ts`, `npm run agent:pipeline`)

Starts a fresh UUID run or resumes an explicit `--run <uuid>`, with safe `--account` and
`--objective` defaults and explicit `--out` output paths. It acquires the run lock, builds the
real producers, drives the orchestrator and writes both transcript renderings as immutable
state-versioned snapshots, printing the exact snapshot slug and JSON/Markdown paths (and whether an
identical snapshot was reused). This entry point performs live calls only when actually run; it is not
exercised during implementation.

**Bootstrap-safe resume (pre-genesis crash).** The CLI writes the immutable `run-input.json` *before*
`orchestrator.start` exclusive-creates the genesis event line, so a crash between the two leaves a valid
run directory with run input but no event log; a naive `--run <id>` would fail `RUN_NOT_FOUND` forever.
Resume is therefore routed through the testable `resumeExplicitRun` helper (separated from CLI parsing
and live wiring): after the lock is acquired it reads the durable run input, fails closed
(`RUN_INPUT_MISMATCH`) if its `run_id` does not equal the requested id, then bootstraps with
`orchestrator.start` (using the run input's account and mandated human approval) **iff** the event store
has no history, and otherwise resumes normally. It never writes run input and — because `start`
exclusive-creates the genesis — never overwrites an event log.

### 9. Honest revision propagation

The existing agent runners cannot yet consume Manager `required_changes` without changing
their live prompts/contracts. Rather than pretend the changes were applied, a revision rerun
**fails closed** (`REVISION_UNSUPPORTED`) before any model call, and the bounded typed
revision path is left **explicitly unchecked**. Slice 1 already proves the orchestrator's
revision *routing* (versioning, invalidation, downstream) deterministically; only the live
*application* of `required_changes` is deferred.

## Verification

- Focused orchestration suite: **87 Vitest tests** passed (was 63 at slice 1, 79 before the
  integration-review hardening, 84 before the crash-audit follow-up) across `stateMachine.test.ts`,
  `eventStore.test.ts`, `orchestrator.test.ts`, `livePipeline.test.ts`, `transcript.test.ts`,
  `runLock.test.ts` and `resumeRun.test.ts`. The
  tests cover: strict five-stage composition to `awaiting_human_approval`; durable predecessor reload
  after a simulated process restart with no completed stage re-produced; safe adoption of a valid
  unsealed artefact with the file never overwritten; fail-closed rejection of a wrong-run artefact, a
  broken-lineage artefact and a predecessor that disagrees with orchestration state; run-lock
  grant/release, refusal of a live and of a foreign-host holder, and conservative reclaim of a
  provably-dead same-host lock; transcript determinism (byte-identical rebuilds) and
  source-backing (every metric copied from a typed artefact, lineage links verified); the
  Manager approval boundary; and the honest fail-closed revision rerun. **Five adversarial tests were
  added by the integration-review hardening:** a schema-valid, correct-run, correct-lineage artefact
  planted at the revision target version is **not** adopted and the stage fails closed; `release` does
  **not** delete a lock whose ownership token has changed to a new owner; `release` leaves a malformed
  lock untouched; an accepted transcript snapshot is verified-and-reused (and a divergent one fails
  closed) rather than overwritten; and a later verified state creates a distinct snapshot without
  touching the earlier one. **Three tests were added by the crash-audit follow-up** (`resumeRun.test.ts`):
  a pre-genesis prefix (durable `run-input.json`, no event log) bootstraps into a full strict pipeline
  to `awaiting_human_approval` with the genesis carrying the immutable run input's account and mandated
  human approval; an existing event log resumes normally without re-starting or re-producing a stage;
  and run input for a different run id fails closed (`RUN_INPUT_MISMATCH`) without starting or producing
  anything.
- Full suite: **234 Vitest tests** passed (was 210 at slice 1, 226 before the hardening, 231 before the
  crash-audit follow-up).
- Agent TypeScript check (`tsc -p tsconfig.agents.json`): passed.
- Main TypeScript check (`tsc -b`): passed.
- ESLint: passed. Production build: passed.

## Explicitly out of scope for this slice

- **No live OpenRouter call and no live full-pipeline transcript.** The Gate 9 checklist item
  “Complete pipeline transcript proves cumulative work” remains **unchecked**; it is proven
  only by Codex's accepted live composition of the five agents through this backbone.
- No live application of Manager `required_changes` (revision rerun fails closed); that bounded
  typed path is left for a future slice with a live proof.
- No change to frontend behaviour, Supabase, the MCP server, existing agent semantics or
  validation, canonical accepted artefacts, or secrets.

## Constraints honoured

Strict TypeScript/Zod with no `any`; no secrets in artefacts, transcripts or logs; no
frontend/Supabase-schema/MCP-server changes; no destructive writes (exclusive creation and
fail-closed adoption); no weakening of any existing agent validation. Deterministic transcript
construction is separated from I/O, and all clocks, UUIDs, models, gateways and runners are
injected so tests never touch a live service.

This isolated slice was implemented with Claude Opus 4.8 (Medium effort). Codex will review and
integrate it and drive the subsequent live full-pipeline transcript.
