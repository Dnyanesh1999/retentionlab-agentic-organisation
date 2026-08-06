import { assertEquals, assertFalse, assertMatch } from "jsr:@std/assert@1";

import { createClarificationHandler } from "./index.ts";

const publishableKey = "sb_publishable_clarification_edge_test";
const secretKey = "sb_secret_clarification_edge_test";
const capability = "test.recovery-capability_token-1234567890";
const requestId = "5f191612-74a5-46a7-af87-bffebd6c5ea8";
const submission = {
  schema_version: "clarification-submission.v1",
  account_slug: "adapter-test",
  support_evidence_key: "support:adapter-test:2-1",
  preference_evidence_key: "preference:adapter-test:2",
  observation: null,
  consent: {
    action: "share_observation",
    copy_version: "clarification-consent.v1",
  },
};

function environment(name: string) {
  return {
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({ default: publishableKey }),
    SUPABASE_SECRET_KEYS: JSON.stringify({ default: secretKey }),
    CLARIFICATION_ALLOWED_ORIGINS: "http://127.0.0.1:5173",
  }[name];
}

function browserRequest(body: unknown = submission) {
  return new Request("https://edge.example/retentionlab-clarification", {
    method: "POST",
    headers: {
      apikey: publishableKey,
      "content-type": "application/json",
      "idempotency-key": requestId,
      origin: "http://127.0.0.1:5173",
      "x-recovery-token": capability,
    },
    body: JSON.stringify(body),
  });
}

Deno.test("answers an allowed browser preflight before authentication", async () => {
  const handler = createClarificationHandler({ environment });
  const response = await handler(
    new Request("https://edge.example/retentionlab-clarification", {
      method: "OPTIONS",
      headers: { origin: "http://127.0.0.1:5173" },
    }),
  );

  assertEquals(response.status, 204);
  assertEquals(
    response.headers.get("access-control-allow-origin"),
    "http://127.0.0.1:5173",
  );
  assertMatch(
    response.headers.get("access-control-allow-headers") ?? "",
    /x-recovery-token/,
  );
});

Deno.test("stores only a token digest and returns a strict receipt", async () => {
  let rpcBody = "";
  const fetchImplementation: typeof fetch = (_input, init) => {
    rpcBody = String(init?.body);
    return Promise.resolve(Response.json([{
      submission_id: "7406f0f5-99a7-4168-bc1f-6209869a1a29",
      accepted_at: "2026-08-06T08:00:00.000Z",
      replayed: false,
      result_code: "accepted",
    }]));
  };
  const handler = createClarificationHandler({
    environment,
    fetchImplementation,
  });
  const response = await handler(browserRequest());
  const receipt = await response.json();

  assertEquals(response.status, 200);
  assertEquals(receipt.schema_version, "clarification-receipt.v1");
  assertFalse(rpcBody.includes(capability));
  assertFalse(JSON.stringify(receipt).includes("observation"));
});

Deno.test("rejects unknown payload fields before contacting the store", async () => {
  let called = false;
  const fetchImplementation: typeof fetch = () => {
    called = true;
    return Promise.resolve(Response.json([]));
  };
  const handler = createClarificationHandler({
    environment,
    fetchImplementation,
  });
  const response = await handler(
    browserRequest({ ...submission, inferred_cause: "training" }),
  );

  assertEquals(response.status, 400);
  assertFalse(called);
});

Deno.test("maps consumed capabilities to conflict without returning a receipt", async () => {
  const fetchImplementation: typeof fetch = () =>
    Promise.resolve(Response.json([{
      submission_id: null,
      accepted_at: null,
      replayed: false,
      result_code: "conflict",
    }]));
  const handler = createClarificationHandler({
    environment,
    fetchImplementation,
  });
  const response = await handler(browserRequest());

  assertEquals(response.status, 409);
  assertEquals(await response.json(), {
    error: "Recovery capability has already been used",
  });
});
