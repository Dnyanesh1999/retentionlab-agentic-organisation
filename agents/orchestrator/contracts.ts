import { z } from "zod";

import type { ManagerOperationalDecision } from "../manager/contracts.js";

// Gate 9 orchestration backbone — strict typed contracts for the five-stage pipeline.
//
// The five stages run in exactly this order. `manager` is terminal within a pass and is the only
// stage that can route a bounded revision back to an earlier stage. `revisableStage` is the subset a
// Manager revision may target (the Manager never revises itself).

export const ORCHESTRATOR_STATE_SCHEMA_VERSION = "gate9.orchestration.v1" as const;

export const STAGE_ORDER = ["researcher", "designer", "maker", "communicator", "manager"] as const;
export type OrchestratorStage = (typeof STAGE_ORDER)[number];

export const REVISABLE_STAGE_ORDER = ["researcher", "designer", "maker", "communicator"] as const;
export type RevisableStage = (typeof REVISABLE_STAGE_ORDER)[number];

export const orchestratorStageSchema = z.enum(STAGE_ORDER);
export const revisableStageSchema = z.enum(REVISABLE_STAGE_ORDER);

export const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/, "expected a lowercase hex SHA-256 digest");
export const isoTimestampSchema = z.string().datetime({ offset: true });
const accountSlugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80);
const versionSchema = z.number().int().positive();

// Overall run lifecycle. `in_progress` is the only state from which stages may execute.
// `awaiting_human_approval`, `rejected` and `failed` are terminal for the automated machine.
// `revision_required` is a routing state whose only legal successor is a deterministic route event.
export const runStatusSchema = z.enum([
  "in_progress",
  "awaiting_human_approval",
  "revision_required",
  "rejected",
  "failed",
]);
export type RunStatus = z.infer<typeof runStatusSchema>;

// Per-stage attempt/version status. `superseded` marks a prior artefact preserved in history after a
// revision; `invalidated` marks a stage reset by a revision and awaiting rerun.
export const stageStatusSchema = z.enum([
  "pending",
  "active",
  "completed",
  "superseded",
  "invalidated",
  "failed",
]);
export type StageStatus = z.infer<typeof stageStatusSchema>;

// Why a transition happened, recorded on the event that caused it.
export const transitionReasonSchema = z.enum([
  "run_started",
  "sequential_start",
  "revision_rerun_start",
  "stage_completed",
  "manager_approved",
  "manager_reject",
  "manager_revise",
  "revision_routed",
  "executor_failed",
]);
export type TransitionReason = z.infer<typeof transitionReasonSchema>;

// Immutable reference to a produced artefact. The orchestrator never stores mutable artefacts — only
// content-addressed references. `status_label` is the artefact's own status field (e.g. "completed",
// "ready_for_maker", or the Manager decision kind).
export const artifactReferenceSchema = z.object({
  stage: orchestratorStageSchema,
  version: versionSchema,
  sha256: sha256Schema,
  status_label: z.string().min(1).max(80),
  produced_at: isoTimestampSchema,
}).strict();
export type ArtifactReference = z.infer<typeof artifactReferenceSchema>;

// Compact, orchestrator-facing view of a Manager decision. Derived from the full
// ManagerOperationalDecision so the live pipeline can wire the real Manager runtime unchanged.
export const managerGovernanceViewSchema = z.object({
  human_approval_required: z.boolean(),
  permitted_next_action: z.string().min(1).max(80),
}).strict();

export const managerOutcomeSchema = z.discriminatedUnion("decision", [
  z.object({
    decision: z.literal("approve"),
    governance: managerGovernanceViewSchema,
  }).strict(),
  z.object({
    decision: z.literal("revise"),
    target_stage: revisableStageSchema,
    downstream_stages_to_rerun: z.array(revisableStageSchema).max(3),
    required_changes: z.array(z.string().min(1).max(300)).min(1).max(8),
    governance: managerGovernanceViewSchema,
  }).strict(),
  z.object({
    decision: z.literal("reject"),
    target_stage: revisableStageSchema,
    downstream_stages_to_rerun: z.array(revisableStageSchema).max(3),
    required_changes: z.array(z.string().min(1).max(300)).min(1).max(8),
    governance: managerGovernanceViewSchema,
  }).strict(),
]);
export type ManagerOutcome = z.infer<typeof managerOutcomeSchema>;

// Projects the sealed ManagerOperationalDecision onto the orchestrator's outcome view. Pure.
export function deriveManagerOutcome(decision: ManagerOperationalDecision): ManagerOutcome {
  const governance = {
    human_approval_required: decision.governance.human_approval_required,
    permitted_next_action: decision.governance.permitted_next_action,
  };
  if (decision.decision === "approve") {
    return managerOutcomeSchema.parse({ decision: "approve", governance });
  }
  const directive = decision.revision_directive;
  if (!directive) {
    throw new Error("A revise/reject ManagerOperationalDecision must carry a revision_directive.");
  }
  return managerOutcomeSchema.parse({
    decision: decision.decision,
    target_stage: directive.target_stage,
    downstream_stages_to_rerun: directive.downstream_stages_to_rerun,
    required_changes: directive.required_changes,
    governance,
  });
}

// Append-only event log. The reducer folds these in order; the JSONL store is the source of truth.
export const orchestratorEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("run_started"),
    run_id: z.string().uuid(),
    account_slug: accountSlugSchema,
    requires_human_approval: z.boolean(),
    created_at: isoTimestampSchema,
  }).strict(),
  z.object({
    type: z.literal("stage_started"),
    stage: orchestratorStageSchema,
    version: versionSchema,
    reason: z.enum(["sequential_start", "revision_rerun_start"]),
    created_at: isoTimestampSchema,
  }).strict(),
  z.object({
    type: z.literal("stage_completed"),
    stage: orchestratorStageSchema,
    version: versionSchema,
    artifact: artifactReferenceSchema,
    created_at: isoTimestampSchema,
  }).strict(),
  z.object({
    type: z.literal("stage_failed"),
    stage: orchestratorStageSchema,
    version: versionSchema,
    error: z.string().min(1).max(500),
    created_at: isoTimestampSchema,
  }).strict(),
  // Atomic Manager seal. A single append-only event that BOTH completes the Manager stage (its
  // immutable artefact reference) AND records the validated ManagerOutcome. Because completion and the
  // decision land as one durable event, there is no persisted prefix where the Manager is completed but
  // its decision is unrecorded — so an interrupted run never replays into an unrecoverable
  // "manager completed, decision missing" limbo. The Manager stage completes via this event only; a
  // plain `stage_completed` for `manager` is illegal.
  z.object({
    type: z.literal("manager_decided"),
    version: versionSchema,
    // The Manager stage's own artefact reference (artifact.stage must be "manager", artifact.version
    // must equal `version`). Its sha256 is the sealed Manager decision digest.
    artifact: artifactReferenceSchema,
    // The validated decision. The reducer applies it to the terminal (approve/reject) or
    // revision_required state atomically with Manager completion.
    outcome: managerOutcomeSchema,
    created_at: isoTimestampSchema,
  }).strict(),
  z.object({
    type: z.literal("revision_routed"),
    target_stage: revisableStageSchema,
    invalidated_stages: z.array(orchestratorStageSchema).min(1),
    created_at: isoTimestampSchema,
  }).strict(),
]);
export type OrchestratorEvent = z.infer<typeof orchestratorEventSchema>;
export type OrchestratorEventType = OrchestratorEvent["type"];

// Persisted envelope. `prev_hash`/`hash` form a tamper-evident chain over the ordered events.
export const GENESIS_HASH = "0".repeat(64);

export const eventEnvelopeSchema = z.object({
  seq: z.number().int().nonnegative(),
  prev_hash: sha256Schema,
  hash: sha256Schema,
  event: orchestratorEventSchema,
}).strict();
export type EventEnvelope = z.infer<typeof eventEnvelopeSchema>;
