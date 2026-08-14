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
