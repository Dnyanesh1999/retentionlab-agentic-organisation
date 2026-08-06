import { z } from "zod";

import {
  designerPromptVersionSchema,
  recoveryDesignSpecificationSchema,
} from "../designer/contracts.js";

export const MAKER_PROMPT_VERSION = "maker.v1.1.0" as const;
export const RECOVERY_ROOM_ARTIFACT_SCHEMA_VERSION = "recovery-room-artifact.v1" as const;

const accountSlugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80);
const evidenceKeySchema = z.string().regex(/^[a-z]+:[a-z0-9-]+:[a-z0-9_-]+(?::[a-z0-9-]+)?$/).max(160);
const interactionStateSchema = z.enum([
  "loading",
  "ready",
  "active",
  "success",
  "declined",
  "error",
  "reduced_motion",
]);

export const makerImplementationEvidenceSchema = z.object({
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

export const makerInputSchema = z.object({
  run_id: z.string().uuid(),
  design_specification: recoveryDesignSpecificationSchema,
}).strict().superRefine((input, context) => {
  if (input.design_specification.status !== "ready_for_maker") {
    context.addIssue({
      code: "custom",
      path: ["design_specification", "status"],
      message: "Maker requires a reviewed ready_for_maker design specification.",
    });
  }
  if (input.run_id !== input.design_specification.run_id) {
    context.addIssue({
      code: "custom",
      path: ["run_id"],
      message: "Maker run_id must match its Designer predecessor.",
    });
  }
});

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

const supportedClaimSchema = z.object({
  claim: z.string().min(10).max(300),
  source_evidence_keys: z.array(evidenceKeySchema).min(1).max(8),
  qualification: z.string().min(8).max(240),
}).strict();

export const makerDraftSchema = z.object({
  status: z.enum(["ready_for_communication", "needs_design_revision"]),
  build_summary: z.string().min(30).max(1_200),
  experience_definition: experienceDefinitionSchema,
  communicator_handoff: z.object({
    product_name: z.string().min(3).max(100),
    audience: z.string().min(10).max(240),
    customer_value: z.string().min(20).max(500),
    supported_claims: z.array(supportedClaimSchema).min(1).max(10),
    required_disclosures: z.array(z.string().min(8).max(300)).min(2).max(10),
  }).strict(),
  residual_risks: z.array(z.object({
    risk: z.string().min(10).max(300),
    control: z.string().min(10).max(300),
  }).strict()).min(1).max(8),
}).strict();

export const recoveryRoomArtifactSchema = makerDraftSchema.extend({
  schema_version: z.literal(RECOVERY_ROOM_ARTIFACT_SCHEMA_VERSION),
  stage: z.literal("maker"),
  agent: z.object({
    id: z.literal("maker"),
    name: z.literal("Noor Patel"),
    personality: z.literal("pragmatic, meticulous, accessibility-first"),
  }).strict(),
  run_id: z.string().uuid(),
  account_slug: accountSlugSchema,
  source: z.object({
    design_schema_version: z.literal("recovery-design.v1"),
    design_prompt_version: designerPromptVersionSchema,
    design_generated_at: z.string().datetime({ offset: true }),
    design_artifact_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  }).strict(),
  inherited_guardrails: z.object({
    allowed_channels: z.array(z.string().min(1).max(40)).max(10),
    prohibited_actions: z.array(z.string().min(3).max(240)).min(1).max(10),
  }).strict(),
  implementation_evidence: makerImplementationEvidenceSchema,
  communicator_handoff: makerDraftSchema.shape.communicator_handoff.extend({
    available_channels: z.array(z.string().min(1).max(40)).max(10),
    prohibited_claims: z.array(z.string().min(3).max(240)).min(1).max(10),
  }).strict(),
  provenance: z.object({
    provider: z.literal("openrouter"),
    requested_model: z.string().min(1),
    resolved_model: z.string().min(1),
    prompt_version: z.enum(["maker.v1.0.0", MAKER_PROMPT_VERSION]),
    generated_at: z.string().datetime({ offset: true }),
  }).strict(),
}).strict();

export type MakerInput = z.infer<typeof makerInputSchema>;
export type MakerDraft = z.infer<typeof makerDraftSchema>;
export type MakerImplementationEvidence = z.infer<typeof makerImplementationEvidenceSchema>;
export type RecoveryRoomArtifact = z.infer<typeof recoveryRoomArtifactSchema>;
