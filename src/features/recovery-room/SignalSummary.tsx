import { Clock3, FileText, FolderOpen, TrendingDown } from "lucide-react";
import { useState } from "react";

import type { SignalGardenSnapshot } from "./contracts";

/**
 * A four-tile reading of the snapshot, so a first-time visitor can see what this page holds before
 * they open anything.
 *
 * Every figure here is counted or divided from the sealed snapshot — never fetched separately, never
 * estimated, and never a value the strands below do not also show. The direction counts come from the
 * same comparison the strands make, so the two can never disagree.
 *
 * The copy stays inside the Maker's contract: aggregate, non-causal, and free of urgency. It reports
 * that a signal moved; it never says the movement is bad, nor why it happened.
 */

function daysSince(iso: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 86_400_000));
}

export type SignalSummaryProps = {
  snapshot: SignalGardenSnapshot;
  /** Injectable clock so the age tile is testable without faking timers. */
  now?: number;
};

export function SignalSummary({ snapshot, now: providedNow }: SignalSummaryProps) {
  // Read once at mount rather than on every render. `Date.now()` during render is impure — the same
  // component could report two different ages for one snapshot — and the tile's own caption says
  // "read when this page opened", so a value fixed at mount is also the truthful one.
  const [mountedAt] = useState(() => Date.now());
  const now = providedNow ?? mountedAt;

  const decreased = snapshot.signals.filter((s) => s.current_value < s.previous_value).length;
  const increased = snapshot.signals.filter((s) => s.current_value > s.previous_value).length;
  const unchanged = snapshot.signals.length - decreased - increased;

  // Read as a sentence rather than three chips, so the tile stays quiet when nothing moved.
  const movement = [
    decreased ? `${decreased} lower` : null,
    increased ? `${increased} higher` : null,
    unchanged ? `${unchanged} unchanged` : null,
  ].filter(Boolean).join(" · ");

  // Distinct keys, so a figure reusing another's source is not counted twice.
  const evidenceKeys = new Set([
    ...snapshot.signals.map((s) => s.evidence.evidence_key),
    snapshot.seat_utilisation.evidence.evidence_key,
    snapshot.support_case.evidence.evidence_key,
    snapshot.clarification_permission.evidence.evidence_key,
  ]).size;

  const age = daysSince(snapshot.retrieved_at, now);
  const tiles = [
    {
      key: "signals",
      icon: TrendingDown,
      label: "Aggregate signals",
      value: String(snapshot.signals.length),
      detail: movement,
    },
    {
      // Deliberately not seat utilisation: that figure has its own evidence-bound row further down,
      // and showing it twice would let the two drift. Traceability is the more useful thing to state
      // up front on a page whose whole claim is that every figure can be traced.
      key: "evidence",
      icon: FileText,
      label: "Cited evidence",
      value: String(evidenceKeys),
      detail: "keys behind these figures",
    },
    {
      key: "case",
      icon: FolderOpen,
      label: "Open support case",
      value: "1",
      detail: `${snapshot.support_case.severity} severity · ${snapshot.support_case.category}`,
    },
    {
      key: "freshness",
      icon: Clock3,
      label: "Snapshot age",
      value: age === 0 ? "Today" : `${age}d`,
      detail: "read when this page opened",
    },
  ];

  // A list rather than a description list: each tile carries an icon and a caption alongside its
  // term and value, and a <dl> may only contain dt/dd groups. axe's definition-list rule catches
  // exactly that, and it caught this.
  return (
    <ul aria-label="What this snapshot contains" className="signal-summary">
      {tiles.map(({ key, icon: Icon, label, value, detail }) => (
        <li className="signal-summary__tile" key={key}>
          <Icon aria-hidden="true" strokeWidth={1.5} />
          <span className="signal-summary__label">{label}</span>
          <strong className="signal-summary__value">{value}</strong>
          <span className="signal-summary__detail">{detail}</span>
        </li>
      ))}
    </ul>
  );
}
