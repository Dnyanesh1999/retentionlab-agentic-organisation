# Hosted Researcher — production proof

Date: 14 August 2026

## Scope

This slice hosts only the Researcher. The public Control Room creates or resumes a bounded synthetic
run; a Supabase Edge worker claims it through a service-only 140-second lease, retrieves exactly five
fresh evidence envelopes, calls OpenRouter with a strict JSON Schema, validates citations and consent
lineage, and stores the full `ResearchBrief` in `private.agent_run_artifacts`. The browser receives only
the append-only public event projection and a bounded completion summary.

Designer is proven separately in `docs/qa-hosted-designer.md`; Maker through Manager remain pending. External actions remain hard-set to zero and
human approval remains required.

## Live proof

- Run: `982ac99a-d9aa-47a6-ba61-09f366143715` (`marble-current`)
- Event chain: `run_created → stage_started:researcher → stage_completed:researcher`
- Public result: 7 cited observations and 2 hypotheses from 5 fresh evidence tools
- Private result: one `research-brief.v1` artefact, 64-character SHA-256, OpenRouter requested/resolved
  model `nvidia/nemotron-3-super-120b-a12b:free`
- Boundary: `requires_human_approval = true`, `external_actions_permitted = 0`, one worker attempt
- Publishable-key probes: worker RPC HTTP 401, direct public table HTTP 401, private schema HTTP 406

Two earlier smoke runs failed closed: the aggregate free router rejected the protected parameter
contract, and one explicit-model response did not pass validation. Neither stored a private artefact or
emitted a completion event. The final worker uses only parameters supported by the explicit free model.

## Automated verification

- Lease refusal makes zero model calls
- Successful execution retrieves exactly five tools and stores the validated private artefact/hash
- Provider 429 records only a bounded public failure reason
- Frontend trace derives active, sealed and next-stage states exclusively from hosted events
- Supabase advisors reported no error/warning-level security findings; deny-by-default RLS tables and
  new-project unused indexes remain informational notices
