# Case Theatre implementation inventory

## Approved reference

`design/reference/case-theatre-approved.png`

Native concept dimensions: 1488 × 1058.

## Visible information architecture

- Masthead: RetentionLab, Portfolio, Cases, Governance, current user
- Case title region
- Case tabs: Pulse, Organisation, Evidence, Recovery Room, Trust Gate, Audit
- Organisation canvas: five-agent handoff around one central case artefact
- Right inspector: focused agent only
- Source rail: connection status without embedded business evidence
- Bottom dock: “Talk to the organisation,” explicitly routed to Manager

## Gate 1 allowed copy

Because live data is not connected yet, Gate 1 may display only structural and product metadata:

- RetentionLab
- Portfolio, Cases, Governance
- Pulse, Organisation, Evidence, Recovery Room, Trust Gate, Audit
- Researcher, Designer, Maker, Communicator, Manager
- Imani Reed, Luca Moretti, Noor Patel, Maeve Quinn, Elias Grant
- Complete, Active, Waiting, Not started
- Connect a live case
- Live evidence will appear after the Supabase and MCP gates pass.
- Talk to the organisation
- Manager interface · read-only
- Repository publish gate pending

Customer names, usage percentages, billing events, renewal dates, support details and evidence claims are prohibited in frontend source.

## Icon inventory

Lucide outline icons at 1.6–1.8px stroke:

- Brand: custom code-native circular signal mark
- Pulse: Activity
- Organisation: Network
- Evidence: FileText
- Recovery Room: Sparkles
- Trust Gate: ShieldCheck
- Audit: Scale
- Researcher: Search
- Designer: PenTool
- Maker: Wrench
- Communicator: Megaphone
- Manager: UserRoundCog
- Manager dock: Compass

## Gate 1 interactions

1. Tabs update the selected route and preserve deep-linkable hash URLs.
2. Agent nodes support pointer and keyboard selection.
3. Selecting an agent updates the single inspector and communicates the stage status.
4. The Manager dock expands, accepts local draft text and clearly states that server chat is not connected.
5. Reduced-motion mode removes path and focus choreography.

## Visual fidelity checkpoints

- Warm ivory rather than white, blue-gray or dark background
- No sidebar and no bento cards
- Central artefact remains the primary focal point
- Five nodes read as one ordered organisation, not independent assistants
- Right inspector is the only substantial panel
- Manager dock is visually connected but not mistaken for another agent
- Dense desktop composition reorganises legibly on mobile
