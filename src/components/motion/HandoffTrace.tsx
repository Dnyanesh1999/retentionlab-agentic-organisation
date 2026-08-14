/**
 * HandoffTrace — a directional SVG line that "draws" a handoff between two
 * agent stages, then holds. Communicates that work flows from A → B.
 *
 * Inspiration: the animated-beam / SVG path-draw effects in Magic UI and
 * Motion Primitives. Adapted here to be purely functional wayfinding rather
 * than decoration: it animates `pathLength` only (never layout), draws exactly
 * once with a clear direction, and renders a fully-drawn static line under
 * reduced motion. The graphic is decorative, so the whole `svg` is
 * `aria-hidden` and removed from the tab order — the real semantics live in the
 * connected nodes' text.
 */
import { useId } from "react";
import { motion } from "motion/react";

import { useMotionConfig, useResolvedReducedMotion } from "./motionContext";
import "./motion.css";

type HandoffTraceProps = {
  /** SVG path data for the connection (e.g. `"M4 20 C 40 20, 40 4, 76 4"`). */
  d: string;
  width: number;
  height: number;
  /** Defaults to `0 0 {width} {height}`. */
  viewBox?: string;
  /** Draw when true; reset to undrawn when false. Defaults to true. */
  active?: boolean;
  /** Render a terminal arrowhead so direction reads at a glance. */
  directed?: boolean;
  strokeWidth?: number;
  /** Override draw duration in seconds. Defaults to the `slow` token. */
  duration?: number;
  reducedMotion?: boolean;
  className?: string;
};

export function HandoffTrace({
  d,
  width,
  height,
  viewBox,
  active = true,
  directed = true,
  strokeWidth = 2,
  duration,
  reducedMotion,
  className,
}: HandoffTraceProps) {
  const { ease, duration: durationTokens } = useMotionConfig();
  const shouldReduceMotion = useResolvedReducedMotion(reducedMotion);
  const markerId = useId();
  const drawDuration = duration ?? durationTokens.slow;

  const sharedPathProps = {
    className: "handoff-trace__path",
    d,
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round" as const,
    markerEnd: directed ? `url(#${markerId})` : undefined,
  };

  return (
    <svg
      aria-hidden="true"
      className={className}
      focusable="false"
      height={height}
      viewBox={viewBox ?? `0 0 ${width} ${height}`}
      width={width}
    >
      {directed ? (
        <defs>
          <marker
            id={markerId}
            markerHeight="6"
            markerWidth="6"
            orient="auto-start-reverse"
            refX="4"
            refY="3"
            viewBox="0 0 6 6"
          >
            <path d="M0 0 L6 3 L0 6 Z" fill="currentColor" />
          </marker>
        </defs>
      ) : null}

      {shouldReduceMotion ? (
        // Static, fully-drawn line — no `pathLength` animation at all.
        <path {...sharedPathProps} data-motion="static" />
      ) : (
        <motion.path
          {...sharedPathProps}
          animate={{ pathLength: active ? 1 : 0 }}
          data-motion="draw"
          initial={{ pathLength: 0 }}
          transition={{ duration: drawDuration, ease: ease.standard }}
        />
      )}
    </svg>
  );
}
