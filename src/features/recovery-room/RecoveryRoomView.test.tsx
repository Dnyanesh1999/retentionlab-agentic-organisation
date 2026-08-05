import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  decodeSignalGardenSnapshot,
  type SignalGardenEvidenceClient,
} from "./contracts";
import { SignalGardenClientError } from "./liveEvidenceClient";
import { RecoveryRoomView } from "./RecoveryRoomView";

const snapshot = decodeSignalGardenSnapshot({
  schema_version: "signal-garden-snapshot.v1",
  account_slug: "route-sentinel",
  retrieved_at: "2026-06-14T08:00:00.000Z",
  signals: [
    {
      code: "feature_adoption",
      current_value: 72.75,
      previous_value: 70.25,
      unit: "percent",
      evidence: {
        evidence_key: "route:adoption:14",
        source_system: "test",
        source_tool: "test",
        retrieved_at: "2026-06-14T08:00:00.000Z",
      },
    },
    {
      code: "active_users",
      current_value: 4321,
      previous_value: 4098,
      unit: "count",
      evidence: {
        evidence_key: "route:users:27",
        source_system: "test",
        source_tool: "test",
        retrieved_at: "2026-06-14T08:00:00.000Z",
      },
    },
    {
      code: "session_frequency",
      current_value: 9.25,
      previous_value: 8.5,
      unit: "frequency",
      evidence: {
        evidence_key: "route:frequency:39",
        source_system: "test",
        source_tool: "test",
        retrieved_at: "2026-06-14T08:00:00.000Z",
      },
    },
  ],
  seat_utilisation: {
    current_value: 61.5,
    unit: "percent",
    evidence: {
      evidence_key: "route:seats:48",
      source_system: "test",
      source_tool: "test",
      retrieved_at: "2026-06-14T08:00:00.000Z",
    },
  },
  support_case: {
    reference: "route:support:7-1",
    category: "workflow",
    severity: "medium",
    status: "open",
    sentiment_score: -0.22,
    unresolved_at: "2026-06-14T08:00:00.000Z",
    evidence: {
      evidence_key: "route:support:7-1",
      source_system: "test",
      source_tool: "test",
      retrieved_at: "2026-06-14T08:00:00.000Z",
    },
  },
  clarification_permission: {
    allow_recovery_outreach: true,
    evidence: {
      evidence_key: "route:preference:2",
      source_system: "test",
      source_tool: "test",
      retrieved_at: "2026-06-14T08:00:00.000Z",
    },
  },
});

describe("Recovery Room live boundary", () => {
  it("shows no evidence until the live snapshot resolves", async () => {
    let resolveSnapshot: ((value: typeof snapshot) => void) | undefined;
    const client: SignalGardenEvidenceClient = {
      getSnapshot: vi.fn(() => new Promise<typeof snapshot>((resolve) => {
        resolveSnapshot = resolve;
      })),
    };

    render(<RecoveryRoomView accountSlug="route-sentinel" client={client} reducedMotion />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading...");
    expect(screen.queryByText("72.75%")).not.toBeInTheDocument();

    resolveSnapshot?.(snapshot);
    expect(await screen.findByRole("heading", { name: "Your signal garden" })).toBeInTheDocument();
    expect(screen.getByText("72.75%")).toBeInTheDocument();
  });

  it("fails closed and retries without rendering fallback evidence", async () => {
    const client: SignalGardenEvidenceClient = {
      getSnapshot: vi.fn()
        .mockRejectedValueOnce(new SignalGardenClientError("network", "offline", 503))
        .mockResolvedValueOnce(snapshot),
    };

    render(<RecoveryRoomView accountSlug="route-sentinel" client={client} />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No fallback values were shown.");
    expect(alert).toHaveAttribute("data-error-code", "network");
    expect(screen.queryByText("72.75%")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.getByText("72.75%")).toBeInTheDocument());
    expect(client.getSnapshot).toHaveBeenCalledTimes(2);
  });
});
