import { describe, expect, it } from "vitest";

import {
  ASSISTANT_LIMITS,
  isQuestionAcceptable,
  retrieveChunks,
  validateModelReply,
  type CorpusChunk,
} from "./contracts";

const chunks: CorpusChunk[] = [
  {
    id: "manager-decision",
    source: "manager.operational-decision.v1",
    text: "The Manager decision was approve. Autonomous external actions remained false and human approval was required before any next action.",
    keywords: ["manager", "decision", "approve"],
  },
  {
    id: "consent",
    source: "researcher.research-brief.v1 · consent_boundaries",
    text: "The sealed consent boundary allows the email channel only. No message was sent.",
    keywords: ["consent", "email", "channel", "contact"],
  },
];

function reply(overrides: Record<string, unknown> = {}) {
  return {
    answer: "The Manager approved the record and left the next action to a human.",
    sufficient: true,
    citations: [
      { chunk_id: "manager-decision", quote: "Autonomous external actions remained false" },
    ],
    ...overrides,
  };
}

describe("validateModelReply", () => {
  it("accepts an answer whose every quote genuinely occurs in a cited chunk", () => {
    const result = validateModelReply(reply(), chunks);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0].source).toBe("manager.operational-decision.v1");
  });

  it("rejects a fabricated quote that reads plausibly but is not in the chunk", () => {
    // The single most important case: the model invents a sentence in the
    // register of the record. Nothing about it is detectable from style.
    const result = validateModelReply(
      reply({
        citations: [
          { chunk_id: "manager-decision", quote: "The Manager authorised an automatic follow-up email" },
        ],
      }),
      chunks,
    );

    expect(result).toEqual({ ok: false, reason: "quote-not-found" });
  });

  it("rejects an unoffered id whose quote appears in no offered passage", () => {
    // A quote that does exist in offered material is recovered instead — see
    // the mislabelled-citations suite below. What can never be recovered is a
    // quote that is nowhere in what was sent.
    const result = validateModelReply(
      reply({
        citations: [
          { chunk_id: "private-artefact", quote: "the private artefact was released to the browser" },
        ],
      }),
      chunks,
    );

    expect(result).toEqual({ ok: false, reason: "unknown-chunk" });
  });

  it("rejects a chunk that exists in the corpus but was not sent this time", () => {
    // Validation must run against what was actually offered, not the whole
    // corpus, or the model could cite a passage it never saw.
    const result = validateModelReply(
      reply({ citations: [{ chunk_id: "consent", quote: "allows the email channel only" }] }),
      [chunks[0]],
    );

    expect(result).toEqual({ ok: false, reason: "unknown-chunk" });
  });

  it("rejects an uncited answer outright rather than showing it unlabelled", () => {
    expect(validateModelReply(reply({ citations: [] }), chunks)).toEqual({
      ok: false,
      reason: "no-citations",
    });
  });

  it("treats the model's own admission of insufficiency as a refusal", () => {
    expect(validateModelReply(reply({ sufficient: false }), chunks)).toEqual({
      ok: false,
      reason: "insufficient",
    });
  });

  it("rejects a quote too short to prove anything", () => {
    // "The" occurs in almost any chunk; a substring check on it would be
    // meaningless as a fabrication guard.
    expect(validateModelReply(reply({ citations: [{ chunk_id: "manager-decision", quote: "The" }] }), chunks))
      .toEqual({ ok: false, reason: "quote-too-short" });
  });

  it("refuses to print a full digest the model must have invented", () => {
    const digest = "d253e409ec1984b5f316e831e85637d77dd0900aaf55e0f342753af21494e605";
    const result = validateModelReply(reply({ answer: `The Manager artefact is ${digest}.` }), chunks);

    expect(result).toEqual({ ok: false, reason: "leaked-digest" });
  });

  it("rejects anything that does not match the shape at all", () => {
    expect(validateModelReply("I cannot answer", chunks)).toEqual({ ok: false, reason: "malformed" });
    expect(validateModelReply(null, chunks)).toEqual({ ok: false, reason: "malformed" });
    expect(validateModelReply({ answer: 1, sufficient: true, citations: [] }, chunks)).toEqual({
      ok: false,
      reason: "malformed",
    });
  });

  it("rejects an over-long answer instead of truncating it", () => {
    const result = validateModelReply(
      reply({ answer: "a".repeat(ASSISTANT_LIMITS.answerMaxLength + 1) }),
      chunks,
    );

    expect(result).toEqual({ ok: false, reason: "answer-too-long" });
  });

  it("caps how many citations one reply may carry", () => {
    const citations = Array.from({ length: ASSISTANT_LIMITS.maxCitations + 1 }, () => ({
      chunk_id: "manager-decision",
      quote: "Autonomous external actions remained false",
    }));

    expect(validateModelReply(reply({ citations }), chunks)).toEqual({
      ok: false,
      reason: "too-many-citations",
    });
  });

  it("forgives re-wrapped and re-cased quotes but not altered words", () => {
    const rewrapped = validateModelReply(
      reply({ citations: [{ chunk_id: "manager-decision", quote: "AUTONOMOUS   external\n  actions remained false" }] }),
      chunks,
    );
    expect(rewrapped.ok).toBe(true);

    const altered = validateModelReply(
      reply({ citations: [{ chunk_id: "manager-decision", quote: "Autonomous external actions remained true" }] }),
      chunks,
    );
    expect(altered).toEqual({ ok: false, reason: "quote-not-found" });
  });
});

describe("isQuestionAcceptable", () => {
  it("accepts a real question and rejects empty or oversized input", () => {
    expect(isQuestionAcceptable("What did the Manager decide?")).toBe(true);
    expect(isQuestionAcceptable("   ")).toBe(false);
    expect(isQuestionAcceptable("")).toBe(false);
    expect(isQuestionAcceptable("a".repeat(ASSISTANT_LIMITS.questionMaxLength + 1))).toBe(false);
    expect(isQuestionAcceptable(42)).toBe(false);
    expect(isQuestionAcceptable(undefined)).toBe(false);
  });
});

describe("retrieveChunks", () => {
  it("returns only chunks whose keywords the question actually mentions", () => {
    const found = retrieveChunks("can we contact them by email?", chunks);

    expect(found.map((chunk) => chunk.id)).toEqual(["consent"]);
  });

  it("returns nothing when the question is unrelated, so the model gets no material", () => {
    expect(retrieveChunks("what is the weather tomorrow", chunks)).toEqual([]);
  });

  it("is deterministic for the same question", () => {
    const first = retrieveChunks("manager decision", chunks);
    const second = retrieveChunks("manager decision", chunks);

    expect(first.map((chunk) => chunk.id)).toEqual(second.map((chunk) => chunk.id));
  });

  it("never offers more than the configured number of chunks", () => {
    const many: CorpusChunk[] = Array.from({ length: 20 }, (_, index) => ({
      id: `chunk-${index}`,
      source: "test",
      text: "The Manager decision was approve.",
      keywords: ["manager"],
    }));

    expect(retrieveChunks("manager", many)).toHaveLength(ASSISTANT_LIMITS.maxChunks);
  });
});

describe("validateModelReply — mislabelled citations", () => {
  it("recovers a real quote the model attributed to the wrong id", () => {
    // Models paraphrase identifiers far more readily than they fabricate
    // sentences. The quote still had to occur verbatim in offered material.
    const result = validateModelReply(
      reply({
        citations: [
          { chunk_id: "researcher.research-brief.v1", quote: "allows the email channel only" },
        ],
      }),
      chunks,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Attribution is corrected to the passage the quote actually came from.
    expect(result.citations[0].chunkId).toBe("consent");
    expect(result.citations[0].source).toContain("consent_boundaries");
  });

  it("still rejects a fabricated quote under a wrong id", () => {
    const result = validateModelReply(
      reply({
        citations: [{ chunk_id: "made-up-id", quote: "The Manager authorised an automatic email" }],
      }),
      chunks,
    );

    expect(result).toEqual({ ok: false, reason: "unknown-chunk" });
  });

  it("refuses to guess when a quote could have come from two passages", () => {
    const duplicated = [
      { ...chunks[0], id: "a", source: "source-a" },
      { ...chunks[0], id: "b", source: "source-b" },
    ];

    const result = validateModelReply(
      reply({ citations: [{ chunk_id: "wrong", quote: "Autonomous external actions remained false" }] }),
      duplicated,
    );

    // Attributing it to the wrong source would be its own untruth.
    expect(result).toEqual({ ok: false, reason: "ambiguous-citation" });
  });

  it("keeps an exactly-named chunk authoritative, not the quote search", () => {
    const result = validateModelReply(
      reply({
        citations: [{ chunk_id: "consent", quote: "Autonomous external actions remained false" }],
      }),
      chunks,
    );

    // Named the wrong chunk for a quote that exists elsewhere: that is a
    // genuine mismatch and must fail, not silently reattribute.
    expect(result).toEqual({ ok: false, reason: "quote-not-found" });
  });
});
