import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ClarificationClient } from "./clarificationClient";
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
  support_case: {
    reference: "sentinel:support:canvas:6-2",
    category: "workflow",
    severity: "medium",
    status: "open",
    sentiment_score: -0.19,
    unresolved_at: "2026-04-02T10:00:00.000Z",
    evidence: {
      evidence_key: "sentinel:support:canvas:6-2",
      source_system: "test",
      source_tool: "test",
      retrieved_at: "2026-04-02T10:00:00.000Z",
    },
  },
  clarification_permission: {
    allow_recovery_outreach: true,
    evidence: {
      evidence_key: "sentinel:preference:canvas",
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

    expect(controls).toHaveLength(4);
    expect(controls[0]).toHaveTextContent("Feature adoption");
    expect(controls[1]).toHaveTextContent("Active users");
    expect(controls[2]).toHaveTextContent("Session frequency");
    expect(controls[3]).toHaveTextContent("One open medium-severity workflow support case");
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

  it("reveals cited support facts without inventing a summary or cause", () => {
    render(<SignalCanvas snapshot={snapshot} />);

    fireEvent.click(screen.getByRole("button", {
      name: /One open medium-severity workflow support case/,
    }));

    expect(screen.getAllByText("sentinel:support:canvas:6-2")).toHaveLength(2);
    expect(screen.getByText("-0.19")).toBeInTheDocument();
    expect(screen.getByText("Unresolved as of 2026-04-02")).toBeInTheDocument();
    expect(screen.queryByText(/root cause/i)).not.toBeInTheDocument();
  });

  it("keeps Not now side-effect free and allows an empty optional observation", async () => {
    const user = userEvent.setup();
    const share = vi.fn<ClarificationClient["share"]>().mockResolvedValue({
      schema_version: "clarification-receipt.v1",
      submission_id: "b31dcfbb-4c39-4abc-8c47-cde7f986669b",
      accepted_at: "2026-04-02T10:02:00.000Z",
      replayed: false,
    });

    render(<SignalCanvas snapshot={snapshot} clarificationClient={{ share }} />);
    await user.click(screen.getByRole("button", { name: "Clarify workflow friction?" }));
    await user.click(screen.getByRole("button", { name: "Not now" }));
    expect(share).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Clarify workflow friction?" }));
    await user.click(screen.getByRole("button", { name: "Share observation" }));

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(share.mock.calls[0]?.[0]).toMatchObject({
      account_slug: "canvas-sentinel",
      support_evidence_key: "sentinel:support:canvas:6-2",
      preference_evidence_key: "sentinel:preference:canvas",
      observation: null,
    });
  });

  it("does not offer clarification without both live permission and a capability client", () => {
    const deniedSnapshot = decodeSignalGardenSnapshot({
      ...snapshot,
      clarification_permission: {
        ...snapshot.clarification_permission,
        allow_recovery_outreach: false,
      },
    });

    const { rerender } = render(<SignalCanvas snapshot={snapshot} />);
    expect(screen.queryByRole("button", { name: "Clarify workflow friction?" })).not.toBeInTheDocument();

    rerender(<SignalCanvas snapshot={deniedSnapshot} clarificationClient={{ share: vi.fn() }} />);
    expect(screen.queryByRole("button", { name: "Clarify workflow friction?" })).not.toBeInTheDocument();
  });
});
