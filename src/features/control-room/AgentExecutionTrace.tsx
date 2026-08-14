import { Check, Circle, CircleAlert, Clock, LoaderCircle, LockKeyhole } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useMemo } from "react";

import {
  HOSTED_STAGE_ORDER,
  type HostedRun,
  type HostedStage,
} from "../../../runtime/hosted/contracts";
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
    if (run.status === "queued" && index === 0) {
      return { stage, index, label, state: "awaiting", detail: "No agent has started yet." };
    }
    return { stage, index, label, state: "pending", detail: "Queued behind earlier stages." };
  });

  return {
    stages,
    atHumanBoundary: run.status === "awaiting_human_approval",
    statusLine: statusLineFor(run),
  };
}

function statusLineFor(run: HostedRun): string {
  switch (run.status) {
    case "queued":
      return "Queued. Researcher is awaiting a hosted worker; no agent has started.";
    case "in_progress":
      return run.current_stage
        ? `In progress. ${STAGE_LABELS[run.current_stage]} is active.`
        : "In progress.";
    case "awaiting_human_approval":
      return "All five stages are sealed. The run is paused at the human approval boundary.";
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
  const { stages, atHumanBoundary, statusLine } = useMemo(() => deriveTrace(run), [run]);

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
        <div className="execution-trace__boundary" role="note">
          <LockKeyhole className="execution-trace__boundary-icon" aria-hidden="true" strokeWidth={2} />
          <span className="execution-trace__boundary-copy">
            Awaiting human approval. No further action without an operator decision.
          </span>
        </div>
      ) : null}
    </section>
  );
}
