# ADR 0003: Browser-native hash routing

Status: accepted

## Context

The public application must work from GitHub Pages, where server-side route fallbacks are unavailable. A hash-based route is therefore appropriate.

The initial scaffold briefly installed React Router. The dependency audit reported high-severity advisories across the available release ranges, including functionality intended for SSR, server actions and RSC that RetentionLab does not use.

## Decision

RetentionLab uses a small browser-native hash navigation layer built with `history.pushState`, `hashchange` and React `useSyncExternalStore`. It supports accessible anchors, modified-click behavior, back/forward navigation and active route state without importing server routing features.

## Verification

- Six case routes and the two global routes render through hash URLs.
- Navigation is covered by component tests and browser interaction checks.
- The dependency audit reports zero vulnerabilities after React Router removal.

