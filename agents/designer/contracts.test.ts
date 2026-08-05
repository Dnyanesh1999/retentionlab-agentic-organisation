// @vitest-environment node

import { describe, expect, it } from "vitest";

import { designerInputSchema, recoveryDesignSpecificationSchema } from "./contracts.js";
import { makeDesignerInput, makeDesignSpecification } from "./testFixture.js";

describe("Designer contracts", () => {
  it("rejects a run that does not match its ResearchBrief", () => {
    const input = makeDesignerInput();
    expect(designerInputSchema.safeParse({ ...input, run_id: "d52af84b-64ce-46ad-8243-357f24a20fd9" }).success).toBe(false);
  });

  it("accepts a complete build-ready design contract and rejects unknown fields", () => {
    const input = makeDesignerInput();
    expect(recoveryDesignSpecificationSchema.safeParse(makeDesignSpecification(input)).success).toBe(true);
    expect(recoveryDesignSpecificationSchema.safeParse({ ...makeDesignSpecification(input), persuasive_score: 99 }).success).toBe(false);
  });
});

