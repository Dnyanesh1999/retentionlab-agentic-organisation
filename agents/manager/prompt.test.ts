import { describe, expect, it } from "vitest";

import { buildManagerTask, MANAGER_SYSTEM_PROMPT } from "./prompt.js";
import { makeManagerInput } from "./testFixture.js";

describe("Manager prompt", () => {
  it("locks Elias Grant's distinct personality and human-approval boundary", () => {
    expect(MANAGER_SYSTEM_PROMPT).toContain("calm, accountable and adversarially constructive");
    expect(MANAGER_SYSTEM_PROMPT).toContain("You are not an executor");
    expect(MANAGER_SYSTEM_PROMPT).toContain("cannot self-approve");
    expect(MANAGER_SYSTEM_PROMPT).toContain("accountable judgement");
  });

  it("passes the complete verified chain into the task and forbids claiming execution", () => {
    const task = buildManagerTask(makeManagerInput());
    expect(task).toContain("complete, runtime-verified artefact chain");
    expect(task).toContain("SHA-256 lineage");
    expect(task).toContain("do not claim any action was executed");
  });
});
