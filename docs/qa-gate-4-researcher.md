# Gate 4 QA — Researcher

Status: complete.

## Agent identity

- Agent: Researcher
- Name: Nia Calder
- Personality: forensic, humane, constructively sceptical
- Prompt: `agents/researcher/prompt.ts`
- Prompt version: `researcher.v1.1.0`
- Output contract: `research-brief.v1`

## Runtime design

The Researcher uses the pinned official OpenRouter TypeScript SDK (`@openrouter/sdk@0.13.67`)
with its stable, non-streaming chat transport. The agent runtime owns mandatory MCP evidence
collection and integrity enforcement; the model performs schema-constrained synthesis.
The default model is the explicitly selected free route
`nvidia/nemotron-3-super-120b-a12b:free`. A server-only environment variable can select
another model without modifying source.

Every accepted run must:

1. execute five required read-only tools through the MCP protocol;
2. return strict schema-constrained JSON;
3. cite evidence keys that occurred in the current MCP results;
4. match each citation's tool and retrieval timestamp;
5. derive consent citations only from the current preference profile;
6. record the requested and resolved model plus actual tool sequence; and
7. write a new artefact without overwriting an earlier run.

The five-tool baseline is collected deterministically by the agent runtime before model
synthesis. This prevents a routed free model from skipping evidence collection. The model
receives only the fresh packet produced by those typed MCP calls.

Provider calls disable reasoning output, use a hard timeout and bounded backoff for transient
connection/429/502/503/504 failures. No failed or incomplete run writes an accepted artefact.
The runtime permits one bounded correction when synthesis violates the contract.

## Verification evidence

- Full Vitest suite at Gate 5 closure: 23 passed
- Synthetic-data tests: 2 passed
- Agent TypeScript project: passed
- ESLint: passed
- Production build: passed
- Live MCP smoke: 7/7 tools passed; deliberate failure returned no structured evidence
- npm production dependency audit: 0 vulnerabilities

The runtime test includes an adversarial model response that cites a plausible but unseen
evidence key. The run rejects it before artefact writing.

## Live acceptance evidence

- Run ID: `b921755d-f96a-45f0-bd72-7791ceb13ef7`
- Requested route: `nvidia/nemotron-3-super-120b-a12b:free`
- Resolved model: `nvidia/nemotron-3-super-120b-a12b:free`
- Result: `completed`
- Mandatory MCP calls: 5/5
- Observations: 4
- Hypotheses: 2
- Citations: 5 unique live evidence keys
- Consent boundary: one allowed channel and two prohibited-action rules
- Artefact: `artifacts/gate-4/b921755d-f96a-45f0-bd72-7791ceb13ef7/research-brief.json`

The earlier live brief `3e81f2e2-266c-44a8-a587-3d51c599bd8c` was not advanced because its
handoff simultaneously identified the exact workflow cause as unknown and required the
Designer to address that specific cause. Version 1.1 removes this contradiction while
preserving the unknown and the prohibition against presenting a hypothesis as fact.

Each cited evidence key was re-resolved through `get_evidence_item`. Product values,
comparison values, support status/severity/sentiment, and consent fields matched the claims
in the generated brief. The artefact passed the Zod contract again after persistence.

To create another immutable run, use:

```bash
npm run agent:researcher -- copper-finch
```

The command prints only the run identifier, status, stage and local artefact path. Generated
ResearchBriefs remain outside frontend source and are ignored by Git.

Official references:

- https://openrouter.ai/docs/sdks/typescript/overview
- https://openrouter.ai/docs/guides/features/structured-outputs
