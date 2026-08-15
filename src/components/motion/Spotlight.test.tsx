import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Spotlight } from "./Spotlight";

/**
 * Replace `matchMedia` so the hover/pointer capability can be chosen per test.
 * The stub must answer per query: `motion`'s own `useReducedMotion` also goes
 * through `matchMedia`, and a blanket `true` would silently reduce motion and
 * make every assertion here pass or fail for the wrong reason.
 */
function stubPointer(fine: boolean) {
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: query.includes("prefers-reduced-motion") ? false : fine,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as unknown as MediaQueryList,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Spotlight", () => {
  it("tracks the pointer only on a device that can actually hover", () => {
    stubPointer(true);
    render(
      <Spotlight aria-label="Account command">
        <p>Lantern Metric</p>
      </Spotlight>,
    );

    expect(screen.getByLabelText("Account command")).toHaveAttribute("data-spotlight", "on");
  });

  it("stays off for a coarse pointer, where there is nothing to track", () => {
    stubPointer(false);
    render(
      <Spotlight aria-label="Account command">
        <p>Lantern Metric</p>
      </Spotlight>,
    );

    const panel = screen.getByLabelText("Account command");
    expect(panel).toHaveAttribute("data-spotlight", "off");
    expect(panel).not.toHaveAttribute("style");
  });

  it("stays off under reduced motion even on a hover-capable device", () => {
    stubPointer(true);
    render(
      <Spotlight aria-label="Account command" reducedMotion>
        <p>Lantern Metric</p>
      </Spotlight>,
    );

    expect(screen.getByLabelText("Account command")).toHaveAttribute("data-spotlight", "off");
  });

  it("renders its children and keeps the requested semantic element", () => {
    stubPointer(true);
    const { container } = render(
      <Spotlight as="section" aria-label="Account command">
        <p>Lantern Metric</p>
      </Spotlight>,
    );

    expect(container.querySelector("section")).not.toBeNull();
    expect(screen.getByText("Lantern Metric")).toBeInTheDocument();
  });
});
