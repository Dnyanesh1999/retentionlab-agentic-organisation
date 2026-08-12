import { fireEvent, render, screen } from "@testing-library/react";

import { PortfolioView } from "./PortfolioView";

describe("Portfolio case study", () => {
  it("presents exactly five agent stages plus a separate human approval gate", () => {
    render(<PortfolioView />);

    const stages = screen
      .getAllByRole("button")
      .filter((button) => button.hasAttribute("aria-pressed"));

    expect(stages).toHaveLength(5);
    expect(stages.map((stage) => stage.textContent)).toEqual(expect.arrayContaining([
      expect.stringContaining("Researcher"),
      expect.stringContaining("Designer"),
      expect.stringContaining("Maker"),
      expect.stringContaining("Communicator"),
      expect.stringContaining("Manager"),
    ]));
    expect(screen.getByLabelText("Human approval gate")).not.toHaveAttribute("aria-pressed");
  });

  it("lets a reader inspect the typed output of each specialist", () => {
    render(<PortfolioView />);

    fireEvent.click(screen.getByRole("button", { name: /03.*Maker.*Noor Patel/i }));

    expect(screen.getByText(/Creates the functional Signal Garden artefact/)).toBeInTheDocument();
    expect(screen.getByText("RecoveryRoomArtefact")).toBeInTheDocument();
  });

  it("links the portfolio narrative to both product experiences", () => {
    render(<PortfolioView />);

    expect(screen.getByRole("link", { name: /Explore the live case/i })).toHaveAttribute("href", "#/cases/organisation");
    expect(screen.getByRole("link", { name: /Open the Signal Garden/i })).toHaveAttribute("href", "#/cases/recovery-room");
  });

  it("explains the safety boundary and live architecture honestly", () => {
    render(<PortfolioView />);

    expect(screen.getByText("No agent can act outside the approval boundary.")).toBeInTheDocument();
    expect(screen.getByText("No cached fallback")).toBeInTheDocument();
    expect(screen.getByText("Autonomous external actions: false")).toBeInTheDocument();
  });
});
