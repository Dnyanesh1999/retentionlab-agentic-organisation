import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SharedIndicator } from "./SharedIndicator";

describe("SharedIndicator", () => {
  it("is decorative and never announced", () => {
    const { container } = render(<SharedIndicator layoutId="nav" />);

    const indicator = container.querySelector(".shared-indicator");
    expect(indicator).not.toBeNull();
    expect(indicator).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps the same element and class under reduced motion", () => {
    const { container } = render(<SharedIndicator layoutId="nav" reducedMotion />);

    // The rule must still be drawn on the active item; only the travel goes.
    expect(container.querySelector(".shared-indicator")).not.toBeNull();
  });

  it("accepts a caller class so each group can style its own rule", () => {
    const { container } = render(<SharedIndicator className="global-nav__underline" layoutId="nav" />);

    expect(container.querySelector(".global-nav__underline")).not.toBeNull();
  });
});
