/**
 * RetentionLab motion primitive layer — export barrel.
 *
 * A small, reusable set of interaction primitives inspired by the quality of
 * Motion Primitives and Magic UI, re-authored for RetentionLab: semantic DOM,
 * `transform`/`opacity`/`pathLength` only, no ambient infinite animation, and
 * first-class `prefers-reduced-motion` support.
 */
export { MotionConfigProvider } from "./MotionConfigProvider";
export { useMotionConfig, useResolvedReducedMotion } from "./motionContext";
export { StaggerReveal, StaggerItem } from "./StaggerReveal";
export { HandoffTrace } from "./HandoffTrace";
export { StateSwap } from "./StateSwap";
export { ProgressVeil, type ProgressStage } from "./ProgressVeil";
export {
  motionEase,
  motionDuration,
  motionStagger,
  type MotionEaseToken,
  type MotionDurationToken,
} from "./tokens";
