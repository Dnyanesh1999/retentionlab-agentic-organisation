/**
 * SharedIndicator — one underline that travels between the items of a tab set.
 *
 * Render it inside whichever item is currently active. Because every instance
 * in a group shares a `layoutId`, `motion` treats the mount in the new item and
 * the unmount in the old one as the same element moving, and interpolates the
 * distance between them. That is why this must be a real element: a
 * pseudo-element cannot be animated across DOM nodes.
 *
 * Under reduced motion it degrades to a plain static rule on the active item —
 * same appearance, no travel.
 */
import { motion } from "motion/react";

import { useMotionConfig, useResolvedReducedMotion } from "./motionContext";

import "./motion.css";

type SharedIndicatorProps = {
  /** Shared across one group of items. Two groups must not share a value. */
  layoutId: string;
  reducedMotion?: boolean;
  className?: string;
};

export function SharedIndicator({
  layoutId,
  reducedMotion,
  className = "shared-indicator",
}: SharedIndicatorProps) {
  const shouldReduceMotion = useResolvedReducedMotion(reducedMotion);
  const { duration, ease } = useMotionConfig();

  if (shouldReduceMotion) {
    return <span aria-hidden="true" className={className} />;
  }

  return (
    <motion.span
      aria-hidden="true"
      className={className}
      layoutId={layoutId}
      transition={{ duration: duration.base, ease: ease.standard }}
    />
  );
}
