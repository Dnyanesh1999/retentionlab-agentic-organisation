# Gate 6 QA — Maker agent formalisation

Date: 6 August 2026

Agent: Noor Patel, Maker

Status: complete and ready for the Communicator

## Typed handoff

The previously verified Signal Garden implementation is now represented by a strict
`RecoveryRoomArtefact` rather than an unsupported narrative claim. Noor receives only the reviewed
`RecoveryDesignSpecification` and a runtime-owned implementation manifest. The final handoff seals:

- SHA-256 lineage to the Designer artefact;
- the real React route, source-component map and implementation commit;
- exact loading, ready, active, success, declined, error and reduced-motion coverage;
- passed test/build commands and desktop/mobile visual evidence;
- inherited consent channels and prohibited actions;
- evidence-cited claims, qualifications and disclosures for the Communicator.

The runtime blocks out-of-chain run IDs, unreviewed Designer status, missing contract components,
partial state coverage, altered consent boundaries and any claim citing evidence absent from the
Designer artefact. Model identity, agent identity, lineage, implementation proof and guardrails are
runtime-owned fields and cannot be rewritten by the model.

## Live iteration evidence

The first live `maker.v1.0.0` candidate passed the initial schema but called aggregate account
signals “personal usage patterns” and mixed technical accessibility assertions into customer
evidence claims. It is preserved under the run's `rejected/` directory and was not advanced.

Prompt `maker.v1.1.0` explicitly separates aggregate customer claims from implementation proof.
A first retry exposed an overbroad validator that rejected the safe disclaimer “does not infer
causality”; the rule was corrected to reject affirmative causal claims while permitting explicit
qualifications. The accepted live candidate then passed deterministic validation and is stored as
`artifacts/gate-6/b921755d-f96a-45f0-bd72-7791ceb13ef7/recovery-room-artifact.json`.
Submission-safe accepted and rejected copies are preserved under `design/specifications/`.

## Verification

- Maker prompt, contracts and runtime: 9 tests passed
- Agent TypeScript build and ESLint: passed
- Live OpenRouter model: `nvidia/nemotron-3-super-120b-a12b:free`
- Accepted status: `ready_for_communication`
- Prompt version: `maker.v1.1.0`
- Implementation commit bound by the artefact: `c38febd`
