/**
 * ProgressVeil — a staged loading treatment that names what is actually
 * happening instead of faking a percentage.
 *
 * Inspiration: the "shine"/veil loading surfaces in Magic UI and the staged
 * reveals in Motion Primitives. The RetentionLab adaptation is deliberately
 * honest: progress is derived from *completed named stages* (a real, discrete
 * fraction), never a fabricated timer. The meter advances only when the caller
 * moves the active stage forward, there is no ambient/infinite spinner, and it
 * degrades to a plain "Stage X of Y" readout under reduced motion.
 *
 * Accessibility: the meter is decorative (`aria-hidden`); the authoritative
 * status is the labelled stage list plus a polite live region that announces
 * the current stage.
 */
import { type CSSProperties } from "react";
import { motion } from "motion/react";

import { useMotionConfig, useResolvedReducedMotion } from "./motionContext";
import "./motion.css";

export type ProgressStage = { id: string; label: string };

type ProgressVeilProps = {
  /** Ordered named stages. Strings are treated as both id and label. */
  stages: Array<ProgressStage | string>;
  /**
   * The stage currently in progress, by `id` or zero-based index. Stages
   * before it are complete; stages after it are pending.
   */
  activeStage: string | number;
  /** Set when every stage has finished — advances the meter to full. */
  complete?: boolean;
  /** Accessible name for the whole surface, e.g. "Loading recovery room". */
  label?: string;
  reducedMotion?: boolean;
  className?: string;
};

function normalizeStages(stages: Array<ProgressStage | string>): ProgressStage[] {
  return stages.map((stage) =>
    typeof stage === "string" ? { id: stage, label: stage } : stage,
  );
}

function resolveActiveIndex(stages: ProgressStage[], activeStage: string | number): number {
  if (typeof activeStage === "number") {
    return Math.min(Math.max(activeStage, 0), stages.length - 1);
  }
  const index = stages.findIndex((stage) => stage.id === activeStage);
  return index === -1 ? 0 : index;
}

export function ProgressVeil({
  stages,
  activeStage,
  complete = false,
  label = "Loading",
  reducedMotion,
  className,
}: ProgressVeilProps) {
  const { ease, duration } = useMotionConfig();
  const shouldReduceMotion = useResolvedReducedMotion(reducedMotion);

  const items = normalizeStages(stages);
  const total = items.length || 1;
  const activeIndex = resolveActiveIndex(items, activeStage);
  const current = items[activeIndex];

  // Real progress: fraction of *named stages* completed. Discrete and honest —
  // never an invented percentage.
  const completedCount = complete ? total : activeIndex;
  const fraction = Math.min(Math.max(completedCount / total, 0), 1);

  const meterStyle: CSSProperties = { transform: `scaleX(${fraction})`, transformOrigin: "left" };

  return (
    <section
      aria-busy={complete ? undefined : "true"}
      aria-label={label}
      className={className ? `progress-veil ${className}` : "progress-veil"}
      data-reduced-motion={shouldReduceMotion ? "true" : undefined}
    >
      {/* Decorative staged meter. Reflects completed named stages only. */}
      <div aria-hidden="true" className="progress-veil__meter">
        {shouldReduceMotion ? (
          <span className="progress-veil__meter-fill" style={meterStyle} />
        ) : (
          <motion.span
            animate={{ scaleX: fraction }}
            className="progress-veil__meter-fill"
            initial={false}
            style={{ transformOrigin: "left" }}
            transition={{ duration: duration.base, ease: ease.standard }}
          />
        )}
      </div>

      <ol className="progress-veil__stages">
        {items.map((stage, index) => {
          const state =
            complete || index < activeIndex ? "done" : index === activeIndex ? "active" : "pending";
          return (
            <li className="progress-veil__stage" data-state={state} key={stage.id}>
              <span aria-hidden="true" className="progress-veil__stage-marker" />
              <span className="progress-veil__stage-label">{stage.label}</span>
            </li>
          );
        })}
      </ol>

      {/* Authoritative, announced status. Names the real stage; no fake %. */}
      <p className="progress-veil__status" role="status">
        {complete
          ? `${label} complete`
          : `Stage ${activeIndex + 1} of ${total}: ${current?.label ?? ""}`}
      </p>
    </section>
  );
}
