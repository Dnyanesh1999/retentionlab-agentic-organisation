import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SignalSummary } from "./SignalSummary";
import type { SignalGardenSnapshot } from "./contracts";

/**
 * The summary exists to tell a first-time reader what the page holds. The property that matters is
 * that it can never disagree with the strands below it, because every figure is counted from the same
 * snapshot rather than supplied separately — so these tests drive the snapshot, not the component.
 */

function evidence(key: string) {
  return {
    evidence_key: key,
    source_system: "test-system",
    source_tool: "test-tool",
    retrieved_at: "2026-08-10T09:00:00.000Z",
  };
}

function makeSnapshot(overrides: Partial<SignalGardenSnapshot> = {}): SignalGardenSnapshot {
  return {
    schema_version: "signal-garden-snapshot.v1",
    account_slug: "copper-finch",
    retrieved_at: "2026-08-10T09:00:00.000Z",
    signals: [
      { code: "feature_adoption", current_value: 29, previous_value: 41, unit: "percent", evidence: evidence("a") },
      { code: "active_users", current_value: 120, previous_value: 141, unit: "count", evidence: evidence("b") },
      { code: "session_frequency", current_value: 4.85, previous_value: 3.77, unit: "frequency", evidence: evidence("c") },
    ],
    seat_utilisation: { current_value: 75.95, unit: "percent", evidence: evidence("d") },
    support_case: {
      reference: "e",
      category: "workflow",
      severity: "medium",
      status: "open",
      sentiment_score: -0.2,
      unresolved_at: "2026-08-01T09:00:00.000Z",
      evidence: evidence("e"),
    },
    clarification_permission: { allow_recovery_outreach: true, evidence: evidence("f") },
    ...overrides,
  } as SignalGardenSnapshot;
}

function tile(label: string) {
  return screen.getByText(label).closest("li") as HTMLElement;
}

describe("SignalSummary", () => {
  it("counts directions from the snapshot rather than being told them", () => {
    render(<SignalSummary snapshot={makeSnapshot()} now={Date.parse("2026-08-10T09:00:00.000Z")} />);

    const signals = tile("Aggregate signals");
    expect(within(signals).getByText("3")).toBeInTheDocument();
    expect(within(signals).getByText("2 lower · 1 higher")).toBeInTheDocument();
  });

  it("reports unchanged signals rather than omitting them", () => {
    const snapshot = makeSnapshot();
    snapshot.signals[2] = { ...snapshot.signals[2], current_value: 3.77, previous_value: 3.77 };

    render(<SignalSummary snapshot={snapshot} now={Date.parse("2026-08-10T09:00:00.000Z")} />);

    expect(within(tile("Aggregate signals")).getByText("2 lower · 1 unchanged")).toBeInTheDocument();
  });

  it("counts distinct evidence keys, so a shared source is not double counted", () => {
    const snapshot = makeSnapshot();
    // Two signals citing one source is six references but five distinct keys.
    snapshot.signals[1] = { ...snapshot.signals[1], evidence: evidence("a") };

    render(<SignalSummary snapshot={snapshot} now={Date.parse("2026-08-10T09:00:00.000Z")} />);

    expect(within(tile("Cited evidence")).getByText("5")).toBeInTheDocument();
  });

  it("ages the snapshot against the supplied clock", () => {
    render(<SignalSummary snapshot={makeSnapshot()} now={Date.parse("2026-08-13T09:00:00.000Z")} />);

    expect(within(tile("Snapshot age")).getByText("3d")).toBeInTheDocument();
  });

  it("never shows a negative age when the snapshot is newer than the clock", () => {
    render(<SignalSummary snapshot={makeSnapshot()} now={Date.parse("2026-08-09T09:00:00.000Z")} />);

    expect(within(tile("Snapshot age")).getByText("Today")).toBeInTheDocument();
  });

  it("describes the open case from its own sealed fields", () => {
    render(<SignalSummary snapshot={makeSnapshot()} now={Date.parse("2026-08-10T09:00:00.000Z")} />);

    expect(within(tile("Open support case")).getByText("medium severity · workflow")).toBeInTheDocument();
  });

  it("is a list, not a description list — a dl may only hold dt/dd groups", () => {
    render(<SignalSummary snapshot={makeSnapshot()} now={Date.parse("2026-08-10T09:00:00.000Z")} />);

    const list = screen.getByRole("list", { name: "What this snapshot contains" });
    expect(list.tagName).toBe("UL");
    expect(within(list).getAllByRole("listitem")).toHaveLength(4);
  });
});
