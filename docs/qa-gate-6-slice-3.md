# Gate 6 QA — Maker Slice 3

Date: 5 August 2026

Scope: live Signal Garden canvas, inspectable strands and Recovery Room route

## Implemented boundary

The Recovery Room now routes to a live-only Signal Garden. `SignalCanvas` renders the three
required product signals plus seat utilisation from the decoded Slice 2 snapshot. Each
`SignalStrand` derives its direction from previous/current values and reveals the exact approved
explanation and source evidence key on focus or activation. Escape collapses the active strand and
returns focus to its trigger.

The route has no fixture, query-string preview, local-storage fallback or embedded business
evidence. Its only states are bounded loading, decoded live evidence and a typed fail-closed error
with retry. Configuration errors also fail closed.

## Collaborative implementation record

Claude Code, Opus 4.8 at High effort, implemented the isolated `SignalStrand` component and its
component tests in worktree `retentionlab-slice-3-strand`. Codex reviewed and integrated commit
`e4d17f5`, then built the canvas, route, live-state composition, styling and browser verification.
GitHub Copilot remains the independent review partner from Slices 1–2; it was not used to duplicate
Claude's implementation assignment.

## Live browser proof

- Supabase browser preflight returned HTTP 204 with the expected origin, header and method policy.
- The first browser run exposed a real native-fetch binding defect (`Illegal invocation`) that did
  not reproduce in Node. The shared client now invokes injected/native fetch with `globalThis` as
  its receiver, and a regression assertion verifies that receiver.
- A fresh Chromium load reached the ready state with live Copper Finch readings: feature adoption,
  active users, session frequency and seat utilisation.
- Activating Active users set `aria-expanded=true`, revealed the approved explanation and live
  citation `product:copper-finch:active_users:2`; Escape restored `aria-expanded=false`.
- The 375 × 812 layout was visually checked with the live values and citation. Values do not
  overlap, the active detail stacks cleanly and the exit control remains visible.

## Faithful comparison ledger

Compared directly with `design/reference/signal-garden-maker-concept-v1.png`:

1. The warm paper background, green ink, serif display typography and restrained violet active
   state follow the accepted visual language.
2. The three strands remain on an open botanical rail instead of becoming a conventional card
   dashboard.
3. The active strand expands in place and exposes explanation plus evidence without a modal.
4. Previous/current readings, neutral directional labels and seat utilisation preserve the
   concept's information hierarchy while using only live source values.
5. Desktop spacing, full-width exit divider and the narrow single-column transformation preserve
   hierarchy without horizontal overflow.
6. Copy matches the approved screen: “Your signal garden”, the non-coercive inspection prompt,
   the exact explanation and “Exit signal garden”.

Intentional deviations still owned by later slices:

- The support-case strand and “Clarify workflow friction?” control are withheld until Slice 4 owns
  their live contract, consent flow and persistence boundary.
- The existing shell heading remains “Connect a live case”; final case identity and publish-state
  treatment belong to the release shell, not this canvas slice.
- The accepted concept's example numbers are never copied into runtime source. Live evidence is
  expected to differ.

The implemented Slice 3 is faithful to the accepted concept for its approved scope. The explicit
deviations above are intentional future-slice boundaries, not missing ready-state behavior.

## Automated verification

- Full Vitest suite: 58 tests across 17 files, including the native-fetch receiver regression assertion
- Typecheck: passed
- Lint: passed
- Production build: passed
- Live MCP smoke: all seven tools passed; citation resolution passed
- `git diff --check`: passed
