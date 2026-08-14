import { assertEquals, assertFalse, assertMatch } from "jsr:@std/assert@1";

import { executeHostedCommunicator } from "./communicator.ts";

const RUN_ID = "8f14e45f-ceea-467a-9575-0e2d6b3f1a20";
const LEASE_ID = "62d738a2-e63d-4872-bc33-6f14f45f4a75";
const MAKER_HASH = "b".repeat(64);
const EVIDENCE_KEY = "product:northstar-loom:active_users:2";
const GENERATED_AT = "2026-08-14T12:00:00.000Z";
const SOURCE_CLAIM = "Aggregate active-user evidence shows a material decline.";

function makerArtifact() {
  const components = ["SignalStrand", "SignalCanvas", "LoadingState", "ReadyState", "ActiveInspection", "ClarificationModal", "SuccessState", "DeclinedState", "ErrorState", "ReducedMotionState"];
  return {
    schema_version: "recovery-room-artifact.v1",
    stage: "maker",
    status: "ready_for_communication",
    agent: { id: "maker", name: "Noor Patel", personality: "pragmatic, meticulous, accessibility-first" },
    run_id: RUN_ID,
    account_slug: "northstar-loom",
    build_summary: "A verified, accessible Recovery Room presents cited aggregate signals for optional customer inspection.",
    experience_definition: {
      name: "Signal Garden",
      customer_promise: "Inspect verified account signals at your own pace.",
      interaction_model: "progressive_reveal",
      regions: [
        { region_id: "evidence-entry", implemented_behavior: "Explains the aggregate evidence boundary before entry." },
        { region_id: "signal-canvas", implemented_behavior: "Shows cited signals only after explicit inspection." },
        { region_id: "decision-exit", implemented_behavior: "Keeps decline and exit available throughout the experience." },
      ],
      state_transitions: [
        { from: "loading", event: "data ready", to: "ready", customer_control: "The customer chooses whether to enter." },
        { from: "ready", event: "inspect", to: "active", customer_control: "The customer selects a signal." },
        { from: "active", event: "finish", to: "success", customer_control: "The customer may leave at any time." },
        { from: "active", event: "decline", to: "declined", customer_control: "Decline causes no external action." },
      ],
    },
    source: {
      design_schema_version: "recovery-design.v1",
      design_prompt_version: "designer.v1.8.0",
      design_generated_at: GENERATED_AT,
      design_artifact_sha256: "a".repeat(64),
    },
    inherited_guardrails: { allowed_channels: ["Email"], prohibited_actions: ["No outreach without human approval."] },
    implementation_evidence: {
      commit_sha: "c38febd",
      route: "#/cases/recovery-room",
      framework: "React 19 + TypeScript + CSS",
      component_sources: components.map((component) => ({ contract_component: component, source_path: `src/features/recovery-room/${component}.tsx` })),
      implemented_states: ["loading", "ready", "active", "success", "declined", "error", "reduced_motion"],
      verification: {
        test_command: "npm test -- --run",
        test_count: 114,
        test_status: "passed",
        build_command: "npm run build",
        build_status: "passed",
        visual_evidence: ["design/reference/recovery-desktop.png", "design/reference/recovery-mobile.png"],
      },
    },
    communicator_handoff: {
      product_name: "Signal Garden",
      audience: "Account administrators reviewing aggregate workspace signals.",
      customer_value: "A calm, optional way to inspect cited account-level evidence without pressure.",
      supported_claims: [{
        claim: SOURCE_CLAIM,
        source_evidence_keys: [EVIDENCE_KEY],
        qualification: "This is aggregate account evidence and does not establish a cause.",
      }],
      required_disclosures: ["The evidence is aggregate account-level data.", "Viewing or declining causes no automatic follow-up."],
      available_channels: ["Email"],
      prohibited_claims: ["No outreach without human approval."],
    },
    residual_risks: [{ risk: "Aggregate evidence may be read as personal.", control: "Keep the aggregate-data disclosure visible." }],
    provenance: {
      provider: "openrouter",
      requested_model: "test/maker:free",
      resolved_model: "test/maker:free",
      prompt_version: "maker.v1.1.0",
      generated_at: GENERATED_AT,
    },
  };
}

function editorialDelta() {
  return {
    executive_summary: "One consent-bound email invites optional inspection of verified aggregate signals and preserves the human approval gate.",
  };
}

function options(fetchImplementation: typeof fetch) {
  return {
    runId: RUN_ID,
    supabaseUrl: "https://example.supabase.co",
    secretKey: "sb_secret_worker_test_key",
    openRouterApiKey: "sk-or-v1-worker-test-key-1234567890",
    requestedModel: "test/communicator:free",
    fetchImplementation,
  };
}

function claimed() {
  return {
    claimed: true,
    lease_token: LEASE_ID,
    run_id: RUN_ID,
    account_slug: "northstar-loom",
    predecessor_artifact: makerArtifact(),
    predecessor_hash: MAKER_HASH,
  };
}

Deno.test("does not call a model when the Communicator lease is not claimed", async () => {
  const urls: string[] = [];
  const fetchImplementation: typeof fetch = (input) => {
    urls.push(String(input));
    return Promise.resolve(Response.json({ claimed: false, reason: "maker_not_sealed" }));
  };
  assertEquals(await executeHostedCommunicator(options(fetchImplementation)), { status: "not_claimed", reason: "maker_not_sealed" });
  assertEquals(urls.length, 1);
  assertFalse(urls.some((url) => url.includes("openrouter.ai")));
});

Deno.test("seals a claim-disciplined plan with exact private Maker lineage and no external action", async () => {
  let completionBody = "";
  const fetchImplementation: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("claim_agent_run_communicator")) return Response.json(claimed());
    if (url.includes("openrouter.ai")) {
      const request = JSON.parse(String(init?.body));
      assertEquals(request.max_tokens, 3_500);
      assertMatch(request.messages[1].content, new RegExp(SOURCE_CLAIM.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      return Response.json({ model: "test/communicator:free", choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ ...editorialDelta(), ignored_metadata: true }) } }] });
    }
    if (url.endsWith("complete_agent_run_communicator")) {
      completionBody = String(init?.body);
      return Response.json({ completed: true, next_stage: "manager" });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };
  const result = await executeHostedCommunicator(options(fetchImplementation));
  assertEquals(result.status, "completed");
  const completion = JSON.parse(completionBody);
  assertEquals(completion.p_artifact.source.maker_artifact_sha256, MAKER_HASH);
  assertEquals(completion.p_artifact.message_claims[0].source_claims, [SOURCE_CLAIM]);
  assertEquals(completion.p_artifact.message_claims[0].evidence_keys, [EVIDENCE_KEY]);
  assertEquals(completion.p_artifact.inherited_boundaries.required_disclosures, makerArtifact().communicator_handoff.required_disclosures);
  assertEquals(completion.p_artifact.invitation.channel, "Email");
  assertEquals(completion.p_artifact.follow_up_policy, "none_without_new_explicit_consent");
  assertEquals(completion.p_artifact.manager_handoff.launch_recommendation, "proceed_to_review");
  assertFalse("ignored_metadata" in completion.p_artifact);
  assertMatch(completion.p_artifact_hash, /^[0-9a-f]{64}$/);
  assertMatch(completion.p_public_summary, /no communication was sent/i);
});

Deno.test("fails closed when Communicator returns an invalid editorial contract", async () => {
  let failureBody = "";
  const fetchImplementation: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("claim_agent_run_communicator")) return Response.json(claimed());
    if (url.includes("openrouter.ai")) {
      return Response.json({ model: "test/communicator:free", choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ executive_summary: "Too short." }) } }] });
    }
    if (url.endsWith("fail_agent_run_stage")) {
      failureBody = String(init?.body);
      return Response.json({ failed: true });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };
  assertEquals(await executeHostedCommunicator(options(fetchImplementation)), { status: "failed" });
  const failure = JSON.parse(failureBody);
  assertEquals(failure.p_stage, "communicator");
  assertFalse(failure.p_reason.includes("Too short"));
  assertMatch(failure.p_reason, /did not satisfy the Communication Plan contract/);
});
