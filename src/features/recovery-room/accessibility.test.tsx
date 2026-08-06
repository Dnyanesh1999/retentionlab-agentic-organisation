import axe from "axe-core";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AcknowledgmentBanner } from "./AcknowledgmentBanner";
import { ClarificationDialog } from "./ClarificationDialog";
import { decodeSignalGardenSnapshot } from "./contracts";
import { SignalCanvas } from "./SignalCanvas";

const retrievedAt = "2026-07-02T10:00:00.000Z";
const evidence = (evidenceKey: string) => ({
  evidence_key: evidenceKey,
  source_system: "accessibility-test",
  source_tool: "accessibility-test",
  retrieved_at: retrievedAt,
});

const snapshot = decodeSignalGardenSnapshot({
  schema_version: "signal-garden-snapshot.v1",
  account_slug: "accessibility-sentinel",
  retrieved_at: retrievedAt,
  signals: [
    {
      code: "feature_adoption",
      current_value: 31,
      previous_value: 42,
      unit: "percent",
      evidence: evidence("sentinel:a11y:adoption"),
    },
    {
      code: "active_users",
      current_value: 88,
      previous_value: 95,
      unit: "count",
      evidence: evidence("sentinel:a11y:users"),
    },
    {
      code: "session_frequency",
      current_value: 5.2,
      previous_value: 4.1,
      unit: "frequency",
      evidence: evidence("sentinel:a11y:frequency"),
    },
  ],
  seat_utilisation: {
    current_value: 69,
    unit: "percent",
    evidence: evidence("sentinel:a11y:seats"),
  },
  support_case: {
    reference: "sentinel:a11y:support",
    category: "workflow",
    severity: "medium",
    status: "open",
    sentiment_score: -0.2,
    unresolved_at: retrievedAt,
    evidence: evidence("sentinel:a11y:support"),
  },
  clarification_permission: {
    allow_recovery_outreach: true,
    evidence: evidence("sentinel:a11y:preference"),
  },
});

async function expectNoAxeViolations(container: HTMLElement) {
  const results = await axe.run(container, {
    rules: {
      // JSDOM cannot calculate painted foreground/background contrast. Real
      // browser contrast is measured separately in the Slice 5 QA pass.
      "color-contrast": { enabled: false },
    },
  });
  expect(results.violations).toEqual([]);
}

describe("Recovery Room automated accessibility", () => {
  it("has no axe-detectable violations in the live-ready canvas", async () => {
    const { container } = render(<SignalCanvas snapshot={snapshot} reducedMotion />);
    await expectNoAxeViolations(container);
  });

  it("has no axe-detectable violations in the modal error state", async () => {
    const { container } = render(
      <ClarificationDialog
        observation="A preserved draft"
        onDismiss={vi.fn()}
        onObservationChange={vi.fn()}
        onShare={vi.fn()}
        open
        reducedMotion
        submitError="Observation not shared. Your text is still here."
      />,
    );
    await expectNoAxeViolations(container);
  });

  it("has no axe-detectable violations in the static acknowledgment state", async () => {
    const { container } = render(
      <AcknowledgmentBanner outcome="declined" onExpired={vi.fn()} reducedMotion />,
    );
    await expectNoAxeViolations(container);
  });
});
