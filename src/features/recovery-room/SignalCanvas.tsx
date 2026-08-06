import { ArrowUpRight, LogOut, Sprout, UsersRound } from "lucide-react";
import { useRef, useState } from "react";

import { HashLink } from "../../components/HashLink";
import { ClarificationDialog } from "./ClarificationDialog";
import type { ClarificationClient } from "./clarificationClient";
import type { SignalGardenSnapshot, SignalReading } from "./contracts";
import { SignalStrand } from "./SignalStrand";
import { SupportCaseStrand } from "./SupportCaseStrand";
import { useClarificationFlow } from "./useClarificationFlow";

const signalOrder: readonly SignalReading["code"][] = [
  "feature_adoption",
  "active_users",
  "session_frequency",
];

const percentFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});

export type SignalCanvasProps = {
  snapshot: SignalGardenSnapshot;
  clarificationClient?: ClarificationClient | null;
  reducedMotion?: boolean;
};

export function SignalCanvas({ snapshot, clarificationClient = null, reducedMotion }: SignalCanvasProps) {
  const [expandedSignal, setExpandedSignal] = useState<SignalReading["code"] | null>(null);
  const [supportExpanded, setSupportExpanded] = useState(false);
  const clarificationTriggerRef = useRef<HTMLButtonElement>(null);
  const readingsByCode = new Map(snapshot.signals.map((reading) => [reading.code, reading]));
  const clarification = useClarificationFlow({
    accountSlug: snapshot.account_slug,
    supportEvidenceKey: snapshot.support_case.evidence.evidence_key,
    preferenceEvidenceKey: snapshot.clarification_permission.evidence.evidence_key,
    client: snapshot.clarification_permission.allow_recovery_outreach
      ? clarificationClient
      : null,
  });

  const dismissClarification = () => {
    clarification.dismiss();
    requestAnimationFrame(() => clarificationTriggerRef.current?.focus());
  };

  return (
    <section className="signal-garden" aria-labelledby="signal-garden-title">
      <header className="signal-garden__header">
        <Sprout aria-hidden="true" className="signal-garden__mark" strokeWidth={1.5} />
        <div>
          <h2 id="signal-garden-title">Your signal garden</h2>
          <p>Inspect any signal to learn more. No action required.</p>
        </div>
      </header>

      <div className="signal-canvas" aria-label="Main inspection area">
        {signalOrder.map((code) => {
          const reading = readingsByCode.get(code);

          if (!reading) return null;

          return (
            <SignalStrand
              expanded={expandedSignal === code}
              key={code}
              onExpandedChange={(expanded) => {
                if (expanded) setSupportExpanded(false);
                setExpandedSignal((current) => {
                  if (expanded) return code;
                  return current === code ? null : current;
                });
              }}
              reading={reading}
              reducedMotion={reducedMotion}
            />
          );
        })}

        <SupportCaseStrand
          expanded={supportExpanded}
          onExpandedChange={(expanded) => {
            setSupportExpanded(expanded);
            if (expanded) setExpandedSignal(null);
          }}
          reducedMotion={reducedMotion}
          supportCase={snapshot.support_case}
        />
      </div>

      {clarification.available && !clarification.shared ? (
        <div className="clarification-entry">
          <span aria-hidden="true" className="clarification-entry__stem" />
          <button
            className="clarification-entry__trigger"
            onClick={clarification.open}
            ref={clarificationTriggerRef}
            type="button"
          >
            <span>Clarify workflow friction?</span>
            <ArrowUpRight aria-hidden="true" strokeWidth={1.6} />
          </button>
        </div>
      ) : null}

      <div
        aria-label={`Seat utilisation, ${percentFormatter.format(snapshot.seat_utilisation.current_value)} percent`}
        className="seat-utilisation"
        data-evidence-key={snapshot.seat_utilisation.evidence.evidence_key}
        role="img"
      >
        <UsersRound aria-hidden="true" strokeWidth={1.5} />
        <span>Seat utilisation</span>
        <strong>{percentFormatter.format(snapshot.seat_utilisation.current_value)}%</strong>
      </div>

      <HashLink className="signal-garden__exit" to="/cases/organisation">
        <LogOut aria-hidden="true" strokeWidth={1.5} />
        <span>Exit signal garden</span>
      </HashLink>

      <ClarificationDialog
        onDismiss={dismissClarification}
        onObservationChange={clarification.setObservation}
        onShare={clarification.share}
        observation={clarification.observation}
        open={clarification.dialogOpen}
        reducedMotion={reducedMotion}
        submitError={clarification.error}
        submitting={clarification.submitting}
      />
    </section>
  );
}
