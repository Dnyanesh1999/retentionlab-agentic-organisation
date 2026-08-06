# Gate 6 QA — Maker Slice 5

Date: 6 August 2026

Scope: success, declined, error, reduced-motion and complete Signal Garden visual/accessibility QA

## Implemented states

Inspecting and then closing any signal, sharing an optional clarification, or choosing “Not now”
now produces the specification's exact acknowledgment:

> Thank you for exploring your signal garden. Your team's patterns are yours to act on—or not.

The response is a reusable `role="status"` / `aria-live="polite"` botanical branch. It contains no
call to action, urgency or recommendation. It expires after five seconds in normal motion and stays
static when reduced motion is active. Every new outcome creates a fresh response instance, so a
repeated interaction restarts the timer rather than inheriting a stale timeout.

The declined path closes the native modal without a persistence call, returns focus to the still
available clarification trigger and displays the same non-coercive acknowledgment. A successful
share removes the consumed trigger. A failed share retains the observation and displays the exact
inline alert `Observation not shared. Your text is still here.` without displaying a success status.

## Accessibility and responsive proof

- Keyboard tests cover signal activation, Escape collapse, modal dismissal and focus return.
- Automated axe-core checks cover the ready canvas, modal error state and static acknowledgment;
  the JSDOM-incompatible paint contrast rule is checked separately against rendered browser colors.
- Rendered contrast is 15.18:1 for primary ink, 5.08:1 for muted copy and 10.67:1 for acknowledgment
  copy, all above the required 4.5:1 text threshold.
- At 390 × 844, document width remained 390 px and the acknowledgment stayed within the viewport.
- A 640 px effective CSS viewport, equivalent to 200% reflow for a 1280 px desktop canvas, retained
  all core Signal Garden content with document and body widths both exactly 640 px.
- Reduced-motion tests prove an instant/static acknowledgment and the existing signal and modal
  fallbacks remain covered.

## Faithful comparison ledger

Compared directly with `signal-garden-acknowledgment-concept-v1.png` and
`signal-garden-acknowledgment-mobile-concept-v1.png`:

1. The response remains physically connected to the support/signal rail instead of becoming a
   generic toast, dashboard card or chatbot bubble.
2. Pale mint fill, forest outline, warm paper, serif copy and restrained line icons preserve the
   approved editorial-botanical visual system.
3. The exact approved acknowledgment copy is unchanged on desktop and mobile.
4. The branch remains quiet and action-free; seat utilisation and Exit retain their original order.
5. Mobile uses a compact two-leaf branch, readable 18 px copy and no horizontal overflow.

Intentional deviations: production uses a shorter, quieter branch than the concept so it does not
compete with live evidence, and it connects below the collapsed support strand because expanded
evidence height is variable. The generated mobile concept expands support evidence to demonstrate
stacking, while the implementation proof keeps it collapsed to verify the minimum-height path.

## Automated verification

- Vitest: 114 tests across 26 files passed
- axe-core component scans: 3 states passed
- Deno Edge Function: 4 tests passed; `deno check` passed
- Demo-data invariants: 2 Node tests passed
- Typecheck, ESLint and production build: passed
- Desktop/mobile browser visual, exact-copy, ARIA status and overflow checks: passed
- `npm audit`: 0 vulnerabilities after adding axe-core
