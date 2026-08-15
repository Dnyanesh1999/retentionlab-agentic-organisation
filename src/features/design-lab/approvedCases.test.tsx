import { render, screen, within } from "@testing-library/react";

import { ApprovedCaseScreen, CaseArchiveScreen } from "./DesignLabView";
import type { ControlRoomClient } from "../control-room/controlRoomClient";
import type { PromotedCase } from "../../../runtime/hosted/contracts";

const RUN_ID = "982ac99a-d9aa-47a6-ba61-09f366143715";

const promoted: PromotedCase = {
  run_id: RUN_ID,
  account_slug: "marble-current",
  account_display_name: "Marble Current",
  objective: "Investigate retention risk for Marble Current and prepare a governed recovery decision.",
  approved_at: "2026-08-14T15:31:00.000Z",
  external_actions_permitted: 0,
  stage_summaries: [
    { stage: "researcher", public_summary: "Sealed 7 cited observations from 5 fresh evidence tools." },
    { stage: "designer", public_summary: "Sealed 3 principles and 3 consent-aware journey steps." },
    { stage: "maker", public_summary: "Sealed 10 reviewed components with passing verification." },
    { stage: "communicator", public_summary: "Sealed a consent-bound in_app invitation; nothing sent." },
    { stage: "manager", public_summary: "Verified the complete chain and routed to human approval." },
  ],
};

/** Only the archive's own call is exercised, so every other client method throws if reached. */
function stubClient(listPromotedCases: ControlRoomClient["listPromotedCases"]): ControlRoomClient {
  return new Proxy({ listPromotedCases } as Partial<ControlRoomClient>, {
    get(target, property) {
      if (property in target) return target[property as keyof typeof target];
      throw new Error(`The case archive must not call ${String(property)}`);
    },
  }) as ControlRoomClient;
}

describe("CaseArchiveScreen approved register", () => {
  it("keeps the assessed snapshot and lists an approved live case beside it", async () => {
    render(
      <CaseArchiveScreen client={stubClient(async () => [promoted])} onOpenCase={() => {}} />,
    );

    expect(screen.getByText("Copper Finch")).toBeInTheDocument();

    const live = await screen.findByRole("link", { name: /Marble Current/ });
    expect(live).toHaveAttribute("href", `#/cases/approved/${RUN_ID}`);
    expect(within(live).getByText("5 of 5 stages sealed")).toBeInTheDocument();
    expect(within(live).getByText(/Approved · 0 external actions/)).toBeInTheDocument();
  });

  it("states plainly that nothing is approved yet rather than implying a case exists", async () => {
    render(<CaseArchiveScreen client={stubClient(async () => [])} onOpenCase={() => {}} />);

    expect(await screen.findByText(/No live run has been approved yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Marble Current/ })).not.toBeInTheDocument();
    // The assessed record must survive an empty live archive.
    expect(screen.getByText("Copper Finch")).toBeInTheDocument();
  });

  it("fails visibly when the approved archive is unavailable", async () => {
    render(
      <CaseArchiveScreen
        client={stubClient(async () => {
          throw new Error("Run gateway unreachable");
        })}
        onOpenCase={() => {}}
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(/unreachable/i);
  });
});

describe("ApprovedCaseScreen", () => {
  it("renders only the bounded public projection for one approved case", async () => {
    render(<ApprovedCaseScreen client={stubClient(async () => [promoted])} runId={RUN_ID} />);

    // The heading renders outside the state region, so wait on the record itself.
    expect(await screen.findByText(promoted.objective)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Marble Current" })).toBeInTheDocument();
    expect(screen.getByText(/consent-bound in_app invitation/i)).toBeInTheDocument();
    expect(screen.getByText(/No customer communication or other external action/i)).toBeInTheDocument();

    // Nothing private may reach the public record.
    const markup = document.body.innerHTML;
    expect(markup).not.toMatch(/[0-9a-f]{64}/);
    expect(markup).not.toMatch(/prompt_version|rationale|operator/i);
  });

  it("does not invent a record for an unapproved or unknown run id", async () => {
    render(
      <ApprovedCaseScreen
        client={stubClient(async () => [promoted])}
        runId="8f14e45f-ceea-467a-9575-0e2d6b3f1a20"
      />,
    );

    expect(await screen.findByText(/No approved case matches this link/i)).toBeInTheDocument();
    expect(screen.queryByText(promoted.objective)).not.toBeInTheDocument();
  });
});
