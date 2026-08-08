import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { gate9Run } from "./gate9Run";
import { OrganisationView } from "./OrganisationView";

function agentButtons() {
  return screen
    .getAllByRole("button")
    .filter((button) => button.hasAttribute("aria-pressed") && button.className.includes("agent-node"));
}

function selectAgent(name: string) {
  fireEvent.click(screen.getByText(name).closest("button")!);
}

describe("OrganisationView — assessed Gate 9 run", () => {
  it("renders exactly five agent stages with their current version and status", () => {
    render(<OrganisationView />);

    const nodes = agentButtons();
    expect(nodes).toHaveLength(5);

    // Communicator's current version is 2 (post-recovery) and reads its status.
    const communicator = screen.getByText("Maeve Quinn").closest("button")!;
    expect(within(communicator).getByText(/v2 · ready for manager/)).toBeInTheDocument();
    expect(within(communicator).getByText(/recovered/)).toBeInTheDocument();
  });

  it("defaults to the Researcher and shows its cited, sourced evidence", () => {
    render(<OrganisationView />);

    const inspector = screen.getByRole("complementary", { name: "Nia Calder details" });
    expect(within(inspector).getByText(/Feature adoption has decreased/)).toBeInTheDocument();
    expect(within(inspector).getByText("product:copper-finch:feature_adoption:2")).toBeInTheDocument();
    // Resolved model provenance is shown, not invented.
    expect(within(inspector).getAllByText("google/gemma-4-26b-a4b-it:free").length).toBeGreaterThan(0);
  });

  it("exposes the evidence detail scroller as a keyboard-reachable, named region", () => {
    render(<OrganisationView />);

    // The native scroll region must be tab-reachable and carry an honest
    // accessible name tied to the selected agent — not orphaned at tabIndex -1.
    const scroller = screen.getByRole("region", { name: "Nia Calder evidence detail" });
    expect(scroller).toHaveClass("agent-inspector__scroll");
    expect(scroller).toHaveAttribute("tabindex", "0");
  });

  it("meaningfully updates the detail surface when a different stage is selected", async () => {
    render(<OrganisationView />);

    expect(screen.queryByText(/Trust evaluation/)).toBeNull();

    selectAgent("Elias Grant");

    expect(await screen.findByRole("region", { name: "Governance" })).toBeInTheDocument();
    expect(screen.getByText(/Trust evaluation/)).toBeInTheDocument();
  });

  it("discloses the Communicator failure -> named operator retry -> v2 success", async () => {
    render(<OrganisationView />);

    selectAgent("Maeve Quinn");

    const recovery = await screen.findByRole("region", { name: "Failed-stage recovery" });
    const text = recovery.textContent ?? "";
    expect(text).toContain("Communicator v1 failed");
    expect(text).toContain("Communicator cited a claim absent from the Maker handoff");
    expect(text).toContain("Named operator retry");
    expect(text).toContain("Communicator v2 succeeded");
  });

  it("surfaces the sealed governance facts prominently on the Manager", async () => {
    render(<OrganisationView />);

    selectAgent("Elias Grant");

    const governance = await screen.findByRole("region", { name: "Governance" });
    expect(within(governance).getByText("Decision").nextSibling).toHaveTextContent(
      gate9Run.managerOutcome.decision,
    );
    expect(within(governance).getByText("Chain verified").nextSibling).toHaveTextContent("true");
    expect(within(governance).getByText("Permitted next action").nextSibling).toHaveTextContent(
      "await human approval",
    );
    expect(within(governance).getByText("Autonomous external actions").nextSibling).toHaveTextContent(
      "false",
    );
  });

  it("keeps a no-external-action governance note accessible on every stage", async () => {
    render(<OrganisationView />);

    // Researcher (default) already shows the standing guard.
    expect(
      screen.getByText(/No external action — sealed for a named human decision/),
    ).toBeInTheDocument();

    selectAgent("Noor Patel");
    expect(
      await screen.findByText(/No external action — sealed for a named human decision/),
    ).toBeInTheDocument();
  });

  it("presents the run honestly as an immutable snapshot, not a live query", () => {
    render(<OrganisationView />);

    expect(screen.getByText(/immutable assessed snapshot/i)).toBeInTheDocument();
    expect(screen.getByText(/not a live query/i)).toBeInTheDocument();
  });

  it("answers the read-only Manager deterministically from the sealed record", () => {
    render(<OrganisationView />);

    fireEvent.click(screen.getByRole("button", { name: /Talk to the organisation/ }));
    fireEvent.click(screen.getByRole("button", { name: "Is the evidence chain verified?" }));

    expect(screen.getByText(/all 7 lineage links matching/)).toBeInTheDocument();
    expect(screen.getByText(/Source: gate-9 transcript · lineage/)).toBeInTheDocument();
  });

  it("does not pretend free-text is a model call", () => {
    render(<OrganisationView />);

    fireEvent.click(screen.getByRole("button", { name: /Talk to the organisation/ }));
    fireEvent.change(screen.getByLabelText(/Ask the Manager about this sealed decision/), {
      target: { value: "please improvise something new" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask the read-only Manager" }));

    expect(screen.getByText(/answers only from the sealed decision record/)).toBeInTheDocument();
  });

  it("contains none of the stale foundation/pending copy", () => {
    const { container } = render(<OrganisationView />);
    const text = container.textContent ?? "";

    for (const stale of [
      "Not started",
      "Not connected",
      "Foundation gate",
      "Interface foundation",
      "live execution is intentionally locked",
      "Connection gate pending",
      "No response is generated",
      "Interface contract documented",
      "Connect live case to continue",
    ]) {
      expect(text).not.toContain(stale);
    }
  });
});
