import { z } from "zod";

import type { EvidenceConfiguration } from "./config.js";

export const evidenceToolNames = [
  "get_account_snapshot",
  "list_product_signals",
  "list_billing_events",
  "list_support_events",
  "get_preference_profile",
  "list_vendor_status",
  "get_evidence_item",
  "list_accounts",
] as const;

export type EvidenceToolName = (typeof evidenceToolNames)[number];

const sourceSchema = z.object({
  system: z.literal("Supabase Postgres"),
  dataset: z.literal("retentionlab-demo-v1"),
  generation_run_id: z.string().uuid(),
  generated_at: z.string().datetime({ offset: true }),
  retrieved_at: z.string().datetime({ offset: true }),
  cache_mode: z.literal("no-store"),
}).strict();

export const evidenceEnvelopeSchema = z.object({
  tool: z.enum(evidenceToolNames),
  source: sourceSchema,
  account: z.object({
    slug: z.string(),
    display_name: z.string(),
  }).strict().optional(),
  data: z.unknown(),
}).strict();

const gatewayErrorSchema = z.object({
  error: z.string(),
  retrieved_at: z.string().optional(),
}).passthrough();

export type EvidenceEnvelope = z.infer<typeof evidenceEnvelopeSchema>;

export interface EvidenceGateway {
  call(tool: EvidenceToolName, args: Record<string, unknown>): Promise<EvidenceEnvelope>;
}

export class EvidenceSourceError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "EvidenceSourceError";
  }
}

export class LiveEvidenceClient implements EvidenceGateway {
  constructor(
    private readonly configuration: EvidenceConfiguration,
    private readonly fetchImplementation: typeof fetch = fetch,
  ) {}

  async call(tool: EvidenceToolName, args: Record<string, unknown>): Promise<EvidenceEnvelope> {
    let response: Response;
    try {
      response = await this.fetchImplementation(this.configuration.gatewayUrl, {
        method: "POST",
        headers: {
          accept: "application/json",
          apikey: this.configuration.publishableKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({ tool, arguments: args }),
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      throw new EvidenceSourceError(
        `Live evidence source is unreachable: ${error instanceof Error ? error.message : "network failure"}`,
        503,
      );
    }

    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const parsedError = gatewayErrorSchema.safeParse(body);
      throw new EvidenceSourceError(
        parsedError.success ? parsedError.data.error : `Live evidence query failed with status ${response.status}`,
        response.status,
      );
    }

    const envelope = evidenceEnvelopeSchema.safeParse(body);
    if (!envelope.success) {
      throw new EvidenceSourceError("Live evidence source returned an invalid contract", 502);
    }
    if (envelope.data.tool !== tool) {
      throw new EvidenceSourceError("Live evidence source returned a mismatched tool response", 502);
    }
    return envelope.data;
  }
}
