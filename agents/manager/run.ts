import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  MANAGER_DECISION_SCHEMA_VERSION,
  MANAGER_PROMPT_VERSION,
  managerDecisionDraftSchema,
  managerInputSchema,
  managerOperationalDecisionSchema,
  type ManagerInput,
  type ManagerOperationalDecision,
} from "./contracts.js";
import type { ManagerModelAdapter } from "./model.js";

const STAGE_ORDER = ["researcher", "designer", "maker", "communicator"] as const;
type ManagerStage = (typeof STAGE_ORDER)[number];

export const MANAGER_GOVERNANCE_BOUNDARIES = [
  "Never send email, launch a campaign or contact a customer.",
  "Never publish, deploy or expose any artefact outside this review.",
  "Never mutate, delete or transfer customer, billing or account data.",
  "Never self-approve; an approval only clears the chain for a named human decision.",
  "Never take an autonomous external action; every downstream effect waits for explicit human approval.",
] as const;

// Repository JSON hashing convention: SHA-256 over the compact JSON of the schema-parsed artefact.
export function sha256OfArtifact(artifact: unknown): string {
  return createHash("sha256").update(JSON.stringify(artifact)).digest("hex");
}

export type ChainHashes = {
  research_brief_sha256: string;
  design_specification_sha256: string;
  recovery_room_artifact_sha256: string;
  communication_plan_sha256: string;
};

// Verifies the exact SHA-256 lineage Researcher -> Designer -> Maker -> Communicator BEFORE any model use.
export function assertChainIntegrity(input: ManagerInput): ChainHashes {
  const researchHash = sha256OfArtifact(input.research_brief);
  if (researchHash !== input.design_specification.source.research_artifact_sha256) {
    throw new Error("Manager chain broken: the Designer specification does not link to this ResearchBrief by SHA-256.");
  }

  const designHash = sha256OfArtifact(input.design_specification);
  if (designHash !== input.recovery_room_artifact.source.design_artifact_sha256) {
    throw new Error("Manager chain broken: the Maker artefact does not link to this Designer specification by SHA-256.");
  }

  const makerHash = sha256OfArtifact(input.recovery_room_artifact);
  if (makerHash !== input.communication_plan.source.maker_artifact_sha256) {
    throw new Error("Manager chain broken: the CommunicationPlan does not link to this Maker artefact by SHA-256.");
  }

  return {
    research_brief_sha256: researchHash,
    design_specification_sha256: designHash,
    recovery_room_artifact_sha256: makerHash,
    communication_plan_sha256: sha256OfArtifact(input.communication_plan),
  };
}

function downstreamStages(target: ManagerStage): ManagerStage[] {
  return STAGE_ORDER.slice(STAGE_ORDER.indexOf(target) + 1);
}

export function assertDecisionIntegrity(input: ManagerInput, decision: ManagerOperationalDecision) {
  if (decision.governance.human_approval_required !== true) {
    throw new Error("Manager cannot waive the human-approval requirement.");
  }
  if (decision.governance.autonomous_external_actions !== false) {
    throw new Error("Manager cannot enable autonomous external actions.");
  }

  const assessedStages = new Set(decision.chain_assessment.map((entry) => entry.stage));
  if (assessedStages.size !== STAGE_ORDER.length) {
    throw new Error("Manager review must assess all four predecessor stages exactly once.");
  }

  if (decision.decision === "approve") {
    if (decision.revision_directive) {
      throw new Error("An approval cannot carry a revision directive.");
    }
    if (input.communication_plan.manager_handoff.launch_recommendation === "pause_for_revision") {
      throw new Error("Manager cannot approve a communication plan the Communicator paused for revision.");
    }
    if (decision.governance.permitted_next_action !== "await_human_approval") {
      throw new Error("An approval must hand off to await_human_approval, never an autonomous action.");
    }
    return;
  }

  const directive = decision.revision_directive;
  if (!directive) {
    throw new Error(`A ${decision.decision} decision must target one stage with the required changes.`);
  }
  const expectedDownstream = downstreamStages(directive.target_stage);
  const sameDownstream = directive.downstream_stages_to_rerun.length === expectedDownstream.length
    && directive.downstream_stages_to_rerun.every((stage, index) => stage === expectedDownstream[index]);
  if (!sameDownstream) {
    throw new Error("Manager revision must re-run exactly the stages downstream of its single target.");
  }
}

export async function runManager(options: {
  input: ManagerInput;
  model: ManagerModelAdapter;
  now?: () => Date;
}): Promise<ManagerOperationalDecision> {
  const input = managerInputSchema.parse(options.input);
  // Verify same run/account, required completed statuses (input schema) and exact SHA-256 lineage
  // before the model is ever consulted.
  const lineageHashes = assertChainIntegrity(input);

  let revision: { validation_error: string; previous_output: string } | undefined;
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const generated = await options.model.generate(input, revision);
    try {
      const draft = managerDecisionDraftSchema.parse(JSON.parse(generated.text) as unknown);
      const revisionDirective = draft.revision_directive
        ? { ...draft.revision_directive, downstream_stages_to_rerun: downstreamStages(draft.revision_directive.target_stage) }
        : undefined;
      const permittedNextAction = draft.decision === "approve"
        ? "await_human_approval"
        : draft.decision === "revise"
          ? "route_targeted_revision"
          : "halt_and_route_revision";

      const decision = managerOperationalDecisionSchema.parse({
        ...draft,
        schema_version: MANAGER_DECISION_SCHEMA_VERSION,
        stage: "manager",
        agent: { id: "manager", name: "Elias Grant", personality: "calm, accountable, adversarially constructive" },
        run_id: input.run_id,
        account_slug: input.communication_plan.account_slug,
        lineage: {
          ...lineageHashes,
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
          boundaries: [...MANAGER_GOVERNANCE_BOUNDARIES],
        },
        ...(revisionDirective ? { revision_directive: revisionDirective } : { revision_directive: undefined }),
        provenance: {
          provider: "openrouter",
          requested_model: options.model.requestedModel,
          resolved_model: generated.resolvedModel,
          prompt_version: MANAGER_PROMPT_VERSION,
          generated_at: (options.now ?? (() => new Date()))().toISOString(),
        },
      });
      assertDecisionIntegrity(input, decision);
      return decision;
    } catch (error) {
      lastError = error;
      revision = {
        validation_error: error instanceof Error ? error.message : "ManagerOperationalDecision failed deterministic validation.",
        previous_output: generated.text,
      };
    }
  }
  throw lastError;
}

export async function writeManagerDecision(decision: ManagerOperationalDecision, artifactPath: string) {
  await mkdir(dirname(artifactPath), { recursive: true });
  await writeFile(
    artifactPath,
    `${JSON.stringify(managerOperationalDecisionSchema.parse(decision), null, 2)}\n`,
    { encoding: "utf8", flag: "wx" },
  );
}
