/**
 * Opt-out marker for regions that scroll their own content.
 *
 * {@link SmoothScroll} hands the document's wheel events to Lenis. Any element
 * with this attribute keeps native wheel scrolling, so a modal sheet or an
 * inspector pane scrolls itself instead of the page behind it.
 *
 * It lives in its own module rather than beside the component so the component
 * file exports only components, which is what React Fast Refresh requires.
 */
export const LENIS_PREVENT = { "data-lenis-prevent": "true" } as const;
