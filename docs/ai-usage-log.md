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
