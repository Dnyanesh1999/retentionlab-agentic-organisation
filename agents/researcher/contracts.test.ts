// @vitest-environment node

import { describe, expect, it } from "vitest";

import { researchBriefSchema, researcherInputSchema } from "./contracts.js";

describe("Researcher contracts", () => {
  it("rejects an invalid run identifier and a non-slug account", () => {
    const result = researcherInputSchema.safeParse({
      run_id: "run-1",
      account_slug: "Copper Finch",
      objective: "Investigate retention risk using fresh evidence from the live source.",
      initiated_at: "2026-08-05T12:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects completed output with no cited observations and unknown fields", () => {
    const result = researchBriefSchema.safeParse({
      schema_version: "research-brief.v1",
      stage: "researcher",
      status: "completed",
      agent: { id: "researcher", name: "Nia Calder", personality: "forensic, humane, constructively sceptical" },
      run_id: "18a7e151-9e3b-4fd5-90de-2bba2ab54860",
      account_slug: "copper-finch",
      brief_summary: "The current evidence needs an evidence-grounded retention response.",
      observations: [],
      hypotheses: [],
      consent_boundaries: {
        allowed_channels: [],
        prohibited_actions: ["Do not contact without permission."],
        citations: [],
      },
      unknowns: ["Future intent is not observable."],
      designer_handoff: {
        design_challenge: "Design a consent-safe retention response grounded in verified evidence.",
        priority_outcomes: ["Clarify value"],
        non_negotiables: ["Respect consent"],
        success_signals: ["Verified engagement"],
      },
      provenance: {
        provider: "openrouter",
        requested_model: "openrouter/free",
        resolved_model: "example/free",
        prompt_version: "researcher.v1.0.0",
        generated_at: "2026-08-05T12:00:01.000Z",
        tool_calls: [
          "get_account_snapshot",
          "list_product_signals",
          "list_billing_events",
          "list_support_events",
          "get_preference_profile",
        ],
        all_sources_no_store: true,
      },
      unreviewed_score: 99,
    });
    expect(result.success).toBe(false);
  });
});

