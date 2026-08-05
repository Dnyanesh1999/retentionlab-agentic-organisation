# Copilot review — Gate 6 Maker slice 1

GitHub Copilot reviewed this slice in Plan mode inside the isolated worktree
`dnyanesh1999-silver-potato`. The session was read-only and used 2% of the displayed AI-credit
quota. It read only the seven allow-listed design, shell, style and test files. Its `plan.md`
remained a Copilot session artefact; it did not modify the repository.

## Recommendations accepted

- Introduce a single typed evidence boundary before rendering Signal Garden values.
- Separate loading, strand, canvas and active-inspection responsibilities.
- Validate keyboard, screen-reader and reduced-motion behavior automatically.
- Use distinct contract-test values to prove that UI values originate from the boundary.
- Keep clarification, persistence and success flows outside the first slice.

## Recommendations amended or rejected

- Runtime mock evidence was rejected. Tests may use synthetic contract fixtures, but the app
  must never silently substitute them for unavailable live evidence.
- A `.d.ts`-only evidence contract was rejected in favour of Zod runtime validation plus
  inferred TypeScript types.
- Roving focus was rejected because the canonical specification requires Tab and Shift+Tab to
  navigate between signal strands. Every interactive strand will remain in normal document
  tab order.
- Autopilot implementation was not approved. Codex retains file integration and gate review.
- Contrast is verified through browser QA and token review; jsdom computed-style assertions
  alone are not treated as accessibility proof.

## Slice 1 decision

Build the runtime-validated snapshot contract and accessible Loading state first. Do not route
the partial surface until the next slice can connect a real evidence source and complete the
loading-to-ready transition.
