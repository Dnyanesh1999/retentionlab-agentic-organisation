# Gate 7 QA — Communicator

Date: 6 August 2026

Agent: Maeve Quinn, Communicator

Status: complete and ready for Manager review

## Agent boundary

Maeve is plain-spoken, empathetic and evidence-disciplined. She receives only Noor Patel's
validated `RecoveryRoomArtefact` and produces a versioned `CommunicationPlan`. The plan contains
the email invitation, structured evidence claim ledger, transparency copy, no-follow-up policy,
measurement guardrails and the decision packet for Elias Grant.

The runtime owns Maker SHA-256 lineage, implementation commit, available channels, prohibited
claims, required disclosures, agent identity and model provenance. Deterministic validation blocks:

- claims absent from the exact Maker handoff;
- evidence keys not carried by the cited source claims;
- invented numbers;
- urgency, fear, churn or win-back language;
- personal, diagnostic, causal or guaranteed framing;
- sales/action CTAs beyond viewing the Signal Garden;
- raw internal evidence identifiers in customer-facing copy;
- incomplete customer sentences and any automatic follow-up policy.

## Live iteration evidence

The first `communicator.v1.0.0` live candidate ended its choice statement mid-sentence and exposed
raw evidence keys in the public email body. It was preserved as rejected and never advanced.
Version 1.1 strengthened the copy boundary but still repeated bracketed identifiers. Version 1.2
made the structured separation explicit: identifiers live only in `message_claims.evidence_keys`.
The accepted plan passed and is preserved with the rejected candidate under `design/specifications/`.

## Accepted plan

- Channel: inherited `email` only
- CTA: `View your signal garden`
- Follow-up: `none_without_new_explicit_consent`
- Launch posture: `proceed_to_review`, not autonomous launch
- Prompt/model: `communicator.v1.2.0` via `nvidia/nemotron-3-super-120b-a12b:free`
- Status: `ready_for_manager`

## Verification

- Communicator prompt, contracts and runtime: 8 tests passed
- Agent TypeScript build and ESLint: passed
- Live OpenRouter handoff: passed
- Accepted and rejected artefacts: preserved
