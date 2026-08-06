# Incremental acceptance gates

No gate starts until the previous gate has implementation evidence and a recorded review.

## Gate 0 — compliance and architecture

- [x] Brief compliance matrix created
- [x] Runtime boundaries documented
- [x] Five-agent and chatbot interpretation locked
- [x] Project tooling installed
- [x] Baseline checks pass

## Gate 1 — application shell

- [x] Accepted Case Theatre design is stored in the project
- [x] Design tokens and component inventory documented
- [x] Six case tabs work with keyboard and pointer input
- [x] Five-agent organisation view works without claiming live data
- [x] Manager dock is visibly identified as the Manager interface
- [x] Desktop and mobile layouts pass visual review
- [x] Reduced-motion behavior is verified

## Gate 2 — live data

- [x] Supabase project and schema exist
- [x] Synthetic records are stored in Supabase
- [x] No business evidence values exist in frontend source or prompts
- [x] Editing a source row changes the next runtime result

## Gate 3 — MCP

- [x] MCP initialize, tools/list and tools/call work
- [x] Allow-listed tools query Supabase at use time
- [x] Source and retrieval timestamps appear in structured results
- [x] Failure states do not silently substitute cached evidence

## Gates 4–8 — agents

Each agent requires a full prompt, distinct personality, Zod input/output contract, prompt test, schema test, runtime test and visible artefact before the next agent begins.

### Gate 4 — Researcher / Nia Calder

- [x] Full versioned prompt and distinct personality
- [x] Strict Zod input and ResearchBrief output contracts
- [x] Prompt and schema tests
- [x] Deterministic MCP runtime and adversarial citation tests
- [x] Official OpenRouter SDK pinned; non-streaming provider call bounded
- [x] Live OpenRouter runtime test
- [x] Visible live ResearchBrief artefact

Gate 4 is complete. Gate 5 must begin only after this ResearchBrief is accepted as the
Designer's typed predecessor.

### Gate 5 — Designer / Luca Moretti

- [x] Full versioned prompt and distinct personality
- [x] Strict ResearchBrief input and RecoveryDesignSpecification output contracts
- [x] Prompt, schema, runtime and controlled-review tests
- [x] Exact evidence, consent, success-signal and SHA-256 lineage enforcement
- [x] Loading, ready, active, success, declined, error and reduced-motion states
- [x] WCAG 2.2 AA, keyboard, screen-reader and non-coercive consent requirements
- [x] Live OpenRouter design synthesis with rejected candidates preserved
- [x] Review-controlled Signal Garden artefact ready for Maker

Gate 5 is complete. Gate 6 must begin only from the canonical, integrity-checked
RecoveryDesignSpecification and its quality-review ledger.

### Gate 6 — Maker / Noor Patel

- [x] Full versioned prompt and distinct personality
- [x] Strict Designer input and RecoveryRoomArtefact output contracts
- [x] SHA-256 predecessor lineage and runtime-owned build evidence
- [x] Evidence-safe Communicator handoff and adversarial tests
- [x] Live OpenRouter Maker run with rejected candidate preserved
- [x] Slice 1: runtime-validated Signal Garden snapshot contract
- [x] Slice 1: determinate Loading state and reduced-motion fallback
- [x] Slice 1: contract, lineage and accessibility tests
- [x] Slice 2: live evidence adapter and loading → ready/error transition
- [x] Slice 3: SignalStrand, SignalCanvas and active inspection
- [x] Slice 4: clarification consent flow and persistence boundary
- [x] Slice 5: success, declined, error and complete visual/accessibility QA

Gate 6 is complete. The Maker now includes evidence-bound inspection, capability-gated optional
clarification, atomic private persistence, explicit success/declined/error states, reduced-motion
behavior and complete desktop/mobile visual and accessibility verification. Gate 9 orchestration is
preceded by the Communicator and Manager runtimes; public release remains gated by Gate 10.

### Gate 7 — Communicator / Maeve Quinn

- [x] Full versioned prompt and distinct personality
- [x] Strict Maker input and CommunicationPlan output contracts
- [x] Exact source-claim, evidence-key and numeric-claim inheritance
- [x] Email-only consent boundary and no-automatic-follow-up policy
- [x] Coercion, overclaim, CTA, identifier-leak and incomplete-copy guards
- [x] Live OpenRouter run with rejected candidate preserved

Gate 7 is complete. The accepted communication plan is `ready_for_manager`; it cannot send a
message or launch a campaign. Gate 8 will give Elias Grant the complete-chain review contract and
human-approval boundary.

### Gate 8 — Manager / Elias Grant

- [x] Full versioned prompt and distinct personality
- [x] Strict complete-chain input and ManagerOperationalDecision output contracts
- [x] Same-run, same-account and required completed-status enforcement
- [x] Exact SHA-256 lineage Researcher → Designer → Maker → Communicator verified before model use
- [x] Runtime-owned identity, lineage, provenance and human-approval governance
- [x] Approve, revise and reject decisions with single-target, bounded downstream revisions
- [x] Human boundary: no send, publish, data mutation, self-approval or approval bypass
- [x] OpenRouter adapter, config and `agent:manager` CLI
- [x] Broken-hash, mismatched-run, paused-plan, human-boundary and bounded-correction tests

Gate 8 is complete. The Manager reviews the complete versioned chain and produces a traceable
approve/revise/reject decision that always defers the irreversible action to a named human. It does
not implement orchestration. Gate 9 sequences the five runtimes, enforces order, resumes interrupted
runs and propagates the Manager's bounded revisions downstream.

## Gate 9 — orchestration

- [x] Strict order is enforced
- [x] Interrupted runs resume safely
- [x] Manager revisions are versioned and propagate downstream
- [ ] Complete pipeline transcript proves cumulative work

Slice 1 (deterministic backbone, `agents/orchestrator`) is complete: strict five-stage ordering,
crash-safe resume by verified event replay, and versioned Manager revision propagation are proven by
63 adversarial Vitest tests. The Manager seals completion and its validated decision in one atomic
`manager_decided` event, so no interrupted run can strand a completed-but-undecided Manager — every
valid persisted prefix resumes without manual repair. Evidence is in
`docs/qa-gate-9-orchestration-slice-1.md`.

Slice 2 (live composition) wires the five REAL runtimes as injected executors, persists every typed
artefact under one run-owned directory with exclusive, versioned creation and compact schema-parsed
SHA-256 references, adopts a valid unsealed artefact across the active-stage crash boundary only after
schema, identity, lineage and hash checks (failing closed otherwise), guards single-writer access with
a local lock, and exports a deterministic, source-backed JSON + Markdown transcript. It adds an
executable `agent:pipeline` CLI (fresh UUID run or explicit resume). A revision rerun currently **fails
closed** rather than fabricate applied `required_changes`; that bounded typed path stays unchecked. All
of this is proven by adversarial Vitest tests with fake agent dependencies — no live model or Supabase
call is made during implementation. The final checklist item stays **unchecked**: the complete pipeline
transcript is proven only when Codex performs and reviews the accepted live run. Evidence is in
`docs/qa-gate-9-orchestration-slice-2.md`.

## Gate 10 — release and assessment

- [ ] GitHub Pages is public without login
- [ ] Live Vercel/Supabase connections are reachable
- [ ] Accessibility, security, responsive and performance checks pass
- [ ] AI usage export is complete
- [ ] Code ZIP is complete and secret-free
- [ ] Submission document contains every required section
- [ ] Student writes the reflection independently
