// @vitest-environment node

import { describe, expect, it } from "vitest";

import { buildResearcherTask, RESEARCHER_SYSTEM_PROMPT } from "./prompt.js";

describe("Researcher prompt", () => {
  it("locks Nia's personality, evidence discipline, consent boundary, and Designer handoff", () => {
    expect(RESEARCHER_SYSTEM_PROMPT).toContain("Nia Calder");
    expect(RESEARCHER_SYSTEM_PROMPT).toContain("forensic, humane, and constructively sceptical");
    expect(RESEARCHER_SYSTEM_PROMPT).toContain("Every factual observation must cite");
    expect(RESEARCHER_SYSTEM_PROMPT).toContain("mandatory baseline");
    expect(RESEARCHER_SYSTEM_PROMPT).toContain("Consent is a hard boundary");
    expect(RESEARCHER_SYSTEM_PROMPT).toContain("The Designer must receive");
    expect(RESEARCHER_SYSTEM_PROMPT).toContain("Every non-negotiable must be achievable");
    expect(RESEARCHER_SYSTEM_PROMPT).toContain("customer-controlled clarification opportunity");
    expect(RESEARCHER_SYSTEM_PROMPT).toContain("Never invent");
  });

  it("passes identifiers and objective without embedding business evidence", () => {
    const task = buildResearcherTask({
      run_id: "18a7e151-9e3b-4fd5-90de-2bba2ab54860",
      account_slug: "copper-finch",
      objective: "Investigate current retention risk with evidence and consent boundaries.",
      initiated_at: "2026-08-05T12:00:00.000Z",
    });

    expect(task).toContain("copper-finch");
    expect(task).toContain("business claims require MCP citations");
    expect(task).toContain("LIVE MCP EVIDENCE PACKET");
    expect(task).not.toMatch(/invoice|ticket|utilisation.{0,20}\d/i);
  });
});
