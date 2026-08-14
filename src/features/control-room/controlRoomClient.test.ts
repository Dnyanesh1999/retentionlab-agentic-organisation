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

  it("creates a hosted run through the separate run gateway and validates its event stream", async () => {
    const run = {
      contract_version: "hosted.run.v1",
      run_id: "8f14e45f-ceea-467a-9575-0e2d6b3f1a20",
      account_id: "1b4e28ba-2fa1-4d3b-9a2c-6f0d5e7c8b91",
      account_slug: "northstar-loom",
      idempotency_key: "control-northstar-loom-001",
      objective: "Investigate retention risk and prepare a governed recovery decision.",
      status: "queued",
      current_stage: null,
      public_summary: null,
      created_at: "2026-08-14T09:00:00.000Z",
      updated_at: "2026-08-14T09:00:00.000Z",
      events: [{
        type: "run_created",
        sequence: 1,
        run_id: "8f14e45f-ceea-467a-9575-0e2d6b3f1a20",
        account_id: "1b4e28ba-2fa1-4d3b-9a2c-6f0d5e7c8b91",
        account_slug: "northstar-loom",
        occurred_at: "2026-08-14T09:00:00.000Z",
      }],
    };
    const fetchMock = vi.fn(async () => Response.json({ run, idempotent_replay: false })) as unknown as typeof fetch;

    const result = await createControlRoomClient(environment, fetchMock).createRun({
      account_slug: "northstar-loom",
      objective: run.objective,
      idempotency_key: run.idempotency_key,
    });

    expect(result.run.status).toBe("queued");
    expect(result.run.events[0]?.type).toBe("run_created");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.supabase.co/functions/v1/retentionlab-runs",
      expect.objectContaining({ method: "POST", cache: "no-store" }),
    );
  });
});
