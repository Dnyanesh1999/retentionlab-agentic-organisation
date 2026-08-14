import { describe, expect, it } from "vitest";

import {
  HOSTED_EVENT_TYPE_ORDER,
  HOSTED_RUN_STATUS_ORDER,
  HOSTED_STAGE_ORDER,
  hostedRunCreateInputSchema,
  hostedRunCreateResponseSchema,
  hostedRunEventSchema,
  hostedRunReadResponseSchema,
  hostedRunSchema,
} from "./contracts.js";
import { makeHostedRun, makeHostedRunCreateInput } from "./testFixture.js";

describe("Hosted run constants", () => {
  it("pins the five stages in pipeline order", () => {
    expect(HOSTED_STAGE_ORDER).toEqual([
      "researcher",
      "designer",
      "maker",
      "communicator",
      "manager",
    ]);
  });

  it("pins the run statuses and event types exhaustively", () => {
    expect(HOSTED_RUN_STATUS_ORDER).toEqual([
      "queued",
      "in_progress",
      "awaiting_human_approval",
      "failed",
    ]);
    expect(HOSTED_EVENT_TYPE_ORDER).toEqual([
      "run_created",
      "stage_started",
      "stage_completed",
      "run_paused_for_approval",
      "run_failed",
    ]);
  });
});

describe("Hosted run create input", () => {
  it("accepts a well-formed create payload", () => {
    const input = hostedRunCreateInputSchema.parse(makeHostedRunCreateInput());
    expect(input.account_slug).toBe("northwind-retail");
    expect(input.idempotency_key).toBe("req-2026-08-14-northwind-001");
  });

  it("rejects unknown keys (strict)", () => {
    const input = { ...makeHostedRunCreateInput(), account_id: "spoofed" };
    expect(() => hostedRunCreateInputSchema.parse(input)).toThrow();
  });

  it("rejects an uppercase or space-bearing account slug", () => {
    expect(() =>
      hostedRunCreateInputSchema.parse({ ...makeHostedRunCreateInput(), account_slug: "North Wind" }),
    ).toThrow("lowercase");
  });

  it("rejects a too-short idempotency key", () => {
    expect(() =>
      hostedRunCreateInputSchema.parse({ ...makeHostedRunCreateInput(), idempotency_key: "short" }),
    ).toThrow();
  });

  it("rejects an objective below the minimum length", () => {
    expect(() =>
      hostedRunCreateInputSchema.parse({ ...makeHostedRunCreateInput(), objective: "too short" }),
    ).toThrow();
  });
});

describe("Hosted run snapshot", () => {
  it("accepts the reference run and its ordered event stream", () => {
    const run = hostedRunSchema.parse(makeHostedRun());
    expect(run.status).toBe("awaiting_human_approval");
    expect(run.events).toHaveLength(4);
  });

  it("rejects a run whose ids are not UUIDs", () => {
    expect(() => hostedRunSchema.parse({ ...makeHostedRun(), run_id: "run-1" })).toThrow();
  });

  it("rejects a non-monotonic event sequence", () => {
    const run = makeHostedRun();
    run.events[2] = { ...run.events[2], sequence: 2 } as (typeof run.events)[number];
    expect(() => hostedRunSchema.parse(run)).toThrow("strictly increasing");
  });

  it("rejects a non-positive sequence value", () => {
    const run = makeHostedRun();
    run.events[0] = { ...run.events[0], sequence: 0 } as (typeof run.events)[number];
    expect(() => hostedRunSchema.parse(run)).toThrow();
  });

  it("requires the first event to be run_created", () => {
    const run = makeHostedRun();
    run.events = run.events.slice(1);
    expect(() => hostedRunSchema.parse(run)).toThrow("run_created");
  });

  it("rejects a naive (offset-less) timestamp", () => {
    expect(() =>
      hostedRunSchema.parse({ ...makeHostedRun(), created_at: "2026-08-14T09:00:00" }),
    ).toThrow();
  });

  it("bounds the public summary length", () => {
    expect(() =>
      hostedRunSchema.parse({ ...makeHostedRun(), public_summary: "x".repeat(281) }),
    ).toThrow();
  });
});

describe("Hosted run events", () => {
  it("rejects a stage_completed event missing its public summary", () => {
    expect(() =>
      hostedRunEventSchema.parse({
        type: "stage_completed",
        sequence: 3,
        stage: "researcher",
        occurred_at: "2026-08-14T09:00:05.000Z",
      }),
    ).toThrow();
  });

  it("rejects an unknown event type", () => {
    expect(() =>
      hostedRunEventSchema.parse({
        type: "stage_skipped",
        sequence: 3,
        stage: "researcher",
        occurred_at: "2026-08-14T09:00:05.000Z",
      }),
    ).toThrow();
  });
});

describe("Hosted run responses", () => {
  it("wraps a run in a create response with the idempotent-replay flag", () => {
    const response = hostedRunCreateResponseSchema.parse({
      idempotent_replay: false,
      run: makeHostedRun(),
    });
    expect(response.idempotent_replay).toBe(false);
    expect(response.run.run_id).toBe(makeHostedRun().run_id);
  });

  it("wraps a run in a read response", () => {
    const response = hostedRunReadResponseSchema.parse({ run: makeHostedRun() });
    expect(response.run.contract_version).toBe("hosted.run.v1");
  });

  it("rejects a create response with unknown keys (strict)", () => {
    expect(() =>
      hostedRunCreateResponseSchema.parse({
        idempotent_replay: false,
        run: makeHostedRun(),
        latency_ms: 12,
      }),
    ).toThrow();
  });
});
