import { z } from "zod";

import {
  evidenceCitationSchema,
  researcherPromptVersionSchema,
  researchBriefSchema,
} from "../researcher/contracts.js";

export const DESIGNER_PROMPT_VERSION = "designer.v1.7.0" as const;
export const DESIGN_SPEC_SCHEMA_VERSION = "recovery-design.v1" as const;
export const designerPromptVersionSchema = z.enum([
  "designer.v1.0.0",
  "designer.v1.1.0",
  "designer.v1.2.0",
  "designer.v1.3.0",
  "designer.v1.4.0",
  "designer.v1.5.0",
  "designer.v1.6.0",
  DESIGNER_PROMPT_VERSION,
]);

const evidenceKeySchema = evidenceCitationSchema.shape.evidence_key;

export const designerInputSchema = z.object({
  run_id: z.string().uuid(),
  research_brief: researchBriefSchema,
}).strict().superRefine((input, context) => {
  if (input.research_brief.status !== "completed") {
    context.addIssue({
      code: "custom",
      path: ["research_brief", "status"],
      message: "Designer requires a completed ResearchBrief.",
    });
  }
  if (input.run_id !== input.research_brief.run_id) {
    context.addIssue({
      code: "custom",
      path: ["run_id"],
      message: "Designer run_id must match its ResearchBrief predecessor.",
    });
  }
});

const evidenceGroundedSchema = z.object({
  source_evidence_keys: z.array(evidenceKeySchema).min(1).max(8),
}).strict();

export const recoveryDesignSpecificationSchema = z.object({
  schema_version: z.literal(DESIGN_SPEC_SCHEMA_VERSION),
  stage: z.literal("designer"),
  status: z.enum(["ready_for_maker", "needs_research_revision"]),
  agent: z.object({
    id: z.literal("designer"),
    name: z.literal("Luca Moretti"),
    personality: z.literal("cinematic, systems-minded, ethically exacting"),
  }).strict(),
  run_id: z.string().uuid(),
  account_slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  source: z.object({
    research_schema_version: z.literal("research-brief.v1"),
    research_prompt_version: researcherPromptVersionSchema,
    research_generated_at: z.string().datetime({ offset: true }),
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
    source_evidence_keys: evidenceGroundedSchema.shape.source_evidence_keys,
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
    source_evidence_keys: evidenceGroundedSchema.shape.source_evidence_keys,
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
    interaction_states: z.array(z.enum(["loading", "ready", "active", "success", "declined", "error", "reduced_motion"])).min(5),
    data_bindings: z.array(z.object({
      field_path: z.string().regex(/^[a-z][a-z0-9_.-]*$/),
      evidence_key: evidenceKeySchema,
      display_purpose: z.string().min(8).max(240),
    }).strict()).min(2).max(12),
    acceptance_tests: z.array(z.string().min(10).max(300)).min(4).max(12),
  }).strict(),
  provenance: z.object({
    provider: z.literal("openrouter"),
    requested_model: z.string().min(1),
    resolved_model: z.string().min(1),
    prompt_version: designerPromptVersionSchema,
    generated_at: z.string().datetime({ offset: true }),
  }).strict(),
}).strict();

export type DesignerInput = z.infer<typeof designerInputSchema>;
export type RecoveryDesignSpecification = z.infer<typeof recoveryDesignSpecificationSchema>;
