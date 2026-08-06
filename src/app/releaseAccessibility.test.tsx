import axe from "axe-core";
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { App } from "./App";

// Whole-application accessibility sweep for the Gate 10 release gate. Each of
// the public hash routes is rendered through the real <App/> shell and checked
// with axe-core. Colour contrast is measured separately in a real browser
// during manual QA (jsdom cannot compute painted contrast), so that one rule is
// disabled here — every other WCAG rule axe ships must pass.
async function expectNoAxeViolations(container: HTMLElement) {
  const results = await axe.run(container, {
    rules: { "color-contrast": { enabled: false } },
  });
  const summary = results.violations.map((violation) => ({
    id: violation.id,
    nodes: violation.nodes.length,
  }));
  expect(summary).toEqual([]);
}

function renderRoute(path: string) {
  window.history.replaceState(null, "", `#${path}`);
  return render(<App />);
}

const ROUTES = ["/cases/organisation", "/portfolio", "/governance"];

afterEach(() => {
  window.history.replaceState(null, "", "#/cases/organisation");
});

describe("Gate 10 whole-application accessibility", () => {
  it.each(ROUTES)("renders %s with no axe-detectable violations", async (route) => {
    const { container } = renderRoute(route);
    await expectNoAxeViolations(container);
  });

  it("exposes a skip link that targets the main landmark", () => {
    const { container } = renderRoute("/cases/organisation");
    const skip = container.querySelector("a.skip-link");
    expect(skip?.getAttribute("href")).toBe("#main-content");
    expect(container.querySelector("#main-content")).not.toBeNull();
  });
});
