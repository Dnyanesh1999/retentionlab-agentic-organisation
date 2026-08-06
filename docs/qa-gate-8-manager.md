# Gate 8 QA — Manager

Date: 6 August 2026

Agent: Elias Grant, Manager

Status: accepted. Prompt `manager.v1.1.0` was implemented after the first live decision was rejected,
and a clean live v1.1 decision passed the deterministic quality gate with human approval still required.

## Agent boundary

Elias is calm, accountable and adversarially constructive. He receives the complete versioned chain —
Nia Calder's `ResearchBrief`, Luca Moretti's `RecoveryDesignSpecification`, Noor Patel's
`RecoveryRoomArtefact` and Maeve Quinn's `CommunicationPlan` — and produces one
`ManagerOperationalDecision`: approve, revise or reject, with a rationale a named human can act on.

He is not an executor. He never sends email, publishes, launches a campaign, contacts a customer,
deploys or mutates customer, billing or account data, and he cannot self-approve. An approval only
clears the chain for a human to make the final, irreversible call.

## Runtime-owned trust boundary

Before the model is ever consulted, the deterministic runtime verifies:

- every predecessor belongs to the same `run_id` and one consistent account (input contract);
- each stage carries its required completed status — `completed`, `ready_for_maker`,
  `ready_for_communication`, `ready_for_manager` (input contract);
- the exact SHA-256 lineage links Researcher → Designer → Maker → Communicator, using the repository
  JSON hashing convention (`sha256` over the compact JSON of each schema-parsed artefact). A broken
  link throws before any token is spent.

After the decision, the runtime — not the model — seals identity, the four artefact hashes and their
verified links, model provenance, and the fixed governance envelope: `human_approval_required = true`,
`autonomous_external_actions = false`, and a `permitted_next_action` that is never an external action.
Revisions are bounded to a single target stage; the runtime computes exactly which downstream stages
must re-run.

Deterministic validation blocks:

- a broken or absent SHA-256 predecessor link;
- a mismatched run or a mixed account across the chain;
- an approval of a plan the Communicator paused for revision;
- an approval that carries a revision directive, or a revise/reject that omits its target and changes;
- a review that does not assess all four predecessor stages;
- any attempt to waive human approval or enable an autonomous external action;
- (new in `manager.v1.1.0`) any narrative field that stops mid-word or mid-sentence, or that carries a
  CJK or other unexpected glyph.

## Output-quality gate (new in manager.v1.1.0)

The first live decision, `manager.v1.0.0`, was schema-valid and governance-safe but unacceptable: the
model emitted several `executive_summary`, `chain_assessment` and `human_review_focus` strings that
stopped mid-word, and one review item leaked a stray CJK glyph. That decision is preserved unmodified
at `design/specifications/signal-garden-manager-decision.rejected.manager-v1.0.0.json`.

`manager.v1.1.0` is now the current prompt version; `manager.v1.0.0` provenance stays valid only so the
preserved rejected artefact can still be parsed. The prompt now demands concise, complete sentences
that finish well below each field limit, and a deterministic `assertOutputQuality` gate runs before a
decision is sealed. It checks `executive_summary`, `rationale`, every `cumulative_contribution`, every
trust `finding`, every `human_review_focus` item, and — when present — the revision `reason` and each
`required_change`. Each must end with sentence punctuation and contain no CJK or other unexpected
glyph (a small set of common typographic symbols such as the arrow and dashes is allowed). On the first
defect it throws precise, bounded feedback that names exactly one field, so the model corrects that one
field within the existing two-attempt revision loop without rewriting the rest. Chain hashing, the
same-run/same-account and status checks, the human-approval governance and the single-target bounded
revision path are unchanged.

## Decision model

- `approve` → `permitted_next_action = await_human_approval`; no directive.
- `revise` → `route_targeted_revision`; one target stage plus required changes; downstream stages
  recomputed by the runtime.
- `reject` → `halt_and_route_revision`; one target stage plus required changes.

## Verification

- Manager prompt, contracts and runtime: 16 tests passed
  (broken hashes, mismatched runs, approving a paused plan, human boundary, bounded correction, plus
  the new adversarial output-quality cases: truncated prose, an unexpected CJK glyph, and a successful
  bounded single-field correction).
- Full suite: 147 Vitest tests passed.
- Agent TypeScript check (`tsc -p tsconfig.agents.json`): passed.
- ESLint and production build: passed.
- The OpenRouter adapter, config and `agent:manager` CLI mirror the pinned non-streaming provider
  contract used by the earlier agents; no unrelated frontend behaviour was changed.
- A fresh live `manager.v1.1.0` run passed the output-quality gate and returned `approve` with the
  complete lineage verified, `human_approval_required = true`, `autonomous_external_actions = false`
  and `permitted_next_action = await_human_approval`. The accepted decision is preserved at
  `design/specifications/signal-garden-manager-decision.v1.json`; the earlier defective v1.0 output
  remains preserved separately as rejected evidence.

Gate 8 does not implement orchestration. Gate 9 sequences the five runtimes, enforces order, resumes
interrupted runs and propagates the Manager's bounded revisions downstream.
