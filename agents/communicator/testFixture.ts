import { recoveryRoomArtifactSchema, type RecoveryRoomArtifact } from "../maker/contracts.js";
import { hashDesignSpecification } from "../maker/run.js";
import { makeMakerDraft, makeMakerImplementation, makeMakerInput } from "../maker/testFixture.js";
import type { CommunicationDraft, CommunicatorInput } from "./contracts.js";

export function makeRecoveryRoomArtifact(): RecoveryRoomArtifact {
  const input = makeMakerInput();
  const draft = makeMakerDraft(input);
  const implementation = makeMakerImplementation(input);
  return recoveryRoomArtifactSchema.parse({
    ...draft,
    schema_version: "recovery-room-artifact.v1",
    stage: "maker",
    agent: { id: "maker", name: "Noor Patel", personality: "pragmatic, meticulous, accessibility-first" },
    run_id: input.run_id,
    account_slug: input.design_specification.account_slug,
    source: {
      design_schema_version: input.design_specification.schema_version,
      design_prompt_version: input.design_specification.provenance.prompt_version,
      design_generated_at: input.design_specification.provenance.generated_at,
      design_artifact_sha256: hashDesignSpecification(input.design_specification),
    },
    inherited_guardrails: {
      allowed_channels: input.design_specification.consent_design.inherited_allowed_channels,
      prohibited_actions: input.design_specification.consent_design.inherited_prohibited_actions,
    },
    implementation_evidence: implementation,
    communicator_handoff: {
      ...draft.communicator_handoff,
      available_channels: input.design_specification.consent_design.inherited_allowed_channels,
      prohibited_claims: input.design_specification.consent_design.inherited_prohibited_actions,
    },
    provenance: {
      provider: "openrouter",
      requested_model: "example/maker-free",
      resolved_model: "example/maker-free",
      prompt_version: "maker.v1.1.0",
      generated_at: "2026-08-06T02:30:00.000Z",
    },
  });
}

export function makeCommunicatorInput(): CommunicatorInput {
  const artifact = makeRecoveryRoomArtifact();
  return { run_id: artifact.run_id, recovery_room_artifact: artifact };
}

export function makeCommunicationDraft(input = makeCommunicatorInput()): CommunicationDraft {
  const source = input.recovery_room_artifact.communicator_handoff.supported_claims[0]!;
  return {
    status: "ready_for_manager",
    campaign_thesis: "Invite the account to inspect its aggregate signals in a quiet, optional experience that makes evidence and customer choice equally visible.",
    tone_rules: [
      "Describe observations without judging performance.",
      "Keep every decline path as clear as the invitation.",
      "Qualify aggregate evidence and avoid causal language.",
    ],
    email_invitation: {
      subject: "A quiet view of your team's recent patterns",
      preheader: "Inspect cited account signals at your own pace; no action is required.",
      body_paragraphs: [
        "We have prepared a quiet view of recent aggregate account patterns for your team.",
        "You can inspect the evidence at your own pace and leave at any time. No action is required.",
      ],
      cta_label: "View signal garden",
      landing_route: "#/cases/recovery-room",
    },
    message_claims: [{
      message: "The experience presents cited aggregate account signals for customer-led inspection.",
      source_claims: [source.claim],
      evidence_keys: source.source_evidence_keys,
      qualification: source.qualification,
    }],
    transparency: {
      why_received: "This email is the single permitted invitation to inspect aggregate account signals.",
      data_boundary: "The experience uses cited aggregate account evidence and does not diagnose a cause.",
      choice_statement: "Opening, declining or ignoring the invitation creates no obligation or automatic follow-up.",
    },
    follow_up_policy: "none_without_new_explicit_consent",
    measurement_plan: [
      { signal: "Voluntary garden entry", interpretation: "The invitation was clear enough to inspect.", guardrail: "Do not treat non-entry as failure or trigger follow-up." },
      { signal: "Consent integrity", interpretation: "Every interaction stayed within explicit choices.", guardrail: "Any unpermitted contact invalidates campaign success." },
    ],
    manager_handoff: {
      launch_recommendation: "proceed_to_review",
      executive_summary: "One consent-bound email invites optional inspection of the verified Signal Garden without an automated follow-up sequence.",
      decision_questions: [
        "Does the invitation remain proportionate to the evidence and customer preference?",
        "Are operational owners prepared to honour decline and retention boundaries?",
      ],
      operational_dependencies: ["Verified Recovery Room route and one-time email capability."],
      risks: [{ risk: "The invitation could feel corrective.", mitigation: "Keep the copy observational and explicitly action-free." }],
    },
  };
}
