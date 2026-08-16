import { z } from "npm:zod@4.4.3";

const PROMPT_VERSION = "researcher.v1.1.0" as const;
const EVIDENCE_TOOLS = [
  "get_account_snapshot",
  "list_product_signals",
  "list_billing_events",
  "list_support_events",
  "get_preference_profile",
] as const;

type EvidenceTool = (typeof EVIDENCE_TOOLS)[number];
type JsonRecord = Record<string, unknown>;

const inputSchema = z.object({
  runId: z.uuid(),
  accountSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  objective: z.string().trim().min(20).max(500),
  initiatedAt: z.iso.datetime({ offset: true }),
  supabaseUrl: z.url(),
  publishableKey: z.string().min(12),
  secretKey: z.string().min(12),
  openRouterApiKey: z.string().min(20),
  requestedModel: z.string().min(1).max(160),
}).strict();

const citationSchema = z.object({
  evidence_key: z.string().regex(/^[a-z]+:[a-z0-9-]+:[a-z0-9_-]+(?::[a-z0-9-]+)?$/).max(160),
  source_tool: z.enum(EVIDENCE_TOOLS),
  source_system: z.literal("Supabase Postgres"),
  retrieved_at: z.iso.datetime({ offset: true }),
}).strict();

export const researchBriefSchema = z.object({
  schema_version: z.literal("research-brief.v1"),
  stage: z.literal("researcher"),
  status: z.enum(["completed", "insufficient_evidence"]),
  agent: z.object({
    id: z.literal("researcher"),
    name: z.literal("Nia Calder"),
    personality: z.literal("forensic, humane, constructively sceptical"),
  }).strict(),
  run_id: z.uuid(),
  account_slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  brief_summary: z.string().min(20).max(1_500),
  observations: z.array(z.object({
    claim: z.string().min(8).max(500),
    significance: z.enum(["low", "medium", "high", "critical"]),
    confidence: z.number().min(0).max(1),
    citations: z.array(citationSchema).min(1),
  }).strict()).max(12),
  hypotheses: z.array(z.object({
    statement: z.string().min(8).max(500),
    confidence: z.number().min(0).max(1),
    supporting_evidence_keys: z.array(citationSchema.shape.evidence_key).min(1),
    disconfirming_evidence_needed: z.string().min(8).max(500),
  }).strict()).max(8),
  consent_boundaries: z.object({
    allowed_channels: z.array(z.string().min(1).max(40)).max(10),
    prohibited_actions: z.array(z.string().min(3).max(240)).min(1).max(10),
    citations: z.array(citationSchema).min(1),
  }).strict(),
  unknowns: z.array(z.string().min(5).max(300)).min(1).max(10),
  designer_handoff: z.object({
    design_challenge: z.string().min(20).max(800),
    priority_outcomes: z.array(z.string().min(5).max(240)).min(1).max(6),
    non_negotiables: z.array(z.string().min(5).max(240)).min(1).max(8),
    success_signals: z.array(z.string().min(5).max(240)).min(1).max(8),
  }).strict(),
  provenance: z.object({
    provider: z.literal("openrouter"),
    requested_model: z.string().min(1),
    resolved_model: z.string().min(1),
    prompt_version: z.literal(PROMPT_VERSION),
    generated_at: z.iso.datetime({ offset: true }),
    tool_calls: z.array(z.enum(EVIDENCE_TOOLS)).length(5),
    all_sources_no_store: z.literal(true),
  }).strict(),
}).strict().superRefine((brief, context) => {
  if (brief.status === "completed" && brief.observations.length === 0) {
    context.addIssue({ code: "custom", path: ["observations"], message: "Completed research requires cited observations." });
  }
});

const evidenceEnvelopeSchema = z.object({
  tool: z.enum(EVIDENCE_TOOLS),
  source: z.object({
    system: z.literal("Supabase Postgres"),
    dataset: z.literal("retentionlab-demo-v1"),
    generation_run_id: z.uuid(),
    generated_at: z.iso.datetime({ offset: true }),
    retrieved_at: z.iso.datetime({ offset: true }),
    cache_mode: z.literal("no-store"),
  }).strict(),
  account: z.object({ slug: z.string(), display_name: z.string() }).strict().optional(),
  data: z.unknown(),
}).strict();

const claimSchema = z.union([
  z.object({ claimed: z.literal(false), reason: z.string() }).passthrough(),
  z.object({ claimed: z.literal(true), lease_token: z.uuid() }).passthrough(),
]);

const openRouterResponseSchema = z.object({
  model: z.string().min(1).max(160),
  choices: z.array(z.object({
    message: z.object({ content: z.string().min(1) }).passthrough(),
  }).passthrough()).min(1),
}).passthrough();

const SYSTEM_PROMPT = `
You are Nia Calder, the Researcher in RetentionLab's five-agent organisation.
Prompt version: ${PROMPT_VERSION}.

PERSONALITY
You are forensic, humane, and constructively sceptical. Distinguish observation from inference and seek evidence that could disprove the first interpretation.

MISSION
Investigate the supplied fictional account and create the evidence brief that the Designer will inherit. Work only from the live RetentionLab evidence packet in this run.

NON-NEGOTIABLE METHOD
1. Inspect all five required evidence results. If insufficient, report insufficient_evidence and name the missing evidence.
2. Never invent, estimate, remember, or silently substitute business evidence.
3. Every factual observation must cite an evidence_key with its exact source_tool, source_system and retrieved_at.
4. Keep hypotheses separate from observations and state what would disconfirm them.
5. Consent is a hard boundary. Only the preference profile determines allowed channels and prohibited actions.
6. Minimise personal data and never infer protected traits or vulnerability.

HANDOFF STANDARD
Give the Designer a precise challenge, outcomes, non-negotiables and observable success signals. Never prescribe final customer copy.

OUTPUT
Return only one JSON object matching the supplied schema, without markdown or additional fields.
`.trim();

class WorkerError extends Error {}

async function jsonRequest(
  fetchImplementation: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImplementation(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    throw new WorkerError("upstream_unreachable");
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new WorkerError(`upstream_${response.status}`);
  return payload;
}

async function rpc(
  fetchImplementation: typeof fetch,
  supabaseUrl: string,
  secretKey: string,
  name: string,
  body: JsonRecord,
) {
  return await jsonRequest(fetchImplementation, `${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { accept: "application/json", apikey: secretKey, "content-type": "application/json" },
    body: JSON.stringify(body),
  }, 8_000);
}

function collectEvidenceKeys(value: unknown, target: Set<string>) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectEvidenceKeys(item, target));
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (key === "evidence_key" && typeof child === "string") target.add(child);
      collectEvidenceKeys(child, target);
    }
  }
}

function assertEvidenceIntegrity(
  brief: z.infer<typeof researchBriefSchema>,
  envelopes: Array<z.infer<typeof evidenceEnvelopeSchema>>,
) {
  const index = new Map<string, Array<{ tool: EvidenceTool; retrievedAt: string }>>();
  for (const envelope of envelopes) {
    const keys = new Set<string>();
    collectEvidenceKeys(envelope.data, keys);
    for (const key of keys) {
      index.set(key, [...(index.get(key) ?? []), { tool: envelope.tool, retrievedAt: envelope.source.retrieved_at }]);
    }
  }
  const citations = [
    ...brief.observations.flatMap((observation) => observation.citations),
    ...brief.consent_boundaries.citations,
  ];
  for (const citation of citations) {
    const sources = index.get(citation.evidence_key);
    if (!sources?.some((source) =>
      source.tool === citation.source_tool && sameInstant(source.retrievedAt, citation.retrieved_at)
    )) {
      throw new WorkerError("citation_integrity_failed");
    }
  }
  if (!brief.consent_boundaries.citations.every((citation) => citation.source_tool === "get_preference_profile")) {
    throw new WorkerError("consent_integrity_failed");
  }
  for (const hypothesis of brief.hypotheses) {
    if (hypothesis.supporting_evidence_keys.some((key) => !index.has(key))) {
      throw new WorkerError("hypothesis_integrity_failed");
    }
  }
}

function evidenceArguments(tool: EvidenceTool, accountSlug: string): JsonRecord {
  return tool === "get_account_snapshot" || tool === "get_preference_profile"
    ? { account_slug: accountSlug }
    : { account_slug: accountSlug, limit: 20 };
}

/**
 * Compare two retrieval timestamps as instants rather than as strings.
 *
 * The citation must still name a real evidence key, retrieved by the real tool,
 * at the real moment — that guarantee is unchanged. What is no longer required
 * is that the model reproduce the timestamp's *formatting* byte for byte.
 * `2026-08-06T16:15:06.925Z` and `2026-08-06T16:15:06.925+00:00` are the same
 * instant, and rejecting the second was failing runs for a difference that
 * carries no meaning. Two different models failed here on formatting alone.
 *
 * An unparseable timestamp still fails, and so does a real one that points at a
 * different moment.
 */
function sameInstant(a: string, b: string): boolean {
  const left = Date.parse(a);
  const right = Date.parse(b);
  return Number.isFinite(left) && Number.isFinite(right) && left === right;
}

function safeFailureReason(error: unknown) {
  if (error instanceof WorkerError && error.message === "upstream_429") {
    return "Researcher paused because the model provider is temporarily rate limited.";
  }
  if (error instanceof WorkerError && /^upstream_4\d\d$/.test(error.message)) {
    return "Researcher paused because the selected model endpoint rejected the protected request contract.";
  }
  if (error instanceof SyntaxError) {
    return "Researcher stopped because the model response was not valid structured JSON.";
  }
  if (error instanceof z.ZodError) {
    return "Researcher stopped because the model response did not satisfy the ResearchBrief contract.";
  }
  if (error instanceof WorkerError && error.message.endsWith("_integrity_failed")) {
    // Naming which guard rejected the brief. All three used to report the same
    // sentence, which made a citation problem indistinguishable from a consent
    // or hypothesis one and cost several production retries to narrow down.
    // The guard's name leaks no evidence, key or model output.
    if (error.message === "consent_integrity_failed") {
      return "Researcher stopped because a consent citation did not come from the preference profile tool.";
    }
    if (error.message === "hypothesis_integrity_failed") {
      return "Researcher stopped because a hypothesis cited an evidence key outside its tool session.";
    }
    return "Researcher stopped because a citation did not match evidence returned in its tool session.";
  }
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return "Researcher exceeded the protected execution window and stopped safely.";
  }
  return "Researcher could not produce a validated evidence brief and stopped safely.";
}

function diagnosticCode(error: unknown) {
  if (error instanceof WorkerError) return error.message;
  if (error instanceof z.ZodError) return "contract_validation_failed";
  if (error instanceof SyntaxError) return "model_json_invalid";
  if (error instanceof DOMException && error.name === "TimeoutError") return "execution_timeout";
  return "unexpected_worker_error";
}

export type HostedResearcherResult =
  | { status: "not_claimed"; reason: string }
  | { status: "completed"; artifactHash: string }
  | { status: "failed" };

export async function executeHostedResearcher(options: {
  runId: string;
  accountSlug: string;
  objective: string;
  initiatedAt: string;
  supabaseUrl: string;
  publishableKey: string;
  secretKey: string;
  openRouterApiKey: string;
  requestedModel: string;
  fetchImplementation?: typeof fetch;
}): Promise<HostedResearcherResult> {
  const parsed = inputSchema.parse({
    runId: options.runId,
    accountSlug: options.accountSlug,
    objective: options.objective,
    initiatedAt: options.initiatedAt,
    supabaseUrl: options.supabaseUrl,
    publishableKey: options.publishableKey,
    secretKey: options.secretKey,
    openRouterApiKey: options.openRouterApiKey,
    requestedModel: options.requestedModel,
  });
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const claim = claimSchema.parse(await rpc(fetchImplementation, parsed.supabaseUrl, parsed.secretKey, "claim_agent_run_researcher", {
    p_run_id: parsed.runId,
  }));
  if (!claim.claimed) return { status: "not_claimed", reason: claim.reason };

  try {
    const envelopes = await Promise.all(EVIDENCE_TOOLS.map(async (tool) => {
      const payload = await jsonRequest(fetchImplementation, `${parsed.supabaseUrl}/functions/v1/retentionlab-evidence`, {
        method: "POST",
        headers: {
          accept: "application/json",
          apikey: parsed.publishableKey,
          "cache-control": "no-store",
          "content-type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({ tool, arguments: evidenceArguments(tool, parsed.accountSlug) }),
      }, 12_000);
      const envelope = evidenceEnvelopeSchema.parse(payload);
      if (envelope.tool !== tool) throw new WorkerError("evidence_tool_mismatch");
      return envelope;
    }));

    const modelPayload = await jsonRequest(fetchImplementation, "https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${parsed.openRouterApiKey}`,
        "content-type": "application/json",
        "http-referer": "https://dnyanesh1999.github.io/retentionlab-agentic-organisation/",
        "x-title": "RetentionLab Hosted Researcher",
      },
      body: JSON.stringify({
        model: parsed.requestedModel,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              "Conduct the Researcher stage with this validated input:",
              JSON.stringify({ run_id: parsed.runId, account_slug: parsed.accountSlug, objective: parsed.objective, initiated_at: parsed.initiatedAt }),
              "LIVE EVIDENCE PACKET:",
              JSON.stringify(envelopes),
            ].join("\n\n"),
          },
        ],
        stream: false,
        temperature: 0.1,
        max_tokens: 5_000,
        provider: { require_parameters: true },
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "retentionlab_research_brief",
            strict: true,
            schema: z.toJSONSchema(researchBriefSchema),
          },
        },
      }),
    }, 110_000);

    const model = openRouterResponseSchema.parse(modelPayload);
    const content = model.choices[0].message.content;
    const candidate = researchBriefSchema.parse(JSON.parse(content) as unknown);
    const brief = researchBriefSchema.parse({
      ...candidate,
      run_id: parsed.runId,
      account_slug: parsed.accountSlug,
      provenance: {
        provider: "openrouter",
        requested_model: parsed.requestedModel,
        resolved_model: model.model,
        prompt_version: PROMPT_VERSION,
        generated_at: new Date().toISOString(),
        tool_calls: [...EVIDENCE_TOOLS],
        all_sources_no_store: true,
      },
    });
    assertEvidenceIntegrity(brief, envelopes);

    const canonical = JSON.stringify(brief);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
    const artifactHash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const publicSummary = `Researcher sealed ${brief.observations.length} cited observations and ${brief.hypotheses.length} hypotheses from 5 fresh evidence tools.`;

    const completion = await rpc(fetchImplementation, parsed.supabaseUrl, parsed.secretKey, "complete_agent_run_researcher", {
      p_run_id: parsed.runId,
      p_lease_token: claim.lease_token,
      p_artifact: brief,
      p_artifact_hash: artifactHash,
      p_requested_model: parsed.requestedModel,
      p_resolved_model: model.model,
      p_public_summary: publicSummary,
    });
    if (!completion || typeof completion !== "object" || (completion as JsonRecord).completed !== true) {
      throw new WorkerError("completion_rejected");
    }
    return { status: "completed", artifactHash };
  } catch (error) {
    // Log only a bounded internal classification; never provider bodies, prompts,
    // evidence payloads, artefacts, credentials, or raw model output.
    console.error(`Hosted Researcher failed: ${diagnosticCode(error)}.`);
    try {
      await rpc(fetchImplementation, parsed.supabaseUrl, parsed.secretKey, "fail_agent_run_stage", {
        p_run_id: parsed.runId,
        p_lease_token: claim.lease_token,
        p_stage: "researcher",
        p_reason: safeFailureReason(error),
      });
    } catch {
      console.error("Hosted Researcher could not persist its bounded failure event.");
    }
    return { status: "failed" };
  }
}
