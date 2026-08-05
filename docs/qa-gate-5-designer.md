# Gate 5 QA — Designer

Status: complete. The Maker gate has not started.

## Agent and contract

- Agent: Designer
- Name: Luca Moretti
- Personality: cinematic, systems-minded, ethically exacting
- Current prompt guardrail version: `designer.v1.7.0`
- Accepted synthesis prompt version: `designer.v1.6.0`
- Input: completed `research-brief.v1`
- Output: `recovery-design.v1`, status `ready_for_maker`
- Provider/model: OpenRouter / `nvidia/nemotron-3-super-120b-a12b:free`

The runtime accepts only the Researcher's typed predecessor with the same run ID. It seals
the ResearchBrief SHA-256, inherits consent boundaries and success signals exactly, and
rejects evidence keys absent from that predecessor. The model may receive one bounded
revision request; it cannot rewrite lineage fields owned by the runtime.

## Accepted experience

The accepted concept is **Signal Garden**: a calm, two-dimensional, inspect-only experience
for aggregate usage signals. It reveals exact current/prior evidence, keeps hypotheses
uncertain, provides a persistent decline/exit path and does not invent per-feature history,
contacts, product catalogues, correlations or workflow causes.

The Maker handoff defines ten reusable React-oriented components and all seven mandatory
states: loading, ready, active, success, declined, error and reduced motion. It includes
WCAG 2.2 AA requirements, keyboard and screen-reader behavior, motion fallbacks, typed data
bindings, build order and acceptance tests.

## Live selection and controlled review

Nine non-canonical live candidates are preserved in the Gate 5 artefact directory. They were
rejected for concrete quality or integrity failures, including conventional email-campaign
design, invented per-feature/recency data, decorative 3D/audio metaphors, Vue output,
infinite motion, simulated correlations, invented case ownership, feature-tour patterns and
non-modal focus trapping. A later v9 regression did not displace the stronger v8 candidate.

Candidate v8 was promoted through `designer-quality-review.v2` after exactly four bounded,
auditable corrections:

1. remove a canvas-level keyboard focus trap;
2. remove the corresponding looped-focus acceptance criterion; and
3. remove the same loop from a nested Ready-state acceptance criterion; and
4. correct `feature_adduction` to `feature_adoption`.

The ledger records the original hash, promoted hash, exact before/after text, review time and
validator. No design claims, evidence values, consent rules or experience scope were added
during promotion.

The v1 canonical and ledger remain preserved as
`recovery-design-specification.pre-amendment.v1.json` and `quality-review.v1.json`. Gate 6
preflight discovered the nested wording, so v2 strengthened the runtime validator and
replaced the canonical file only after the amended specification passed integrity checks.

## Acceptance evidence

- Run ID: `b921755d-f96a-45f0-bd72-7791ceb13ef7`
- Researcher prompt: `researcher.v1.1.0`
- Designer synthesis prompt: `designer.v1.6.0`
- Current runtime guards: `designer.v1.7.0`
- Canonical artefact: `artifacts/gate-5/b921755d-f96a-45f0-bd72-7791ceb13ef7/recovery-design-specification.json`
- Review ledger: `artifacts/gate-5/b921755d-f96a-45f0-bd72-7791ceb13ef7/quality-review.json`
- Source lineage hash: matched
- Promoted review hash: matched
- Designer tests: 11 passed
- Full Vitest suite: 24 passed
- Synthetic-data tests: 2 passed
- Agent TypeScript check: passed
- ESLint: passed
- Production build: passed
- Production dependency audit: 0 vulnerabilities

Gate 6 may consume only the canonical specification above. Rejected candidates are assessment
evidence, not Maker inputs.
