import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AcknowledgmentBanner, acknowledgmentMessage } from "./AcknowledgmentBanner";

afterEach(() => vi.useRealTimers());

describe("AcknowledgmentBanner", () => {
  it("announces the exact agency-preserving copy without another action", () => {
    render(
      <AcknowledgmentBanner outcome="shared" onExpired={vi.fn()} reducedMotion />,
    );

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("data-outcome", "shared");
    expect(status).toHaveTextContent(acknowledgmentMessage);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("expires after five seconds when motion is allowed", () => {
    vi.useFakeTimers();
    const onExpired = vi.fn();
    render(
      <AcknowledgmentBanner outcome="declined" onExpired={onExpired} reducedMotion={false} />,
    );

    act(() => vi.advanceTimersByTime(4_999));
    expect(onExpired).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it("remains as a static state when reduced motion is preferred", () => {
    vi.useFakeTimers();
    const onExpired = vi.fn();
    render(
      <AcknowledgmentBanner outcome="inspected" onExpired={onExpired} reducedMotion />,
    );

    act(() => vi.advanceTimersByTime(20_000));
    expect(onExpired).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveAttribute("data-reduced-motion", "true");
  });
});
