import { z } from "zod";

import { communicationPlanSchema } from "../communicator/contracts.js";
import { recoveryDesignSpecificationSchema } from "../designer/contracts.js";
import { recoveryRoomArtifactSchema } from "../maker/contracts.js";
import { researchBriefSchema } from "../researcher/contracts.js";

export const MANAGER_PROMPT_VERSION = "manager.v1.0.0" as const;
export const MANAGER_DECISION_SCHEMA_VERSION = "manager-operational-decision.v1" as const;

const accountSlugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

export const managerStageSchema = z.enum(["researcher", "designer", "maker", "communicator"]);

export const managerInputSchema = z.object({
  run_id: z.string().uuid(),
  research_brief: researchBriefSchema,
  design_specification: recoveryDesignSpecificationSchema,
  recovery_room_artifact: recoveryRoomArtifactSchema,
  communication_plan: communicationPlanSchema,
}).strict().superRefine((input, context) => {
  const predecessors = [
    { path: "research_brief", run_id: input.research_brief.run_id, status: input.research_brief.status, required: "completed", account: input.research_brief.account_slug },
    { path: "design_specification", run_id: input.design_specification.run_id, status: input.design_specification.status, required: "ready_for_maker", account: input.design_specification.account_slug },
    { path: "recovery_room_artifact", run_id: input.recovery_room_artifact.run_id, status: input.recovery_room_artifact.status, required: "ready_for_communication", account: input.recovery_room_artifact.account_slug },
    { path: "communication_plan", run_id: input.communication_plan.run_id, status: input.communication_plan.status, required: "ready_for_manager", account: input.communication_plan.account_slug },
  ] as const;

  for (const predecessor of predecessors) {
    if (predecessor.run_id !== input.run_id) {
      context.addIssue({
        code: "custom",
        path: [predecessor.path, "run_id"],
        message: "Manager requires every predecessor artefact to belong to the same run_id.",
      });
    }
    if (predecessor.status !== predecessor.required) {
      context.addIssue({
        code: "custom",
        path: [predecessor.path, "status"],
        message: `Manager requires ${predecessor.path} to be ${predecessor.required} before review.`,
      });
    }
  }

  const accounts = new Set(predecessors.map((predecessor) => predecessor.account));
  if (accounts.size !== 1) {
    context.addIssue({
      code: "custom",
      path: ["communication_plan", "account_slug"],
      message: "Manager requires one consistent account across the complete chain.",
    });
  }
});

const trustDimensionSchema = z.object({
  status: z.enum(["pass", "concern", "fail"]),
  finding: z.string().min(15).max(500),
}).strict();

const stageAssessmentSchema = z.object({
  stage: managerStageSchema,
  cumulative_contribution: z.string().min(15).max(500),
  concerns: z.array(z.string().min(8).max(300)).max(6),
}).strict();

const revisionDirectiveDraftSchema = z.object({
  target_stage: managerStageSchema,
  required_changes: z.array(z.string().min(10).max(300)).min(1).max(8),
  reason: z.string().min(20).max(800),
}).strict();

export const managerDecisionDraftSchema = z.object({
  decision: z.enum(["approve", "revise", "reject"]),
  executive_summary: z.string().min(30).max(1_000),
  rationale: z.string().min(30).max(1_500),
  chain_assessment: z.array(stageAssessmentSchema).min(4).max(4),
  trust_evaluation: z.object({
    evidence_traceability: trustDimensionSchema,
    consent_and_human_control: trustDimensionSchema,
    claim_discipline: trustDimensionSchema,
    accessibility_and_safety: trustDimensionSchema,
  }).strict(),
  human_review_focus: z.array(z.string().min(10).max(300)).min(2).max(8),
  revision_directive: revisionDirectiveDraftSchema.optional(),
}).strict();

export const managerOperationalDecisionSchema = managerDecisionDraftSchema.extend({
  schema_version: z.literal(MANAGER_DECISION_SCHEMA_VERSION),
  stage: z.literal("manager"),
  agent: z.object({
    id: z.literal("manager"),
    name: z.literal("Elias Grant"),
    personality: z.literal("calm, accountable, adversarially constructive"),
  }).strict(),
  run_id: z.string().uuid(),
  account_slug: accountSlugSchema,
  lineage: z.object({
    research_brief_sha256: sha256Schema,
    design_specification_sha256: sha256Schema,
    recovery_room_artifact_sha256: sha256Schema,
    communication_plan_sha256: sha256Schema,
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
  revision_directive: revisionDirectiveDraftSchema.extend({
    downstream_stages_to_rerun: z.array(managerStageSchema).max(3),
  }).strict().optional(),
  provenance: z.object({
    provider: z.literal("openrouter"),
    requested_model: z.string().min(1),
    resolved_model: z.string().min(1),
    prompt_version: z.enum([MANAGER_PROMPT_VERSION]),
    generated_at: z.string().datetime({ offset: true }),
  }).strict(),
}).strict();

export type ManagerInput = z.infer<typeof managerInputSchema>;
export type ManagerDecisionDraft = z.infer<typeof managerDecisionDraftSchema>;
export type ManagerOperationalDecision = z.infer<typeof managerOperationalDecisionSchema>;
