# Gate 6 QA — Maker slice 1

Status: complete. Gate 6 remains in progress and the partial surface is not routed.

## Scope

Slice 1 establishes the trustworthy loading boundary before any customer evidence is rendered:

- Zod runtime contract for exactly three required aggregate signals;
- typed seat-utilisation evidence and source lineage;
- `SignalGardenEvidenceClient` interface with no runtime mock implementation;
- determinate, bounded Loading state;
- exact reduced-motion fallback `Loading...`;
- no live endpoint, fallback evidence, modal, persistence or active inspection yet.

## Design and independent review

- Visual source: `design/reference/signal-garden-maker-concept-v1.png`
- Visual SHA-256: `da2ebfbea8c6a91f3b13923641bf4155ea4bbc16f7df82a8faa011d63e227c57`
- Reviewed design export: `design/specifications/signal-garden-recovery-design.v1.json`
- Copilot review: `docs/copilot-review-gate-6-slice-1.md`

The first generated concept was rejected because it omitted Seat utilisation. The corrected
concept includes the exact required signal as an open rail rather than a KPI card. No generated
image is shipped as interface code; it is a fidelity reference for later React implementation.

## Verification

- Recovery Room targeted tests: 6 passed
- Full Vitest suite: 30 passed across 11 files
- Frontend TypeScript: passed
- Agent TypeScript: passed
- ESLint: passed
- Production build: passed
- Runtime dependency additions: none
- Production Recovery Room source scan for known design evidence values: clean

The first broad scan matched `120` inside an unrelated organisation-view SVG path. The enforced
scan is scoped to `src/features/recovery-room/` production files, which is the boundary where
copying design evidence would violate this slice.

## Gate decision

Do not route `LoadingState` yet. Slice 2 must provide a real, validated evidence adapter and a
bounded loading-to-ready or loading-to-error transition first. This avoids infinite loading and
prevents tests or design examples from becoming runtime evidence.
