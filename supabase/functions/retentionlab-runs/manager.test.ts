import { assertEquals, assertFalse, assertMatch } from "jsr:@std/assert@1";

import { makeManagerInput } from "../../../agents/manager/testFixture.ts";
import { executeHostedManager } from "./manager.ts";

const RUN_ID = "18a7e151-9e3b-4fd5-90de-2bba2ab54860";
const LEASE_ID = "62d738a2-e63d-4872-bc33-6f14f45f4a75";
const COMMUNICATOR_HASH = "d".repeat(64);

function decisionDelta() {
  return {
    executive_summary:
      "The complete chain is coherent, evidence-linked and ready for a named human to make the final approval decision.",
    rationale:
      "Each specialist preserved the sealed predecessor boundaries, and the customer-facing plan remains consent-safe and non-autonomous.",
    stage_concerns: {
      researcher: [],
      designer: [],
      maker: [],
      communicator: [],
    },
    human_review_focus: [
      "Confirm the aggregate evidence remains proportionate for customer-facing use.",
      "Confirm the named operational owner will honour every decline path before approval.",
    ],
  };
}

function claimed() {
  const input = makeManagerInput();
  const researchArtifact = {
    ...input.research_brief,
    provenance: {
      ...input.research_brief.provenance,
      prompt_version: "researcher.v1.1.0" as const,
    },
  };
  const designArtifact = {
    ...input.design_specification,
    source: {
      ...input.design_specification.source,
      research_prompt_version: "researcher.v1.1.0" as const,
    },
    provenance: {
      ...input.design_specification.provenance,
      prompt_version: "designer.v1.8.0" as const,
    },
  };
  const makerArtifact = {
    ...input.recovery_room_artifact,
    source: {
      ...input.recovery_room_artifact.source,
      design_prompt_version: "designer.v1.8.0" as const,
    },
  };
  const communicatorArtifact = {
    ...Object.fromEntries(Object.entries(input.communication_plan).filter(([key]) => key !== "email_invitation")),
    invitation: {
      channel: input.communication_plan.inherited_boundaries.available_channels[0],
      headline: input.communication_plan.email_invitation.subject,
      preview: input.communication_plan.email_invitation.preheader,
      body_paragraphs: input.communication_plan.email_invitation.body_paragraphs,
      cta_label: input.communication_plan.email_invitation.cta_label,
      landing_route: input.communication_plan.email_invitation.landing_route,
    },
    provenance: {
      ...input.communication_plan.provenance,
      prompt_version: "communicator.v1.4.0" as const,
    },
  };
  return {
    claimed: true,
    lease_token: LEASE_ID,
    run_id: RUN_ID,
    account_slug: input.communication_plan.account_slug,
    research_artifact: researchArtifact,
    research_hash: input.design_specification.source.research_artifact_sha256,
    design_artifact: designArtifact,
    design_hash: input.recovery_room_artifact.source.design_artifact_sha256,
    maker_artifact: makerArtifact,
    maker_hash: input.communication_plan.source.maker_artifact_sha256,
    communicator_artifact: communicatorArtifact,
    communicator_hash: COMMUNICATOR_HASH,
  };
}

function options(fetchImplementation: typeof fetch) {
  return {
    runId: RUN_ID,
    supabaseUrl: "https://example.supabase.co",
    secretKey: "sb_secret_worker_test_key",
    openRouterApiKey: "sk-or-v1-worker-test-key-1234567890",
    requestedModel: "test/manager:free",
    fetchImplementation,
  };
}

Deno.test("does not call a model when the Manager lease is not claimed", async () => {
  const urls: string[] = [];
  const fetchImplementation: typeof fetch = (input) => {
    urls.push(String(input));
    return Promise.resolve(
      Response.json({ claimed: false, reason: "communicator_not_sealed" }),
    );
  };

  const result = await executeHostedManager(options(fetchImplementation));

  assertEquals(result, {
    status: "not_claimed",
    reason: "communicator_not_sealed",
  });
  assertEquals(urls.length, 1);
  assertFalse(urls.some((url) => url.includes("openrouter.ai")));
});

Deno.test("seals exact four-stage lineage and awaits a human on approval", async () => {
  let completionBody = "";
  const fetchImplementation: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("claim_agent_run_manager")) {
      return Response.json(claimed());
    }
    if (url.includes("openrouter.ai")) {
      const request = JSON.parse(String(init?.body));
      assertEquals(request.max_tokens, 3_500);
      assertEquals(request.provider, { require_parameters: true });
      return Response.json({
        model: "test/manager:free",
        choices: [{
          finish_reason: "stop",
          message: { content: JSON.stringify(decisionDelta()) },
        }],
      });
    }
    if (url.endsWith("complete_agent_run_manager")) {
      completionBody = String(init?.body);
      return Response.json({ completed: true, status: "awaiting_approval" });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const result = await executeHostedManager(options(fetchImplementation));

  assertEquals(result.status, "completed");
  const completion = JSON.parse(completionBody);
  assertEquals(completion.p_lease_token, LEASE_ID);
  assertEquals(
    completion.p_artifact.lineage.communication_plan_sha256,
    COMMUNICATOR_HASH,
  );
  assertEquals(completion.p_artifact.lineage.chain_verified, true);
  assertEquals(completion.p_artifact.governance.human_approval_required, true);
  assertEquals(
    completion.p_artifact.governance.autonomous_external_actions,
    false,
  );
  assertEquals(
    completion.p_artifact.governance.permitted_next_action,
    "await_human_approval",
  );
  assertFalse("revision_directive" in completion.p_artifact);
  assertMatch(completion.p_artifact_hash, /^[0-9a-f]{64}$/);
  assertMatch(completion.p_public_summary, /human approval/);
});

Deno.test("rejects a broken private hash link before consulting the model", async () => {
  const urls: string[] = [];
  const broken = claimed();
  broken.maker_artifact.source.design_artifact_sha256 = "f".repeat(64);
  let failureBody = "";
  const fetchImplementation: typeof fetch = (input, init) => {
    const url = String(input);
    urls.push(url);
    if (url.endsWith("claim_agent_run_manager")) {
      return Promise.resolve(Response.json(broken));
    }
    if (url.endsWith("fail_agent_run_stage")) {
      failureBody = String(init?.body);
      return Promise.resolve(Response.json({ failed: true }));
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const result = await executeHostedManager(options(fetchImplementation));

  assertEquals(result, { status: "failed" });
  assertFalse(urls.some((url) => url.includes("openrouter.ai")));
  const failure = JSON.parse(failureBody);
  assertEquals(failure.p_stage, "manager");
  assertFalse(String(failure.p_reason).includes("northstar"));
});
