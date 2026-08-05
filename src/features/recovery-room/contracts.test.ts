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
});
