# AI usage log

This log supports the assignment requirement to cite AI-generated content. Exact exported task metadata should be attached before final submission.

## Entry 001 — project requirements and architecture

- Date: 4–5 August 2026
- Tool/model: OpenAI Codex, GPT-5 family. Exact runtime model identifier is to be copied from the Codex task export.
- User prompt: “Before implementing plan just need to confirm, are we following all the instructions as per final project. Are we fully aligned to that. I want to build step by step, feature by feature…”
- AI contribution: audited the supplied final-project PDF; proposed the compliance matrix, architecture boundaries and incremental gates.
- Student responsibility: verify the matrix against the supplied brief and approve the RetentionLab interpretation.
- Verification: requirements were re-extracted from the original PDF and mapped in `docs/brief-compliance.md`.

## Entry 002 — Gate 0 and Gate 1 implementation

- Date: 5 August 2026
- Tool/model: OpenAI Codex, GPT-5 family. Exact runtime model identifier is to be copied from the Codex task export.
- User prompt: “Lets go then bro. Lets get started.” The prompt continued the previously approved RetentionLab plan and Case Theatre concept.
- AI contribution: generated the project scaffold, compliance documentation, design system, React interface shell, tests and browser QA evidence.
- Student responsibility: review the implementation, run it locally and approve the gate before live data work begins.
- Verification: tests, typecheck, lint, production build, dependency audit and desktop/mobile browser checks passed.

## Entry 003 — Gate 2 schema and synthetic-data generator

- Date: 5 August 2026
- Tool/model: OpenAI Codex, GPT-5 family. Exact runtime model identifier is to be copied from the Codex task export.
- User prompt: “go ahead”, continuing the approved instruction to build step by step and verify each feature before proceeding.
- AI contribution: designed the relational Supabase evidence schema, least-privilege access boundary, resilient synthetic-data generator and generator contract tests.
- Student responsibility: approve the dedicated Supabase project and verify that all generated organisations are clearly fictional.
- Verification: generator tests, frontend tests, typecheck, lint and production build pass locally. Cloud migration, database advisors and row-change proof remain open until the project is approved.

## Entry 004 — Gate 3 MCP evidence layer

- Date: 5 August 2026
- Tool/model: OpenAI Codex, GPT-5 family. Exact runtime model identifier is to be copied from the Codex task export.
- User prompt: “Great, lets go ahead”, continuing the approved incremental delivery plan after Gate 2.
- AI contribution: implemented the deployed Supabase evidence gateway, official MCP v2 stdio server, seven read-only evidence tools, strict contracts, protocol tests and live source smoke proof.
- Student responsibility: verify that the seven tool boundaries are appropriate for the intended Researcher agent and preserve the exported live MCP transcript for submission.
- Verification: initialize, tools/list and all seven tools/call paths passed against the live Supabase dataset; a deliberate source failure returned no structured evidence.

## Entry 005 — Gate 4 Researcher implementation

- Date: 5 August 2026
- Tool/model: OpenAI Codex, GPT-5 family. Exact runtime model identifier is to be copied from the Codex task export.
- User prompt: “lets go with openrouter”, selecting the model gateway for the previously approved incremental Researcher gate.
- AI contribution: implemented Nia Calder's versioned prompt, Zod contracts, OpenRouter synthesis adapter, deterministic MCP evidence intake, citation-integrity checks, immutable artefact writer and tests.
- Student responsibility: review the live ResearchBrief and approve it as the Designer's typed predecessor before Gate 5 begins.
- Verification: the first live brief exposed a contradictory Designer handoff and was retained but not advanced. Prompt `researcher.v1.1.0` produced accepted run `b921755d-f96a-45f0-bd72-7791ceb13ef7` through `nvidia/nemotron-3-super-120b-a12b:free`. The revised persisted brief passed schema and citation-integrity validation without requiring an unknowable exact workflow cause.

## Entry 006 — Gate 5 Designer implementation

- Date: 5 August 2026
- Tool/model: OpenAI Codex, GPT-5 family, for implementation and review; OpenRouter `nvidia/nemotron-3-super-120b-a12b:free` for live Designer synthesis.
- User prompt: “lets go ahead”, continuing the approved feature-by-feature build after the OpenRouter key was configured.
- AI contribution: implemented Luca Moretti's versioned prompt, strict RecoveryDesignSpecification contract, lineage and consent guards, live synthesis adapter, bounded revision path, rejection archive and controlled promotion review.
- Student responsibility: review and approve the Signal Garden specification before Maker implementation, and retain the rejection/review evidence for assessment transparency.
- Verification: nine live candidates were rejected and preserved for issues including invented granularity, decorative metaphors, technology violations, coercive focus behavior and conventional campaign design. Candidate v8 was promoted after four recorded bounded corrections (three keyboard-focus defects and one binding typo); the before/after hashes and correction ledger are stored in `quality-review.json`. Gate 6 preflight found the third focus defect inside a nested criterion, preserved the v1 artefacts, strengthened the runtime guard and issued `designer-quality-review.v2`. The final artefact passes integrity validation and is `ready_for_maker`.

## Open citation item

The approved Case Theatre image was generated in an earlier Codex design task. Its exact image-generation model identifier and full generation prompt must be copied verbatim from that task transcript into this log before submission; they are intentionally not reconstructed from memory here.

## Entry 007 — Gate 6 concept and two-model architecture review

- Date: 5 August 2026
- Tools/models: OpenAI Codex, GPT-5 family; built-in OpenAI Image Generation; GitHub Copilot app Auto model selection. Exact provider model identifiers must be copied from task/session exports when available.
- User prompt: “Lets go bro continue our task and lets have github copilot in our team, add our new project there and continue from where we left off.”
- AI contribution: connected a dedicated secret-safe RetentionLab repository to GitHub Copilot; generated and corrected the Signal Garden primary-screen concept; asked Copilot for a read-only Plan-mode architecture review; adjudicated its recommendations; implemented the first Maker contract and Loading-state slice.
- Student responsibility: approve the Signal Garden visual direction and the incremental Maker scope before live evidence is displayed in the Recovery Room.
- Verification: Copilot worked in isolated worktree `dnyanesh1999-silver-potato`, read seven allow-listed files, modified no repository files and used 2% of the displayed AI-credit quota. Codex did not approve Copilot Autopilot. The saved concept is `design/reference/signal-garden-maker-concept-v1.png`; the separate review/adjudication record is `docs/copilot-review-gate-6-slice-1.md`.

## Entry 008 — Gate 6 live evidence boundary review

- Date: 5 August 2026
- Tools/models: OpenAI Codex, GPT-5 family; GitHub Copilot app Auto model selection. Exact provider model identifiers must be copied from task/session exports when available.
- User prompt: “lets get continue make sure you use github copilot to you help side by side”.
- AI contribution: Copilot independently reviewed the existing Edge Function/MCP boundary and proposed security, cancellation, freshness and no-fallback checks. Codex checked the findings against current Supabase documentation, corrected Copilot's overbroad treatment of publishable keys, implemented the adapter and state boundary, and deployed the browser CORS update.
- Student responsibility: review the accepted/deferred findings and approve Slice 2 before the visible Signal Garden canvas is implemented.
- Verification: Copilot worked in isolated worktree `dnyanesh1999-psychic-adventure`, changed no repository files and was not approved for Autopilot. Supabase Edge Function version 2 passed live preflight, cross-origin POST, strict adapter normalization and the existing seven-tool MCP smoke. The adjudication is stored in `docs/copilot-review-gate-6-slice-2.md`.

## Entry 009 — Gate 6 Signal Garden collaborative implementation

- Date: 5 August 2026
- Tools/models: OpenAI Codex, GPT-5 family; Claude Code, Opus 4.8 at High effort. Exact provider model identifiers must be copied from task/session exports when available.
- User prompt: “definitely lets set up claude code new session with our project and give the plan and task to it and work collaboratively”, followed by permission to continue.
- AI contribution: Claude implemented the isolated inspectable `SignalStrand` and its tests in a dedicated worktree. Codex reviewed and integrated that commit, implemented the live canvas and route, completed responsive styling, diagnosed the browser-only native-fetch binding defect, added the regression assertion and ran final browser/engineering QA.
- Student responsibility: review the live Signal Garden interaction and approve Slice 3 before the clarification-consent persistence work begins.
- Verification: Claude's isolated component suite passed before integration. The integrated suite, typecheck, lint, production build, browser preflight, live browser ready state, pointer/Escape interaction and seven-tool MCP smoke passed. The scope and fidelity record is stored in `docs/qa-gate-6-slice-3.md`.

## Entry 010 — Gate 6 clarification consent and persistence

- Date: 5–6 August 2026
- Tools/models: OpenAI Codex, GPT-5 family; built-in OpenAI Image Generation; Claude Code, Opus 4.8 at High effort; GitHub Copilot app Auto model selection for independent review. Exact provider model identifiers must be copied from task/session exports when available.
- User prompt: “lets move ahead now together with our team”, continuing the approved feature-by-feature Maker delivery.
- AI contribution: Codex generated corrected desktop/mobile clarification concepts, implemented strict consent contracts, the dialog, capability handling, flow integration, private Supabase persistence and live browser QA. Claude independently implemented the support-evidence contract, adapter and expandable strand in an isolated worktree; Codex reviewed and merged commit `a5cc853`. Copilot was assigned a final read-only Slice 4 review after integration.
- Student responsibility: review the live clarification interaction and approve Slice 4 before the post-submit states and full release QA begin.
- Verification: the browser discovered and drove correction of a real offset-timestamp adapter defect. Live QA proved that “Not now” left the capability active with no submission, while an empty optional Share consumed it once and stored `NULL` with the exact consent action/version. Copilot's final findings were independently checked; false positives and one Slice 5 visual-regression deferral are recorded in `docs/copilot-review-gate-6-slice-4.md`. Full evidence is in `docs/qa-gate-6-slice-4.md`.

## Entry 011 — Gate 6 acknowledgment and accessibility completion

- Date: 6 August 2026
- Tools/models: OpenAI Codex, GPT-5 family; built-in OpenAI Image Generation. Exact provider model identifiers must be copied from task/session exports when available.
- User prompt: “lets move ahead bro”, continuing the approved feature-by-feature Maker delivery.
- AI contribution: Codex extracted the canonical Slice 5 states, generated desktop/mobile acknowledgment concepts, rejected an initial mobile candidate that invented unsupported metrics, implemented the reusable botanical status response and outcome wiring, added axe-core accessibility coverage, and completed responsive browser and visual-fidelity QA.
- Student responsibility: review and approve the completed Maker interaction before Gate 9 orchestration begins.
- Verification: exact-copy, five-second expiry, static reduced-motion, declined focus return, successful-trigger removal and failed-share draft preservation tests passed. The complete suite passed 114 Vitest tests, four Deno tests, two data-invariant tests, typecheck, lint and production build. Rendered contrast, 390 px mobile containment and 200%-equivalent reflow are recorded in `docs/qa-gate-6-slice-5.md`.

## Entry 012 — Gate 6 Maker agent handoff

- Date: 6 August 2026
- Tools/models: OpenAI Codex, GPT-5 family, for implementation and verification; OpenRouter `nvidia/nemotron-3-super-120b-a12b:free` for live Maker synthesis.
- User prompt: “lets go then”, beginning the next incremental pipeline phase.
- AI contribution: Codex re-audited the professor's PDF, identified that the functional Maker still lacked its required typed agent handoff, implemented Noor Patel's prompt/contracts/runtime, bound the real build evidence and ran the live Maker stage. Codex rejected a superficially valid first candidate, strengthened aggregate-evidence language and corrected an overbroad causality guard before accepting the next result.
- Student responsibility: review the accepted Maker artefact and its rejected predecessor before the Communicator stage is promoted.
- Verification: the accepted `maker.v1.1.0` artefact is SHA-256 bound to the reviewed Designer output, records commit `c38febd`, preserves all seven interaction states and is `ready_for_communication`. Full evidence is in `docs/qa-gate-6-maker-agent.md`.

## Entry 013 — Gate 7 Communicator

- Date: 6 August 2026
- Tools/models: OpenAI Codex, GPT-5 family, for implementation and verification; OpenRouter `nvidia/nemotron-3-super-120b-a12b:free` for live Communicator synthesis.
- User prompt: “lets go then”, continuing the corrected five-agent sequence.
- AI contribution: Codex designed Maeve Quinn's prompt/contracts/runtime, implemented exact Maker-claim inheritance and consent-safe communication guards, then ran and reviewed the live stage. A truncated, identifier-leaking first candidate was rejected; two bounded prompt revisions separated public copy from internal audit citations before acceptance.
- Student responsibility: review the email invitation and Manager decision packet, including whether the aggregate metrics should remain in the final customer copy.
- Verification: `communicator.v1.2.0` produced a complete email-only plan with a view-only CTA, no automated follow-up and status `ready_for_manager`. Full evidence is in `docs/qa-gate-7-communicator.md`.

## Entry 014 — Gate 8 Manager

- Date: 6 August 2026
- Tools/models: Claude Code, Opus 4.8, for implementation and verification. Live Manager synthesis uses OpenRouter `nvidia/nemotron-3-super-120b-a12b:free` at run time; the exact resolved model identifier is sealed into each decision's provenance.
- User prompt: “Implement Gate 8 Manager agent for RetentionLab and commit the completed work… Build agents/manager for Elias Grant, a calm, accountable, adversarially constructive leader.”
- AI contribution: implemented Elias Grant's versioned `manager.v1.0.0` prompt, the strict complete-chain Zod input and `ManagerOperationalDecision` output contracts, the deterministic runtime that verifies same-run/same-account, required completed statuses and the exact SHA-256 lineage before any model use, the runtime-owned identity/lineage/provenance and fixed human-approval governance, the approve/revise/reject decision path with single-target bounded revisions, the OpenRouter adapter/config/CLI, and the prompt, contract and runtime tests.
- Student responsibility: review the Manager decision contract and human-approval boundary, and confirm that no approval path can send a message, publish, mutate customer data or bypass a human before Gate 9 orchestration begins.
- Verification: 12 Manager tests (broken hashes, mismatched runs, approving a paused plan, human boundary, bounded correction) plus the full 143-test suite, the agent TypeScript check, ESLint and the production build passed. Gate 8 deliberately implements no orchestration. Full evidence is in `docs/qa-gate-8-manager.md`.

## Entry 015 — Gate 8 Manager output-quality refinement (manager.v1.1.0)

- Date: 6 August 2026
- Tools/models: Claude Code, Opus 4.8, for implementation and verification. Live Manager synthesis continues to use OpenRouter `nvidia/nemotron-3-super-120b-a12b:free`; the exact resolved model identifier is sealed into each decision's provenance.
- User prompt: “Refine the newly integrated Gate 8 Manager after a rejected live manager.v1.0.0 decision… Implement manager.v1.1.0 as the current prompt version while allowing v1.0.0 provenance for preserved artefacts. Add deterministic output-quality validation before acceptance…”
- AI contribution: reviewed the first live Manager decision and found it schema-valid and governance-safe but unacceptable — multiple `executive_summary`, `chain_assessment` and `human_review_focus` strings ended mid-word or mid-sentence and one review item leaked a stray CJK glyph. Preserved that decision unmodified at `design/specifications/signal-garden-manager-decision.rejected.manager-v1.0.0.json`. Bumped the current prompt to `manager.v1.1.0` (keeping `manager.v1.0.0` provenance valid for the archived artefact), strengthened the system prompt to demand concise complete sentences well below each field limit with no CJK or unexpected glyphs, and added a deterministic `assertOutputQuality` gate that runs before a decision is sealed. The gate covers `executive_summary`, `rationale`, every `cumulative_contribution`, every trust `finding`, every `human_review_focus` item and, when present, the revision `reason` and each `required_change`; it rejects truncated prose and CJK/unexpected glyphs and returns precise, bounded single-field correction feedback through the existing two-attempt revision loop. Chain hashing, same-run/same-account and status checks, the human-approval governance and the single-target bounded revision path were left unchanged; no orchestration or frontend behaviour was added.
- Student responsibility: review the accepted `manager.v1.1.0` decision and make the named human approval decision; the system itself cannot send, publish, deploy or mutate customer data.
- Verification: the rejected `manager.v1.0.0` live decision is recorded separately. A fresh live `manager.v1.1.0` run passed the deterministic prose gate and returned `approve`, `chain_verified = true`, `human_approval_required = true`, `autonomous_external_actions = false` and `permitted_next_action = await_human_approval`. The accepted decision is preserved at `design/specifications/signal-garden-manager-decision.v1.json`. Sixteen Manager tests (including adversarial truncated-prose, unexpected-glyph and successful bounded-correction cases), the full suite, the agent TypeScript check, ESLint and the production build passed. Full evidence is in `docs/qa-gate-8-manager.md`.

## Entry 016 — Gate 9 orchestration slice 1 (deterministic backbone)

- Date: 6 August 2026
- Tools/models: Claude Code, Claude Opus 4.8 at Medium effort, implemented this isolated slice and verified it locally. No live model call is made by this slice; the later live full pipeline will continue to use the agents' existing OpenRouter runtimes. Codex will review and integrate this slice and drive the subsequent live full-pipeline transcript.
- User prompt: “Implement the first production-quality Gate 9 slice: the deterministic orchestration backbone… strict typed contracts for the five-stage order, a deterministic state machine that cannot skip/reorder/double-complete stages, an append-only local JSONL event/checkpoint store, crash-safe resume, Manager revision routing from the existing ManagerOperationalDecision, injectable stage executors with no live OpenRouter calls, adversarial Vitest coverage, and docs.”
- AI contribution: added `agents/orchestrator` — strict Zod contracts for the five-stage order (run and per-stage attempt/version status, immutable SHA-256 artefact references, transition reasons and the terminal states `awaiting_human_approval`, `revision_required`, `rejected`, `failed`); a pure, I/O-free state machine that enforces strict order, rejects stale/out-of-order and duplicate completions and refuses progress after a terminal state; an append-only JSONL event/checkpoint store using exclusive-create and append semantics with a `prev_hash`/`hash` chain that detects corrupted, duplicated and tampered histories and rehydrates by replaying and re-validating the full stream; crash-safe resume that returns the first incomplete stage and resolves a completed approval only to `awaiting_human_approval` with no external action; an atomic `manager_decided` event that seals Manager completion, its immutable artefact reference and the validated `ManagerOutcome` in one append-only write — so no interrupted run can strand a completed-but-undecided Manager and no valid persisted prefix requires manual repair (a plain `stage_completed` for the Manager is refused, and the removed manual-repair/`await_manager_decision` state is now unreachable); Manager revision routing that targets one stage, increments its version, invalidates only the target plus its runtime-computed downstream and the Manager, preserves superseded artefact references in history and reruns in strict order, rejecting directives whose declared downstream disagrees with the runtime and approvals that do not require a human or permit any non-await action; injectable stage executors so a later CLI/live pipeline composes the five existing agents unchanged; and 63 adversarial Vitest tests. A follow-up correction (this entry) addressed a Codex integration-review finding: the earlier design appended `stage_completed` then a separate decision event, so a crash between them replayed into a manual-repair state — the atomic seal eliminates that torn window. The tamper-evidence claim was also corrected to be honest about tail truncation: a cleanly tail-truncated hash-chained log remains a valid earlier prefix (there is no separate durable head/length marker), which resumes safely rather than being flagged as tampering.
- Student responsibility: review the deterministic backbone and its human-approval boundary, and confirm that no orchestration path can send, publish, deploy or mutate customer data, and that the live full-pipeline transcript is still owned by a later, explicitly live composition step.
- Verification: 63 orchestration tests (strict order, skipped/reordered stages, duplicate and stale completion, invalid hashes, corrupted/duplicated/tampered replay, interruption/resume at multiple stages including immediately before and at the atomic Manager seal, a proof that every valid persisted prefix resumes without manual repair, the approval boundary with no external action, revision and reject resume correctness, version increments, preserved superseded history, and rejection/failure terminality), the full 210-test suite, the agent TypeScript check, the main `tsc -b` check, ESLint and the production build all passed. Only the first three Gate 9 checklist items are marked complete; the live complete-pipeline transcript remains open. Full evidence is in `docs/qa-gate-9-orchestration-slice-1.md`.

## Entry 017 — Gate 9 orchestration slice 2 (live five-agent composition)

- Date: 6 August 2026
- Tools/models: Claude Code, Claude Opus 4.8 at Medium effort, implemented this isolated slice in a dedicated worktree and verified it locally. No live OpenRouter or Supabase call is made during implementation; every test uses injected fake agent dependencies. Codex will perform and review the accepted live full-pipeline run.
- User prompt: “Implement RetentionLab Gate 9 orchestration slice 2 in a new isolated Claude worktree… compose the five REAL agent runtimes through the crash-safe orchestrator and produce an executable, inspectable full-pipeline CLI plus deterministic transcript export.”
- AI contribution: added a live composition layer over the slice-1 backbone in `agents/orchestrator`. A run-owned artefact store persists every typed artefact as `<stage>.<name>.v<version>.json` with exclusive creation and compact schema-parsed SHA-256 references matching each runtime's embedded lineage digests. Injected stage executors call the real `runResearcher`/`runDesigner`/`runMaker`/`runCommunicator`/`runManager` functions (with their OpenRouter adapters, the live evidence client for the Researcher, and the canonical `signal-garden-maker-implementation.v1.json` implementation evidence, schema-validated at startup). On resume every predecessor is reloaded and re-hashed from disk, never trusted from process memory; at the active-stage crash boundary a valid unsealed artefact is adopted only after schema, exact run/account/stage/version, predecessor-lineage and hash checks, and otherwise fails closed with no overwrite and no extra model call. The real `ManagerOperationalDecision` is projected through `deriveManagerOutcome` and sealed by the atomic `manager_decided` event; a completed approval halts at `awaiting_human_approval` and never sends, publishes, deploys, mutates customer data or triggers any external customer action. A local exclusive `run.lock` prevents concurrent writers with conservative, documented stale-lock recovery (same host and provably dead pid only). A deterministic, source-backed transcript is exported as JSON and Markdown from the parsed artefacts and the verified event log, with pure construction separated from all I/O. An `agent:pipeline` CLI starts a fresh UUID run or resumes an explicit run id with safe defaults and explicit output paths. Revision propagation is honest: because the existing agent runners cannot yet consume Manager `required_changes` without changing their live prompts/contracts, a revision rerun fails closed rather than pretend the changes were applied, and that bounded typed path is left explicitly unchecked. All existing agent validation, contracts, frontend, Supabase, MCP server and secrets were left unchanged.
- Student responsibility: review the composition layer, the crash-adoption safety checks and the human-approval boundary, and confirm that the live complete-pipeline transcript remains owned by Codex's explicitly live run before the Gate 9 checklist item is marked complete.
- Verification: 16 new adversarial Vitest tests (strict five-stage composition, durable predecessor reload after a simulated process restart, safe adoption of a valid unsealed artefact with no re-produced work, rejection of wrong-run/broken-lineage/state-disagreeing artefacts, run-lock grant/refuse/stale-reclaim behaviour, transcript determinism and source-backing, the Manager approval boundary, and the honest fail-closed revision rerun) plus the full 226-test suite, the agent TypeScript check, the main `tsc -b` check, ESLint and the production build all passed. The Gate 9 item “Complete pipeline transcript proves cumulative work” remains unchecked pending Codex's live run. Full evidence is in `docs/qa-gate-9-orchestration-slice-2.md`.
- Follow-up correction (Codex integration review): fixed three blocking robustness gaps in this slice without broadening scope. (1) **Revision adoption bypass** — the executor's `REVISION_UNSUPPORTED` guard now runs *before* any adoption or production, so a copied/leftover schema-valid, correct-run, correct-lineage artefact already present at the revision target version can no longer be adopted and falsely certified as having applied the Manager `required_changes`; the stage fails closed. (2) **Lock release ownership race** — the strict lock record now carries a cryptographically random ownership token (generation injected for deterministic tests); `release` re-reads and parses the current `run.lock` and unlinks it only when the token still matches, so it will not delete a lock a later reclaim already replaced. The header's concurrency claims were corrected to be honest: stale reclamation of a provably-dead same-host lock is best-effort and not fully serialized, and the exclusive-create artefact writes plus hash-chained log remain the real single-writer backstop. (3) **Transcript evidence overwrite** — transcript exports are now immutable, exclusively-created snapshots named deterministically from the verified state (`pipeline-transcript.<status>.e<event_count>.<final-hash-16>.{json,md}`); the same state verifies-and-reuses the identical snapshot (or fails closed on divergence), a later state creates a distinct snapshot, and a prior transcript is never overwritten. The CLI now prints the exact immutable snapshot slug/paths. Five adversarial tests were added (planted-artefact non-adoption, lock ownership-change and malformed-lock release, snapshot no-overwrite, later-state distinct snapshot). Focused orchestration suite is now **84 tests** and the full suite **231 tests**; `agent:pipeline:check`, `tsc -b`, ESLint and the production build all passed. No live call and no commit.
- Follow-up correction (Codex final crash audit): closed one bootstrap gap and one overclaim, scope-tight. (1) **Pre-genesis crash resume** — the CLI writes the immutable `run-input.json` before `orchestrator.start` creates the genesis event, so a crash between the two left run input with no event log and a later `--run <id>` failed `RUN_NOT_FOUND` forever. Resume now routes through a new testable `resumeExplicitRun` helper (`agents/orchestrator/resumeRun.ts`, separated from CLI parsing/live wiring): it fails closed (`RUN_INPUT_MISMATCH`) when the durable run input's id ≠ the requested id, bootstraps `orchestrator.start` from the immutable run input's account and mandated human approval **iff** the event store has no history, and otherwise resumes normally — never writing run input and never overwriting an event log (the exclusive-create genesis enforces this). Three tests in `resumeRun.test.ts` prove the exact pre-genesis prefix bootstraps into a full strict pipeline, an existing log resumes without re-starting, and mismatched run input fails closed. (2) **Lock claim accuracy** — removed the absolute "can never delete another owner's lock" wording from `runLock.ts` and the docs; the token-checked `release` is now stated as best-effort, narrowing but not closing the read/compare/unlink TOCTOU window (an external/manual replacement between comparison and unlink can still be removed), with the exclusive-create artefact writes and verified event replay named as the real backstop. Token behaviour and all existing lock tests are unchanged. Focused orchestration suite is now **87 tests** and the full suite **234 tests**; `agent:pipeline:check`, `tsc -b`, ESLint and the production build all passed. No live call and no commit.
