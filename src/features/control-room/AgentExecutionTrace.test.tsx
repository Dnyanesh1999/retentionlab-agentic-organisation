import { render, screen, within } from "@testing-library/react";

import { AgentExecutionTrace } from "./AgentExecutionTrace";
import type { HostedRun, HostedRunEvent } from "../../../runtime/hosted/contracts";

const RUN_ID = "8f14e45f-ceea-467a-9575-0e2d6b3f1a20";
const ACCOUNT_ID = "1b4e28ba-2fa1-4d3b-9a2c-6f0d5e7c8b91";

const runCreated: HostedRunEvent = {
  type: "run_created",
  sequence: 1,
  run_id: RUN_ID,
  account_id: ACCOUNT_ID,
  account_slug: "northstar-loom",
  occurred_at: "2026-08-14T09:00:00.000Z",
};

function makeRun(overrides: Partial<HostedRun>, events: HostedRunEvent[] = [runCreated]): HostedRun {
  return {
    contract_version: "hosted.run.v1",
    run_id: RUN_ID,
    account_id: ACCOUNT_ID,
    account_slug: "northstar-loom",
    idempotency_key: "control-northstar-loom-001",
    objective: "Investigate retention risk for Northstar Loom and prepare a governed recovery decision.",
    status: "queued",
    current_stage: null,
    public_summary: null,
    created_at: "2026-08-14T09:00:00.000Z",
    updated_at: "2026-08-14T09:00:00.000Z",
    events,
    ...overrides,
  };
}

/** The list item whose stage name matches, so state copy is asserted against the right row. */
function stageRow(name: string): HTMLElement {
  const nameEl = screen.getByText(name, { selector: ".execution-trace__name" });
  return nameEl.closest("li") as HTMLElement;
}

describe("AgentExecutionTrace", () => {
  it("tells the truth when queued: Researcher awaits a worker and nothing is sealed", () => {
    render(<AgentExecutionTrace run={makeRun({ status: "queued", current_stage: null })} />);

    expect(within(stageRow("Researcher")).getByText("Awaiting hosted worker")).toBeInTheDocument();
    expect(within(stageRow("Designer")).getByText("Not started")).toBeInTheDocument();

    // No fake progress: nothing is sealed or active in a queued run.
    expect(screen.queryByText("Sealed")).not.toBeInTheDocument();
    expect(screen.queryByText("Working now")).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();

    expect(screen.getByRole("status")).toHaveTextContent(/no agent has started/i);
  });

  it("derives sealed stages only from stage_completed events and marks the active stage", () => {
    const events: HostedRunEvent[] = [
      runCreated,
      { type: "stage_started", sequence: 2, stage: "researcher", occurred_at: "2026-08-14T09:01:00.000Z" },
      {
        type: "stage_completed",
        sequence: 3,
        stage: "researcher",
        public_summary: "Bound 18 evidence records for Northstar Loom.",
        occurred_at: "2026-08-14T09:05:00.000Z",
      },
      // Run has advanced to maker WITHOUT a designer stage_completed event.
      { type: "stage_started", sequence: 4, stage: "maker", occurred_at: "2026-08-14T09:06:00.000Z" },
    ];
    render(<AgentExecutionTrace run={makeRun({ status: "in_progress", current_stage: "maker" }, events)} />);

    // Sealed strictly from the stage_completed event, with its outward summary.
    const researcher = stageRow("Researcher");
    expect(within(researcher).getByText("Sealed")).toBeInTheDocument();
    expect(within(researcher).getByText(/Bound 18 evidence records/)).toBeInTheDocument();

    // Designer was skipped past but never emitted completion, so it stays unstarted — no inference.
    expect(within(stageRow("Designer")).getByText("Not started")).toBeInTheDocument();

    // Only current_stage is active.
    const maker = stageRow("Maker");
    expect(within(maker).getByText("Working now")).toBeInTheDocument();
    expect(maker).toHaveAttribute("aria-current", "step");

    expect(within(stageRow("Communicator")).getByText("Not started")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/Maker is active/i);
  });

  it("moves the truthful queued boundary to the next unsealed stage", () => {
    const events: HostedRunEvent[] = [
      runCreated,
      { type: "stage_started", sequence: 2, stage: "researcher", occurred_at: "2026-08-14T09:01:00.000Z" },
      {
        type: "stage_completed",
        sequence: 3,
        stage: "researcher",
        public_summary: "Researcher sealed five fresh evidence tools.",
        occurred_at: "2026-08-14T09:02:00.000Z",
      },
    ];
    render(<AgentExecutionTrace run={makeRun({ status: "queued", current_stage: null }, events)} />);

    expect(within(stageRow("Researcher")).getByText("Sealed")).toBeInTheDocument();
    expect(within(stageRow("Designer")).getByText("Awaiting hosted worker")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/Designer is queued.*1 of 5 stages sealed/i);
  });

  it("seals all five stages and shows the human boundary when awaiting approval", () => {
    const stages = ["researcher", "designer", "maker", "communicator", "manager"] as const;
    const events: HostedRunEvent[] = [
      runCreated,
      ...stages.map((stage, i): HostedRunEvent => ({
        type: "stage_completed",
        sequence: i + 2,
        stage,
        public_summary: `${stage} sealed.`,
        occurred_at: "2026-08-14T09:10:00.000Z",
      })),
      { type: "run_paused_for_approval", sequence: 7, stage: "manager", occurred_at: "2026-08-14T09:11:00.000Z" },
    ];
    render(
      <AgentExecutionTrace
        run={makeRun({ status: "awaiting_human_approval", current_stage: "manager" }, events)}
      />,
    );

    expect(screen.getAllByText("Sealed")).toHaveLength(5);
    expect(screen.getByRole("note")).toHaveTextContent(/Awaiting human approval/i);
  });

  it("marks the failed stage from a run_failed event", () => {
    const events: HostedRunEvent[] = [
      runCreated,
      { type: "stage_started", sequence: 2, stage: "designer", occurred_at: "2026-08-14T09:02:00.000Z" },
      {
        type: "run_failed",
        sequence: 3,
        stage: "designer",
        reason: "Designer could not reconcile the evidence set.",
        occurred_at: "2026-08-14T09:03:00.000Z",
      },
    ];
    render(<AgentExecutionTrace run={makeRun({ status: "failed", current_stage: "designer" }, events)} />);

    const designer = stageRow("Designer");
    expect(within(designer).getByText("Failed")).toBeInTheDocument();
    expect(within(designer).getByText(/could not reconcile/i)).toBeInTheDocument();
  });
});
