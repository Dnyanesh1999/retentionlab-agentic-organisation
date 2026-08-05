import { ChevronDown, ChevronUp, FileText, LifeBuoy } from "lucide-react";
import { useId, useRef, type JSX, type KeyboardEvent } from "react";

import type { SupportCase } from "./contracts";

export type SupportCaseStrandProps = {
  supportCase: SupportCase;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  reducedMotion?: boolean;
};

/**
 * Factual, evidence-derived collapsed summary. `status` and `category` are
 * contract-pinned literals; `severity` is the one varying live value. No copy is
 * invented here — every word maps to a cited field on the support record.
 */
function summarise(supportCase: SupportCase): string {
  return `One ${supportCase.status} ${supportCase.severity}-severity ${supportCase.category} support case`;
}

/** ISO occurrence timestamp rendered as its cited calendar date (UTC). */
function unresolvedDate(unresolvedAt: string): string {
  return unresolvedAt.split("T")[0] ?? unresolvedAt;
}

export function SupportCaseStrand({
  supportCase,
  expanded,
  onExpandedChange,
  reducedMotion,
}: SupportCaseStrandProps): JSX.Element {
  const baseId = useId();
  const detailId = `${baseId}-detail`;
  const citationId = `${baseId}-citation`;
  const triggerRef = useRef<HTMLButtonElement>(null);

  const summary = summarise(supportCase);
  const isNegativeSentiment = supportCase.sentiment_score < 0;

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
    "support-case-strand",
    expanded ? "support-case-strand--expanded" : "support-case-strand--collapsed",
    reducedMotion ? "support-case-strand--reduced-motion" : null,
  ]
    .filter(Boolean)
    .join(" ");

  const DisclosureIcon = expanded ? ChevronUp : ChevronDown;

  return (
    <div
      className={rootClassName}
      data-severity={supportCase.severity}
      data-reduced-motion={String(Boolean(reducedMotion))}
    >
      <button
        ref={triggerRef}
        type="button"
        className="support-case-strand__trigger"
        aria-expanded={expanded}
        aria-controls={detailId}
        aria-describedby={expanded ? citationId : undefined}
        onClick={handleActivate}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
      >
        <span className="support-case-strand__icon" aria-hidden="true">
          <LifeBuoy strokeWidth={1.5} />
        </span>
        <span className="support-case-strand__summary">{summary}</span>
        <DisclosureIcon
          aria-hidden="true"
          className="support-case-strand__disclosure"
          strokeWidth={1.6}
        />
      </button>
      {expanded ? (
        <div id={detailId} className="support-case-strand__detail">
          <p className="support-case-strand__reference">
            <span className="support-case-strand__detail-label">Case reference:</span>{" "}
            <span className="support-case-strand__reference-key">{supportCase.reference}</span>
          </p>
          <p className="support-case-strand__sentiment">
            <span className="support-case-strand__detail-label">Sentiment:</span>{" "}
            <span className="support-case-strand__sentiment-value">
              {supportCase.sentiment_score}
            </span>
            {isNegativeSentiment ? (
              <span className="support-case-strand__sentiment-label"> (negative)</span>
            ) : null}
          </p>
          <p className="support-case-strand__unresolved">
            Unresolved as of {unresolvedDate(supportCase.unresolved_at)}
          </p>
          <p id={citationId} className="support-case-strand__citation">
            <FileText aria-hidden="true" strokeWidth={1.6} />
            <span>
              <span className="support-case-strand__citation-label">Evidence:</span>{" "}
              <span className="support-case-strand__citation-key">
                {supportCase.evidence.evidence_key}
              </span>
            </span>
          </p>
        </div>
      ) : null}
    </div>
  );
}
