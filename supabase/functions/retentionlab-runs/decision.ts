import { z } from "npm:zod@4.4.3";

// Authenticated human decision at the mandatory approval boundary.
//
// This module owns two things and nothing else: establishing WHO the operator is from a bearer token
// the service verifies itself, and asking the service-only RPC to record ONE decision against the
// exact stored Manager artefact hash. It performs no model call, sends no customer communication and
// takes no other external action — an approval clears a sealed case record for internal promotion.
//
// The operator identity is never accepted from the request body. It is only ever the subject returned
// by Supabase Auth for the presented token.

export const DECISION_ORDER = ["approve", "reject"] as const;
export type HumanDecision = (typeof DECISION_ORDER)[number];

const RATIONALE_MIN = 20;
const RATIONALE_MAX = 1_000;

export const decisionInputSchema = z.object({
  run_id: z.uuid(),
  expected_manager_artifact_sha256: z.string().regex(/^[0-9a-f]{64}$/),
  decision: z.enum(DECISION_ORDER),
  rationale: z.string().trim().min(RATIONALE_MIN).max(RATIONALE_MAX),
  idempotency_key: z.string().trim().regex(/^[A-Za-z0-9._:-]+$/).min(8).max(200),
}).strict();
export type DecisionInput = z.infer<typeof decisionInputSchema>;

// Supabase Auth returns the verified subject for the presented token. Only the id is taken; nothing
// else about the operator crosses into the run projection.
const authUserSchema = z.object({ id: z.uuid() }).passthrough();

const rpcResultSchema = z.union([
  z.object({ recorded: z.literal(false), reason: z.string() }).passthrough(),
  z.object({
    recorded: z.literal(true),
    replayed: z.boolean(),
    decision: z.enum(DECISION_ORDER),
    status: z.string(),
    promoted: z.boolean(),
  }).passthrough(),
]);

const contextResultSchema = z.union([
  z.object({ available: z.literal(false), reason: z.string() }).passthrough(),
  z.object({
    available: z.literal(true),
    manager_artifact_sha256: z.string().regex(/^[0-9a-f]{64}$/),
    chain_verified: z.boolean(),
    human_approval_required: z.literal(true),
    autonomous_external_actions: z.literal(false),
    external_actions_permitted: z.literal(0),
    permitted_next_action: z.string().min(1).max(80),
    consented_channel: z.string().min(1).max(40).nullable(),
  }).passthrough(),
]);

export class DecisionError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

// A refusal from the RPC is a governance outcome, not a crash. Each maps to the status that tells the
// operator the truth about why nothing was recorded.
const REFUSAL_STATUS: Record<string, { status: number; message: string }> = {
  operator_not_authorised: {
    status: 403,
    message: "This account is not an authorised approval operator",
  },
  run_not_at_approval_boundary: {
    status: 409,
    message: "Only a run awaiting human approval can be decided",
  },
  manager_artifact_not_sealed: {
    status: 409,
    message: "The Manager artefact for this run is not sealed",
  },
  manager_artifact_hash_mismatch: {
    status: 409,
    message: "The supplied Manager artefact hash does not match the sealed record",
  },
  decision_conflict: {
    status: 409,
    message: "A different decision is already recorded for this run",
  },
};

/**
 * Establishes the operator identity by asking Supabase Auth to verify the presented bearer token.
 * The token is never decoded locally and never logged; an unverifiable token yields 401.
 */
export async function verifyOperator(options: {
  authorization: string | null;
  supabaseUrl: string;
  publishableKey: string;
  fetchImplementation?: typeof fetch;
}): Promise<string> {
  const header = options.authorization?.trim() ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match) {
    throw new DecisionError("Approval requires an authenticated operator", 401);
  }

  const fetchImplementation = options.fetchImplementation ?? fetch;
  let response: Response;
  try {
    response = await fetchImplementation(`${options.supabaseUrl}/auth/v1/user`, {
      method: "GET",
      headers: {
        accept: "application/json",
        apikey: options.publishableKey,
        authorization: `Bearer ${match[1]}`,
      },
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    throw new DecisionError("Operator identity could not be verified", 503);
  }

  if (!response.ok) {
    throw new DecisionError("Approval requires an authenticated operator", 401);
  }

  const payload: unknown = await response.json().catch(() => null);
  const parsed = authUserSchema.safeParse(payload);
  if (!parsed.success) {
    throw new DecisionError("Approval requires an authenticated operator", 401);
  }
  return parsed.data.id;
}

/**
 * Records exactly one human decision through the service-only RPC. The RPC owns every governance
 * check — boundary status, exact sealed Manager hash, operator allow-list and idempotency — so this
 * function adds no authority of its own and never retries a refusal.
 */
async function callRpc(options: {
  name: string;
  body: Record<string, unknown>;
  supabaseUrl: string;
  secretKey: string;
  fetchImplementation?: typeof fetch;
}): Promise<unknown> {
  const fetchImplementation = options.fetchImplementation ?? fetch;
  let response: Response;
  try {
    response = await fetchImplementation(`${options.supabaseUrl}/rest/v1/rpc/${options.name}`, {
      method: "POST",
      headers: {
        accept: "application/json",
        apikey: options.secretKey,
        "content-type": "application/json",
      },
      body: JSON.stringify(options.body),
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    throw new DecisionError("Decision store unreachable", 503);
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    console.error(`Decision RPC failed: ${response.status}`);
    throw new DecisionError("Decision could not be recorded", 502);
  }
  return payload;
}

/**
 * Loads the bounded context an authorised operator reviews before deciding. It is gated on the same
 * operator allow-list as the decision itself, so an unauthorised caller learns nothing about the run.
 */
export async function loadDecisionContext(options: {
  runId: string;
  operatorUserId: string;
  supabaseUrl: string;
  secretKey: string;
  fetchImplementation?: typeof fetch;
}) {
  const payload = await callRpc({
    name: "get_agent_run_decision_context",
    body: { p_run_id: options.runId, p_operator_user_id: options.operatorUserId },
    supabaseUrl: options.supabaseUrl,
    secretKey: options.secretKey,
    fetchImplementation: options.fetchImplementation,
  });

  const parsed = contextResultSchema.safeParse(payload);
  if (!parsed.success) {
    throw new DecisionError("Decision store returned an invalid context", 502);
  }
  if (!parsed.data.available) {
    const refusal = REFUSAL_STATUS[parsed.data.reason];
    throw new DecisionError(
      refusal?.message ?? "Decision context refused by governance policy",
      refusal?.status ?? 409,
    );
  }
  return {
    run_id: options.runId,
    manager_artifact_sha256: parsed.data.manager_artifact_sha256,
    chain_verified: parsed.data.chain_verified,
    human_approval_required: parsed.data.human_approval_required,
    autonomous_external_actions: parsed.data.autonomous_external_actions,
    external_actions_permitted: parsed.data.external_actions_permitted,
    permitted_next_action: parsed.data.permitted_next_action,
    consented_channel: parsed.data.consented_channel,
  };
}

export async function recordHumanDecision(options: {
  input: DecisionInput;
  operatorUserId: string;
  supabaseUrl: string;
  secretKey: string;
  fetchImplementation?: typeof fetch;
}): Promise<{ replayed: boolean; decision: HumanDecision }> {
  const payload = await callRpc({
    name: "record_agent_run_decision",
    body: {
      p_run_id: options.input.run_id,
      p_operator_user_id: options.operatorUserId,
      p_expected_manager_hash: options.input.expected_manager_artifact_sha256,
      p_decision: options.input.decision,
      p_rationale: options.input.rationale,
      p_idempotency_key: options.input.idempotency_key,
    },
    supabaseUrl: options.supabaseUrl,
    secretKey: options.secretKey,
    fetchImplementation: options.fetchImplementation,
  });

  const parsed = rpcResultSchema.safeParse(payload);
  if (!parsed.success) {
    throw new DecisionError("Decision store returned an invalid result", 502);
  }
  if (!parsed.data.recorded) {
    const refusal = REFUSAL_STATUS[parsed.data.reason];
    throw new DecisionError(
      refusal?.message ?? "Decision refused by governance policy",
      refusal?.status ?? 409,
    );
  }
  return { replayed: parsed.data.replayed, decision: parsed.data.decision };
}
