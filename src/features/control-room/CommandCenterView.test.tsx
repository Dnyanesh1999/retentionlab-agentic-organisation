import { fireEvent, render, screen } from "@testing-library/react";

import type { ControlRoomClient } from "./controlRoomClient";
import { CommandCenterView } from "./CommandCenterView";

const source = {
  system: "Supabase Postgres" as const,
  dataset: "retentionlab-demo-v1" as const,
  generation_run_id: "00000000-0000-4000-8000-000000000001",
  generated_at: "2026-08-14T00:00:00.000Z",
  retrieved_at: new Date().toISOString(),
  cache_mode: "no-store" as const,
};

const client: ControlRoomClient = {
  async listAccounts() {
    return {
      source,
      accounts: [{
        slug: "northstar-loom",
        display_name: "Northstar Loom",
        sector: "Analytics",
        plan_tier: "Enterprise",
        lifecycle_stage: "renewal",
        monthly_recurring_revenue: 18000,
        contract_currency: "EUR",
        renewal_at: "2026-09-01",
        region: "EU",
        source_updated_at: new Date().toISOString(),
      }],
    };
  },
  async probeAccount() {
    return { source, evidenceCount: 18, approvalBoundaryPresent: true };
  },
};

describe("CommandCenterView", () => {
  it("renders the live account directory and verifies a governed launch preview", async () => {
    render(<CommandCenterView client={client} />);

    expect(await screen.findByRole("heading", { name: /protect revenue/i })).toBeInTheDocument();
    expect((await screen.findAllByText("Northstar Loom")).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/1 live record/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /start governed case/i }));

    expect(await screen.findByRole("dialog", { name: "Northstar Loom" })).toBeInTheDocument();
    expect(await screen.findByText("Evidence bound")).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
    expect(screen.getByText("Human boundary intact")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /runtime connection is the next slice/i })).toBeDisabled();
  });

  it("fails closed when the live directory is unavailable", async () => {
    const failingClient: ControlRoomClient = {
      ...client,
      async listAccounts() { throw new Error("Gateway unavailable"); },
    };
    render(<CommandCenterView client={failingClient} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Live directory unavailable");
    expect(screen.queryByText("Northstar Loom")).not.toBeInTheDocument();
  });
});
