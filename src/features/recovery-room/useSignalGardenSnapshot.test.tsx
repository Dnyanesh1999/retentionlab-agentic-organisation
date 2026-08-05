import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  decodeSignalGardenSnapshot,
  type SignalGardenEvidenceClient,
  type SignalGardenSnapshot,
} from "./contracts";
import { SignalGardenClientError } from "./liveEvidenceClient";
import { useSignalGardenSnapshot } from "./useSignalGardenSnapshot";

const snapshot = decodeSignalGardenSnapshot({
  schema_version: "signal-garden-snapshot.v1",
  account_slug: "state-test",
  retrieved_at: "2026-08-05T20:00:00.000Z",
  signals: [
    {
      code: "feature_adoption",
      current_value: 11,
      previous_value: 10,
      unit: "percent",
      evidence: { evidence_key: "test:feature", source_system: "test", source_tool: "test", retrieved_at: "2026-08-05T20:00:00.000Z" },
    },
    {
      code: "active_users",
      current_value: 22,
      previous_value: 20,
      unit: "count",
      evidence: { evidence_key: "test:users", source_system: "test", source_tool: "test", retrieved_at: "2026-08-05T20:00:00.000Z" },
    },
    {
      code: "session_frequency",
      current_value: 3.3,
      previous_value: 3,
      unit: "frequency",
      evidence: { evidence_key: "test:sessions", source_system: "test", source_tool: "test", retrieved_at: "2026-08-05T20:00:00.000Z" },
    },
  ],
  seat_utilisation: {
    current_value: 55,
    unit: "percent",
    evidence: { evidence_key: "test:seats", source_system: "test", source_tool: "test", retrieved_at: "2026-08-05T20:00:00.000Z" },
  },
  support_case: {
    reference: "test:support:state:1-1",
    category: "workflow",
    severity: "medium",
    status: "open",
    sentiment_score: -0.3,
    unresolved_at: "2026-08-05T20:00:00.000Z",
    evidence: { evidence_key: "test:support:state:1-1", source_system: "test", source_tool: "test", retrieved_at: "2026-08-05T20:00:00.000Z" },
  },
  clarification_permission: {
    allow_recovery_outreach: true,
    evidence: { evidence_key: "test:preference:state", source_system: "test", source_tool: "test", retrieved_at: "2026-08-05T20:00:00.000Z" },
  },
});

function StateProbe({ client }: { client: SignalGardenEvidenceClient }) {
  const { state, retry } = useSignalGardenSnapshot(client, "state-test");
  return (
    <div>
      <output>{state.status}</output>
      {state.status === "ready" ? <span>{state.snapshot.retrieved_at}</span> : null}
      {state.status === "error" ? <span>{state.error.code}</span> : null}
      <button type="button" onClick={retry}>Retry</button>
    </div>
  );
}

describe("Signal Garden loading boundary", () => {
  it("transitions from loading to ready only after the client resolves a snapshot", async () => {
    let resolveSnapshot: ((value: SignalGardenSnapshot) => void) | undefined;
    const client: SignalGardenEvidenceClient = {
      getSnapshot: vi.fn(() => new Promise<SignalGardenSnapshot>((resolve) => {
        resolveSnapshot = resolve;
      })),
    };

    render(<StateProbe client={client} />);
    expect(screen.getByText("loading")).toBeInTheDocument();

    resolveSnapshot?.(snapshot);
    await waitFor(() => expect(screen.getByText("ready")).toBeInTheDocument());
    expect(screen.getByText(snapshot.retrieved_at)).toBeInTheDocument();
  });

  it("transitions to an explicit error and retries without a cached snapshot fallback", async () => {
    const getSnapshot = vi.fn<SignalGardenEvidenceClient["getSnapshot"]>()
      .mockRejectedValueOnce(new SignalGardenClientError("network", "offline", 503))
      .mockResolvedValueOnce(snapshot);
    const client: SignalGardenEvidenceClient = { getSnapshot };

    render(<StateProbe client={client} />);
    await waitFor(() => expect(screen.getByText("error")).toBeInTheDocument());
    expect(screen.getByText("network")).toBeInTheDocument();
    expect(screen.queryByText(snapshot.retrieved_at)).not.toBeInTheDocument();

    screen.getByRole("button", { name: "Retry" }).click();
    await waitFor(() => expect(screen.getByText("ready")).toBeInTheDocument());
    expect(getSnapshot).toHaveBeenCalledTimes(2);
  });

  it("aborts the in-flight request when the boundary unmounts", async () => {
    const signals: AbortSignal[] = [];
    const client: SignalGardenEvidenceClient = {
      getSnapshot: vi.fn((_slug: string, signal?: AbortSignal) => {
        if (signal) signals.push(signal);
        return new Promise<SignalGardenSnapshot>(() => undefined);
      }),
    };

    function UnmountProbe() {
      const [visible, setVisible] = useState(true);
      return (
        <div>
          {visible ? <StateProbe client={client} /> : null}
          <button type="button" onClick={() => setVisible(false)}>Unmount</button>
        </div>
      );
    }

    render(<UnmountProbe />);
    fireEvent.click(screen.getByRole("button", { name: "Unmount" }));
    await waitFor(() => expect(signals[0]?.aborted).toBe(true));
  });
});
