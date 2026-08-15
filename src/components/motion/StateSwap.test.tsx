import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StateSwap } from "./StateSwap";

describe("StateSwap", () => {
  it("wraps content in a stable polite live region", () => {
    render(
      <StateSwap live="polite" state="loading">
        <p>Loading evidence…</p>
      </StateSwap>,
    );

    const region = screen.getByText("Loading evidence…").closest("[aria-live]");
    expect(region).not.toBeNull();
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveAttribute("data-state", "loading");
  });

  it("updates the live region's state and never stacks multiple states", () => {
    const { container, rerender } = render(
      <StateSwap state="loading">
        <p>Loading…</p>
      </StateSwap>,
    );
    const region = container.querySelector("[aria-live]") as HTMLElement;
    expect(region).toHaveAttribute("data-state", "loading");
    expect(region.children).toHaveLength(1);

    // `mode="wait"` holds the outgoing child until its exit finishes, so an
    // interrupted swap never mounts two states side by side.
    rerender(
      <StateSwap state="success">
        <p>Done</p>
      </StateSwap>,
    );
    expect(region).toHaveAttribute("data-state", "success");
    expect(region.children).toHaveLength(1);
  });

  it("swaps instantly under reduced motion, with the new state on screen at once", () => {
    const { getByText, queryByText, rerender } = render(
      <StateSwap reducedMotion state="loading">
        <p>Loading live account directory…</p>
      </StateSwap>,
    );

    rerender(
      <StateSwap reducedMotion state="ready">
        <p>8 live records</p>
      </StateSwap>,
    );

    // `mode="wait"` holds the incoming state until the outgoing one has left,
    // so a non-zero exit would be time the new content is not on screen. Under
    // reduced motion that wait must be nothing at all.
    expect(getByText("8 live records")).toBeInTheDocument();
    expect(queryByText("Loading live account directory…")).toBeNull();
  });

  it("flags reduced motion for opacity-only swaps", () => {
    render(
      <StateSwap reducedMotion state="error">
        <p>Something went wrong</p>
      </StateSwap>,
    );

    const region = screen.getByText("Something went wrong").closest("[aria-live]");
    expect(region).toHaveAttribute("data-reduced-motion", "true");
  });
});
