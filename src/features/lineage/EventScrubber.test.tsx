import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EventScrubber } from "./EventScrubber";
import { gate9Run } from "../organisation/gate9Run";

function scrubTo(index: number) {
  fireEvent.change(screen.getByLabelText(/Move through the recorded events/i), {
    target: { value: String(index) },
  });
}

describe("EventScrubber", () => {
  it("starts at the last recorded event and counts the whole stream", () => {
    render(<EventScrubber events={gate9Run.events} />);

    const slider = screen.getByLabelText(/Move through the recorded events/i);

    expect(slider).toHaveValue(String(gate9Run.events.length - 1));
    expect(screen.getByText(`${gate9Run.events.length} of ${gate9Run.events.length}`)).toBeInTheDocument();
  });

  it("surfaces the recorded failure rather than skipping past it", () => {
    // The assessed run really did fail at the Communicator's first attempt. If
    // this stops finding one, the stream has been filtered somewhere upstream.
    const failure = gate9Run.events.find((event) => event.type === "stage_failed");
    expect(failure).toBeDefined();

    render(<EventScrubber events={gate9Run.events} />);
    scrubTo(gate9Run.events.indexOf(failure!));

    expect(screen.getByText("Stage failed")).toBeInTheDocument();
    expect(screen.getByText(failure!.note!)).toBeInTheDocument();
  });

  it("counts failures up to the scrub position, not the whole run", () => {
    render(<EventScrubber events={gate9Run.events} />);

    scrubTo(0);
    const atStart = screen.getByText("Failures so far").parentElement;
    expect(atStart).toHaveTextContent("0");

    scrubTo(gate9Run.events.length - 1);
    const atEnd = screen.getByText("Failures so far").parentElement;
    const total = gate9Run.events.filter((event) => event.type === "stage_failed").length;
    expect(atEnd).toHaveTextContent(String(total));
  });

  it("shows each event's own place in the hash chain, truncated", () => {
    render(<EventScrubber events={gate9Run.events} />);
    scrubTo(0);

    const first = gate9Run.events[0];

    expect(screen.getByText(`${first.hash.slice(0, 10)}…`)).toBeInTheDocument();
    // The full hash is never printed, here or anywhere else in the interface.
    expect(screen.queryByText(first.hash)).toBeNull();
  });

  it("describes the current event for assistive technology", () => {
    render(<EventScrubber events={gate9Run.events} />);
    scrubTo(0);

    expect(screen.getByLabelText(/Move through the recorded events/i))
      .toHaveAttribute("aria-valuetext", expect.stringContaining("Run started"));
  });

  it("says so honestly when a run has no events yet", () => {
    render(<EventScrubber events={[]} />);

    expect(screen.getByText(/No events have been recorded/i)).toBeInTheDocument();
    expect(screen.queryByRole("slider")).toBeNull();
  });
});
