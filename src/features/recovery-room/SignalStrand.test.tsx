import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { SignalReading } from "./contracts";
import { SignalStrand } from "./SignalStrand";

// Sentinel fixtures only. None of these numbers or evidence keys appear in the
// design spec / Copper Finch example data — they exist purely to exercise the
// component's prop-sourced rendering.
function makeReading(overrides: Partial<SignalReading> = {}): SignalReading {
  return {
    code: "feature_adoption",
    current_value: 12.5,
    previous_value: 63.5,
    unit: "percent",
    evidence: {
      evidence_key: "sentinel:alpha:strand:9",
      source_system: "sentinel-system",
      source_tool: "sentinel-tool",
      retrieved_at: "2020-01-02T03:04:05.000Z",
    },
    ...overrides,
  };
}

/** Controlled host mirroring how a parent owns the `expanded` prop. */
function ControlledStrand({
  reading,
  reducedMotion,
  onChange,
  initialExpanded = false,
}: {
  reading: SignalReading;
  reducedMotion?: boolean;
  onChange?: (expanded: boolean) => void;
  initialExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(initialExpanded);
  return (
    <SignalStrand
      reading={reading}
      expanded={expanded}
      reducedMotion={reducedMotion}
      onExpandedChange={(next) => {
        onChange?.(next);
        setExpanded(next);
      }}
    />
  );
}

describe("SignalStrand", () => {
  describe("value formatting", () => {
    it("formats percent readings with a % suffix", () => {
      render(
        <SignalStrand
          reading={makeReading({ unit: "percent", previous_value: 63.5, current_value: 12.5 })}
          expanded={false}
          onExpandedChange={vi.fn()}
        />,
      );

      expect(screen.getByText("Feature adoption")).toBeInTheDocument();
      expect(screen.getByText("63.5%")).toBeInTheDocument();
      expect(screen.getByText("12.5%")).toBeInTheDocument();
    });

    it("formats count readings as a locale-safe whole number", () => {
      render(
        <SignalStrand
          reading={makeReading({
            code: "active_users",
            unit: "count",
            previous_value: 96,
            current_value: 128,
          })}
          expanded={false}
          onExpandedChange={vi.fn()}
        />,
      );

      expect(screen.getByText("Active users")).toBeInTheDocument();
      expect(screen.getByText("96")).toBeInTheDocument();
      expect(screen.getByText("128")).toBeInTheDocument();
      // No percent or frequency suffix leaks into a count value.
      expect(screen.queryByText(/128%/)).not.toBeInTheDocument();
      expect(screen.queryByText(/128 sessions\/user/)).not.toBeInTheDocument();
    });

    it("formats frequency readings with an explicit sessions/user suffix", () => {
      render(
        <SignalStrand
          reading={makeReading({
            code: "session_frequency",
            unit: "frequency",
            previous_value: 6.4,
            current_value: 8.1,
          })}
          expanded={false}
          onExpandedChange={vi.fn()}
        />,
      );

      expect(screen.getByText("Session frequency")).toBeInTheDocument();
      expect(screen.getByText("6.4 sessions/user")).toBeInTheDocument();
      expect(screen.getByText("8.1 sessions/user")).toBeInTheDocument();
    });
  });

  describe("semantics and accessibility", () => {
    // The accessible name now carries the relative change too, because the change is rendered
    // visibly beside the direction word. Leaving it out would give a screen-reader user strictly
    // less than a sighted reader gets from the same row.
    it("exposes the strand graphic as role=img describing label, previous, current and the change", () => {
      render(
        <SignalStrand
          reading={makeReading({ unit: "percent", previous_value: 63.5, current_value: 12.5 })}
          expanded={false}
          onExpandedChange={vi.fn()}
        />,
      );

      expect(screen.getByRole("img")).toHaveAccessibleName(
        "Feature adoption: previous 63.5%, current 12.5%, decreased −80.3%",
      );
    });

    it("omits the change from the name when the previous value is zero", () => {
      // A change from zero has no defined percentage; the row must say nothing rather than invent one.
      render(
        <SignalStrand
          reading={makeReading({ unit: "count", previous_value: 0, current_value: 12 })}
          expanded={false}
          onExpandedChange={vi.fn()}
        />,
      );

      expect(screen.getByRole("img")).toHaveAccessibleName("Feature adoption: previous 0, current 12");
    });

    it("uses a native button trigger with aria-expanded reflecting the prop", () => {
      const { rerender } = render(
        <SignalStrand reading={makeReading()} expanded={false} onExpandedChange={vi.fn()} />,
      );

      const trigger = screen.getByRole("button");
      expect(trigger.tagName).toBe("BUTTON");
      expect(trigger).toHaveAttribute("type", "button");
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(trigger).toHaveAttribute("aria-controls");
      expect(trigger).not.toHaveAttribute("aria-describedby");

      rerender(
        <SignalStrand reading={makeReading()} expanded onExpandedChange={vi.fn()} />,
      );
      expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
    });

    it("does not render the detail or citation while collapsed", () => {
      render(
        <SignalStrand reading={makeReading()} expanded={false} onExpandedChange={vi.fn()} />,
      );

      expect(
        screen.queryByText(
          "This shows change over the last 30 days. Values come from your account snapshot.",
        ),
      ).not.toBeInTheDocument();
      expect(screen.queryByText("sentinel:alpha:strand:9")).not.toBeInTheDocument();
    });

    it("reveals the approved sentence and prop-sourced citation linked by aria-describedby when expanded", () => {
      const reading = makeReading({ evidence: { ...makeReading().evidence, evidence_key: "sentinel:beta:strand:42" } });
      render(<SignalStrand reading={reading} expanded onExpandedChange={vi.fn()} />);

      expect(
        screen.getByText(
          "This shows change over the last 30 days. Values come from your account snapshot.",
        ),
      ).toBeInTheDocument();

      const trigger = screen.getByRole("button");
      const citation = screen.getByText("sentinel:beta:strand:42");

      // aria-describedby must point at the visible citation element.
      // (useId emits colon-bearing ids, so resolve via getElementById, not a selector.)
      const describedById = trigger.getAttribute("aria-describedby");
      expect(describedById).toBeTruthy();
      expect(document.getElementById(describedById as string)).toContainElement(citation);

      // aria-controls must point at the revealed detail container.
      const controlsId = trigger.getAttribute("aria-controls");
      expect(controlsId).toBeTruthy();
      expect(document.getElementById(controlsId as string)).toContainElement(citation);
    });
  });

  describe("interaction", () => {
    it("requests expansion on pointer click without duplicate callbacks", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<ControlledStrand reading={makeReading()} onChange={onChange} />);

      await user.click(screen.getByRole("button"));

      // Focus (on pointer down) and click both request `true`, but the guard
      // collapses that to a single callback for the already-requested state.
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(true);
    });

    it("requests expansion when the trigger receives focus", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<ControlledStrand reading={makeReading()} onChange={onChange} />);

      await user.tab();

      expect(screen.getByRole("button")).toHaveFocus();
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(true);
    });

    it("does not re-request expansion when already expanded", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <ControlledStrand reading={makeReading()} onChange={onChange} initialExpanded />,
      );

      const trigger = screen.getByRole("button");
      trigger.focus();
      await user.click(trigger);

      expect(onChange).not.toHaveBeenCalled();
    });

    it("activates via Enter and Space through native button semantics, and collapses on Escape with focus retained", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<ControlledStrand reading={makeReading()} onChange={onChange} />);

      const trigger = screen.getByRole("button");

      // Focus expands.
      await user.tab();
      expect(trigger).toHaveFocus();
      expect(trigger).toHaveAttribute("aria-expanded", "true");

      // Escape while focused collapses and keeps focus on the trigger.
      await user.keyboard("{Escape}");
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(trigger).toHaveFocus();

      // Enter re-expands through native button activation (focus never left).
      await user.keyboard("{Enter}");
      expect(trigger).toHaveAttribute("aria-expanded", "true");

      // Escape again, then Space re-expands.
      await user.keyboard("{Escape}");
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      await user.keyboard(" ");
      expect(trigger).toHaveAttribute("aria-expanded", "true");

      expect(onChange.mock.calls).toEqual([[true], [false], [true], [false], [true]]);
    });
  });

  describe("presentation markers", () => {
    it("reflects reduced motion as a class and data attribute only", () => {
      const { container, rerender } = render(
        <SignalStrand reading={makeReading()} expanded={false} reducedMotion onExpandedChange={vi.fn()} />,
      );

      const root = container.querySelector(".signal-strand");
      expect(root).toHaveAttribute("data-reduced-motion", "true");
      expect(root).toHaveClass("signal-strand--reduced-motion");

      rerender(
        <SignalStrand
          reading={makeReading()}
          expanded={false}
          reducedMotion={false}
          onExpandedChange={vi.fn()}
        />,
      );
      expect(container.querySelector(".signal-strand")).toHaveAttribute(
        "data-reduced-motion",
        "false",
      );
      expect(container.querySelector(".signal-strand")).not.toHaveClass(
        "signal-strand--reduced-motion",
      );
    });

    it("collapses the detail when rerendered from expanded to collapsed (stays controlled)", () => {
      const { rerender } = render(
        <SignalStrand reading={makeReading()} expanded onExpandedChange={vi.fn()} />,
      );
      expect(
        screen.getByText(
          "This shows change over the last 30 days. Values come from your account snapshot.",
        ),
      ).toBeInTheDocument();

      rerender(
        <SignalStrand reading={makeReading()} expanded={false} onExpandedChange={vi.fn()} />,
      );
      expect(
        screen.queryByText(
          "This shows change over the last 30 days. Values come from your account snapshot.",
        ),
      ).not.toBeInTheDocument();
      expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");
    });
  });
});
