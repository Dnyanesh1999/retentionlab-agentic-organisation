import { z } from "zod";

import {
  clarificationReceiptSchema,
  clarificationSubmissionSchema,
  type ClarificationReceipt,
  type ClarificationSubmission,
} from "./clarificationContracts";

const requestIdSchema = z.uuid();
const capabilityTokenSchema = z.string().min(32).max(2048).regex(/^[A-Za-z0-9._~-]+$/);

export type ClarificationClientErrorCode =
  | "invalid_request"
  | "aborted"
  | "timeout"
  | "network"
  | "unauthorized"
  | "forbidden"
  | "conflict"
  | "rate_limited"
  | "unavailable"
  | "invalid_contract";

export class ClarificationClientError extends Error {
  constructor(
    readonly code: ClarificationClientErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ClarificationClientError";
  }
}
export interface ClarificationClient {
  share(
    submission: ClarificationSubmission,
    requestId: string,
    signal?: AbortSignal,
  ): Promise<ClarificationReceipt>;
}

export type LiveClarificationClientConfiguration = {
  gatewayUrl: string;
  publishableKey: string;
  capabilityToken: string;
  timeoutMs?: number;
};

const gatewayErrorSchema = z.object({ error: z.string().min(1) }).passthrough();

function classifyStatus(status: number): ClarificationClientErrorCode {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 409) return "conflict";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "unavailable";
  return "invalid_request";
}

export class LiveClarificationClient implements ClarificationClient {
  private readonly timeoutMs: number;

  constructor(
    private readonly configuration: LiveClarificationClientConfiguration,
    private readonly fetchImplementation: typeof fetch = fetch,
  ) {
    this.timeoutMs = configuration.timeoutMs ?? 10_000;
  }

  async share(
    submission: ClarificationSubmission,
    requestId: string,
    signal?: AbortSignal,
  ): Promise<ClarificationReceipt> {
    const parsedSubmission = clarificationSubmissionSchema.safeParse(submission);
    if (!parsedSubmission.success) {
      throw new ClarificationClientError("invalid_request", "Clarification submission is invalid.", 400);
    }
    if (!requestIdSchema.safeParse(requestId).success) {
      throw new ClarificationClientError("invalid_request", "Idempotency request ID is invalid.", 400);
    }
    if (!this.configuration.gatewayUrl.startsWith("https://")) {
      throw new ClarificationClientError("invalid_request", "Clarification gateway must use HTTPS.", 500);
    }
    if (!this.configuration.publishableKey.startsWith("sb_publishable_")) {
      throw new ClarificationClientError("invalid_request", "Clarification gateway key is invalid.", 500);
    }
    if (!capabilityTokenSchema.safeParse(this.configuration.capabilityToken).success) {
      throw new ClarificationClientError("forbidden", "Recovery capability is unavailable.", 403);
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
          "idempotency-key": requestId,
          "x-recovery-token": this.configuration.capabilityToken,
        },
        body: JSON.stringify(parsedSubmission.data),
        cache: "no-store",
        signal: requestSignal,
      });
    } catch (error) {
      if (signal?.aborted) {
        throw new ClarificationClientError("aborted", "Clarification request was cancelled.");
      }
      if (timeoutController.signal.aborted) {
        throw new ClarificationClientError("timeout", "Clarification request timed out.", 504);
      }
      throw new ClarificationClientError(
        "network",
        `Clarification service is unreachable: ${error instanceof Error ? error.message : "network failure"}`,
        503,
      );
    } finally {
      globalThis.clearTimeout(timeoutId);
    }

    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const gatewayError = gatewayErrorSchema.safeParse(body);
      throw new ClarificationClientError(
        classifyStatus(response.status),
        gatewayError.success ? gatewayError.data.error : "Clarification request was rejected.",
        response.status,
      );
    }

    const receipt = clarificationReceiptSchema.safeParse(body);
    if (!receipt.success) {
      throw new ClarificationClientError(
        "invalid_contract",
        "Clarification service returned an invalid receipt.",
        502,
      );
    }

    return receipt.data;
  }
}
