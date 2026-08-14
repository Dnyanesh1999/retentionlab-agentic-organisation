import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  MotionConfigProvider,
} from "./MotionConfigProvider";
import { useMotionConfig, useResolvedReducedMotion } from "./motionContext";
import { motionDuration, motionEase } from "./tokens";

function TokenProbe() {
  const config = useMotionConfig();
  const reduced = useResolvedReducedMotion();
  return (
    <div
      data-base-duration={config.duration.base}
      data-reduced={String(reduced)}
      data-stagger={config.stagger}
      data-standard-ease={config.ease.standard.join(",")}
      data-testid="probe"
    />
  );
}

function OverrideProbe({ override }: { override?: boolean }) {
  return <div data-resolved={String(useResolvedReducedMotion(override))} data-testid="probe" />;
}

describe("MotionConfigProvider", () => {
  it("exposes shared ease and duration tokens through context", () => {
    render(
      <MotionConfigProvider>
        <TokenProbe />
      </MotionConfigProvider>,
    );

    const probe = screen.getByTestId("probe");
    expect(probe).toHaveAttribute("data-base-duration", String(motionDuration.base));
    expect(probe).toHaveAttribute("data-standard-ease", motionEase.standard.join(","));
  });

  it("forces reduced motion on when the prop is set", () => {
    render(
      <MotionConfigProvider reducedMotion>
        <TokenProbe />
      </MotionConfigProvider>,
    );

    expect(screen.getByTestId("probe")).toHaveAttribute("data-reduced", "true");
  });

  it("does not let a component disable a parent reduced-motion decision", () => {
    render(
      <MotionConfigProvider reducedMotion>
        <OverrideProbe override={false} />
      </MotionConfigProvider>,
    );

    expect(screen.getByTestId("probe")).toHaveAttribute("data-resolved", "true");
  });

  it("defaults to no reduced motion with no provider or OS signal", () => {
    render(<OverrideProbe />);
    expect(screen.getByTestId("probe")).toHaveAttribute("data-resolved", "false");
  });
});
