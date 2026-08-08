import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  computeOrganisationFit,
  computeScrollState,
  useInspectorScroll,
} from "./inspectorScroll";

describe("computeScrollState", () => {
  it("reports an idle, non-overflowing state when content fits its viewport", () => {
    const state = computeScrollState(0, 500, 500);
    expect(state.hasOverflow).toBe(false);
    expect(state.progress).toBe(0);
    expect(state.atTop).toBe(true);
    expect(state.atBottom).toBe(true);
    expect(state.thumbSize).toBe(1);
  });

  it("treats a sub-epsilon overflow as no overflow (no jittery rail on rounding noise)", () => {
    expect(computeScrollState(0, 1000.5, 1000).hasOverflow).toBe(false);
  });

  it("marks the top edge and derives a thumb from the visible ratio", () => {
    const state = computeScrollState(0, 2000, 1000);
    expect(state.hasOverflow).toBe(true);
    expect(state.atTop).toBe(true);
    expect(state.atBottom).toBe(false);
    expect(state.progress).toBe(0);
    // 1000 / 2000 visible.
    expect(state.thumbSize).toBeCloseTo(0.5, 5);
  });

  it("reports mid-scroll progress proportional to the scrolled range", () => {
    // maxScroll = 2000 - 1000 = 1000; scrollTop 250 -> 25%.
    const state = computeScrollState(250, 2000, 1000);
    expect(state.progress).toBeCloseTo(0.25, 5);
    expect(state.atTop).toBe(false);
    expect(state.atBottom).toBe(false);
  });

  it("marks the bottom edge with full progress at the end of the range", () => {
    const state = computeScrollState(1000, 2000, 1000);
    expect(state.progress).toBe(1);
    expect(state.atTop).toBe(false);
    expect(state.atBottom).toBe(true);
  });

  it("clamps an out-of-range scrollTop into [0, 1] progress", () => {
    expect(computeScrollState(-40, 2000, 1000).progress).toBe(0);
    expect(computeScrollState(99999, 2000, 1000).progress).toBe(1);
  });

  it("floors the thumb so a very long page keeps a grabbable-looking thumb", () => {
    // visible ratio 100 / 10000 = 0.01, below the floor.
    expect(computeScrollState(0, 10000, 100).thumbSize).toBeCloseTo(0.14, 5);
  });
});

describe("computeOrganisationFit", () => {
  it("never grows past the left stage's own content (no empty cream column)", () => {
    const fit = computeOrganisationFit({
      stageNaturalHeight: 700,
      layoutTop: 120,
      viewportHeight: 2000,
    });
    expect(fit).toBe(700);
  });

  it("never grows past the space left below the header/tabs in the viewport", () => {
    const fit = computeOrganisationFit({
      stageNaturalHeight: 5000,
      layoutTop: 120,
      viewportHeight: 900,
      bottomGap: 24,
    });
    // 900 - 120 - 24 = 756.
    expect(fit).toBe(756);
  });

  it("never drops below the usable-inspector floor", () => {
    const fit = computeOrganisationFit({
      stageNaturalHeight: 100,
      layoutTop: 120,
      viewportHeight: 300,
      minHeight: 480,
    });
    expect(fit).toBe(480);
  });

  it("rounds to a whole pixel", () => {
    const fit = computeOrganisationFit({
      stageNaturalHeight: 640.4,
      layoutTop: 0,
      viewportHeight: 2000,
    });
    expect(fit).toBe(640);
  });
});

function Harness({ resetKey }: { resetKey: string }) {
  const { ref } = useInspectorScroll<HTMLDivElement>(resetKey);
  return <div data-testid="scroller" ref={ref} />;
}

describe("useInspectorScroll — stage-change reset", () => {
  it("resets the inspector scrollTop to the top when the selected stage changes", () => {
    const { getByTestId, rerender } = render(<Harness resetKey="researcher" />);
    const scroller = getByTestId("scroller");

    // Simulate the reader having scrolled partway down the previous stage.
    scroller.scrollTop = 480;
    expect(scroller.scrollTop).toBe(480);

    rerender(<Harness resetKey="designer" />);
    expect(scroller.scrollTop).toBe(0);
  });

  it("leaves the scroll position untouched when the same stage re-renders", () => {
    const { getByTestId, rerender } = render(<Harness resetKey="researcher" />);
    const scroller = getByTestId("scroller");

    scroller.scrollTop = 220;
    rerender(<Harness resetKey="researcher" />);
    expect(scroller.scrollTop).toBe(220);
  });
});
