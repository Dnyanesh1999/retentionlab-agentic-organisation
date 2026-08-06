import { describe, expect, it } from "vitest";

import { makerImplementationEvidenceSchema, makerInputSchema } from "./contracts.js";
import { makeMakerImplementation, makeMakerInput } from "./testFixture.js";

describe("Maker contracts", () => {
  it("accepts the reviewed Designer predecessor and verified implementation evidence", () => {
    expect(makerInputSchema.parse(makeMakerInput()).design_specification.status).toBe("ready_for_maker");
    expect(makerImplementationEvidenceSchema.parse(makeMakerImplementation()).verification.test_status).toBe("passed");
  });

  it("rejects an out-of-chain run id", () => {
    const input = makeMakerInput();
    expect(() => makerInputSchema.parse({
      ...input,
      run_id: "7d9ee004-7b12-46d6-843e-1641386b836f",
    })).toThrow("Maker run_id must match");
  });

  it("rejects implementation evidence without all seven required states", () => {
    const evidence = makeMakerImplementation();
    expect(() => makerImplementationEvidenceSchema.parse({
      ...evidence,
      implemented_states: evidence.implemented_states.slice(0, 6),
    })).toThrow();
  });
});
