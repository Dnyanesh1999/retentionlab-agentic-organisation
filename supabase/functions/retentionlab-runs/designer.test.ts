import { assertEquals, assertFalse, assertMatch } from "jsr:@std/assert@1";

import { executeHostedDesigner } from "./designer.ts";

const RUN_ID = "8f14e45f-ceea-467a-9575-0e2d6b3f1a20";
const LEASE_ID = "62d738a2-e63d-4872-bc33-6f14f45f4a75";
const PREDECESSOR_HASH = "a".repeat(64);
const EVIDENCE_KEY = "product:northstar-loom:active_users:2";
const PREFERENCE_KEY = "preference:northstar-loom:2";
const RETRIEVED_AT = "2026-08-14T12:00:00.000Z";
const COMPONENTS = [
  "SignalStrand", "SignalCanvas", "LoadingState", "ReadyState", "ActiveInspection",
  "ClarificationModal", "SuccessState", "DeclinedState", "ErrorState", "ReducedMotionState",
];

export function researchBrief() {
  return {
    schema_version: "research-brief.v1",
    stage: "researcher",
    status: "completed",
    agent: { id: "researcher", name: "Nia Calder", personality: "forensic, humane, constructively sceptical" },
    run_id: RUN_ID,
    account_slug: "northstar-loom",
    brief_summary: "Product evidence shows a material decline that warrants a consent-safe recovery investigation.",
    observations: [{
      claim: "Active user evidence shows a material decline.",
      significance: "high",
      confidence: 0.9,
      citations: [{
        evidence_key: EVIDENCE_KEY,
        source_tool: "list_product_signals",
        source_system: "Supabase Postgres",
        retrieved_at: RETRIEVED_AT,
      }],
    }],
    hypotheses: [{
      statement: "Reduced adoption may be increasing retention risk.",
      confidence: 0.65,
      supporting_evidence_keys: [EVIDENCE_KEY],
      disconfirming_evidence_needed: "Fresh qualitative feedback showing the decline is temporary.",
    }],
    consent_boundaries: {
      allowed_channels: ["email"],
      prohibited_actions: ["No outreach without human approval."],
      citations: [{
        evidence_key: PREFERENCE_KEY,
        source_tool: "get_preference_profile",
        source_system: "Supabase Postgres",
        retrieved_at: RETRIEVED_AT,
      }],
    },
    unknowns: ["The customer intent behind the decline remains unknown."],
    designer_handoff: {
      design_challenge: "Create a consent-respecting recovery experience grounded in the observed decline.",
      priority_outcomes: ["Restore useful product engagement."],
      non_negotiables: ["Retain the human approval boundary."],
      success_signals: ["Active usage stabilises across the next measurement window."],
    },
    provenance: {
      provider: "openrouter",
      requested_model: "test/researcher:free",
      resolved_model: "test/researcher:free",
      prompt_version: "researcher.v1.1.0",
      generated_at: RETRIEVED_AT,
      tool_calls: [
        "get_account_snapshot", "list_product_signals", "list_billing_events",
        "list_support_events", "get_preference_profile",
      ],
      all_sources_no_store: true,
    },
  };
}

function designSpecification(evidenceKey = EVIDENCE_KEY) {
  const principle = (name: string) => ({
    name,
    rationale: "Keep the customer in control while presenting only verified aggregate evidence.",
    source_evidence_keys: [evidenceKey],
  });
  const journey = (index: number) => ({
    step_id: `step-${index}`,
    title: `Recovery step ${index}`,
    customer_goal: "Understand the verified signal without pressure.",
    system_response: "Reveal one cited aggregate signal and preserve an obvious exit path.",
    source_evidence_keys: [evidenceKey],
    consent_check: "Continue only through the inherited allowed channel and explicit customer choice.",
    maker_acceptance_criteria: ["The step is keyboard reachable and exposes its citation."],
  });
  return {
    schema_version: "recovery-design.v1",
    stage: "designer",
    status: "ready_for_maker",
    agent: { id: "designer", name: "Luca Moretti", personality: "cinematic, systems-minded, ethically exacting" },
    run_id: RUN_ID,
    account_slug: "northstar-loom",
    source: {
      research_schema_version: "research-brief.v1",
      research_prompt_version: "researcher.v1.1.0",
      research_generated_at: RETRIEVED_AT,
      research_artifact_sha256: PREDECESSOR_HASH,
    },
    inherited_research_constraints: {
      priority_outcomes: ["Restore useful product engagement."],
      non_negotiables: ["Retain the human approval boundary."],
      success_signals: ["Active usage stabilises across the next measurement window."],
    },
    design_thesis: "A calm progressive reveal can make verified risk legible while preserving customer agency and consent.",
    experience_principles: [principle("Evidence before interpretation"), principle("Agency at every step"), principle("Calm, bounded motion")],
    recovery_concept: {
      name: "Signal Garden",
      one_line_promise: "Inspect each verified signal and choose what happens next.",
      interaction_model: "progressive_reveal",
      entry_state: "A concise consent-safe invitation introduces the evidence boundary.",
      core_moment: "The customer inspects cited aggregate strands and may clarify uncertainty without pressure.",
      exit_state: "A persistent exit confirms that no action occurred and preserves customer control.",
    },
    journey: [journey(1), journey(2), journey(3)],
    content_architecture: [
      { region_id: "evidence-entry", label: "Evidence entry", purpose: "Explain the verified evidence boundary.", priority: "primary" },
      { region_id: "signal-canvas", label: "Signal canvas", purpose: "Present inspect-only aggregate signals.", priority: "primary" },
      { region_id: "decision-exit", label: "Decision and exit", purpose: "Preserve customer choice and the human gate.", priority: "secondary" },
    ],
    consent_design: {
      inherited_allowed_channels: ["email"],
      inherited_prohibited_actions: ["No outreach without human approval."],
      permission_moments: [{
        moment: "Before opening optional clarification",
        customer_control: "The customer explicitly chooses whether to answer.",
        decline_path: "Declining closes the prompt and preserves the persistent exit.",
      }],
      additional_safety_patterns: ["No preselected choices or urgency language."],
    },
    accessibility_requirements: {
      target: "WCAG 2.2 AA",
      keyboard: ["All signals are reachable in logical document order.", "Escape closes only the active modal dialog."],
      screen_reader: ["Every signal exposes a concise name and state.", "Status changes use a restrained live region."],
      visual: ["Text and controls meet AA contrast requirements.", "Focus indicators remain visible against every surface."],
      reduced_motion: ["Motion is replaced by immediate state changes.", "No meaning depends on animation timing or direction."],
    },
    motion_language: {
      intent: "Motion reveals causality between customer choice and interface state.",
      transitions: ["Entry content settles once when the page becomes ready.", "A selected signal expands only after explicit activation."],
      reduced_motion_fallback: "Render final states immediately while preserving hierarchy and status text.",
    },
    measurement_plan: [
      { signal: "Aggregate usage stabilisation", interpretation: "The cited account signal no longer declines.", source_success_signal: "Active usage stabilises across the next measurement window.", guardrail: "Never attribute account-level change to an individual." },
      { signal: "Safe clarification completion", interpretation: "Optional clarification is completed without coercion.", source_success_signal: "Active usage stabilises across the next measurement window.", guardrail: "Decline and exit remain equally prominent." },
    ],
    risks_and_mitigations: [
      { risk: "Aggregate evidence may appear more certain than it is.", mitigation: "Show citations and retain explicit hypothesis language.", escalation_trigger: "Pause if a claim lacks a predecessor evidence key." },
      { risk: "Motion may distract or imply urgency.", mitigation: "Bind transitions only to explicit state changes.", escalation_trigger: "Replace motion if reduced-motion behavior loses meaning." },
    ],
    maker_handoff: {
      build_order: ["Implement loading and error boundaries first.", "Build the inspect-only signal canvas second.", "Add consent-safe clarification and exit states last."],
      reusable_components: COMPONENTS,
      interaction_states: ["loading", "ready", "active", "success", "declined", "error", "reduced_motion"],
      data_bindings: [
        { field_path: "signals.active_users", evidence_key: evidenceKey, display_purpose: "Show the cited aggregate active-user signal." },
        { field_path: "signals.adoption_context", evidence_key: evidenceKey, display_purpose: "Explain why the aggregate signal matters." },
      ],
      acceptance_tests: [
        "Every rendered claim includes a valid predecessor evidence key.",
        "Keyboard users can inspect every signal and reach the exit.",
        "Reduced motion preserves all content and interaction states.",
        "Declining clarification causes no external customer action.",
      ],
    },
    provenance: {
      provider: "openrouter",
      requested_model: "test/designer:free",
      resolved_model: "test/designer:free",
      prompt_version: "designer.v1.8.0",
      generated_at: RETRIEVED_AT,
    },
  };
}

function creativeDelta(evidenceKey = EVIDENCE_KEY) {
  const specification = designSpecification(evidenceKey);
  return {
    design_thesis: specification.design_thesis,
    experience_principles: specification.experience_principles,
    recovery_concept: specification.recovery_concept,
    journey: specification.journey,
    permission_moment: specification.consent_design.permission_moments[0],
    motion_intent: specification.motion_language.intent,
  };
}

function options(fetchImplementation: typeof fetch) {
  return {
    runId: RUN_ID,
    supabaseUrl: "https://example.supabase.co",
    secretKey: "sb_secret_worker_test_key",
    openRouterApiKey: "sk-or-v1-worker-test-key-1234567890",
    requestedModel: "test/designer:free",
    fetchImplementation,
  };
}

function claimed() {
  return {
    claimed: true,
    lease_token: LEASE_ID,
    run_id: RUN_ID,
    account_slug: "northstar-loom",
    predecessor_artifact: researchBrief(),
    predecessor_hash: PREDECESSOR_HASH,
  };
}

Deno.test("does not call a model when the Designer lease is not claimed", async () => {
  const urls: string[] = [];
  const fetchImplementation: typeof fetch = (input) => {
    urls.push(String(input));
    return Promise.resolve(Response.json({ claimed: false, reason: "researcher_not_sealed" }));
  };

  const result = await executeHostedDesigner(options(fetchImplementation));

  assertEquals(result, { status: "not_claimed", reason: "researcher_not_sealed" });
  assertEquals(urls.length, 1);
  assertFalse(urls.some((url) => url.includes("openrouter.ai")));
});

Deno.test("inherits the private ResearchBrief and seals a validated Designer artefact", async () => {
  let completionBody = "";
  const fetchImplementation: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("claim_agent_run_designer")) return Response.json(claimed());
    if (url.includes("openrouter.ai")) {
      const request = JSON.parse(String(init?.body));
      assertEquals(request.max_tokens, 4_500);
      assertEquals(request.provider, { require_parameters: true });
      assertMatch(request.messages[1].content, /SignalStrand/);
      return Response.json(JSON.stringify({
        model: "test/designer:free",
        choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ ...creativeDelta(), provider_note: "ignored root metadata" }) } }],
      }));
    }
    if (url.endsWith("complete_agent_run_designer")) {
      completionBody = String(init?.body);
      return Response.json({ completed: true, next_stage: "maker" });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const result = await executeHostedDesigner(options(fetchImplementation));

  assertEquals(result.status, "completed");
  const completion = JSON.parse(completionBody);
  assertEquals(completion.p_lease_token, LEASE_ID);
  assertEquals(completion.p_artifact.source.research_artifact_sha256, PREDECESSOR_HASH);
  assertEquals(completion.p_artifact.maker_handoff.reusable_components, COMPONENTS);
  assertFalse("provider_note" in completion.p_artifact);
  assertMatch(completion.p_artifact_hash, /^[0-9a-f]{64}$/);
  assertMatch(completion.p_public_summary, /10 reviewed components/);
});

Deno.test("fails closed when Designer invents evidence lineage", async () => {
  let failureBody = "";
  const fetchImplementation: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("claim_agent_run_designer")) return Response.json(claimed());
    if (url.includes("openrouter.ai")) {
      return Response.json({ model: "test/designer:free", choices: [{ finish_reason: "stop", message: { content: JSON.stringify(creativeDelta("product:northstar-loom:invented:9")) } }] });
    }
    if (url.endsWith("fail_agent_run_stage")) {
      failureBody = String(init?.body);
      return Response.json({ recorded: true });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const result = await executeHostedDesigner(options(fetchImplementation));

  assertEquals(result, { status: "failed" });
  const failure = JSON.parse(failureBody);
  assertEquals(failure.p_stage, "designer");
  assertMatch(failure.p_reason, /did not preserve verified Researcher lineage/);
  assertFalse(failureBody.includes("invented:9"));
});
