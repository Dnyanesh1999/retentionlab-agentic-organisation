# Hosted Designer — production proof

Date: 14 August 2026

## Scope

Designer can claim only a queued run with a sealed private `research-brief.v1` artefact and matching
Researcher completion event. A 140-second service-only lease prevents duplicate execution and rejects
late writes. The browser never receives either private artefact or an OpenRouter credential.

The free model produces a compact evidence-linked creative delta: thesis, principles, concept, journey,
permission moment and motion intent. Deterministic policy code then compiles the complete
`recovery-design.v1` contract with inherited consent, WCAG 2.2 AA behavior, seven interaction states,
measurements, risks, acceptance tests and the ten reviewed Signal Garden components. The full compiled
artefact is schema-validated, checked against predecessor evidence and consent, hashed and stored
privately before a bounded completion event is emitted.

## Live proof

- Run: `982ac99a-d9aa-47a6-ba61-09f366143715` (`marble-current`)
- Accepted event: sequence 11, `stage_completed:designer`
- Public result: 3 experience principles, 3 journey steps and 10 reviewed components
- Private chain: two artefacts (`researcher`, `designer`), both 64-character hashes; Designer's
  `source.research_artifact_sha256` exactly equals the stored Researcher hash
- Designer contract: `recovery-design.v1`, prompt `designer.v1.8.0`, explicit free Nemotron model
- Boundary: human approval remains required and external actions remain zero
- Publishable-key probes: claim and completion RPCs both return HTTP 401

Three earlier full-contract attempts remain visible as append-only failure events. They established
that the 7,500-token model-owned specification was unreliable within the free Edge wall-clock. The
accepted compiler architecture preserves those failures, reduces model variance and retains the same
rich validated output contract rather than weakening it.

## Automated verification

- An unclaimable lease makes zero model calls
- The private ResearchBrief hash and reviewed component inventory are inherited exactly
- Unknown model root metadata is stripped before strict canonical validation
- An invented evidence key fails closed and never appears in the public failure event
- Researcher and Designer worker suites, TypeScript and the complete application release gates pass
