/**
 * Shared contract for the assistant's model tier.
 *
 * The rule this file enforces is the one that makes a language model
 * acceptable in a project whose thesis is that nothing is invented: **the
 * model may choose words, but it may not introduce facts.**
 *
 * That is not achieved by asking it nicely in a prompt. It is achieved here,
 * on the server, after the model has spoken:
 *
 * 1. The reply must parse against a fixed shape.
 * 2. Every citation must name a chunk that was actually sent in this request.
 * 3. Every quoted span must genuinely occur in that chunk. A quote the model
 *    composed itself fails, however plausible it reads.
 * 4. A reply that cites nothing is refused, never shown.
 *
 * Anything that fails is discarded whole — the prose is never salvaged, never
 * partially rendered, and never relabelled as a grounded answer. The caller
 * falls back to a lower, deterministic tier.
 *
 * No Deno or Node built-ins are used, so this module is imported unchanged by
 * the Edge Function and by the application test suite.
 */

/** One retrievable, public-safe passage the model is allowed to draw on. */
export type CorpusChunk = {
  /** Stable identifier the model must cite. */
  id: string;
  /** Human-readable provenance, shown to the reader beside the answer. */
  source: string;
  /** The passage itself. Every quote must occur within this text. */
  text: string;
  /** Lowercased terms used for deterministic retrieval. */
  keywords: string[];
};

export type ModelCitation = {
  chunk_id: string;
  quote: string;
};

/** The shape the model is instructed to return. Never trusted as-is. */
export type ModelReply = {
  answer: string;
  citations: ModelCitation[];
  sufficient: boolean;
};

export type ValidatedCitation = {
  chunkId: string;
  quote: string;
  source: string;
};

export type ValidationResult =
  | { ok: true; answer: string; citations: ValidatedCitation[] }
  | { ok: false; reason: ValidationFailure };

/**
 * Why a reply was rejected. Recorded and surfaced as a category, never as the
 * rejected prose itself.
 */
export type ValidationFailure =
  | "malformed"
  | "empty-answer"
  | "answer-too-long"
  | "insufficient"
  | "no-citations"
  | "too-many-citations"
  | "unknown-chunk"
  | "ambiguous-citation"
  | "quote-too-short"
  | "quote-not-found"
  | "leaked-digest";

export const ASSISTANT_LIMITS = {
  /** Longest question accepted from the browser. */
  questionMaxLength: 400,
  /** Longest answer accepted back from the model. */
  answerMaxLength: 900,
  /** Chunks retrieved and offered to the model for one question. */
  maxChunks: 6,
  /** Citations accepted in one reply. */
  maxCitations: 4,
  /**
   * Shortest quote accepted. A very short quote ("the", "a run") could match
   * almost any chunk by chance, which would make the substring check
   * meaningless as a fabrication guard.
   */
  quoteMinLength: 16,
} as const;

/** A full SHA-256 digest. Never allowed to reach the browser through prose. */
const digestPattern = /[0-9a-f]{64}/i;

/**
 * Collapse runs of whitespace and lowercase, so a model that re-wraps or
 * re-cases a quote is not punished for formatting. Content is still compared
 * verbatim: no words may be added, removed or altered.
 */
function normalise(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

export function isQuestionAcceptable(question: unknown): question is string {
  return (
    typeof question === "string" &&
    question.trim().length > 0 &&
    question.length <= ASSISTANT_LIMITS.questionMaxLength
  );
}

function isModelReply(value: unknown): value is ModelReply {
  if (typeof value !== "object" || value === null) return false;
  const reply = value as Record<string, unknown>;
  if (typeof reply.answer !== "string") return false;
  if (typeof reply.sufficient !== "boolean") return false;
  if (!Array.isArray(reply.citations)) return false;
  return reply.citations.every((citation) => {
    if (typeof citation !== "object" || citation === null) return false;
    const entry = citation as Record<string, unknown>;
    return typeof entry.chunk_id === "string" && typeof entry.quote === "string";
  });
}

/**
 * Validate a model reply against the exact chunks it was given.
 *
 * `offered` must be the chunks actually sent in this request. Passing the
 * whole corpus would let the model cite a passage it never saw, which is the
 * failure this function exists to prevent.
 */
export function validateModelReply(raw: unknown, offered: readonly CorpusChunk[]): ValidationResult {
  if (!isModelReply(raw)) {
    return { ok: false, reason: "malformed" };
  }

  const answer = raw.answer.trim();
  if (answer.length === 0) return { ok: false, reason: "empty-answer" };
  if (answer.length > ASSISTANT_LIMITS.answerMaxLength) {
    return { ok: false, reason: "answer-too-long" };
  }

  // The model is never given a full digest, so producing one means it invented
  // it. Refuse rather than print a plausible-looking hash.
  if (digestPattern.test(answer)) return { ok: false, reason: "leaked-digest" };

  // An honest "I cannot answer that" is a success for the system and a refusal
  // for the reader — but it must not be dressed up as a grounded answer.
  if (!raw.sufficient) return { ok: false, reason: "insufficient" };

  if (raw.citations.length === 0) return { ok: false, reason: "no-citations" };
  if (raw.citations.length > ASSISTANT_LIMITS.maxCitations) {
    return { ok: false, reason: "too-many-citations" };
  }

  const byId = new Map(offered.map((chunk) => [chunk.id, chunk]));
  const citations: ValidatedCitation[] = [];

  for (const citation of raw.citations) {
    const quote = citation.quote.trim();
    if (quote.length < ASSISTANT_LIMITS.quoteMinLength) {
      return { ok: false, reason: "quote-too-short" };
    }

    const named = byId.get(citation.chunk_id);

    if (named) {
      if (!normalise(named.text).includes(normalise(quote))) {
        return { ok: false, reason: "quote-not-found" };
      }
      citations.push({ chunkId: named.id, quote, source: named.source });
      continue;
    }

    /*
     * The model named a passage that was not offered. That is usually a
     * mislabelled id rather than an invention — models paraphrase identifiers
     * far more readily than they fabricate sentences — so the quote is given a
     * chance to identify itself.
     *
     * This does not weaken the guarantee. The quote must still occur verbatim
     * in material actually sent this request; only the label is forgiven. A
     * quote matching two passages is rejected rather than guessed at, because
     * attributing it to the wrong source would be its own kind of untruth.
     */
    const matches = offered.filter((chunk) => normalise(chunk.text).includes(normalise(quote)));
    if (matches.length === 0) return { ok: false, reason: "unknown-chunk" };
    if (matches.length > 1) return { ok: false, reason: "ambiguous-citation" };

    citations.push({ chunkId: matches[0].id, quote, source: matches[0].source });
  }

  return { ok: true, answer, citations };
}

/**
 * Deterministic keyword retrieval.
 *
 * Retrieval is intentionally not model-driven: what the model is allowed to
 * see must be decided by code, so the set of citable material is auditable and
 * identical for the same question every time.
 */
export function retrieveChunks(
  question: string,
  corpus: readonly CorpusChunk[],
  limit = ASSISTANT_LIMITS.maxChunks,
): CorpusChunk[] {
  const normalised = normalise(question);
  if (!normalised) return [];

  return corpus
    .map((chunk) => ({
      chunk,
      score: chunk.keywords.reduce(
        (total, keyword) => (normalised.includes(keyword) ? total + 1 : total),
        0,
      ),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.chunk.id.localeCompare(b.chunk.id))
    .slice(0, limit)
    .map((entry) => entry.chunk);
}
