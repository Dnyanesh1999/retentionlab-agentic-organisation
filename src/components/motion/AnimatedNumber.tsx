/**
 * AnimatedNumber — count a real figure up to its real value.
 *
 * Inspiration: the "number ticker" pattern from Magic UI, re-authored for
 * RetentionLab's evidence surfaces. Two rules make it honest rather than
 * decorative:
 *
 * 1. The value shown is always derived from the supplied `value`. Nothing is
 *    invented, and the element settles on the exact formatted figure.
 * 2. Assistive technology never hears the intermediate frames. The element is
 *    named with the final formatted value, so a screen reader announces
 *    "€9.6K", not a stream of partial numbers.
 *
 * Under reduced motion the final value is rendered directly and no animation
 * is scheduled at all.
 */
import { useEffect, useRef, useState } from "react";
import { animate } from "motion/react";

import { useMotionConfig, useResolvedReducedMotion } from "./motionContext";

import "./motion.css";

type AnimatedNumberProps = {
  /** The real, final figure. */
  value: number;
  /** Renders the figure for display. Defaults to a plain integer string. */
  format?: (value: number) => string;
  /** Where the count starts. Defaults to 0. */
  from?: number;
  reducedMotion?: boolean;
  className?: string;
};

const defaultFormat = (value: number) => String(Math.round(value));

export function AnimatedNumber({
  value,
  format = defaultFormat,
  from = 0,
  reducedMotion,
  className,
}: AnimatedNumberProps) {
  const shouldReduceMotion = useResolvedReducedMotion(reducedMotion);
  const { duration, ease } = useMotionConfig();

  const [displayed, setDisplayed] = useState(from);
  // Where the count currently sits. Touched only inside the effect and its
  // update callback — never read during render — so a value that changes
  // mid-flight continues from the current frame instead of snapping back.
  const position = useRef(from);

  useEffect(() => {
    if (shouldReduceMotion) {
      return;
    }

    const controls = animate(position.current, value, {
      duration: duration.slow,
      ease: ease.entrance,
      onUpdate: (latest) => {
        position.current = latest;
        setDisplayed(latest);
      },
      // Guarantees the exact figure rather than trusting the last frame to
      // land precisely on it.
      onComplete: () => {
        position.current = value;
        setDisplayed(value);
      },
    });

    return () => controls.stop();
  }, [duration.slow, ease.entrance, shouldReduceMotion, value]);

  return (
    <span
      aria-label={format(value)}
      className={className ? `animated-number ${className}` : "animated-number"}
      data-reduced-motion={shouldReduceMotion ? "true" : undefined}
      role="img"
    >
      <span aria-hidden="true">{format(shouldReduceMotion ? value : displayed)}</span>
    </span>
  );
}
