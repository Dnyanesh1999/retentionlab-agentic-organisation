import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LineageConstellation } from "./LineageConstellation";
import { gate9Run, stageLabel } from "../organisation/gate9Run";

/**
 * The panel's description and its live readout both talk about selecting a
 * stage, so a bare text query matches two elements. The readout is the live
 * region, and it is the one these tests are about.
 */
function readout(container: HTMLElement) {
  const element = container.querySelector<HTMLElement>("[aria-live='polite']");
  if (!element) throw new Error("The lineage readout is missing.");
  return element;
}

describe("LineageConstellation", () => {
  it("offers every stage as a real button, not just a drawing", () => {
    render(<LineageConstellation />);

    gate9Run.stages.forEach((stage) => {
      expect(screen.getByRole("button", { name: new RegExp(stageLabel(stage.id)) })).toBeInTheDocument();
    });
  });

  it("hides the edge drawing from assistive technology", () => {
    const { container } = render(<LineageConstellation />);
    const svg = container.querySelector("svg");

    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("focusable", "false");
  });

  it("names the predecessors a stage inherited, in text", () => {
    const { container } = render(<LineageConstellation />);

    // The Manager verifies the whole chain, so it is the stage with the most to
    // report — and the one whose relationship a shape alone cannot convey.
    fireEvent.click(screen.getByRole("button", { name: /Manager/ }));

    const live = readout(container);
    const managerLinks = gate9Run.stages.find((stage) => stage.id === "manager")?.lineage ?? [];

    expect(managerLinks.length).toBeGreaterThan(0);
    managerLinks.forEach((link) => {
      expect(within(live).getByText(new RegExp(stageLabel(link.from)))).toBeInTheDocument();
    });
  });

  it("says the origin record inherits nothing rather than showing an empty list", () => {
    const { container } = render(<LineageConstellation />);

    fireEvent.click(screen.getByRole("button", { name: /Researcher/ }));

    expect(readout(container)).toHaveTextContent(/inherits nothing/i);
  });

  it("reports the verified count from the sealed transcript, not a constant", () => {
    render(<LineageConstellation />);

    const links = gate9Run.stages.flatMap((stage) => stage.lineage);
    const verified = links.filter((link) => link.verified).length;

    expect(screen.getByText(`${verified} of ${links.length} verified`)).toBeInTheDocument();
  });

  it("toggles a stage off when it is selected twice", () => {
    const { container } = render(<LineageConstellation />);
    const designer = screen.getByRole("button", { name: /Designer/ });

    fireEvent.click(designer);
    expect(designer).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(designer);
    expect(designer).toHaveAttribute("aria-pressed", "false");
    expect(readout(container)).toHaveTextContent(/Select a stage to name/i);
  });
});
