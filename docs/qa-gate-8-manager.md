# Gate 8 QA — Manager

Date: 6 August 2026

Agent: Elias Grant, Manager

Status: complete and ready for Gate 9 orchestration

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
- any attempt to waive human approval or enable an autonomous external action.

## Decision model

- `approve` → `permitted_next_action = await_human_approval`; no directive.
- `revise` → `route_targeted_revision`; one target stage plus required changes; downstream stages
  recomputed by the runtime.
- `reject` → `halt_and_route_revision`; one target stage plus required changes.

## Verification

- Manager prompt, contracts and runtime: 12 tests passed
  (broken hashes, mismatched runs, approving a paused plan, human boundary, bounded correction).
- Full suite: 143 Vitest tests passed.
- Agent TypeScript check (`tsc -p tsconfig.agents.json`): passed.
- ESLint and production build: passed.
- The OpenRouter adapter, config and `agent:manager` CLI mirror the pinned non-streaming provider
  contract used by the earlier agents; no unrelated frontend behaviour was changed.

Gate 8 does not implement orchestration. Gate 9 sequences the five runtimes, enforces order, resumes
interrupted runs and propagates the Manager's bounded revisions downstream.
