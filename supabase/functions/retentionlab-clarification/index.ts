type JsonRecord = Record<string, unknown>;
type EnvironmentReader = (name: string) => string | undefined;

type HandlerDependencies = {
  environment?: EnvironmentReader;
  fetchImplementation?: typeof fetch;
  now?: () => Date;
};

type RpcResult = {
  submission_id: string | null;
  accepted_at: string | null;
  replayed: boolean;
  result_code:
    | "accepted"
    | "forbidden"
    | "conflict"
    | "invalid_evidence"
    | "invalid_request";
};

class ClarificationGatewayError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const edgeFunctionVersion = "retentionlab-clarification.v1";
const accountSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const capabilityPattern = /^[A-Za-z0-9._~-]{32,2048}$/;
const supportKeyPattern = /^support:([a-z0-9]+(?:-[a-z0-9]+)*):[a-z0-9-]+$/;
const preferenceKeyPattern =
  /^preference:([a-z0-9]+(?:-[a-z0-9]+)*):[a-z0-9-]+$/;
const hexDigestPattern = /^[0-9a-f]{64}$/;
const allowedBodyKeys = new Set([
  "schema_version",
  "account_slug",
  "support_evidence_key",
  "preference_evidence_key",
  "observation",
  "consent",
]);

function requiredEnvironment(environment: EnvironmentReader, name: string) {
  const value = environment(name);
  if (!value) {
    throw new ClarificationGatewayError(
      `Missing server configuration: ${name}`,
      500,
    );
  }
  return value;
}

function namedKey(
  environment: EnvironmentReader,
  name: "SUPABASE_PUBLISHABLE_KEYS" | "SUPABASE_SECRET_KEYS",
) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(requiredEnvironment(environment, name));
  } catch {
    throw new ClarificationGatewayError(
      `Invalid server configuration: ${name}`,
      500,
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ClarificationGatewayError(
      `Invalid server configuration: ${name}`,
      500,
    );
  }
  const value = (parsed as JsonRecord).default;
  if (typeof value !== "string" || value.length < 12) {
    throw new ClarificationGatewayError(`Missing default key in ${name}`, 500);
  }
  return value;
}

function strictObject(
  value: unknown,
  label: string,
): asserts value is JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ClarificationGatewayError(`${label} must be a JSON object`, 400);
  }
}

function strictKeys(value: JsonRecord, allowed: Set<string>, label: string) {
  const unexpected = Object.keys(value).find((key) => !allowed.has(key));
  if (unexpected) {
    throw new ClarificationGatewayError(
      `Unexpected ${label} field: ${unexpected}`,
      400,
    );
  }
}

function allowedOrigins(environment: EnvironmentReader) {
  const configured = environment("CLARIFICATION_ALLOWED_ORIGINS") ??
    "http://127.0.0.1:5173,http://localhost:5173";
  return new Set(
    configured.split(",").map((origin) => origin.trim()).filter(Boolean),
  );
}

function corsHeaders(request: Request, environment: EnvironmentReader) {
  const origin = request.headers.get("origin");
  const allowedOrigin = origin && allowedOrigins(environment).has(origin)
    ? origin
    : null;
  return {
    ...(allowedOrigin ? { "access-control-allow-origin": allowedOrigin } : {}),
    "access-control-allow-headers":
      "apikey, content-type, idempotency-key, x-recovery-token",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-max-age": "600",
    "cache-control": "no-store, max-age=0",
    vary: "Origin",
  };
}

function jsonResponse(
  request: Request,
  environment: EnvironmentReader,
  body: unknown,
  status = 200,
) {
  return Response.json(body, {
    status,
    headers: {
      ...corsHeaders(request, environment),
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
  });
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

function parseSubmission(value: unknown) {
  strictObject(value, "Request body");
  strictKeys(value, allowedBodyKeys, "request");

  if (value.schema_version !== "clarification-submission.v1") {
    throw new ClarificationGatewayError(
      "Unsupported clarification schema version",
      400,
    );
  }
  if (
    typeof value.account_slug !== "string" ||
    value.account_slug.length > 80 ||
    !accountSlugPattern.test(value.account_slug)
  ) {
    throw new ClarificationGatewayError("account_slug is invalid", 400);
  }
  if (
    typeof value.support_evidence_key !== "string" ||
    supportKeyPattern.exec(value.support_evidence_key)?.[1] !==
      value.account_slug
  ) {
    throw new ClarificationGatewayError(
      "support_evidence_key is outside the account domain",
      400,
    );
  }
  if (
    typeof value.preference_evidence_key !== "string" ||
    preferenceKeyPattern.exec(value.preference_evidence_key)?.[1] !==
      value.account_slug
  ) {
    throw new ClarificationGatewayError(
      "preference_evidence_key is outside the account domain",
      400,
    );
  }

  const observation = value.observation;
  if (observation !== null && typeof observation !== "string") {
    throw new ClarificationGatewayError(
      "observation must be a string or null",
      400,
    );
  }
  const normalizedObservation = typeof observation === "string"
    ? observation.trim()
    : null;
  if ((normalizedObservation?.length ?? 0) > 500) {
    throw new ClarificationGatewayError(
      "observation exceeds 500 characters",
      422,
    );
  }

  strictObject(value.consent, "consent");
  strictKeys(value.consent, new Set(["action", "copy_version"]), "consent");
  if (
    value.consent.action !== "share_observation" ||
    value.consent.copy_version !== "clarification-consent.v1"
  ) {
    throw new ClarificationGatewayError(
      "Explicit clarification consent is invalid",
      400,
    );
  }

  return {
    schema_version: "clarification-submission.v1" as const,
    account_slug: value.account_slug,
    support_evidence_key: value.support_evidence_key,
    preference_evidence_key: value.preference_evidence_key,
    observation: normalizedObservation || null,
    consent: {
      action: "share_observation" as const,
      copy_version: "clarification-consent.v1" as const,
    },
  };
}

function parseRpcResult(value: unknown): RpcResult {
  if (!Array.isArray(value) || value.length !== 1) {
    throw new ClarificationGatewayError(
      "Clarification store returned an invalid contract",
      502,
    );
  }
  const row = value[0];
  strictObject(row, "Clarification store result");
  strictKeys(
    row,
    new Set(["submission_id", "accepted_at", "replayed", "result_code"]),
    "clarification store result",
  );
  const resultCodes = new Set([
    "accepted",
    "forbidden",
    "conflict",
    "invalid_evidence",
    "invalid_request",
  ]);
  if (
    (row.submission_id !== null &&
      (typeof row.submission_id !== "string" ||
        !uuidPattern.test(row.submission_id))) ||
    (row.accepted_at !== null &&
      (typeof row.accepted_at !== "string" ||
        !Number.isFinite(Date.parse(row.accepted_at)))) ||
    typeof row.replayed !== "boolean" ||
    typeof row.result_code !== "string" ||
    !resultCodes.has(row.result_code)
  ) {
    throw new ClarificationGatewayError(
      "Clarification store returned an invalid contract",
      502,
    );
  }
  return row as RpcResult;
}

function resultError(resultCode: RpcResult["result_code"]) {
  if (resultCode === "forbidden") {
    return new ClarificationGatewayError(
      "Recovery capability is invalid or expired",
      403,
    );
  }
  if (resultCode === "conflict") {
    return new ClarificationGatewayError(
      "Recovery capability has already been used",
      409,
    );
  }
  if (resultCode === "invalid_evidence") {
    return new ClarificationGatewayError(
      "Clarification evidence is no longer valid",
      403,
    );
  }
  if (resultCode === "invalid_request") {
    return new ClarificationGatewayError(
      "Clarification request is invalid",
      400,
    );
  }
  return null;
}

export function createClarificationHandler(
  dependencies: HandlerDependencies = {},
) {
  const environment = dependencies.environment ??
    ((name: string) => Deno.env.get(name));
  const fetchImplementation = dependencies.fetchImplementation ?? fetch;
  const now = dependencies.now ?? (() => new Date());

  return async (request: Request): Promise<Response> => {
    try {
      const origin = request.headers.get("origin");
      if (origin && !allowedOrigins(environment).has(origin)) {
        throw new ClarificationGatewayError("Origin is not allowed", 403);
      }

      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: corsHeaders(request, environment),
        });
      }
      if (request.method !== "POST") {
        throw new ClarificationGatewayError("Method not allowed", 405);
      }
      if (
        !request.headers.get("content-type")?.toLowerCase().includes(
          "application/json",
        )
      ) {
        throw new ClarificationGatewayError(
          "Content-Type must be application/json",
          415,
        );
      }

      const suppliedKey = request.headers.get("apikey");
      if (
        !suppliedKey ||
        suppliedKey !== namedKey(environment, "SUPABASE_PUBLISHABLE_KEYS")
      ) {
        throw new ClarificationGatewayError(
          "Unauthorized clarification caller",
          401,
        );
      }
      const capability = request.headers.get("x-recovery-token");
      if (!capability || !capabilityPattern.test(capability)) {
        throw new ClarificationGatewayError(
          "Recovery capability is invalid or expired",
          403,
        );
      }
      const requestId = request.headers.get("idempotency-key");
      if (!requestId || !uuidPattern.test(requestId)) {
        throw new ClarificationGatewayError(
          "Idempotency-Key must be a UUID",
          400,
        );
      }

      const rawBody = await request.text();
      if (new TextEncoder().encode(rawBody).byteLength > 4096) {
        throw new ClarificationGatewayError(
          "Clarification request is too large",
          413,
        );
      }
      let body: unknown;
      try {
        body = JSON.parse(rawBody);
      } catch {
        throw new ClarificationGatewayError(
          "Request body must contain valid JSON",
          400,
        );
      }
      const submission = parseSubmission(body);
      const tokenHash = await sha256(capability);
      const payloadHash = await sha256(JSON.stringify(submission));
      if (
        !hexDigestPattern.test(tokenHash) || !hexDigestPattern.test(payloadHash)
      ) {
        throw new ClarificationGatewayError("Clarification digest failed", 500);
      }

      const supabaseUrl = requiredEnvironment(environment, "SUPABASE_URL")
        .replace(/\/$/, "");
      const secretKey = namedKey(environment, "SUPABASE_SECRET_KEYS");
      const rpcResponse = await fetchImplementation.call(
        globalThis,
        `${supabaseUrl}/rest/v1/rpc/submit_recovery_clarification`,
        {
          method: "POST",
          headers: {
            accept: "application/json",
            apikey: secretKey,
            authorization: `Bearer ${secretKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            p_token_hash: tokenHash,
            p_request_id: requestId,
            p_account_slug: submission.account_slug,
            p_support_evidence_key: submission.support_evidence_key,
            p_preference_evidence_key: submission.preference_evidence_key,
            p_observation: submission.observation,
            p_payload_sha256: payloadHash,
            p_edge_function_version: edgeFunctionVersion,
          }),
          cache: "no-store",
          signal: AbortSignal.timeout(8_000),
        },
      );
      if (!rpcResponse.ok) {
        throw new ClarificationGatewayError(
          "Clarification store is unavailable",
          503,
        );
      }

      const result = parseRpcResult(await rpcResponse.json().catch(() => null));
      const mappedError = resultError(result.result_code);
      if (mappedError) throw mappedError;
      if (!result.submission_id || !result.accepted_at) {
        throw new ClarificationGatewayError(
          "Clarification store returned an incomplete receipt",
          502,
        );
      }

      return jsonResponse(request, environment, {
        schema_version: "clarification-receipt.v1",
        submission_id: result.submission_id,
        accepted_at: result.accepted_at,
        replayed: result.replayed,
      });
    } catch (error) {
      const status = error instanceof ClarificationGatewayError
        ? error.status
        : 500;
      const message = error instanceof ClarificationGatewayError
        ? error.message
        : "Clarification gateway failed";
      if (!(error instanceof ClarificationGatewayError)) {
        console.error("Clarification gateway failed without request payload", {
          error: error instanceof Error ? error.name : "unknown",
          at: now().toISOString(),
        });
      }
      return jsonResponse(request, environment, { error: message }, status);
    }
  };
}

if (import.meta.main) {
  Deno.serve(createClarificationHandler());
}
