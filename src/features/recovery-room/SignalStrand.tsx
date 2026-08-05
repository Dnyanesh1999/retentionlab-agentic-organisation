import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Clock3,
  FileText,
  Info,
  Minus,
  TrendingUp,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { useId, useRef, type JSX, type KeyboardEvent } from "react";

import type { SignalReading } from "./contracts";

export type SignalStrandProps = {
  reading: SignalReading;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  reducedMotion?: boolean;
};

/**
 * Fixed, non-evidence display labels. These are presentation copy keyed only by
 * the signal `code` union; they never carry cited business values.
 */
const METRIC_LABELS: Record<SignalReading["code"], string> = {
  feature_adoption: "Feature adoption",
  active_users: "Active users",
  session_frequency: "Session frequency",
};

const METRIC_ICONS: Record<SignalReading["code"], LucideIcon> = {
  feature_adoption: TrendingUp,
  active_users: UsersRound,
  session_frequency: Clock3,
};

/** The exact approved explanatory sentence, revealed only while expanded. */
const EXPLANATION =
  "This shows change over the last 30 days. Values come from your account snapshot.";

function formatSignalValue(unit: SignalReading["unit"], value: number): string {
  switch (unit) {
    case "percent":
      return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
    case "count":
      // Locale-safe whole number: thousands grouping, no fractional part.
      return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
    case "frequency":
      return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} sessions/user`;
  }
}

/**
 * Purely directional description of the change between previous and current.
 * This is a factual direction, not a causal or positive/negative judgment.
 */
function describeDirection(
  previous: number,
  current: number,
): { key: "increased" | "decreased" | "unchanged"; icon: LucideIcon; label: string } {
  if (current > previous) {
    return { key: "increased", icon: ArrowUp, label: "Increased" };
  }
  if (current < previous) {
    return { key: "decreased", icon: ArrowDown, label: "Decreased" };
  }
  return { key: "unchanged", icon: Minus, label: "No change" };
}

export function SignalStrand({
  reading,
  expanded,
  onExpandedChange,
  reducedMotion,
}: SignalStrandProps): JSX.Element {
  const baseId = useId();
  const detailId = `${baseId}-detail`;
  const citationId = `${baseId}-citation`;
  const triggerRef = useRef<HTMLButtonElement>(null);

  const label = METRIC_LABELS[reading.code];
  const previousText = formatSignalValue(reading.unit, reading.previous_value);
  const currentText = formatSignalValue(reading.unit, reading.current_value);
  const direction = describeDirection(reading.previous_value, reading.current_value);
  const MetricIcon = METRIC_ICONS[reading.code];
  const DirectionIcon = direction.icon;
  const DisclosureIcon = expanded ? ChevronUp : ChevronDown;
  const graphicLabel = `${label}: previous ${previousText}, current ${currentText}`;

  // Controlled requests only. Never call the callback when we are already in the
  // requested state, so focus + click cannot double-invoke onExpandedChange.
  const requestExpanded = (next: boolean) => {
    if (next !== expanded) {
      onExpandedChange(next);
    }
  };

  const handleActivate = () => requestExpanded(true);
  const handleFocus = () => requestExpanded(true);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Escape" && expanded) {
      event.stopPropagation();
      requestExpanded(false);
      // Keep/return focus on the trigger after a collapse request.
      triggerRef.current?.focus();
    }
  };

  const rootClassName = [
    "signal-strand",
    expanded ? "signal-strand--expanded" : "signal-strand--collapsed",
    reducedMotion ? "signal-strand--reduced-motion" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={rootClassName}
      data-direction={direction.key}
      data-metric={reading.code}
      data-reduced-motion={String(Boolean(reducedMotion))}
    >
      <button
        ref={triggerRef}
        type="button"
        className="signal-strand__trigger"
        aria-expanded={expanded}
        aria-controls={detailId}
        aria-describedby={expanded ? citationId : undefined}
        onClick={handleActivate}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
      >
        <span className="signal-strand__graphic" role="img" aria-label={graphicLabel}>
          <span className="signal-strand__icon" aria-hidden="true">
            <MetricIcon strokeWidth={1.5} />
          </span>
          <span className="signal-strand__label" aria-hidden="true">
            {label}
          </span>
          <span
            className="signal-strand__value signal-strand__value--previous"
            aria-hidden="true"
          >
            <span className="signal-strand__value-number">{previousText}</span>
            <span className="signal-strand__value-caption">previous</span>
          </span>
          <span className="signal-strand__arrow" aria-hidden="true">
            <ArrowRight strokeWidth={1.4} />
          </span>
          <span
            className="signal-strand__value signal-strand__value--current"
            aria-hidden="true"
          >
            <span className="signal-strand__value-number">{currentText}</span>
            <span className="signal-strand__value-caption">current</span>
          </span>
          <span className="signal-strand__direction" aria-hidden="true">
            <DirectionIcon strokeWidth={1.5} />
            <span>{direction.label}</span>
          </span>
          <DisclosureIcon aria-hidden="true" className="signal-strand__disclosure" strokeWidth={1.6} />
        </span>
      </button>
      {expanded ? (
        <div id={detailId} className="signal-strand__detail">
          <p className="signal-strand__explanation">
            <Info aria-hidden="true" strokeWidth={1.6} />
            <span>{EXPLANATION}</span>
          </p>
          <p id={citationId} className="signal-strand__citation">
            <FileText aria-hidden="true" strokeWidth={1.6} />
            <span>
              <span className="signal-strand__citation-label">Evidence:</span>{" "}
              <span className="signal-strand__citation-key">{reading.evidence.evidence_key}</span>
            </span>
          </p>
        </div>
      ) : null}
    </div>
  );
}
