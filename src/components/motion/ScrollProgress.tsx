/**
 * ScrollProgress — a hairline rail showing how far down the page you are.
 *
 * This is the one kind of progress the project's rules allow a bar to show:
 * it is derived from the document's real scroll offset, so it can never imply
 * work that has not happened. It carries no ARIA role and is `aria-hidden`,
 * because the scrollbar already conveys this to assistive technology.
 *
 * Hidden entirely under reduced motion — a rail that tracks scrolling is
 * exactly the kind of continuous movement that setting asks to suppress.
 */
import { motion, useScroll, useSpring } from "motion/react";

import { useResolvedReducedMotion } from "./motionContext";

import "./motion.css";

type ScrollProgressProps = {
  reducedMotion?: boolean;
  className?: string;
};

export function ScrollProgress({ reducedMotion, className }: ScrollProgressProps) {
  const shouldReduceMotion = useResolvedReducedMotion(reducedMotion);
  const { scrollYProgress } = useScroll();
  // A light spring stops the rail jittering on trackpads without ever letting
  // it run ahead of the real offset.
  const scaleX = useSpring(scrollYProgress, { stiffness: 180, damping: 30, restDelta: 0.001 });

  if (shouldReduceMotion) {
    return null;
  }

  return (
    <motion.div
      aria-hidden="true"
      className={className ? `scroll-progress ${className}` : "scroll-progress"}
      style={{ scaleX }}
    />
  );
}
