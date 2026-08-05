# RetentionLab design system

Source of truth: the user-approved Case Theatre concept in `design/reference/case-theatre-approved.png`.

The automated design search suggested a blue/orange bento dashboard. That recommendation was rejected because it conflicts with the approved concept and the product’s goal of avoiding generic dashboard patterns. Accessibility, responsive and motion-quality guidance from the design database remains binding.

## Creative direction

RetentionLab is a warm-ivory editorial operations theatre. The product should feel like a living case file combined with a carefully choreographed organisational map—not an analytics dashboard.

- Open canvas with thin architectural dividers
- Central living case artefact
- Five agents positioned around a handoff orbit
- One agent inspector visible at a time
- Manager-backed conversation dock anchored below the case
- Serif typography for identity, cases and artefacts
- Clean sans-serif typography for controls and operational detail
- Restrained green for trust and primary actions; violet only for the active agent

## Prohibited patterns

- No bento grids or dense card mosaics
- No permanent left sidebar
- No neon gradients, glassmorphism or decorative glow
- No fake KPI tiles
- No hardcoded customer evidence in the frontend
- No sixth chatbot persona
- No emoji icons

## Color tokens

| Token | Value | Purpose |
|---|---:|---|
| `--canvas` | `#f7f4ed` | Warm ivory application background |
| `--surface` | `#fffdf8` | Focused inspector and dock surface |
| `--ink` | `#17201c` | Primary text |
| `--ink-soft` | `#626a64` | Secondary operational text |
| `--line` | `#ddd7cb` | Dividers and quiet borders |
| `--line-strong` | `#c8c0b2` | Focused boundaries |
| `--forest` | `#0b513f` | Brand, trust and primary action |
| `--forest-deep` | `#063b2f` | Pressed and high-contrast green |
| `--mint` | `#dbe9df` | Completed-path wash |
| `--violet` | `#5a3fe0` | Active-agent state only |
| `--violet-wash` | `#eeeaff` | Active-agent halo |
| `--warning` | `#bd4a32` | Risk and deadline attention |
| `--focus` | `#6a4df0` | Keyboard focus ring |

All body text must meet WCAG AA contrast. Color never acts as the only status signal.

## Typography

- Display and artefact text: `Instrument Serif`, Georgia, serif
- Interface and body text: `Manrope`, Inter, system-ui, sans-serif
- Minimum body size: 16px
- Control labels: 13–15px at 600 weight with deliberate line height
- Case title: fluid 30–42px
- Living artefact statement: fluid 28–44px

## Spacing and geometry

- 4px base unit with 8, 12, 16, 24, 32, 48 and 64px steps
- App canvas: fluid horizontal gutter from 18px mobile to 46px desktop
- Borders: predominantly 1px
- Corners: 4–8px for controls; 14–18px only for the inspector and Manager dock
- Shadows: rare, soft and low-opacity; structure comes from lines and whitespace
- Pointer targets: at least 44×44px

## Container model

The desktop composition uses three vertical regions:

1. Compact global masthead
2. Case header and six-tab rail
3. Open organisation canvas plus a single right inspector

The Manager dock spans the lower canvas. On narrow screens the orbit becomes a horizontal pipeline rail, the inspector becomes a full-width sheet in document flow, and the dock becomes a compact composer.

## Motion language

Motion explains handoff and focus:

- Tab underline: 180ms spatial transition
- Agent focus: 240ms spring with halo and inspector crossfade
- Handoff trace: directional path reveal, 500–700ms
- Living artefact: subtle slow line drift; never a pulsing glow
- Manager dock: 260ms height/opacity transition
- Respect `prefers-reduced-motion`; preserve every state change without animation

Do not animate layout dimensions in hot paths. Prefer transform and opacity. Never make users wait for decorative motion.

## Component families

- `BrandMark`: circular retention signal plus wordmark
- `GlobalNav`: Portfolio, Cases, Governance
- `CaseTabs`: Pulse, Organisation, Evidence, Recovery Room, Trust Gate, Audit
- `AgentNode`: numbered stage, icon, name, status and accessible selected state
- `HandoffPath`: directional connection and stage progression
- `LivingCase`: case statement and source/decision summary
- `AgentInspector`: one focused agent’s input, insight, uncertainty and contract
- `ManagerDock`: cited read-only Manager conversation entry point
- `SourceRail`: connection state only; business values arrive from live APIs

## Responsive checkpoints

Verify at 375, 768, 1024, 1280 and 1440px. No horizontal page scrolling, clipped agent labels or controls hidden behind the dock.

