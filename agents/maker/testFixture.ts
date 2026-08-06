import { makeDesignerInput, makeDesignSpecification } from "../designer/testFixture.js";
import type {
  MakerDraft,
  MakerImplementationEvidence,
  MakerInput,
} from "./contracts.js";

export function makeMakerInput(): MakerInput {
  const specification = makeDesignSpecification(makeDesignerInput());
  return { run_id: specification.run_id, design_specification: specification };
}

export function makeMakerImplementation(input = makeMakerInput()): MakerImplementationEvidence {
  const knownSources: Record<string, string> = {
    SignalStrand: "src/features/recovery-room/SignalStrand.tsx",
    SignalCanvas: "src/features/recovery-room/SignalCanvas.tsx",
    LoadingState: "src/features/recovery-room/LoadingState.tsx",
    ReadyState: "src/features/recovery-room/RecoveryRoomView.tsx",
    ActiveInspection: "src/features/recovery-room/SignalCanvas.tsx",
    ClarificationModal: "src/features/recovery-room/ClarificationDialog.tsx",
    SuccessState: "src/features/recovery-room/AcknowledgmentBanner.tsx",
    DeclinedState: "src/features/recovery-room/AcknowledgmentBanner.tsx",
    ErrorState: "src/features/recovery-room/ClarificationDialog.tsx",
    ReducedMotionState: "src/features/recovery-room/SignalStrand.tsx",
  };
  return {
    commit_sha: "c38febd",
    route: "#/cases/recovery-room",
    framework: "React 19 + TypeScript + CSS",
    component_sources: input.design_specification.maker_handoff.reusable_components.map((component) => ({
      contract_component: component,
      source_path: knownSources[component] ?? "src/features/recovery-room/SignalCanvas.tsx",
    })),
    implemented_states: ["loading", "ready", "active", "success", "declined", "error", "reduced_motion"],
    verification: {
      test_command: "npm test -- --run",
      test_count: 114,
      test_status: "passed",
      build_command: "npm run build",
      build_status: "passed",
      visual_evidence: [
        "design/reference/signal-garden-slice5-acknowledgment-desktop.png",
        "design/reference/signal-garden-slice5-acknowledgment-mobile.png",
      ],
    },
  };
}

export function makeMakerDraft(input = makeMakerInput()): MakerDraft {
  const evidenceKey = input.design_specification.maker_handoff.data_bindings[0]!.evidence_key;
  return {
    status: "ready_for_communication",
    build_summary: "Implemented the reviewed Signal Garden as a keyboard-operable React experience with live evidence, explicit consent boundaries, recoverable errors and reduced-motion behavior.",
    experience_definition: {
      name: input.design_specification.recovery_concept.name,
      customer_promise: input.design_specification.recovery_concept.one_line_promise,
      interaction_model: input.design_specification.recovery_concept.interaction_model,
      regions: input.design_specification.content_architecture.map((region) => ({
        region_id: region.region_id,
        implemented_behavior: `Implements ${region.purpose} with the reviewed interaction and accessibility requirements.`,
      })),
      state_transitions: [
        { from: "loading", event: "evidence loaded", to: "ready", customer_control: "The customer may inspect or leave." },
        { from: "ready", event: "signal selected", to: "active", customer_control: "The customer chooses which signal to inspect." },
        { from: "active", event: "inspection closed", to: "success", customer_control: "Closing does not trigger another action." },
        { from: "active", event: "clarification declined", to: "declined", customer_control: "Decline persists nothing and returns focus." },
        { from: "active", event: "share failed", to: "error", customer_control: "The draft remains available for correction or exit." },
      ],
    },
    communicator_handoff: {
      product_name: "Signal Garden",
      audience: "A fictional B2B SaaS account reviewing aggregate account-level patterns.",
      customer_value: "A quiet, self-paced way to inspect cited account signals and optionally clarify workflow friction without pressure.",
      supported_claims: [{
        claim: "The experience presents cited aggregate account signals for customer-led inspection.",
        source_evidence_keys: [evidenceKey],
        qualification: "It does not infer a cause or promise an outcome.",
      }],
      required_disclosures: [
        "Account signals are aggregate and may not explain the reason for a change.",
        "Optional clarification is purpose-limited and requires an explicit Share action.",
      ],
    },
    residual_risks: [{
      risk: "Customers could read aggregate signal movement as a diagnosis.",
      control: "Keep the language observational, cite the source and avoid causal recommendations.",
    }],
  };
}
