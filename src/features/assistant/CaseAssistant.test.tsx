import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CaseAssistant } from "./CaseAssistant";
import type { AssistantClient, AssistantResponse } from "./assistantClient";

const stub = (response: AssistantResponse): AssistantClient => ({
  ask: vi.fn().mockResolvedValue(response),
});

/**
 * Open the panel. The trigger and panel swap through `StateSwap`, which
 * animates, so everything after this must be awaited.
 */
async function open(client: AssistantClient | null = null) {
  render(<CaseAssistant client={client} />);
  fireEvent.click(screen.getByRole("button", { name: /Ask this case/ }));
  return screen.findByLabelText("Ask this case");
}

async function ask(question: string) {
  fireEvent.change(screen.getByLabelText(/Ask a question about this sealed case record/i), {
    target: { value: question },
  });
  fireEvent.click(screen.getByRole("button", { name: /^Ask$/ }));
}

describe("CaseAssistant", () => {
  it("answers from the sealed record with no model tier configured", async () => {
    await open(null);

    await ask("is the evidence chain verified?");

    expect(await screen.findByText(/chain verified/i)).toBeInTheDocument();
    expect(await screen.findByText("Sealed record")).toBeInTheDocument();
  });

  it("labels a verified generated answer distinctly from a record answer", async () => {
    await open(
      stub({
        status: "answered",
        answer: "The Manager approved the record and left the next action to a human.",
        citations: [
          { chunkId: "manager-decision", quote: "decision was approve", source: "manager.v1" },
        ],
      }),
    );

    await ask("what did the manager decide?");

    // A reader must never have to guess which tier answered.
    expect(await screen.findByText(/every quote verified/i)).toBeInTheDocument();
    expect(screen.queryByText("Sealed record")).toBeNull();
  });

  it("shows the verified quotes behind a generated answer", async () => {
    await open(
      stub({
        status: "answered",
        answer: "The Manager approved the record.",
        citations: [
          { chunkId: "manager-decision", quote: "decision was approve", source: "manager.v1" },
        ],
      }),
    );

    await ask("what did the manager decide?");

    expect(await screen.findByText("decision was approve")).toBeInTheDocument();
    expect(await screen.findByText("manager.v1")).toBeInTheDocument();
  });

  it("says why it fell back when the generated answer fails verification", async () => {
    await open(stub({ status: "refused", reason: "quote-not-found", evidence: [] }));

    await ask("what did the manager decide?");

    expect(await screen.findByText("Sealed record")).toBeInTheDocument();
    // A silent fallback would read as a fault rather than a deliberate rule.
    expect(await screen.findByText(/could not be verified against the record/i)).toBeInTheDocument();
  });

  it("shows retrieved passages when generation fails and the record has no composed answer", async () => {
    await open(
      stub({
        status: "refused",
        reason: "model-unavailable",
        evidence: [{ source: "gate-9 transcript", text: "Each stage verifies its predecessor hash." }],
      }),
    );

    await ask("what does the maker build");

    expect(await screen.findByText("Each stage verifies its predecessor hash.")).toBeInTheDocument();
  });

  it("refuses honestly when no tier can answer", async () => {
    await open(stub({ status: "refused", reason: "no-evidence", evidence: [] }));

    await ask("who will win the league");

    expect(await screen.findByText(/sealed decision record/i)).toBeInTheDocument();
    expect(screen.queryByText(/every quote verified/i)).toBeNull();
  });

  it("never shows a raw internal reason code to the reader", async () => {
    await open(stub({ status: "refused", reason: "leaked-digest", evidence: [] }));

    await ask("what did the manager decide?");

    await screen.findByText("Sealed record");
    expect(screen.queryByText(/leaked-digest/)).toBeNull();
  });

  it("reports that it is working while the model tier is being asked", async () => {
    let release: (value: AssistantResponse) => void = () => {};
    const pending = new Promise<AssistantResponse>((resolve) => {
      release = resolve;
    });
    await open({ ask: vi.fn().mockReturnValue(pending) });

    await ask("what did the manager decide?");

    expect(await screen.findByText(/Checking the sealed record/i)).toBeInTheDocument();
    release({ status: "refused", reason: "no-evidence", evidence: [] });
  });

  it("closes without losing the trigger", async () => {
    await open(null);

    fireEvent.click(await screen.findByRole("button", { name: /Close case assistant/i }));

    expect(await screen.findByRole("button", { name: /Ask this case/ })).toBeInTheDocument();
  });
});
