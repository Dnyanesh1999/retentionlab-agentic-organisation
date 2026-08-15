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

const operator = { userId: "1b4e28ba-2fa1-4d3b-9a2c-6f0d5e7c8b91", email: "operator@example.test" };

const decisionContext = {
  run_id: "8f14e45f-ceea-467a-9575-0e2d6b3f1a20",
  manager_artifact_sha256: "3f2b1c8e9d4a7605f1e2c3b4a5968778899aabbccddeeff00112233445566778",
  chain_verified: true,
  human_approval_required: true as const,
  autonomous_external_actions: false as const,
  external_actions_permitted: 0 as const,
  permitted_next_action: "await_human_approval",
  consented_channel: "in_app",
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
  async retryRun() {
    return hostedRun;
  },
  async signIn() {
    return operator;
  },
  async signOut() {},
  currentOperator() {
    return null;
  },
  async readDecisionContext() {
    return decisionContext;
  },
  async listPromotedCases() {
    return [];
  },
  async decideRun() {
    return { run: approvedRun, replayed: false };
  },
};

/** A run the service reports as sitting at the mandatory human boundary. */
const awaitingRun: HostedRun = {
  ...hostedRun,
  status: "awaiting_human_approval",
  current_stage: "manager",
  events: [
    ...hostedRun.events,
    { type: "run_paused_for_approval", sequence: 2, stage: "manager", occurred_at: "2026-08-14T09:06:00.000Z" },
  ],
};

const approvedRun: HostedRun = {
  ...awaitingRun,
  status: "approved",
  events: [
    ...awaitingRun.events,
    {
      type: "run_approved",
      sequence: 3,
      stage: "manager",
      public_summary:
        "An authenticated operator approved the sealed case record for internal promotion. No customer action was sent.",
      occurred_at: "2026-08-14T09:07:00.000Z",
    },
  ],
};

function awaitingClient(overrides: Partial<ControlRoomClient> = {}): ControlRoomClient {
  return {
    ...client,
    async createRun() {
      return { run: awaitingRun, idempotentReplay: false };
    },
    async readRun() {
      return awaitingRun;
    },
    ...overrides,
  };
}

/** Drives the sheet open and creates the run, which is where the decision boundary appears. */
async function openRun(activeClient: ControlRoomClient) {
  render(<CommandCenterView client={activeClient} />);
  await screen.findAllByText("Northstar Loom");
  fireEvent.click(screen.getByRole("button", { name: /start governed case/i }));
  await screen.findByText("Evidence bound");
  fireEvent.click(screen.getByRole("button", { name: /create hosted run/i }));
}

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

  it("retries a failed run from its sealed checkpoint", async () => {
    const retryRun = vi.fn(async () => hostedRun);
    const failedClient: ControlRoomClient = {
      ...client,
      async createRun() {
        return {
          idempotentReplay: false,
          run: {
            ...hostedRun,
            status: "failed",
            current_stage: "communicator",
            events: [
              ...hostedRun.events,
              { type: "run_failed", sequence: 2, stage: "communicator", reason: "Policy validation stopped safely.", occurred_at: "2026-08-14T09:01:00.000Z" },
            ],
          },
        };
      },
      retryRun,
    };
    render(<CommandCenterView client={failedClient} />);
    await screen.findAllByText("Northstar Loom");
    fireEvent.click(screen.getByRole("button", { name: /start governed case/i }));
    await screen.findByText("Evidence bound");
    fireEvent.click(screen.getByRole("button", { name: /create hosted run/i }));
    fireEvent.click(await screen.findByRole("button", { name: /retry from sealed checkpoint/i }));

    expect(retryRun).toHaveBeenCalledWith(hostedRun.run_id);
    expect(await screen.findByText("Queued for hosted worker")).toBeInTheDocument();
  });

  it("shows no decision boundary for a run that is not awaiting approval", async () => {
    await openRun(client);

    expect(await screen.findByText("Queued for hosted worker")).toBeInTheDocument();
    expect(screen.queryByText(/human decision required/i)).not.toBeInTheDocument();
  });

  it("requires an authenticated operator before offering any decision control", async () => {
    const readDecisionContext = vi.fn(async () => decisionContext);
    await openRun(awaitingClient({ readDecisionContext }));

    expect(await screen.findByText(/human decision required/i)).toBeInTheDocument();
    expect(screen.getByText(/not authority to approve/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in to decide/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /approve case record/i })).not.toBeInTheDocument();
    // A signed-out browser must not be able to pull the sealed decision context at all.
    expect(readDecisionContext).not.toHaveBeenCalled();
  });

  it("records an approval against the exact sealed manager hash after an explicit confirm", async () => {
    const decideRun = vi.fn(async () => ({ run: approvedRun, replayed: false }));
    await openRun(awaitingClient({ currentOperator: () => operator, decideRun }));

    expect(await screen.findByText(/in_app/)).toBeInTheDocument();
    expect(screen.getByText(decisionContext.manager_artifact_sha256)).toBeInTheDocument();
    expect(screen.getByText(/does not send, schedule or publish/i)).toBeInTheDocument();

    // The action stays disabled until a real rationale exists.
    const approve = screen.getByRole("button", { name: /approve case record/i });
    expect(approve).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "The sealed chain verifies and the invitation stays in the consented channel." },
    });
    expect(approve).toBeEnabled();

    fireEvent.click(approve);
    expect(decideRun).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: /confirm decision/i }));

    await screen.findByText(/case record approved/i);
    expect(decideRun).toHaveBeenCalledTimes(1);
    const [input] = decideRun.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(input.expected_manager_artifact_sha256).toBe(decisionContext.manager_artifact_sha256);
    expect(input.decision).toBe("approve");
    expect(screen.getByText(/no customer communication or other external action/i)).toBeInTheDocument();
  });

  it("keeps the decision available and truthful when the service refuses it", async () => {
    const decideRun = vi.fn(async () => {
      throw new Error("The supplied Manager artefact hash does not match the sealed record");
    });
    await openRun(awaitingClient({ currentOperator: () => operator, decideRun }));

    await screen.findByText(/in_app/);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "The sealed chain verifies and the invitation stays in the consented channel." },
    });
    fireEvent.click(screen.getByRole("button", { name: /reject/i }));
    fireEvent.click(await screen.findByRole("button", { name: /confirm decision/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/does not match the sealed record/i);
    expect(screen.queryByText(/case record approved/i)).not.toBeInTheDocument();
  });

  it("surfaces a decision-context failure instead of offering a blind decision", async () => {
    await openRun(awaitingClient({
      currentOperator: () => operator,
      async readDecisionContext() {
        throw new Error("Only a run awaiting human approval can be decided");
      },
    }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/awaiting human approval/i);
    expect(screen.queryByRole("button", { name: /approve case record/i })).not.toBeInTheDocument();
  });
});
