# Hosted five-agent pipeline — production proof

Date: 14 August 2026

Supabase project: `luwrufuouosytyhdqnme`

Accepted run: `982ac99a-d9aa-47a6-ba61-09f366143715`

## Proven outcome

The production Edge runtime executed Researcher → Designer → Maker → Communicator → Manager against
the synthetic Marble Current account. All five stages sealed private typed artefacts. Manager verified
the four predecessor links and moved the run to `awaiting_human_approval`. The terminal public summary
states that no external action occurred.

The accepted event projection ends with:

1. Communicator `stage_completed`: one consent-bound `in_app` invitation, three evidence-linked claims,
   no communication sent.
2. Manager `stage_started`.
3. Manager `stage_completed`: complete chain verified and routed to human approval.
4. `run_paused_for_approval` at Manager.

## Failure and recovery evidence

The append-only history preserves earlier Communicator failures. They exposed an incorrect assumption
that every account permitted email. The worker contract was corrected to compile a channel-neutral
invitation using the exact sealed Maker channel (`in_app` for Marble Current). A bounded `retry_run`
gateway action resumed only the failed stage from the last sealed checkpoint; Researcher, Designer and
Maker were not rerun. The Control Room exposes the same recovery as “Retry from sealed checkpoint.”

A separate fresh run also failed closed when the free model returned an invalid ResearchBrief. That
record was not rewritten or presented as success.

## Deterministic guarantees

- Service-only 140-second leases prevent simultaneous stage execution.
- Private artefacts are schema-validated and SHA-256 addressed.
- Every successor verifies exact stored predecessor hashes before its model call.
- Communicator policy code owns the channel, customer copy, evidence mapping, consent disclosures and
  no-follow-up rule; the model supplies only a bounded executive summary.
- Manager governance fixes `human_approval_required = true`, `autonomous_external_actions = false` and
  `permitted_next_action = await_human_approval`.
- Publishable browser credentials cannot call worker claim/completion RPCs or read private artefacts.

## Automated verification

The hosted worker suite contains 15 tests covering leases, successful contracts, exact lineage,
invalid model contracts and broken-hash rejection. The React Control Room test suite covers the live
trace and operator retry. TypeScript, lint, build, release and secret-scan gates are part of the final
publication check.
