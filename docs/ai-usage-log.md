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
