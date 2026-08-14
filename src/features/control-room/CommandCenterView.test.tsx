import { fireEvent, render, screen } from "@testing-library/react";

import type { ControlRoomClient } from "./controlRoomClient";
import { CommandCenterView } from "./CommandCenterView";
import type { HostedRun } from "../../../runtime/hosted/contracts";

const source = {
  system: "Supabase Postgres" as const,
  dataset: "retentionlab-demo-v1" as const,
  generation_run_id: "00000000-0000-4000-8000-000000000001",
  generated_at: "2026-08-14T00:00:00.000Z",
  retrieved_at: new Date().toISOString(),
  cache_mode: "no-store" as const,
};

const hostedRun: HostedRun = {
  contract_version: "hosted.run.v1",
  run_id: "8f14e45f-ceea-467a-9575-0e2d6b3f1a20",
  account_id: "1b4e28ba-2fa1-4d3b-9a2c-6f0d5e7c8b91",
  account_slug: "northstar-loom",
  idempotency_key: "control-northstar-loom-001",
  objective: "Investigate retention risk for Northstar Loom and prepare a governed recovery decision.",
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
  async createRun() {
    return { run: hostedRun, idempotentReplay: false };
  },
  async readRun() {
    return hostedRun;
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
    fireEvent.click(screen.getByRole("button", { name: /create hosted run/i }));

    expect(await screen.findByText("Queued for hosted worker")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /agent execution trace/i })).toBeInTheDocument();
    expect(screen.getByText("Awaiting hosted worker")).toBeInTheDocument();
    expect(screen.getByText(/governed run accepted/i)).toBeInTheDocument();
    expect(screen.getByText(/external actions: 0/i)).toBeInTheDocument();
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
