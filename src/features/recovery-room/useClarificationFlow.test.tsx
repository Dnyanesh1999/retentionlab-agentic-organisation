import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ClarificationClient } from "./clarificationClient";
import { useClarificationFlow } from "./useClarificationFlow";

const receipt = {
  schema_version: "clarification-receipt.v1" as const,
  submission_id: "7406f0f5-99a7-4168-bc1f-6209869a1a29",
  accepted_at: "2026-08-06T08:00:00.000Z",
  replayed: false,
};

function setup(client: ClarificationClient | null) {
  return renderHook(() => useClarificationFlow({
    accountSlug: "adapter-test",
    supportEvidenceKey: "support:adapter-test:2-1",
    preferenceEvidenceKey: "preference:adapter-test:2",
    client,
    createRequestId: () => "5f191612-74a5-46a7-af87-bffebd6c5ea8",
  }));
}

describe("useClarificationFlow", () => {
  it("does not open or call a client when no recovery capability exists", () => {
    const { result } = setup(null);

    act(() => result.current.open());

    expect(result.current.available).toBe(false);
    expect(result.current.dialogOpen).toBe(false);
  });

  it("keeps opening, typing and declining entirely ephemeral", () => {
    const client = { share: vi.fn<ClarificationClient["share"]>() };
    const { result } = setup(client);

    act(() => result.current.open());
    act(() => result.current.setObservation("The export step feels stuck."));
    act(() => result.current.dismiss());

    expect(client.share).not.toHaveBeenCalled();
    expect(result.current.dialogOpen).toBe(false);
    expect(result.current.observation).toBe("");
  });

  it("submits exactly once on explicit Share and records the strict receipt", async () => {
    let resolveShare: ((value: typeof receipt) => void) | undefined;
    const client = {
      share: vi.fn<ClarificationClient["share"]>(() => new Promise((resolve) => {
        resolveShare = resolve;
      })),
    };
    const { result } = setup(client);

    act(() => result.current.open());
    act(() => result.current.setObservation("  The export step feels stuck.  "));
    await act(async () => {
      const first = result.current.share();
      const second = result.current.share();
      resolveShare?.(receipt);
      await Promise.all([first, second]);
    });

    expect(client.share).toHaveBeenCalledTimes(1);
    expect(client.share).toHaveBeenCalledWith(
      expect.objectContaining({
        observation: "The export step feels stuck.",
        consent: { action: "share_observation", copy_version: "clarification-consent.v1" },
      }),
      "5f191612-74a5-46a7-af87-bffebd6c5ea8",
      expect.any(AbortSignal),
    );
    expect(result.current.shared).toBe(true);
    expect(result.current.receipt).toEqual(receipt);
  });

  it("retains the draft and idempotency key after an ambiguous failure", async () => {
    const client = {
      share: vi.fn<ClarificationClient["share"]>()
        .mockRejectedValueOnce(new Error("network"))
        .mockResolvedValueOnce(receipt),
    };
    const { result } = setup(client);

    act(() => result.current.open());
    act(() => result.current.setObservation("The export step feels stuck."));
    await act(() => result.current.share());

    expect(result.current.observation).toBe("The export step feels stuck.");
    expect(result.current.error).toBe("Observation not shared. Your text is still here.");

    await act(() => result.current.share());
    expect(client.share.mock.calls[0]?.[1]).toBe(client.share.mock.calls[1]?.[1]);
    expect(result.current.shared).toBe(true);
  });
});
