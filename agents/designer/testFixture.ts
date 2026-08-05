import type { ResearchBrief } from "../researcher/contracts.js";
import type { DesignerInput, RecoveryDesignSpecification } from "./contracts.js";

export const productEvidenceKey = "product:copper-finch:feature_adoption:2";
export const consentEvidenceKey = "preference:copper-finch:2";

export function makeResearchBriefFixture(): ResearchBrief {
  return {
    schema_version: "research-brief.v1",
    stage: "researcher",
    status: "completed",
    agent: { id: "researcher", name: "Nia Calder", personality: "forensic, humane, constructively sceptical" },
    run_id: "18a7e151-9e3b-4fd5-90de-2bba2ab54860",
    account_slug: "copper-finch",
    brief_summary: "Fresh evidence indicates a consent-safe opportunity to clarify realised value and reduce workflow friction.",
    observations: [{
      claim: "Feature adoption is below its prior comparison value.",
      significance: "high",
      confidence: 1,
      citations: [{
        evidence_key: productEvidenceKey,
        source_tool: "list_product_signals",
        source_system: "Supabase Postgres",
        retrieved_at: "2026-08-05T12:00:10.000Z",
      }],
    }],
    hypotheses: [{
      statement: "Workflow friction may be reducing realised value.",
      confidence: 0.6,
      supporting_evidence_keys: [productEvidenceKey],
      disconfirming_evidence_needed: "Later evidence showing adoption recovers without a workflow intervention.",
    }],
    consent_boundaries: {
      allowed_channels: ["email"],
      prohibited_actions: ["Do not use channels absent from the preference profile."],
      citations: [{
        evidence_key: consentEvidenceKey,
        source_tool: "get_preference_profile",
        source_system: "Supabase Postgres",
        retrieved_at: "2026-08-05T12:00:10.000Z",
      }],
    },
    unknowns: ["Future intent is not observable in the current evidence."],
    designer_handoff: {
      design_challenge: "Create a consent-safe experience that makes realised value visible without overstating uncertain causes.",
      priority_outcomes: ["Clarify realised value", "Reduce unresolved friction"],
      non_negotiables: ["Respect the current preference profile", "Keep hypotheses visibly uncertain"],
      success_signals: ["Verified product engagement", "No consent-policy violation"],
    },
    provenance: {
      provider: "openrouter",
      requested_model: "openrouter/free",
      resolved_model: "example/free",
      prompt_version: "researcher.v1.0.0",
      generated_at: "2026-08-05T12:00:30.000Z",
      tool_calls: [
        "get_account_snapshot",
        "list_product_signals",
        "list_billing_events",
        "list_support_events",
        "get_preference_profile",
      ],
      all_sources_no_store: true,
    },
  };
}

export function makeDesignerInput(): DesignerInput {
  const researchBrief = makeResearchBriefFixture();
  return { run_id: researchBrief.run_id, research_brief: researchBrief };
}

export function makeDesignSpecification(input: DesignerInput): RecoveryDesignSpecification {
  return {
    schema_version: "recovery-design.v1",
    stage: "designer",
    status: "ready_for_maker",
    agent: { id: "designer", name: "Luca Moretti", personality: "cinematic, systems-minded, ethically exacting" },
    run_id: input.run_id,
    account_slug: input.research_brief.account_slug,
    source: {
      research_schema_version: "research-brief.v1",
      research_prompt_version: "researcher.v1.0.0",
      research_generated_at: "2026-08-05T12:00:30.000Z",
      research_artifact_sha256: "0".repeat(64),
    },
    inherited_research_constraints: {
      priority_outcomes: input.research_brief.designer_handoff.priority_outcomes,
      non_negotiables: input.research_brief.designer_handoff.non_negotiables,
      success_signals: input.research_brief.designer_handoff.success_signals,
    },
    design_thesis: "Use a calm, progressive story to make verified value visible while giving the customer an equally clear decline path.",
    experience_principles: ["Evidence before invitation", "Agency at every turn", "Calm causality"].map((name) => ({
      name,
      rationale: "This principle keeps the recovery experience grounded, legible, and respectful of customer choice.",
      source_evidence_keys: [productEvidenceKey],
    })),
    recovery_concept: {
      name: "Value Constellation",
      one_line_promise: "See what changed, choose what helps, and leave without pressure.",
      interaction_model: "guided_story",
      entry_state: "A quiet evidence card establishes why the experience is being offered.",
      core_moment: "The customer explores one verified signal and chooses whether a recovery path is useful.",
      exit_state: "A clear summary confirms the choice, including a no-action path with no penalty.",
    },
    journey: [1, 2, 3].map((step) => ({
      step_id: `step-${step}` as "step-1" | "step-2" | "step-3",
      title: ["Orient", "Explore", "Choose"][step - 1] ?? "Choose",
      customer_goal: "Understand the current situation without being pressured into a decision.",
      system_response: "Reveal one grounded layer at a time and retain a persistent, dignified exit.",
      source_evidence_keys: [productEvidenceKey],
      consent_check: "Do not continue or contact the customer unless the current choice permits it.",
      maker_acceptance_criteria: ["Keyboard and pointer paths produce the same explicit state transition."],
    })),
    content_architecture: [
      { region_id: "evidence-orbit", label: "Evidence orbit", purpose: "Show verified context without presenting a dense dashboard.", priority: "primary" },
      { region_id: "choice-stage", label: "Choice stage", purpose: "Let the customer compare consent-safe recovery paths.", priority: "primary" },
      { region_id: "trust-ledger", label: "Trust ledger", purpose: "Explain evidence, permissions, and consequences clearly.", priority: "supporting" },
    ],
    consent_design: {
      inherited_allowed_channels: ["email"],
      inherited_prohibited_actions: ["Do not use channels absent from the preference profile."],
      permission_moments: [{
        moment: "Before confirming a follow-up",
        customer_control: "Choose email follow-up or continue without contact.",
        decline_path: "Close the experience with no follow-up and no loss of access.",
      }],
      additional_safety_patterns: ["Keep decline and continue actions equally legible."],
    },
    accessibility_requirements: {
      target: "WCAG 2.2 AA",
      keyboard: ["Use logical focus order across every revealed layer.", "Return focus to the control that opened a layer."],
      screen_reader: ["Announce state changes through a polite live region.", "Give every evidence reference a descriptive accessible name."],
      visual: ["Maintain AA text and control contrast in every state.", "Never use color as the only carrier of meaning."],
      reduced_motion: ["Replace spatial travel with an immediate state change.", "Preserve hierarchy and causality without animated movement."],
    },
    motion_language: {
      intent: "Motion traces cause and effect while keeping the customer oriented.",
      transitions: ["Reveal evidence from its originating control.", "Settle accepted choices into the trust ledger."],
      reduced_motion_fallback: "Use opacity-free instant swaps with persistent headings and focus placement.",
    },
    measurement_plan: [
      { signal: "Engagement confirmation", interpretation: "The customer understood and voluntarily explored the experience.", source_success_signal: "Verified product engagement", guardrail: "Do not count passive exposure as engagement." },
      { signal: "Consent integrity", interpretation: "Every contact action stayed inside the inherited permission boundary.", source_success_signal: "No consent-policy violation", guardrail: "Any policy violation invalidates success." },
    ],
    risks_and_mitigations: [
      { risk: "The experience could overstate an uncertain cause.", mitigation: "Label hypotheses and show only verified observations as facts.", escalation_trigger: "Copy or UI presents a hypothesis as a confirmed reason." },
      { risk: "The recovery choice could become coercive.", mitigation: "Keep decline visible and equivalent at every permission moment.", escalation_trigger: "A path hides, delays, or penalises decline." },
    ],
    maker_handoff: {
      build_order: ["Implement typed data bindings and validation.", "Build the accessible journey state machine.", "Add motion and reduced-motion variants."],
      reusable_components: ["EvidenceOrbit", "ChoiceStage", "TrustLedger"],
      interaction_states: ["loading", "ready", "active", "success", "declined", "error", "reduced_motion"],
      data_bindings: [
        { field_path: "observations.feature-adoption", evidence_key: productEvidenceKey, display_purpose: "Ground the opening evidence card." },
        { field_path: "consent.preferred-channel", evidence_key: consentEvidenceKey, display_purpose: "Constrain the follow-up choice." },
      ],
      acceptance_tests: [
        "Every rendered evidence value resolves to a predecessor evidence key.",
        "Keyboard and pointer paths reach the same journey outcomes.",
        "Declining contact produces no follow-up state or hidden penalty.",
        "Reduced motion removes spatial transitions while preserving state meaning.",
      ],
    },
    provenance: {
      provider: "openrouter",
      requested_model: "openrouter/free",
      resolved_model: "example/free",
      prompt_version: "designer.v1.0.0",
      generated_at: "2026-08-05T12:01:00.000Z",
    },
  };
}
