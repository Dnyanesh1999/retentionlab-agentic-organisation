import { assertEquals, assertFalse, assertMatch } from "jsr:@std/assert@1";

import { executeHostedResearcher } from "./researcher.ts";

const RUN_ID = "8f14e45f-ceea-467a-9575-0e2d6b3f1a20";
const LEASE_ID = "62d738a2-e63d-4872-bc33-6f14f45f4a75";
const RETRIEVED_AT = "2026-08-14T12:00:00.000Z";
const TOOL_NAMES = [
  "get_account_snapshot",
  "list_product_signals",
  "list_billing_events",
  "list_support_events",
  "get_preference_profile",
] as const;

function options(fetchImplementation: typeof fetch) {
  return {
    runId: RUN_ID,
    accountSlug: "northstar-loom",
    objective: "Investigate retention risk and prepare a governed recovery decision.",
    initiatedAt: "2026-08-14T11:59:00.000Z",
    supabaseUrl: "https://example.supabase.co",
    publishableKey: "sb_publishable_worker_test_key",
    secretKey: "sb_secret_worker_test_key",
    openRouterApiKey: "sk-or-v1-worker-test-key-1234567890",
    requestedModel: "test/researcher:free",
    fetchImplementation,
  };
}

function envelope(tool: (typeof TOOL_NAMES)[number]) {
  const data = tool === "get_preference_profile"
    ? [{ evidence_key: "preference:northstar-loom:2", allow_recovery_outreach: true }]
    : tool === "list_product_signals"
    ? [{ evidence_key: "product:northstar-loom:active_users:2", metric_value: 120 }]
    : [];
  return {
    tool,
    source: {
      system: "Supabase Postgres",
      dataset: "retentionlab-demo-v1",
      generation_run_id: "6c415ff1-83ac-4bd4-955f-963f57fab6a7",
      generated_at: "2026-08-05T09:29:43.925Z",
      retrieved_at: RETRIEVED_AT,
      cache_mode: "no-store",
    },
    data,
  };
}

function modelBrief() {
  const productCitation = {
    evidence_key: "product:northstar-loom:active_users:2",
    source_tool: "list_product_signals",
    source_system: "Supabase Postgres",
    retrieved_at: RETRIEVED_AT,
  };
  const preferenceCitation = {
    evidence_key: "preference:northstar-loom:2",
    source_tool: "get_preference_profile",
    source_system: "Supabase Postgres",
    retrieved_at: RETRIEVED_AT,
  };
  return {
    schema_version: "research-brief.v1",
    stage: "researcher",
    status: "completed",
    agent: { id: "researcher", name: "Nia Calder", personality: "forensic, humane, constructively sceptical" },
    run_id: RUN_ID,
    account_slug: "northstar-loom",
    brief_summary: "Live product evidence shows a material decline requiring a governed recovery investigation.",
    observations: [{
      claim: "Active user evidence shows a material decline.",
      significance: "high",
      confidence: 0.9,
      citations: [productCitation],
    }],
    hypotheses: [{
      statement: "Reduced adoption may be increasing retention risk.",
      confidence: 0.65,
      supporting_evidence_keys: [productCitation.evidence_key],
      disconfirming_evidence_needed: "Fresh qualitative feedback showing the decline is temporary.",
    }],
    consent_boundaries: {
      allowed_channels: ["email"],
      prohibited_actions: ["No outreach without human approval."],
      citations: [preferenceCitation],
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
      tool_calls: [...TOOL_NAMES],
      all_sources_no_store: true,
    },
  };
}

Deno.test("does not spend a model call when the run lease is not claimed", async () => {
  const urls: string[] = [];
  const fetchImplementation: typeof fetch = (input) => {
    urls.push(String(input));
    return Promise.resolve(Response.json({ claimed: false, reason: "lease_active" }));
  };

  const result = await executeHostedResearcher(options(fetchImplementation));

  assertEquals(result, { status: "not_claimed", reason: "lease_active" });
  assertEquals(urls.length, 1);
  assertFalse(urls.some((url) => url.includes("openrouter.ai")));
});

Deno.test("uses five fresh evidence tools and completes with a private validated artifact", async () => {
  const tools: string[] = [];
  let completionBody = "";
  const fetchImplementation: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("claim_agent_run_researcher")) {
      return Response.json({ claimed: true, lease_token: LEASE_ID });
    }
    if (url.includes("retentionlab-evidence")) {
      const body = JSON.parse(String(init?.body)) as { tool: (typeof TOOL_NAMES)[number] };
      tools.push(body.tool);
      return Response.json(envelope(body.tool));
    }
    if (url.includes("openrouter.ai")) {
      assertMatch(String(init?.headers && JSON.stringify(init.headers)), /Bearer sk-or-v1/);
      const request = JSON.parse(String(init?.body));
      assertEquals(request.max_tokens, 5_000);
      assertEquals(request.provider, { require_parameters: true });
      assertFalse("max_completion_tokens" in request);
      assertFalse("session_id" in request);
      return Response.json({ model: "test/researcher:free", choices: [{ message: { content: JSON.stringify(modelBrief()) } }] });
    }
    if (url.endsWith("complete_agent_run_researcher")) {
      completionBody = String(init?.body);
      return Response.json({ completed: true, next_stage: "designer" });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const result = await executeHostedResearcher(options(fetchImplementation));

  assertEquals(result.status, "completed");
  assertEquals(tools.sort(), [...TOOL_NAMES].sort());
  const completion = JSON.parse(completionBody);
  assertEquals(completion.p_lease_token, LEASE_ID);
  assertEquals(completion.p_artifact.provenance.all_sources_no_store, true);
  assertMatch(completion.p_artifact_hash, /^[0-9a-f]{64}$/);
  assertMatch(completion.p_public_summary, /5 fresh evidence tools/);
});

Deno.test("records a bounded safe failure after a claimed model error", async () => {
  let failureBody = "";
  const fetchImplementation: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("claim_agent_run_researcher")) return Response.json({ claimed: true, lease_token: LEASE_ID });
    if (url.includes("retentionlab-evidence")) {
      const body = JSON.parse(String(init?.body)) as { tool: (typeof TOOL_NAMES)[number] };
      return Response.json(envelope(body.tool));
    }
    if (url.includes("openrouter.ai")) return Response.json({ error: { message: "secret provider detail" } }, { status: 429 });
    if (url.endsWith("fail_agent_run_stage")) {
      failureBody = String(init?.body);
      return Response.json({ recorded: true });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const result = await executeHostedResearcher(options(fetchImplementation));

  assertEquals(result, { status: "failed" });
  const failure = JSON.parse(failureBody);
  assertEquals(failure.p_stage, "researcher");
  assertMatch(failure.p_reason, /temporarily rate limited/);
  assertFalse(failureBody.includes("secret provider detail"));
});
