import { createEvent, fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  computeKeyScrollTarget,
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

describe("computeKeyScrollTarget", () => {
  // maxScroll = 2000 - 1000 = 1000; LINE_STEP 48; page = 1000 - 48 = 952.
  it("steps down by a line for ArrowDown", () => {
    expect(computeKeyScrollTarget("ArrowDown", 200, 2000, 1000)).toBe(248);
  });

  it("steps up by a line for ArrowUp", () => {
    expect(computeKeyScrollTarget("ArrowUp", 200, 2000, 1000)).toBe(152);
  });

  it("pages by clientHeight minus an overlap line for PageDown/PageUp", () => {
    // page = 1000 - 48 = 952.
    expect(computeKeyScrollTarget("PageDown", 0, 2000, 1000)).toBe(952);
    expect(computeKeyScrollTarget("PageUp", 1000, 2000, 1000)).toBe(48);
    // From 200, 200 + 952 = 1152 overshoots and clamps to maxScroll 1000.
    expect(computeKeyScrollTarget("PageDown", 200, 2000, 1000)).toBe(1000);
  });

  it("jumps to the extremes for Home and End", () => {
    expect(computeKeyScrollTarget("Home", 600, 2000, 1000)).toBe(0);
    expect(computeKeyScrollTarget("End", 0, 2000, 1000)).toBe(1000);
  });

  it("clamps into range at the boundaries but still returns a number (page stays put)", () => {
    // Already at the top: ArrowUp clamps to 0 rather than going negative or returning null.
    expect(computeKeyScrollTarget("ArrowUp", 0, 2000, 1000)).toBe(0);
    // Already at the bottom: ArrowDown clamps to maxScroll.
    expect(computeKeyScrollTarget("ArrowDown", 1000, 2000, 1000)).toBe(1000);
    // PageDown from the top overshoots and clamps to maxScroll.
    expect(computeKeyScrollTarget("PageDown", 800, 2000, 1000)).toBe(1000);
  });

  it("returns null for unrecognised keys so they keep native behaviour", () => {
    expect(computeKeyScrollTarget("Tab", 0, 2000, 1000)).toBeNull();
    expect(computeKeyScrollTarget("a", 0, 2000, 1000)).toBeNull();
    expect(computeKeyScrollTarget(" ", 0, 2000, 1000)).toBeNull();
  });

  it("returns null when the content fits (nothing to scroll)", () => {
    expect(computeKeyScrollTarget("ArrowDown", 0, 500, 500)).toBeNull();
    expect(computeKeyScrollTarget("End", 0, 1000, 1000)).toBeNull();
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

function Harness({ resetKey, withChild }: { resetKey: string; withChild?: boolean }) {
  const { ref, onKeyDown } = useInspectorScroll<HTMLDivElement>(resetKey);
  return (
    <div data-testid="scroller" ref={ref} tabIndex={0} onKeyDown={onKeyDown}>
      {withChild ? (
        <button type="button" data-testid="child">
          copy
        </button>
      ) : null}
    </div>
  );
}

/** Give a jsdom element an overflowing layout so the scroll maths has room to move. */
function makeScrollable(el: HTMLElement, { scrollHeight = 2000, clientHeight = 1000 } = {}) {
  Object.defineProperty(el, "scrollHeight", { configurable: true, value: scrollHeight });
  Object.defineProperty(el, "clientHeight", { configurable: true, value: clientHeight });
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

describe("useInspectorScroll — keyboard scrolling", () => {
  it("routes ArrowDown to the inspector and prevents the page from scrolling", () => {
    const { getByTestId } = render(<Harness resetKey="researcher" />);
    const scroller = getByTestId("scroller");
    makeScrollable(scroller);
    scroller.scrollTop = 100;

    const event = createEvent.keyDown(scroller, { key: "ArrowDown" });
    fireEvent(scroller, event);

    expect(scroller.scrollTop).toBe(148);
    expect(event.defaultPrevented).toBe(true);
  });

  it("routes End/Home to the extremes of the region", () => {
    const { getByTestId } = render(<Harness resetKey="researcher" />);
    const scroller = getByTestId("scroller");
    makeScrollable(scroller);

    fireEvent.keyDown(scroller, { key: "End" });
    expect(scroller.scrollTop).toBe(1000);

    fireEvent.keyDown(scroller, { key: "Home" });
    expect(scroller.scrollTop).toBe(0);
  });

  it("prevents default at a boundary so the keypress does not chain to the page", () => {
    const { getByTestId } = render(<Harness resetKey="researcher" />);
    const scroller = getByTestId("scroller");
    makeScrollable(scroller);
    scroller.scrollTop = 0;

    const event = createEvent.keyDown(scroller, { key: "ArrowUp" });
    fireEvent(scroller, event);

    expect(scroller.scrollTop).toBe(0);
    expect(event.defaultPrevented).toBe(true);
  });

  it("ignores non-scroll keys so they keep native behaviour", () => {
    const { getByTestId } = render(<Harness resetKey="researcher" />);
    const scroller = getByTestId("scroller");
    makeScrollable(scroller);
    scroller.scrollTop = 300;

    const event = createEvent.keyDown(scroller, { key: "Tab" });
    fireEvent(scroller, event);

    expect(scroller.scrollTop).toBe(300);
    expect(event.defaultPrevented).toBe(false);
  });

  it("does not intercept scroll keys dispatched from an interactive descendant", () => {
    const { getByTestId } = render(<Harness resetKey="researcher" withChild />);
    const scroller = getByTestId("scroller");
    const child = getByTestId("child");
    makeScrollable(scroller);
    scroller.scrollTop = 100;

    // Bubbles up to the region's handler, but target !== currentTarget.
    const event = createEvent.keyDown(child, { key: "ArrowDown" });
    fireEvent(child, event);

    expect(scroller.scrollTop).toBe(100);
    expect(event.defaultPrevented).toBe(false);
  });

  it("does nothing when the content fits (no overflow to scroll)", () => {
    const { getByTestId } = render(<Harness resetKey="researcher" />);
    const scroller = getByTestId("scroller");
    makeScrollable(scroller, { scrollHeight: 500, clientHeight: 500 });
    scroller.scrollTop = 0;

    const event = createEvent.keyDown(scroller, { key: "ArrowDown" });
    fireEvent(scroller, event);

    expect(scroller.scrollTop).toBe(0);
    expect(event.defaultPrevented).toBe(false);
  });
});
