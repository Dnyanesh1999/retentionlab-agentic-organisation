import { LogOut, Sprout, UsersRound } from "lucide-react";
import { useState } from "react";

import { HashLink } from "../../components/HashLink";
import type { SignalGardenSnapshot, SignalReading } from "./contracts";
import { SignalStrand } from "./SignalStrand";

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
  reducedMotion?: boolean;
};

export function SignalCanvas({ snapshot, reducedMotion }: SignalCanvasProps) {
  const [expandedSignal, setExpandedSignal] = useState<SignalReading["code"] | null>(null);
  const readingsByCode = new Map(snapshot.signals.map((reading) => [reading.code, reading]));

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
      </div>

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
    </section>
  );
}
