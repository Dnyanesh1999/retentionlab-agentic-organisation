import { describe, expect, it, vi } from "vitest";

import { createBrowserSignalGardenEvidenceClient } from "./browserEvidenceClient";

describe("Signal Garden browser evidence configuration", () => {
  it("constructs the exact allow-listed Edge Function URL from public Vite values", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ error: "deliberate test response" }, { status: 503 }),
    );
    const client = createBrowserSignalGardenEvidenceClient(
      {
        VITE_SUPABASE_URL: "https://project.supabase.co/",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_browser_test_key",
        VITE_SUPABASE_EVIDENCE_FUNCTION: "retentionlab-evidence",
      },
      fetchImplementation,
    );

    await expect(client.getSnapshot("browser-test")).rejects.toMatchObject({ code: "unavailable" });
    expect(fetchImplementation).toHaveBeenCalledWith(
      "https://project.supabase.co/functions/v1/retentionlab-evidence",
      expect.any(Object),
    );
  });

  it("rejects a secret/service-role value before a browser request can be made", () => {
    expect(() => createBrowserSignalGardenEvidenceClient({
      VITE_SUPABASE_URL: "https://project.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_secret_forbidden_in_browser",
    })).toThrow(/modern Supabase publishable key/);
  });
});
