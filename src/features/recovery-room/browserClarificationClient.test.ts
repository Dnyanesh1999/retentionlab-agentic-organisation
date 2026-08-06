import { describe, expect, it, vi } from "vitest";

import { createBrowserClarificationClient } from "./browserClarificationClient";

describe("browser clarification client", () => {
  it("constructs the bounded clarification endpoint without exposing a secret key", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      schema_version: "clarification-receipt.v1",
      submission_id: "7406f0f5-99a7-4168-bc1f-6209869a1a29",
      accepted_at: "2026-08-06T08:00:00.000Z",
      replayed: false,
    }));
    const client = createBrowserClarificationClient(
      "opaque.recovery-capability_token-1234567890",
      {
        VITE_SUPABASE_URL: "https://example.supabase.co/",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_browser_test_key",
      },
      fetchImplementation,
    );

    await client.share({
      schema_version: "clarification-submission.v1",
      account_slug: "adapter-test",
      support_evidence_key: "support:adapter-test:2-1",
      preference_evidence_key: "preference:adapter-test:2",
      observation: null,
      consent: { action: "share_observation", copy_version: "clarification-consent.v1" },
    }, "5f191612-74a5-46a7-af87-bffebd6c5ea8");

    expect(fetchImplementation).toHaveBeenCalledWith(
      "https://example.supabase.co/functions/v1/retentionlab-clarification",
      expect.any(Object),
    );
  });

  it("rejects secret keys, invalid function names and missing capabilities before a request", () => {
    expect(() => createBrowserClarificationClient("short", {
      VITE_SUPABASE_URL: "https://example.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_secret_forbidden",
    })).toThrow();

    expect(() => createBrowserClarificationClient(
      "opaque.recovery-capability_token-1234567890",
      {
        VITE_SUPABASE_URL: "https://example.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_browser_test_key",
        VITE_SUPABASE_CLARIFICATION_FUNCTION: "../unsafe",
      },
    )).toThrow();
  });
});
