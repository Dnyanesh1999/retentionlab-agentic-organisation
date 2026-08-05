# RetentionLab Copilot instructions

- Treat this as a graded, portfolio-grade agentic-organisation project. Preserve requirement traceability and acceptance-gate evidence.
- The organisation has exactly five agents in this order: Researcher, Designer, Maker, Communicator, Manager. The Manager chat is an interface to the same Manager, never a sixth agent.
- Work only inside files explicitly named by the task. Do not perform broad refactors or edit another active agent's files.
- Never read, print, edit, upload or summarize `.env`, `.env.*`, credentials, tokens or secrets. `.env.example` is the only environment file allowed.
- Do not push, publish, deploy, create pull requests or change external services unless the task explicitly authorizes it.
- Current implementation stage is Gate 6, Maker. Copilot worktrees must use the reviewed export at `design/specifications/signal-garden-recovery-design.v1.json` and the visual source at `design/reference/signal-garden-maker-concept-v1.png`. The ignored `artifacts/` directory is not a Copilot input.
- Preserve the existing React 19 + Vite + TypeScript architecture and Case Theatre design system. Use small focused components; keep `App` as composition glue.
- Never hardcode or invent business evidence in frontend source. Values must arrive through typed runtime boundaries derived from Supabase/MCP evidence.
- Preserve consent boundaries, customer decline paths, WCAG 2.2 AA behavior and `prefers-reduced-motion` support.
- Do not create decorative dashboards, generic card grids, 3D scenes, audio, infinite animation, invented product catalogues or fake correlations.
- Run the smallest relevant tests while iterating, then `npm test`, `npm run agent:researcher:check`, `npm run lint` and `npm run build` before claiming completion.
- Report assumptions, files changed, tests run and any unresolved risk. A Copilot result is a proposal until Codex completes integration review.
