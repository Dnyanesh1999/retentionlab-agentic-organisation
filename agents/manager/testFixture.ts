import { makeCommunicationDraft } from "../communicator/testFixture.js";
import { communicationPlanSchema } from "../communicator/contracts.js";
import { makeDesignerInput, makeDesignSpecification, makeResearchBriefFixture } from "../designer/testFixture.js";
import { recoveryRoomArtifactSchema } from "../maker/contracts.js";
import { makeMakerDraft, makeMakerImplementation } from "../maker/testFixture.js";
import { recoveryDesignSpecificationSchema } from "../designer/contracts.js";
import type { ManagerDecisionDraft, ManagerInput } from "./contracts.js";
import { sha256OfArtifact } from "./run.js";

// Builds a complete chain in which every predecessor is genuinely SHA-256 linked to the next,
// so the Manager's real lineage verification passes without any placeholder hashes.
export function makeManagerInput(): ManagerInput {
  const researchBrief = makeResearchBriefFixture();

  const baseDesign = makeDesignSpecification(makeDesignerInput());
  const designSpecification = recoveryDesignSpecificationSchema.parse({
    ...baseDesign,
    source: { ...baseDesign.source, research_artifact_sha256: sha256OfArtifact(researchBrief) },
  });

  const makerDraft = makeMakerDraft({ run_id: designSpecification.run_id, design_specification: designSpecification });
  const implementation = makeMakerImplementation({ run_id: designSpecification.run_id, design_specification: designSpecification });
  const recoveryRoomArtifact = recoveryRoomArtifactSchema.parse({
    ...makerDraft,
    schema_version: "recovery-room-artifact.v1",
    stage: "maker",
    agent: { id: "maker", name: "Noor Patel", personality: "pragmatic, meticulous, accessibility-first" },
    run_id: designSpecification.run_id,
    account_slug: designSpecification.account_slug,
    source: {
      design_schema_version: designSpecification.schema_version,
      design_prompt_version: designSpecification.provenance.prompt_version,
      design_generated_at: designSpecification.provenance.generated_at,
      design_artifact_sha256: sha256OfArtifact(designSpecification),
    },
    inherited_guardrails: {
      allowed_channels: designSpecification.consent_design.inherited_allowed_channels,
      prohibited_actions: designSpecification.consent_design.inherited_prohibited_actions,
    },
    implementation_evidence: implementation,
    communicator_handoff: {
      ...makerDraft.communicator_handoff,
      available_channels: designSpecification.consent_design.inherited_allowed_channels,
      prohibited_claims: designSpecification.consent_design.inherited_prohibited_actions,
    },
    provenance: {
      provider: "openrouter",
      requested_model: "example/maker-free",
      resolved_model: "example/maker-free",
      prompt_version: "maker.v1.1.0",
      generated_at: "2026-08-06T02:30:00.000Z",
    },
  });

  const communicationDraft = makeCommunicationDraft({ run_id: recoveryRoomArtifact.run_id, recovery_room_artifact: recoveryRoomArtifact });
  const communicationPlan = communicationPlanSchema.parse({
    ...communicationDraft,
    schema_version: "communication-plan.v1",
    stage: "communicator",
    agent: { id: "communicator", name: "Maeve Quinn", personality: "plain-spoken, empathetic, evidence-disciplined" },
    run_id: recoveryRoomArtifact.run_id,
    account_slug: recoveryRoomArtifact.account_slug,
    source: {
      maker_schema_version: recoveryRoomArtifact.schema_version,
      maker_prompt_version: recoveryRoomArtifact.provenance.prompt_version,
      maker_generated_at: recoveryRoomArtifact.provenance.generated_at,
      maker_artifact_sha256: sha256OfArtifact(recoveryRoomArtifact),
      implementation_commit_sha: recoveryRoomArtifact.implementation_evidence.commit_sha,
    },
    inherited_boundaries: {
      available_channels: recoveryRoomArtifact.communicator_handoff.available_channels,
      prohibited_claims: recoveryRoomArtifact.communicator_handoff.prohibited_claims,
      required_disclosures: recoveryRoomArtifact.communicator_handoff.required_disclosures,
    },
    provenance: {
      provider: "openrouter",
      requested_model: "example/communicator-free",
      resolved_model: "example/communicator-free",
      prompt_version: "communicator.v1.2.0",
      generated_at: "2026-08-06T03:00:00.000Z",
    },
  });

  return {
    run_id: researchBrief.run_id,
    research_brief: researchBrief,
    design_specification: designSpecification,
    recovery_room_artifact: recoveryRoomArtifact,
    communication_plan: communicationPlan,
  };
}

export function makeManagerDecisionDraft(): ManagerDecisionDraft {
  return {
    decision: "approve",
    executive_summary: "The four-stage chain is coherent, evidence-traceable and consent-safe; it is ready for a named human to make the final approval call.",
    rationale: "Each stage cites and transforms its predecessor, the customer-facing plan stays view-only and aggregate, and every claim resolves to a verified evidence key.",
    chain_assessment: [
      { stage: "researcher", cumulative_contribution: "Established the cited retention opportunity from fresh aggregate evidence.", concerns: [] },
      { stage: "designer", cumulative_contribution: "Turned the brief into a consent-aware recovery specification with explicit decline paths.", concerns: [] },
      { stage: "maker", cumulative_contribution: "Built a working, accessible Recovery Room bound to the design and its evidence keys.", concerns: [] },
      { stage: "communicator", cumulative_contribution: "Produced an email-only, non-coercive invitation that adds no claim beyond the artefact.", concerns: [] },
    ],
    trust_evaluation: {
      evidence_traceability: { status: "pass", finding: "Every material claim resolves to a verified predecessor evidence key." },
      consent_and_human_control: { status: "pass", finding: "Decline paths are equal to the invitation and no follow-up occurs without new consent." },
      claim_discipline: { status: "pass", finding: "The plan keeps aggregate framing and invents no causal or numeric claim." },
      accessibility_and_safety: { status: "pass", finding: "The build carries WCAG 2.2 AA evidence and reduced-motion behaviour." },
    },
    human_review_focus: [
      "Confirm the aggregate metrics in the email copy are acceptable for customer eyes.",
      "Confirm the named human owner is ready to honour every decline path before approval.",
    ],
  };
}
