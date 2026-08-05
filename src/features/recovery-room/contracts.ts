import { z } from "zod";

export const signalMetricCodeSchema = z.enum([
  "feature_adoption",
  "active_users",
  "session_frequency",
]);

export const evidenceReferenceSchema = z.object({
  evidence_key: z.string().min(1),
  source_system: z.string().min(1),
  source_tool: z.string().min(1),
  retrieved_at: z.iso.datetime(),
}).strict();

export const signalReadingSchema = z.object({
  code: signalMetricCodeSchema,
  current_value: z.number().finite(),
  previous_value: z.number().finite(),
  unit: z.enum(["percent", "count", "frequency"]),
  evidence: evidenceReferenceSchema,
}).strict();

export const signalGardenSnapshotSchema = z.object({
  schema_version: z.literal("signal-garden-snapshot.v1"),
  account_slug: z.string().min(1),
  retrieved_at: z.iso.datetime(),
  signals: z.array(signalReadingSchema).length(3),
  seat_utilisation: z.object({
    current_value: z.number().finite().min(0).max(100),
    unit: z.literal("percent"),
    evidence: evidenceReferenceSchema,
  }).strict(),
}).strict().superRefine((snapshot, context) => {
  const requiredCodes = signalMetricCodeSchema.options;
  const suppliedCodes = new Set(snapshot.signals.map(({ code }) => code));

  for (const code of requiredCodes) {
    if (!suppliedCodes.has(code)) {
      context.addIssue({
        code: "custom",
        message: `Missing required aggregate signal: ${code}`,
        path: ["signals"],
      });
    }
  }

  if (suppliedCodes.size !== snapshot.signals.length) {
    context.addIssue({
      code: "custom",
      message: "Signal Garden snapshot contains duplicate aggregate signals.",
      path: ["signals"],
    });
  }
});

export type SignalGardenSnapshot = z.infer<typeof signalGardenSnapshotSchema>;
export type SignalReading = z.infer<typeof signalReadingSchema>;

export interface SignalGardenEvidenceClient {
  getSnapshot(accountSlug: string, signal?: AbortSignal): Promise<SignalGardenSnapshot>;
}

export function decodeSignalGardenSnapshot(value: unknown): SignalGardenSnapshot {
  return signalGardenSnapshotSchema.parse(value);
}
