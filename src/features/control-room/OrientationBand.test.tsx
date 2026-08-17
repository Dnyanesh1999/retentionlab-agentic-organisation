import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { OrientationBand } from "./OrientationBand";
import { HOSTED_STAGE_ORDER } from "../../../runtime/hosted/contracts";

/**
 * These assertions are about orientation, not decoration. The band exists because a visitor with no
 * context could not tell what RetentionLab was; if the five agents stop appearing in contract order,
 * or the primary door becomes pressable before an account is selectable, that failure is back.
 *
 * jsdom has no layout engine, so nothing here proves the band is *visible*. That is measured in a
 * browser and recorded in `docs/qa-control-room-orientation.md`.
 */
describe("OrientationBand", () => {
  it("names the five agents in the order the hosted contract runs them", () => {
    render(<OrientationBand />);

    const listed = screen.getAllByRole("listitem").map((item) => item.querySelector("strong")?.textContent);

    expect(listed).toEqual(["Researcher", "Designer", "Maker", "Communicator", "Manager"]);
    expect(listed).toHaveLength(HOSTED_STAGE_ORDER.length);
  });

  it("states the human boundary and that nothing reaches a customer", () => {
    render(<OrientationBand />);

    expect(screen.getByText(/chain always stops at a human/i)).toBeInTheDocument();
    expect(screen.getByText(/nothing is ever sent to a customer/i)).toBeInTheDocument();
  });

  it("offers a route out to the finished case and the archive", () => {
    render(<OrientationBand />);

    expect(screen.getByRole("link", { name: /read a finished case/i })).toHaveAttribute("href", "#/cases/overview");
    expect(screen.getByRole("link", { name: /browse the archive/i })).toHaveAttribute("href", "#/portfolio");
  });

  it("keeps the run door disabled until an account is selectable", () => {
    render(<OrientationBand />);

    const door = screen.getByRole("button", { name: /watch the five agents run/i });

    expect(door).toBeDisabled();
    expect(door).toHaveTextContent(/available once the live account directory loads/i);
  });

  it("names the account a run would open against, and opens the governed sheet", async () => {
    const onStartRun = vi.fn();
    render(<OrientationBand accountName="Lantern Metric" onStartRun={onStartRun} />);

    const door = screen.getByRole("button", { name: /watch the five agents run/i });
    expect(door).toHaveTextContent(/Lantern Metric/);

    await userEvent.click(door);

    // The door opens the launch sheet; it must never create a run on its own.
    expect(onStartRun).toHaveBeenCalledTimes(1);
  });
});
