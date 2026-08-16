/**
 * The fallback ladder.
 *
 * One place decides which tier answers, so the rule is auditable rather than
 * spread through the component:
 *
 *   1. model-cited      a generated answer whose every quote was verified
 *                       server-side against the passage it cites
 *   2. sealed-record    a deterministic answer composed from the committed
 *                       record; needs no network at all
 *   3. evidence         the retrieved passages, shown without prose, when
 *                       generation failed but retrieval did not
 *   4. refusal          an honest notice and the grounded questions
 *
 * Two rules hold throughout. A lower tier is never presented as a higher one —
 * the tier is carried on the result and shown to the reader. And no tier ever
 * invents: each is either quoted, composed from the record, or a refusal.
 */
import { answerFromSealedRecord } from "./groundedAnswers";
import type { AssistantClient, AssistantCitation, AssistantEvidence } from "./assistantClient";

export type LadderResult =
  | {
      tier: "model-cited";
      answer: string;
      citations: AssistantCitation[];
    }
  | {
      tier: "sealed-record";
      answer: string;
      source: string;
      /** Why the model tier did not answer. Absent when it was never asked. */
      fallbackFrom?: string;
    }
  | { tier: "evidence"; evidence: AssistantEvidence[]; fallbackFrom: string }
  | { tier: "refusal"; notice: string; fallbackFrom?: string };

/** Reader-facing wording for why the model tier stood down. Never a raw code. */
const REASON_COPY: Record<string, string> = {
  "not-configured": "The generated-answer service is not switched on.",
  "rate-limited": "The assistant has answered a lot of questions just now.",
  unavailable: "The generated-answer service could not be reached.",
  "model-unavailable": "The generated-answer service could not be reached.",
  "no-evidence": "The sealed record does not cover that.",
  insufficient: "The record does not answer that question.",
  "quote-not-found": "The generated answer could not be verified against the record.",
  "unknown-chunk": "The generated answer could not be verified against the record.",
  "ambiguous-citation": "The generated answer's quote could not be traced to one passage.",
  "leaked-digest": "The generated answer could not be verified against the record.",
  "no-citations": "The generated answer cited nothing, so it was discarded.",
  malformed: "The generated answer could not be verified against the record.",
};

export function explainReason(reason: string): string {
  return REASON_COPY[reason] ?? "The generated answer could not be verified against the record.";
}

const REFUSAL_NOTICE =
  "I can answer only from this case's sealed record. Try one of the grounded questions below.";

export async function askWithFallback(
  question: string,
  client: AssistantClient | null,
  signal?: AbortSignal,
): Promise<LadderResult> {
  const grounded = answerFromSealedRecord(question);

  // No model tier configured: the deterministic answer is the whole ladder,
  // and it is labelled as itself rather than dressed up as generated.
  if (!client) {
    return grounded.status === "answered"
      ? {
          tier: "sealed-record",
          answer: grounded.answer.answer,
          source: grounded.answer.source,
        }
      : { tier: "refusal", notice: grounded.notice };
  }

  const response = await client.ask(question, signal);

  if (response.status === "answered") {
    return { tier: "model-cited", answer: response.answer, citations: response.citations };
  }

  // Tier 2 before tier 3: a composed answer from the record is more useful
  // than raw passages, and it is just as grounded.
  if (grounded.status === "answered") {
    return {
      tier: "sealed-record",
      answer: grounded.answer.answer,
      source: grounded.answer.source,
      fallbackFrom: response.reason,
    };
  }

  if (response.evidence.length > 0) {
    return { tier: "evidence", evidence: response.evidence, fallbackFrom: response.reason };
  }

  return {
    tier: "refusal",
    notice: grounded.status === "unmatched" ? grounded.notice : REFUSAL_NOTICE,
    fallbackFrom: response.reason,
  };
}
