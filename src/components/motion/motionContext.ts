import { createContext, useContext } from "react";
import { useReducedMotion } from "motion/react";

import { motionDuration, motionEase, motionStagger } from "./tokens";

export type MotionConfigValue = {
  reducedMotion: boolean | null;
  ease: typeof motionEase;
  duration: typeof motionDuration;
  stagger: number;
};

export const MotionConfigContext = createContext<MotionConfigValue>({
  reducedMotion: null,
  ease: motionEase,
  duration: motionDuration,
  stagger: motionStagger,
});

export function useMotionConfig(): MotionConfigValue {
  return useContext(MotionConfigContext);
}

/** Any explicit, provider, or OS request to reduce motion wins. */
export function useResolvedReducedMotion(override?: boolean): boolean {
  const { reducedMotion } = useMotionConfig();
  const systemReducedMotion = useReducedMotion();
  return Boolean(override || reducedMotion || systemReducedMotion);
}
