import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ScrollProgress } from "./ScrollProgress";

describe("ScrollProgress", () => {
  it("renders a decorative rail that assistive technology ignores", () => {
    const { container } = render(<ScrollProgress />);

    const rail = container.querySelector(".scroll-progress");
    expect(rail).not.toBeNull();
    expect(rail).toHaveAttribute("aria-hidden", "true");
    // The scrollbar already reports position; the rail must not duplicate it
    // as a progressbar, which would also read as work-in-progress.
    expect(rail).not.toHaveAttribute("role");
  });

  it("renders nothing at all under reduced motion", () => {
    const { container } = render(<ScrollProgress reducedMotion />);

    expect(container.querySelector(".scroll-progress")).toBeNull();
  });
});
