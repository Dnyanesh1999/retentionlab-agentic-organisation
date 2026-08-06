import { communicationPlanSchema } from "../communicator/contracts.js";
import { recoveryDesignSpecificationSchema } from "../designer/contracts.js";
import { recoveryRoomArtifactSchema } from "../maker/contracts.js";
import { managerOperationalDecisionSchema } from "../manager/contracts.js";
import { researchBriefSchema } from "../researcher/contracts.js";

import { artifactFileName } from "./artifactStore.js";
import {
  STAGE_ORDER,
  type ArtifactReference,
  type EventEnvelope,
  type OrchestratorStage,
} from "./contracts.js";
import type { RunInputRecord } from "./runInput.js";
import type { OrchestratorState } from "./stateMachine.js";

// ---------------------------------------------------------------------------
// Deterministic pipeline transcript.
//
// The builder is PURE: given the run inputs, the ordered + hashed event log, the
// replayed state and the parsed typed artefacts, it constructs a transcript with
// no clock, no randomness and NO invented claims — every metric and string is
// copied directly out of a typed artefact or the event envelope it references. Two
// builds over identical sources are byte-for-byte identical.
//
// I/O (loading artefacts, writing files) lives in the CLI, never here.
// ---------------------------------------------------------------------------

// Parsed artefacts keyed by `${stage}:v${version}` so history references resolve exactly.
export type ArtifactBundle = ReadonlyMap<string, unknown>;

export function artifactKey(stage: OrchestratorStage, version: number): string {
  return `${stage}:v${version}`;
}

export type TranscriptSource = {
  readonly runInput: RunInputRecord;
  readonly envelopes: readonly EventEnvelope[];
  readonly state: OrchestratorState;
  readonly artifacts: ArtifactBundle;
};

type StageAttemptEntry = {
  readonly stage: OrchestratorStage;
  readonly version: number;
  readonly is_current: boolean;
  readonly file: string;
  readonly sha256: string;
  readonly status_label: string;
  readonly produced_at: string;
  readonly provenance: { readonly requested_model: string; readonly resolved_model: string; readonly prompt_version: string };
};

type LineageLink = { readonly predecessor: OrchestratorStage; readonly embedded_sha256: string; readonly matches_predecessor: boolean };

type CumulativeWorkEntry = {
  readonly stage: OrchestratorStage;
  readonly metrics: Readonly<Record<string, number | string>>;
  readonly transformation: string;
};

export type PipelineTranscript = {
  readonly transcript_schema_version: "gate9.transcript.v1";
  readonly run: {
    readonly run_id: string;
    readonly account_slug: string;
    readonly objective: string;
    readonly initiated_at: string;
    readonly requires_human_approval: boolean;
    readonly final_status: string;
    readonly event_count: number;
  };
  readonly events: readonly {
    readonly seq: number;
    readonly prev_hash: string;
    readonly hash: string;
    readonly event: EventEnvelope["event"];
  }[];
  readonly stage_attempts: readonly StageAttemptEntry[];
  readonly lineage: readonly { readonly stage: OrchestratorStage; readonly links: readonly LineageLink[] }[];
  readonly revisions: readonly {
    readonly kind: "manager_revise" | "manager_reject" | "revision_routed";
    readonly target_stage: string;
    readonly downstream_or_invalidated: readonly string[];
    readonly required_changes: readonly string[];
    readonly created_at: string;
  }[];
  readonly manager_outcome: {
    readonly decided: boolean;
    readonly decision: string | null;
    readonly permitted_next_action: string | null;
    readonly human_approval_required: boolean | null;
    readonly autonomous_external_actions: boolean | null;
    readonly chain_verified: boolean | null;
  };
  readonly cumulative_work_proof: readonly CumulativeWorkEntry[];
};

function requireArtifact(artifacts: ArtifactBundle, ref: ArtifactReference): unknown {
  const value = artifacts.get(artifactKey(ref.stage, ref.version));
  if (value === undefined) {
    throw new Error(`Transcript source missing artefact ${ref.stage} v${ref.version}.`);
  }
  return value;
}

function provenanceOf(stage: OrchestratorStage, artifact: unknown): StageAttemptEntry["provenance"] {
  const p = ((): { requested_model: string; resolved_model: string; prompt_version: string } => {
    switch (stage) {
      case "researcher":
        return researchBriefSchema.parse(artifact).provenance;
      case "designer":
        return recoveryDesignSpecificationSchema.parse(artifact).provenance;
      case "maker":
        return recoveryRoomArtifactSchema.parse(artifact).provenance;
      case "communicator":
        return communicationPlanSchema.parse(artifact).provenance;
      case "manager":
        return managerOperationalDecisionSchema.parse(artifact).provenance;
      default: {
        const exhaustive: never = stage;
        throw new Error(`Unknown stage ${String(exhaustive)}.`);
      }
    }
  })();
  return { requested_model: p.requested_model, resolved_model: p.resolved_model, prompt_version: p.prompt_version };
}

function buildStageAttempts(source: TranscriptSource): StageAttemptEntry[] {
  const entries: StageAttemptEntry[] = [];
  for (const stage of STAGE_ORDER) {
    const stageState = source.state.stages[stage];
    for (const ref of stageState.history) {
      const artifact = requireArtifact(source.artifacts, ref);
      entries.push({
        stage,
        version: ref.version,
        is_current: stageState.current?.version === ref.version && stageState.status === "completed",
        file: artifactFileName(stage, ref.version),
        sha256: ref.sha256,
        status_label: ref.status_label,
        produced_at: ref.produced_at,
        provenance: provenanceOf(stage, artifact),
      });
    }
  }
  return entries;
}

function embeddedPredecessorHash(stage: OrchestratorStage, artifact: unknown, predecessor: OrchestratorStage): string {
  if (stage === "designer") return recoveryDesignSpecificationSchema.parse(artifact).source.research_artifact_sha256;
  if (stage === "maker") return recoveryRoomArtifactSchema.parse(artifact).source.design_artifact_sha256;
  if (stage === "communicator") return communicationPlanSchema.parse(artifact).source.maker_artifact_sha256;
  const lineage = managerOperationalDecisionSchema.parse(artifact).lineage;
  const map: Record<OrchestratorStage, string | undefined> = {
    researcher: lineage.research_brief_sha256,
    designer: lineage.design_specification_sha256,
    maker: lineage.recovery_room_artifact_sha256,
    communicator: lineage.communication_plan_sha256,
    manager: undefined,
  };
  const value = map[predecessor];
  if (value === undefined) throw new Error(`Manager lineage has no link for ${predecessor}.`);
  return value;
}

const LINEAGE_PREDECESSORS: Readonly<Record<OrchestratorStage, readonly OrchestratorStage[]>> = {
  researcher: [],
  designer: ["researcher"],
  maker: ["designer"],
  communicator: ["maker"],
  manager: ["researcher", "designer", "maker", "communicator"],
};

function buildLineage(source: TranscriptSource): PipelineTranscript["lineage"] {
  const out: { stage: OrchestratorStage; links: LineageLink[] }[] = [];
  for (const stage of STAGE_ORDER) {
    const stageState = source.state.stages[stage];
    const current = stageState.current;
    if (!current || stageState.status !== "completed") continue;
    const predecessors = LINEAGE_PREDECESSORS[stage];
    if (predecessors.length === 0) continue;
    const artifact = requireArtifact(source.artifacts, current);
    const links: LineageLink[] = predecessors.map((predecessor) => {
      const embedded = embeddedPredecessorHash(stage, artifact, predecessor);
      const predRef = source.state.stages[predecessor].current;
      return {
        predecessor,
        embedded_sha256: embedded,
        matches_predecessor: predRef !== null && predRef.sha256 === embedded,
      };
    });
    out.push({ stage, links });
  }
  return out;
}

function buildRevisions(source: TranscriptSource): PipelineTranscript["revisions"] {
  const revisions: PipelineTranscript["revisions"][number][] = [];
  for (const { event } of source.envelopes) {
    if (event.type === "manager_decided" && event.outcome.decision !== "approve") {
      revisions.push({
        kind: event.outcome.decision === "revise" ? "manager_revise" : "manager_reject",
        target_stage: event.outcome.target_stage,
        downstream_or_invalidated: [...event.outcome.downstream_stages_to_rerun],
        required_changes: [...event.outcome.required_changes],
        created_at: event.created_at,
      });
    }
    if (event.type === "revision_routed") {
      revisions.push({
        kind: "revision_routed",
        target_stage: event.target_stage,
        downstream_or_invalidated: [...event.invalidated_stages],
        required_changes: [],
        created_at: event.created_at,
      });
    }
  }
  return revisions;
}

function buildManagerOutcome(source: TranscriptSource): PipelineTranscript["manager_outcome"] {
  const managerState = source.state.stages.manager;
  if (managerState.status !== "completed" || !managerState.current) {
    return {
      decided: false,
      decision: null,
      permitted_next_action: null,
      human_approval_required: null,
      autonomous_external_actions: null,
      chain_verified: null,
    };
  }
  const decision = managerOperationalDecisionSchema.parse(requireArtifact(source.artifacts, managerState.current));
  return {
    decided: true,
    decision: decision.decision,
    permitted_next_action: decision.governance.permitted_next_action,
    human_approval_required: decision.governance.human_approval_required,
    autonomous_external_actions: decision.governance.autonomous_external_actions,
    chain_verified: decision.lineage.chain_verified,
  };
}

// Copy-only metric extraction per stage. Every value is read straight from the typed artefact.
function stageMetrics(stage: OrchestratorStage, artifact: unknown): Readonly<Record<string, number | string>> {
  switch (stage) {
    case "researcher": {
      const b = researchBriefSchema.parse(artifact);
      return {
        observations: b.observations.length,
        hypotheses: b.hypotheses.length,
        priority_outcomes: b.designer_handoff.priority_outcomes.length,
        success_signals: b.designer_handoff.success_signals.length,
        allowed_channels: b.consent_boundaries.allowed_channels.length,
      };
    }
    case "designer": {
      const d = recoveryDesignSpecificationSchema.parse(artifact);
      return {
        experience_principles: d.experience_principles.length,
        journey_steps: d.journey.length,
        reusable_components: d.maker_handoff.reusable_components.length,
        interaction_states: d.maker_handoff.interaction_states.length,
        references_research_sha256: d.source.research_artifact_sha256,
      };
    }
    case "maker": {
      const m = recoveryRoomArtifactSchema.parse(artifact);
      return {
        regions: m.experience_definition.regions.length,
        supported_claims: m.communicator_handoff.supported_claims.length,
        implemented_states: m.implementation_evidence.implemented_states.length,
        commit_sha: m.implementation_evidence.commit_sha,
        references_design_sha256: m.source.design_artifact_sha256,
      };
    }
    case "communicator": {
      const c = communicationPlanSchema.parse(artifact);
      return {
        message_claims: c.message_claims.length,
        email_subject: c.email_invitation.subject,
        available_channels: c.inherited_boundaries.available_channels.length,
        references_maker_sha256: c.source.maker_artifact_sha256,
      };
    }
    case "manager": {
      const g = managerOperationalDecisionSchema.parse(artifact);
      return {
        decision: g.decision,
        permitted_next_action: g.governance.permitted_next_action,
        assessed_stages: g.chain_assessment.length,
        human_review_focus: g.human_review_focus.length,
      };
    }
    default: {
      const exhaustive: never = stage;
      throw new Error(`Unknown stage ${String(exhaustive)}.`);
    }
  }
}

// Deterministic, template-filled transformation sentence. The prose is fixed; only copied counts and
// labels vary, so it can never overstate what the artefacts contain.
function transformationSentence(stage: OrchestratorStage, metrics: Readonly<Record<string, number | string>>): string {
  switch (stage) {
    case "researcher":
      return `The Researcher grounded ${String(metrics.observations)} cited observations and ${String(metrics.hypotheses)} hypotheses into ${String(metrics.priority_outcomes)} priority outcomes and ${String(metrics.success_signals)} success signals for the Designer.`;
    case "designer":
      return `The Designer transformed the Researcher handoff into ${String(metrics.experience_principles)} experience principles, ${String(metrics.journey_steps)} journey steps and ${String(metrics.reusable_components)} reusable components across ${String(metrics.interaction_states)} interaction states, linked to research ${String(metrics.references_research_sha256)}.`;
    case "maker":
      return `The Maker realised the design into ${String(metrics.regions)} regions and ${String(metrics.supported_claims)} evidence-backed claims over commit ${String(metrics.commit_sha)}, linked to design ${String(metrics.references_design_sha256)}.`;
    case "communicator":
      return `The Communicator distilled the Maker handoff into ${String(metrics.message_claims)} sourced message claims and one view-only email invitation, linked to the Maker artefact ${String(metrics.references_maker_sha256)}.`;
    case "manager":
      return `The Manager assessed all ${String(metrics.assessed_stages)} predecessor stages and reached decision "${String(metrics.decision)}", permitting only "${String(metrics.permitted_next_action)}".`;
    default: {
      const exhaustive: never = stage;
      throw new Error(`Unknown stage ${String(exhaustive)}.`);
    }
  }
}

function buildCumulativeWork(source: TranscriptSource): CumulativeWorkEntry[] {
  const entries: CumulativeWorkEntry[] = [];
  for (const stage of STAGE_ORDER) {
    const stageState = source.state.stages[stage];
    if (stageState.status !== "completed" || !stageState.current) continue;
    const artifact = requireArtifact(source.artifacts, stageState.current);
    const metrics = stageMetrics(stage, artifact);
    entries.push({ stage, metrics, transformation: transformationSentence(stage, metrics) });
  }
  return entries;
}

export function buildPipelineTranscript(source: TranscriptSource): PipelineTranscript {
  return {
    transcript_schema_version: "gate9.transcript.v1",
    run: {
      run_id: source.runInput.run_id,
      account_slug: source.runInput.account_slug,
      objective: source.runInput.objective,
      initiated_at: source.runInput.initiated_at,
      requires_human_approval: source.state.requires_human_approval,
      final_status: source.state.status,
      event_count: source.state.event_count,
    },
    events: source.envelopes.map((envelope) => ({
      seq: envelope.seq,
      prev_hash: envelope.prev_hash,
      hash: envelope.hash,
      event: envelope.event,
    })),
    stage_attempts: buildStageAttempts(source),
    lineage: buildLineage(source),
    revisions: buildRevisions(source),
    manager_outcome: buildManagerOutcome(source),
    cumulative_work_proof: buildCumulativeWork(source),
  };
}

export function serializePipelineTranscript(transcript: PipelineTranscript): string {
  return `${JSON.stringify(transcript, null, 2)}\n`;
}

// Concise Markdown rendering from the SAME parsed data — no new facts, only formatting.
export function renderTranscriptMarkdown(transcript: PipelineTranscript): string {
  const lines: string[] = [];
  const { run } = transcript;
  lines.push(`# RetentionLab pipeline transcript — ${run.run_id}`);
  lines.push("");
  lines.push(`- Account: \`${run.account_slug}\``);
  lines.push(`- Objective: ${run.objective}`);
  lines.push(`- Initiated at: ${run.initiated_at}`);
  lines.push(`- Final status: **${run.final_status}**`);
  lines.push(`- Human approval required: ${String(run.requires_human_approval)}`);
  lines.push(`- Events: ${run.event_count}`);
  lines.push("");

  lines.push("## Stage attempts");
  lines.push("");
  lines.push("| Stage | Version | Current | Status | SHA-256 | Resolved model |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const attempt of transcript.stage_attempts) {
    lines.push(
      `| ${attempt.stage} | v${attempt.version} | ${attempt.is_current ? "yes" : "no"} | ${attempt.status_label} | \`${attempt.sha256.slice(0, 12)}…\` | ${attempt.provenance.resolved_model} |`,
    );
  }
  lines.push("");

  lines.push("## Cumulative-work proof");
  lines.push("");
  for (const entry of transcript.cumulative_work_proof) {
    lines.push(`- **${entry.stage}** — ${entry.transformation}`);
  }
  lines.push("");

  lines.push("## Lineage");
  lines.push("");
  for (const item of transcript.lineage) {
    for (const link of item.links) {
      lines.push(`- ${link.predecessor} → ${item.stage}: \`${link.embedded_sha256.slice(0, 12)}…\` (${link.matches_predecessor ? "verified" : "MISMATCH"})`);
    }
  }
  lines.push("");

  if (transcript.revisions.length > 0) {
    lines.push("## Revision history");
    lines.push("");
    for (const revision of transcript.revisions) {
      lines.push(`- ${revision.created_at} — ${revision.kind} targeting ${revision.target_stage} (rerun: ${revision.downstream_or_invalidated.join(", ") || "none"}).`);
    }
    lines.push("");
  }

  lines.push("## Manager outcome & governance");
  lines.push("");
  const outcome = transcript.manager_outcome;
  if (!outcome.decided) {
    lines.push("- The Manager did not reach a sealed decision in this run.");
  } else {
    lines.push(`- Decision: **${outcome.decision}**`);
    lines.push(`- Permitted next action: \`${outcome.permitted_next_action}\``);
    lines.push(`- Human approval required: ${String(outcome.human_approval_required)}`);
    lines.push(`- Autonomous external actions: ${String(outcome.autonomous_external_actions)}`);
    lines.push(`- Chain verified: ${String(outcome.chain_verified)}`);
    lines.push("");
    lines.push("> A sealed approval halts at `awaiting_human_approval`. The pipeline never sends, publishes, deploys, mutates customer data or triggers any external customer action.");
  }
  lines.push("");
  return `${lines.join("\n")}`;
}
