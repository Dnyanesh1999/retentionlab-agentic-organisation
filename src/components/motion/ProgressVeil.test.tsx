import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProgressVeil } from "./ProgressVeil";

const STAGES = [
  { id: "collect", label: "Collecting signals" },
  { id: "analyse", label: "Analysing recovery paths" },
  { id: "compose", label: "Composing outreach" },
];

describe("ProgressVeil", () => {
  it("announces the current named stage instead of a percentage", () => {
    render(<ProgressVeil activeStage="analyse" label="Loading recovery room" stages={STAGES} />);

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Stage 2 of 3: Analysing recovery paths");
    expect(status.textContent).not.toMatch(/%|percent/i);
  });

  it("marks stages as done / active / pending in order", () => {
    render(<ProgressVeil activeStage={1} label="Loading" stages={STAGES} />);

    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items[0]).toHaveAttribute("data-state", "done");
    expect(items[1]).toHaveAttribute("data-state", "active");
    expect(items[2]).toHaveAttribute("data-state", "pending");
  });

  it("exposes a busy state while loading and clears it on completion", () => {
    const { rerender } = render(
      <ProgressVeil activeStage="collect" label="Loading" stages={STAGES} />,
    );
    expect(screen.getByLabelText("Loading")).toHaveAttribute("aria-busy", "true");

    rerender(<ProgressVeil activeStage="compose" complete label="Loading" stages={STAGES} />);
    const region = screen.getByLabelText("Loading");
    expect(region).not.toHaveAttribute("aria-busy");
    expect(screen.getByRole("status")).toHaveTextContent("Loading complete");
  });

  it("keeps the decorative meter fill hidden from assistive tech", () => {
    const { container } = render(
      <ProgressVeil activeStage={0} label="Loading" reducedMotion stages={STAGES} />,
    );
    const meter = container.querySelector(".progress-veil__meter");
    expect(meter).toHaveAttribute("aria-hidden", "true");
  });
});
