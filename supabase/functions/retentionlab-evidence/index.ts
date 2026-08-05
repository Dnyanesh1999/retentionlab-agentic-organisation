import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type JsonRecord = Record<string, unknown>;

type ReadyRun = {
  id: string;
  generated_at: string;
};

type Account = {
  id: string;
  generation_run_id: string;
  slug: string;
  display_name: string;
  source_updated_at: string;
};

class GatewayError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const allowedTools = new Set([
  "get_account_snapshot",
  "list_product_signals",
  "list_billing_events",
  "list_support_events",
  "get_preference_profile",
  "list_vendor_status",
  "get_evidence_item",
]);

const accountSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const evidenceKeyPattern = /^[a-z]+:[a-z0-9-]+:[a-z0-9_-]+(?::[a-z0-9-]+)?$/;

const browserCorsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
} as const;

function responseJson(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      ...browserCorsHeaders,
      "cache-control": "no-store, max-age=0",
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
  });
}

function requiredEnvironment(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new GatewayError(`Missing server configuration: ${name}`, 500);
  return value;
}

function namedKey(name: "SUPABASE_PUBLISHABLE_KEYS" | "SUPABASE_SECRET_KEYS") {
  const parsed = JSON.parse(requiredEnvironment(name)) as Record<string, unknown>;
  const value = parsed.default;
  if (typeof value !== "string" || value.length < 12) {
    throw new GatewayError(`Missing default key in ${name}`, 500);
  }
  return value;
}

function requireAllowedCaller(request: Request) {
  const suppliedKey = request.headers.get("apikey");
  if (!suppliedKey || suppliedKey !== namedKey("SUPABASE_PUBLISHABLE_KEYS")) {
    throw new GatewayError("Unauthorized evidence gateway caller", 401);
  }
}

function assertObject(value: unknown): asserts value is JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new GatewayError("Request body must be a JSON object", 400);
  }
}

function strictKeys(value: JsonRecord, allowed: string[]) {
  const unexpected = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unexpected.length > 0) {
    throw new GatewayError(`Unexpected argument: ${unexpected[0]}`, 400);
  }
}

function accountSlug(args: JsonRecord) {
  strictKeys(args, ["account_slug", "limit"]);
  const value = args.account_slug;
  if (typeof value !== "string" || !accountSlugPattern.test(value) || value.length > 80) {
    throw new GatewayError("account_slug must be a valid lowercase slug", 400);
  }
  return value;
}

function requestedLimit(args: JsonRecord, fallback = 20) {
  const value = args.limit ?? fallback;
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 50) {
    throw new GatewayError("limit must be an integer between 1 and 50", 400);
  }
  return Number(value);
}

function evidenceKey(args: JsonRecord) {
  strictKeys(args, ["evidence_key"]);
  const value = args.evidence_key;
  if (typeof value !== "string" || !evidenceKeyPattern.test(value) || value.length > 160) {
    throw new GatewayError("evidence_key is invalid", 400);
  }
  return value;
}

async function restRows<T extends JsonRecord>(table: string, params: URLSearchParams): Promise<T[]> {
  const supabaseUrl = requiredEnvironment("SUPABASE_URL");
  const secretKey = namedKey("SUPABASE_SECRET_KEYS");
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${params.toString()}`, {
    headers: {
      accept: "application/json",
      apikey: secretKey,
    },
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    console.error(`PostgREST query failed for ${table}: ${response.status}`);
    throw new GatewayError("Live evidence source query failed", 502);
  }

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new GatewayError("Live evidence source returned an invalid shape", 502);
  return payload as T[];
}

async function latestReadyRun(): Promise<ReadyRun> {
  const params = new URLSearchParams({
    select: "id,generated_at",
    generator_key: "eq.retentionlab-demo-v1",
    status: "eq.ready",
    order: "generated_at.desc",
    limit: "1",
  });
  const rows = await restRows<ReadyRun & JsonRecord>("demo_generation_runs", params);
  if (!rows[0]) throw new GatewayError("No ready live dataset is available", 503);
  return rows[0];
}

async function findAccount(run: ReadyRun, slug: string): Promise<Account> {
  const params = new URLSearchParams({
    select:
      "id,generation_run_id,slug,display_name,sector,plan_tier,lifecycle_stage,seats_purchased,monthly_recurring_revenue,contract_currency,renewal_at,region,synthetic,source_updated_at",
    generation_run_id: `eq.${run.id}`,
    slug: `eq.${slug}`,
    limit: "1",
  });
  const rows = await restRows<Account & JsonRecord>("accounts", params);
  if (!rows[0]) throw new GatewayError("Fictional account was not found in the ready dataset", 404);
  return rows[0];
}

function sourceEnvelope(tool: string, run: ReadyRun, retrievedAt: string) {
  return {
    tool,
    source: {
      system: "Supabase Postgres",
      dataset: "retentionlab-demo-v1",
      generation_run_id: run.id,
      generated_at: run.generated_at,
      retrieved_at: retrievedAt,
      cache_mode: "no-store",
    },
  };
}

async function accountRows(
  table: string,
  accountId: string,
  select: string,
  order: string,
  limit: number,
) {
  return await restRows(table, new URLSearchParams({
    select,
    account_id: `eq.${accountId}`,
    order,
    limit: String(limit),
  }));
}

async function invokeTool(tool: string, args: JsonRecord) {
  const retrievedAt = new Date().toISOString();
  const run = await latestReadyRun();

  if (tool === "list_vendor_status") {
    strictKeys(args, ["limit"]);
    const rows = await restRows("vendor_status_events", new URLSearchParams({
      select:
        "evidence_key,vendor_key,service_name,status,incident_key,summary,started_at,resolved_at,source_updated_at,source_system",
      generation_run_id: `eq.${run.id}`,
      order: "started_at.desc",
      limit: String(requestedLimit(args)),
    }));
    return { ...sourceEnvelope(tool, run, retrievedAt), data: rows };
  }

  if (tool === "get_evidence_item") {
    const key = evidenceKey(args);
    const evidenceTables = [
      ["product_signals", "evidence_key,signal_type,metric_value,unit,comparison_value,comparison_window,observed_at,source_updated_at,source_system,metadata"],
      ["billing_events", "evidence_key,event_type,status,amount,currency,occurred_at,source_updated_at,source_system"],
      ["support_events", "evidence_key,category,severity,status,sentiment_score,summary,occurred_at,resolved_at,source_updated_at,source_system"],
      ["consent_preferences", "evidence_key,allow_product_email,allow_recovery_outreach,allow_usage_personalisation,preferred_channel,lawful_basis,source_updated_at,source_system"],
      ["vendor_status_events", "evidence_key,vendor_key,service_name,status,incident_key,summary,started_at,resolved_at,source_updated_at,source_system"],
    ] as const;
    const matches = await Promise.all(evidenceTables.map(async ([table, select]) => {
      const rows = await restRows(table, new URLSearchParams({
        select,
        evidence_key: `eq.${key}`,
        limit: "1",
      }));
      return rows[0] ? { source_table: table, record: rows[0] } : null;
    }));
    const match = matches.find(Boolean);
    if (!match) throw new GatewayError("Evidence item was not found in the live source", 404);
    return { ...sourceEnvelope(tool, run, retrievedAt), data: match };
  }

  const slug = accountSlug(args);
  const account = await findAccount(run, slug);

  if (tool === "get_account_snapshot") {
    strictKeys(args, ["account_slug"]);
    const [product, billing, support, preferences] = await Promise.all([
      accountRows(
        "product_signals",
        account.id,
        "evidence_key,signal_type,metric_value,unit,comparison_value,comparison_window,observed_at,source_updated_at,source_system",
        "observed_at.desc",
        12,
      ),
      accountRows(
        "billing_events",
        account.id,
        "evidence_key,event_type,status,amount,currency,occurred_at,source_updated_at,source_system",
        "occurred_at.desc",
        6,
      ),
      accountRows(
        "support_events",
        account.id,
        "evidence_key,category,severity,status,sentiment_score,summary,occurred_at,resolved_at,source_updated_at,source_system",
        "occurred_at.desc",
        6,
      ),
      accountRows(
        "consent_preferences",
        account.id,
        "evidence_key,allow_product_email,allow_recovery_outreach,allow_usage_personalisation,preferred_channel,lawful_basis,source_updated_at,source_system",
        "source_updated_at.desc",
        1,
      ),
    ]);
    return {
      ...sourceEnvelope(tool, run, retrievedAt),
      data: { account, product_signals: product, billing_events: billing, support_events: support, preference_profile: preferences[0] ?? null },
    };
  }

  const limit = requestedLimit(args);
  if (tool === "list_product_signals") {
    const rows = await accountRows(
      "product_signals",
      account.id,
      "evidence_key,signal_type,metric_value,unit,comparison_value,comparison_window,observed_at,source_updated_at,source_system,metadata",
      "observed_at.desc",
      limit,
    );
    return { ...sourceEnvelope(tool, run, retrievedAt), account: { slug, display_name: account.display_name }, data: rows };
  }

  if (tool === "list_billing_events") {
    const rows = await accountRows(
      "billing_events",
      account.id,
      "evidence_key,event_type,status,amount,currency,occurred_at,source_updated_at,source_system",
      "occurred_at.desc",
      limit,
    );
    return { ...sourceEnvelope(tool, run, retrievedAt), account: { slug, display_name: account.display_name }, data: rows };
  }

  if (tool === "list_support_events") {
    const rows = await accountRows(
      "support_events",
      account.id,
      "evidence_key,category,severity,status,sentiment_score,summary,occurred_at,resolved_at,source_updated_at,source_system",
      "occurred_at.desc",
      limit,
    );
    return { ...sourceEnvelope(tool, run, retrievedAt), account: { slug, display_name: account.display_name }, data: rows };
  }

  if (tool === "get_preference_profile") {
    strictKeys(args, ["account_slug"]);
    const rows = await accountRows(
      "consent_preferences",
      account.id,
      "evidence_key,allow_product_email,allow_recovery_outreach,allow_usage_personalisation,preferred_channel,lawful_basis,source_updated_at,source_system",
      "source_updated_at.desc",
      1,
    );
    if (!rows[0]) throw new GatewayError("Preference profile was not found in the live source", 404);
    return { ...sourceEnvelope(tool, run, retrievedAt), account: { slug, display_name: account.display_name }, data: rows[0] };
  }

  throw new GatewayError("Tool is not allow-listed", 404);
}

Deno.serve(async (request: Request) => {
  try {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          ...browserCorsHeaders,
          "cache-control": "no-store, max-age=0",
        },
      });
    }
    if (request.method !== "POST") throw new GatewayError("Method not allowed", 405);
    requireAllowedCaller(request);
    if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
      throw new GatewayError("Content-Type must be application/json", 415);
    }

    const body: unknown = await request.json();
    assertObject(body);
    strictKeys(body, ["tool", "arguments"]);
    const tool = body.tool;
    if (typeof tool !== "string" || !allowedTools.has(tool)) {
      throw new GatewayError("Tool is not allow-listed", 404);
    }
    const args = body.arguments ?? {};
    assertObject(args);
    return responseJson(await invokeTool(tool, args));
  } catch (error) {
    const status = error instanceof GatewayError ? error.status : 500;
    const message = error instanceof GatewayError ? error.message : "Evidence gateway failed";
    if (!(error instanceof GatewayError)) console.error(error);
    return responseJson({ error: message, retrieved_at: new Date().toISOString() }, status);
  }
});
