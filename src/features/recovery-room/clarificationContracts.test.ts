import { describe, expect, it } from "vitest";

import {
  clarificationObservationMaxLength,
  decodeClarificationReceipt,
  decodeClarificationSubmission,
  normalizeObservation,
} from "./clarificationContracts";

const validSubmission = {
  schema_version: "clarification-submission.v1",
  account_slug: "adapter-test",
  support_evidence_key: "support:adapter-test:2-1",
  preference_evidence_key: "preference:adapter-test:2",
  observation: null,
  consent: {
    action: "share_observation",
    copy_version: "clarification-consent.v1",
  },
};

describe("clarification contracts", () => {
  it("accepts an explicit consent event when the optional observation is empty", () => {
    expect(decodeClarificationSubmission(validSubmission)).toEqual(validSubmission);
    expect(normalizeObservation("  \n ")).toBeNull();
  });

  it("trims a supplied observation without altering its internal wording", () => {
    expect(normalizeObservation("  The export step feels stuck.  ")).toBe(
      "The export step feels stuck.",
    );
  });

  it("rejects evidence from a different account and unexpected fields", () => {
    expect(() => decodeClarificationSubmission({
      ...validSubmission,
      support_evidence_key: "support:other-account:2-1",
    })).toThrow();
    expect(() => decodeClarificationSubmission({ ...validSubmission, inferred_cause: "training" })).toThrow();
  });

  it("rejects observations outside the purpose-limited bound", () => {
    expect(() => decodeClarificationSubmission({
      ...validSubmission,
      observation: "x".repeat(clarificationObservationMaxLength + 1),
    })).toThrow();
  });

  it("strictly decodes a minimal receipt that never echoes the observation", () => {
    const receipt = {
      schema_version: "clarification-receipt.v1",
      submission_id: "7406f0f5-99a7-4168-bc1f-6209869a1a29",
      accepted_at: "2026-08-06T08:00:00.000Z",
      replayed: false,
    };

    expect(decodeClarificationReceipt(receipt)).toEqual(receipt);
    expect(() => decodeClarificationReceipt({ ...receipt, observation: "echoed" })).toThrow();
  });
});
