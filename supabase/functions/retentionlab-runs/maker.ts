import { z } from "npm:zod@4.4.3";

import { recoveryDesignSpecificationSchema } from "./designer.ts";

const PROMPT_VERSION = "maker.v1.1.0" as const;
const SCHEMA_VERSION = "recovery-room-artifact.v1" as const;
const REVIEWED_COMPONENTS = [
  "SignalStrand",
  "SignalCanvas",
  "LoadingState",
  "ReadyState",
  "ActiveInspection",
  "ClarificationModal",
  "SuccessState",
  "DeclinedState",
  "ErrorState",
  "ReducedMotionState",
] as const;
const REQUIRED_STATES = ["loading", "ready", "active", "success", "declined", "error", "reduced_motion"] as const;
const REVIEWED_IMPLEMENTATION = {
  commit_sha: "c38febd",
  route: "#/cases/recovery-room",
  framework: "React 19 + TypeScript + CSS",
  component_sources: [
    { contract_component: "SignalStrand", source_path: "src/features/recovery-room/SignalStrand.tsx" },
    { contract_component: "SignalCanvas", source_path: "src/features/recovery-room/SignalCanvas.tsx" },
    { contract_component: "LoadingState", source_path: "src/features/recovery-room/LoadingState.tsx" },
    { contract_component: "ReadyState", source_path: "src/features/recovery-room/RecoveryRoomView.tsx" },
    { contract_component: "ActiveInspection", source_path: "src/features/recovery-room/SignalCanvas.tsx" },
    { contract_component: "ClarificationModal", source_path: "src/features/recovery-room/ClarificationDialog.tsx" },
    { contract_component: "SuccessState", source_path: "src/features/recovery-room/AcknowledgmentBanner.tsx" },
    { contract_component: "DeclinedState", source_path: "src/features/recovery-room/AcknowledgmentBanner.tsx" },
    { contract_component: "ErrorState", source_path: "src/features/recovery-room/ClarificationDialog.tsx" },
    { contract_component: "ReducedMotionState", source_path: "src/features/recovery-room/SignalStrand.tsx" },
  ],
  implemented_states: [...REQUIRED_STATES],
  verification: {
    test_command: "npm test -- --run",
    test_count: 114,
    test_status: "passed",
    build_command: "npm run build",
    build_status: "passed",
    visual_evidence: [
      "design/reference/signal-garden-slice5-acknowledgment-desktop.png",
      "design/reference/signal-garden-slice5-acknowledgment-mobile.png",
    ],
  },
} as const;

type JsonRecord = Record<string, unknown>;

const inputSchema = z.object({
  runId: z.uuid(),
  supabaseUrl: z.url(),
  secretKey: z.string().min(12),
  openRouterApiKey: z.string().min(20),
  requestedModel: z.string().min(1).max(160),
}).strict();

const accountSlugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80);
const evidenceKeySchema = z.string().regex(/^[a-z]+:[a-z0-9-]+:[a-z0-9_-]+(?::[a-z0-9-]+)?$/).max(160);
const interactionStateSchema = z.enum(REQUIRED_STATES);
const designerPromptVersionSchema = z.enum([
  "designer.v1.0.0",
  "designer.v1.1.0",
  "designer.v1.2.0",
  "designer.v1.3.0",
  "designer.v1.4.0",
  "designer.v1.5.0",
  "designer.v1.6.0",
  "designer.v1.7.0",
  "designer.v1.8.0",
]);

const supportedClaimSchema = z.object({
  claim: z.string().min(10).max(300),
  source_evidence_keys: z.array(evidenceKeySchema).min(1).max(8),
  qualification: z.string().min(8).max(240),
}).strict();

const experienceDefinitionSchema = z.object({
  name: z.string().min(3).max(100),
  customer_promise: z.string().min(15).max(240),
  interaction_model: z.enum(["guided_story", "progressive_reveal", "choice_canvas", "adaptive_path"]),
  regions: z.array(z.object({
    region_id: z.string().regex(/^[a-z][a-z0-9-]*$/),
    implemented_behavior: z.string().min(12).max(400),
  }).strict()).min(3).max(8),
  state_transitions: z.array(z.object({
    from: interactionStateSchema,
    event: z.string().min(3).max(100),
    to: interactionStateSchema,
    customer_control: z.string().min(8).max(240),
  }).strict()).min(4).max(16),
}).strict();

const makerImplementationEvidenceSchema = z.object({
  commit_sha: z.string().regex(/^[a-f0-9]{7,40}$/),
  route: z.literal("#/cases/recovery-room"),
  framework: z.literal("React 19 + TypeScript + CSS"),
  component_sources: z.array(z.object({
    contract_component: z.string().regex(/^[A-Z][A-Za-z0-9]+$/),
    source_path: z.string().regex(/^(src|design)\/[A-Za-z0-9_./-]+$/),
  }).strict()).min(3).max(20),
  implemented_states: z.array(interactionStateSchema).min(7).max(7),
  verification: z.object({
    test_command: z.string().min(3).max(200),
    test_count: z.number().int().positive(),
    test_status: z.literal("passed"),
    build_command: z.string().min(3).max(200),
    build_status: z.literal("passed"),
    visual_evidence: z.array(z.string().regex(/^design\/[A-Za-z0-9_./-]+\.png$/)).min(2).max(12),
  }).strict(),
}).strict();

const communicatorHandoffSchema = z.object({
  product_name: z.string().min(3).max(100),
  audience: z.string().min(10).max(240),
  customer_value: z.string().min(20).max(500),
  supported_claims: z.array(supportedClaimSchema).min(1).max(10),
  required_disclosures: z.array(z.string().min(8).max(300)).min(2).max(10),
  available_channels: z.array(z.string().min(1).max(40)).max(10),
  prohibited_claims: z.array(z.string().min(3).max(240)).min(1).max(10),
}).strict();

export const recoveryRoomArtifactSchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  stage: z.literal("maker"),
  status: z.enum(["ready_for_communication", "needs_design_revision"]),
  agent: z.object({
    id: z.literal("maker"),
    name: z.literal("Noor Patel"),
    personality: z.literal("pragmatic, meticulous, accessibility-first"),
  }).strict(),
  run_id: z.uuid(),
  account_slug: accountSlugSchema,
  build_summary: z.string().min(30).max(1_200),
  experience_definition: experienceDefinitionSchema,
  source: z.object({
    design_schema_version: z.literal("recovery-design.v1"),
    design_prompt_version: designerPromptVersionSchema,
    design_generated_at: z.iso.datetime({ offset: true }),
    design_artifact_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  }).strict(),
  inherited_guardrails: z.object({
    allowed_channels: z.array(z.string().min(1).max(40)).max(10),
    prohibited_actions: z.array(z.string().min(3).max(240)).min(1).max(10),
  }).strict(),
  implementation_evidence: makerImplementationEvidenceSchema,
  communicator_handoff: communicatorHandoffSchema,
  residual_risks: z.array(z.object({
    risk: z.string().min(10).max(300),
    control: z.string().min(10).max(300),
  }).strict()).min(1).max(8),
  provenance: z.object({
    provider: z.literal("openrouter"),
    requested_model: z.string().min(1).max(160),
    resolved_model: z.string().min(1).max(160),
    prompt_version: z.literal(PROMPT_VERSION),
    generated_at: z.iso.datetime({ offset: true }),
  }).strict(),
}).strict();

const buildDeltaSchema = z.object({
  build_summary: recoveryRoomArtifactSchema.shape.build_summary,
  product_name: communicatorHandoffSchema.shape.product_name,
  audience: communicatorHandoffSchema.shape.audience,
  customer_value: communicatorHandoffSchema.shape.customer_value,
  supported_claims: z.array(supportedClaimSchema).min(1).max(6),
  required_disclosures: z.array(z.string().min(8).max(300)).min(2).max(6),
  residual_risks: recoveryRoomArtifactSchema.shape.residual_risks.max(6),
}).strict();

const claimSchema = z.union([
  z.object({ claimed: z.literal(false), reason: z.string() }).passthrough(),
  z.object({
    claimed: z.literal(true),
    lease_token: z.uuid(),
    run_id: z.uuid(),
    account_slug: z.string(),
    predecessor_artifact: recoveryDesignSpecificationSchema,
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
You are Noor Patel, the Maker in RetentionLab's five-agent organisation.
Prompt version: ${PROMPT_VERSION}.

You are pragmatic, meticulous and accessibility-first. Turn Luca Moretti's reviewed and sealed
RecoveryDesignSpecification into a precise Communicator handoff and an honest build narrative. The
design specification is your only design and evidence authority.

NON-NEGOTIABLES
1. Treat the Designer specification as the only design and evidence authority.
2. Preserve every consent boundary, prohibited action, evidence binding and interaction state.
   Consent is not a creative variable. Policy code re-seals guardrails, lineage and identity.
3. Never invent customer facts, feature-level activity, contact details, outcomes or performance.
4. Every supported communication claim must cite evidence keys already present in the Designer handoff.
5. Product signals are aggregate account-level observations. Never call them personal, individual,
   user-level, diagnostic or causal, and never imply they explain why a change happened.
6. Keep technical implementation assertions (ARIA roles, animation behavior, component or modal
   details) inside the build summary. They are not customer evidence claims for the Communicator.
7. A decline is a complete valid outcome. Add no pressure, urgency, dark patterns or sales CTA.

Return only the compact build delta matching the supplied strict schema. Policy code will attach the
verified experience definition, seven interaction states, reviewed component inventory, inherited
guardrails, implementation evidence, Designer hash lineage and provenance.
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

function allowedEvidenceKeys(specification: z.infer<typeof recoveryDesignSpecificationSchema>) {
  return new Set([
    ...specification.experience_principles.flatMap((principle) => principle.source_evidence_keys),
    ...specification.journey.flatMap((step) => step.source_evidence_keys),
    ...specification.maker_handoff.data_bindings.map((binding) => binding.evidence_key),
  ]);
}

function sameStringSet(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && [...left].sort().every((value, index) => value === [...right].sort()[index]);
}

function assertMakerIntegrity(
  specification: z.infer<typeof recoveryDesignSpecificationSchema>,
  artifact: z.infer<typeof recoveryRoomArtifactSchema>,
) {
  const allowedEvidence = allowedEvidenceKeys(specification);
  for (const claim of artifact.communicator_handoff.supported_claims) {
    if (claim.source_evidence_keys.some((key) => !allowedEvidence.has(key))) {
      throw new WorkerError("lineage_integrity_failed");
    }
  }
  const communicationText = JSON.stringify({
    audience: artifact.communicator_handoff.audience,
    value: artifact.communicator_handoff.customer_value,
    claims: artifact.communicator_handoff.supported_claims,
  });
  if (/personal usage|individual usage|user-level signal|explains? why|identif(?:y|ies) the cause|caused by|causal insight/i.test(communicationText)) {
    throw new WorkerError("claim_integrity_failed");
  }
  const claimText = artifact.communicator_handoff.supported_claims.map((claim) => claim.claim).join(" ");
  if (/aria-|role\s*=|prefers-reduced-motion|progress bar|component|modal design/i.test(claimText)) {
    throw new WorkerError("claim_integrity_failed");
  }
  if (!sameStringSet(artifact.inherited_guardrails.allowed_channels, specification.consent_design.inherited_allowed_channels)) {
    throw new WorkerError("consent_integrity_failed");
  }
  if (!sameStringSet(artifact.inherited_guardrails.prohibited_actions, specification.consent_design.inherited_prohibited_actions)) {
    throw new WorkerError("consent_integrity_failed");
  }
  const requiredComponents = new Set(specification.maker_handoff.reusable_components);
  const implementedComponents = new Set(artifact.implementation_evidence.component_sources.map((item) => item.contract_component));
  if ([...requiredComponents].some((component) => !implementedComponents.has(component))) {
    throw new WorkerError("component_integrity_failed");
  }
  if (!sameStringSet(artifact.implementation_evidence.implemented_states, specification.maker_handoff.interaction_states)) {
    throw new WorkerError("state_integrity_failed");
  }
  const requiredRegions = new Set(specification.content_architecture.map((region) => region.region_id));
  const implementedRegions = new Set(artifact.experience_definition.regions.map((region) => region.region_id));
  if ([...requiredRegions].some((region) => !implementedRegions.has(region))) {
    throw new WorkerError("region_integrity_failed");
  }
}

function safeFailureReason(error: unknown) {
  if (error instanceof WorkerError && error.message === "upstream_429") {
    return "Maker paused because the model provider is temporarily rate limited.";
  }
  if (error instanceof WorkerError && error.message.endsWith("_integrity_failed")) {
    return "Maker stopped because the proposed build did not preserve verified Designer lineage or safety constraints.";
  }
  if (error instanceof SyntaxError) return "Maker stopped because the model response was not valid structured JSON.";
  if (error instanceof z.ZodError) {
    const path = error.issues[0]?.path.map(String).join(".").slice(0, 120) || "root";
    return `Maker stopped because the model response did not satisfy the Recovery Room contract at ${path}.`;
  }
  return "Maker could not produce a validated recovery build and stopped safely.";
}

function diagnosticCode(error: unknown) {
  if (error instanceof WorkerError) return error.message;
  if (error instanceof z.ZodError) {
    const issue = error.issues[0];
    const path = issue?.path.map(String).join(".") || "root";
    const keys = issue && "keys" in issue && Array.isArray(issue.keys) ? issue.keys.join(",") : "none";
    return `contract_validation_failed:${issue?.code ?? "unknown"}:${path}:${keys}`;
  }
  if (error instanceof SyntaxError) return "model_json_invalid";
  return "unexpected_worker_error";
}

export type HostedMakerResult =
  | { status: "not_claimed"; reason: string }
  | { status: "completed"; artifactHash: string }
  | { status: "failed" };

export async function executeHostedMaker(options: {
  runId: string;
  supabaseUrl: string;
  secretKey: string;
  openRouterApiKey: string;
  requestedModel: string;
  fetchImplementation?: typeof fetch;
}): Promise<HostedMakerResult> {
  const parsed = inputSchema.parse({
    runId: options.runId,
    supabaseUrl: options.supabaseUrl,
    secretKey: options.secretKey,
    openRouterApiKey: options.openRouterApiKey,
    requestedModel: options.requestedModel,
  });
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const claim = claimSchema.parse(await rpc(fetchImplementation, parsed.supabaseUrl, parsed.secretKey, "claim_agent_run_maker", {
    p_run_id: parsed.runId,
  }));
  if (!claim.claimed) return { status: "not_claimed", reason: claim.reason };

  try {
    const specification = recoveryDesignSpecificationSchema.parse(claim.predecessor_artifact);
    if (specification.status !== "ready_for_maker" || specification.run_id !== parsed.runId || specification.account_slug !== claim.account_slug) {
      throw new WorkerError("predecessor_integrity_failed");
    }
    const evidenceKeys = [...allowedEvidenceKeys(specification)];
    const modelPayload = await jsonRequest(fetchImplementation, "https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${parsed.openRouterApiKey}`,
        "content-type": "application/json",
        "http-referer": "https://dnyanesh1999.github.io/retentionlab-agentic-organisation/",
        "x-title": "RetentionLab Hosted Maker",
      },
      body: JSON.stringify({
        model: parsed.requestedModel,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              "Build the Maker handoff from this immutable sealed RecoveryDesignSpecification:",
              JSON.stringify({ run_id: parsed.runId, design_specification: specification }),
              "SUPPORTED CLAIMS may cite ONLY these Designer evidence keys:",
              JSON.stringify(evidenceKeys),
              "Policy code will attach this verified reviewed component inventory and seven interaction states:",
              JSON.stringify({ reusable_components: REVIEWED_COMPONENTS, interaction_states: REQUIRED_STATES }),
            ].join("\n\n"),
          },
        ],
        stream: false,
        temperature: 0.1,
        max_tokens: 4_500,
        reasoning_effort: "none",
        provider: { require_parameters: true },
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "retentionlab_maker_build_delta",
            strict: true,
            schema: z.toJSONSchema(buildDeltaSchema),
          },
        },
      }),
    }, 110_000);

    // OpenRouter normally returns an object envelope. Some free routes wrap
    // that envelope once as a JSON string for large structured responses.
    const normalizedModelPayload = typeof modelPayload === "string" ? JSON.parse(modelPayload) : modelPayload;
    const model = openRouterResponseSchema.parse(normalizedModelPayload);
    if (model.choices[0].finish_reason === "length") throw new WorkerError("model_truncated");
    const rawCandidate = JSON.parse(model.choices[0].message.content) as JsonRecord;
    // Some free providers append harmless root metadata despite a strict schema.
    // Strip only unknown root keys; every canonical and nested field remains strict.
    const canonicalRootKeys = new Set(Object.keys(buildDeltaSchema.shape));
    const candidate = Object.fromEntries(Object.entries(rawCandidate).filter(([key]) => canonicalRootKeys.has(key)));
    const delta = buildDeltaSchema.parse(candidate);

    const allowedChannels = specification.consent_design.inherited_allowed_channels;
    const prohibitedActions = specification.consent_design.inherited_prohibited_actions;
    const artifact = recoveryRoomArtifactSchema.parse({
      schema_version: SCHEMA_VERSION,
      stage: "maker",
      status: "ready_for_communication",
      agent: { id: "maker", name: "Noor Patel", personality: "pragmatic, meticulous, accessibility-first" },
      run_id: parsed.runId,
      account_slug: specification.account_slug,
      build_summary: delta.build_summary,
      experience_definition: {
        name: specification.recovery_concept.name,
        customer_promise: specification.recovery_concept.one_line_promise,
        interaction_model: specification.recovery_concept.interaction_model,
        regions: specification.content_architecture.map((region) => ({
          region_id: region.region_id,
          implemented_behavior: `Implements ${region.label} as an inspect-only region: ${region.purpose}`.slice(0, 400),
        })),
        state_transitions: [
          { from: "loading", event: "evidence_ready", to: "ready", customer_control: "The customer waits with a non-blocking status and can leave at any time." },
          { from: "ready", event: "inspect_signal", to: "active", customer_control: "The customer explicitly activates a cited signal to inspect it." },
          { from: "active", event: "confirm_choice", to: "success", customer_control: "The customer confirms an optional next step; nothing runs automatically." },
          { from: "active", event: "decline", to: "declined", customer_control: "Declining is a complete outcome and preserves the persistent exit." },
          { from: "loading", event: "load_failure", to: "error", customer_control: "An error offers a safe retry and never obscures the exit." },
          { from: "ready", event: "reduce_motion", to: "reduced_motion", customer_control: "Reduced-motion parity renders final states without animation." },
        ],
      },
      source: {
        design_schema_version: specification.schema_version,
        design_prompt_version: specification.provenance.prompt_version,
        design_generated_at: specification.provenance.generated_at,
        design_artifact_sha256: claim.predecessor_hash,
      },
      inherited_guardrails: {
        allowed_channels: allowedChannels,
        prohibited_actions: prohibitedActions,
      },
      implementation_evidence: REVIEWED_IMPLEMENTATION,
      communicator_handoff: {
        product_name: delta.product_name,
        audience: delta.audience,
        customer_value: delta.customer_value,
        supported_claims: delta.supported_claims,
        required_disclosures: delta.required_disclosures,
        available_channels: allowedChannels,
        prohibited_claims: prohibitedActions,
      },
      residual_risks: delta.residual_risks,
      provenance: {
        provider: "openrouter",
        requested_model: parsed.requestedModel,
        resolved_model: model.model,
        prompt_version: PROMPT_VERSION,
        generated_at: new Date().toISOString(),
      },
    });
    assertMakerIntegrity(specification, artifact);
    if (artifact.status !== "ready_for_communication") throw new WorkerError("design_revision_requested");

    const canonical = JSON.stringify(artifact);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
    const artifactHash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const publicSummary = `Maker sealed a verified Recovery Room across ${artifact.implementation_evidence.implemented_states.length} interaction states, ${artifact.implementation_evidence.component_sources.length} reviewed components and ${artifact.communicator_handoff.supported_claims.length} evidence-backed claims.`;

    const completion = await rpc(fetchImplementation, parsed.supabaseUrl, parsed.secretKey, "complete_agent_run_maker", {
      p_run_id: parsed.runId,
      p_lease_token: claim.lease_token,
      p_artifact: artifact,
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
    console.error(`Hosted Maker failed: ${diagnosticCode(error)}.`);
    try {
      await rpc(fetchImplementation, parsed.supabaseUrl, parsed.secretKey, "fail_agent_run_stage", {
        p_run_id: parsed.runId,
        p_lease_token: claim.lease_token,
        p_stage: "maker",
        p_reason: safeFailureReason(error),
      });
    } catch {
      console.error("Hosted Maker could not persist its bounded failure event.");
    }
    return { status: "failed" };
  }
}
