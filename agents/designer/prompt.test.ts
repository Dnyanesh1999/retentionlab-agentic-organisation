// @vitest-environment node

import { describe, expect, it } from "vitest";

import { buildDesignerTask, DESIGNER_SYSTEM_PROMPT } from "./prompt.js";
import { makeDesignerInput } from "./testFixture.js";

describe("Designer prompt", () => {
  it("locks Luca's personality, inheritance, consent, accessibility, and anti-dashboard standard", () => {
    expect(DESIGNER_SYSTEM_PROMPT).toContain("Luca Moretti");
    expect(DESIGNER_SYSTEM_PROMPT).toContain("cinematic, systems-minded, and ethically exacting");
    expect(DESIGNER_SYSTEM_PROMPT).toContain("Use only evidence_key values present in the ResearchBrief");
    expect(DESIGNER_SYSTEM_PROMPT).toContain("Consent is not a creative variable");
    expect(DESIGNER_SYSTEM_PROMPT).toContain("WCAG 2.2 AA");
    expect(DESIGNER_SYSTEM_PROMPT).toContain("Avoid a dense dashboard");
    expect(DESIGNER_SYSTEM_PROMPT).toContain("Recovery Room web experience");
    expect(DESIGNER_SYSTEM_PROMPT).toContain("only a concise doorway into that experience");
    expect(DESIGNER_SYSTEM_PROMPT).toContain("Never expand an account-level aggregate");
  });

  it("passes the complete immutable predecessor to the model", () => {
    const task = buildDesignerTask(makeDesignerInput());
    expect(task).toContain("research-brief.v1");
    expect(task).toContain("product:copper-finch:feature_adoption:2");
    expect(task).toContain("Produce a design transformation, not new research");
  });
});
