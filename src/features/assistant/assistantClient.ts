/**
 * Browser client for the assistant's model tier.
 *
 * Every failure here is ordinary. The function may be unconfigured, rate
 * limited, unreachable, or may refuse because the model's answer failed
 * citation validation — and in each case the caller drops to a lower tier
 * rather than showing an error. That is why this module never throws: it
 * returns a refusal like any other outcome.
 */

export type AssistantCitation = { chunkId: string; quote: string; source: string };
export type AssistantEvidence = { source: string; text: string };

export type AssistantResponse =
  | { status: "answered"; answer: string; citations: AssistantCitation[] }
  | { status: "refused"; reason: string; evidence: AssistantEvidence[] };

export type AssistantClient = {
  ask(question: string, signal?: AbortSignal): Promise<AssistantResponse>;
};

/** Absent configuration is a refusal, not a crash: the grounded tier still answers. */
const NOT_CONFIGURED: AssistantResponse = {
  status: "refused",
  reason: "not-configured",
  evidence: [],
};

function readEvidence(value: unknown): AssistantEvidence[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const record = entry as Record<string, unknown>;
    return typeof record.source === "string" && typeof record.text === "string"
      ? [{ source: record.source, text: record.text }]
      : [];
  });
}

function readCitations(value: unknown): AssistantCitation[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const record = entry as Record<string, unknown>;
    return typeof record.chunkId === "string" &&
      typeof record.quote === "string" &&
      typeof record.source === "string"
      ? [{ chunkId: record.chunkId, quote: record.quote, source: record.source }]
      : [];
  });
}

/**
 * Read the response defensively.
 *
 * An answer without citations is treated as a refusal even though the server
 * should never produce one. The browser is the last place this invariant can
 * be held, and holding it twice costs nothing.
 */
function readResponse(payload: unknown): AssistantResponse {
  if (typeof payload !== "object" || payload === null) {
    return { status: "refused", reason: "malformed", evidence: [] };
  }
  const record = payload as Record<string, unknown>;

  if (record.status === "answered" && typeof record.answer === "string") {
    const citations = readCitations(record.citations);
    if (citations.length === 0) {
      return { status: "refused", reason: "no-citations", evidence: [] };
    }
    return { status: "answered", answer: record.answer, citations };
  }

  return {
    status: "refused",
    reason: typeof record.reason === "string" ? record.reason : "malformed",
    evidence: readEvidence(record.evidence),
  };
}

export function createAssistantClient(): AssistantClient | null {
  const base = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  // No configuration means no model tier. The panel still works.
  if (!base || !key) return null;

  const endpoint = `${String(base).replace(/\/$/, "")}/functions/v1/retentionlab-assistant`;

  return {
    async ask(question, signal) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          signal,
          cache: "no-store",
          headers: { "content-type": "application/json", apikey: String(key) },
          body: JSON.stringify({ question }),
        });

        if (response.status === 429) {
          return { status: "refused", reason: "rate-limited", evidence: [] };
        }
        if (!response.ok) {
          return { status: "refused", reason: "unavailable", evidence: [] };
        }

        return readResponse(await response.json());
      } catch {
        // Network failure, abort, or unparseable body — the reader gets the
        // grounded tier, never a stack trace.
        return { status: "refused", reason: "unavailable", evidence: [] };
      }
    },
  };
}

export { NOT_CONFIGURED };
