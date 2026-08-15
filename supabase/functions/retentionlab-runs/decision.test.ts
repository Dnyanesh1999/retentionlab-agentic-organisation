import { assert, assertEquals, assertFalse, assertRejects } from "jsr:@std/assert@1";

import {
  DecisionError,
  decisionInputSchema,
  loadDecisionContext,
  recordHumanDecision,
  verifyOperator,
} from "./decision.ts";

const RUN_ID = "982ac99a-d9aa-47a6-ba61-09f366143715";
const OPERATOR_ID = "1b4e28ba-2fa1-4d3b-9a2c-6f0d5e7c8b91";
const IMPOSTOR_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const MANAGER_HASH = "3f2b1c8e9d4a7605f1e2c3b4a5968778899aabbccddeeff00112233445566778";
const SUPABASE_URL = "https://example.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_decision_test_key";
const SECRET_KEY = "sb_secret_decision_test_key";
const BEARER = "Bearer header.payload.signature";

function input(overrides: Record<string, unknown> = {}) {
  return decisionInputSchema.parse({
    run_id: RUN_ID,
    expected_manager_artifact_sha256: MANAGER_HASH,
    decision: "approve",
    rationale: "The sealed chain verifies end to end and the invitation stays in the consented channel.",
    idempotency_key: "decision-2026-08-14-marble-001",
    ...overrides,
  });
}

function record(
  fetchImplementation: typeof fetch,
  overrides: Record<string, unknown> = {},
  operatorUserId = OPERATOR_ID,
) {
  return recordHumanDecision({
    input: input(overrides),
    operatorUserId,
    supabaseUrl: SUPABASE_URL,
    secretKey: SECRET_KEY,
    fetchImplementation,
  });
}

function refusing(reason: string): typeof fetch {
  return () => Promise.resolve(Response.json({ recorded: false, reason }));
}

async function assertDecisionError(
  operation: Promise<unknown>,
  status: number,
  messagePart: string,
) {
  const error = await assertRejects(() => operation, DecisionError);
  assertEquals(error.status, status);
  assert(
    error.message.includes(messagePart),
    `expected "${error.message}" to include "${messagePart}"`,
  );
}

// --- Operator identity ---------------------------------------------------------------------------

Deno.test("refuses a decision with no bearer token and never calls the auth service", async () => {
  const urls: string[] = [];
  const fetchImplementation: typeof fetch = (url) => {
    urls.push(String(url));
    return Promise.resolve(Response.json({ id: OPERATOR_ID }));
  };

  for (const authorization of [null, "", "  ", "Basic abc", "Bearer", "token-only"]) {
    await assertDecisionError(
      verifyOperator({ authorization, supabaseUrl: SUPABASE_URL, publishableKey: PUBLISHABLE_KEY, fetchImplementation }),
      401,
      "authenticated operator",
    );
  }
  assertEquals(urls.length, 0);
});

Deno.test("refuses a bearer token the auth service does not accept", async () => {
  const fetchImplementation: typeof fetch = () =>
    Promise.resolve(Response.json({ message: "invalid JWT" }, { status: 401 }));

  await assertDecisionError(
    verifyOperator({ authorization: BEARER, supabaseUrl: SUPABASE_URL, publishableKey: PUBLISHABLE_KEY, fetchImplementation }),
    401,
    "authenticated operator",
  );
});

Deno.test("takes the operator identity from the verified token, never from the caller", async () => {
  let seenAuthorization = "";
  let seenApikey = "";
  const fetchImplementation: typeof fetch = (url, init) => {
    assertEquals(String(url), `${SUPABASE_URL}/auth/v1/user`);
    const headers = new Headers(init?.headers);
    seenAuthorization = headers.get("authorization") ?? "";
    seenApikey = headers.get("apikey") ?? "";
    return Promise.resolve(Response.json({ id: OPERATOR_ID, email: "operator@example.test" }));
  };

  const operatorId = await verifyOperator({
    authorization: BEARER,
    supabaseUrl: SUPABASE_URL,
    publishableKey: PUBLISHABLE_KEY,
    fetchImplementation,
  });

  assertEquals(operatorId, OPERATOR_ID);
  assertEquals(seenAuthorization, BEARER);
  assertEquals(seenApikey, PUBLISHABLE_KEY);
});

// --- Input contract ------------------------------------------------------------------------------

Deno.test("rejects a caller-supplied operator identity and a malformed manager hash", () => {
  for (const overrides of [
    { operator_user_id: IMPOSTOR_ID },
    { expected_manager_artifact_sha256: "not-a-hash" },
    { expected_manager_artifact_sha256: MANAGER_HASH.toUpperCase() },
    { decision: "revise" },
    { rationale: "too short" },
  ]) {
    const parsed = decisionInputSchema.safeParse({
      run_id: RUN_ID,
      expected_manager_artifact_sha256: MANAGER_HASH,
      decision: "approve",
      rationale: "The sealed chain verifies end to end and stays inside the consented channel.",
      idempotency_key: "decision-2026-08-14-marble-001",
      ...overrides,
    });
    assertFalse(parsed.success, `expected ${JSON.stringify(overrides)} to be rejected`);
  }
});

// --- Governance refusals -------------------------------------------------------------------------

Deno.test("surfaces each governance refusal with a truthful status", async () => {
  const expectations: [string, number, string][] = [
    ["operator_not_authorised", 403, "authorised approval operator"],
    ["run_not_at_approval_boundary", 409, "awaiting human approval"],
    ["manager_artifact_not_sealed", 409, "not sealed"],
    ["manager_artifact_hash_mismatch", 409, "does not match the sealed record"],
    ["decision_conflict", 409, "already recorded"],
  ];

  for (const [reason, status, messagePart] of expectations) {
    await assertDecisionError(record(refusing(reason)), status, messagePart);
  }
});

Deno.test("refuses an unrecognised refusal reason rather than treating it as success", async () => {
  await assertDecisionError(record(refusing("some_new_policy_rule")), 409, "governance policy");
});

// --- Recording -----------------------------------------------------------------------------------

Deno.test("records one decision against the exact sealed manager hash", async () => {
  const requests: { url: string; method: string; body: string }[] = [];
  const fetchImplementation: typeof fetch = (url, init) => {
    requests.push({ url: String(url), method: init?.method ?? "GET", body: String(init?.body) });
    return Promise.resolve(Response.json({
      recorded: true,
      replayed: false,
      decision: "approve",
      status: "approved",
      promoted: true,
    }));
  };

  const result = await record(fetchImplementation);

  assertEquals(result, { replayed: false, decision: "approve" });
  assertEquals(requests.length, 1);
  assertEquals(requests[0].url, `${SUPABASE_URL}/rest/v1/rpc/record_agent_run_decision`);
  const body = JSON.parse(requests[0].body);
  assertEquals(body.p_run_id, RUN_ID);
  assertEquals(body.p_operator_user_id, OPERATOR_ID);
  assertEquals(body.p_expected_manager_hash, MANAGER_HASH);
  assertEquals(body.p_decision, "approve");
});

Deno.test("returns a replayed decision without issuing a second write", async () => {
  let calls = 0;
  const fetchImplementation: typeof fetch = () => {
    calls += 1;
    return Promise.resolve(Response.json({
      recorded: true,
      replayed: true,
      decision: "approve",
      status: "approved",
      promoted: true,
    }));
  };

  const result = await record(fetchImplementation);

  assertEquals(result, { replayed: true, decision: "approve" });
  assertEquals(calls, 1);
});

Deno.test("never mutates or deletes recorded history", async () => {
  // The RPC is the only write path, and it is append-only by construction. This asserts the worker
  // side issues no direct table write at all — the live append-only proof is in docs/qa-human-approval.md.
  const methods: string[] = [];
  const urls: string[] = [];
  const fetchImplementation: typeof fetch = (url, init) => {
    urls.push(String(url));
    methods.push((init?.method ?? "GET").toUpperCase());
    return Promise.resolve(Response.json({
      recorded: true,
      replayed: false,
      decision: "reject",
      status: "rejected",
      promoted: false,
    }));
  };

  const result = await record(fetchImplementation, { decision: "reject" });

  assertEquals(result.decision, "reject");
  assertEquals(methods, ["POST"]);
  assertFalse(urls.some((url) => url.includes("agent_run_events")));
  assertFalse(urls.some((url) => url.includes("agent_runs?")));
});

// --- Decision context ----------------------------------------------------------------------------

function context(fetchImplementation: typeof fetch, operatorUserId = OPERATOR_ID) {
  return loadDecisionContext({
    runId: RUN_ID,
    operatorUserId,
    supabaseUrl: SUPABASE_URL,
    secretKey: SECRET_KEY,
    fetchImplementation,
  });
}

Deno.test("returns only the bounded decision context an operator needs", async () => {
  const fetchImplementation: typeof fetch = () =>
    Promise.resolve(Response.json({
      available: true,
      manager_artifact_sha256: MANAGER_HASH,
      chain_verified: true,
      human_approval_required: true,
      autonomous_external_actions: false,
      external_actions_permitted: 0,
      permitted_next_action: "await_human_approval",
      consented_channel: "in_app",
      // The store must never widen this surface by accident, so extra keys are dropped, not forwarded.
      artifact: { executive_summary: "private prose" },
      research_hash: "b".repeat(64),
    }));

  const result = await context(fetchImplementation);

  assertEquals(result.manager_artifact_sha256, MANAGER_HASH);
  assertEquals(result.consented_channel, "in_app");
  assertEquals(result.external_actions_permitted, 0);
  const serialised = JSON.stringify(result);
  assertFalse(serialised.includes("private prose"));
  assertFalse(serialised.includes("b".repeat(64)));
});

Deno.test("refuses decision context for an unauthorised operator or a run off the boundary", async () => {
  await assertDecisionError(
    context(
      () => Promise.resolve(Response.json({ available: false, reason: "operator_not_authorised" })),
      IMPOSTOR_ID,
    ),
    403,
    "authorised approval operator",
  );
  await assertDecisionError(
    context(() => Promise.resolve(Response.json({ available: false, reason: "run_not_at_approval_boundary" }))),
    409,
    "awaiting human approval",
  );
});

Deno.test("reports an unknown run as 404 rather than blaming the service", async () => {
  // The RPC raises P0002 for a missing run, which PostgREST surfaces as 404. Collapsing that into a
  // generic 502 told the operator the service had failed when the run id was simply wrong.
  const notFound: typeof fetch = () =>
    Promise.resolve(Response.json({ code: "P0002", message: "hosted run not found" }, { status: 404 }));

  await assertDecisionError(context(notFound), 404, "Run not found");
  await assertDecisionError(record(notFound), 404, "Run not found");
});

Deno.test("names the operation that failed instead of always claiming a write", async () => {
  const broken: typeof fetch = () => Promise.resolve(Response.json({ error: "boom" }, { status: 500 }));

  await assertDecisionError(context(broken), 502, "Decision context could not be loaded");
  await assertDecisionError(record(broken), 502, "Decision could not be recorded");
});

Deno.test("fails closed when the decision store is unreachable or returns nonsense", async () => {
  await assertDecisionError(
    record(() => Promise.reject(new TypeError("network down"))),
    503,
    "unreachable",
  );
  await assertDecisionError(
    record(() => Promise.resolve(Response.json({ error: "boom" }, { status: 500 }))),
    502,
    "could not be recorded",
  );
  await assertDecisionError(
    record(() => Promise.resolve(Response.json({ recorded: "yes" }))),
    502,
    "invalid result",
  );
});
