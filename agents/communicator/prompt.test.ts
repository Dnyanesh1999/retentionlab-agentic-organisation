import { describe, expect, it } from "vitest";

import { buildCommunicatorTask, COMMUNICATOR_SYSTEM_PROMPT } from "./prompt.js";
import { makeCommunicatorInput } from "./testFixture.js";

describe("Communicator prompt", () => {
  it("locks Maeve's distinct personality and ethical persuasion boundary", () => {
    expect(COMMUNICATOR_SYSTEM_PROMPT).toContain("plain-spoken, empathetic and evidence-disciplined");
    expect(COMMUNICATOR_SYSTEM_PROMPT).toContain("attention as borrowed, never owed");
    expect(COMMUNICATOR_SYSTEM_PROMPT).toContain("Non-response is not consent");
    expect(COMMUNICATOR_SYSTEM_PROMPT).toContain("ethical clarity");
    expect(COMMUNICATOR_SYSTEM_PROMPT).toContain("must never expose");
  });

  it("passes the complete Maker artefact into the task", () => {
    const task = buildCommunicatorTask(makeCommunicatorInput());
    expect(task).toContain("RecoveryRoomArtefact");
    expect(task).toContain("maker.v1.1.0");
  });
});
