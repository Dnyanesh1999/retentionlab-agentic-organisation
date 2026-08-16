import { z } from "npm:zod@4.4.3";

import { researchBriefSchema } from "./researcher.ts";

const PROMPT_VERSION = "designer.v1.8.0" as const;
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

type JsonRecord = Record<string, unknown>;

const inputSchema = z.object({
  runId: z.uuid(),
  supabaseUrl: z.url(),
  secretKey: z.string().min(12),
  openRouterApiKey: z.string().min(20),
  requestedModel: z.string().min(1).max(160),
}).strict();

const evidenceKeySchema = z.string().regex(/^[a-z]+:[a-z0-9-]+:[a-z0-9_-]+(?::[a-z0-9-]+)?$/).max(160);
const sourceEvidenceKeysSchema = z.array(evidenceKeySchema).min(1).max(8);

export const recoveryDesignSpecificationSchema = z.object({
  schema_version: z.literal("recovery-design.v1"),
  stage: z.literal("designer"),
  status: z.enum(["ready_for_maker", "needs_research_revision"]),
  agent: z.object({
    id: z.literal("designer"),
    name: z.literal("Luca Moretti"),
    personality: z.literal("cinematic, systems-minded, ethically exacting"),
  }).strict(),
  run_id: z.uuid(),
  account_slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  source: z.object({
    research_schema_version: z.literal("research-brief.v1"),
    research_prompt_version: z.enum(["researcher.v1.0.0", "researcher.v1.1.0"]),
    research_generated_at: z.iso.datetime({ offset: true }),
    research_artifact_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  }).strict(),
  inherited_research_constraints: z.object({
    priority_outcomes: z.array(z.string().min(5).max(240)).min(1).max(6),
    non_negotiables: z.array(z.string().min(5).max(240)).min(1).max(8),
    success_signals: z.array(z.string().min(5).max(240)).min(1).max(8),
  }).strict(),
  design_thesis: z.string().min(30).max(1_200),
  experience_principles: z.array(z.object({
    name: z.string().min(3).max(100),
    rationale: z.string().min(20).max(500),
    source_evidence_keys: sourceEvidenceKeysSchema,
  }).strict()).min(3).max(6),
  recovery_concept: z.object({
    name: z.string().min(3).max(100),
    one_line_promise: z.string().min(15).max(240),
    interaction_model: z.enum(["guided_story", "progressive_reveal", "choice_canvas", "adaptive_path"]),
    entry_state: z.string().min(15).max(400),
    core_moment: z.string().min(20).max(600),
    exit_state: z.string().min(15).max(400),
  }).strict(),
  journey: z.array(z.object({
    step_id: z.string().regex(/^step-[1-6]$/),
    title: z.string().min(3).max(100),
    customer_goal: z.string().min(10).max(300),
    system_response: z.string().min(15).max(500),
    source_evidence_keys: sourceEvidenceKeysSchema,
    consent_check: z.string().min(10).max(300),
    maker_acceptance_criteria: z.array(z.string().min(8).max(240)).min(1).max(5),
  }).strict()).min(3).max(6),
  content_architecture: z.array(z.object({
    region_id: z.string().regex(/^[a-z][a-z0-9-]*$/),
    label: z.string().min(2).max(80),
    purpose: z.string().min(10).max(300),
    priority: z.enum(["primary", "secondary", "supporting"]),
  }).strict()).min(3).max(8),
  consent_design: z.object({
    inherited_allowed_channels: z.array(z.string().min(1).max(40)).max(10),
    inherited_prohibited_actions: z.array(z.string().min(3).max(240)).min(1).max(10),
    permission_moments: z.array(z.object({
      moment: z.string().min(8).max(200),
      customer_control: z.string().min(8).max(240),
      decline_path: z.string().min(8).max(240),
    }).strict()).min(1).max(5),
    additional_safety_patterns: z.array(z.string().min(8).max(240)).min(1).max(8),
  }).strict(),
  accessibility_requirements: z.object({
    target: z.literal("WCAG 2.2 AA"),
    keyboard: z.array(z.string().min(8).max(240)).min(2).max(8),
    screen_reader: z.array(z.string().min(8).max(240)).min(2).max(8),
    visual: z.array(z.string().min(8).max(240)).min(2).max(8),
    reduced_motion: z.array(z.string().min(8).max(240)).min(2).max(8),
  }).strict(),
  motion_language: z.object({
    intent: z.string().min(15).max(300),
    transitions: z.array(z.string().min(8).max(200)).min(2).max(6),
    reduced_motion_fallback: z.string().min(15).max(300),
  }).strict(),
  measurement_plan: z.array(z.object({
    signal: z.string().min(5).max(160),
    interpretation: z.string().min(10).max(300),
    source_success_signal: z.string().min(5).max(240),
    guardrail: z.string().min(8).max(240),
  }).strict()).min(2).max(8),
  risks_and_mitigations: z.array(z.object({
    risk: z.string().min(10).max(300),
    mitigation: z.string().min(10).max(300),
    escalation_trigger: z.string().min(10).max(300),
  }).strict()).min(2).max(8),
  maker_handoff: z.object({
    build_order: z.array(z.string().min(8).max(240)).min(3).max(10),
    reusable_components: z.array(z.string().min(3).max(120)).min(3).max(12),
    interaction_states: z.array(z.enum(REQUIRED_STATES)).min(5),
    data_bindings: z.array(z.object({
      field_path: z.string().regex(/^[a-z][a-z0-9_.-]*$/),
      evidence_key: evidenceKeySchema,
      display_purpose: z.string().min(8).max(240),
    }).strict()).min(2).max(12),
    acceptance_tests: z.array(z.string().min(10).max(300)).min(4).max(12),
  }).strict(),
  provenance: z.object({
    provider: z.literal("openrouter"),
    requested_model: z.string().min(1).max(160),
    resolved_model: z.string().min(1).max(160),
    prompt_version: z.literal(PROMPT_VERSION),
    generated_at: z.iso.datetime({ offset: true }),
  }).strict(),
}).strict();

const creativeDeltaSchema = z.object({
  design_thesis: recoveryDesignSpecificationSchema.shape.design_thesis,
  experience_principles: recoveryDesignSpecificationSchema.shape.experience_principles.max(4),
  recovery_concept: recoveryDesignSpecificationSchema.shape.recovery_concept,
  journey: recoveryDesignSpecificationSchema.shape.journey.max(4),
  permission_moment: z.object({
    moment: z.string().min(8).max(200),
    customer_control: z.string().min(8).max(240),
    decline_path: z.string().min(8).max(240),
  }).strict(),
  motion_intent: z.string().min(15).max(300),
}).strict();

const claimSchema = z.union([
  z.object({ claimed: z.literal(false), reason: z.string() }).passthrough(),
  z.object({
    claimed: z.literal(true),
    lease_token: z.uuid(),
    run_id: z.uuid(),
    account_slug: z.string(),
    predecessor_artifact: researchBriefSchema,
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
You are Luca Moretti, the Designer in RetentionLab's five-agent organisation.
Prompt version: ${PROMPT_VERSION}.

You are cinematic, systems-minded, and ethically exacting. Transform exactly one sealed
ResearchBrief into a build-ready Recovery Design Specification for the Maker. The ResearchBrief
is your only evidence source. Never invent customer facts, final campaign copy, or an operational
approval.

NON-NEGOTIABLES
1. Use only evidence_key values present in the ResearchBrief.
2. Preserve allowed channels, prohibited actions, priority outcomes, non-negotiables and success
   signals exactly. Consent is not a creative variable.
3. Keep hypotheses uncertain. A design may test one but cannot present it as fact.
4. Design a distinctive, customer-controlled Recovery Room rather than a dashboard or email sequence.
5. Specify WCAG 2.2 AA keyboard, screen-reader, visual and reduced-motion behavior.
6. Motion communicates entry, focus, choice or state change; never use infinite ambient animation.
7. Use all seven interaction states: loading, ready, active, success, declined, error, reduced_motion.
8. Aggregate evidence stays aggregate. Never invent users, features, recency, contact destinations,
   product catalogues, causal relationships, adjustable metrics or decorative metric encodings.
9. Signal strands are inspect-only. No dark patterns, urgency theatre, focus traps or forced continuity.
10. Target React/CSS/SVG and exactly the reviewed component inventory supplied in the task.

Return only the compact creative delta matching the supplied strict schema. Policy code will add
consent, accessibility, measurement, reviewed components, seven states and acceptance tests.
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

function predecessorEvidenceKeys(brief: z.infer<typeof researchBriefSchema>) {
  return new Set([
    ...brief.observations.flatMap((item) => item.citations.map((citation) => citation.evidence_key)),
    ...brief.hypotheses.flatMap((item) => item.supporting_evidence_keys),
    ...brief.consent_boundaries.citations.map((citation) => citation.evidence_key),
  ]);
}

function sameStringSet(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && [...left].sort().every((value, index) => value === [...right].sort()[index]);
}

function assertDesignerIntegrity(
  brief: z.infer<typeof researchBriefSchema>,
  specification: z.infer<typeof recoveryDesignSpecificationSchema>,
) {
  const allowedEvidence = predecessorEvidenceKeys(brief);
  const usedEvidence = [
    ...specification.experience_principles.flatMap((item) => item.source_evidence_keys),
    ...specification.journey.flatMap((item) => item.source_evidence_keys),
    ...specification.maker_handoff.data_bindings.map((item) => item.evidence_key),
  ];
  if (usedEvidence.some((key) => !allowedEvidence.has(key))) throw new WorkerError("evidence_integrity_failed");
  if (!sameStringSet(specification.consent_design.inherited_allowed_channels, brief.consent_boundaries.allowed_channels)) {
    throw new WorkerError("consent_integrity_failed");
  }
  if (!sameStringSet(specification.consent_design.inherited_prohibited_actions, brief.consent_boundaries.prohibited_actions)) {
    throw new WorkerError("consent_integrity_failed");
  }
  const successSignals = new Set(brief.designer_handoff.success_signals);
  if (specification.measurement_plan.some((item) => !successSignals.has(item.source_success_signal))) {
    throw new WorkerError("measurement_integrity_failed");
  }
  const suppliedStates = new Set(specification.maker_handoff.interaction_states);
  if (REQUIRED_STATES.some((state) => !suppliedStates.has(state))) throw new WorkerError("state_integrity_failed");
  if (!sameStringSet(specification.maker_handoff.reusable_components, REVIEWED_COMPONENTS)) {
    throw new WorkerError("component_integrity_failed");
  }
  const implementationText = JSON.stringify({
    concept: specification.recovery_concept,
    journey: specification.journey,
    handoff: specification.maker_handoff,
    motion: specification.motion_language,
    accessibility: specification.accessibility_requirements,
  });
  if (/\b3D\b|feature tree|generated audio|per-feature|feature tour|tool station|mailto:|case owner email|co-variation|weighted average|simulate adjusting|adjusting tension/i.test(implementationText)) {
    throw new WorkerError("design_safety_failed");
  }
  if (specification.motion_language.transitions.some((transition) => /\binfinite\b/i.test(transition))) {
    throw new WorkerError("design_safety_failed");
  }
  const accessibilityText = JSON.stringify({
    journey: specification.journey,
    accessibility: specification.accessibility_requirements,
    tests: specification.maker_handoff.acceptance_tests,
  });
  if (/focus (?:is )?trapped within (?:the )?(?:canvas|page)|tab order .*loops? within (?:the )?canvas|focus order .*looped within (?:the )?canvas/i.test(accessibilityText)) {
    throw new WorkerError("design_safety_failed");
  }
  if (specification.maker_handoff.data_bindings.some((binding) => (
    /case_owner|recipient|support_url/i.test(binding.field_path)
    || /tree density|bird|hill coverage|opacity|brightness|decorative density|fictional object/i.test(binding.display_purpose)
  ))) throw new WorkerError("binding_integrity_failed");
}

function safeFailureReason(error: unknown) {
  if (error instanceof WorkerError && error.message === "upstream_429") {
    return "Designer paused because the model provider is temporarily rate limited.";
  }
  if (error instanceof WorkerError && error.message.endsWith("_integrity_failed")) {
    return "Designer stopped because the proposed design did not preserve verified Researcher lineage or safety constraints.";
  }
  if (error instanceof SyntaxError) return "Designer stopped because the model response was not valid structured JSON.";
  if (error instanceof z.ZodError) {
    const path = error.issues[0]?.path.map(String).join(".").slice(0, 120) || "root";
    return `Designer stopped because the model response did not satisfy the Recovery Design contract at ${path}.`;
  }
  return "Designer could not produce a validated recovery design and stopped safely.";
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

export type HostedDesignerResult =
  | { status: "not_claimed"; reason: string }
  | { status: "completed"; artifactHash: string }
  | { status: "failed" };

export async function executeHostedDesigner(options: {
  runId: string;
  supabaseUrl: string;
  secretKey: string;
  openRouterApiKey: string;
  requestedModel: string;
  fetchImplementation?: typeof fetch;
}): Promise<HostedDesignerResult> {
  const parsed = inputSchema.parse({
    runId: options.runId,
    supabaseUrl: options.supabaseUrl,
    secretKey: options.secretKey,
    openRouterApiKey: options.openRouterApiKey,
    requestedModel: options.requestedModel,
  });
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const claim = claimSchema.parse(await rpc(fetchImplementation, parsed.supabaseUrl, parsed.secretKey, "claim_agent_run_designer", {
    p_run_id: parsed.runId,
  }));
  if (!claim.claimed) return { status: "not_claimed", reason: claim.reason };

  try {
    const brief = researchBriefSchema.parse(claim.predecessor_artifact);
    if (brief.status !== "completed" || brief.run_id !== parsed.runId || brief.account_slug !== claim.account_slug) {
      throw new WorkerError("predecessor_integrity_failed");
    }
    const allowedEvidenceKeys = [...predecessorEvidenceKeys(brief)];
    const modelPayload = await jsonRequest(fetchImplementation, "https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${parsed.openRouterApiKey}`,
        "content-type": "application/json",
        "http-referer": "https://dnyanesh1999.github.io/retentionlab-agentic-organisation/",
        "x-title": "RetentionLab Hosted Designer",
      },
      body: JSON.stringify({
        model: parsed.requestedModel,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              "Create the Designer artefact from this immutable sealed ResearchBrief:",
              JSON.stringify({ run_id: parsed.runId, research_brief: brief }),
              "USE ONLY these evidence keys:",
              JSON.stringify(allowedEvidenceKeys),
              "COPY measurement source_success_signal from:",
              JSON.stringify(brief.designer_handoff.success_signals),
              "Design for this reviewed component inventory; policy code will attach it:",
              JSON.stringify(REVIEWED_COMPONENTS),
            ].join("\n\n"),
          },
        ],
        stream: false,
        temperature: 0.1,
        max_tokens: 4_500,
        provider: { require_parameters: true },
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "retentionlab_designer_creative_delta",
            strict: true,
            schema: z.toJSONSchema(creativeDeltaSchema),
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
    const canonicalRootKeys = new Set(Object.keys(creativeDeltaSchema.shape));
    const candidate = Object.fromEntries(Object.entries(rawCandidate).filter(([key]) => canonicalRootKeys.has(key)));
    const delta = creativeDeltaSchema.parse(candidate);
    const evidenceKeys = [...predecessorEvidenceKeys(brief)];
    const bindingKeys = evidenceKeys.length > 1 ? evidenceKeys.slice(0, 2) : [evidenceKeys[0], evidenceKeys[0]];
    const successSignals = brief.designer_handoff.success_signals;
    const measurementSources = successSignals.length > 1 ? successSignals.slice(0, 2) : [successSignals[0], successSignals[0]];
    const specification = recoveryDesignSpecificationSchema.parse({
      schema_version: "recovery-design.v1",
      stage: "designer",
      status: "ready_for_maker",
      agent: { id: "designer", name: "Luca Moretti", personality: "cinematic, systems-minded, ethically exacting" },
      run_id: parsed.runId,
      account_slug: brief.account_slug,
      source: {
        research_schema_version: brief.schema_version,
        research_prompt_version: brief.provenance.prompt_version,
        research_generated_at: brief.provenance.generated_at,
        research_artifact_sha256: claim.predecessor_hash,
      },
      inherited_research_constraints: {
        priority_outcomes: brief.designer_handoff.priority_outcomes,
        non_negotiables: brief.designer_handoff.non_negotiables,
        success_signals: brief.designer_handoff.success_signals,
      },
      design_thesis: delta.design_thesis,
      experience_principles: delta.experience_principles,
      recovery_concept: delta.recovery_concept,
      journey: delta.journey,
      content_architecture: [
        { region_id: "evidence-entry", label: "Evidence entry", purpose: "Explain the verified evidence and consent boundary.", priority: "primary" },
        { region_id: "signal-canvas", label: "Signal canvas", purpose: "Present cited aggregate signals for inspection only.", priority: "primary" },
        { region_id: "decision-exit", label: "Decision and exit", purpose: "Preserve customer choice and the human approval gate.", priority: "secondary" },
      ],
      consent_design: {
        inherited_allowed_channels: brief.consent_boundaries.allowed_channels,
        inherited_prohibited_actions: brief.consent_boundaries.prohibited_actions,
        permission_moments: [delta.permission_moment],
        additional_safety_patterns: ["No preselected choices, urgency language, hidden decline path or autonomous outreach."],
      },
      accessibility_requirements: {
        target: "WCAG 2.2 AA",
        keyboard: ["All signals and actions follow logical document order.", "Escape closes only an active modal dialog and never traps page focus."],
        screen_reader: ["Every signal exposes a concise accessible name and state.", "Async status changes use a restrained polite live region."],
        visual: ["Text, controls and focus indicators meet AA contrast.", "No meaning depends on colour, position or motion alone."],
        reduced_motion: ["Replace transitions with immediate state changes.", "Preserve hierarchy, content and status text without animation."],
      },
      motion_language: {
        intent: delta.motion_intent,
        transitions: ["Entry content settles once when evidence becomes ready.", "A signal expands only after explicit customer activation."],
        reduced_motion_fallback: "Render final states immediately while preserving hierarchy and causal status text.",
      },
      measurement_plan: measurementSources.map((source, index) => ({
        signal: index === 0 ? "Evidence-informed recovery engagement" : "Consent-safe clarification outcome",
        interpretation: index === 0 ? "The customer can inspect the cited recovery evidence." : "Optional clarification completes or declines without coercion.",
        source_success_signal: source,
        guardrail: index === 0 ? "Never infer individual behaviour from account aggregates." : "Decline and exit remain equally prominent and trigger no external action.",
      })),
      risks_and_mitigations: [
        { risk: "Aggregate evidence may appear more certain than it is.", mitigation: "Keep citations visible and hypotheses explicitly uncertain.", escalation_trigger: "Pause if any claim lacks a predecessor evidence key." },
        { risk: "Motion or recovery framing may create pressure.", mitigation: "Bind motion only to explicit state changes and retain a persistent exit.", escalation_trigger: "Remove the interaction if customer control or reduced-motion parity fails." },
      ],
      maker_handoff: {
        build_order: ["Implement loading and error boundaries first.", "Build the inspect-only signal canvas and citations second.", "Add consent-safe clarification, decline and success states last."],
        reusable_components: [...REVIEWED_COMPONENTS],
        interaction_states: [...REQUIRED_STATES],
        data_bindings: bindingKeys.map((evidenceKey, index) => ({
          field_path: index === 0 ? "signals.primary" : "signals.context",
          evidence_key: evidenceKey,
          display_purpose: index === 0 ? "Show the cited primary aggregate signal." : "Explain the cited evidence context without adding granularity.",
        })),
        acceptance_tests: [
          "Every rendered business claim includes a valid predecessor evidence key.",
          "Keyboard users can inspect every signal, decline and reach the persistent exit.",
          "Reduced motion preserves every content and interaction state.",
          "Clarification and decline cause no external customer action without human approval.",
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
    assertDesignerIntegrity(brief, specification);
    if (specification.status !== "ready_for_maker") throw new WorkerError("research_revision_requested");

    const canonical = JSON.stringify(specification);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
    const artifactHash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const publicSummary = `Designer sealed ${specification.experience_principles.length} experience principles, ${specification.journey.length} journey steps and ${specification.maker_handoff.reusable_components.length} reviewed components.`;

    const completion = await rpc(fetchImplementation, parsed.supabaseUrl, parsed.secretKey, "complete_agent_run_designer", {
      p_run_id: parsed.runId,
      p_lease_token: claim.lease_token,
      p_artifact: specification,
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
    console.error(`Hosted Designer failed: ${diagnosticCode(error)}.`);
    try {
      await rpc(fetchImplementation, parsed.supabaseUrl, parsed.secretKey, "fail_agent_run_stage", {
        p_run_id: parsed.runId,
        p_lease_token: claim.lease_token,
        p_stage: "designer",
        p_reason: safeFailureReason(error),
      });
    } catch {
      console.error("Hosted Designer could not persist its bounded failure event.");
    }
    return { status: "failed" };
  }
}
