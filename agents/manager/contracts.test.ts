import { describe, expect, it } from "vitest";

import { managerInputSchema } from "./contracts.js";
import { makeManagerInput } from "./testFixture.js";

describe("Manager contracts", () => {
  it("accepts a complete, same-run, same-account chain with the required statuses", () => {
    const input = managerInputSchema.parse(makeManagerInput());
    expect(input.research_brief.status).toBe("completed");
    expect(input.design_specification.status).toBe("ready_for_maker");
    expect(input.recovery_room_artifact.status).toBe("ready_for_communication");
    expect(input.communication_plan.status).toBe("ready_for_manager");
  });

  it("rejects a predecessor from a different run", () => {
    const input = makeManagerInput();
    input.communication_plan.run_id = "53fc0231-1c57-4f47-b4a2-06d78de1a825";
    expect(() => managerInputSchema.parse(input)).toThrow("same run_id");
  });

  it("rejects a predecessor that is not yet in its required completed status", () => {
    const input = makeManagerInput();
    input.recovery_room_artifact.status = "needs_design_revision";
    expect(() => managerInputSchema.parse(input)).toThrow("ready_for_communication");
  });

  it("rejects a chain that mixes accounts", () => {
    const input = makeManagerInput();
    input.communication_plan.account_slug = "other-account";
    expect(() => managerInputSchema.parse(input)).toThrow("one consistent account");
  });
});
