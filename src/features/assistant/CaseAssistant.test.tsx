import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CaseAssistant } from "./CaseAssistant";

/**
 * Open the panel. The trigger and the panel are swapped through `StateSwap`,
 * which animates, so everything after this must be awaited.
 */
async function open() {
  render(<CaseAssistant />);
  fireEvent.click(screen.getByRole("button", { name: /Ask this case/ }));
  return screen.findByLabelText("Ask this case");
}

async function ask(question: string) {
  fireEvent.change(screen.getByLabelText(/Ask a question about this sealed case record/i), {
    target: { value: question },
  });
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));
}

describe("CaseAssistant", () => {
  it("states plainly that answers are not a live model call", async () => {
    await open();

    expect(await screen.findByText(/sealed assessed record/i)).toBeInTheDocument();
  });

  it("answers a typed question from the sealed record", async () => {
    await open();

    await ask("is the evidence chain verified?");

    expect(await screen.findByText(/chain verified/i)).toBeInTheDocument();
  });

  it("shows provenance beside every answer, so a reader can tell where it came from", async () => {
    await open();

    fireEvent.click(await screen.findByRole("button", { name: "What did the Manager decide?" }));

    // This label is what will later distinguish a record answer from a
    // model-generated one. It must accompany the answer, not replace it.
    expect(await screen.findByText("Sealed record")).toBeInTheDocument();
  });

  it("gives an honest notice instead of an answer when nothing matches", async () => {
    await open();

    await ask("who will win the league");

    expect(await screen.findByText(/answers only from the sealed decision record/i)).toBeInTheDocument();
    expect(screen.queryByText("Sealed record")).toBeNull();
  });

  it("closes without losing the trigger", async () => {
    await open();

    fireEvent.click(await screen.findByRole("button", { name: /Close case assistant/i }));

    expect(await screen.findByRole("button", { name: /Ask this case/ })).toBeInTheDocument();
  });
});
