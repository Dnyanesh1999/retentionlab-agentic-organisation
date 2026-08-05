# Gate 1 visual fidelity ledger

Approved concept: `design/reference/case-theatre-approved.png`

Desktop render: `design/qa/gate-1-desktop.png`

Mobile render: `design/qa/gate-1-mobile.png`

Native comparison viewport: 1488 × 1058. Responsive verification viewport: 375 × 812.

| Comparison point | Concept evidence | Gate 1 render | Result |
|---|---|---|---|
| Information architecture | Compact masthead and six horizontal case tabs | Same masthead, navigation labels and tab sequence | Matched |
| Container model | Open organisation canvas with one right inspector | Same open canvas; no sidebar, bento grid or KPI cards | Matched |
| Agent organisation | Five orbital nodes around one living case | Exactly five ordered, keyboard-selectable nodes around one centre | Matched |
| Palette and typography | Warm ivory, forest green, violet focus, editorial serif | Matching semantic palette with Instrument Serif and Manrope | Matched |
| Manager interface | Bottom dock connected to the organisation | Responsive dock explicitly labelled “Manager interface · read-only” and “Same Manager agent” | Matched |
| Evidence content | Live fictional case, verified sources and completed path | Deliberately replaced with “Not connected” and “Foundation gate” | Intentional Gate 1 difference |
| Agent inspector | Active Designer receives case evidence and produces a diagnostic | Shows the Designer’s structural input/output/gate contract only | Intentional Gate 1 difference |
| Mobile continuation | Not shown in the approved desktop concept | Orbit becomes an ordered vertical handoff; inspector follows in document flow | Required responsive extension |

## Above-the-fold copy audit

No fictional customer name, metric, billing event, renewal date or evidence claim is embedded in the frontend. The live-case copy shown in the concept remains prohibited until Gate 2 and Gate 3 supply it dynamically.

## Browser evidence

- Desktop: no horizontal overflow, exactly five agent controls, exactly six case tabs, one selected agent and one disabled handoff.
- Mobile: no horizontal overflow at 375px and no interactive target below 44 × 44px.
- Core path: selecting Maker updates the single inspector; expanding the dock, drafting a question and saving locally produce visible feedback.
- Reduced motion: all animation and transition durations collapse under `prefers-reduced-motion: reduce` while state remains readable.
- Browser method: interaction and responsive metrics were verified in the Codex in-app browser. After a reconnect caused its desktop screenshot to save at an incorrect zoom, the final 1488 × 1058 capture was regenerated with the installed Playwright CLI; the clean session reported zero console errors and warnings.

## Remaining intentional differences

The concept’s completed Researcher path, live source timestamps, account statement and evidence-rich inspector will be implemented only after the live data and MCP gates. Presenting them now would falsely imply a compliant runtime connection.
