import { z } from "zod";

export const clarificationObservationMaxLength = 500;

const accountSlugSchema = z.string().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const supportEvidenceKeyPattern = /^support:([a-z0-9]+(?:-[a-z0-9]+)*):[a-z0-9-]+$/;
const preferenceEvidenceKeyPattern = /^preference:([a-z0-9]+(?:-[a-z0-9]+)*):[a-z0-9-]+$/;
const supportEvidenceKeySchema = z.string().regex(supportEvidenceKeyPattern);
const preferenceEvidenceKeySchema = z.string().regex(preferenceEvidenceKeyPattern);

export const clarificationSubmissionSchema = z.object({
  schema_version: z.literal("clarification-submission.v1"),
  account_slug: accountSlugSchema,
  support_evidence_key: supportEvidenceKeySchema,
  preference_evidence_key: preferenceEvidenceKeySchema,
  observation: z.string().max(clarificationObservationMaxLength).nullable(),
  consent: z.object({
    action: z.literal("share_observation"),
    copy_version: z.literal("clarification-consent.v1"),
  }).strict(),
}).strict().superRefine((submission, context) => {
  const supportAccount = supportEvidenceKeyPattern.exec(submission.support_evidence_key)?.[1];
  const preferenceAccount = preferenceEvidenceKeyPattern.exec(submission.preference_evidence_key)?.[1];

  if (supportAccount !== submission.account_slug) {
    context.addIssue({
      code: "custom",
      message: "Support evidence belongs to a different account.",
      path: ["support_evidence_key"],
    });
  }

  if (preferenceAccount !== submission.account_slug) {
    context.addIssue({
      code: "custom",
      message: "Preference evidence belongs to a different account.",
      path: ["preference_evidence_key"],
    });
  }
});

export const clarificationReceiptSchema = z.object({
  schema_version: z.literal("clarification-receipt.v1"),
  submission_id: z.uuid(),
  accepted_at: z.iso.datetime({ offset: true }),
  replayed: z.boolean(),
}).strict();

export type ClarificationSubmission = z.infer<typeof clarificationSubmissionSchema>;
export type ClarificationReceipt = z.infer<typeof clarificationReceiptSchema>;

export function normalizeObservation(value: string): string | null {
  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

export function decodeClarificationSubmission(value: unknown): ClarificationSubmission {
  return clarificationSubmissionSchema.parse(value);
}

export function decodeClarificationReceipt(value: unknown): ClarificationReceipt {
  return clarificationReceiptSchema.parse(value);
}
