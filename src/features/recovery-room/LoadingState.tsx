import { Sprout } from "lucide-react";
import { useReducedMotion } from "motion/react";

type LoadingStateProps = {
  progress: number;
  reducedMotion?: boolean;
};

export function LoadingState({ progress, reducedMotion }: LoadingStateProps) {
  const systemPrefersReducedMotion = useReducedMotion();
  const shouldReduceMotion = reducedMotion ?? systemPrefersReducedMotion;
  const boundedProgress = Math.min(100, Math.max(0, Math.round(progress)));

  return (
    <section className="signal-garden-loading" aria-labelledby="signal-garden-loading-title">
      <Sprout aria-hidden="true" className="signal-garden-loading__mark" strokeWidth={1.5} />
      <h2 id="signal-garden-loading-title">Preparing your signal garden...</h2>
      {shouldReduceMotion ? (
        <p className="signal-garden-loading__static" role="status">
          Loading...
        </p>
      ) : (
        <div
          aria-label="Loading signal garden, please wait"
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={boundedProgress}
          aria-valuetext={`Preparing your signal garden, ${boundedProgress} percent`}
          className="signal-garden-loading__progress"
          role="progressbar"
        >
          <span style={{ transform: `scaleX(${boundedProgress / 100})` }} />
        </div>
      )}
    </section>
  );
}
