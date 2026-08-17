# QA — Signal Garden redesign

Date: 17 August 2026. Measured in a real Chromium engine against the dev server, not asserted from a
test run. Everything in §3 is a browser measurement.

## 1. The three defects this closes

### 1.1 A decorative frame drawn across the rows

`.signal-canvas::before` was a rounded rectangle at `inset: 39px -64px`, `border-radius: 55px`, drawn
behind the strand stack. The strands' own background was `color-mix(in srgb, var(--surface) 38%,
transparent)` — **38% opaque** — so the frame's top and bottom edges showed straight through the
collapsed rows and read as a stray line crossing them.

Measured before the change:

```
.signal-strand      background-color  color(srgb 1 0.992157 0.972549 / 0.38)
.signal-canvas::before  border 1px / radius 55px / inset 39px -64px
```

The frame is removed and the card surfaces are opaque, so nothing can bleed through a row again.

### 1.2 The page never said what it was

It opened on "Your signal garden — Inspect any signal to learn more. No action required." That tells a
first-time reader nothing about what they are looking at, where the numbers came from, or what will
happen to them.

Added, inside the Maker's contract — aggregate, non-causal, no urgency:

> A read-only view of the aggregate signals recorded against this account over the last 30 days. Each
> one carries the evidence key it came from, so you can see exactly what it is based on.
>
> Nothing here is a recommendation, and nothing is shared unless you choose to share it.

### 1.3 No summary of what the snapshot holds

Added `SignalSummary`, four tiles derived from the sealed snapshot: signal count with the direction
split, distinct cited evidence keys, the open case with its severity and category, and the snapshot
age. Every figure is counted or divided from the same snapshot the strands render, so the two cannot
disagree.

Seat utilisation is **not** one of the tiles. It has its own evidence-bound row lower down, and
showing it twice would let the two drift.

Each strand also gained its relative change (`−29.1%`, `+28.6%`). That is arithmetic on the two values
already displayed — no extra evidence is read — and it returns nothing when the previous value is zero,
because a change from zero has no defined percentage.

## 2. The animation problem, measured three times

The brief for this work included "add good animation". Three approaches were built, and **all three
were measured hiding the page's own content** when the tab was backgrounded (`document.hidden === true`).

| # | Approach | Measured result with the tab hidden |
| --- | --- | --- |
| 1 | `StaggerReveal` (framer-motion) | Rows 2–4 at `opacity: 0` indefinitely. Chrome pauses `requestAnimationFrame` in a hidden tab. |
| 2 | `@keyframes … animation: … both` | All four rows at `opacity: 0`. The animation timeline did not advance either, and the `both` fill held every row at its `from` state. |
| 3 | `transition` out of `@starting-style` | Rows 1–3 still at `opacity: 0` **five seconds** after load. A transition that has begun but stops receiving frames stays at its starting value. |

Approach 3 was chosen specifically because the resting state is the visible one, and it still failed —
the transition starts, then stalls. Row 4 survived only because its 210 ms delay meant its transition
had not begun.

**The common factor is not the technique.** Any entrance that starts from invisible will stay
invisible when frames stop, and an entrance animation runs at the one moment when nobody is present to
notice it broke.

### What shipped instead

No arrival animation. The motion on this page is interaction-driven only:

- card hover: 1px lift, border and shadow
- metric icon: border and wash on hover
- disclosure chevron: 2px nudge, direction following the expanded state
- detail panel: fade and 6px slide on expand

A hover or a click is proof that the tab is visible and receiving frames — the guarantee an entrance
animation cannot make. The detail panel keeps its `@starting-style` transition for that reason: it only
ever mounts in response to a click.

This is the same failure family as the `StateSwap` defect in `docs/claude-handoff.md` §10.1 and the
`StaggerReveal` removal in `docs/qa-control-room-orientation.md` §4 — the third and fourth appearances.
The rule now applied on this page: **the animation must be the thing that fails, never the content.**

## 3. Measurements

Verified with the tab hidden, which is the condition that broke the first three attempts.

| Width | Horizontal overflow | Row opacities (hidden tab) | Summary grid |
| --- | --- | --- | --- |
| 1440 × 900 | `0` | `1, 1, 1, 1` | 4 columns |
| 1280 × 800 | `0` | `1, 1, 1, 1` | 4 columns |
| 390 × 844 | `0` | `1, 1, 1, 1` | 2 × 2, 181 px each |

Detail panel after expanding, tab hidden: `opacity: 1`, height > 40 px, citation rendered
(`product:copper-finch:feature_adoption:2`).

At 390 the summary was 4 columns at ~115 px before the fix, which wrapped every caption; it is now
2 × 2. The seat-utilisation row is 362 px wide and shares the strands' card language rather than the
pair of dashed rules it had, which read as an orphaned footer once the strands became solid cards.

## 4. Two defects the test suite caught

Both were real, and both were found by running the suite rather than by looking:

1. **`definition-list` axe violation.** The summary was built as a `<dl>` with each tile a `<div>`
   holding an icon, `<dt>`, `<dd>` and a `<p>`. A `<dl>` may only contain `dt`/`dd` groups. It is a
   `<ul>` now.
2. **`react-hooks/purity`.** `now = Date.now()` as a default parameter runs during render, so one
   component could report two different ages for one snapshot. It is read once at mount via a lazy
   `useState` initialiser — which is also the truthful reading, since the tile says "read when this
   page opened".

One committed test was changed rather than kept passing: `SignalStrand.test.tsx` asserted the exact
accessible name of the strand graphic, and the name now carries the relative change because that change
is rendered visibly. Leaving it out would give a screen-reader user strictly less than a sighted reader
gets from the same row. A second case was added for the zero-previous-value path.

## 5. Gates

| Gate | Result |
| --- | --- |
| `npm test -- --run` | 523 passed (8 added) |
| `npm run typecheck` | pass |
| `npm run agent:pipeline:check` | pass |
| `npm run lint` | pass |
| `npm run build` | pass |
| `npm run test:release` | 29 passed |
| `npm run test:data` | 2 passed |
| `npm run release:scan` | clean across 363 tracked files |
| `npm run release:pages` | 631,536 / 1,200,000 bytes JS |

No agent, contract, artefact, lineage, consent, migration or Edge Function changed. The Signal Garden
still renders only what the sealed snapshot contains; no figure was added that the snapshot does not
already carry.
