import type { z } from "zod";

import { communicationPlanSchema, type CommunicationPlan } from "../communicator/contracts.js";
import { runCommunicator } from "../communicator/run.js";
import type { CommunicatorModelAdapter } from "../communicator/model.js";
import { recoveryDesignSpecificationSchema, type RecoveryDesignSpecification } from "../designer/contracts.js";
import { runDesigner } from "../designer/run.js";
import type { DesignerModelAdapter } from "../designer/model.js";
import {
  makerImplementationEvidenceSchema,
  recoveryRoomArtifactSchema,
  type MakerImplementationEvidence,
  type RecoveryRoomArtifact,
} from "../maker/contracts.js";
import { runMaker } from "../maker/run.js";
import type { MakerModelAdapter } from "../maker/model.js";
import {
  managerOperationalDecisionSchema,
  type ManagerOperationalDecision,
} from "../manager/contracts.js";
import { runManager } from "../manager/run.js";
import type { ManagerModelAdapter } from "../manager/model.js";
import { researchBriefSchema, type ResearchBrief } from "../researcher/contracts.js";
import { runResearcher } from "../researcher/run.js";
import type { ResearcherModelAdapter } from "../researcher/model.js";
import type { EvidenceGateway } from "../../mcp/evidenceClient.js";

import { loadArtifactIfPresent, writeArtifactExclusive } from "./artifactStore.js";
import { deriveManagerOutcome, type ManagerOutcome, type OrchestratorStage } from "./contracts.js";
import type { StageExecutionResult, StageExecutorContext, OrchestratorExecutors } from "./orchestrator.js";
import { readRunInput } from "./runInput.js";

// ---------------------------------------------------------------------------
// Live five-agent composition (Gate 9 slice 2).
//
// This module composes the five REAL agent runtimes through the crash-safe
// orchestrator WITHOUT weakening any existing contract. It owns three concerns,
// all deterministic and side-effect-isolated:
//   1. Loading + hash-verifying durable predecessor artefacts from disk (never
//      trusting process memory across a crash boundary).
//   2. Safely ADOPTING a durable, unsealed artefact written immediately before a
//      crash — only after schema validation, exact run/account/stage/version and
//      predecessor-lineage checks, and a hash recomputation — so resume never
//      spends a second model call on work already durably done.
//   3. Producing a fresh artefact by invoking the real runner (which itself holds
//      the OpenRouter adapter / live evidence client) and persisting it with
//      exclusive, versioned creation.
//
// The producers (the only part that touches a live service) are INJECTED, so tests
// drive the full composition with fakes and never reach OpenRouter or Supabase.
// ---------------------------------------------------------------------------

export type LivePipelineErrorCode =
  | "WRONG_RUN"
  | "WRONG_ACCOUNT"
  | "MISSING_PREDECESSOR_REFERENCE"
  | "PREDECESSOR_MISSING_ON_DISK"
  | "PREDECESSOR_HASH_MISMATCH"
  | "LINEAGE_MISMATCH"
  | "REVISION_UNSUPPORTED";

export class LivePipelineError extends Error {
  public readonly code: LivePipelineErrorCode;
  constructor(code: LivePipelineErrorCode, message: string) {
    super(message);
    this.name = "LivePipelineError";
    this.code = code;
  }
}

export function isLivePipelineError(value: unknown): value is LivePipelineError {
  return value instanceof LivePipelineError;
}

// A minimal identity view every typed artefact satisfies.
type ArtifactIdentity = { readonly run_id: string; readonly account_slug: string };

// The parsed predecessor artefacts handed to a producer, plus their verified digests.
export type ResolvedPredecessors = {
  readonly artifacts: ReadonlyMap<OrchestratorStage, unknown>;
  readonly hashes: ReadonlyMap<OrchestratorStage, string>;
};

export type StageProduceContext = {
  readonly runId: string;
  readonly accountSlug: string;
  readonly version: number;
  readonly requiredChanges: readonly string[] | null;
  readonly predecessors: ReadonlyMap<OrchestratorStage, unknown>;
  readonly now: () => Date;
};

export type StageProducer = (context: StageProduceContext) => Promise<unknown>;
export type PipelineProducers = Readonly<Record<OrchestratorStage, StageProducer>>;

// The typed schema for each stage's artefact. Exported so the transcript loader validates the same
// durable files the executors wrote.
export const ARTIFACT_SCHEMAS: Readonly<Record<OrchestratorStage, z.ZodType<ArtifactIdentity>>> = {
  researcher: researchBriefSchema,
  designer: recoveryDesignSpecificationSchema,
  maker: recoveryRoomArtifactSchema,
  communicator: communicationPlanSchema,
  manager: managerOperationalDecisionSchema,
};

const PREDECESSOR_SCHEMAS = ARTIFACT_SCHEMAS;

// The ordered predecessor set each stage must reload and lineage-verify.
const PREDECESSORS: Readonly<Record<OrchestratorStage, readonly OrchestratorStage[]>> = {
  researcher: [],
  designer: ["researcher"],
  maker: ["designer"],
  communicator: ["maker"],
  manager: ["researcher", "designer", "maker", "communicator"],
};

function assertIdentity(artifact: ArtifactIdentity, ctx: StageExecutorContext): void {
  if (artifact.run_id !== ctx.run_id) {
    throw new LivePipelineError("WRONG_RUN", `Artefact for ${ctx.stage} belongs to run ${artifact.run_id}, not ${ctx.run_id}.`);
  }
  if (artifact.account_slug !== ctx.account_slug) {
    throw new LivePipelineError("WRONG_ACCOUNT", `Artefact for ${ctx.stage} belongs to account ${artifact.account_slug}, not ${ctx.account_slug}.`);
  }
}

// Reload every predecessor from disk and confirm its recomputed digest equals the digest the
// orchestration state committed. This is the "never rely on process memory" guarantee: on resume the
// predecessors are re-read and re-hashed, and any drift between disk and the event log fails closed.
async function resolvePredecessors(runDir: string, ctx: StageExecutorContext): Promise<ResolvedPredecessors> {
  const artifacts = new Map<OrchestratorStage, unknown>();
  const hashes = new Map<OrchestratorStage, string>();
  for (const predStage of PREDECESSORS[ctx.stage]) {
    const ref = ctx.completed_artifacts.get(predStage);
    if (!ref) {
      throw new LivePipelineError("MISSING_PREDECESSOR_REFERENCE", `${ctx.stage} is missing its completed ${predStage} reference.`);
    }
    const loaded = await loadArtifactIfPresent(runDir, predStage, ref.version, PREDECESSOR_SCHEMAS[predStage]);
    if (!loaded) {
      throw new LivePipelineError("PREDECESSOR_MISSING_ON_DISK", `${ctx.stage} predecessor ${predStage} v${ref.version} is absent from ${runDir}.`);
    }
    if (loaded.sha256 !== ref.sha256) {
      throw new LivePipelineError(
        "PREDECESSOR_HASH_MISMATCH",
        `${ctx.stage} predecessor ${predStage} v${ref.version} on disk hashes to ${loaded.sha256} but orchestration state expects ${ref.sha256}.`,
      );
    }
    artifacts.set(predStage, loaded.parsed);
    hashes.set(predStage, loaded.sha256);
  }
  return { artifacts, hashes };
}

function requireHash(hashes: ReadonlyMap<OrchestratorStage, string>, stage: OrchestratorStage): string {
  const value = hashes.get(stage);
  if (!value) throw new LivePipelineError("MISSING_PREDECESSOR_REFERENCE", `Expected a resolved ${stage} digest.`);
  return value;
}

function assertLink(actual: string, expected: string, from: OrchestratorStage, to: OrchestratorStage): void {
  if (actual !== expected) {
    throw new LivePipelineError("LINEAGE_MISMATCH", `Broken ${from} -> ${to} lineage: embedded ${actual} does not equal predecessor digest ${expected}.`);
  }
}

// Per-stage embedded-lineage verification. Each downstream artefact carries the SHA-256 of its
// predecessor; we prove that digest matches the predecessor we just reloaded and hashed.
function verifyLineage(stage: OrchestratorStage, artifact: unknown, hashes: ReadonlyMap<OrchestratorStage, string>): void {
  switch (stage) {
    case "researcher":
      return;
    case "designer": {
      const spec = recoveryDesignSpecificationSchema.parse(artifact);
      assertLink(spec.source.research_artifact_sha256, requireHash(hashes, "researcher"), "researcher", "designer");
      return;
    }
    case "maker": {
      const art = recoveryRoomArtifactSchema.parse(artifact);
      assertLink(art.source.design_artifact_sha256, requireHash(hashes, "designer"), "designer", "maker");
      return;
    }
    case "communicator": {
      const plan = communicationPlanSchema.parse(artifact);
      assertLink(plan.source.maker_artifact_sha256, requireHash(hashes, "maker"), "maker", "communicator");
      return;
    }
    case "manager": {
      const decision = managerOperationalDecisionSchema.parse(artifact);
      assertLink(decision.lineage.research_brief_sha256, requireHash(hashes, "researcher"), "researcher", "manager");
      assertLink(decision.lineage.design_specification_sha256, requireHash(hashes, "designer"), "designer", "manager");
      assertLink(decision.lineage.recovery_room_artifact_sha256, requireHash(hashes, "maker"), "maker", "manager");
      assertLink(decision.lineage.communication_plan_sha256, requireHash(hashes, "communicator"), "communicator", "manager");
      return;
    }
    default: {
      const exhaustive: never = stage;
      throw new LivePipelineError("LINEAGE_MISMATCH", `Unknown stage ${String(exhaustive)}.`);
    }
  }
}

// Deterministic view helpers over a parsed artefact.
function statusLabel(stage: OrchestratorStage, artifact: unknown): string {
  switch (stage) {
    case "researcher":
      return researchBriefSchema.parse(artifact).status;
    case "designer":
      return recoveryDesignSpecificationSchema.parse(artifact).status;
    case "maker":
      return recoveryRoomArtifactSchema.parse(artifact).status;
    case "communicator":
      return communicationPlanSchema.parse(artifact).status;
    case "manager":
      return managerOperationalDecisionSchema.parse(artifact).decision;
    default: {
      const exhaustive: never = stage;
      throw new LivePipelineError("LINEAGE_MISMATCH", `Unknown stage ${String(exhaustive)}.`);
    }
  }
}

function provenanceGeneratedAt(stage: OrchestratorStage, artifact: unknown): string {
  switch (stage) {
    case "researcher":
      return researchBriefSchema.parse(artifact).provenance.generated_at;
    case "designer":
      return recoveryDesignSpecificationSchema.parse(artifact).provenance.generated_at;
    case "maker":
      return recoveryRoomArtifactSchema.parse(artifact).provenance.generated_at;
    case "communicator":
      return communicationPlanSchema.parse(artifact).provenance.generated_at;
    case "manager":
      return managerOperationalDecisionSchema.parse(artifact).provenance.generated_at;
    default: {
      const exhaustive: never = stage;
      throw new LivePipelineError("LINEAGE_MISMATCH", `Unknown stage ${String(exhaustive)}.`);
    }
  }
}

function managerOutcome(artifact: unknown): ManagerOutcome {
  return deriveManagerOutcome(managerOperationalDecisionSchema.parse(artifact));
}

// The single generic execution path shared by every stage: reload + verify predecessors, then either
// ADOPT a durable unsealed artefact or PRODUCE a fresh one — never both, never a silent overwrite.
async function executeStage(
  runDir: string,
  ctx: StageExecutorContext,
  producers: PipelineProducers,
  now: () => Date,
): Promise<StageExecutionResult> {
  const schema = PREDECESSOR_SCHEMAS[ctx.stage];
  const predecessors = await resolvePredecessors(runDir, ctx);

  // A revision rerun carries Manager required_changes, which no current live runner can honestly
  // consume (see docs/qa-gate-9-orchestration-slice-2.md). This MUST be enforced BEFORE any adoption
  // OR production: a copied or leftover schema-valid, correct-lineage artefact already sitting at the
  // revision target version would otherwise be adopted and falsely certified as having applied the
  // revision. Fail closed first, so a stale/planted file at the target version can never masquerade as
  // a completed revision.
  if (ctx.required_changes && ctx.required_changes.length > 0) {
    throw new LivePipelineError(
      "REVISION_UNSUPPORTED",
      `Revision rerun of ${ctx.stage} carries Manager required_changes, which the live composition cannot yet apply. `
        + "Failing closed: no artefact was adopted or produced.",
    );
  }

  // Active-stage crash boundary: a valid versioned artefact may already exist for THIS attempt,
  // written just before the orchestration completion event. Adopt it only after full validation.
  const existing = await loadArtifactIfPresent(runDir, ctx.stage, ctx.version, schema);
  if (existing) {
    assertIdentity(existing.parsed, ctx);
    verifyLineage(ctx.stage, existing.parsed, predecessors.hashes);
    return buildResult(ctx.stage, existing.parsed, existing.sha256);
  }

  const produced = await producers[ctx.stage]({
    runId: ctx.run_id,
    accountSlug: ctx.account_slug,
    version: ctx.version,
    requiredChanges: ctx.required_changes,
    predecessors: predecessors.artifacts,
    now,
  });
  const parsed = schema.parse(produced);
  assertIdentity(parsed, ctx);
  verifyLineage(ctx.stage, parsed, predecessors.hashes);
  const written = await writeArtifactExclusive(runDir, ctx.stage, ctx.version, schema, parsed);
  return buildResult(ctx.stage, written.parsed, written.sha256);
}

function buildResult(stage: OrchestratorStage, artifact: unknown, sha256: string): StageExecutionResult {
  const base: StageExecutionResult = {
    sha256,
    status_label: statusLabel(stage, artifact),
    produced_at: provenanceGeneratedAt(stage, artifact),
  };
  if (stage === "manager") {
    return { ...base, manager_outcome: managerOutcome(artifact) };
  }
  return base;
}

export type LivePipelineExecutorConfig = {
  readonly runDir: string;
  readonly producers: PipelineProducers;
  readonly now?: () => Date;
};

// Compose the injected producers into the orchestrator's five-stage executor record. Pure wiring over
// the deterministic executeStage core.
export function createLivePipelineExecutors(config: LivePipelineExecutorConfig): OrchestratorExecutors {
  const now = config.now ?? (() => new Date());
  // Each executor dispatches on ctx.stage (the orchestrator sets it), so one handler serves all five.
  const handler = (ctx: StageExecutorContext): Promise<StageExecutionResult> =>
    executeStage(config.runDir, ctx, config.producers, now);
  return {
    researcher: handler,
    designer: handler,
    maker: handler,
    communicator: handler,
    manager: handler,
  };
}

// -------------------- Live producers (the only OpenRouter/Supabase touch point) --------------------

export type PipelineModels = {
  readonly researcher: ResearcherModelAdapter;
  readonly designer: DesignerModelAdapter;
  readonly maker: MakerModelAdapter;
  readonly communicator: CommunicatorModelAdapter;
  readonly manager: ManagerModelAdapter;
};

// The real runner functions, injectable so tests substitute fakes with identical signatures.
export type PipelineRunners = {
  readonly runResearcher: typeof runResearcher;
  readonly runDesigner: typeof runDesigner;
  readonly runMaker: typeof runMaker;
  readonly runCommunicator: typeof runCommunicator;
  readonly runManager: typeof runManager;
};

export const REAL_RUNNERS: PipelineRunners = { runResearcher, runDesigner, runMaker, runCommunicator, runManager };

export type LiveProducersConfig = {
  readonly runDir: string;
  readonly models: PipelineModels;
  readonly gateway: EvidenceGateway;
  // The canonical Maker implementation evidence, schema-validated at startup by the caller.
  readonly makerImplementation: MakerImplementationEvidence;
  readonly runners?: PipelineRunners;
};

// Wire the real agent runtimes as producers. Each producer reloads its typed predecessor(s) from the
// resolved map, builds the exact real input, and calls the underlying runner with its live adapter.
export function createLiveProducers(config: LiveProducersConfig): PipelineProducers {
  const runners = config.runners ?? REAL_RUNNERS;
  const implementation = makerImplementationEvidenceSchema.parse(config.makerImplementation);

  return {
    researcher: async (ctx) => {
      const runInput = await readRunInput(config.runDir);
      return runners.runResearcher({
        input: {
          run_id: ctx.runId,
          account_slug: ctx.accountSlug,
          objective: runInput.objective,
          initiated_at: runInput.initiated_at,
        },
        gateway: config.gateway,
        model: config.models.researcher,
        now: ctx.now,
      });
    },
    designer: async (ctx) => {
      const brief: ResearchBrief = researchBriefSchema.parse(ctx.predecessors.get("researcher"));
      return runners.runDesigner({
        input: { run_id: ctx.runId, research_brief: brief },
        model: config.models.designer,
        now: ctx.now,
      });
    },
    maker: async (ctx) => {
      const spec: RecoveryDesignSpecification = recoveryDesignSpecificationSchema.parse(ctx.predecessors.get("designer"));
      return runners.runMaker({
        input: { run_id: ctx.runId, design_specification: spec },
        implementation,
        model: config.models.maker,
        now: ctx.now,
      });
    },
    communicator: async (ctx) => {
      const artifact: RecoveryRoomArtifact = recoveryRoomArtifactSchema.parse(ctx.predecessors.get("maker"));
      return runners.runCommunicator({
        input: { run_id: ctx.runId, recovery_room_artifact: artifact },
        model: config.models.communicator,
        now: ctx.now,
      });
    },
    manager: async (ctx) => {
      const brief: ResearchBrief = researchBriefSchema.parse(ctx.predecessors.get("researcher"));
      const spec: RecoveryDesignSpecification = recoveryDesignSpecificationSchema.parse(ctx.predecessors.get("designer"));
      const artifact: RecoveryRoomArtifact = recoveryRoomArtifactSchema.parse(ctx.predecessors.get("maker"));
      const plan: CommunicationPlan = communicationPlanSchema.parse(ctx.predecessors.get("communicator"));
      const decision: ManagerOperationalDecision = await runners.runManager({
        input: {
          run_id: ctx.runId,
          research_brief: brief,
          design_specification: spec,
          recovery_room_artifact: artifact,
          communication_plan: plan,
        },
        model: config.models.manager,
        now: ctx.now,
      });
      return decision;
    },
  };
}
