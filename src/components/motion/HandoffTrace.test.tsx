import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HandoffTrace } from "./HandoffTrace";

const PATH = "M4 20 C 40 20, 40 4, 76 4";

describe("HandoffTrace", () => {
  it("is fully decorative: the svg is aria-hidden and out of the tab order", () => {
    const { container } = render(<HandoffTrace d={PATH} height={24} width={80} />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("focusable", "false");
  });

  it("renders a directional arrowhead marker referenced by the path", () => {
    const { container } = render(<HandoffTrace d={PATH} directed height={24} width={80} />);
    const marker = container.querySelector("marker");
    const path = container.querySelector("path[marker-end]");
    expect(marker).not.toBeNull();
    expect(path).not.toBeNull();
    expect(path?.getAttribute("marker-end")).toContain(marker?.id ?? "");
  });

  it("draws (animates pathLength) when motion is allowed", () => {
    const { container } = render(<HandoffTrace d={PATH} height={24} reducedMotion={false} width={80} />);
    expect(container.querySelector('path[data-motion="draw"]')).not.toBeNull();
    expect(container.querySelector('path[data-motion="static"]')).toBeNull();
  });

  it("holds a static, fully-drawn line under reduced motion", () => {
    const { container } = render(<HandoffTrace d={PATH} height={24} reducedMotion width={80} />);
    expect(container.querySelector('path[data-motion="static"]')).not.toBeNull();
    expect(container.querySelector('path[data-motion="draw"]')).toBeNull();
  });
});
