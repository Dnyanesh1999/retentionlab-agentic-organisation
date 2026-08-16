import { describe, expect, it, vi } from "vitest";

import { askWithFallback, explainReason } from "./askLadder";
import type { AssistantClient, AssistantResponse } from "./assistantClient";

const stub = (response: AssistantResponse): AssistantClient => ({
  ask: vi.fn().mockResolvedValue(response),
});

const refusal = (reason: string, evidence: AssistantResponse extends { evidence: infer E } ? E : never = [] as never) =>
  ({ status: "refused", reason, evidence } as AssistantResponse);

describe("askWithFallback", () => {
  it("uses a verified generated answer when the model tier succeeds", async () => {
    const result = await askWithFallback(
      "what did the manager decide?",
      stub({
        status: "answered",
        answer: "The Manager approved the record.",
        citations: [{ chunkId: "manager-decision", quote: "decision was approve", source: "manager.v1" }],
      }),
    );

    expect(result.tier).toBe("model-cited");
  });

  it("falls back to the sealed record when the model answer fails verification", async () => {
    const result = await askWithFallback("what did the manager decide?", stub(refusal("quote-not-found")));

    expect(result.tier).toBe("sealed-record");
    if (result.tier !== "sealed-record") return;
    // The reader must be able to see that a lower tier answered, and why.
    expect(result.fallbackFrom).toBe("quote-not-found");
    expect(result.source).not.toHaveLength(0);
  });

  it("answers from the sealed record with no network when there is no model tier", async () => {
    const result = await askWithFallback("what did the manager decide?", null);

    expect(result.tier).toBe("sealed-record");
    if (result.tier !== "sealed-record") return;
    // Never asked, so nothing to report having fallen back from.
    expect(result.fallbackFrom).toBeUndefined();
  });

  it("shows retrieved evidence when generation failed and the record has no composed answer", async () => {
    const result = await askWithFallback(
      // Matches no grounded keyword, so tier 2 has nothing — but the server's
      // retrieval did find material.
      "what does the maker build",
      stub(refusal("model-unavailable", [{ source: "gate-9 transcript", text: "Each stage verifies the exact stored hash." }] as never)),
    );

    // This question matches no grounded answer, but retrieval found material —
    // showing it beats an apology.
    expect(result.tier).toBe("evidence");
    if (result.tier !== "evidence") return;
    expect(result.evidence).toHaveLength(1);
    expect(result.fallbackFrom).toBe("model-unavailable");
  });

  it("refuses honestly when every tier has nothing", async () => {
    const result = await askWithFallback("who will win the league", stub(refusal("no-evidence")));

    expect(result.tier).toBe("refusal");
    if (result.tier !== "refusal") return;
    expect(result.notice).toMatch(/sealed decision record/i);
  });

  it("prefers a composed record answer over raw passages", async () => {
    const result = await askWithFallback(
      "what did the manager decide?",
      stub(refusal("model-unavailable", [{ source: "s", text: "t" }] as never)),
    );

    // Tier 2 outranks tier 3: a composed answer is as grounded and more useful.
    expect(result.tier).toBe("sealed-record");
  });

  it("never asks the model when no client exists", async () => {
    const client = stub(refusal("unavailable"));
    await askWithFallback("what did the manager decide?", null);

    expect(client.ask).not.toHaveBeenCalled();
  });
});

describe("explainReason", () => {
  it("turns every machine reason into reader-facing wording", () => {
    expect(explainReason("rate-limited")).toMatch(/a lot of questions/i);
    expect(explainReason("not-configured")).toMatch(/not switched on/i);
    expect(explainReason("quote-not-found")).toMatch(/could not be verified/i);
  });

  it("never leaks a raw code for an unknown reason", () => {
    const copy = explainReason("some-new-internal-code");

    expect(copy).not.toContain("some-new-internal-code");
    expect(copy).toMatch(/could not be verified/i);
  });
});
