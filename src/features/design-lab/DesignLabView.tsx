import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  FileCheck2,
  Fingerprint,
  Hammer,
  Megaphone,
  MessageSquareText,
  PenTool,
  Search,
  ShieldCheck,
  Sparkles,
  UserRoundCog,
  X,
} from "lucide-react";

import { BrandMark } from "../../components/BrandMark";
import { HashLink } from "../../components/HashLink";
import {
  ProgressVeil,
  SharedIndicator,
  StaggerReveal,
  StateSwap,
  TextReveal,
} from "../../components/motion";
import {
  createControlRoomClient,
  type ControlRoomClient,
} from "../control-room/controlRoomClient";
import type { PromotedCase } from "../../../runtime/hosted/contracts";
import {
  gate9Run,
  humanizeStatus,
  stageLabel,
  type StageEvidence,
  type StageId,
} from "../organisation/gate9Run";
import "./designLab.css";

type PreviewScreen = "archive" | "case";
type PreviewState = "ready" | "loading" | "error";
type CaseSection = "overview" | "workstream" | "experience" | "decision";

const stageIcons: Record<StageId, LucideIcon> = {
  researcher: Search,
  designer: PenTool,
  maker: Hammer,
  communicator: Megaphone,
  manager: UserRoundCog,
};

const caseSections: ReadonlyArray<{ id: CaseSection; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "workstream", label: "Workstream" },
  { id: "experience", label: "Experience" },
  { id: "decision", label: "Decision" },
];

const questionAnswers = {
  "Why is this account at risk?":
    "Product adoption and active-user counts declined while a medium-severity support case remained open. The Researcher preserved each claim with its source reference.",
  "Can the organisation contact the customer?":
    "Not autonomously. Email is an allowed channel, but the sealed Manager record requires a named human to approve the next action.",
  "What should the manager review?": gate9Run.humanReviewFocus.join(" "),
} as const;

type Question = keyof typeof questionAnswers;

type StageBrief = {
  headline: string;
  description: string;
  measures: ReadonlyArray<{ key?: string; value?: string; label: string }>;
};

const stageBriefs: Record<StageId, StageBrief> = {
  researcher: {
    headline: "Evidence became a focused recovery brief.",
    description: "Customer signals were distilled into priorities the next specialist could act on—with every observation still traceable.",
    measures: [
      { key: "observations", label: "cited observations" },
      { key: "priority_outcomes", label: "priority outcomes" },
      { key: "success_signals", label: "success signals" },
    ],
  },
  designer: {
    headline: "Research became a buildable recovery journey.",
    description: "The evidence handoff was shaped into a coherent experience system, ready for implementation without losing its research lineage.",
    measures: [
      { key: "experience_principles", label: "experience principles" },
      { key: "journey_steps", label: "journey steps" },
      { key: "reusable_components", label: "reusable components" },
    ],
  },
  maker: {
    headline: "The recovery concept became a working product.",
    description: "The approved design was realised as an evidence-backed experience with explicit states, claims and implementation boundaries.",
    measures: [
      { key: "regions", label: "experience regions" },
      { key: "supported_claims", label: "supported claims" },
      { key: "implemented_states", label: "implemented states" },
    ],
  },
  communicator: {
    headline: "Product evidence became a restrained invitation.",
    description: "Only supported claims entered the customer message, preserving consent and keeping the communication view-only.",
    measures: [
      { key: "message_claims", label: "sourced claims" },
      { key: "available_channels", label: "consented channel" },
      { value: "View-only", label: "interaction boundary" },
    ],
  },
  manager: {
    headline: "The chain stopped at accountable judgment.",
    description: "The complete specialist record passed review, but the organisation preserved the final decision for a named human.",
    measures: [
      { key: "assessed_stages", label: "stages assessed" },
      { key: "human_review_focus", label: "review priorities" },
      { value: "Human", label: "approval authority" },
    ],
  },
};

function statusCopy(stage: StageEvidence) {
  return `${stageLabel(stage.id)} complete · v${stage.version}`;
}

function producedAtCopy(iso: string) {
  return `${iso.slice(0, 10)} · ${iso.slice(11, 16)} UTC`;
}

type PromotedCaseState =
  | { status: "loading" }
  | { status: "ready"; cases: PromotedCase[] }
  | { status: "error"; message: string };

/**
 * Approved live cases. A case is listed only because a human approved it and the service promoted it;
 * this component invents nothing and shows an honest empty state until that has actually happened.
 */
function ApprovedCaseRegister({ client: suppliedClient }: { client?: ControlRoomClient }) {
  const clientResult = useMemo(() => {
    try {
      return suppliedClient ?? createControlRoomClient();
    } catch {
      return null;
    }
  }, [suppliedClient]);
  const [state, setState] = useState<PromotedCaseState>(() => clientResult
    ? { status: "loading" }
    : { status: "error", message: "Live case configuration is unavailable." });

  useEffect(() => {
    if (!clientResult) return;
    const controller = new AbortController();
    void clientResult.listPromotedCases(controller.signal).then(
      (cases) => setState({ status: "ready", cases }),
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "Approved cases are unavailable.",
          });
        }
      },
    );
    return () => controller.abort();
  }, [clientResult]);

  return (
    <section className="archive-register" aria-labelledby="approved-register-title">
      <div className="archive-register__heading">
        <h2 id="approved-register-title">Approved live cases</h2>
        <p>A live run appears here only after an authenticated operator approved its sealed record.</p>
      </div>

      <StateSwap className="approved-register__state" state={state.status}>
        {state.status === "loading" ? (
          <p className="approved-register__note" role="status">Loading approved cases…</p>
        ) : null}
        {state.status === "error" ? (
          <p className="approved-register__note approved-register__note--error" role="alert">{state.message}</p>
        ) : null}
        {state.status === "ready" && state.cases.length === 0 ? (
          <p className="approved-register__note">
            No live run has been approved yet. Decisions are recorded in the Control Room.
          </p>
        ) : null}
        {state.status === "ready" && state.cases.length > 0 ? (
          <ul className="approved-register__list">
            {state.cases.map((promoted) => (
              <li key={promoted.run_id}>
                <HashLink className="archive-case" to={`/cases/approved/${promoted.run_id}`}>
                  <span className="archive-case__mark"><ShieldCheck aria-hidden="true" /></span>
                  <span className="archive-case__identity">
                    <strong>{promoted.account_display_name}</strong>
                    <small>{promoted.objective}</small>
                  </span>
                  <span className="archive-case__measure">
                    <small>Workstream</small>
                    <strong>{promoted.stage_summaries.length} of 5 stages sealed</strong>
                  </span>
                  <span className="archive-case__measure">
                    <small>Decision state</small>
                    <strong>Approved · {promoted.external_actions_permitted} external actions</strong>
                  </span>
                  <span className="archive-case__open">
                    Open record <ArrowRight aria-hidden="true" size={17} />
                  </span>
                </HashLink>
              </li>
            ))}
          </ul>
        ) : null}
      </StateSwap>
    </section>
  );
}

/**
 * One approved case, rendered from the same bounded public projection as the archive list. There is
 * no second, richer source: if a fact is not in that projection, this screen does not show it.
 */
export function ApprovedCaseScreen({ runId, client: suppliedClient }: {
  runId: string;
  client?: ControlRoomClient;
}) {
  const clientResult = useMemo(() => {
    try {
      return suppliedClient ?? createControlRoomClient();
    } catch {
      return null;
    }
  }, [suppliedClient]);
  const [state, setState] = useState<PromotedCaseState>(() => clientResult
    ? { status: "loading" }
    : { status: "error", message: "Live case configuration is unavailable." });

  useEffect(() => {
    if (!clientResult) return;
    const controller = new AbortController();
    void clientResult.listPromotedCases(controller.signal).then(
      (cases) => setState({ status: "ready", cases }),
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "This approved case is unavailable.",
          });
        }
      },
    );
    return () => controller.abort();
  }, [clientResult]);

  const promoted = state.status === "ready"
    ? state.cases.find((entry) => entry.run_id === runId)
    : undefined;

  return (
    <main className="lab-content lab-archive" id="main-content">
      <header className="lab-page-heading">
        <div>
          <p>Approved live case</p>
          <h1>{promoted?.account_display_name ?? "Approved case"}</h1>
        </div>
        <HashLink className="approved-case__back" to="/portfolio">
          <ArrowLeft aria-hidden="true" size={15} /> Case archive
        </HashLink>
      </header>

      <StateSwap className="approved-case__state" state={state.status}>
        {state.status === "loading" ? (
          <p className="approved-register__note" role="status">Loading the approved record…</p>
        ) : null}
        {state.status === "error" ? (
          <p className="approved-register__note approved-register__note--error" role="alert">{state.message}</p>
        ) : null}
        {state.status === "ready" && !promoted ? (
          <p className="approved-register__note" role="status">
            No approved case matches this link. It may not have been approved yet.
          </p>
        ) : null}
        {promoted ? (
          <section className="approved-case" aria-label="Approved case record">
            <dl className="approved-case__facts">
              <div><dt>Objective</dt><dd>{promoted.objective}</dd></div>
              <div><dt>Approved</dt><dd>{new Date(promoted.approved_at).toLocaleString()}</dd></div>
              <div><dt>External actions</dt><dd>{promoted.external_actions_permitted}</dd></div>
            </dl>
            <ol className="approved-case__stages" aria-label="Sealed stage summaries">
              {promoted.stage_summaries.map((entry, index) => (
                <li key={entry.stage}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div><strong>{stageLabel(entry.stage)}</strong><small>{entry.public_summary}</small></div>
                </li>
              ))}
            </ol>
            <p className="approved-case__boundary">
              <ShieldCheck aria-hidden="true" size={15} />
              A human approved this record for internal promotion. No customer communication or other
              external action was taken.
            </p>
          </section>
        ) : null}
      </StateSwap>
    </main>
  );
}

export function CaseArchiveScreen({ onOpenCase, client }: {
  onOpenCase: () => void;
  client?: ControlRoomClient;
}) {
  return (
    <main className="lab-content lab-archive" id="main-content">
      <header className="lab-page-heading">
        <div>
          <p>Governed customer recovery records</p>
          <TextReveal as="h1" text="Case archive" />
        </div>
        <span className="lab-count">1 assessed case</span>
      </header>

      <section className="archive-register" aria-labelledby="archive-register-title">
        <div className="archive-register__heading">
          <h2 id="archive-register-title">Assessed records</h2>
          <p>A case appears here only after every specialist handoff has been sealed.</p>
        </div>

        <button className="archive-case" onClick={onOpenCase} type="button">
          <span className="archive-case__mark"><FileCheck2 aria-hidden="true" /></span>
          <span className="archive-case__identity">
            <strong>Copper Finch</strong>
            <small>Retention recovery · assessed Gate 9 run</small>
          </span>
          <span className="archive-case__measure">
            <small>Workstream</small>
            <strong>5 of 5 stages sealed</strong>
          </span>
          <span className="archive-case__measure">
            <small>Decision state</small>
            <strong>{humanizeStatus(gate9Run.finalStatus)}</strong>
          </span>
          <span className="archive-case__open">
            Open record <ArrowRight aria-hidden="true" size={17} />
          </span>
        </button>
      </section>

      <ApprovedCaseRegister client={client} />

      <aside className="archive-principle">
        <ShieldCheck aria-hidden="true" />
        <div>
          <strong>Archive rule</strong>
          <p>Evidence, prompt provenance and predecessor hashes stay attached to the case without dominating the everyday view.</p>
        </div>
      </aside>
    </main>
  );
}

function StageLedger({ selectedId, onSelect }: { selectedId: StageId; onSelect: (id: StageId) => void }) {
  return (
    <section className="case-ledger" aria-labelledby="case-ledger-title">
      <header className="section-heading">
        <div>
          <h2 id="case-ledger-title">Handoff ledger</h2>
          <p>Five bounded specialists transformed one evidence record into a governed decision.</p>
        </div>
        <span><Check aria-hidden="true" size={14} /> Chain verified</span>
      </header>

      <StaggerReveal as="ol" className="ledger-list" trigger="mount" aria-label="Five specialist handoffs">
        {gate9Run.stages.map((stage) => {
          const Icon = stageIcons[stage.id];
          const brief = stageBriefs[stage.id];
          const active = selectedId === stage.id;
          const detailId = `ledger-${stage.id}-contribution`;
          return (
            <StaggerReveal.Item as="li" className={`ledger-stage${active ? " is-active" : ""}`} key={stage.id}>
              <button aria-controls={detailId} aria-expanded={active} onClick={() => onSelect(stage.id)} type="button">
                <span className="ledger-stage__number">0{stage.stage}</span>
                <span className="ledger-stage__icon"><Icon aria-hidden="true" size={18} /></span>
                <span className="ledger-stage__name">
                  <strong>{stageLabel(stage.id)}</strong>
                  <small>{stage.agentName}</small>
                </span>
                <span className="ledger-stage__status">{statusCopy(stage)}</span>
                <ChevronDown aria-hidden="true" className="ledger-stage__chevron" size={17} />
              </button>

              <div aria-hidden={active ? undefined : "true"} className="ledger-stage__drawer" data-open={active ? "true" : "false"} id={detailId}>
                <div className="ledger-stage__drawer-clip">
                  <div className="ledger-stage__drawer-content">
                    <div className="ledger-stage__drawer-heading">
                      <span>{stageLabel(stage.id)} contribution</span>
                      <em><FileCheck2 aria-hidden="true" size={14} /> Sealed output</em>
                    </div>
                    <div className="stage-brief">
                      <div className="stage-brief__statement">
                        <span>Transformation outcome</span>
                        <h3>{brief.headline}</h3>
                        <p>{brief.description}</p>
                      </div>
                      <dl className="stage-brief__measures" aria-label={`${stageLabel(stage.id)} outcome measures`}>
                        {brief.measures.map((measure) => (
                          <div key={measure.label}>
                            <dd>{measure.value ?? stage.metrics[measure.key ?? ""]}</dd>
                            <dt>{measure.label}</dt>
                          </div>
                        ))}
                      </dl>
                    </div>
                    <dl className="stage-brief__provenance">
                      <div><dt>Version</dt><dd>v{stage.version} · {humanizeStatus(stage.statusLabel)}</dd></div>
                      <div><dt><Fingerprint aria-hidden="true" size={13} /> Lineage</dt><dd>{stage.lineage.length ? `${stage.lineage.length} verified links` : "Origin record"}</dd></div>
                      <div><dt><Clock3 aria-hidden="true" size={13} /> Produced</dt><dd>{producedAtCopy(stage.producedAt)}</dd></div>
                    </dl>
                  </div>
                </div>
              </div>
            </StaggerReveal.Item>
          );
        })}
      </StaggerReveal>
    </section>
  );
}

function ExperiencePanel() {
  const designer = gate9Run.stages.find((stage) => stage.id === "designer");
  const maker = gate9Run.stages.find((stage) => stage.id === "maker");
  const design = designer?.detail.kind === "designer" ? designer.detail : null;
  const build = maker?.detail.kind === "maker" ? maker.detail : null;

  return (
    <section className="case-section-panel" aria-labelledby="experience-title">
      <header className="section-heading">
        <div><h2 id="experience-title">Recovery experience</h2><p>The designed promise and the working artefact stay connected.</p></div>
      </header>
      <blockquote>{design?.promise}</blockquote>
      <div className="experience-columns">
        <div><span>Experience principles</span><strong>{design?.principles.map((item) => item.name).join(" · ")}</strong></div>
        <div><span>Implemented states</span><strong>{build?.implementedStates.join(" · ")}</strong></div>
      </div>
      <HashLink className="case-section-action" to="/cases/recovery-room">
        Open the live Signal Garden <ArrowRight aria-hidden="true" size={16} />
      </HashLink>
    </section>
  );
}

function DecisionPanel() {
  return (
    <section className="case-section-panel" aria-labelledby="decision-title">
      <header className="section-heading">
        <div><h2 id="decision-title">Manager decision</h2><p>The organisation stops where accountable human judgment begins.</p></div>
      </header>
      <div className="decision-statement"><ShieldCheck aria-hidden="true" /><div><span>Permitted next action</span><strong>{humanizeStatus(gate9Run.managerOutcome.permittedNextAction)}</strong></div></div>
      <ol className="review-list">
        {gate9Run.humanReviewFocus.map((item) => <li key={item}>{item}</li>)}
      </ol>
    </section>
  );
}

export function CaseRecordScreen({ onBack }: { onBack: () => void }) {
  const [section, setSection] = useState<CaseSection>("overview");
  const [selectedId, setSelectedId] = useState<StageId>("researcher");
  const selectedSection = useMemo(() => {
    if (section === "experience") return <ExperiencePanel />;
    if (section === "decision") return <DecisionPanel />;
    return <StageLedger onSelect={setSelectedId} selectedId={selectedId} />;
  }, [section, selectedId]);

  return (
    <main className="lab-content lab-case" id="main-content">
      <button className="lab-back" onClick={onBack} type="button"><ArrowLeft aria-hidden="true" size={16} /> Case archive</button>
      <header className="casebook-heading">
        <div>
          <p>Copper Finch · retention recovery</p>
          <TextReveal as="h1" text="An accountable path from risk signal to human decision." />
        </div>
        <span className="casebook-status"><ShieldCheck aria-hidden="true" size={16} /> Awaiting human approval</span>
      </header>

      <nav className="casebook-tabs" aria-label="Case record sections">
        {caseSections.map((item) => (
          <button aria-current={section === item.id ? "page" : undefined} className={section === item.id ? "is-active" : undefined} key={item.id} onClick={() => setSection(item.id)} type="button">
            {item.label}
            {/* One shared indicator that travels between tabs — see AppMasthead. */}
            {section === item.id ? (
              <SharedIndicator className="casebook-tabs__indicator" layoutId="casebook-tab-indicator" />
            ) : null}
          </button>
        ))}
      </nav>

      <div className="casebook-grid">
        <StateSwap className="casebook-main" state={section}>{selectedSection}</StateSwap>
        <aside className="decision-rail" aria-label="Case decision summary">
          <div className="decision-rail__top"><span>Current boundary</span><ShieldCheck aria-hidden="true" size={19} /></div>
          <strong>Human approval required</strong>
          <p>All five specialist artefacts are complete. No communication has been sent.</p>
          <dl>
            <div><dt>Stages</dt><dd>5 / 5 sealed</dd></div>
            <div><dt>Lineage</dt><dd>{gate9Run.lineageLinks.length} verified links</dd></div>
            <div><dt>External actions</dt><dd>0 permitted</dd></div>
          </dl>
          <details>
            <summary>Technical record</summary>
            <p>{gate9Run.eventCount} immutable events · run {gate9Run.runId.slice(0, 8)}…</p>
          </details>
        </aside>
      </div>
    </main>
  );
}

export function CaseAssistant() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState<Question | null>(null);

  return (
    <div className={`case-assistant${open ? " is-open" : ""}`}>
      <StateSwap className="case-assistant__swap" state={open ? "open" : "closed"} live="off">
        {open ? (
          <section className="case-assistant__panel" aria-label="Ask this case">
            <header><span><Bot aria-hidden="true" size={18} /> Ask this case</span><button aria-label="Close case assistant" onClick={() => setOpen(false)} type="button"><X aria-hidden="true" size={18} /></button></header>
            <p>Answers come from the sealed assessed record—not a live model call.</p>
            <div className="case-assistant__questions">
              {(Object.keys(questionAnswers) as Question[]).map((item) => <button aria-pressed={question === item} key={item} onClick={() => setQuestion(item)} type="button">{item}</button>)}
            </div>
            <StateSwap className="case-assistant__answer" state={question ?? "empty"}>
              {question ? <p><Sparkles aria-hidden="true" size={15} />{questionAnswers[question]}</p> : <p><MessageSquareText aria-hidden="true" size={15} />Choose a question to inspect the case record.</p>}
            </StateSwap>
          </section>
        ) : (
          <button className="case-assistant__trigger" onClick={() => setOpen(true)} type="button"><MessageSquareText aria-hidden="true" size={18} /> Ask this case</button>
        )}
      </StateSwap>
    </div>
  );
}

function PreviewError({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="lab-state" id="main-content">
      <CircleAlert aria-hidden="true" />
      <h1>The assessed record could not be opened.</h1>
      <p>No cached case was substituted. Retry when the verified source is available.</p>
      <button onClick={onRetry} type="button">Retry verified record</button>
    </main>
  );
}

export function DesignLabView() {
  const [screen, setScreen] = useState<PreviewScreen>("case");
  const [previewState, setPreviewState] = useState<PreviewState>("ready");

  return (
    <div className="design-lab">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <div className="lab-preview-bar" aria-label="Design preview controls">
        <span>Design preview</span>
        <div>
          {(["ready", "loading", "error"] as const).map((state) => <button aria-pressed={previewState === state} key={state} onClick={() => setPreviewState(state)} type="button">{state}</button>)}
        </div>
      </div>
      <header className="lab-masthead">
        <button className="lab-brand" onClick={() => { setScreen("archive"); setPreviewState("ready"); }} type="button"><BrandMark /><span>RetentionLab</span></button>
        <nav aria-label="Design lab primary navigation">
          <button className={screen === "archive" ? "is-active" : undefined} onClick={() => setScreen("archive")} type="button">Case archive</button>
          <button className={screen === "case" ? "is-active" : undefined} onClick={() => setScreen("case")} type="button">Active case</button>
        </nav>
        {previewState === "ready" && screen === "case" ? <span aria-hidden="true" /> : <span className="lab-system-state"><span /> System ready</span>}
      </header>

      {previewState === "ready" && screen === "case" ? <CaseAssistant /> : null}

      <StateSwap state={previewState}>
        {previewState === "loading" ? (
          <main className="lab-state" id="main-content"><ProgressVeil activeStage="contracts" label="Opening verified case" stages={[{ id: "evidence", label: "Verify evidence" }, { id: "contracts", label: "Validate contracts" }, { id: "record", label: "Open case record" }]} /></main>
        ) : previewState === "error" ? (
          <PreviewError onRetry={() => setPreviewState("ready")} />
        ) : screen === "archive" ? (
          <CaseArchiveScreen onOpenCase={() => setScreen("case")} />
        ) : (
          <CaseRecordScreen onBack={() => setScreen("archive")} />
        )}
      </StateSwap>
    </div>
  );
}
