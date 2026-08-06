import { Leaf, Sprout } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useEffect } from "react";

export type AcknowledgmentOutcome = "inspected" | "shared" | "declined";

export type AcknowledgmentBannerProps = {
  outcome: AcknowledgmentOutcome;
  reducedMotion?: boolean;
  durationMs?: number;
  onExpired: () => void;
};

export const acknowledgmentMessage =
  "Thank you for exploring your signal garden. Your team's patterns are yours to act on—or not.";

export function AcknowledgmentBanner({
  outcome,
  reducedMotion,
  durationMs = 5_000,
  onExpired,
}: AcknowledgmentBannerProps) {
  const systemPrefersReducedMotion = useReducedMotion();
  const shouldReduceMotion = reducedMotion ?? systemPrefersReducedMotion;

  useEffect(() => {
    if (shouldReduceMotion) return;

    const timeout = window.setTimeout(onExpired, durationMs);
    return () => window.clearTimeout(timeout);
  }, [durationMs, onExpired, shouldReduceMotion]);

  return (
    <div
      aria-live="polite"
      className="acknowledgment-branch"
      data-outcome={outcome}
      data-reduced-motion={String(Boolean(shouldReduceMotion))}
      role="status"
    >
      <span aria-hidden="true" className="acknowledgment-branch__stem" />
      <span aria-hidden="true" className="acknowledgment-branch__leaf acknowledgment-branch__leaf--start">
        <Sprout strokeWidth={1.35} />
      </span>
      <p>{acknowledgmentMessage}</p>
      <Leaf aria-hidden="true" className="acknowledgment-branch__leaf acknowledgment-branch__leaf--end" strokeWidth={1.25} />
    </div>
  );
}
