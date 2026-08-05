import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { SupportCase } from "./contracts";
import { SupportCaseStrand } from "./SupportCaseStrand";

// Sentinel fixtures only. None of these values (reference, sentiment, date) are
// the Copper Finch example data from the design spec; they exist purely to
// exercise the component's prop-sourced rendering.
function makeSupportCase(overrides: Partial<SupportCase> = {}): SupportCase {
  return {
    reference: "sentinel:support:alpha:7-3",
    category: "workflow",
    severity: "medium",
    status: "open",
    sentiment_score: -0.481,
    unresolved_at: "2026-05-11T09:30:00.000Z",
    evidence: {
      evidence_key: "sentinel:support:alpha:7-3",
      source_system: "sentinel-support",
      source_tool: "sentinel-tool",
      retrieved_at: "2026-05-11T10:00:00.000Z",
    },
    ...overrides,
  };
}

/** Controlled host mirroring how a parent owns the `expanded` prop. */
function ControlledStrand({
  supportCase,
  reducedMotion,
  onChange,
  initialExpanded = false,
}: {
  supportCase: SupportCase;
  reducedMotion?: boolean;
  onChange?: (expanded: boolean) => void;
  initialExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(initialExpanded);
  return (
    <SupportCaseStrand
      supportCase={supportCase}
      expanded={expanded}
      reducedMotion={reducedMotion}
      onExpandedChange={(next) => {
        onChange?.(next);
        setExpanded(next);
      }}
    />
  );
}

describe("SupportCaseStrand", () => {
  describe("collapsed summary", () => {
    it("renders a factual severity-bound summary and no detail while collapsed", () => {
      render(
        <SupportCaseStrand
          supportCase={makeSupportCase()}
          expanded={false}
          onExpandedChange={vi.fn()}
        />,
      );

      expect(
        screen.getByText("One open medium-severity workflow support case"),
      ).toBeInTheDocument();
      // Detail fields never leak while collapsed.
      expect(screen.queryByText(/Case reference:/)).not.toBeInTheDocument();
      expect(screen.queryByText("sentinel:support:alpha:7-3")).not.toBeInTheDocument();
      expect(screen.queryByText(/Unresolved as of/)).not.toBeInTheDocument();
    });

    it("derives the severity word from the live value rather than hardcoding it", () => {
      render(
        <SupportCaseStrand
          supportCase={makeSupportCase({ severity: "high" })}
          expanded={false}
          onExpandedChange={vi.fn()}
        />,
      );

      expect(
        screen.getByText("One open high-severity workflow support case"),
      ).toBeInTheDocument();
    });
  });

  describe("semantics and accessibility", () => {
    it("uses a native button trigger whose aria-expanded reflects the prop", () => {
      const { rerender } = render(
        <SupportCaseStrand
          supportCase={makeSupportCase()}
          expanded={false}
          onExpandedChange={vi.fn()}
        />,
      );

      const trigger = screen.getByRole("button");
      expect(trigger.tagName).toBe("BUTTON");
      expect(trigger).toHaveAttribute("type", "button");
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(trigger).toHaveAttribute("aria-controls");
      expect(trigger).not.toHaveAttribute("aria-describedby");

      rerender(
        <SupportCaseStrand supportCase={makeSupportCase()} expanded onExpandedChange={vi.fn()} />,
      );
      expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
    });

    it("reveals the exact reference, unresolved date and citation linked by aria-describedby when expanded", () => {
      const supportCase = makeSupportCase({
        reference: "sentinel:support:beta:9-1",
        evidence: { ...makeSupportCase().evidence, evidence_key: "sentinel:support:beta:9-1" },
      });
      render(<SupportCaseStrand supportCase={supportCase} expanded onExpandedChange={vi.fn()} />);

      // The exact case reference and unresolved date are shown from evidence.
      expect(screen.getByText("Case reference:")).toBeInTheDocument();
      expect(screen.getByText("Unresolved as of 2026-05-11")).toBeInTheDocument();

      const trigger = screen.getByRole("button");

      // aria-describedby must point at the citation element carrying the key.
      // (useId emits colon-bearing ids, so resolve via getElementById, not a selector.)
      const describedById = trigger.getAttribute("aria-describedby");
      expect(describedById).toBeTruthy();
      const citation = document.getElementById(describedById as string);
      expect(citation).toHaveTextContent("sentinel:support:beta:9-1");

      // aria-controls must point at the revealed detail container wrapping the citation.
      const controlsId = trigger.getAttribute("aria-controls");
      expect(controlsId).toBeTruthy();
      expect(document.getElementById(controlsId as string)).toContainElement(citation);
    });
  });

  describe("sentiment labelling", () => {
    it("appends the factual 'negative' label only when the sentiment is negative", () => {
      render(
        <SupportCaseStrand
          supportCase={makeSupportCase({ sentiment_score: -0.267 })}
          expanded
          onExpandedChange={vi.fn()}
        />,
      );

      expect(screen.getByText("-0.267")).toBeInTheDocument();
      expect(screen.getByText("(negative)")).toBeInTheDocument();
    });

    it("omits the 'negative' label for a non-negative sentiment", () => {
      render(
        <SupportCaseStrand
          supportCase={makeSupportCase({ sentiment_score: 0.42 })}
          expanded
          onExpandedChange={vi.fn()}
        />,
      );

      expect(screen.getByText("0.42")).toBeInTheDocument();
      expect(screen.queryByText("(negative)")).not.toBeInTheDocument();
    });
  });

  describe("interaction", () => {
    it("requests expansion on pointer click without duplicate callbacks", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<ControlledStrand supportCase={makeSupportCase()} onChange={onChange} />);

      await user.click(screen.getByRole("button"));

      // Focus (on pointer down) and click both request `true`, but the guard
      // collapses that to a single callback for the already-requested state.
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(true);
    });

    it("requests expansion when the trigger receives focus", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<ControlledStrand supportCase={makeSupportCase()} onChange={onChange} />);

      await user.tab();

      expect(screen.getByRole("button")).toHaveFocus();
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(true);
    });

    it("does not re-request expansion when already expanded", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <ControlledStrand supportCase={makeSupportCase()} onChange={onChange} initialExpanded />,
      );

      const trigger = screen.getByRole("button");
      trigger.focus();
      await user.click(trigger);

      expect(onChange).not.toHaveBeenCalled();
    });

    it("activates via Enter and Space, and collapses on Escape with focus retained", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<ControlledStrand supportCase={makeSupportCase()} onChange={onChange} />);

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
    it("reflects reduced motion and severity as class/data attributes only", () => {
      const { container } = render(
        <SupportCaseStrand
          supportCase={makeSupportCase({ severity: "critical" })}
          expanded={false}
          reducedMotion
          onExpandedChange={vi.fn()}
        />,
      );

      const root = container.querySelector(".support-case-strand");
      expect(root).toHaveAttribute("data-reduced-motion", "true");
      expect(root).toHaveClass("support-case-strand--reduced-motion");
      expect(root).toHaveAttribute("data-severity", "critical");
    });

    it("collapses the detail when rerendered from expanded to collapsed (stays controlled)", () => {
      const { rerender } = render(
        <SupportCaseStrand supportCase={makeSupportCase()} expanded onExpandedChange={vi.fn()} />,
      );
      expect(screen.getByText(/Unresolved as of/)).toBeInTheDocument();

      rerender(
        <SupportCaseStrand
          supportCase={makeSupportCase()}
          expanded={false}
          onExpandedChange={vi.fn()}
        />,
      );
      expect(screen.queryByText(/Unresolved as of/)).not.toBeInTheDocument();
      expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");
    });
  });
});
