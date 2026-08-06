import { describe, expect, it } from "vitest";

import { communicatorInputSchema } from "./contracts.js";
import { makeCommunicatorInput } from "./testFixture.js";

describe("Communicator contracts", () => {
  it("accepts only a ready Maker predecessor from the same run", () => {
    expect(communicatorInputSchema.parse(makeCommunicatorInput()).recovery_room_artifact.status).toBe("ready_for_communication");
  });

  it("rejects a mismatched run id", () => {
    const input = makeCommunicatorInput();
    expect(() => communicatorInputSchema.parse({
      ...input,
      run_id: "53fc0231-1c57-4f47-b4a2-06d78de1a825",
    })).toThrow("Communicator run_id must match");
  });
});
