import { describe, expect, it, vi } from "vitest";

import {
  LiveSignalGardenEvidenceClient,
  SignalGardenClientError,
} from "./liveEvidenceClient";

const retrievedAt = new Date().toISOString();

function signal(
  signalType: string,
  metricValue: number,
  unit: string,
  comparisonValue: number | null,
  suffix = "2",
) {
  return {
    evidence_key: `product:adapter-test:${signalType}:${suffix}`,
    signal_type: signalType,
    metric_value: metricValue,
    unit,
    comparison_value: comparisonValue,
    comparison_window: comparisonValue === null ? null : "previous_period",
    observed_at: suffix === "2" ? "2026-08-05T19:00:00.000Z" : "2026-08-04T19:00:00.000Z",
    source_updated_at: "2026-08-05T19:30:00.000Z",
    source_system: "adapter-test-source",
  };
}

function liveEnvelope() {
  return {
    tool: "get_account_snapshot",
    source: {
      system: "Supabase Postgres",
      dataset: "retentionlab-demo-v1",
      generation_run_id: "2e369a7d-bcb4-47c9-b675-0c9ddac32c61",
      generated_at: "2026-08-05T18:00:00.000Z",
      retrieved_at: retrievedAt,
      cache_mode: "no-store",
    },
    data: {
      account: { slug: "adapter-test", display_name: "Adapter Test" },
      product_signals: [
        signal("feature_adoption", 73.25, "percent", 61.5),
        signal("feature_adoption", 10, "percent", 9, "1"),
        signal("active_users", 42, "count", 35),
        signal("session_frequency", 4.75, "sessions_per_user", 3.25),
        signal("seat_utilisation", 68.5, "percent", null),
      ],
      billing_events: [],
      support_events: [],
      preference_profile: null,
    },
  };
}

function client(fetchImplementation: typeof fetch, timeoutMs = 1_000) {
  return new LiveSignalGardenEvidenceClient(
    {
      gatewayUrl: "https://example.supabase.co/functions/v1/retentionlab-evidence",
      publishableKey: "sb_publishable_adapter_test_key",
      timeoutMs,
    },
    fetchImplementation,
  );
}

describe("Live Signal Garden evidence client", () => {
  it("normalizes only decoded live rows and preserves their evidence lineage", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json(liveEnvelope()),
    );

    const snapshot = await client(fetchImplementation).getSnapshot("adapter-test");

    expect(snapshot.signals.map(({ current_value }) => current_value)).toEqual([73.25, 42, 4.75]);
    expect(snapshot.seat_utilisation.current_value).toBe(68.5);
    expect(snapshot.signals[0]!.evidence).toEqual({
      evidence_key: "product:adapter-test:feature_adoption:2",
      source_system: "adapter-test-source",
      source_tool: "get_account_snapshot",
      retrieved_at: retrievedAt,
    });

    const [, request] = fetchImplementation.mock.calls[0]!;
    expect(fetchImplementation.mock.contexts[0]).toBe(globalThis);
    expect(request).toMatchObject({ method: "POST", cache: "no-store" });
    expect(request?.headers).toMatchObject({
      apikey: "sb_publishable_adapter_test_key",
      "content-type": "application/json",
    });
    expect(JSON.parse(String(request?.body))).toEqual({
      tool: "get_account_snapshot",
      arguments: { account_slug: "adapter-test" },
    });
  });

  it("fails closed when required evidence is absent instead of substituting a design value", async () => {
    const envelope = liveEnvelope();
    envelope.data.product_signals = envelope.data.product_signals.filter(
      ({ signal_type }) => signal_type !== "seat_utilisation",
    );
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(Response.json(envelope));

    await expect(client(fetchImplementation).getSnapshot("adapter-test")).rejects.toMatchObject({
      code: "incomplete_evidence",
    });
  });

  it("classifies gateway errors without attaching structured evidence", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ error: "Unauthorized evidence gateway caller" }, { status: 401 }),
    );

    await expect(client(fetchImplementation).getSnapshot("adapter-test")).rejects.toEqual(
      expect.objectContaining<Partial<SignalGardenClientError>>({
        code: "unauthorized",
        status: 401,
      }),
    );
  });

  it("rejects a replayed response outside the configured freshness window", async () => {
    const envelope = liveEnvelope();
    envelope.source.retrieved_at = "2020-01-01T00:00:00.000Z";
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(Response.json(envelope));

    await expect(client(fetchImplementation).getSnapshot("adapter-test")).rejects.toMatchObject({
      code: "stale_evidence",
    });
  });

  it("distinguishes caller cancellation from a bounded timeout", async () => {
    const abortingFetch = vi.fn<typeof fetch>((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));

    await expect(client(abortingFetch, 5).getSnapshot("adapter-test")).rejects.toMatchObject({
      code: "timeout",
    });

    const controller = new AbortController();
    const request = client(abortingFetch).getSnapshot("adapter-test", controller.signal);
    controller.abort();
    await expect(request).rejects.toMatchObject({ code: "aborted" });
  });
});
