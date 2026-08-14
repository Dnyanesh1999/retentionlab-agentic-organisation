import { z } from "npm:zod@4.4.3";

import { recoveryRoomArtifactSchema } from "./maker.ts";

const PROMPT_VERSION = "communicator.v1.4.0" as const;
type JsonRecord = Record<string, unknown>;

const inputSchema = z.object({
  runId: z.uuid(),
  supabaseUrl: z.url(),
  secretKey: z.string().min(12),
  openRouterApiKey: z.string().min(20),
  requestedModel: z.string().min(1).max(160),
}).strict();

const evidenceKeySchema = z.string().regex(/^[a-z]+:[a-z0-9-]+:[a-z0-9_-]+(?::[a-z0-9-]+)?$/).max(160);
const messageClaimSchema = z.object({
  message: z.string().min(10).max(400),
  source_claims: z.array(z.string().min(10).max(300)).min(1).max(5),
  evidence_keys: z.array(evidenceKeySchema).min(1).max(8),
  qualification: z.string().min(8).max(300),
}).strict();

export const communicationPlanSchema = z.object({
  schema_version: z.literal("communication-plan.v1"),
  stage: z.literal("communicator"),
  status: z.enum(["ready_for_manager", "needs_maker_revision"]),
  agent: z.object({
    id: z.literal("communicator"),
    name: z.literal("Maeve Quinn"),
    personality: z.literal("plain-spoken, empathetic, evidence-disciplined"),
  }).strict(),
  run_id: z.uuid(),
  account_slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  source: z.object({
    maker_schema_version: z.literal("recovery-room-artifact.v1"),
    maker_prompt_version: z.enum(["maker.v1.0.0", "maker.v1.1.0"]),
    maker_generated_at: z.iso.datetime({ offset: true }),
    maker_artifact_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    implementation_commit_sha: z.string().regex(/^[a-f0-9]{7,40}$/),
  }).strict(),
  inherited_boundaries: z.object({
    available_channels: z.array(z.string().min(1).max(40)).max(10),
    prohibited_claims: z.array(z.string().min(3).max(240)).min(1).max(10),
    required_disclosures: z.array(z.string().min(8).max(300)).min(2).max(10),
  }).strict(),
  campaign_thesis: z.string().min(30).max(800),
  tone_rules: z.array(z.string().min(8).max(240)).min(3).max(8),
  invitation: z.object({
    channel: z.string().min(1).max(40),
    headline: z.string().min(5).max(78),
    preview: z.string().min(10).max(140),
    body_paragraphs: z.array(z.string().min(15).max(500)).min(2).max(5),
    cta_label: z.string().min(3).max(50),
    landing_route: z.literal("#/cases/recovery-room"),
  }).strict(),
  message_claims: z.array(messageClaimSchema).min(1).max(8),
  transparency: z.object({
    why_received: z.string().min(15).max(400),
    data_boundary: z.string().min(15).max(400),
    choice_statement: z.string().min(15).max(400),
  }).strict(),
  follow_up_policy: z.literal("none_without_new_explicit_consent"),
  measurement_plan: z.array(z.object({
    signal: z.string().min(5).max(120),
    interpretation: z.string().min(10).max(300),
    guardrail: z.string().min(10).max(300),
  }).strict()).min(2).max(6),
  manager_handoff: z.object({
    launch_recommendation: z.enum(["proceed_to_review", "pause_for_revision"]),
    executive_summary: z.string().min(30).max(800),
    decision_questions: z.array(z.string().min(10).max(300)).min(2).max(8),
    operational_dependencies: z.array(z.string().min(8).max(240)).min(1).max(8),
    risks: z.array(z.object({
      risk: z.string().min(10).max(300),
      mitigation: z.string().min(10).max(300),
    }).strict()).min(1).max(8),
  }).strict(),
  provenance: z.object({
    provider: z.literal("openrouter"),
    requested_model: z.string().min(1).max(160),
    resolved_model: z.string().min(1).max(160),
    prompt_version: z.literal(PROMPT_VERSION),
    generated_at: z.iso.datetime({ offset: true }),
  }).strict(),
}).strict();

const editorialDeltaSchema = z.object({
  executive_summary: z.string().min(30).max(800),
}).strict();

const claimSchema = z.union([
  z.object({ claimed: z.literal(false), reason: z.string() }).passthrough(),
  z.object({
    claimed: z.literal(true),
    lease_token: z.uuid(),
    run_id: z.uuid(),
    account_slug: z.string(),
    predecessor_artifact: recoveryRoomArtifactSchema,
    predecessor_hash: z.string().regex(/^[0-9a-f]{64}$/),
  }).passthrough(),
]);

const openRouterResponseSchema = z.object({
  model: z.string().min(1).max(160),
  choices: z.array(z.object({
    finish_reason: z.string().optional(),
    message: z.object({ content: z.string().min(1) }).passthrough(),
  }).passthrough()).min(1),
}).passthrough();

const SYSTEM_PROMPT = `
You are Maeve Quinn, the Communicator in RetentionLab's five-agent organisation.
Prompt version: ${PROMPT_VERSION}.

Review one sealed Recovery Room artefact and write a concise executive summary of the proposed,
optional invitation. Return only the compact editorial delta. Policy code owns every customer-facing
word, lineage, evidence key, qualification, inherited boundary, disclosure, follow-up rule and gate.

NON-NEGOTIABLES
1. Preserve aggregate framing. Never imply personal usage, causation, diagnosis or certainty.
2. No urgency, scarcity, churn labels, win-back language, sales pressure or outcome promises.
3. Non-response is not consent and no external action has occurred.
4. Do not invent numbers, people, destinations, capabilities or evidence.
5. The Manager—not you—decides whether any communication may be sent.
`.trim();

class WorkerError extends Error {}

async function jsonRequest(fetchImplementation: typeof fetch, url: string, init: RequestInit, timeoutMs: number) {
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

async function rpc(fetchImplementation: typeof fetch, supabaseUrl: string, secretKey: string, name: string, body: JsonRecord) {
  return await jsonRequest(fetchImplementation, `${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { accept: "application/json", apikey: secretKey, "content-type": "application/json" },
    body: JSON.stringify(body),
  }, 8_000);
}

function sameStringSet(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && [...left].sort().every((value, index) => value === [...right].sort()[index]);
}

function numericTokens(value: string) {
  return value.match(/\b\d+(?:\.\d+)?%?\b/g) ?? [];
}

function assertCommunicatorIntegrity(
  maker: z.infer<typeof recoveryRoomArtifactSchema>,
  plan: z.infer<typeof communicationPlanSchema>,
) {
  if (maker.communicator_handoff.available_channels.length === 0) {
    throw new WorkerError("channel_integrity_failed");
  }
  if (!sameStringSet(plan.inherited_boundaries.available_channels, maker.communicator_handoff.available_channels)
    || !sameStringSet(plan.inherited_boundaries.prohibited_claims, maker.communicator_handoff.prohibited_claims)
    || !sameStringSet(plan.inherited_boundaries.required_disclosures, maker.communicator_handoff.required_disclosures)) {
    throw new WorkerError("boundary_integrity_failed");
  }
  const sourceClaims = new Map(maker.communicator_handoff.supported_claims.map((claim) => [claim.claim, claim]));
  for (const message of plan.message_claims) {
    const sources = message.source_claims.map((claim) => sourceClaims.get(claim));
    if (sources.some((source) => !source)) throw new WorkerError("claim_integrity_failed");
    const typedSources = sources.filter((source): source is NonNullable<typeof source> => Boolean(source));
    const allowedEvidence = new Set(typedSources.flatMap((source) => source.source_evidence_keys));
    if (message.evidence_keys.some((key) => !allowedEvidence.has(key))) throw new WorkerError("evidence_integrity_failed");
    const allowedNumbers = new Set(typedSources.flatMap((source) => numericTokens(source.claim)));
    if (numericTokens(message.message).some((number) => !allowedNumbers.has(number))) throw new WorkerError("numeric_integrity_failed");
  }
  const customerCopy = JSON.stringify({
    thesis: plan.campaign_thesis,
    invitation: plan.invitation,
    claims: plan.message_claims.map((claim) => claim.message),
    transparency: plan.transparency,
  });
  if (/act now|limited time|last chance|don't miss|urgent|win[- ]?back|churn(?:ing|ed)?|save your account|at risk/i.test(customerCopy)) {
    throw new WorkerError("coercion_integrity_failed");
  }
  if (/personal usage|individual usage|explains? why|identif(?:y|ies) the cause|caused by|guarantee[ds]?/i.test(customerCopy)) {
    throw new WorkerError("claim_integrity_failed");
  }
  if (/[a-z]+:[a-z0-9-]+:[a-z0-9_-]+(?::[a-z0-9-]+)?/i.test(customerCopy)) {
    throw new WorkerError("identifier_exposure_failed");
  }
  if (/book|buy|upgrade|schedule|call|share/i.test(plan.invitation.cta_label)) {
    throw new WorkerError("external_action_integrity_failed");
  }
  const completeSentences = [
    ...plan.invitation.body_paragraphs,
    plan.transparency.why_received,
    plan.transparency.data_boundary,
    plan.transparency.choice_statement,
  ];
  if (completeSentences.some((value) => !/[.!?]["']?$/.test(value.trim()))) throw new WorkerError("copy_integrity_failed");
  if (plan.status !== "ready_for_manager" || plan.follow_up_policy !== "none_without_new_explicit_consent") {
    throw new WorkerError("external_action_integrity_failed");
  }
}

function safeFailureReason(error: unknown) {
  if (error instanceof WorkerError && error.message === "upstream_429") {
    return "Communicator paused because the model provider is temporarily rate limited.";
  }
  if (error instanceof WorkerError && error.message === "channel_integrity_failed") {
    return "Communicator stopped because the sealed Maker artefact contains no permitted communication channel.";
  }
  if (error instanceof WorkerError && error.message === "boundary_integrity_failed") {
    return "Communicator stopped because the copied Maker boundary did not remain byte-for-byte equivalent.";
  }
  if (error instanceof WorkerError && ["claim_integrity_failed", "evidence_integrity_failed", "numeric_integrity_failed"].includes(error.message)) {
    return "Communicator stopped because an evidence-linked message did not validate exactly against the sealed Maker claims.";
  }
  if (error instanceof WorkerError && ["coercion_integrity_failed", "identifier_exposure_failed", "external_action_integrity_failed", "copy_integrity_failed"].includes(error.message)) {
    return "Communicator stopped because the compiled invitation did not satisfy a communication-safety rule.";
  }
  if (error instanceof SyntaxError) return "Communicator stopped because the model response was not valid structured JSON.";
  if (error instanceof z.ZodError) {
    const path = error.issues[0]?.path.map(String).join(".").slice(0, 120) || "root";
    return `Communicator stopped because the model response did not satisfy the Communication Plan contract at ${path}.`;
  }
  return "Communicator could not produce a validated communication plan and stopped safely.";
}

function diagnosticCode(error: unknown) {
  if (error instanceof WorkerError) return error.message;
  if (error instanceof z.ZodError) return `contract_validation_failed:${error.issues[0]?.path.map(String).join(".") || "root"}`;
  if (error instanceof SyntaxError) return "model_json_invalid";
  return "unexpected_worker_error";
}

export type HostedCommunicatorResult =
  | { status: "not_claimed"; reason: string }
  | { status: "completed"; artifactHash: string }
  | { status: "failed" };

export async function executeHostedCommunicator(options: {
  runId: string;
  supabaseUrl: string;
  secretKey: string;
  openRouterApiKey: string;
  requestedModel: string;
  fetchImplementation?: typeof fetch;
}): Promise<HostedCommunicatorResult> {
  const parsed = inputSchema.parse({
    runId: options.runId,
    supabaseUrl: options.supabaseUrl,
    secretKey: options.secretKey,
    openRouterApiKey: options.openRouterApiKey,
    requestedModel: options.requestedModel,
  });
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const claim = claimSchema.parse(await rpc(fetchImplementation, parsed.supabaseUrl, parsed.secretKey, "claim_agent_run_communicator", {
    p_run_id: parsed.runId,
  }));
  if (!claim.claimed) return { status: "not_claimed", reason: claim.reason };

  try {
    const maker = recoveryRoomArtifactSchema.parse(claim.predecessor_artifact);
    if (maker.status !== "ready_for_communication" || maker.run_id !== parsed.runId || maker.account_slug !== claim.account_slug) {
      throw new WorkerError("predecessor_integrity_failed");
    }
    const modelPayload = await jsonRequest(fetchImplementation, "https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${parsed.openRouterApiKey}`,
        "content-type": "application/json",
        "http-referer": "https://dnyanesh1999.github.io/retentionlab-agentic-organisation/",
        "x-title": "RetentionLab Hosted Communicator",
      },
      body: JSON.stringify({
        model: parsed.requestedModel,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: [
            "Create the compact editorial delta from this immutable sealed Maker artefact:",
            JSON.stringify({ run_id: parsed.runId, recovery_room_artifact: maker }),
            "No communication has been sent and the Manager retains the human approval gate.",
          ].join("\n\n") },
        ],
        stream: false,
        temperature: 0.1,
        max_tokens: 3_500,
        reasoning_effort: "none",
        provider: { require_parameters: true },
        response_format: {
          type: "json_schema",
          json_schema: { name: "retentionlab_communicator_editorial_delta", strict: true, schema: z.toJSONSchema(editorialDeltaSchema) },
        },
      }),
    }, 110_000);
    const normalized = typeof modelPayload === "string" ? JSON.parse(modelPayload) : modelPayload;
    const model = openRouterResponseSchema.parse(normalized);
    if (model.choices[0].finish_reason === "length") throw new WorkerError("model_truncated");
    const rawCandidate = JSON.parse(model.choices[0].message.content) as JsonRecord;
    const canonicalKeys = new Set(Object.keys(editorialDeltaSchema.shape));
    const delta = editorialDeltaSchema.parse(Object.fromEntries(Object.entries(rawCandidate).filter(([key]) => canonicalKeys.has(key))));
    const messageClaims = maker.communicator_handoff.supported_claims.map((source) => ({
      message: source.claim,
      source_claims: [source.claim],
      evidence_keys: source.source_evidence_keys,
      qualification: source.qualification,
    }));
    const selectedChannel = maker.communicator_handoff.available_channels.find((channel) => channel.trim().toLowerCase() === "email")
      ?? maker.communicator_handoff.available_channels[0];
    const plan = communicationPlanSchema.parse({
      schema_version: "communication-plan.v1",
      stage: "communicator",
      status: "ready_for_manager",
      agent: { id: "communicator", name: "Maeve Quinn", personality: "plain-spoken, empathetic, evidence-disciplined" },
      run_id: parsed.runId,
      account_slug: maker.account_slug,
      source: {
        maker_schema_version: maker.schema_version,
        maker_prompt_version: maker.provenance.prompt_version,
        maker_generated_at: maker.provenance.generated_at,
        maker_artifact_sha256: claim.predecessor_hash,
        implementation_commit_sha: maker.implementation_evidence.commit_sha,
      },
      inherited_boundaries: {
        available_channels: maker.communicator_handoff.available_channels,
        prohibited_claims: maker.communicator_handoff.prohibited_claims,
        required_disclosures: maker.communicator_handoff.required_disclosures,
      },
      campaign_thesis: "Offer a calm, evidence-bounded invitation to inspect aggregate account signals without pressure or automated follow-up.",
      tone_rules: [
        "Describe aggregate observations without judgement or causal language.",
        "Keep the decline path as visible as the optional invitation.",
        "Never imply urgency, certainty or a promised outcome.",
      ],
      invitation: {
        channel: selectedChannel,
        headline: "An optional review of your Recovery Room",
        preview: "Inspect aggregate account signals at your own pace; no action is required.",
        body_paragraphs: [
          "We are inviting you to review an optional Recovery Room built from aggregate account-level product and support signals.",
          "You can inspect the context, choose a path or leave without taking action; declining triggers no follow-up.",
        ],
        cta_label: "View Recovery Room",
        landing_route: "#/cases/recovery-room",
      },
      message_claims: messageClaims,
      transparency: {
        why_received: "This is one optional invitation to inspect aggregate account signals relevant to the existing service relationship.",
        data_boundary: "The experience uses aggregate account evidence and does not profile an individual or diagnose a cause.",
        choice_statement: "Opening, declining or ignoring the invitation creates no obligation and triggers no automatic follow-up.",
      },
      follow_up_policy: "none_without_new_explicit_consent",
      measurement_plan: [
        { signal: "Voluntary Recovery Room entry", interpretation: "The invitation was clear enough for optional inspection.", guardrail: "Non-entry is not failure and never triggers follow-up." },
        { signal: "Consent integrity", interpretation: "Every interaction stayed within the customer's explicit choices.", guardrail: "Any unapproved external action invalidates campaign success." },
      ],
      manager_handoff: {
        launch_recommendation: "proceed_to_review",
        executive_summary: delta.executive_summary,
        decision_questions: [
          "Does the invitation remain proportionate to the evidence and recorded customer preference?",
          "Can operational owners guarantee the decline path and no-follow-up boundary?",
        ],
        operational_dependencies: ["A verified Recovery Room route and a human-approved, one-time email capability."],
        risks: [
          { risk: "Aggregate evidence could be read as a personal diagnosis.", mitigation: "Keep aggregate qualifications and the data boundary visible in every review." },
          { risk: "A recovery invitation could create unwanted pressure.", mitigation: "Require human approval and retain an equally clear decline path with no follow-up." },
        ],
      },
      provenance: {
        provider: "openrouter",
        requested_model: parsed.requestedModel,
        resolved_model: model.model,
        prompt_version: PROMPT_VERSION,
        generated_at: new Date().toISOString(),
      },
    });
    assertCommunicatorIntegrity(maker, plan);
    const canonical = JSON.stringify(plan);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
    const artifactHash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const publicSummary = `Communicator sealed one consent-bound ${selectedChannel} invitation with ${plan.message_claims.length} evidence-linked claims; no communication was sent.`;
    const completion = await rpc(fetchImplementation, parsed.supabaseUrl, parsed.secretKey, "complete_agent_run_communicator", {
      p_run_id: parsed.runId,
      p_lease_token: claim.lease_token,
      p_artifact: plan,
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
    console.error(`Hosted Communicator failed: ${diagnosticCode(error)}.`);
    try {
      await rpc(fetchImplementation, parsed.supabaseUrl, parsed.secretKey, "fail_agent_run_stage", {
        p_run_id: parsed.runId,
        p_lease_token: claim.lease_token,
        p_stage: "communicator",
        p_reason: safeFailureReason(error),
      });
    } catch {
      console.error("Hosted Communicator could not persist its bounded failure event.");
    }
    return { status: "failed" };
  }
}
