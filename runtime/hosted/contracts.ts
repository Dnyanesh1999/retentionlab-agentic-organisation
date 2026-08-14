import { z } from "zod";

// Hosted run contract — the strict, transport-facing schema for a hosted execution of the five-stage
// retention pipeline. This module is a pure contract: it validates the shapes a hosted API accepts
// (create input) and returns (create/read responses) plus the append-only event stream that narrates a
// run. It performs NO execution, spawns no agents, and takes no external action. Naming mirrors the
// orchestrator backbone (STAGE_ORDER, strict objects, ISO-offset timestamps, exported inferred types)
// so a hosted surface can wire onto the same runtime vocabulary without translation.

export const HOSTED_RUN_CONTRACT_VERSION = "hosted.run.v1" as const;

// The five stages run in exactly this order. Exhaustive and ordered so a scheduler can index into it.
export const HOSTED_STAGE_ORDER = [
  "researcher",
  "designer",
  "maker",
  "communicator",
  "manager",
] as const;
export type HostedStage = (typeof HOSTED_STAGE_ORDER)[number];

// Hosted run lifecycle. `queued` is the entry state a create yields; `in_progress` is the only state
// from which stages execute; `awaiting_human_approval` and `failed` are terminal for the hosted
// machine (no autonomous progression past either).
export const HOSTED_RUN_STATUS_ORDER = [
  "queued",
  "in_progress",
  "awaiting_human_approval",
  "failed",
] as const;
export type HostedRunStatus = (typeof HOSTED_RUN_STATUS_ORDER)[number];

// Append-only event vocabulary. Every hosted run is fully reconstructable from an ordered fold of
// these. Exhaustive and ordered for stable serialisation.
export const HOSTED_EVENT_TYPE_ORDER = [
  "run_created",
  "stage_started",
  "stage_completed",
  "run_paused_for_approval",
  "run_failed",
] as const;
export type HostedEventType = (typeof HOSTED_EVENT_TYPE_ORDER)[number];

export const hostedStageSchema = z.enum(HOSTED_STAGE_ORDER);
export const hostedRunStatusSchema = z.enum(HOSTED_RUN_STATUS_ORDER);
export const hostedEventTypeSchema = z.enum(HOSTED_EVENT_TYPE_ORDER);

// --- Shared primitives -------------------------------------------------------------------------

// Run and account identifiers are UUIDs. A slug is the human-facing, lowercase, hyphen-joined handle.
export const runIdSchema = z.string().uuid();
export const accountIdSchema = z.string().uuid();
export const accountSlugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "expected a lowercase hyphen-joined slug")
  .max(80);

// Timestamps are ISO-8601 with an explicit UTC offset — never a naive local time.
export const isoTimestampSchema = z.string().datetime({ offset: true });

// Event ordering key. Strictly positive integers; the run schema additionally enforces that a run's
// events form a strictly increasing sequence (see hostedRunSchema).
export const SEQUENCE_MIN = 1;
export const sequenceSchema = z.number().int().min(SEQUENCE_MIN);

// Client-supplied idempotency token: bounded, printable, safe to key a store on.
export const IDEMPOTENCY_KEY_MIN = 8;
export const IDEMPOTENCY_KEY_MAX = 200;
export const idempotencyKeySchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9._:-]+$/, "expected a printable idempotency token")
  .min(IDEMPOTENCY_KEY_MIN)
  .max(IDEMPOTENCY_KEY_MAX);

// The operator's objective for the run. Bounded so it stays a directive, never a payload.
export const OBJECTIVE_MIN = 20;
export const OBJECTIVE_MAX = 500;
export const objectiveSchema = z.string().trim().min(OBJECTIVE_MIN).max(OBJECTIVE_MAX);

// Bounded public summary — the only free text a hosted surface exposes outward. Capped so it stays a
// headline, never a leaked artefact body.
export const PUBLIC_SUMMARY_MAX = 280;
export const publicSummarySchema = z.string().trim().min(1).max(PUBLIC_SUMMARY_MAX);

// Bounded failure reason recorded on a run_failed event.
export const FAILURE_REASON_MAX = 500;
export const failureReasonSchema = z.string().trim().min(1).max(FAILURE_REASON_MAX);

// --- Create input ------------------------------------------------------------------------------

// The exact payload a hosted create endpoint accepts. Identifiers and timestamps are minted by the
// service, never by the caller — so the input carries only the operator's intent plus an idempotency
// key. Strict: unknown keys are rejected.
export const hostedRunCreateInputSchema = z
  .object({
    account_slug: accountSlugSchema,
    objective: objectiveSchema,
    idempotency_key: idempotencyKeySchema,
  })
  .strict();
export type HostedRunCreateInput = z.infer<typeof hostedRunCreateInputSchema>;

// --- Events ------------------------------------------------------------------------------------

// Append-only event stream. Each event carries its ordering `sequence` and the wall-clock `occurred_at`
// at which the hosted machine recorded it.
export const hostedRunEventSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("run_created"),
      sequence: sequenceSchema,
      run_id: runIdSchema,
      account_id: accountIdSchema,
      account_slug: accountSlugSchema,
      occurred_at: isoTimestampSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("stage_started"),
      sequence: sequenceSchema,
      stage: hostedStageSchema,
      occurred_at: isoTimestampSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("stage_completed"),
      sequence: sequenceSchema,
      stage: hostedStageSchema,
      public_summary: publicSummarySchema,
      occurred_at: isoTimestampSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("run_paused_for_approval"),
      sequence: sequenceSchema,
      stage: hostedStageSchema,
      occurred_at: isoTimestampSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("run_failed"),
      sequence: sequenceSchema,
      stage: hostedStageSchema,
      reason: failureReasonSchema,
      occurred_at: isoTimestampSchema,
    })
    .strict(),
]);
export type HostedRunEvent = z.infer<typeof hostedRunEventSchema>;

// Enforces a strictly increasing positive-integer sequence over an ordered event list. Extracted so
// both the run snapshot and any store validate ordering identically.
function assertMonotonicSequence(
  events: ReadonlyArray<{ sequence: number }>,
  ctx: z.RefinementCtx,
): void {
  let previous = 0;
  events.forEach((event, index) => {
    if (event.sequence <= previous) {
      ctx.addIssue({
        code: "custom",
        path: [index, "sequence"],
        message: "Hosted run events must form a strictly increasing sequence.",
      });
    }
    previous = event.sequence;
  });
}

// --- Run snapshot ------------------------------------------------------------------------------

// Canonical read model for a hosted run: the immutable identity, the current lifecycle status, the
// bounded outward summary, and the ordered event stream that produced it.
export const hostedRunSchema = z
  .object({
    contract_version: z.literal(HOSTED_RUN_CONTRACT_VERSION),
    run_id: runIdSchema,
    account_id: accountIdSchema,
    account_slug: accountSlugSchema,
    idempotency_key: idempotencyKeySchema,
    objective: objectiveSchema,
    status: hostedRunStatusSchema,
    current_stage: hostedStageSchema.nullable(),
    public_summary: publicSummarySchema.nullable(),
    created_at: isoTimestampSchema,
    updated_at: isoTimestampSchema,
    events: z.array(hostedRunEventSchema),
  })
  .strict()
  .superRefine((run, ctx) => {
    assertMonotonicSequence(
      run.events.map((event) => ({ sequence: event.sequence })),
      ctx,
    );
    const first = run.events[0];
    if (first && first.type !== "run_created") {
      ctx.addIssue({
        code: "custom",
        path: ["events", 0, "type"],
        message: "A hosted run's first event must be run_created.",
      });
    }
  });
export type HostedRun = z.infer<typeof hostedRunSchema>;

// --- Responses ---------------------------------------------------------------------------------

// Create response. `idempotent_replay` is true when the create matched an existing run for the same
// idempotency key and returned it unchanged rather than minting a new one.
export const hostedRunCreateResponseSchema = z
  .object({
    idempotent_replay: z.boolean(),
    run: hostedRunSchema,
  })
  .strict();
export type HostedRunCreateResponse = z.infer<typeof hostedRunCreateResponseSchema>;

// Read response. A single wrapped run snapshot.
export const hostedRunReadResponseSchema = z
  .object({
    run: hostedRunSchema,
  })
  .strict();
export type HostedRunReadResponse = z.infer<typeof hostedRunReadResponseSchema>;
