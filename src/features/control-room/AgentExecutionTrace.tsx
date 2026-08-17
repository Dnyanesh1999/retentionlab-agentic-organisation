import { Check, Circle, CircleAlert, Clock, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useMemo } from "react";

import {
  HOSTED_STAGE_ORDER,
  type HostedRun,
  type HostedStage,
} from "../../../runtime/hosted/contracts";
import { EventScrubber, type ScrubberEvent } from "../lineage/EventScrubber";
import type { StageId } from "../organisation/gate9Run";
import "./executionTrace.css";

// A truthful five-stage trace for a hosted run. Every claim it renders is derived only from the run's
// status, current_stage, and its append-only events — never invented. A stage is "sealed" solely when a
// stage_completed event names it, so a run that has advanced past a stage without emitting completion
// still shows that stage as unstarted rather than faking progress.

type StageState = "awaiting" | "active" | "sealed" | "failed" | "pending";

const STAGE_LABELS: Record<HostedStage, string> = {
  researcher: "Researcher",
  designer: "Designer",
  maker: "Maker",
  communicator: "Communicator",
  manager: "Manager",
};

const STATE_LABELS: Record<StageState, string> = {
  awaiting: "Awaiting hosted worker",
  active: "Working now",
  sealed: "Sealed",
  failed: "Failed",
  pending: "Not started",
};

const STATE_ICONS: Record<StageState, typeof Circle> = {
  awaiting: Clock,
  active: LoaderCircle,
  sealed: Check,
  failed: CircleAlert,
  pending: Circle,
};

interface StageView {
  stage: HostedStage;
  index: number;
  label: string;
  state: StageState;
  detail: string;
}

interface DerivedTrace {
  stages: StageView[];
  atHumanBoundary: boolean;
  decisionSummary: string | null;
  statusLine: string;
}

function deriveTrace(run: HostedRun): DerivedTrace {
  // Stages sealed strictly by stage_completed events, with their outward summary.
  const sealedSummary = new Map<HostedStage, string>();
  let failedStage: HostedStage | null = null;
  let failureReason = "";
  for (const event of run.events) {
    if (event.type === "stage_completed") sealedSummary.set(event.stage, event.public_summary);
    if (event.type === "run_failed") {
      failedStage = event.stage;
      failureReason = event.reason;
    }
  }
  const nextQueuedStage = HOSTED_STAGE_ORDER.find((stage) => !sealedSummary.has(stage)) ?? null;

  const stages = HOSTED_STAGE_ORDER.map((stage, index): StageView => {
    const label = STAGE_LABELS[stage];
    if (sealedSummary.has(stage)) {
      return { stage, index, label, state: "sealed", detail: sealedSummary.get(stage)! };
    }
    if (run.status === "failed" && failedStage === stage) {
      return { stage, index, label, state: "failed", detail: failureReason };
    }
    if (run.status === "in_progress" && run.current_stage === stage) {
      return { stage, index, label, state: "active", detail: "Executing under governance." };
    }
    if (run.status === "queued" && stage === nextQueuedStage) {
      return {
        stage,
        index,
        label,
        state: "awaiting",
        detail: sealedSummary.size === 0 ? "No agent has started yet." : "Ready for the next protected worker.",
      };
    }
    return { stage, index, label, state: "pending", detail: "Queued behind earlier stages." };
  });

  // The decision summary comes from the recorded decision event, never from the run status alone, so
  // the note can only appear once a human decision is actually on the event stream.
  const decisionEvent = run.events.find(
    (event) => event.type === "run_approved" || event.type === "run_rejected",
  );

  return {
    stages,
    atHumanBoundary: run.status === "awaiting_human_approval",
    decisionSummary: decisionEvent && "public_summary" in decisionEvent
      ? decisionEvent.public_summary
      : null,
    statusLine: statusLineFor(run, nextQueuedStage, sealedSummary.size),
  };
}

function statusLineFor(run: HostedRun, nextQueuedStage: HostedStage | null, sealedCount: number): string {
  switch (run.status) {
    case "queued":
      if (!nextQueuedStage) return "All recorded stages are sealed.";
      return sealedCount === 0
        ? "Queued. Researcher is awaiting a hosted worker; no agent has started."
        : `${STAGE_LABELS[nextQueuedStage]} is queued. ${sealedCount} of 5 stages sealed from recorded events.`;
    case "in_progress":
      return run.current_stage
        ? `In progress. ${STAGE_LABELS[run.current_stage]} is active.`
        : "In progress.";
    case "awaiting_human_approval":
      return "All five stages are sealed. The run is paused at the human approval boundary.";
    case "approved":
      return `An authenticated operator approved this case record. ${sealedCount} of 5 stages sealed; no customer action was sent.`;
    case "rejected":
      return "An authenticated operator rejected this case record. No customer action was sent.";
    case "failed":
      return "The run failed and stopped.";
  }
}

export interface AgentExecutionTraceProps {
  run: HostedRun;
  className?: string;
}

export function AgentExecutionTrace({ run, className }: AgentExecutionTraceProps) {
  const reduceMotion = useReducedMotion();
  const { stages, atHumanBoundary, decisionSummary, statusLine } = useMemo(() => deriveTrace(run), [run]);

  const rootClassName = className
    ? `execution-trace ${className}`
    : "execution-trace";

  return (
    <section className={rootClassName} aria-label="Agent execution trace" data-status={run.status}>
      <header className="execution-trace__header">
        <div className="execution-trace__signal" aria-hidden="true">
          <span /><span /><span /><span />
        </div>
        <div>
          <span className="execution-trace__eyebrow">Live execution</span>
          <p className="execution-trace__status" role="status" aria-live="polite">
            {statusLine}
          </p>
        </div>
      </header>
      <ol className="execution-trace__stages">
        {stages.map((view) => {
          const Icon = STATE_ICONS[view.state];
          const spin = view.state === "active" && !reduceMotion;
          return (
            <motion.li
              key={view.stage}
              className={`execution-trace__stage execution-trace__stage--${view.state}`}
              aria-current={view.state === "active" ? "step" : undefined}
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.28, delay: view.index * 0.05 }}
            >
              <span className="execution-trace__marker" aria-hidden="true">
                <motion.span
                  className="execution-trace__icon"
                  animate={spin ? { rotate: 360 } : { rotate: 0 }}
                  transition={spin ? { duration: 1.1, repeat: Infinity, ease: "linear" } : { duration: 0 }}
                >
                  <Icon className="execution-trace__glyph" strokeWidth={2} />
                </motion.span>
              </span>
              <span className="execution-trace__body">
                <span className="execution-trace__heading">
                  <span className="execution-trace__name">{view.label}</span>
                  <span className="execution-trace__state">{STATE_LABELS[view.state]}</span>
                </span>
                <span className="execution-trace__detail">{view.detail}</span>
              </span>
            </motion.li>
          );
        })}
      </ol>
      {atHumanBoundary ? (
        <div className="execution-trace__boundary boundary-beam" role="note">
          <LockKeyhole className="execution-trace__boundary-icon" aria-hidden="true" strokeWidth={2} />
          <span className="execution-trace__boundary-copy">
            Awaiting human approval. No further action without an operator decision.
          </span>
        </div>
      ) : null}
      {decisionSummary ? (
        <div className="execution-trace__boundary boundary-beam" role="note">
          <ShieldCheck className="execution-trace__boundary-icon" aria-hidden="true" strokeWidth={2} />
          <span className="execution-trace__boundary-copy">{decisionSummary}</span>
        </div>
      ) : null}

      {/*
        The same stream the case record shows, for a live run. Failures stay in
        it: a run that failed and was retried should read that way here too,
        not only once it is archived.
      */}
      <EventScrubber
        description="Every event the service recorded for this run, in order."
        events={scrubberEvents(run)}
        title="Recorded events"
      />
    </section>
  );
}

/**
 * Map the public run projection onto what the scrubber needs.
 *
 * The projection carries no artefact identities by design, so no hash is
 * supplied and the scrubber omits that row rather than showing a stand-in.
 */
function scrubberEvents(run: HostedRun): ScrubberEvent[] {
  return [...run.events]
    .sort((first, second) => first.sequence - second.sequence)
    .map((event) => ({
      seq: event.sequence,
      type: event.type,
      stage: "stage" in event && event.stage ? (event.stage as StageId) : null,
      note: "reason" in event && event.reason
        ? event.reason
        : ("public_summary" in event && event.public_summary ? event.public_summary : null),
      occurredAt: event.occurred_at,
    }));
}
