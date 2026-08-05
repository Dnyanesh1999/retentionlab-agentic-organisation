import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  designerInputSchema,
  recoveryDesignSpecificationSchema,
  type DesignerInput,
  type RecoveryDesignSpecification,
} from "./contracts.js";
import { assertDesignerIntegrity, hashResearchBrief } from "./run.js";

const approvedCorrections = [
  {
    issue: "Canvas-level focus trap prevents access to exit and surrounding navigation.",
    before: "Focus is trapped within the canvas; tab order follows visual flow.",
    after: "Focus proceeds through the canvas, then to the persistent exit and page navigation.",
  },
  {
    issue: "Acceptance test loops focus inside a non-modal canvas.",
    before: "Tab order follows visual flow and loops within canvas",
    after: "Tab order continues from the canvas to the persistent exit and page navigation",
  },
  {
    issue: "Nested Ready-state criterion loops focus inside a non-modal canvas.",
    before: "Focus order is logical and looped within the canvas",
    after: "Focus order is logical and continues to the persistent exit and page navigation",
  },
  {
    issue: "Data-binding path contains a spelling error.",
    before: "feature_adduction",
    after: "feature_adoption",
  },
] as const;

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function promoteReviewedDesignerCandidate(options: {
  input: DesignerInput;
  candidate: RecoveryDesignSpecification;
  reviewedAt: string;
}) {
  const input = designerInputSchema.parse(options.input);
  const candidate = recoveryDesignSpecificationSchema.parse(options.candidate);
  if (candidate.run_id !== input.run_id || candidate.account_slug !== input.research_brief.account_slug) {
    throw new Error("Reviewed Designer candidate does not belong to this predecessor chain.");
  }
  if (candidate.source.research_artifact_sha256 !== hashResearchBrief(input.research_brief)) {
    throw new Error("Reviewed Designer candidate has a mismatched ResearchBrief hash.");
  }

  const originalJson = JSON.stringify(candidate);
  let correctedJson = originalJson;
  for (const correction of approvedCorrections) {
    correctedJson = correctedJson.replaceAll(correction.before, correction.after);
  }
  const promoted = recoveryDesignSpecificationSchema.parse(JSON.parse(correctedJson) as unknown);
  assertDesignerIntegrity(input, promoted);

  return {
    specification: promoted,
    review: {
      review_version: "designer-quality-review.v2",
      status: "accepted_after_bounded_corrections",
      run_id: input.run_id,
      reviewed_at: options.reviewedAt,
      original_sha256: sha256(originalJson),
      promoted_sha256: sha256(JSON.stringify(promoted)),
      corrections: approvedCorrections.map(({ issue, before, after }) => ({ issue, before, after })),
      validator: "assertDesignerIntegrity",
    },
  };
}

export async function writeDesignerReview(review: object, reviewPath: string) {
  await mkdir(dirname(reviewPath), { recursive: true });
  await writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
}
