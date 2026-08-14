import { createControlRoomClient } from "./controlRoomClient";

const environment = {
  VITE_SUPABASE_URL: "https://example.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abcdefghijklmnopqrstuvwxyz",
};

const source = {
  system: "Supabase Postgres",
  dataset: "retentionlab-demo-v1",
  generation_run_id: "00000000-0000-4000-8000-000000000001",
  generated_at: "2026-08-14T00:00:00.000Z",
  retrieved_at: "2026-08-14T00:01:00.000Z",
  cache_mode: "no-store",
};

describe("control room client", () => {
  it("requests the strict live account directory without browser caching", async () => {
    const fetchMock = vi.fn(async () => Response.json({
      tool: "list_accounts",
      source,
      data: [{
        slug: "northstar-loom",
        display_name: "Northstar Loom",
        sector: "Analytics",
        plan_tier: "Enterprise",
        lifecycle_stage: "renewal",
        monthly_recurring_revenue: 18000,
        contract_currency: "EUR",
        renewal_at: "2026-09-01",
        region: "EU",
        source_updated_at: "2026-08-14T00:00:00.000Z",
      }],
    })) as unknown as typeof fetch;

    const result = await createControlRoomClient(environment, fetchMock).listAccounts();

    expect(result.accounts[0]?.display_name).toBe("Northstar Loom");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.supabase.co/functions/v1/retentionlab-evidence",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        body: JSON.stringify({ tool: "list_accounts", arguments: { limit: 50 } }),
      }),
    );
  });

  it("rejects a malformed account contract", async () => {
    const fetchMock = vi.fn(async () => Response.json({ tool: "list_accounts", source, data: [{ slug: "broken" }] })) as unknown as typeof fetch;
    await expect(createControlRoomClient(environment, fetchMock).listAccounts()).rejects.toThrow(/invalid contract/i);
  });
});
