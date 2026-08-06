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

- [x] Slice 1: runtime-validated Signal Garden snapshot contract
- [x] Slice 1: determinate Loading state and reduced-motion fallback
- [x] Slice 1: contract, lineage and accessibility tests
- [x] Slice 2: live evidence adapter and loading → ready/error transition
- [x] Slice 3: SignalStrand, SignalCanvas and active inspection
- [x] Slice 4: clarification consent flow and persistence boundary
- [ ] Slice 5: success, declined, error and complete visual/accessibility QA

Gate 6 is in progress. Slice 4 is routed with evidence-bound support inspection, capability-gated
optional clarification, atomic private persistence and live desktop/mobile verification. Slice 5
owns the post-submit success/declined/error presentation and complete visual/accessibility QA.

## Gate 9 — orchestration

- [ ] Strict order is enforced
- [ ] Interrupted runs resume safely
- [ ] Manager revisions are versioned and propagate downstream
- [ ] Complete pipeline transcript proves cumulative work

## Gate 10 — release and assessment

- [ ] GitHub Pages is public without login
- [ ] Live Vercel/Supabase connections are reachable
- [ ] Accessibility, security, responsive and performance checks pass
- [ ] AI usage export is complete
- [ ] Code ZIP is complete and secret-free
- [ ] Submission document contains every required section
- [ ] Student writes the reflection independently
