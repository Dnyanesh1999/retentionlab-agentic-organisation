import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { askAssistant } from "./assistant.ts";
import corpusJson from "./corpus.json" with { type: "json" };
import {
  ASSISTANT_LIMITS,
  isQuestionAcceptable,
  type CorpusChunk,
} from "../../../runtime/assistant/contracts.ts";

/**
 * Assistant gateway.
 *
 * Deliberately a separate function from `retentionlab-runs`. It has a
 * different risk profile — it is the only place model prose reaches a browser
 * — and separating it means it can be rate limited, degraded or switched off
 * without touching the governed run gateway or its custom caller check.
 *
 * This function can read nothing and write nothing. It holds no service key,
 * touches no run, and has no database access at all: its entire world is the
 * committed corpus beside it. The worst a caller can do is spend model quota,
 * which is what the rate limit is for.
 */

const corpus = (corpusJson as { chunks: CorpusChunk[] }).chunks;

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "apikey, authorization, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
} as const;

/**
 * The platform supplies the publishable key as `SUPABASE_PUBLISHABLE_KEYS`: a
 * JSON map of named keys, not a bare string. Reading a singular
 * `SUPABASE_PUBLISHABLE_KEY` yields undefined and rejects every caller, which
 * is exactly what happened on this function's first deployment. Kept identical
 * to the run gateway's `namedKey` so the two cannot drift.
 */
function publishableDefaultKey(): string {
  const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (!raw) throw new Error("Missing SUPABASE_PUBLISHABLE_KEYS");

  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const value = parsed.default;
  if (typeof value !== "string" || value.length < 12) {
    throw new Error("Missing default key in SUPABASE_PUBLISHABLE_KEYS");
  }
  return value;
}

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      ...corsHeaders,
      "cache-control": "no-store, max-age=0",
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
  });
}

/**
 * In-memory, per-instance request budget.
 *
 * An honest description of what this is: a cheap brake on a single warm
 * instance, not a real quota. Edge instances are recycled and can run in
 * parallel, so a determined caller can exceed this. It is here so that a stuck
 * client loop cannot drain the model budget in one burst. A durable limit
 * belongs in Postgres and is the next slice.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 12;
const hits: number[] = [];

function withinBudget(now: number): boolean {
  while (hits.length > 0 && now - hits[0] > WINDOW_MS) {
    hits.shift();
  }
  if (hits.length >= MAX_PER_WINDOW) return false;
  hits.push(now);
  return true;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // The same caller check the run gateway uses: this function is deployed with
  // verify_jwt disabled, so it validates the publishable key itself.
  let publishableKey: string;
  try {
    publishableKey = publishableDefaultKey();
  } catch {
    return json({ error: "Server configuration unavailable" }, 500);
  }

  const presented = request.headers.get("apikey") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (presented !== publishableKey) {
    return json({ error: "Unauthorised" }, 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Body must be JSON" }, 400);
  }

  const question = (body as { question?: unknown })?.question;
  if (!isQuestionAcceptable(question)) {
    return json(
      {
        error: `question must be a non-empty string of at most ${ASSISTANT_LIMITS.questionMaxLength} characters`,
      },
      400,
    );
  }

  if (!withinBudget(Date.now())) {
    // A distinct status and reason, so the browser can say "too many questions
    // just now" rather than showing a generic failure.
    return json({ status: "refused", reason: "rate-limited" }, 429);
  }

  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  const model = Deno.env.get("OPENROUTER_ASSISTANT_MODEL");
  if (!apiKey || !model) {
    // Not configured is a refusal, not a crash: the browser falls back to its
    // own grounded tier and the reader still gets a truthful answer.
    return json({ status: "refused", reason: "not-configured" }, 200);
  }

  const outcome = await askAssistant({ question, corpus, apiKey, model });
  return json(outcome, 200);
});
