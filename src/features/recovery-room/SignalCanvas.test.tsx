import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { decodeSignalGardenSnapshot } from "./contracts";
import { SignalCanvas } from "./SignalCanvas";

const snapshot = decodeSignalGardenSnapshot({
  schema_version: "signal-garden-snapshot.v1",
  account_slug: "canvas-sentinel",
  retrieved_at: "2026-04-02T10:00:00.000Z",
  signals: [
    {
      code: "session_frequency",
      current_value: 8.75,
      previous_value: 6.5,
      unit: "frequency",
      evidence: {
        evidence_key: "sentinel:frequency:81",
        source_system: "test",
        source_tool: "test",
        retrieved_at: "2026-04-02T10:00:00.000Z",
      },
    },
    {
      code: "feature_adoption",
      current_value: 73.25,
      previous_value: 68.5,
      unit: "percent",
      evidence: {
        evidence_key: "sentinel:adoption:49",
        source_system: "test",
        source_tool: "test",
        retrieved_at: "2026-04-02T10:00:00.000Z",
      },
    },
    {
      code: "active_users",
      current_value: 9876,
      previous_value: 8765,
      unit: "count",
      evidence: {
        evidence_key: "sentinel:users:37",
        source_system: "test",
        source_tool: "test",
        retrieved_at: "2026-04-02T10:00:00.000Z",
      },
    },
  ],
  seat_utilisation: {
    current_value: 64.25,
    unit: "percent",
    evidence: {
      evidence_key: "sentinel:seats:22",
      source_system: "test",
      source_tool: "test",
      retrieved_at: "2026-04-02T10:00:00.000Z",
    },
  },
});

describe("Signal Garden canvas", () => {
  it("renders live snapshot values in the fixed garden order without customer fixtures", () => {
    const { container } = render(<SignalCanvas snapshot={snapshot} reducedMotion />);
    const controls = screen.getAllByRole("button");

    expect(controls).toHaveLength(3);
    expect(controls[0]).toHaveTextContent("Feature adoption");
    expect(controls[1]).toHaveTextContent("Active users");
    expect(controls[2]).toHaveTextContent("Session frequency");
    expect(screen.getByRole("img", { name: "Seat utilisation, 64.25 percent" })).toHaveTextContent("64.25%");
    expect(container.querySelector(".seat-utilisation")).toHaveAttribute(
      "data-evidence-key",
      "sentinel:seats:22",
    );
  });

  it("keeps only one signal expanded at a time", () => {
    render(<SignalCanvas snapshot={snapshot} />);
    const [adoption, users] = screen.getAllByRole("button");

    fireEvent.click(adoption);
    expect(adoption).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(users);
    expect(adoption).toHaveAttribute("aria-expanded", "false");
    expect(users).toHaveAttribute("aria-expanded", "true");
  });

  it("continues keyboard navigation to a persistent exit after the inspection canvas", () => {
    render(<SignalCanvas snapshot={snapshot} />);

    expect(screen.getByRole("link", { name: "Exit signal garden" })).toHaveAttribute(
      "href",
      "#/cases/organisation",
    );
  });
});
