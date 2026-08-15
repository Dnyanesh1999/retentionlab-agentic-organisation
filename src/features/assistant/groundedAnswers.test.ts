import { describe, expect, it } from "vitest";

import { answerFromSealedRecord, suggestedQuestions } from "./groundedAnswers";
import { gate9Run } from "../organisation/gate9Run";

describe("groundedAnswers", () => {
  it("offers every grounded question as a starter, each with a source", () => {
    expect(suggestedQuestions.length).toBeGreaterThan(0);
    suggestedQuestions.forEach((question) => {
      expect(question.source).not.toHaveLength(0);
      expect(question.provenance).toBe("sealed-record");
    });
  });

  it("resolves free text to a grounded answer", () => {
    const reply = answerFromSealedRecord("what did the manager decide?");

    expect(reply.status).toBe("answered");
    if (reply.status !== "answered") return;
    expect(reply.answer.answer).toContain(gate9Run.managerOutcome.decision);
    expect(reply.answer.provenance).toBe("sealed-record");
  });

  it("refuses rather than guessing when nothing matches", () => {
    const reply = answerFromSealedRecord("what is the weather in Dublin tomorrow");

    // An assistant that guesses is worse than one that says it cannot answer.
    expect(reply.status).toBe("unmatched");
    if (reply.status !== "unmatched") return;
    expect(reply.notice).toMatch(/sealed decision record/i);
  });

  it("asks for input rather than refusing when the question is empty", () => {
    const reply = answerFromSealedRecord("   ");

    expect(reply.status).toBe("unmatched");
    if (reply.status !== "unmatched") return;
    expect(reply.notice).toMatch(/enter a question/i);
  });

  it("derives the consented channel from the record instead of restating it", () => {
    const reply = answerFromSealedRecord("can we email the customer?");
    expect(reply.status).toBe("answered");
    if (reply.status !== "answered") return;

    const researcher = gate9Run.stages.find((stage) => stage.id === "researcher")?.detail;
    const channels = researcher?.kind === "researcher" ? researcher.allowedChannels : [];
    expect(channels.length).toBeGreaterThan(0);
    // The answer must quote the sealed consent boundary, not a hardcoded string
    // that could drift away from it.
    channels.forEach((channel) => expect(reply.answer.answer).toContain(channel));
    expect(reply.answer.answer).toMatch(/requires a named human to approve/i);
  });

  it("never claims an autonomous external action is permitted", () => {
    expect(gate9Run.managerOutcome.autonomousExternalActions).toBe(false);

    suggestedQuestions.forEach((question) => {
      expect(question.answer).not.toMatch(/autonomous external actions: true/i);
    });
  });
});
