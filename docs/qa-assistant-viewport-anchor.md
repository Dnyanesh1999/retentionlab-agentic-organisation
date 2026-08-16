# Case assistant — viewport anchor defect and fix

Date: 16 August 2026

## Scope

The `CaseAssistant` trigger was unreachable on desktop. It was reported as "it comes for a second and
disappears", and reproduced against the deployed build before any change was made. Two independent
causes were measured; both are recorded here because either one alone would have hidden the feature.

The assistant mounts on `#/cases/overview` only, so for the duration of this defect no desktop visitor
could open it.

## Cause 1 — painted under the masthead

`.case-assistant` was anchored to the top of the viewport (`top: 46px`, overridden to `top: 8px` under
`.casebook-product`) with `z-index: 40`. `.masthead` is `position: sticky`, spans y 0–72 at full width,
carries `z-index: 50`, and is `background: rgba(247, 244, 237, 0.91)` over `backdrop-filter: blur(14px)`.

The trigger's band (y 8–56) therefore sat entirely inside the masthead's band, below it in paint order.
It rendered as a faint blurred smudge rather than as a missing element, which is why it read as a
rendering glitch.

`document.elementFromPoint` at the trigger's centre returned a span inside `.masthead`, so the control
was not hit-testable either: clicking exactly where it appeared did nothing.

The `max-width: 900px` rules already re-anchored the trigger to `bottom: 18px`, clear of that band. That
is why the assistant worked on a phone and not on a laptop.

## Cause 2 — fixed positioning resolved against the route wrapper

`RouteTransition` animates each route's entrance with a transform. A transformed ancestor becomes the
containing block for `position: fixed` descendants, so while that animation runs the assistant was
anchored to the route wrapper rather than to the viewport.

Measured with the wrapper mid-animation at `transform: translateY(10px)`, in an 820px viewport:

| | Trigger top | Trigger bottom | Inside viewport |
| --- | --- | --- | --- |
| Anchored to the route wrapper | 1440 | 1488 | **no** |
| Anchored to the viewport | 748 | 796 | yes |

This is the mechanism behind the reported symptom. With the old top anchor the wrapper's own offset put
the trigger *below* the masthead while the entrance animation ran — visible — and the transform then
cleared, the anchor became the viewport, and the trigger moved up into the masthead band and vanished.
Appearing and then disappearing was one control moving between two containing blocks.

## Fix

- `src/features/design-lab/designLab.css` — anchor `.case-assistant` bottom-right at every width, delete
  the `.casebook-product` top override, raise `z-index` to 60 so the open panel is above the masthead's
  50, and open `.case-assistant__panel` upward from the trigger. The now-redundant `top: auto` overrides
  in the small-viewport blocks were removed.
- `src/features/assistant/assistant.css` — the panel's `max-height` bound was expressed against the old
  top anchor; re-expressed against the bottom anchor.
- `src/features/assistant/CaseAssistant.tsx` — rendered through `createPortal` into `document.body`, so
  no ancestor transform can claim it as a containing block at any frame.

Bottom-right rather than a z-index bump alone: raising the z-index would have fixed the occlusion but
left a chat trigger inside the navigation bar overlapping "Active case". The bottom anchor removes the
overlap instead of winning a paint-order fight, and it matches the small-viewport rules that already
worked.

## Verification

Against the local build, `#/cases/overview`. `occluded` is
`!(hit === trigger || trigger.contains(hit))` for `document.elementFromPoint` at the trigger's centre.

| Viewport | `occluded` before | `occluded` after | Hit target after | Inside viewport | Page overflow-x |
| --- | --- | --- | --- | --- | --- |
| 1280×800 | **true** (masthead) | false | `case-assistant__trigger` | yes | none |
| 1440×820 | **true** (masthead) | false | `case-assistant__trigger` | yes | none |
| 390×844 | false | false | `case-assistant__trigger` | yes | none |

Panel, opened:

| Viewport | Panel band | Fits | Scrolls internally |
| --- | --- | --- | --- |
| 390×844 | 130–774 | yes | no |
| 1280×600 | 24–516 | yes | yes |
| 1440×820 | clear of masthead | yes | no |

On a 600px-tall window the panel overlaps the masthead band and paints above it, which is the intended
result of the z-index change rather than a regression.

The answer ladder is unaffected. "Is the evidence chain verified?" still settles on the `model-cited`
tier with the provenance line "Generated · every quote verified" and two citations attributed to
`gate-9 transcript · lineage`.

## Regression cover

`CaseAssistant.test.tsx` gains a case asserting the component renders outside a transformed parent and
into `document.body`. That guards cause 2, which is the one that can silently return.

Cause 1 is not testable in jsdom — jsdom has no layout, so `getBoundingClientRect` returns zeros and
`elementFromPoint` cannot detect occlusion. The browser measurements above are the evidence for it, and
the probe is recorded here so it can be re-run:

```javascript
(() => { const t = document.querySelector('.case-assistant__trigger'); const r = t.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2); return { width: innerWidth, occluded: !(hit === t || t.contains(hit)) }; })()
```

This is a second instance of the pattern already recorded in `docs/qa-human-approval.md` §4.5: a green
test suite is not evidence for behaviour the test environment cannot execute. There it was plpgsql; here
it is layout.

## Gates

488 Vitest tests (487 before, plus the new regression case), 29 hosted Deno worker tests, typecheck,
agent pipeline check, ESLint, production build, 21 release tests, 2 data tests, and a clean secret scan
across 347 tracked files. `release:check` on the tracked commit passes; Pages JS is 614,807 of the
1,200,000-byte ceiling, up 146 bytes.
