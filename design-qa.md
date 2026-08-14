# RetentionLab production casebook — design QA

## Visual target

The accepted `#/design-lab` casebook concept at 1280 × 720, with Bricolage Grotesque replacing the earlier condensed display face and inline animated specialist disclosures replacing the detached contribution panel.

## Production comparison

- Desktop, 1280 × 720: the production `#/cases/overview` route preserves the accepted hierarchy, spacing, four-tab information architecture, handoff ledger, human-boundary card, and case assistant. The preview-only toolbar is correctly absent.
- Mobile, 390 × 844: headline, approval state, tabs, ledger, and floating assistant remain readable without horizontal overflow or clipped controls.
- Brand: RetentionLab now uses the same Bricolage Grotesque display family as the case headline.
- Navigation: only the functional Case archive and Active case destinations are exposed.
- Specialist disclosures: each stage now uses a structured evidence brief with an outcome headline, three scannable measures, and a compact provenance strip; long hashes are reserved for the technical record.

## Interaction verification

- Case archive opens the Copper Finch record.
- Overview, Workstream, Experience, and Decision tabs transition correctly.
- Specialist rows open their contribution inline.
- Experience links to the live Signal Garden, which provides a working return path.
- Ask this case opens and answers from the sealed assessed record.
- Loading, failure, reduced-motion, and keyboard-accessible states remain implemented.
- Browser console: no application errors.

## Gate result

No P0, P1, or P2 visual issues remain in the verified views.

final result: passed
