// Typed adapter over the committed, immutable Gate 9 assessed-run evidence.
//
// Every value the Organisation screen renders is derived here from the tracked
// canonical artefacts — the master pipeline transcript plus the five current
// stage artefacts under design/specifications. Nothing is invented and no live
// query runs: this is a snapshot of the accepted run
// a9f629aa-2a87-4723-8711-0a8039077adc, validated at module load so that any
// drift in the source evidence fails loudly instead of silently mis-reporting.

import { z } from "zod";

import transcriptJson from "../../../design/specifications/gate-9-live-pipeline-transcript.v1.json";
import researchBriefJson from "../../../design/specifications/gate-9-live-research-brief.v1.json";
import recoveryDesignJson from "../../../design/specifications/gate-9-live-recovery-design.v1.json";
import recoveryRoomJson from "../../../design/specifications/gate-9-live-recovery-room-artifact.v1.json";
import communicationPlanJson from "../../../design/specifications/gate-9-live-communication-plan.v2.json";
import managerDecisionJson from "../../../design/specifications/gate-9-live-manager-decision.v1.json";

export type StageId = "researcher" | "designer" | "maker" | "communicator" | "manager";

const STAGE_ORDER: readonly StageId[] = [
  "researcher",
  "designer",
  "maker",
  "communicator",
  "manager",
] as const;

const isoDatetime = z.iso.datetime({ offset: true });

const provenanceSchema = z
  .object({
    requested_model: z.string().min(1),
    resolved_model: z.string().min(1),
    prompt_version: z.string().min(1),
  })
  .passthrough();

const stageAttemptSchema = z
  .object({
    stage: z.enum(STAGE_ORDER),
    version: z.number().int().positive(),
    is_current: z.boolean(),
    status_label: z.string().min(1),
    sha256: z.string().length(64),
    produced_at: isoDatetime,
    provenance: provenanceSchema,
  })
  .passthrough();

const lineageSchema = z.array(
  z
    .object({
      stage: z.enum(STAGE_ORDER),
      links: z.array(
        z
          .object({
            predecessor: z.enum(STAGE_ORDER),
            embedded_sha256: z.string().length(64),
            matches_predecessor: z.boolean(),
          })
          .passthrough(),
      ),
    })
    .passthrough(),
);

const cumulativeWorkProofSchema = z.array(
  z
    .object({
      stage: z.enum(STAGE_ORDER),
      metrics: z.record(z.string(), z.union([z.string(), z.number()])),
      transformation: z.string().min(1),
    })
    .passthrough(),
);

const transcriptSchema = z
  .object({
    run: z
      .object({
        run_id: z.string().uuid(),
        account_slug: z.string().min(1),
        objective: z.string().min(1),
        initiated_at: isoDatetime,
        requires_human_approval: z.boolean(),
        final_status: z.string().min(1),
        event_count: z.number().int().nonnegative(),
      })
      .passthrough(),
    stage_attempts: z.array(stageAttemptSchema),
    lineage: lineageSchema,
    stage_failures: z.array(
      z
        .object({
          stage: z.enum(STAGE_ORDER),
          version: z.number().int().positive(),
          error: z.string().min(1),
          created_at: isoDatetime,
          recovered: z.boolean(),
        })
        .passthrough(),
    ),
    failed_stage_retries: z.array(
      z
        .object({
          stage: z.enum(STAGE_ORDER),
          failed_version: z.number().int().positive(),
          rerun_version: z.number().int().positive(),
          operator_reason: z.string().min(1),
          failure_error: z.string().min(1),
          created_at: isoDatetime,
        })
        .passthrough(),
    ),
    manager_outcome: z
      .object({
        decided: z.boolean(),
        decision: z.string().min(1),
        permitted_next_action: z.string().min(1),
        human_approval_required: z.boolean(),
        autonomous_external_actions: z.boolean(),
        chain_verified: z.boolean(),
      })
      .passthrough(),
    cumulative_work_proof: cumulativeWorkProofSchema,
  })
  .passthrough();

const agentIdentitySchema = z.object({
  id: z.enum(STAGE_ORDER),
  name: z.string().min(1),
  personality: z.string().min(1),
});

const artifactProvenanceSchema = provenanceSchema.extend({
  generated_at: isoDatetime,
});

const artifactIdentityFields = {
  run_id: z.string().uuid(),
  account_slug: z.string().min(1),
  schema_version: z.string().min(1),
} as const;

// --- Stage-specific detail contracts (only the fields the UI renders) --------

const researchBriefSchema = z
  .object({
    ...artifactIdentityFields,
    stage: z.literal("researcher"),
    status: z.literal("completed"),
    agent: agentIdentitySchema,
    brief_summary: z.string().min(1),
    observations: z.array(
      z.object({
        claim: z.string().min(1),
        significance: z.string().min(1),
        citations: z
          .array(
            z.object({
              evidence_key: z.string().min(1),
              source_tool: z.string().min(1),
              source_system: z.string().min(1),
            }),
          )
          .min(1),
      }),
    ),
    consent_boundaries: z.object({ allowed_channels: z.array(z.string().min(1)) }).passthrough(),
    designer_handoff: z.object({ priority_outcomes: z.array(z.string().min(1)) }).passthrough(),
    provenance: artifactProvenanceSchema.extend({
      tool_calls: z.array(z.string().min(1)),
      all_sources_no_store: z.boolean(),
    }),
  })
  .passthrough();

const recoveryDesignSchema = z
  .object({
    ...artifactIdentityFields,
    stage: z.literal("designer"),
    status: z.literal("ready_for_maker"),
    agent: agentIdentitySchema,
    design_thesis: z.string().min(1),
    recovery_concept: z.object({ one_line_promise: z.string().min(1) }).passthrough(),
    experience_principles: z.array(z.object({ name: z.string().min(1), rationale: z.string().min(1) })),
    journey: z.array(z.object({ title: z.string().min(1), customer_goal: z.string().min(1) })),
    source: z.object({ research_artifact_sha256: z.string().length(64) }).passthrough(),
    provenance: artifactProvenanceSchema,
  })
  .passthrough();

const recoveryRoomSchema = z
  .object({
    ...artifactIdentityFields,
    stage: z.literal("maker"),
    status: z.literal("ready_for_communication"),
    agent: agentIdentitySchema,
    build_summary: z.string().min(1),
    experience_definition: z
      .object({
        regions: z.array(z.object({ region_id: z.string().min(1), implemented_behavior: z.string().min(1) })),
      })
      .passthrough(),
    communicator_handoff: z
      .object({
        supported_claims: z.array(z.object({ claim: z.string().min(1), qualification: z.string().min(1) })),
      })
      .passthrough(),
    implementation_evidence: z
      .object({
        commit_sha: z.string().min(1),
        route: z.string().min(1),
        implemented_states: z.array(z.string().min(1)),
        verification: z.object({ test_count: z.number().int().positive() }).passthrough(),
      })
      .passthrough(),
    source: z.object({ design_artifact_sha256: z.string().length(64) }).passthrough(),
    provenance: artifactProvenanceSchema,
  })
  .passthrough();

const communicationPlanSchema = z
  .object({
    ...artifactIdentityFields,
    stage: z.literal("communicator"),
    status: z.literal("ready_for_manager"),
    agent: agentIdentitySchema,
    campaign_thesis: z.string().min(1),
    email_invitation: z
      .object({ subject: z.string().min(1), preheader: z.string().min(1), cta_label: z.string().min(1) })
      .passthrough(),
    message_claims: z.array(
      z.object({
        message: z.string().min(1),
        evidence_keys: z.array(z.string().min(1)),
        qualification: z.string().min(1),
      }),
    ),
    transparency: z.object({ data_boundary: z.string().min(1), choice_statement: z.string().min(1) }).passthrough(),
    source: z.object({ maker_artifact_sha256: z.string().length(64) }).passthrough(),
    provenance: artifactProvenanceSchema,
  })
  .passthrough();

const managerDecisionSchema = z
  .object({
    ...artifactIdentityFields,
    stage: z.literal("manager"),
    agent: agentIdentitySchema,
    decision: z.string().min(1),
    executive_summary: z.string().min(1),
    trust_evaluation: z.record(
      z.string(),
      z.object({ status: z.string().min(1), finding: z.string().min(1) }),
    ),
    human_review_focus: z.array(z.string().min(1)),
    governance: z
      .object({
        human_approval_required: z.boolean(),
        autonomous_external_actions: z.boolean(),
        permitted_next_action: z.string().min(1),
        boundaries: z.array(z.string().min(1)),
      })
      .passthrough(),
    lineage: z
      .object({
        research_brief_sha256: z.string().length(64),
        design_specification_sha256: z.string().length(64),
        recovery_room_artifact_sha256: z.string().length(64),
        communication_plan_sha256: z.string().length(64),
        chain_verified: z.boolean(),
      })
      .passthrough(),
    provenance: artifactProvenanceSchema,
  })
  .passthrough();

// --- Parsed evidence (fails closed at import if the canonical files drift) ----

const transcript = transcriptSchema.parse(transcriptJson);
const researchBrief = researchBriefSchema.parse(researchBriefJson);
const recoveryDesign = recoveryDesignSchema.parse(recoveryDesignJson);
const recoveryRoom = recoveryRoomSchema.parse(recoveryRoomJson);
const communicationPlan = communicationPlanSchema.parse(communicationPlanJson);
const managerDecision = managerDecisionSchema.parse(managerDecisionJson);

// --- Public model -----------------------------------------------------------

export type StageProvenance = {
  requestedModel: string;
  resolvedModel: string;
  promptVersion: string;
};

export type LineageLink = {
  from: StageId;
  to: StageId;
  sha256: string;
  verified: boolean;
};

export type RecoveryRecord = {
  stage: StageId;
  failedVersion: number;
  rerunVersion: number;
  failureError: string;
  failedAt: string;
  operatorReason: string;
  retriedAt: string;
  recovered: boolean;
};

export type ManagerOutcome = {
  decided: boolean;
  decision: string;
  permittedNextAction: string;
  humanApprovalRequired: boolean;
  autonomousExternalActions: boolean;
  chainVerified: boolean;
};

export type TrustCheck = { key: string; label: string; status: string; finding: string };

export type StageDetail =
  | {
      kind: "researcher";
      summary: string;
      observations: { claim: string; significance: string; evidenceKey: string; sourceTool: string; sourceSystem: string }[];
      allowedChannels: string[];
      priorityOutcomes: string[];
      toolCalls: string[];
      allSourcesNoStore: boolean;
    }
  | {
      kind: "designer";
      thesis: string;
      promise: string;
      principles: { name: string; rationale: string }[];
      journey: { title: string; customerGoal: string }[];
    }
  | {
      kind: "maker";
      summary: string;
      regions: { id: string; behavior: string }[];
      supportedClaims: { claim: string; qualification: string }[];
      implementedStates: string[];
      commitSha: string;
      route: string;
      testCount: number;
    }
  | {
      kind: "communicator";
      campaignThesis: string;
      emailSubject: string;
      emailPreheader: string;
      ctaLabel: string;
      messageClaims: { message: string; evidenceKeys: string[]; qualification: string }[];
      dataBoundary: string;
      choiceStatement: string;
    }
  | {
      kind: "manager";
      decision: string;
      executiveSummary: string;
      trustEvaluation: TrustCheck[];
      humanReviewFocus: string[];
      boundaries: string[];
    };

export type StageEvidence = {
  id: StageId;
  stage: number;
  agentName: string;
  personality: string;
  version: number;
  statusLabel: string;
  sha256: string;
  producedAt: string;
  provenance: StageProvenance;
  transformation: string;
  metrics: Record<string, string | number>;
  lineage: LineageLink[];
  recovery: RecoveryRecord | null;
  detail: StageDetail;
};

export type Gate9Run = {
  runId: string;
  accountSlug: string;
  objective: string;
  initiatedAt: string;
  finalStatus: string;
  requiresHumanApproval: boolean;
  eventCount: number;
  stages: StageEvidence[];
  lineageLinks: LineageLink[];
  recovery: RecoveryRecord;
  managerOutcome: ManagerOutcome;
  governanceBoundaries: string[];
  humanReviewFocus: string[];
  trustEvaluation: TrustCheck[];
};

const TRUST_LABELS: Record<string, string> = {
  evidence_traceability: "Evidence traceability",
  consent_and_human_control: "Consent & human control",
  claim_discipline: "Claim discipline",
  accessibility_and_safety: "Accessibility & safety",
};

function stageNumber(id: StageId): number {
  return STAGE_ORDER.indexOf(id) + 1;
}

function currentAttempt(stage: StageId) {
  const attempt = transcript.stage_attempts.find((entry) => entry.stage === stage && entry.is_current);
  if (!attempt) {
    throw new Error(`Gate 9 evidence is missing a current attempt for stage "${stage}".`);
  }
  return attempt;
}

function assertEvidenceConsistency(): void {
  const currentAttempts = transcript.stage_attempts.filter((entry) => entry.is_current);
  if (
    currentAttempts.length !== STAGE_ORDER.length
    || new Set(currentAttempts.map((entry) => entry.stage)).size !== STAGE_ORDER.length
  ) {
    throw new Error("Gate 9 evidence must contain exactly one current attempt for each stage.");
  }

  if (
    transcript.run.final_status !== "awaiting_human_approval"
    || transcript.run.requires_human_approval !== true
    || transcript.manager_outcome.decision !== "approve"
    || transcript.manager_outcome.permitted_next_action !== "await_human_approval"
    || transcript.manager_outcome.human_approval_required !== true
    || transcript.manager_outcome.autonomous_external_actions !== false
    || transcript.manager_outcome.chain_verified !== true
  ) {
    throw new Error("Gate 9 evidence no longer represents the accepted, human-gated run.");
  }

  const artifacts = {
    researcher: researchBrief,
    designer: recoveryDesign,
    maker: recoveryRoom,
    communicator: communicationPlan,
    manager: managerDecision,
  } as const;

  for (const stage of STAGE_ORDER) {
    const artifact = artifacts[stage];
    const attempt = currentAttempt(stage);
    if (
      artifact.run_id !== transcript.run.run_id
      || artifact.account_slug !== transcript.run.account_slug
      || artifact.stage !== stage
      || artifact.agent.id !== stage
      || artifact.provenance.generated_at !== attempt.produced_at
      || artifact.provenance.requested_model !== attempt.provenance.requested_model
      || artifact.provenance.resolved_model !== attempt.provenance.resolved_model
      || artifact.provenance.prompt_version !== attempt.provenance.prompt_version
    ) {
      throw new Error(`Gate 9 ${stage} artefact identity or provenance does not match the transcript.`);
    }
  }

  const attemptHashes = Object.fromEntries(
    STAGE_ORDER.map((stage) => [stage, currentAttempt(stage).sha256]),
  ) as Record<StageId, string>;
  if (
    recoveryDesign.source.research_artifact_sha256 !== attemptHashes.researcher
    || recoveryRoom.source.design_artifact_sha256 !== attemptHashes.designer
    || communicationPlan.source.maker_artifact_sha256 !== attemptHashes.maker
    || managerDecision.lineage.research_brief_sha256 !== attemptHashes.researcher
    || managerDecision.lineage.design_specification_sha256 !== attemptHashes.designer
    || managerDecision.lineage.recovery_room_artifact_sha256 !== attemptHashes.maker
    || managerDecision.lineage.communication_plan_sha256 !== attemptHashes.communicator
    || managerDecision.lineage.chain_verified !== true
  ) {
    throw new Error("Gate 9 artefact predecessor hashes do not match the current transcript attempts.");
  }

  const lineageLinks = transcript.lineage.flatMap((entry) =>
    entry.links.map((link) => ({ stage: entry.stage, ...link })),
  );
  if (
    lineageLinks.length !== 7
    || lineageLinks.some(
      (link) => !link.matches_predecessor || link.embedded_sha256 !== attemptHashes[link.predecessor],
    )
  ) {
    throw new Error("Gate 9 transcript lineage is incomplete or does not match predecessor hashes.");
  }
}

assertEvidenceConsistency();

function transformationFor(stage: StageId): string {
  const proof = transcript.cumulative_work_proof.find((entry) => entry.stage === stage);
  if (!proof) {
    throw new Error(`Gate 9 evidence is missing cumulative-work proof for stage "${stage}".`);
  }
  return proof.transformation;
}

function metricsFor(stage: StageId): Record<string, string | number> {
  return transcript.cumulative_work_proof.find((entry) => entry.stage === stage)?.metrics ?? {};
}

function lineageInto(stage: StageId): LineageLink[] {
  return transcript.lineage
    .filter((entry) => entry.stage === stage)
    .flatMap((entry) =>
      entry.links.map((link) => ({
        from: link.predecessor,
        to: entry.stage,
        sha256: link.embedded_sha256,
        verified: link.matches_predecessor,
      })),
    );
}

const trustEvaluation: TrustCheck[] = Object.entries(managerDecision.trust_evaluation).map(
  ([key, value]) => ({
    key,
    label: TRUST_LABELS[key] ?? key.replace(/_/g, " "),
    status: value.status,
    finding: value.finding,
  }),
);

const retry = transcript.failed_stage_retries[0];
const failure = transcript.stage_failures.find(
  (entry) => entry.stage === retry?.stage && entry.version === retry?.failed_version,
);
if (!retry || !failure) {
  throw new Error("Gate 9 evidence is missing the recorded Communicator failure and recovery.");
}

const recovery: RecoveryRecord = {
  stage: retry.stage,
  failedVersion: retry.failed_version,
  rerunVersion: retry.rerun_version,
  failureError: retry.failure_error,
  failedAt: failure.created_at,
  operatorReason: retry.operator_reason,
  retriedAt: retry.created_at,
  recovered: failure.recovered,
};

function detailFor(stage: StageId): StageDetail {
  switch (stage) {
    case "researcher":
      return {
        kind: "researcher",
        summary: researchBrief.brief_summary,
        observations: researchBrief.observations.map((observation) => ({
          claim: observation.claim,
          significance: observation.significance,
          evidenceKey: observation.citations[0].evidence_key,
          sourceTool: observation.citations[0].source_tool,
          sourceSystem: observation.citations[0].source_system,
        })),
        allowedChannels: researchBrief.consent_boundaries.allowed_channels,
        priorityOutcomes: researchBrief.designer_handoff.priority_outcomes,
        toolCalls: researchBrief.provenance.tool_calls,
        allSourcesNoStore: researchBrief.provenance.all_sources_no_store,
      };
    case "designer":
      return {
        kind: "designer",
        thesis: recoveryDesign.design_thesis,
        promise: recoveryDesign.recovery_concept.one_line_promise,
        principles: recoveryDesign.experience_principles.map((principle) => ({
          name: principle.name,
          rationale: principle.rationale,
        })),
        journey: recoveryDesign.journey.map((step) => ({
          title: step.title,
          customerGoal: step.customer_goal,
        })),
      };
    case "maker":
      return {
        kind: "maker",
        summary: recoveryRoom.build_summary,
        regions: recoveryRoom.experience_definition.regions.map((region) => ({
          id: region.region_id,
          behavior: region.implemented_behavior,
        })),
        supportedClaims: recoveryRoom.communicator_handoff.supported_claims.map((claim) => ({
          claim: claim.claim,
          qualification: claim.qualification,
        })),
        implementedStates: recoveryRoom.implementation_evidence.implemented_states,
        commitSha: recoveryRoom.implementation_evidence.commit_sha,
        route: recoveryRoom.implementation_evidence.route,
        testCount: recoveryRoom.implementation_evidence.verification.test_count,
      };
    case "communicator":
      return {
        kind: "communicator",
        campaignThesis: communicationPlan.campaign_thesis,
        emailSubject: communicationPlan.email_invitation.subject,
        emailPreheader: communicationPlan.email_invitation.preheader,
        ctaLabel: communicationPlan.email_invitation.cta_label,
        messageClaims: communicationPlan.message_claims.map((claim) => ({
          message: claim.message,
          evidenceKeys: claim.evidence_keys,
          qualification: claim.qualification,
        })),
        dataBoundary: communicationPlan.transparency.data_boundary,
        choiceStatement: communicationPlan.transparency.choice_statement,
      };
    case "manager":
      return {
        kind: "manager",
        decision: managerDecision.decision,
        executiveSummary: managerDecision.executive_summary,
        trustEvaluation,
        humanReviewFocus: managerDecision.human_review_focus,
        boundaries: managerDecision.governance.boundaries,
      };
    default:
      throw new Error(`Unknown Gate 9 stage "${stage as string}".`);
  }
}

const stageAgents: Record<StageId, z.infer<typeof agentIdentitySchema>> = {
  researcher: researchBrief.agent,
  designer: recoveryDesign.agent,
  maker: recoveryRoom.agent,
  communicator: communicationPlan.agent,
  manager: managerDecision.agent,
};

const stages: StageEvidence[] = STAGE_ORDER.map((id) => {
  const attempt = currentAttempt(id);
  const agent = stageAgents[id];
  return {
    id,
    stage: stageNumber(id),
    agentName: agent.name,
    personality: agent.personality,
    version: attempt.version,
    statusLabel: attempt.status_label,
    sha256: attempt.sha256,
    producedAt: attempt.produced_at,
    provenance: {
      requestedModel: attempt.provenance.requested_model,
      resolvedModel: attempt.provenance.resolved_model,
      promptVersion: attempt.provenance.prompt_version,
    },
    transformation: transformationFor(id),
    metrics: metricsFor(id),
    lineage: lineageInto(id),
    recovery: id === recovery.stage ? recovery : null,
    detail: detailFor(id),
  };
});

const lineageLinks: LineageLink[] = STAGE_ORDER.flatMap((id) => lineageInto(id));

export const gate9Run: Gate9Run = {
  runId: transcript.run.run_id,
  accountSlug: transcript.run.account_slug,
  objective: transcript.run.objective,
  initiatedAt: transcript.run.initiated_at,
  finalStatus: transcript.run.final_status,
  requiresHumanApproval: transcript.run.requires_human_approval,
  eventCount: transcript.run.event_count,
  stages,
  lineageLinks,
  recovery,
  managerOutcome: {
    decided: transcript.manager_outcome.decided,
    decision: transcript.manager_outcome.decision,
    permittedNextAction: transcript.manager_outcome.permitted_next_action,
    humanApprovalRequired: transcript.manager_outcome.human_approval_required,
    autonomousExternalActions: transcript.manager_outcome.autonomous_external_actions,
    chainVerified: transcript.manager_outcome.chain_verified,
  },
  governanceBoundaries: managerDecision.governance.boundaries,
  humanReviewFocus: managerDecision.human_review_focus,
  trustEvaluation,
};

/** Human-readable label for a status_label token (e.g. "ready_for_manager"). */
export function humanizeStatus(statusLabel: string): string {
  return statusLabel.replace(/_/g, " ");
}

/** Short display form of a 64-char SHA-256 digest. */
export function shortHash(sha256: string): string {
  return `${sha256.slice(0, 12)}…`;
}

const STAGE_LABELS: Record<StageId, string> = {
  researcher: "Researcher",
  designer: "Designer",
  maker: "Maker",
  communicator: "Communicator",
  manager: "Manager",
};

export function stageLabel(id: StageId): string {
  return STAGE_LABELS[id];
}
