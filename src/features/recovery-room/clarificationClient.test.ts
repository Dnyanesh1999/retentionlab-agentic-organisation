import { describe, expect, it, vi } from "vitest";

import type { ClarificationSubmission } from "./clarificationContracts";
import { ClarificationClientError, LiveClarificationClient } from "./clarificationClient";

const submission: ClarificationSubmission = {
  schema_version: "clarification-submission.v1",
  account_slug: "adapter-test",
  support_evidence_key: "support:adapter-test:2-1",
  preference_evidence_key: "preference:adapter-test:2",
  observation: null,
  consent: { action: "share_observation", copy_version: "clarification-consent.v1" },
};

const receipt = {
  schema_version: "clarification-receipt.v1",
  submission_id: "7406f0f5-99a7-4168-bc1f-6209869a1a29",
  accepted_at: "2026-08-06T08:00:00.000Z",
  replayed: false,
};

function client(fetchImplementation: typeof fetch, timeoutMs = 1_000) {
  return new LiveClarificationClient({
    gatewayUrl: "https://example.supabase.co/functions/v1/retentionlab-clarification",
    publishableKey: "sb_publishable_clarification_test_key",
    capabilityToken: "opaque.recovery-capability_token-1234567890",
    timeoutMs,
  }, fetchImplementation);
}

describe("LiveClarificationClient", () => {
  it("submits explicit consent once with capability and idempotency headers", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(Response.json(receipt));
    const requestId = "5f191612-74a5-46a7-af87-bffebd6c5ea8";

    await expect(client(fetchImplementation).share(submission, requestId)).resolves.toEqual(receipt);

    const [url, request] = fetchImplementation.mock.calls[0]!;
    expect(url).toContain("retentionlab-clarification");
    expect(fetchImplementation.mock.contexts[0]).toBe(globalThis);
    expect(request).toMatchObject({ method: "POST", cache: "no-store" });
    expect(request?.headers).toMatchObject({
      apikey: "sb_publishable_clarification_test_key",
      "idempotency-key": requestId,
      "x-recovery-token": "opaque.recovery-capability_token-1234567890",
    });
    expect(JSON.parse(String(request?.body))).toEqual(submission);
  });

  it("rejects invalid input before making a request", async () => {
    const fetchImplementation = vi.fn<typeof fetch>();

    await expect(client(fetchImplementation).share(
      { ...submission, support_evidence_key: "support:another-account:2-1" },
      "5f191612-74a5-46a7-af87-bffebd6c5ea8",
    )).rejects.toMatchObject({ code: "invalid_request" });
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it("maps a consumed capability conflict without accepting a false receipt", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ error: "Recovery capability has already been used." }, { status: 409 }),
    );

    await expect(client(fetchImplementation).share(
      submission,
      "5f191612-74a5-46a7-af87-bffebd6c5ea8",
    )).rejects.toEqual(expect.objectContaining<Partial<ClarificationClientError>>({
      code: "conflict",
      status: 409,
    }));
  });

  it("rejects a malformed success receipt", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ ...receipt, observation: "must not be echoed" }),
    );

    await expect(client(fetchImplementation).share(
      submission,
      "5f191612-74a5-46a7-af87-bffebd6c5ea8",
    )).rejects.toMatchObject({ code: "invalid_contract" });
  });

  it("distinguishes caller cancellation from timeout", async () => {
    const abortingFetch = vi.fn<typeof fetch>((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));

    await expect(client(abortingFetch, 5).share(
      submission,
      "5f191612-74a5-46a7-af87-bffebd6c5ea8",
    )).rejects.toMatchObject({ code: "timeout" });

    const controller = new AbortController();
    const request = client(abortingFetch).share(
      submission,
      "5f191612-74a5-46a7-af87-bffebd6c5ea8",
      controller.signal,
    );
    controller.abort();
    await expect(request).rejects.toMatchObject({ code: "aborted" });
  });
});
