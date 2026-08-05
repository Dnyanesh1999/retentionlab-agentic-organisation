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

/**
 * The single open workflow support case surfaced for inspection. Every field is
 * bound to one cited support record; there is deliberately no cause, summary or
 * recommendation here, only the evidence needed to describe the open case.
 */
export const supportCaseSchema = z.object({
  // The customer-facing case reference, which is the cited evidence key itself.
  reference: z.string().min(1),
  // Domain guard: only an open *workflow* case may be surfaced.
  category: z.literal("workflow"),
  severity: z.enum(["low", "medium", "high", "critical"]),
  status: z.literal("open"),
  sentiment_score: z.number().finite().min(-1).max(1),
  // The occurrence timestamp, presented as the "unresolved as of" date.
  unresolved_at: z.iso.datetime(),
  evidence: evidenceReferenceSchema,
}).strict().superRefine((supportCase, context) => {
  // Fail closed on evidence that does not match the case it claims to describe.
  if (supportCase.reference !== supportCase.evidence.evidence_key) {
    context.addIssue({
      code: "custom",
      message: "Support case reference must match its bound evidence key.",
      path: ["reference"],
    });
  }
});

/**
 * The minimum consent fact needed to confirm that recovery outreach /
 * clarification may be offered, plus the preference evidence it is bound to.
 * Only the single gating boolean is carried; no other preference is exposed.
 */
export const clarificationPermissionSchema = z.object({
  allow_recovery_outreach: z.boolean(),
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
  support_case: supportCaseSchema,
  clarification_permission: clarificationPermissionSchema,
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
export type SupportCase = z.infer<typeof supportCaseSchema>;
export type ClarificationPermission = z.infer<typeof clarificationPermissionSchema>;
export type EvidenceReference = z.infer<typeof evidenceReferenceSchema>;

export interface SignalGardenEvidenceClient {
  getSnapshot(accountSlug: string, signal?: AbortSignal): Promise<SignalGardenSnapshot>;
}

export function decodeSignalGardenSnapshot(value: unknown): SignalGardenSnapshot {
  return signalGardenSnapshotSchema.parse(value);
}
