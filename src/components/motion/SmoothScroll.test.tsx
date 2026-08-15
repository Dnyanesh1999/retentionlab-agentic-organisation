import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const construct = vi.fn();
const destroy = vi.fn();

vi.mock("lenis", () => ({
  default: class {
    constructor(options: unknown) {
      construct(options);
    }
    destroy = destroy;
  },
}));

import { LENIS_PREVENT } from "./lenisPrevent";
import { SmoothScroll } from "./SmoothScroll";

// Cleared before each test rather than after: Vitest runs `afterEach` hooks in
// reverse registration order, so Testing Library's auto-unmount (registered at
// import time) fires *after* a local afterEach and would leak the previous
// test's teardown `destroy()` into the next test's count.
beforeEach(() => {
  construct.mockClear();
  destroy.mockClear();
});

describe("SmoothScroll", () => {
  it("never loads or starts Lenis under reduced motion", async () => {
    render(
      <SmoothScroll reducedMotion>
        <p>Page</p>
      </SmoothScroll>,
    );

    // Give the dynamic import a chance to resolve before asserting absence.
    await Promise.resolve();
    expect(construct).not.toHaveBeenCalled();
  });

  it("starts Lenis with hash routing left alone and its own RAF loop", async () => {
    render(
      <SmoothScroll>
        <p>Page</p>
      </SmoothScroll>,
    );

    await waitFor(() => expect(construct).toHaveBeenCalledTimes(1));
    const options = construct.mock.calls[0][0] as Record<string, unknown>;
    // Every nav link in this app is an `a[href^="#"]`; Lenis must not claim them.
    expect(options.anchors).toBe(false);
    expect(options.autoRaf).toBe(true);
  });

  it("tears the instance down on unmount", async () => {
    const { unmount } = render(<SmoothScroll />);
    await waitFor(() => expect(construct).toHaveBeenCalledTimes(1));

    unmount();
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("renders its children untouched", () => {
    render(
      <SmoothScroll reducedMotion>
        <p>Page</p>
      </SmoothScroll>,
    );

    expect(screen.getByText("Page")).toBeInTheDocument();
  });

  it("exposes the opt-out attribute inner scrollers need", () => {
    expect(LENIS_PREVENT).toEqual({ "data-lenis-prevent": "true" });
  });
});
