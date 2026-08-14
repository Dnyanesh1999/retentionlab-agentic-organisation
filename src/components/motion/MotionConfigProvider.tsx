/**
 * MotionConfigProvider — shared timing tokens + prefers-reduced-motion policy.
 *
 * Inspiration: Motion Primitives / Magic UI both lean on a single source of
 * truth for easing and duration so a family of components feels coherent.
 * This implementation is original: it pairs our own {@link tokens} with
 * `motion`'s `MotionConfig` and resolves reduced-motion once, then hands the
 * concrete decision to every primitive via context so tests and consumers can
 * override it deterministically.
 */
import { useMemo, type ReactNode } from "react";
import { MotionConfig, useReducedMotion } from "motion/react";

import { MotionConfigContext, type MotionConfigValue } from "./motionContext";
import { motionDuration, motionEase, motionStagger } from "./tokens";

type MotionConfigProviderProps = {
  children: ReactNode;
  /**
   * Force reduced motion on/off. When omitted the OS `prefers-reduced-motion`
   * setting is honoured. Primarily an override for tests and previews.
   */
  reducedMotion?: boolean;
  /** Override the shared stagger cadence for a subtree. */
  stagger?: number;
};

export function MotionConfigProvider({
  children,
  reducedMotion,
  stagger,
}: MotionConfigProviderProps) {
  const systemReducedMotion = useReducedMotion();
  // Reduced motion is a one-way safety boundary: a local `false` must never
  // override an OS or parent request to reduce motion.
  const resolved = Boolean(reducedMotion || systemReducedMotion);

  const value = useMemo<MotionConfigValue>(
    () => ({
      reducedMotion: resolved,
      ease: motionEase,
      duration: motionDuration,
      stagger: stagger ?? motionStagger,
    }),
    [resolved, stagger],
  );

  // `MotionConfig` propagates the reduced-motion policy to any bare `motion.*`
  // usage inside the subtree; our primitives also read it from context.
  const policy = resolved ? "always" : "user";

  return (
    <MotionConfigContext.Provider value={value}>
      <MotionConfig reducedMotion={policy}>{children}</MotionConfig>
    </MotionConfigContext.Provider>
  );
}
