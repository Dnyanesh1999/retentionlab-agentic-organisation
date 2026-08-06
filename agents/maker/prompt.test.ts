import { describe, expect, it } from "vitest";

import { buildMakerTask, MAKER_SYSTEM_PROMPT } from "./prompt.js";
import { makeMakerImplementation, makeMakerInput } from "./testFixture.js";

describe("Maker prompt", () => {
  it("locks Noor's personality, build discipline and Communicator handoff", () => {
    expect(MAKER_SYSTEM_PROMPT).toContain("pragmatic, meticulous and accessibility-first");
    expect(MAKER_SYSTEM_PROMPT).toContain("A decline is a complete valid outcome");
    expect(MAKER_SYSTEM_PROMPT).toContain("Maeve must receive");
    expect(MAKER_SYSTEM_PROMPT).toContain("must not ship");
    expect(MAKER_SYSTEM_PROMPT).toContain("Never call them personal");
    expect(MAKER_SYSTEM_PROMPT).toContain("not customer evidence claims");
  });

  it("includes the complete predecessor and runtime-owned implementation proof", () => {
    const task = buildMakerTask(makeMakerInput(), makeMakerImplementation());
    expect(task).toContain("RecoveryDesignSpecification");
    expect(task).toContain("#/cases/recovery-room");
    expect(task).toContain("SignalCanvas.tsx");
  });
});
