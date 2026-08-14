import { z } from "zod";

import {
  hostedRunCreateInputSchema,
  hostedRunCreateResponseSchema,
  hostedRunReadResponseSchema,
  type HostedRun,
  type HostedRunCreateInput,
} from "../../../runtime/hosted/contracts";
import { SignalGardenClientError } from "../recovery-room/liveEvidenceClient";

const sourceSchema = z.object({
  system: z.literal("Supabase Postgres"),
  dataset: z.literal("retentionlab-demo-v1"),
  generation_run_id: z.string().uuid(),
  generated_at: z.iso.datetime({ offset: true }),
  retrieved_at: z.iso.datetime({ offset: true }),
  cache_mode: z.literal("no-store"),
}).strict();

const accountSchema = z.object({
  slug: z.string().min(1),
  display_name: z.string().min(1),
  sector: z.string().min(1),
  plan_tier: z.string().min(1),
  lifecycle_stage: z.string().min(1),
  monthly_recurring_revenue: z.number().finite().nonnegative(),
  contract_currency: z.string().length(3),
  renewal_at: z.iso.date(),
  region: z.string().min(1),
  source_updated_at: z.iso.datetime({ offset: true }),
}).strict();

const accountListEnvelopeSchema = z.object({
  tool: z.literal("list_accounts"),
  source: sourceSchema,
  data: z.array(accountSchema),
}).strict();

const snapshotProbeSchema = z.object({
  tool: z.literal("get_account_snapshot"),
  source: sourceSchema,
  data: z.object({
    account: z.object({ slug: z.string().min(1) }).passthrough(),
    product_signals: z.array(z.unknown()),
    billing_events: z.array(z.unknown()),
    support_events: z.array(z.unknown()),
    preference_profile: z.unknown().nullable(),
  }).strict(),
}).strict();

const gatewayErrorSchema = z.object({ error: z.string().min(1) }).passthrough();

export type ControlRoomAccount = z.infer<typeof accountSchema>;
export type ControlRoomSource = z.infer<typeof sourceSchema>;

export type AccountListResult = {
  accounts: ControlRoomAccount[];
  source: ControlRoomSource;
};

export type AccountProbeResult = {
  source: ControlRoomSource;
  evidenceCount: number;
  approvalBoundaryPresent: boolean;
};

export type ControlRoomClient = {
  listAccounts(signal?: AbortSignal): Promise<AccountListResult>;
  probeAccount(accountSlug: string, signal?: AbortSignal): Promise<AccountProbeResult>;
  createRun(input: HostedRunCreateInput, signal?: AbortSignal): Promise<{ run: HostedRun; idempotentReplay: boolean }>;
  readRun(runId: string, signal?: AbortSignal): Promise<HostedRun>;
  retryRun(runId: string, signal?: AbortSignal): Promise<HostedRun>;
};

type BrowserEnvironment = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  VITE_SUPABASE_EVIDENCE_FUNCTION?: string;
  VITE_SUPABASE_RUNS_FUNCTION?: string;
};

function clientError(message: string, status = 500) {
  return new SignalGardenClientError("invalid_contract", message, status);
}

export function createControlRoomClient(
  environment: BrowserEnvironment = import.meta.env,
  fetchImplementation: typeof fetch = fetch,
): ControlRoomClient {
  const baseUrl = environment.VITE_SUPABASE_URL?.replace(/\/$/, "");
  const publishableKey = environment.VITE_SUPABASE_PUBLISHABLE_KEY;
  const functionName = environment.VITE_SUPABASE_EVIDENCE_FUNCTION ?? "retentionlab-evidence";
  const runsFunctionName = environment.VITE_SUPABASE_RUNS_FUNCTION ?? "retentionlab-runs";

  if (!baseUrl?.startsWith("https://") || !publishableKey?.startsWith("sb_publishable_")) {
    throw new SignalGardenClientError(
      "invalid_request",
      "Live Control Room configuration is unavailable.",
      500,
    );
  }

  const gatewayUrl = `${baseUrl}/functions/v1/${functionName}`;
  const runsGatewayUrl = `${baseUrl}/functions/v1/${runsFunctionName}`;
  const callerKey = publishableKey;

  async function call(tool: "list_accounts" | "get_account_snapshot", args: Record<string, unknown>, signal?: AbortSignal) {
    let response: Response;
    try {
      response = await fetchImplementation.call(globalThis, gatewayUrl, {
        method: "POST",
        headers: {
          accept: "application/json",
          apikey: callerKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({ tool, arguments: args }),
        cache: "no-store",
        signal,
      });
    } catch (error) {
      if (signal?.aborted) throw new SignalGardenClientError("aborted", "Live request cancelled.");
      throw new SignalGardenClientError(
        "network",
        `Live source unreachable: ${error instanceof Error ? error.message : "network failure"}`,
        503,
      );
    }

    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const parsed = gatewayErrorSchema.safeParse(body);
      throw new SignalGardenClientError(
        response.status === 404 ? "not_found" : "unavailable",
        parsed.success ? parsed.data.error : `Live query failed (${response.status}).`,
        response.status,
      );
    }
    return body;
  }

  async function callRuns(action: "create_run" | "get_run" | "retry_run", args: Record<string, unknown>, signal?: AbortSignal) {
    let response: Response;
    try {
      response = await fetchImplementation.call(globalThis, runsGatewayUrl, {
        method: "POST",
        headers: {
          accept: "application/json",
          apikey: callerKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({ action, arguments: args }),
        cache: "no-store",
        signal,
      });
    } catch (error) {
      if (signal?.aborted) throw new SignalGardenClientError("aborted", "Run request cancelled.");
      throw new SignalGardenClientError(
        "network",
        `Run gateway unreachable: ${error instanceof Error ? error.message : "network failure"}`,
        503,
      );
    }
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const parsed = gatewayErrorSchema.safeParse(body);
      throw new SignalGardenClientError(
        response.status === 404 ? "not_found" : "unavailable",
        parsed.success ? parsed.data.error : `Run request failed (${response.status}).`,
        response.status,
      );
    }
    return body;
  }

  return {
    async listAccounts(signal) {
      const parsed = accountListEnvelopeSchema.safeParse(await call("list_accounts", { limit: 50 }, signal));
      if (!parsed.success) throw clientError("Live account directory returned an invalid contract.", 502);
      return { accounts: parsed.data.data, source: parsed.data.source };
    },

    async probeAccount(accountSlug, signal) {
      const parsed = snapshotProbeSchema.safeParse(
        await call("get_account_snapshot", { account_slug: accountSlug }, signal),
      );
      if (!parsed.success || parsed.data.data.account.slug !== accountSlug) {
        throw clientError("The evidence probe did not bind to the selected account.", 502);
      }
      const data = parsed.data.data;
      return {
        source: parsed.data.source,
        evidenceCount: data.product_signals.length + data.billing_events.length + data.support_events.length,
        approvalBoundaryPresent: data.preference_profile !== null,
      };
    },

    async createRun(input, signal) {
      const validated = hostedRunCreateInputSchema.parse(input);
      const parsed = hostedRunCreateResponseSchema.safeParse(
        await callRuns("create_run", validated, signal),
      );
      if (!parsed.success) throw clientError("Hosted run gateway returned an invalid create contract.", 502);
      return { run: parsed.data.run, idempotentReplay: parsed.data.idempotent_replay };
    },

    async readRun(runId, signal) {
      const parsed = hostedRunReadResponseSchema.safeParse(
        await callRuns("get_run", { run_id: runId }, signal),
      );
      if (!parsed.success) throw clientError("Hosted run gateway returned an invalid read contract.", 502);
      return parsed.data.run;
    },

    async retryRun(runId, signal) {
      const parsed = hostedRunReadResponseSchema.safeParse(
        await callRuns("retry_run", { run_id: runId }, signal),
      );
      if (!parsed.success) throw clientError("Hosted run gateway returned an invalid retry contract.", 502);
      return parsed.data.run;
    },
  };
}
