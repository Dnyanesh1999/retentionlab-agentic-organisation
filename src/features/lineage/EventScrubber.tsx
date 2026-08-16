/**
 * EventScrubber — play back the append-only stream, failures included.
 *
 * The run's history is its strongest evidence and its least visible: the case
 * showed "14 immutable events" as a number, and the Communicator's first attempt
 * failing on a claim it could not support was recorded but never surfaced. This
 * lets a reader move through the stream one event at a time and watch the run
 * fail and recover, which is the honest shape of the work.
 *
 * Three rules keep it evidence rather than animation:
 *
 * - it only ever shows recorded events, in recorded order, and never
 *   interpolates a state between two of them;
 * - nothing plays on its own, because a timeline that advances by itself
 *   invents a pace the run did not have — the reader moves it;
 * - a failure is styled as a failure at every position, never smoothed over on
 *   the way to the successful retry.
 *
 * The control is a native range input, so keyboard support, the full gesture
 * set and assistive-technology semantics are the platform's rather than
 * re-implemented here.
 */
import { useId, useState } from "react";

import { stageLabel, type StageId } from "../organisation/gate9Run";

import "./scrubber.css";

const FAILURE_TYPES = new Set(["stage_failed", "run_failed"]);
const RECOVERY_TYPES = new Set(["failed_stage_retry_requested", "run_retried"]);

/**
 * What the scrubber needs from an event, whichever run it came from.
 *
 * `hash` is optional on purpose. The committed assessed transcript carries the
 * event chain, but the hosted public projection deliberately does not send
 * identities to the browser — so a live run has no hash to show, and the
 * component omits the row rather than displaying a placeholder that would read
 * as a real one.
 */
export type ScrubberEvent = {
  seq: number;
  type: string;
  stage: StageId | null;
  version?: number | null;
  note?: string | null;
  occurredAt: string;
  hash?: string | null;
};

export type EventScrubberProps = {
  events: ReadonlyArray<ScrubberEvent>;
  /** Heading for the region. */
  title?: string;
  /** One line under the heading. */
  description?: string;
};

function eventTone(event: ScrubberEvent) {
  if (FAILURE_TYPES.has(event.type)) return "failure";
  if (RECOVERY_TYPES.has(event.type)) return "recovery";
  return "normal";
}

/** "stage_completed" → "Stage completed". Types are recorded, not translated. */
function humanEventType(type: string) {
  const spaced = type.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function timeOf(iso: string) {
  return `${iso.slice(11, 19)} UTC`;
}

export function EventScrubber({
  events,
  title = "Event stream",
  description = "Every recorded event, in order. Nothing has been removed.",
}: EventScrubberProps) {
  const [index, setIndex] = useState(events.length - 1);
  const titleId = useId();
  const sliderId = useId();

  if (events.length === 0) {
    return (
      <section aria-labelledby={titleId} className="event-scrubber">
        <header className="section-heading">
          <div><h2 id={titleId}>{title}</h2></div>
        </header>
        <p className="event-scrubber__empty">No events have been recorded for this run yet.</p>
      </section>
    );
  }

  const position = Math.min(index, events.length - 1);
  const current = events[position];
  const failuresSoFar = events.slice(0, position + 1).filter((event) => FAILURE_TYPES.has(event.type));

  return (
    <section aria-labelledby={titleId} className="event-scrubber">
      <header className="section-heading">
        <div>
          <h2 id={titleId}>{title}</h2>
          <p>{description}</p>
        </div>
        <span>{position + 1} of {events.length}</span>
      </header>

      {/*
        The ticks are a readable summary of the whole stream — a failure is
        visible before the reader scrubs to it, which is the point.
      */}
      <ol aria-hidden="true" className="event-scrubber__ticks">
        {events.map((event, tickIndex) => (
          <li
            className={`event-tick is-${eventTone(event)}${tickIndex === position ? " is-current" : ""}${tickIndex < position ? " is-past" : ""}`}
            key={event.seq}
          />
        ))}
      </ol>

      <label className="sr-only" htmlFor={sliderId}>
        Move through the recorded events
      </label>
      <input
        aria-valuetext={`Event ${current.seq}: ${humanEventType(current.type)}${current.stage ? `, ${stageLabel(current.stage)}` : ""}`}
        className="event-scrubber__range"
        id={sliderId}
        max={events.length - 1}
        min={0}
        onChange={(changeEvent) => setIndex(Number(changeEvent.target.value))}
        step={1}
        type="range"
        value={position}
      />

      <div aria-live="polite" className={`event-scrubber__readout is-${eventTone(current)}`}>
        <p className="event-scrubber__type">
          <span className="event-scrubber__seq">{String(current.seq).padStart(2, "0")}</span>
          {humanEventType(current.type)}
          {current.stage ? <em>{stageLabel(current.stage)}{current.version ? ` · v${current.version}` : ""}</em> : null}
        </p>
        {current.note ? <p className="event-scrubber__note">{current.note}</p> : null}
        <dl className="event-scrubber__meta">
          <div><dt>Recorded</dt><dd>{timeOf(current.occurredAt)}</dd></div>
          {current.hash ? (
            <div><dt>Event hash</dt><dd>{current.hash.slice(0, 10)}…</dd></div>
          ) : null}
          <div>
            <dt>Failures so far</dt>
            <dd>{failuresSoFar.length}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
