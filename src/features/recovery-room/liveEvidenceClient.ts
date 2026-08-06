import { z } from "zod";

import {
  decodeSignalGardenSnapshot,
  type SignalGardenEvidenceClient,
  type SignalGardenSnapshot,
} from "./contracts";

const accountSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const sourceSchema = z.object({
  system: z.literal("Supabase Postgres"),
  dataset: z.literal("retentionlab-demo-v1"),
  generation_run_id: z.string().uuid(),
  generated_at: z.iso.datetime({ offset: true }),
  retrieved_at: z.iso.datetime({ offset: true }),
  cache_mode: z.literal("no-store"),
}).strict();

const productSignalSchema = z.object({
  evidence_key: z.string().min(1),
  signal_type: z.string().min(1),
  metric_value: z.number().finite(),
  unit: z.string().min(1),
  comparison_value: z.number().finite().nullable(),
  comparison_window: z.string().nullable(),
  observed_at: z.iso.datetime({ offset: true }),
  source_updated_at: z.iso.datetime({ offset: true }),
  source_system: z.string().min(1),
}).strict();

const supportEventSchema = z.object({
  evidence_key: z.string().min(1),
  category: z.string().min(1),
  severity: z.string().min(1),
  status: z.string().min(1),
  sentiment_score: z.number().finite(),
  summary: z.string().min(1),
  occurred_at: z.iso.datetime({ offset: true }),
  resolved_at: z.iso.datetime({ offset: true }).nullable(),
  source_updated_at: z.iso.datetime({ offset: true }),
  source_system: z.string().min(1),
}).strict();

const preferenceProfileSchema = z.object({
  evidence_key: z.string().min(1),
  allow_product_email: z.boolean(),
  allow_recovery_outreach: z.boolean(),
  allow_usage_personalisation: z.boolean(),
  preferred_channel: z.string().min(1),
  lawful_basis: z.string().min(1),
  source_updated_at: z.iso.datetime({ offset: true }),
  source_system: z.string().min(1),
}).strict();

const accountSnapshotEnvelopeSchema = z.object({
  tool: z.literal("get_account_snapshot"),
  source: sourceSchema,
  data: z.object({
    account: z.object({
      slug: z.string().min(1),
    }).passthrough(),
    product_signals: z.array(productSignalSchema),
    billing_events: z.array(z.unknown()),
    support_events: z.array(supportEventSchema),
    preference_profile: preferenceProfileSchema.nullable(),
  }).strict(),
}).strict();

const gatewayErrorSchema = z.object({
  error: z.string().min(1),
}).passthrough();

type ProductSignal = z.infer<typeof productSignalSchema>;
type SupportEvent = z.infer<typeof supportEventSchema>;

export type SignalGardenClientErrorCode =
  | "invalid_request"
  | "aborted"
  | "timeout"
  | "network"
  | "unauthorized"
  | "not_found"
  | "rate_limited"
  | "unavailable"
  | "invalid_contract"
  | "incomplete_evidence"
  | "stale_evidence";

export class SignalGardenClientError extends Error {
  constructor(
    readonly code: SignalGardenClientErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "SignalGardenClientError";
  }
}

export type LiveSignalGardenClientConfiguration = {
  gatewayUrl: string;
  publishableKey: string;
  timeoutMs?: number;
  maxSnapshotAgeMs?: number;
};

function classifyHttpError(status: number): SignalGardenClientErrorCode {
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "unavailable";
  return "invalid_request";
}

function newestSignal(rows: ProductSignal[], signalType: string) {
  return [...rows]
    .filter((row) => row.signal_type === signalType)
    .sort((left, right) => Date.parse(right.observed_at) - Date.parse(left.observed_at))[0];
}

/** The single newest still-open support case in the workflow domain, if any. */
function newestOpenWorkflowSupportCase(rows: SupportEvent[]) {
  return [...rows]
    .filter((row) => row.category === "workflow" && row.status === "open")
    .sort((left, right) => Date.parse(right.occurred_at) - Date.parse(left.occurred_at))[0];
}

function evidenceReference(
  row: { evidence_key: string; source_system: string },
  retrievedAt: string,
) {
  return {
    evidence_key: row.evidence_key,
    source_system: row.source_system,
    source_tool: "get_account_snapshot",
    retrieved_at: retrievedAt,
  };
}

function canonicalTimestamp(value: string) {
  return new Date(value).toISOString();
}

function normalizeSnapshot(
  value: unknown,
  requestedSlug: string,
  now: number,
  maxSnapshotAgeMs: number,
): SignalGardenSnapshot {
  const parsed = accountSnapshotEnvelopeSchema.safeParse(value);
  if (!parsed.success) {
    const firstIssuePath = parsed.error.issues[0]?.path.join(".") || "root";
    throw new SignalGardenClientError(
      "invalid_contract",
      `Live evidence source returned an invalid account snapshot contract at ${firstIssuePath}.`,
      502,
    );
  }

  const envelope = parsed.data;
  const retrievedAt = Date.parse(envelope.source.retrieved_at);
  if (retrievedAt > now + 30_000 || now - retrievedAt > maxSnapshotAgeMs) {
    throw new SignalGardenClientError(
      "stale_evidence",
      "Live evidence response is outside the accepted freshness window.",
      502,
    );
  }
  if (envelope.data.account.slug !== requestedSlug) {
    throw new SignalGardenClientError(
      "invalid_contract",
      "Live evidence source returned a snapshot for a different account.",
      502,
    );
  }

  const featureAdoption = newestSignal(envelope.data.product_signals, "feature_adoption");
  const activeUsers = newestSignal(envelope.data.product_signals, "active_users");
  const sessionFrequency = newestSignal(envelope.data.product_signals, "session_frequency");
  const seatUtilisation = newestSignal(envelope.data.product_signals, "seat_utilisation");
  const comparableSignals = [featureAdoption, activeUsers, sessionFrequency];

  if (
    comparableSignals.some((signal) => !signal || signal.comparison_value === null)
    || !seatUtilisation
  ) {
    throw new SignalGardenClientError(
      "incomplete_evidence",
      "Live evidence is missing one or more required Signal Garden readings.",
      422,
    );
  }

  if (
    featureAdoption!.unit !== "percent"
    || activeUsers!.unit !== "count"
    || sessionFrequency!.unit !== "sessions_per_user"
    || seatUtilisation.unit !== "percent"
  ) {
    throw new SignalGardenClientError(
      "invalid_contract",
      "Live evidence source returned an unsupported signal unit.",
      502,
    );
  }

  const supportCase = newestOpenWorkflowSupportCase(envelope.data.support_events);
  const preferenceProfile = envelope.data.preference_profile;

  if (!supportCase || !preferenceProfile) {
    throw new SignalGardenClientError(
      "incomplete_evidence",
      "Live evidence is missing the open workflow support case or preference profile.",
      422,
    );
  }

  const candidate = {
    schema_version: "signal-garden-snapshot.v1",
    account_slug: requestedSlug,
    retrieved_at: envelope.source.retrieved_at,
    signals: [
      {
        code: "feature_adoption",
        current_value: featureAdoption!.metric_value,
        previous_value: featureAdoption!.comparison_value,
        unit: "percent",
        evidence: evidenceReference(featureAdoption!, envelope.source.retrieved_at),
      },
      {
        code: "active_users",
        current_value: activeUsers!.metric_value,
        previous_value: activeUsers!.comparison_value,
        unit: "count",
        evidence: evidenceReference(activeUsers!, envelope.source.retrieved_at),
      },
      {
        code: "session_frequency",
        current_value: sessionFrequency!.metric_value,
        previous_value: sessionFrequency!.comparison_value,
        unit: "frequency",
        evidence: evidenceReference(sessionFrequency!, envelope.source.retrieved_at),
      },
    ],
    seat_utilisation: {
      current_value: seatUtilisation.metric_value,
      unit: "percent",
      evidence: evidenceReference(seatUtilisation, envelope.source.retrieved_at),
    },
    support_case: {
      reference: supportCase.evidence_key,
      category: supportCase.category,
      severity: supportCase.severity,
      status: supportCase.status,
      sentiment_score: supportCase.sentiment_score,
      unresolved_at: canonicalTimestamp(supportCase.occurred_at),
      evidence: evidenceReference(supportCase, envelope.source.retrieved_at),
    },
    clarification_permission: {
      allow_recovery_outreach: preferenceProfile.allow_recovery_outreach,
      evidence: evidenceReference(preferenceProfile, envelope.source.retrieved_at),
    },
  };

  try {
    // Final strict decode. Any residual domain, evidence-binding or range
    // violation fails closed as a typed contract error rather than a raw throw.
    return decodeSignalGardenSnapshot(candidate);
  } catch {
    throw new SignalGardenClientError(
      "invalid_contract",
      "Live evidence source returned a Signal Garden snapshot that violates the strict contract.",
      502,
    );
  }
}

export class LiveSignalGardenEvidenceClient implements SignalGardenEvidenceClient {
  private readonly timeoutMs: number;
  private readonly maxSnapshotAgeMs: number;

  constructor(
    private readonly configuration: LiveSignalGardenClientConfiguration,
    private readonly fetchImplementation: typeof fetch = fetch,
  ) {
    this.timeoutMs = configuration.timeoutMs ?? 10_000;
    this.maxSnapshotAgeMs = configuration.maxSnapshotAgeMs ?? 5 * 60_000;
  }

  async getSnapshot(accountSlug: string, signal?: AbortSignal): Promise<SignalGardenSnapshot> {
    if (!accountSlugPattern.test(accountSlug) || accountSlug.length > 80) {
      throw new SignalGardenClientError("invalid_request", "Account slug is invalid.", 400);
    }
    if (!this.configuration.gatewayUrl.startsWith("https://")) {
      throw new SignalGardenClientError("invalid_request", "Evidence gateway must use HTTPS.", 500);
    }
    if (this.configuration.publishableKey.length < 20) {
      throw new SignalGardenClientError("invalid_request", "Evidence gateway configuration is incomplete.", 500);
    }

    const timeoutController = new AbortController();
    const timeoutId = globalThis.setTimeout(() => timeoutController.abort(), this.timeoutMs);
    const requestSignal = signal
      ? AbortSignal.any([signal, timeoutController.signal])
      : timeoutController.signal;

    let response: Response;
    try {
      response = await this.fetchImplementation.call(globalThis, this.configuration.gatewayUrl, {
        method: "POST",
        headers: {
          accept: "application/json",
          apikey: this.configuration.publishableKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          tool: "get_account_snapshot",
          arguments: { account_slug: accountSlug },
        }),
        cache: "no-store",
        signal: requestSignal,
      });
    } catch (error) {
      if (signal?.aborted) {
        throw new SignalGardenClientError("aborted", "Signal Garden evidence request was cancelled.");
      }
      if (timeoutController.signal.aborted) {
        throw new SignalGardenClientError("timeout", "Signal Garden evidence request timed out.", 504);
      }
      throw new SignalGardenClientError(
        "network",
        `Signal Garden evidence source is unreachable: ${error instanceof Error ? error.message : "network failure"}`,
        503,
      );
    } finally {
      globalThis.clearTimeout(timeoutId);
    }

    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const gatewayError = gatewayErrorSchema.safeParse(body);
      throw new SignalGardenClientError(
        classifyHttpError(response.status),
        gatewayError.success
          ? gatewayError.data.error
          : `Live evidence query failed with status ${response.status}.`,
        response.status,
      );
    }

    return normalizeSnapshot(body, accountSlug, Date.now(), this.maxSnapshotAgeMs);
  }
}
