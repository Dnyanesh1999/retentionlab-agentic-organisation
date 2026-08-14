/**
 * Shared motion tokens for the RetentionLab primitive layer.
 *
 * Design inspiration: the interaction quality of Motion Primitives
 * (motion-primitives.com) and Magic UI (magicui.design). The curves and
 * cadence below are an original, RetentionLab-tuned interpretation — calmer
 * and more editorial than the reference libraries' showcase defaults, so the
 * motion reads as product feedback rather than spectacle.
 *
 * All values are consumed only for `transform`, `opacity`, and `pathLength`
 * animations. No token here encodes anything that would trigger layout.
 */

/** Cubic-bezier easing tuples (`[x1, y1, x2, y2]`). */
export const motionEase = {
  /** Neutral movement for state changes; gentle acceleration + settle. */
  standard: [0.22, 1, 0.36, 1] as [number, number, number, number],
  /** Entrances/reveals; fast start, long soft tail (expo-out feel). */
  entrance: [0.16, 1, 0.3, 1] as [number, number, number, number],
  /** Exits; leans forward so leaving content clears quickly. */
  exit: [0.4, 0, 1, 1] as [number, number, number, number],
};

/** Durations in seconds, deliberately short to avoid perceived lag. */
export const motionDuration = {
  fast: 0.16,
  base: 0.22,
  slow: 0.52,
};

/** Default per-child delay for staggered reveals, in seconds. */
export const motionStagger = 0.06;

export type MotionEaseToken = keyof typeof motionEase;
export type MotionDurationToken = keyof typeof motionDuration;
