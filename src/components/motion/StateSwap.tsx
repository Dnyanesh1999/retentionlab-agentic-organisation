/**
 * StateSwap — cross-fade between loading / error / success (or any keyed)
 * content, interruption-safe and screen-reader friendly.
 *
 * Inspiration: the `AnimatePresence`-driven content-swap demos in Motion
 * Primitives / Magic UI. Adapted for RetentionLab async surfaces: a single
 * stable live region wraps a keyed child so assistive tech announces state
 * changes; `mode="wait"` guarantees only one state is mounted at a time so
 * rapid flips can't stack; motion is `opacity` + a small `transform` only, and
 * collapses to an instant swap under reduced motion.
 */
import { type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";

import { useMotionConfig, useResolvedReducedMotion } from "./motionContext";

type StateSwapProps = {
  /** Distinct key for the current state (e.g. "loading" | "error" | "success"). */
  state: string;
  /** Content for the current state. */
  children: ReactNode;
  /** Vertical travel in px for enter/exit (transform only). */
  distance?: number;
  /** ARIA live politeness for the stable outer region. Defaults to "polite". */
  live?: "polite" | "assertive" | "off";
  reducedMotion?: boolean;
  className?: string;
};

export function StateSwap({
  state,
  children,
  distance = 8,
  live = "polite",
  reducedMotion,
  className,
}: StateSwapProps) {
  const { ease, duration } = useMotionConfig();
  const shouldReduceMotion = useResolvedReducedMotion(reducedMotion);

  const enter = { opacity: 0, y: distance };
  const exit = { opacity: 0, y: -distance };

  return (
    <div
      aria-live={live}
      className={className}
      data-reduced-motion={shouldReduceMotion ? "true" : undefined}
      data-state={state}
    >
      {shouldReduceMotion ? (
        /*
         * A genuinely instant swap: no presence machinery at all. Even a
         * zero-duration exit costs a frame under `mode="wait"`, because the
         * incoming state is held until the outgoing one has finished leaving —
         * and that is time the new content is not on screen. Rendering the
         * child directly is the only way this is actually instant.
         */
        <div key={state}>{children}</div>
      ) : (
        /* `initial={false}` avoids animating the very first paint; `mode="wait"`
           keeps a single state mounted so interrupted swaps never overlap. */
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            exit={exit}
            initial={enter}
            key={state}
            transition={{ duration: duration.base, ease: ease.standard }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
