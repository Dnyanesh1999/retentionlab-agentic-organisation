import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LoadingState } from "./LoadingState";

describe("Signal Garden loading state", () => {
  it("announces determinate progress without an infinite animation", () => {
    render(<LoadingState progress={37} reducedMotion={false} />);

    expect(screen.getByRole("heading", { name: "Preparing your signal garden..." })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Loading signal garden, please wait" })).toHaveAttribute(
      "aria-valuetext",
      "Preparing your signal garden, 37 percent",
    );
  });

  it("replaces the progress treatment with the specified reduced-motion fallback", () => {
    render(<LoadingState progress={37} reducedMotion />);

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading...");
  });

  it("bounds invalid progress values before exposing them to assistive technology", () => {
    const { rerender } = render(<LoadingState progress={140} reducedMotion={false} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");

    rerender(<LoadingState progress={-10} reducedMotion={false} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  });
});
