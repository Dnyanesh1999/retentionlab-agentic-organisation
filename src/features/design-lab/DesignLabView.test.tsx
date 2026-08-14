import axe from "axe-core";
import { fireEvent, render, screen, within } from "@testing-library/react";

import { DesignLabView } from "./DesignLabView";

describe("interactive design lab", () => {
  it("keeps the archive grounded in the single assessed case", async () => {
    render(<DesignLabView />);

    const primaryNavigation = screen.getByRole("navigation", { name: "Design lab primary navigation" });
    fireEvent.click(within(primaryNavigation).getByRole("button", { name: "Case archive" }));

    expect(await screen.findByRole("heading", { name: "Case archive" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Copper Finch/ })).toBeInTheDocument();
    expect(screen.getByText("1 assessed case")).toBeInTheDocument();
  });

  it("switches between every meaningful case section", async () => {
    render(<DesignLabView />);

    fireEvent.click(screen.getByRole("button", { name: "Experience" }));
    expect(await screen.findByRole("heading", { name: "Recovery experience" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Decision" }));
    expect(await screen.findByRole("heading", { name: "Manager decision" })).toBeInTheDocument();
  });

  it("keeps each contribution inside its animated specialist drawer", () => {
    render(<DesignLabView />);

    const designerButton = screen.getByRole("button", { name: /02 Designer/ });
    fireEvent.click(designerButton);
    const designerRow = designerButton.closest("li");

    expect(designerButton).toHaveAttribute("aria-expanded", "true");
    expect(designerRow).not.toBeNull();
    expect(within(designerRow!).getByText("Designer contribution")).toBeInTheDocument();
    expect(document.querySelector(".ledger-detail")).not.toBeInTheDocument();
  });

  it("answers questions only from the sealed case record", async () => {
    render(<DesignLabView />);

    fireEvent.click(screen.getByRole("button", { name: "Ask this case" }));
    expect(await screen.findByText(/not a live model call/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Can the organisation contact the customer?" }));
    expect(await screen.findByText(/requires a named human to approve/i)).toBeInTheDocument();
  });

  it("demonstrates honest loading and recoverable error states", async () => {
    render(<DesignLabView />);

    fireEvent.click(screen.getByRole("button", { name: "loading" }));
    expect(await screen.findByLabelText("Opening verified case")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "error" }));
    fireEvent.click(await screen.findByRole("button", { name: "Retry verified record" }));
    expect(await screen.findByRole("heading", { name: /accountable path/i })).toBeInTheDocument();
  });

  it("has no axe-detectable accessibility violations", async () => {
    const { container } = render(<DesignLabView />);
    const results = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });

    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});
