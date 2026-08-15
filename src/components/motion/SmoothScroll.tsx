/**
 * SmoothScroll — momentum scrolling for the document, via Lenis.
 *
 * Lenis takes over the root scroller and interpolates towards the real target
 * offset. That is a page-wide behavioural change, so it is fenced in tightly:
 *
 * - `prefers-reduced-motion` disables it completely. The library is not even
 *   fetched, no wheel listener is attached, and native scrolling is untouched.
 *   (Lenis' own `respectReducedMotion` default would also catch this; the gate
 *   here is deliberately redundant rather than trusting a library default.)
 * - `anchors` stays off. This app routes on the hash, so every nav link is an
 *   `a[href^="#"]`; letting Lenis claim those clicks would break navigation.
 * - Touch is left native (Lenis' `syncTouch` default). Mobile browsers already
 *   have good momentum and overriding it costs more than it gives.
 * - Inner scroll regions opt out with `data-lenis-prevent`, which Lenis reads
 *   to leave their wheel events alone. See `LENIS_PREVENT` in `lenisPrevent`.
 *
 * Keyboard scrolling and the scrollbar keep working: Lenis animates towards
 * the position the browser asked for rather than replacing the mechanism.
 */
import { useEffect, type ReactNode } from "react";

import { useResolvedReducedMotion } from "./motionContext";

type SmoothScrollProps = {
  children?: ReactNode;
  reducedMotion?: boolean;
};

export function SmoothScroll({ children, reducedMotion }: SmoothScrollProps) {
  const shouldReduceMotion = useResolvedReducedMotion(reducedMotion);

  useEffect(() => {
    if (shouldReduceMotion || typeof window === "undefined") {
      return;
    }

    let instance: { destroy: () => void } | null = null;
    let cancelled = false;

    // Loaded on demand so the library stays out of the initial bundle and is
    // never fetched at all by a visitor who has asked to reduce motion.
    void import("lenis").then(({ default: Lenis }) => {
      if (cancelled) {
        return;
      }
      instance = new Lenis({
        duration: 0.9,
        // Mirrors the `entrance` easing token: quick start, long soft tail.
        easing: (t) => 1 - Math.pow(1 - t, 3),
        wheelMultiplier: 0.9,
        autoRaf: true,
        anchors: false,
      });
    });

    return () => {
      cancelled = true;
      instance?.destroy();
    };
  }, [shouldReduceMotion]);

  return <>{children}</>;
}
