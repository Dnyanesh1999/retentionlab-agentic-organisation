import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

/**
 * Desktop workspace + inspector behaviour for the Organisation screen.
 *
 * Two concerns live here, both expressed as pure helpers so the maths can be
 * unit-tested in jsdom without a real layout engine:
 *   1. `computeScrollState` — the inspector's scroll progress / edge state that
 *      drives the decorative progress rail and top/bottom fades.
 *   2. `computeOrganisationFit` — the bounded, viewport-aware height for the
 *      two-column region so the document never grows to the full inspector
 *      content height (the empty-cream-column bug).
 */

export type InspectorScrollState = {
  /** 0..1 fraction of the way through the scrollable range. */
  progress: number;
  /** true when the content is taller than its viewport (i.e. it can scroll). */
  hasOverflow: boolean;
  /** true when scrolled to (or effectively at) the very top. */
  atTop: boolean;
  /** true when scrolled to (or effectively at) the very bottom. */
  atBottom: boolean;
  /** 0..1 size of the decorative thumb relative to the track (visible ratio). */
  thumbSize: number;
};

const IDLE_STATE: InspectorScrollState = {
  progress: 0,
  hasOverflow: false,
  atTop: true,
  atBottom: true,
  thumbSize: 1,
};

/** Smallest thumb the rail will render, so it stays grabbable-looking on long pages. */
const MIN_THUMB_SIZE = 0.14;

export function computeScrollState(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
  epsilon = 1,
): InspectorScrollState {
  const maxScroll = Math.max(0, scrollHeight - clientHeight);
  const hasOverflow = maxScroll > epsilon;
  if (!hasOverflow) return IDLE_STATE;

  const clamped = Math.min(Math.max(scrollTop, 0), maxScroll);
  const progress = clamped / maxScroll;
  const visibleRatio = clientHeight > 0 ? clientHeight / scrollHeight : 1;
  const thumbSize = Math.min(1, Math.max(MIN_THUMB_SIZE, visibleRatio));

  return {
    progress,
    hasOverflow,
    atTop: clamped <= epsilon,
    atBottom: clamped >= maxScroll - epsilon,
    thumbSize,
  };
}

/** Keys the inspector claims when the focused scroll region is itself the target. */
export const INSPECTOR_SCROLL_KEYS = [
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
  "Home",
  "End",
] as const;

export type InspectorScrollKey = (typeof INSPECTOR_SCROLL_KEYS)[number];

/** Per-keypress line step for the arrow keys, in CSS pixels. */
const LINE_STEP = 48;
/** Overlap kept when paging so a line of context carries across a PageUp/Down. */
const PAGE_OVERLAP = 48;

/**
 * Pure target-`scrollTop` calculation for a keyboard scroll on the inspector.
 *
 * Returns the clamped destination `scrollTop` for a recognised scroll key when
 * the region can actually scroll, or `null` when the key is not one we handle
 * or the content fits (nothing to scroll — let the key do its native thing).
 *
 * A recognised key at a boundary still returns a number (equal to the clamped
 * current position) so the caller can `preventDefault` and keep the page still
 * rather than letting the keypress chain out to the document.
 */
export function computeKeyScrollTarget(
  key: string,
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
): number | null {
  const maxScroll = Math.max(0, scrollHeight - clientHeight);
  if (maxScroll <= 0) return null;

  const page = Math.max(LINE_STEP, clientHeight - PAGE_OVERLAP);
  let target: number;
  switch (key) {
    case "ArrowDown":
      target = scrollTop + LINE_STEP;
      break;
    case "ArrowUp":
      target = scrollTop - LINE_STEP;
      break;
    case "PageDown":
      target = scrollTop + page;
      break;
    case "PageUp":
      target = scrollTop - page;
      break;
    case "Home":
      target = 0;
      break;
    case "End":
      target = maxScroll;
      break;
    default:
      return null;
  }

  return Math.min(Math.max(target, 0), maxScroll);
}

export type OrganisationFitInput = {
  /** Natural (content) height of the left organisation stage. */
  stageNaturalHeight: number;
  /** Distance from the top of the document to the top of the layout. */
  layoutTop: number;
  /** Current viewport height (innerHeight / dvh). */
  viewportHeight: number;
  /** Floor so the inspector always keeps a usable scroll viewport. */
  minHeight?: number;
  /** Slack kept below the layout so nothing kisses the viewport edge. */
  bottomGap?: number;
};

/**
 * Bounded height for the two-column region:
 *   - never taller than the left stage's own content (so no empty cream column
 *     re-appears on tall monitors),
 *   - never taller than the space left in the viewport below the header/tabs
 *     (so the document doesn't grow to the full inspector height),
 *   - never shorter than a sensible floor (so the inspector stays usable).
 * All inputs are measured at runtime — no device-specific pixel constants.
 */
export function computeOrganisationFit({
  stageNaturalHeight,
  layoutTop,
  viewportHeight,
  minHeight = 480,
  bottomGap = 0,
}: OrganisationFitInput): number {
  const available = Math.max(0, viewportHeight - layoutTop - bottomGap);
  const fit = Math.min(stageNaturalHeight, available);
  return Math.round(Math.max(minHeight, fit));
}

/**
 * Tracks the inspector scroll container: reports progress/edge state and resets
 * the container to the top whenever `resetKey` (the selected stage) changes.
 * Uses native scrolling throughout; the container ref is the real scroller.
 */
export function useInspectorScroll<T extends HTMLElement>(resetKey: string) {
  const ref = useRef<T>(null);
  const [state, setState] = useState<InspectorScrollState>(IDLE_STATE);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      setState((prev) => {
        const next = computeScrollState(el.scrollTop, el.scrollHeight, el.clientHeight);
        return prev.progress === next.progress &&
          prev.hasOverflow === next.hasOverflow &&
          prev.atTop === next.atTop &&
          prev.atBottom === next.atBottom &&
          prev.thumbSize === next.thumbSize
          ? prev
          : next;
      });
    };

    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      observer?.disconnect();
    };
  }, []);

  // Reset to the top on stage change — synchronously, before paint, and without
  // touching page scroll or focus. `scrollTop = 0` is an instant assignment, so
  // it honours reduced-motion by construction.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = 0;
    setState(computeScrollState(el.scrollTop, el.scrollHeight, el.clientHeight));
  }, [resetKey]);

  // Keyboard scrolling for the native region. Only claim keys when the region
  // itself is the event target, so any future interactive descendant (link,
  // button, copy control) keeps native key handling. Assigning `scrollTop` is an
  // instant/auto scroll — it never animates, so reduced-motion is honoured by
  // construction, and it moves neither the page nor focus.
  const onKeyDown = useCallback((event: ReactKeyboardEvent<T>) => {
    if (event.target !== event.currentTarget) return;
    const el = ref.current;
    if (!el) return;
    const target = computeKeyScrollTarget(
      event.key,
      el.scrollTop,
      el.scrollHeight,
      el.clientHeight,
    );
    if (target === null) return;
    event.preventDefault();
    el.scrollTop = target;
  }, []);

  return { ref, onKeyDown, ...state };
}

/**
 * Measures and applies the bounded, viewport-aware height for the layout at
 * desktop widths. Returns refs for the layout and stage plus the resolved
 * height (null on tablet/mobile, where natural single-document flow is used).
 */
export function useOrganisationFit(query = "(min-width: 981px)") {
  const layoutRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const layout = layoutRef.current;
    const stage = stageRef.current;
    if (!layout || !stage || typeof window === "undefined") return;
    // No matchMedia (e.g. jsdom / older engines) → stay in natural flow rather
    // than throwing; the CSS min-width query still governs the visual layout.
    if (typeof window.matchMedia !== "function") return;

    const media = window.matchMedia(query);

    const measure = () => {
      if (!media.matches) {
        setHeight((prev) => (prev === null ? prev : null));
        return;
      }
      const layoutTop = layout.getBoundingClientRect().top + window.scrollY;
      const next = computeOrganisationFit({
        stageNaturalHeight: stage.scrollHeight,
        layoutTop,
        viewportHeight: window.innerHeight,
      });
      // Only commit meaningful changes so tweaking the layout height (which
      // feeds back through the ResizeObserver) can't loop.
      setHeight((prev) => (prev !== null && Math.abs(prev - next) <= 1 ? prev : next));
    };

    measure();
    window.addEventListener("resize", measure);
    media.addEventListener("change", measure);
    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(stage);
    return () => {
      window.removeEventListener("resize", measure);
      media.removeEventListener("change", measure);
      observer?.disconnect();
    };
  }, [query]);

  return { layoutRef, stageRef, height };
}
