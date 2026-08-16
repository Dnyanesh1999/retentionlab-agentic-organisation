/**
 * ArtifactGlyph — the identity mark of one sealed artefact.
 *
 * Every stage of a run seals its output under a 64-character SHA-256. Those are
 * never shown in full in the interface, so until now a reader had no way to tell
 * one sealed artefact from another, or to see that a downstream stage inherited
 * the exact predecessor it claims. This draws the hash instead: a deterministic
 * seal whose every coordinate comes from the hash bytes.
 *
 * What that buys, precisely:
 *
 * - the same artefact always shows the same mark, so a reader learns to
 *   recognise a stage's seal;
 * - two different artefacts cannot show the same mark, so a lineage link that
 *   does not match its predecessor is a visibly different shape.
 *
 * The mark is decorative in the accessibility sense — it encodes nothing a
 * screen-reader user could act on that the text does not already say — so the
 * `svg` is hidden and the caller is expected to render the truncated hash as
 * text beside it. It is never a substitute for that text.
 *
 * The optional draw-in animates `pathLength` only, never layout, and resolves
 * reduced motion through the shared gate like every other animated surface here.
 */
import { useMemo } from "react";
import { motion } from "motion/react";

import { useMotionConfig, useResolvedReducedMotion } from "../motion/motionContext";
import { artifactGeometry, isArtifactHash } from "./glyphGeometry";

import "./glyph.css";

type ArtifactGlyphProps = {
  /** The artefact's 64-character SHA-256. */
  sha256: string;
  /** Rendered size in px. Defaults to 40. */
  size?: number;
  /** Draw the outline in on mount rather than appearing complete. */
  draw?: boolean;
  /** Dim the mark, for a stage that is not the current selection. */
  muted?: boolean;
  reducedMotion?: boolean;
  className?: string;
};

export function ArtifactGlyph({
  sha256,
  size = 40,
  draw = false,
  muted = false,
  reducedMotion,
  className,
}: ArtifactGlyphProps) {
  const shouldReduceMotion = useResolvedReducedMotion(reducedMotion);
  const { duration, ease } = useMotionConfig();

  // Keyed on the hash: the geometry is pure, so it is recomputed only when the
  // artefact actually changes.
  const geometry = useMemo(
    () => (isArtifactHash(sha256) ? artifactGeometry(sha256) : null),
    [sha256],
  );

  // Fail closed. A malformed identity renders nothing rather than a plausible
  // seal, because a mark that looks real is the one thing this must never fake.
  if (!geometry) return null;

  const animateOutline = draw && !shouldReduceMotion;

  return (
    <svg
      aria-hidden="true"
      className={`artifact-glyph${muted ? " is-muted" : ""}${className ? ` ${className}` : ""}`}
      data-reduced-motion={shouldReduceMotion ? "true" : undefined}
      focusable="false"
      height={size}
      role="presentation"
      viewBox="0 0 100 100"
      width={size}
    >
      <circle
        className="artifact-glyph__ring"
        cx="50"
        cy="50"
        r="46"
        strokeDasharray={geometry.ringDash}
        transform={`rotate(${geometry.ringRotation} 50 50)`}
      />
      <motion.path
        animate={animateOutline ? { pathLength: 1 } : undefined}
        className="artifact-glyph__body"
        d={geometry.body}
        initial={animateOutline ? { pathLength: 0 } : undefined}
        transition={animateOutline ? { duration: duration.slow, ease: ease.entrance } : undefined}
      />
      <circle className="artifact-glyph__core" cx="50" cy="50" r={geometry.core} />
    </svg>
  );
}
