# QA — Control Room orientation band

Date: 17 August 2026. Measured against the local dev server on a real Chromium engine, not asserted
from a test run. `jsdom` has no layout engine, so the Vitest coverage in
`src/features/control-room/OrientationBand.test.tsx` proves the copy and the wiring and nothing about
visibility; everything below is a browser measurement.

## 1. The defect this closes

The Control Room opened directly on a slogan — `Today · live organisation` over
*"Protect revenue. Prove value. Move early."* — followed by the live account directory. Nothing above
the fold told a visitor with no prior context:

- what RetentionLab is (a five-agent organisation, not a retention dashboard);
- who does the work, or in what order;
- what to press first.

Page text captured from the deployed build before the change, in reading order: the eyebrow, the
slogan, the readiness line, then straight into `Lantern Metric` and the account ledger. The words
"agent", "Researcher", "pipeline" and "handoff" did not appear anywhere on the first screen.

This matters beyond polish. The five-agent chain is the single most assessable property of the
project, and a first-time visitor could not see that it existed.

## 2. What was added

`src/features/control-room/OrientationBand.tsx`, between the hero and the live directory:

1. A heading and one paragraph naming the organisation, the inherited-hash rule and the human
   boundary.
2. A five-item chain rendered from `HOSTED_STAGE_ORDER`, one line each on what that agent actually
   seals in a real run.
3. Three doors — start a governed run, read the finished case, browse the archive.

Two deliberate choices, both load-bearing:

- **The band renders outside the directory's `StateSwap`.** A visitor who arrives while the live
  directory is loading, or after it has failed, still gets the orientation and two working exits.
  This was validated accidentally: during measurement at 1280 the directory sat on its skeleton for
  an extended period (see §5), and the band was the only meaningful content on screen.
- **The chain is plain markup, not a `StaggerReveal`.** See §4 — this was a real defect, found by
  measuring.

The primary door opens the existing governed launch sheet. It does **not** create a run; run creation
still requires a further explicit action inside the sheet. Verified in §3.

## 3. Measurements

### 1440 × 900

| Signal | Value |
| --- | --- |
| Horizontal page overflow | `0` |
| Band offset from top of document | 428 px |
| Band height | 319 px |
| `.account-command` top | 781 px — still above the 900 px fold |
| Doors reachable by `elementFromPoint` at their centre | 3 / 3 |
| Agent names, in DOM order | Researcher, Designer, Maker, Communicator, Manager |

`elementFromPoint` is the check used here rather than a visibility assertion, because it is what
caught the case assistant being painted under the masthead (`docs/qa-assistant-viewport-anchor.md`).

Primary door behaviour, driven through a real click:

```
sheetOpen: true
sheetText: "GOVERNED RUN PREVIEW / Lantern Metric / Validate account /
            Bind live evidence / Enforce approval / Stage 2 of 3: Bind live evidence"
```

The sheet opened; no run was created.

### 1280 × 800

| Signal | Value |
| --- | --- |
| Horizontal page overflow | `0` |
| Band height | 336 px |
| Chain grid | five equal columns at 240.64 px |
| Doors reachable by `elementFromPoint` | 3 / 3 |
| Primary door copy | "Opens a governed run against Lantern Metric, on live evidence." |

### 390 × 844

| Signal | Value |
| --- | --- |
| Client width / horizontal overflow | 390 / `0` |
| Chain layout | one agent per row, each with its own left rule |
| Door size | 362 × 79 px |
| Doors reachable by `elementFromPoint` | 3 / 3 |

**Measurement note worth keeping.** The first pass at 390 reported all three doors as *unreachable*.
That was a false positive: `scrollIntoView` is intercepted by Lenis, which animates the scroll, so the
rectangle read immediately afterwards was stale and `elementFromPoint` was sampling the pre-scroll
position. Re-measuring after a 450 ms settle returned 3 / 3. Any future occlusion probe on this app
must wait for Lenis to settle before reading coordinates, or it will report defects that do not exist.

## 4. The defect found while measuring

The chain was first built with `StaggerReveal`, matching the account ledger below it.

At 1280 in a tab that did not have focus, agents 2 through 5 sat frozen at partial opacity
indefinitely. The reveal is driven by animation frames; a background or unfocused tab has `rAF`
throttled, so the animation neither completed nor settled at its final state.

This is the third appearance of one failure mode in this repository — the same shape as the
`StateSwap` reduced-motion defect in `docs/claude-handoff.md` §10.1, and the same reason
`AnimatePresence mode="wait"` was rejected for route transitions in `src/app/App.tsx`.

The ledger can afford a reveal because its rows are secondary. These five names are the one thing the
band exists to say, so the reveal was removed rather than tuned. After the change, all five stages
measure `opacity: 1` and `transform: none` with no frames required:

```
Researcher    opacity 1  transform none
Designer      opacity 1  transform none
Maker         opacity 1  transform none
Communicator  opacity 1  transform none
Manager       opacity 1  transform none
```

Door hover carries a 160 ms transition and a 1 px lift; both are disabled under
`prefers-reduced-motion: reduce`.

## 5. Observed, not fixed — pre-existing

Two things surfaced during measurement that this change does not address:

- **`TextReveal` has the same rAF-throttling behaviour as §4.** In an unfocused tab at 1280 the hero
  `h1` stayed frozen part-way through its word-by-word reveal, leaving most of the headline invisible.
  Screen readers are unaffected — the animated words are `aria-hidden` and the full string is the
  accessible name — so this is visual only. It is logged as separate work.
- **The directory's `StateSwap` can hold its skeleton in a throttled tab.** `data-state` read `ready`
  while the rendered child was still `.control-skeleton`. This is consistent with the note in
  `docs/claude-handoff.md` §10.1 about the ready state being gated on animation frames. Not
  introduced here, and the orientation band now degrades that state gracefully rather than leaving
  the page blank.

## 6. Gates run

| Gate | Result |
| --- | --- |
| `npm test -- --run` | 515 passed, 74 files (5 new) |
| `npm run typecheck` | pass |
| `npm run agent:pipeline:check` | pass |
| `npm run lint` | pass |
| `npm run build` | pass |
| `npm run test:release` | 21 passed |
| `npm run test:data` | 2 passed |
| `npm run release:scan` | clean |
| `npm run release:pages` | 628,974 / 1,200,000 bytes JS |
| Deno, five hosted workers | 15 passed |
| Deno, all `supabase/functions` | 46 passed |
| `deno check` on `retentionlab-runs/index.ts` | pass |

No agent, contract, artefact, lineage, consent, migration or Edge Function changed. The production
evidence in `docs/claude-handoff.md` §1–§3 is unaffected.

Note on the Deno counts: the five-worker command in `CLAUDE.md` yields 15 tests. Running the whole
`supabase/functions` tree yields 46, but requires `--allow-read` in addition to the documented flags —
`retentionlab-assistant/assistant.test.ts` reads its own source to assert the system prompt, and
without that flag two tests fail with `NotCapable` rather than a real defect.
