/**
 * Spotlight — a warm sheen that follows the pointer across a panel.
 *
 * Inspiration: the pointer-tracked "spotlight card" in Magic UI, reworked to
 * suit warm paper surfaces rather than dark glass: the highlight is a low
 * opacity forest wash, not a glow.
 *
 * It is purely decorative, so it costs nothing when it cannot help:
 * - reduced motion turns it off entirely;
 * - a coarse pointer (touch) turns it off, since there is nothing to track;
 * - the position is written to CSS custom properties, so the paint happens in
 *   a single `::after` layer and never touches layout.
 */
import { useCallback, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { useResolvedReducedMotion } from "./motionContext";

import "./motion.css";

type SpotlightProps = {
  children: ReactNode;
  /** Semantic container element. Defaults to `div`. */
  as?: "div" | "section" | "article";
  reducedMotion?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
};

/**
 * True when the device's primary pointer can actually hover. Guarded for
 * jsdom and any environment without `matchMedia`.
 */
function useFinePointer(): boolean {
  const [fine] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }
    return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  });
  return fine;
}

export function Spotlight({
  children,
  as: Tag = "div",
  reducedMotion,
  className,
  ...labels
}: SpotlightProps) {
  const shouldReduceMotion = useResolvedReducedMotion(reducedMotion);
  const finePointer = useFinePointer();
  const active = !shouldReduceMotion && finePointer;
  const frame = useRef<number | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  const handleMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!active) {
        return;
      }
      const bounds = event.currentTarget.getBoundingClientRect();
      const x = ((event.clientX - bounds.left) / bounds.width) * 100;
      const y = ((event.clientY - bounds.top) / bounds.height) * 100;

      // Coalesce to one write per frame; pointermove fires far faster than paint.
      if (frame.current !== null) {
        cancelAnimationFrame(frame.current);
      }
      frame.current = requestAnimationFrame(() => setPosition({ x, y }));
    },
    [active],
  );

  const handleLeave = useCallback(() => {
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    setPosition(null);
  }, []);

  const style = position
    ? ({ "--spotlight-x": `${position.x}%`, "--spotlight-y": `${position.y}%` } as CSSProperties)
    : undefined;

  return (
    <Tag
      {...labels}
      className={className}
      data-spotlight={active ? "on" : "off"}
      data-spotlight-lit={position ? "true" : undefined}
      onPointerLeave={active ? handleLeave : undefined}
      onPointerMove={active ? handleMove : undefined}
      style={style}
    >
      {children}
    </Tag>
  );
}
