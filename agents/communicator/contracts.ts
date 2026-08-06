import { z } from "zod";

import { makerPromptVersionSchema, recoveryRoomArtifactSchema } from "../maker/contracts.js";

export const COMMUNICATOR_PROMPT_VERSION = "communicator.v1.3.0" as const;
export const COMMUNICATION_PLAN_SCHEMA_VERSION = "communication-plan.v1" as const;

const evidenceKeySchema = z.string().regex(/^[a-z]+:[a-z0-9-]+:[a-z0-9_-]+(?::[a-z0-9-]+)?$/).max(160);

export const communicatorInputSchema = z.object({
  run_id: z.string().uuid(),
  recovery_room_artifact: recoveryRoomArtifactSchema,
}).strict().superRefine((input, context) => {
  if (input.recovery_room_artifact.status !== "ready_for_communication") {
    context.addIssue({
      code: "custom",
      path: ["recovery_room_artifact", "status"],
      message: "Communicator requires a ready_for_communication Maker artefact.",
    });
  }
  if (input.run_id !== input.recovery_room_artifact.run_id) {
    context.addIssue({ code: "custom", path: ["run_id"], message: "Communicator run_id must match its Maker predecessor." });
  }
});

const messageClaimSchema = z.object({
  message: z.string().min(10).max(400),
  source_claims: z.array(z.string().min(10).max(300)).min(1).max(5),
  evidence_keys: z.array(evidenceKeySchema).min(1).max(8),
  qualification: z.string().min(8).max(300),
}).strict();

export const communicationDraftSchema = z.object({
  status: z.enum(["ready_for_manager", "needs_maker_revision"]),
  campaign_thesis: z.string().min(30).max(800),
  tone_rules: z.array(z.string().min(8).max(240)).min(3).max(8),
  email_invitation: z.object({
    subject: z.string().min(5).max(78),
    preheader: z.string().min(10).max(140),
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
}).strict();

export const communicationPlanSchema = communicationDraftSchema.extend({
  schema_version: z.literal(COMMUNICATION_PLAN_SCHEMA_VERSION),
  stage: z.literal("communicator"),
  agent: z.object({
    id: z.literal("communicator"),
    name: z.literal("Maeve Quinn"),
    personality: z.literal("plain-spoken, empathetic, evidence-disciplined"),
  }).strict(),
  run_id: z.string().uuid(),
  account_slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  source: z.object({
    maker_schema_version: z.literal("recovery-room-artifact.v1"),
    maker_prompt_version: makerPromptVersionSchema,
    maker_generated_at: z.string().datetime({ offset: true }),
    maker_artifact_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    implementation_commit_sha: z.string().regex(/^[a-f0-9]{7,40}$/),
  }).strict(),
  inherited_boundaries: z.object({
    available_channels: z.array(z.string().min(1).max(40)).max(10),
    prohibited_claims: z.array(z.string().min(3).max(240)).min(1).max(10),
    required_disclosures: z.array(z.string().min(8).max(300)).min(2).max(10),
  }).strict(),
  provenance: z.object({
    provider: z.literal("openrouter"),
    requested_model: z.string().min(1),
    resolved_model: z.string().min(1),
    prompt_version: z.enum(["communicator.v1.0.0", "communicator.v1.1.0", "communicator.v1.2.0", COMMUNICATOR_PROMPT_VERSION]),
    generated_at: z.string().datetime({ offset: true }),
  }).strict(),
}).strict();

export type CommunicatorInput = z.infer<typeof communicatorInputSchema>;
export type CommunicationDraft = z.infer<typeof communicationDraftSchema>;
export type CommunicationPlan = z.infer<typeof communicationPlanSchema>;
