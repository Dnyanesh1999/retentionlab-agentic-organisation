import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { executeHostedCommunicator } from "./communicator.ts";
import { executeHostedDesigner } from "./designer.ts";
import { executeHostedMaker } from "./maker.ts";
import { executeHostedManager } from "./manager.ts";
import { executeHostedResearcher } from "./researcher.ts";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

type JsonRecord = Record<string, unknown>;

class RunGatewayError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const actions = new Set(["create_run", "get_run", "retry_run"]);
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const idempotencyPattern = /^[A-Za-z0-9._:-]+$/;
const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
} as const;

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      ...corsHeaders,
      "cache-control": "no-store, max-age=0",
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
  });
}

function environment(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new RunGatewayError(`Missing server configuration: ${name}`, 500);
  return value;
}

function namedKey(name: "SUPABASE_PUBLISHABLE_KEYS" | "SUPABASE_SECRET_KEYS") {
  const parsed = JSON.parse(environment(name)) as Record<string, unknown>;
  const value = parsed.default;
  if (typeof value !== "string" || value.length < 12) {
    throw new RunGatewayError(`Missing default key in ${name}`, 500);
  }
  return value;
}

function object(value: unknown): asserts value is JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RunGatewayError("Request body must be a JSON object", 400);
  }
}

function strictKeys(value: JsonRecord, allowed: string[]) {
  const extra = Object.keys(value).find((key) => !allowed.includes(key));
  if (extra) throw new RunGatewayError(`Unexpected argument: ${extra}`, 400);
}

function requireCaller(request: Request) {
  if (request.headers.get("apikey") !== namedKey("SUPABASE_PUBLISHABLE_KEYS")) {
    throw new RunGatewayError("Unauthorized run gateway caller", 401);
  }
}

function uuid(value: unknown, name: string) {
  if (typeof value !== "string" || !uuidPattern.test(value)) {
    throw new RunGatewayError(`${name} must be a UUID`, 400);
  }
  return value;
}

async function rest(path: string, init?: RequestInit) {
  const response = await fetch(`${environment("SUPABASE_URL")}/rest/v1/${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      apikey: namedKey("SUPABASE_SECRET_KEYS"),
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(8_000),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    console.error(`Run store request failed: ${response.status}`);
    throw new RunGatewayError(response.status === 404 ? "Run not found" : "Run store request failed", response.status === 404 ? 404 : 502);
  }
  return payload;
}

async function projection(runId: string) {
  const runParams = new URLSearchParams({
    select: "id,account_id,account_slug,idempotency_key,objective,status,current_stage,requires_human_approval,external_actions_permitted,created_at,updated_at,started_at,stopped_at",
    id: `eq.${runId}`,
    limit: "1",
  });
  const eventParams = new URLSearchParams({
    select: "run_id,sequence,event_type,stage,public_summary,created_at",
    run_id: `eq.${runId}`,
    order: "sequence.asc",
  });
  const [runs, events] = await Promise.all([
    rest(`agent_runs?${runParams.toString()}`),
    rest(`agent_run_events?${eventParams.toString()}`),
  ]);
  if (!Array.isArray(runs) || !runs[0] || !Array.isArray(events)) {
    throw new RunGatewayError("Run not found", 404);
  }
  const run = runs[0] as JsonRecord;
  const mappedEvents = events.map((value) => {
    object(value);
    const base = {
      type: value.event_type,
      sequence: value.sequence,
      occurred_at: value.created_at,
    };
    if (value.event_type === "run_created") {
      return {
        ...base,
        run_id: run.id,
        account_id: run.account_id,
        account_slug: run.account_slug,
      };
    }
    if (value.event_type === "stage_completed") {
      return { ...base, stage: value.stage, public_summary: value.public_summary };
    }
    if (value.event_type === "run_failed") {
      return { ...base, stage: value.stage, reason: value.public_summary };
    }
    return { ...base, stage: value.stage };
  });
  const completed = [...events].reverse().find((value) => {
    object(value);
    return value.event_type === "stage_completed";
  }) as JsonRecord | undefined;
  return {
    contract_version: "hosted.run.v1",
    run_id: run.id,
    account_id: run.account_id,
    account_slug: run.account_slug,
    idempotency_key: run.idempotency_key,
    objective: run.objective,
    status: run.status,
    current_stage: run.current_stage,
    public_summary: completed?.public_summary ?? null,
    created_at: run.created_at,
    updated_at: run.updated_at,
    events: mappedEvents,
  };
}

function scheduleHostedWorker(run: JsonRecord) {
  const events = Array.isArray(run.events) ? run.events : [];
  const completed = new Set(events.flatMap((event) => (
    event && typeof event === "object"
    && (event as JsonRecord).type === "stage_completed"
    && typeof (event as JsonRecord).stage === "string"
      ? [String((event as JsonRecord).stage)]
      : []
  )));
  if (run.status !== "queued" && run.status !== "in_progress") return;

  const openRouterApiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!openRouterApiKey) {
    console.error("Hosted worker is queued because its model secret is not configured.");
    return;
  }

  const runId = uuid(run.run_id, "run.run_id");
  const supabaseUrl = environment("SUPABASE_URL");
  const secretKey = namedKey("SUPABASE_SECRET_KEYS");
  let stage: "Researcher" | "Designer" | "Maker" | "Communicator" | "Manager";
  let task: Promise<{ status: string }>;

  if (!completed.has("researcher") && (run.status === "queued" || run.current_stage === "researcher")) {
    stage = "Researcher";
    task = executeHostedResearcher({
      runId,
      accountSlug: String(run.account_slug),
      objective: String(run.objective),
      initiatedAt: String(run.created_at),
      supabaseUrl,
      publishableKey: namedKey("SUPABASE_PUBLISHABLE_KEYS"),
      secretKey,
      openRouterApiKey,
      requestedModel: Deno.env.get("OPENROUTER_RESEARCHER_MODEL") ?? "nvidia/nemotron-3-super-120b-a12b:free",
    });
  } else if (completed.has("researcher") && !completed.has("designer")
    && (run.status === "queued" || run.current_stage === "designer")) {
    stage = "Designer";
    task = executeHostedDesigner({
      runId,
      supabaseUrl,
      secretKey,
      openRouterApiKey,
      requestedModel: Deno.env.get("OPENROUTER_DESIGNER_MODEL") ?? "nvidia/nemotron-3-super-120b-a12b:free",
    });
  } else if (completed.has("designer") && !completed.has("maker")
    && (run.status === "queued" || run.current_stage === "maker")) {
    stage = "Maker";
    task = executeHostedMaker({
      runId,
      supabaseUrl,
      secretKey,
      openRouterApiKey,
      requestedModel: Deno.env.get("OPENROUTER_MAKER_MODEL") ?? "nvidia/nemotron-3-super-120b-a12b:free",
    });
  } else if (completed.has("maker") && !completed.has("communicator")
    && (run.status === "queued" || run.current_stage === "communicator")) {
    stage = "Communicator";
    task = executeHostedCommunicator({
      runId,
      supabaseUrl,
      secretKey,
      openRouterApiKey,
      requestedModel: Deno.env.get("OPENROUTER_COMMUNICATOR_MODEL") ?? "nvidia/nemotron-3-super-120b-a12b:free",
    });
  } else if (completed.has("communicator") && !completed.has("manager")
    && (run.status === "queued" || run.current_stage === "manager")) {
    stage = "Manager";
    task = executeHostedManager({
      runId,
      supabaseUrl,
      secretKey,
      openRouterApiKey,
      requestedModel: Deno.env.get("OPENROUTER_MANAGER_MODEL") ?? "nvidia/nemotron-3-super-120b-a12b:free",
    });
  } else {
    return;
  }

  const observedTask = task.then((result) => {
    console.log(`Hosted ${stage} finished with status ${result.status}.`);
  }).catch(() => {
    console.error(`Hosted ${stage} background task stopped unexpectedly.`);
  });

  EdgeRuntime.waitUntil(observedTask);
}

async function invoke(action: string, args: JsonRecord) {
  if (action === "create_run") {
    strictKeys(args, ["account_slug", "objective", "idempotency_key"]);
    const accountSlug = args.account_slug;
    const objective = args.objective;
    if (typeof accountSlug !== "string" || accountSlug.length > 80 || !slugPattern.test(accountSlug)) {
      throw new RunGatewayError("account_slug must be a valid lowercase slug", 400);
    }
    if (typeof objective !== "string" || objective.trim().length < 16 || objective.length > 500) {
      throw new RunGatewayError("objective must contain 16 to 500 characters", 400);
    }
    const idempotencyKey = args.idempotency_key;
    if (typeof idempotencyKey !== "string" || idempotencyKey.length < 8 || idempotencyKey.length > 200 || !idempotencyPattern.test(idempotencyKey)) {
      throw new RunGatewayError("idempotency_key is invalid", 400);
    }
    const rpc = await rest("rpc/create_agent_run", {
      method: "POST",
      body: JSON.stringify({
        p_account_slug: accountSlug,
        p_objective: objective.trim(),
        p_idempotency_key: idempotencyKey,
      }),
    });
    object(rpc);
    object(rpc.run);
    const runId = uuid(rpc.run.id, "run.id");
    const run = await projection(runId);
    scheduleHostedWorker(run);
    return { run, idempotent_replay: rpc.created !== true };
  }

  if (action === "get_run") {
    strictKeys(args, ["run_id"]);
    const run = await projection(uuid(args.run_id, "run_id"));
    scheduleHostedWorker(run);
    return { run };
  }

  if (action === "retry_run") {
    strictKeys(args, ["run_id"]);
    const runId = uuid(args.run_id, "run_id");
    const current = await projection(runId);
    if (current.status !== "failed" || typeof current.current_stage !== "string") {
      throw new RunGatewayError("Only a failed stage can be retried", 409);
    }
    const params = new URLSearchParams({
      id: `eq.${runId}`,
      status: "eq.failed",
      select: "id",
    });
    const retried = await rest(`agent_runs?${params.toString()}`, {
      method: "PATCH",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({
        status: "queued",
        current_stage: null,
        worker_lease_token: null,
        worker_lease_expires_at: null,
        stopped_at: null,
        updated_at: new Date().toISOString(),
      }),
    });
    if (!Array.isArray(retried) || retried.length !== 1) {
      throw new RunGatewayError("Failed stage is no longer retryable", 409);
    }
    const run = await projection(runId);
    scheduleHostedWorker(run);
    return { run };
  }

  throw new RunGatewayError("Action is not allow-listed", 404);
}

Deno.serve(async (request: Request) => {
  try {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
    if (request.method !== "POST") throw new RunGatewayError("Method not allowed", 405);
    requireCaller(request);
    if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
      throw new RunGatewayError("Content-Type must be application/json", 415);
    }
    const body: unknown = await request.json();
    object(body);
    strictKeys(body, ["action", "arguments"]);
    if (typeof body.action !== "string" || !actions.has(body.action)) {
      throw new RunGatewayError("Action is not allow-listed", 404);
    }
    const args = body.arguments ?? {};
    object(args);
    return json(await invoke(body.action, args));
  } catch (error) {
    const status = error instanceof RunGatewayError ? error.status : 500;
    if (!(error instanceof RunGatewayError)) console.error(error);
    return json({
      error: error instanceof RunGatewayError ? error.message : "Run gateway failed",
      retrieved_at: new Date().toISOString(),
    }, status);
  }
});
