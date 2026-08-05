# Assessment compliance matrix

This file is the build-time source of truth for the final-project pass/fail gates. A requirement remains open until implementation evidence exists.

| Brief requirement | Implementation decision | Evidence required | Status |
|---|---|---|---|
| Exactly five agents | Researcher, Designer, Maker, Communicator, Manager | Five full system prompts and five distinct output contracts | Planned |
| Distinct personality and domain expertise | Named personas with non-overlapping mandates and evaluation criteria | Prompt appendix and pipeline transcript | Planned |
| Unbroken handoff chain | Typed, versioned artefact envelope; the server blocks out-of-order execution | Orchestrator tests and run timeline | Planned |
| Genuine cumulative output | Every stage cites and transforms its predecessor artefact | Complete five-stage run evidence | Planned |
| Live external source queried at moment of use | Researcher invokes RetentionLab MCP tools backed by Supabase | Network trace, MCP transcript, source timestamp and code inspection | MCP data path implemented — Gate 3; Researcher pending |
| Synthetic data stored in a real queryable source | Fictional B2B SaaS account data lives in Supabase, never in prompts or frontend source | Supabase table evidence and row-change demonstration | Implemented — Gate 2 |
| No hardcoded or cached pipeline evidence | Business evidence is fetched per assessed run; resilience replay is visibly labelled and excluded from live evidence | Automated guard tests and assessed run recording | Live MCP proof implemented — Gate 3; assessed agent run pending |
| Functional Maker artefact | Maker emits a validated Recovery Room definition rendered as an interactive customer experience | Working choices, state transitions and Maker artefact trace | Planned |
| Public GitHub Pages URL without login | Hash-routed React application | Public URL test | Planned |
| Live connections available for eight weeks | Vercel and Supabase deployment retention checklist | Post-submission availability record | Planned |
| Complete codebase ZIP | Frontend, API, MCP, schemas, prompts and tests included | Clean ZIP audit | Planned |
| No committed credentials | Server-only environment variables and secret scanning | Repository scan and ZIP scan | Planned |
| GDPR, EU AI Act and trust | Trust Gate explains purpose, evidence, consent, human approval and applicable current law | Submission section with verified citations | Planned |
| AI-generated content cited | Model ID, full prompt/version, timestamp and verification status recorded | AI usage appendix/export | Planned |
| Reflection written by student | No generated reflection content in the repository | Student-authored final section | Locked |

## Non-negotiable interpretation rules

1. “Talk to the organisation” is a read-only interface to the same Manager agent and Manager system prompt. It is not a sixth agent.
2. The first run always completes Researcher → Designer → Maker → Communicator → Manager. Revision loops are allowed only after that pass.
3. A Manager rejection creates a versioned targeted revision and re-runs every affected downstream stage.
4. Replay mode is resilience only, is prominently labelled, and cannot be used as evidence of a live assessed run.
5. The browser never receives OpenRouter or Supabase service credentials.
6. The product performs no real email, billing, cancellation or CRM mutation.
