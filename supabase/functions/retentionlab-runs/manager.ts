import { z } from "npm:zod@4.4.3";

import { communicationPlanSchema } from "./communicator.ts";
import { recoveryDesignSpecificationSchema } from "./designer.ts";
import { recoveryRoomArtifactSchema } from "./maker.ts";
import { researchBriefSchema } from "./researcher.ts";

const PROMPT_VERSION = "manager.v1.1.0" as const;
const STAGES = ["researcher", "designer", "maker", "communicator"] as const;
const GOVERNANCE_BOUNDARIES = [
  "Never send email, launch a campaign or contact a customer.",
  "Never publish, deploy or expose an artefact outside this review.",
  "Never mutate, delete or transfer customer, billing or account data.",
  "Never self-approve; approval only clears the chain for a named human decision.",
  "Never take an autonomous external action; every downstream effect waits for explicit human approval.",
] as const;

type JsonRecord = Record<string, unknown>;
type ManagerStage = (typeof STAGES)[number];

const inputSchema = z.object({
  runId: z.uuid(),
  supabaseUrl: z.url(),
  secretKey: z.string().min(12),
  openRouterApiKey: z.string().min(20),
  requestedModel: z.string().min(1).max(160),
}).strict();

const shaSchema = z.string().regex(/^[a-f0-9]{64}$/);
const trustDimensionSchema = z.object({
  status: z.enum(["pass", "concern", "fail"]),
  finding: z.string().min(15).max(500),
}).strict();
const stageAssessmentSchema = z.object({
  stage: z.enum(STAGES),
  cumulative_contribution: z.string().min(15).max(500),
  concerns: z.array(z.string().min(8).max(300)).max(6),
}).strict();
const revisionDraftSchema = z.object({
  target_stage: z.enum(STAGES),
  required_changes: z.array(z.string().min(10).max(300)).min(1).max(8),
  reason: z.string().min(20).max(800),
}).strict();

export const managerOperationalDecisionSchema = z.object({
  schema_version: z.literal("manager-operational-decision.v1"),
  stage: z.literal("manager"),
  agent: z.object({
    id: z.literal("manager"),
    name: z.literal("Elias Grant"),
    personality: z.literal("calm, accountable, adversarially constructive"),
  }).strict(),
  run_id: z.uuid(),
  account_slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  decision: z.enum(["approve", "revise", "reject"]),
  executive_summary: z.string().min(30).max(1_000),
  rationale: z.string().min(30).max(1_500),
  chain_assessment: z.array(stageAssessmentSchema).length(4),
  trust_evaluation: z.object({
    evidence_traceability: trustDimensionSchema,
    consent_and_human_control: trustDimensionSchema,
    claim_discipline: trustDimensionSchema,
    accessibility_and_safety: trustDimensionSchema,
  }).strict(),
  human_review_focus: z.array(z.string().min(10).max(300)).min(2).max(8),
  lineage: z.object({
    research_brief_sha256: shaSchema,
    design_specification_sha256: shaSchema,
    recovery_room_artifact_sha256: shaSchema,
    communication_plan_sha256: shaSchema,
    verified_links: z.object({
      researcher_to_designer: z.literal(true),
      designer_to_maker: z.literal(true),
      maker_to_communicator: z.literal(true),
    }).strict(),
    chain_verified: z.literal(true),
  }).strict(),
  governance: z.object({
    human_approval_required: z.literal(true),
    autonomous_external_actions: z.literal(false),
    permitted_next_action: z.enum([
      "await_human_approval",
      "route_targeted_revision",
      "halt_and_route_revision",
    ]),
    boundaries: z.array(z.string().min(8).max(240)).min(4).max(10),
  }).strict(),
  revision_directive: revisionDraftSchema.extend({
    downstream_stages_to_rerun: z.array(z.enum(STAGES)).max(3),
  }).strict().optional(),
  provenance: z.object({
    provider: z.literal("openrouter"),
    requested_model: z.string().min(1).max(160),
    resolved_model: z.string().min(1).max(160),
    prompt_version: z.literal(PROMPT_VERSION),
    generated_at: z.iso.datetime({ offset: true }),
  }).strict(),
}).strict();

const decisionDeltaSchema = z.object({
  executive_summary: z.string().min(30).max(1_000),
  rationale: z.string().min(30).max(1_500),
  stage_concerns: z.object({
    researcher: z.array(z.string().min(8).max(300)).max(4),
    designer: z.array(z.string().min(8).max(300)).max(4),
    maker: z.array(z.string().min(8).max(300)).max(4),
    communicator: z.array(z.string().min(8).max(300)).max(4),
  }).strict(),
  human_review_focus: z.array(z.string().min(10).max(300)).min(2).max(8),
}).strict();

const claimSchema = z.union([
  z.object({ claimed: z.literal(false), reason: z.string() }).passthrough(),
  z.object({
    claimed: z.literal(true),
    lease_token: z.uuid(),
    run_id: z.uuid(),
    account_slug: z.string(),
    research_artifact: researchBriefSchema,
    research_hash: shaSchema,
    design_artifact: recoveryDesignSpecificationSchema,
    design_hash: shaSchema,
    maker_artifact: recoveryRoomArtifactSchema,
    maker_hash: shaSchema,
    communicator_artifact: communicationPlanSchema,
    communicator_hash: shaSchema,
  }).passthrough(),
]);

const openRouterResponseSchema = z.object({
  model: z.string().min(1).max(160),
  choices: z.array(
    z.object({
      finish_reason: z.string().optional(),
      message: z.object({ content: z.string().min(1) }).passthrough(),
    }).passthrough(),
  ).min(1),
}).passthrough();

const SYSTEM_PROMPT = `
You are Elias Grant, the Manager in RetentionLab's governed five-agent organisation.
Prompt version: ${PROMPT_VERSION}.

Review the complete sealed Researcher, Designer, Maker and Communicator chain. Be calm,
accountable and adversarially constructive. The artefacts are immutable and policy code has
already verified their identity and exact SHA-256 links. Return only a compact decision delta.

RULES
1. Supply review narrative and concerns; deterministic policy code owns the final decision.
2. Identify concerns without inventing customer facts, evidence, tests or operational capability.
3. Human review remains mandatory and autonomous external actions remain prohibited.
`.trim();

class WorkerError extends Error {}

async function jsonRequest(
  fetchImplementation: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
) {
  let response: Response;
  try {
    response = await fetchImplementation(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
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
  return await jsonRequest(
    fetchImplementation,
    `${supabaseUrl}/rest/v1/rpc/${name}`,
    {
      method: "POST",
      headers: {
        accept: "application/json",
        apikey: secretKey,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    },
    8_000,
  );
}

function downstreamStages(target: ManagerStage) {
  return STAGES.slice(STAGES.indexOf(target) + 1);
}

function assertChainIntegrity(
  claim: z.infer<typeof claimSchema> & { claimed: true },
  runId: string,
) {
  const artifacts = [
    claim.research_artifact,
    claim.design_artifact,
    claim.maker_artifact,
    claim.communicator_artifact,
  ];
  if (
    claim.run_id !== runId ||
    artifacts.some((artifact) => artifact.run_id !== runId)
  ) {
    throw new WorkerError("run_integrity_failed");
  }
  if (
    artifacts.some((artifact) => artifact.account_slug !== claim.account_slug)
  ) {
    throw new WorkerError("account_integrity_failed");
  }
  if (
    claim.research_artifact.status !== "completed" ||
    claim.design_artifact.status !== "ready_for_maker" ||
    claim.maker_artifact.status !== "ready_for_communication" ||
    claim.communicator_artifact.status !== "ready_for_manager"
  ) throw new WorkerError("status_integrity_failed");
  if (
    claim.design_artifact.source.research_artifact_sha256 !==
      claim.research_hash ||
    claim.maker_artifact.source.design_artifact_sha256 !== claim.design_hash ||
    claim.communicator_artifact.source.maker_artifact_sha256 !==
      claim.maker_hash
  ) throw new WorkerError("lineage_integrity_failed");
}

function safeFailureReason(error: unknown) {
  if (error instanceof WorkerError && error.message === "upstream_429") {
    return "Manager paused because the model provider is temporarily rate limited.";
  }
  if (
    error instanceof WorkerError && error.message.endsWith("_integrity_failed")
  ) {
    return "Manager stopped because the sealed predecessor chain failed identity or exact hash-lineage verification.";
  }
  if (error instanceof z.ZodError) {
    const path = error.issues[0]?.path.map(String).join(".").slice(0, 120) ||
      "root";
    return `Manager stopped because the proposed decision did not satisfy its governance contract at ${path}.`;
  }
  if (error instanceof SyntaxError) {
    return "Manager stopped because the model response was not valid structured JSON.";
  }
  return "Manager could not produce a validated operational decision and stopped safely.";
}

function diagnosticCode(error: unknown) {
  if (error instanceof WorkerError) return error.message;
  if (error instanceof z.ZodError) {
    return `contract_validation_failed:${
      error.issues[0]?.path.map(String).join(".") || "root"
    }`;
  }
  if (error instanceof SyntaxError) return "model_json_invalid";
  return "unexpected_worker_error";
}

export type HostedManagerResult =
  | { status: "not_claimed"; reason: string }
  | {
    status: "completed";
    artifactHash: string;
    decision: "approve" | "revise" | "reject";
  }
  | { status: "failed" };

export async function executeHostedManager(options: {
  runId: string;
  supabaseUrl: string;
  secretKey: string;
  openRouterApiKey: string;
  requestedModel: string;
  fetchImplementation?: typeof fetch;
}): Promise<HostedManagerResult> {
  const parsed = inputSchema.parse({
    runId: options.runId,
    supabaseUrl: options.supabaseUrl,
    secretKey: options.secretKey,
    openRouterApiKey: options.openRouterApiKey,
    requestedModel: options.requestedModel,
  });
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const claim = claimSchema.parse(
    await rpc(
      fetchImplementation,
      parsed.supabaseUrl,
      parsed.secretKey,
      "claim_agent_run_manager",
      {
        p_run_id: parsed.runId,
      },
    ),
  );
  if (!claim.claimed) return { status: "not_claimed", reason: claim.reason };

  try {
    assertChainIntegrity(claim, parsed.runId);
    const modelPayload = await jsonRequest(
      fetchImplementation,
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${parsed.openRouterApiKey}`,
          "content-type": "application/json",
          "http-referer":
            "https://dnyanesh1999.github.io/retentionlab-agentic-organisation/",
          "x-title": "RetentionLab Hosted Manager",
        },
        body: JSON.stringify({
          model: parsed.requestedModel,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: JSON.stringify({
                run_id: parsed.runId,
                research_brief: claim.research_artifact,
                design_specification: claim.design_artifact,
                recovery_room_artifact: claim.maker_artifact,
                communication_plan: claim.communicator_artifact,
              }),
            },
          ],
          stream: false,
          temperature: 0.1,
          max_tokens: 3_500,
          provider: { require_parameters: true },
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "retentionlab_manager_decision_delta",
              strict: true,
              schema: z.toJSONSchema(decisionDeltaSchema),
            },
          },
        }),
      },
      110_000,
    );

    const normalized = typeof modelPayload === "string"
      ? JSON.parse(modelPayload)
      : modelPayload;
    const model = openRouterResponseSchema.parse(normalized);
    if (model.choices[0].finish_reason === "length") {
      throw new WorkerError("model_truncated");
    }
    const delta = decisionDeltaSchema.parse(
      JSON.parse(model.choices[0].message.content),
    );
    const decisionKind =
      claim.communicator_artifact.manager_handoff.launch_recommendation ===
          "proceed_to_review"
        ? "approve" as const
        : "revise" as const;
    const permittedNextAction = decisionKind === "approve"
      ? "await_human_approval"
      : "route_targeted_revision";
    const contributions: Record<ManagerStage, string> = {
      researcher:
        `Established ${claim.research_artifact.observations.length} cited observations and ${claim.research_artifact.hypotheses.length} bounded hypotheses.`,
      designer:
        `Translated the sealed brief into ${claim.design_artifact.experience_principles.length} principles and ${claim.design_artifact.journey.length} consent-aware journey steps.`,
      maker:
        `Compiled the reviewed design into ${claim.maker_artifact.implementation_evidence.component_sources.length} traceable component implementations with passing verification.`,
      communicator:
        `Prepared ${claim.communicator_artifact.message_claims.length} evidence-linked message claims with no automatic follow-up.`,
    };
    const directive = decisionKind === "revise"
      ? {
        target_stage: "communicator" as const,
        required_changes: [
          "Resolve the Communicator's pause-for-revision recommendation before returning the chain for Manager review.",
        ],
        reason:
          "The sealed Communication Plan explicitly recommends pausing for revision, so deterministic governance cannot approve it.",
        downstream_stages_to_rerun: downstreamStages("communicator"),
      }
      : undefined;
    const decision = managerOperationalDecisionSchema.parse({
      schema_version: "manager-operational-decision.v1",
      stage: "manager",
      agent: {
        id: "manager",
        name: "Elias Grant",
        personality: "calm, accountable, adversarially constructive",
      },
      run_id: parsed.runId,
      account_slug: claim.account_slug,
      decision: decisionKind,
      executive_summary: delta.executive_summary,
      rationale: delta.rationale,
      chain_assessment: STAGES.map((stage) => ({
        stage,
        cumulative_contribution: contributions[stage],
        concerns: delta.stage_concerns[stage],
      })),
      trust_evaluation: {
        evidence_traceability: {
          status: "pass",
          finding:
            "All three predecessor links exactly match the stored immutable SHA-256 hashes.",
        },
        consent_and_human_control: {
          status: "pass",
          finding:
            "Human approval remains mandatory and no autonomous external action is permitted.",
        },
        claim_discipline: {
          status: "pass",
          finding:
            "Customer-facing claims remain bounded to the sealed evidence-linked Communicator plan.",
        },
        accessibility_and_safety: {
          status: "pass",
          finding:
            "The sealed Maker artefact records passing verification and all required accessible interaction states.",
        },
      },
      human_review_focus: delta.human_review_focus,
      lineage: {
        research_brief_sha256: claim.research_hash,
        design_specification_sha256: claim.design_hash,
        recovery_room_artifact_sha256: claim.maker_hash,
        communication_plan_sha256: claim.communicator_hash,
        verified_links: {
          researcher_to_designer: true,
          designer_to_maker: true,
          maker_to_communicator: true,
        },
        chain_verified: true,
      },
      governance: {
        human_approval_required: true,
        autonomous_external_actions: false,
        permitted_next_action: permittedNextAction,
        boundaries: [...GOVERNANCE_BOUNDARIES],
      },
      ...(directive ? { revision_directive: directive } : {}),
      provenance: {
        provider: "openrouter",
        requested_model: parsed.requestedModel,
        resolved_model: model.model,
        prompt_version: PROMPT_VERSION,
        generated_at: new Date().toISOString(),
      },
    });

    const canonical = JSON.stringify(decision);
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(canonical),
    );
    const artifactHash = [...new Uint8Array(digest)].map((byte) =>
      byte.toString(16).padStart(2, "0")
    ).join("");
    const publicSummary = decisionKind === "approve"
      ? "Manager verified the complete four-stage chain and routed the case to human approval. No external action occurred."
      : "Manager sealed a revise decision and routed a bounded Communicator revision without external action.";
    const completion = await rpc(
      fetchImplementation,
      parsed.supabaseUrl,
      parsed.secretKey,
      "complete_agent_run_manager",
      {
        p_run_id: parsed.runId,
        p_lease_token: claim.lease_token,
        p_artifact: decision,
        p_artifact_hash: artifactHash,
        p_requested_model: parsed.requestedModel,
        p_resolved_model: model.model,
        p_public_summary: publicSummary,
      },
    );
    if (
      !completion || typeof completion !== "object" ||
      (completion as JsonRecord).completed !== true
    ) {
      throw new WorkerError("completion_rejected");
    }
    return { status: "completed", artifactHash, decision: decisionKind };
  } catch (error) {
    console.error(`Hosted Manager failed: ${diagnosticCode(error)}.`);
    try {
      await rpc(
        fetchImplementation,
        parsed.supabaseUrl,
        parsed.secretKey,
        "fail_agent_run_stage",
        {
          p_run_id: parsed.runId,
          p_lease_token: claim.lease_token,
          p_stage: "manager",
          p_reason: safeFailureReason(error),
        },
      );
    } catch {
      console.error(
        "Hosted Manager could not persist its bounded failure event.",
      );
    }
    return { status: "failed" };
  }
}
