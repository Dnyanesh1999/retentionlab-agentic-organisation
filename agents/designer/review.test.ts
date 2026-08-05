// @vitest-environment node

import { describe, expect, it } from "vitest";

import { promoteReviewedDesignerCandidate } from "./review.js";
import { hashResearchBrief } from "./run.js";
import { makeDesignerInput, makeDesignSpecification } from "./testFixture.js";

describe("Designer quality review", () => {
  it("applies only the bounded accessibility and spelling corrections before promotion", () => {
    const input = makeDesignerInput();
    const candidate = makeDesignSpecification(input);
    candidate.source.research_artifact_sha256 = hashResearchBrief(input.research_brief);
    candidate.journey[0]!.system_response =
      "Focus is trapped within the canvas; tab order follows visual flow.";
    candidate.maker_handoff.acceptance_tests[0] =
      "Tab order follows visual flow and loops within canvas";
    candidate.journey[0]!.maker_acceptance_criteria[0] =
      "Focus order is logical and looped within the canvas";
    candidate.maker_handoff.data_bindings[0]!.field_path = "feature_adduction";

    const result = promoteReviewedDesignerCandidate({
      input,
      candidate,
      reviewedAt: "2026-08-05T14:40:59.450Z",
    });

    const serialized = JSON.stringify(result.specification);
    expect(serialized).not.toContain("Focus is trapped");
    expect(serialized).not.toContain("loops within canvas");
    expect(serialized).not.toContain("looped within the canvas");
    expect(serialized).not.toContain("feature_adduction");
    expect(serialized).toContain("persistent exit and page navigation");
    expect(serialized).toContain("feature_adoption");
    expect(result.review.corrections).toHaveLength(4);
    expect(result.review.review_version).toBe("designer-quality-review.v2");
    expect(result.review.status).toBe("accepted_after_bounded_corrections");
  });
});
