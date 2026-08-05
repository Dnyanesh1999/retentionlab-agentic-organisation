import { describe, expect, it } from "vitest";

import { decodeSignalGardenSnapshot } from "./contracts";

const retrievedAt = "2026-08-05T20:00:00.000Z";

function evidence(evidenceKey: string) {
  return {
    evidence_key: evidenceKey,
    source_system: "contract-test-source",
    source_tool: "contract_test",
    retrieved_at: retrievedAt,
  };
}

function validSnapshot() {
  return {
    schema_version: "signal-garden-snapshot.v1",
    account_slug: "contract-test-account",
    retrieved_at: retrievedAt,
    signals: [
      { code: "feature_adoption", current_value: 12.3, previous_value: 45.6, unit: "percent", evidence: evidence("test:feature") },
      { code: "active_users", current_value: 17, previous_value: 23, unit: "count", evidence: evidence("test:users") },
      { code: "session_frequency", current_value: 6.7, previous_value: 5.4, unit: "frequency", evidence: evidence("test:sessions") },
    ],
    seat_utilisation: {
      current_value: 64.2,
      unit: "percent",
      evidence: evidence("test:seats"),
    },
    support_case: {
      reference: "test:support:5-2",
      category: "workflow",
      severity: "medium",
      status: "open",
      sentiment_score: -0.481,
      unresolved_at: retrievedAt,
      evidence: evidence("test:support:5-2"),
    },
    clarification_permission: {
      allow_recovery_outreach: true,
      evidence: evidence("test:preference"),
    },
  };
}

describe("Signal Garden snapshot contract", () => {
  it("accepts a complete typed payload without substituting design values", () => {
    const result = decodeSignalGardenSnapshot(validSnapshot());

    expect(result.signals.map(({ current_value }) => current_value)).toEqual([12.3, 17, 6.7]);
    expect(result.seat_utilisation.current_value).toBe(64.2);
  });

  it("rejects a missing or duplicated required aggregate signal", () => {
    const candidate = validSnapshot();
    candidate.signals[2] = { ...candidate.signals[1]! };

    expect(() => decodeSignalGardenSnapshot(candidate)).toThrow(/Missing required aggregate signal: session_frequency/);
    expect(() => decodeSignalGardenSnapshot(candidate)).toThrow(/duplicate aggregate signals/);
  });

  it("rejects malformed evidence lineage instead of manufacturing a fallback", () => {
    const candidate = validSnapshot();
    candidate.signals[0]!.evidence.retrieved_at = "not-a-timestamp";

    expect(() => decodeSignalGardenSnapshot(candidate)).toThrow();
  });

  it("accepts an evidence-bound open workflow support case and clarification permission", () => {
    const result = decodeSignalGardenSnapshot(validSnapshot());

    expect(result.support_case.reference).toBe("test:support:5-2");
    expect(result.support_case.severity).toBe("medium");
    expect(result.support_case.status).toBe("open");
    expect(result.support_case.sentiment_score).toBe(-0.481);
    expect(result.support_case.evidence.evidence_key).toBe("test:support:5-2");
    expect(result.clarification_permission.allow_recovery_outreach).toBe(true);
    expect(result.clarification_permission.evidence.evidence_key).toBe("test:preference");
  });

  it("rejects a support case whose reference does not match its bound evidence key", () => {
    const candidate = validSnapshot();
    candidate.support_case.evidence.evidence_key = "test:support:different";

    expect(() => decodeSignalGardenSnapshot(candidate)).toThrow(
      /reference must match its bound evidence key/,
    );
  });

  it("fails closed on a support case outside the open workflow domain", () => {
    const wrongDomain = validSnapshot();
    wrongDomain.support_case.category = "billing";
    expect(() => decodeSignalGardenSnapshot(wrongDomain)).toThrow();

    const wrongStatus = validSnapshot();
    wrongStatus.support_case.status = "resolved";
    expect(() => decodeSignalGardenSnapshot(wrongStatus)).toThrow();

    const wrongSeverity = validSnapshot();
    wrongSeverity.support_case.severity = "urgent";
    expect(() => decodeSignalGardenSnapshot(wrongSeverity)).toThrow();
  });

  it("rejects malformed support case evidence and out-of-range sentiment", () => {
    const malformedEvidence = validSnapshot();
    malformedEvidence.support_case.evidence.retrieved_at = "not-a-timestamp";
    expect(() => decodeSignalGardenSnapshot(malformedEvidence)).toThrow();

    const outOfRange = validSnapshot();
    outOfRange.support_case.sentiment_score = -4.2;
    expect(() => decodeSignalGardenSnapshot(outOfRange)).toThrow();
  });

  it("requires the minimum clarification permission boolean to be present and typed", () => {
    const missingBoolean = validSnapshot() as Record<string, unknown>;
    delete (missingBoolean.clarification_permission as Record<string, unknown>)
      .allow_recovery_outreach;

    expect(() => decodeSignalGardenSnapshot(missingBoolean)).toThrow();
  });
});
