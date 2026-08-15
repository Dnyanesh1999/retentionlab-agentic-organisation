import {
  Activity,
  ArrowRight,
  Check,
  CircleAlert,
  Database,
  LoaderCircle,
  LockKeyhole,
  Network,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  AnimatedNumber,
  LENIS_PREVENT,
  ProgressVeil,
  Spotlight,
  StateSwap,
  StaggerReveal,
  TextReveal,
} from "../../components/motion";
import type {
  HostedDecision,
  HostedRun,
  HostedRunDecisionContext,
  HostedRunEvent,
} from "../../../runtime/hosted/contracts";
import { AgentExecutionTrace } from "./AgentExecutionTrace";
import {
  createControlRoomClient,
  type AccountListResult,
  type AccountProbeResult,
  type ControlRoomAccount,
  type ControlRoomClient,
} from "./controlRoomClient";
import "./controlRoom.css";

type DirectoryState =
  | { status: "loading" }
  | { status: "ready"; result: AccountListResult }
  | { status: "error"; message: string };

type ProbeState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; result: AccountProbeResult }
  | { status: "error"; message: string };

type HostedRunState =
  | { status: "idle" }
  | { status: "creating" }
  | { status: "ready"; run: HostedRun; idempotentReplay: boolean }
  | { status: "error"; message: string };

const launchStages = ["Validate account", "Bind live evidence", "Enforce approval"];

const RATIONALE_MIN = 20;
const RATIONALE_MAX = 1_000;

type DecisionContextState =
  | { status: "loading" }
  | { status: "ready"; context: HostedRunDecisionContext }
  | { status: "error"; message: string };

type DecisionSubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "done"; decision: HostedDecision; replayed: boolean }
  | { status: "error"; message: string };

/**
 * The human decision boundary. It renders only for a run the service reports as awaiting approval,
 * and only records a decision for an authenticated operator against the exact sealed Manager hash it
 * displayed. Approving clears the case record for internal promotion; it sends nothing.
 */
function DecisionSheet({ run, client, onDecided }: {
  run: HostedRun;
  client: ControlRoomClient;
  onDecided(run: HostedRun): void;
}) {
  const [operator, setOperator] = useState(() => client.currentOperator());
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [signInState, setSignInState] = useState<{ status: "idle" | "working" } | { status: "error"; message: string }>({ status: "idle" });
  const [context, setContext] = useState<DecisionContextState>({ status: "loading" });
  const [rationale, setRationale] = useState("");
  const [pending, setPending] = useState<HostedDecision | null>(null);
  const [submit, setSubmit] = useState<DecisionSubmitState>({ status: "idle" });
  const idempotencyKey = useRef(`decision-${run.run_id}-${crypto.randomUUID()}`);
  // Decided is derived from the run the service returned, so a decision recorded in another session
  // reads correctly here too — the panel never claims an outcome the run does not carry.
  const decided = run.status === "approved" || run.status === "rejected" ? run.status : null;

  useEffect(() => {
    if (!operator || decided) return;
    const controller = new AbortController();
    void client.readDecisionContext(run.run_id, controller.signal).then(
      (result) => setContext({ status: "ready", context: result }),
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setContext({
            status: "error",
            message: error instanceof Error ? error.message : "Decision context unavailable.",
          });
        }
      },
    );
    return () => controller.abort();
  }, [client, decided, operator, run.run_id]);

  async function submitSignIn(event: React.FormEvent) {
    event.preventDefault();
    setSignInState({ status: "working" });
    try {
      setOperator(await client.signIn(credentials.email, credentials.password));
      setCredentials({ email: "", password: "" });
      setSignInState({ status: "idle" });
    } catch (error) {
      setSignInState({
        status: "error",
        message: error instanceof Error ? error.message : "Those operator credentials were not accepted.",
      });
    }
  }

  async function confirmDecision(decision: HostedDecision, managerHash: string) {
    setSubmit({ status: "submitting" });
    try {
      const result = await client.decideRun({
        run_id: run.run_id,
        expected_manager_artifact_sha256: managerHash,
        decision,
        rationale: rationale.trim(),
        idempotency_key: idempotencyKey.current,
      });
      setSubmit({ status: "done", decision, replayed: result.replayed });
      setPending(null);
      onDecided(result.run);
    } catch (error) {
      setSubmit({
        status: "error",
        message: error instanceof Error ? error.message : "The decision was not recorded.",
      });
      setPending(null);
    }
  }

  if (decided) {
    return (
      <section className="decision-sheet decision-sheet--done" aria-labelledby="decision-title" role="status">
        <header>
          <ShieldCheck aria-hidden="true" />
          <div>
            <h3 id="decision-title">
              {decided === "approved" ? "Case record approved" : "Case record rejected"}
            </h3>
            <span>
              {submit.status === "done" && submit.replayed
                ? "This decision was already recorded; nothing was appended twice. "
                : ""}
              No customer communication or other external action was taken.
            </span>
          </div>
        </header>
      </section>
    );
  }

  if (!operator) {
    return (
      <section className="decision-sheet decision-sheet--locked" aria-labelledby="decision-title">
        <header>
          <LockKeyhole aria-hidden="true" />
          <div>
            <h3 id="decision-title">Human decision required</h3>
            <span>Approval requires an authenticated operator. The publishable browser key is not authority to approve.</span>
          </div>
        </header>
        <form className="decision-signin" onSubmit={(event) => void submitSignIn(event)}>
          <label>
            <span>Operator email</span>
            <input
              autoComplete="username"
              onChange={(event) => setCredentials((current) => ({ ...current, email: event.target.value }))}
              required
              type="email"
              value={credentials.email}
            />
          </label>
          <label>
            <span>Password</span>
            <input
              autoComplete="current-password"
              onChange={(event) => setCredentials((current) => ({ ...current, password: event.target.value }))}
              required
              type="password"
              value={credentials.password}
            />
          </label>
          <button disabled={signInState.status === "working"} type="submit">
            {signInState.status === "working" ? "Verifying…" : "Sign in to decide"}
          </button>
          {signInState.status === "error" ? (
            <p className="decision-error" role="alert">{signInState.message}</p>
          ) : null}
        </form>
      </section>
    );
  }

  return (
    <section className="decision-sheet" aria-labelledby="decision-title">
      <header>
        <LockKeyhole aria-hidden="true" />
        <div>
          <h3 id="decision-title">Human decision required</h3>
          <span>Signed in as {operator.email ?? "authorised operator"}.</span>
        </div>
        <button className="decision-signout" onClick={() => void client.signOut().then(() => setOperator(null))} type="button">
          Sign out
        </button>
      </header>

      <StateSwap className="decision-sheet__state" state={context.status}>
        {context.status === "loading" ? (
          <div className="decision-loading" role="status"><LoaderCircle aria-hidden="true" />Loading the sealed decision context…</div>
        ) : null}
        {context.status === "error" ? (
          <div className="decision-error" role="alert"><CircleAlert aria-hidden="true" /><span>{context.message}</span></div>
        ) : null}
        {context.status === "ready" ? (
          <>
            <dl className="decision-facts">
              <div><dt>Sealed chain</dt><dd>{context.context.chain_verified ? "Verified" : "Not verified"}</dd></div>
              <div><dt>Consented channel</dt><dd>{context.context.consented_channel ?? "None recorded"}</dd></div>
              <div><dt>Permitted next action</dt><dd>{context.context.permitted_next_action.replaceAll("_", " ")}</dd></div>
              <div><dt>External actions</dt><dd>{context.context.external_actions_permitted}</dd></div>
            </dl>
            <p className="decision-hash">
              <span>Manager artefact</span>
              <code>{context.context.manager_artifact_sha256}</code>
            </p>
            <p className="decision-scope">
              Approving clears this sealed case record for internal portfolio promotion. It does not send,
              schedule or publish any customer communication.
            </p>

            <label className="decision-rationale">
              <span>Decision rationale (required)</span>
              <textarea
                maxLength={RATIONALE_MAX}
                minLength={RATIONALE_MIN}
                onChange={(event) => setRationale(event.target.value)}
                rows={3}
                value={rationale}
              />
              <small>{rationale.trim().length} / {RATIONALE_MAX} · minimum {RATIONALE_MIN}</small>
            </label>

            {pending ? (
              <div className="decision-confirm" role="alertdialog" aria-label="Confirm decision">
                <strong>
                  Record a {pending === "approve" ? "an approval" : "rejection"} for this case record?
                </strong>
                <span>This appends one permanent decision event and cannot be undone.</span>
                <div>
                  <button
                    className="decision-action decision-action--confirm"
                    disabled={submit.status === "submitting"}
                    onClick={() => void confirmDecision(pending, context.context.manager_artifact_sha256)}
                    type="button"
                  >
                    {submit.status === "submitting" ? "Recording…" : "Confirm decision"}
                  </button>
                  <button onClick={() => setPending(null)} type="button">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="decision-actions">
                <button
                  className="decision-action decision-action--approve"
                  disabled={rationale.trim().length < RATIONALE_MIN}
                  onClick={() => setPending("approve")}
                  type="button"
                >
                  <Check aria-hidden="true" />Approve case record
                </button>
                <button
                  className="decision-action decision-action--reject"
                  disabled={rationale.trim().length < RATIONALE_MIN}
                  onClick={() => setPending("reject")}
                  type="button"
                >
                  <X aria-hidden="true" />Reject
                </button>
              </div>
            )}

            {submit.status === "error" ? (
              <p className="decision-error" role="alert">{submit.message}</p>
            ) : null}
          </>
        ) : null}
      </StateSwap>
    </section>
  );
}

function runEventCopy(event: HostedRunEvent) {
  if (event.type === "run_created") return "Governed run accepted. No agent or external action has started yet.";
  if (event.type === "stage_started") return `${event.stage} started.`;
  if (event.type === "stage_completed") return event.public_summary;
  if (event.type === "run_paused_for_approval") return `${event.stage} paused the run for human approval.`;
  if (event.type === "run_approved" || event.type === "run_rejected") return event.public_summary;
  return event.reason;
}

function daysUntil(value: string) {
  return Math.max(0, Math.ceil((Date.parse(value) - Date.now()) / 86_400_000));
}

function urgency(account: ControlRoomAccount) {
  const days = daysUntil(account.renewal_at);
  if (days <= 45) return { label: "High", tone: "high" };
  if (days <= 90) return { label: "Elevated", tone: "elevated" };
  return { label: "Watch", tone: "watch" };
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function relativeFreshness(value: string) {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(value)) / 60_000));
  if (minutes < 60) return `${Math.max(1, minutes)}m`;
  if (minutes < 1_440) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 1_440)}d`;
}

function DirectorySkeleton() {
  return (
    <div className="control-skeleton" aria-label="Loading live account directory">
      <div className="control-skeleton__command" />
      {[0, 1, 2, 3, 4].map((item) => <div className="control-skeleton__row" key={item} />)}
    </div>
  );
}

function LaunchSheet({ account, client, onClose }: {
  account: ControlRoomAccount;
  client: ControlRoomClient;
  onClose(): void;
}) {
  const [probe, setProbe] = useState<ProbeState>({ status: "loading" });
  const [hostedRun, setHostedRun] = useState<HostedRunState>({ status: "idle" });
  const idempotencyKey = useRef(`control-${account.slug}-${crypto.randomUUID()}`);
  const activeRunId = hostedRun.status === "ready" && ["queued", "in_progress"].includes(hostedRun.run.status)
    ? hostedRun.run.run_id
    : null;

  useEffect(() => {
    const controller = new AbortController();
    void client.probeAccount(account.slug, controller.signal).then(
      (result) => setProbe({ status: "ready", result }),
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setProbe({ status: "error", message: error instanceof Error ? error.message : "Evidence probe failed." });
        }
      },
    );
    return () => controller.abort();
  }, [account.slug, client]);

  useEffect(() => {
    if (!activeRunId) return;
    const controller = new AbortController();
    const interval = window.setInterval(() => {
      void client.readRun(activeRunId, controller.signal).then(
        (run) => setHostedRun((current) => current.status === "ready" ? { ...current, run } : current),
        () => undefined,
      );
    }, 5_000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [activeRunId, client]);

  async function createHostedRun() {
    setHostedRun({ status: "creating" });
    try {
      const result = await client.createRun({
        account_slug: account.slug,
        objective: `Investigate retention risk for ${account.display_name} and prepare a governed recovery decision.`,
        idempotency_key: idempotencyKey.current,
      });
      setHostedRun({ status: "ready", run: result.run, idempotentReplay: result.idempotentReplay });
    } catch (error) {
      setHostedRun({ status: "error", message: error instanceof Error ? error.message : "Run creation failed." });
    }
  }

  async function retryHostedRun(runId: string) {
    try {
      const run = await client.retryRun(runId);
      setHostedRun({ status: "ready", run, idempotentReplay: true });
    } catch (error) {
      setHostedRun({ status: "error", message: error instanceof Error ? error.message : "Run retry failed." });
    }
  }

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="launch-backdrop"
      exit={{ opacity: 0 }}
      initial={{ opacity: 0 }}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <motion.section
        {...LENIS_PREVENT}
        aria-labelledby="launch-title"
        aria-modal="true"
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="launch-sheet"
        exit={{ opacity: 0, y: 20, scale: 0.985 }}
        initial={{ opacity: 0, y: 28, scale: 0.985 }}
        role="dialog"
      >
        <header className="launch-sheet__header">
          <div>
            <span>Governed run preview</span>
            <h2 id="launch-title">{account.display_name}</h2>
          </div>
          <button aria-label="Close run preview" className="icon-action" onClick={onClose} type="button"><X /></button>
        </header>

        <StateSwap className="launch-sheet__state" state={probe.status}>
          {probe.status === "loading" ? (
            <ProgressVeil activeStage={1} label="Preparing governed run" stages={launchStages} />
          ) : probe.status === "error" ? (
            <div className="launch-error">
              <CircleAlert aria-hidden="true" />
              <strong>Evidence binding stopped</strong>
              <span>{probe.message}</span>
              <button onClick={onClose} type="button">Close safely</button>
            </div>
          ) : probe.status === "ready" ? (
            <div className="launch-ready">
              <div className="launch-ready__seal"><ShieldCheck aria-hidden="true" /><span>Evidence bound</span></div>
              <dl>
                <div><dt>Live records</dt><dd>{probe.result.evidenceCount}</dd></div>
                <div><dt>Source</dt><dd>Supabase</dd></div>
                <div><dt>Approval</dt><dd>{probe.result.approvalBoundaryPresent ? "Required" : "Blocked"}</dd></div>
                <div><dt>Cache</dt><dd>No-store</dd></div>
              </dl>
              <div className="launch-chain" aria-label="Five agent run sequence">
                {["Researcher", "Designer", "Maker", "Communicator", "Manager"].map((stage, index) => (
                  <div key={stage}><span>{String(index + 1).padStart(2, "0")}</span><strong>{stage}</strong></div>
                ))}
              </div>
              <div className="launch-boundary">
                <LockKeyhole aria-hidden="true" />
                <div><strong>Human boundary intact</strong><span>No customer action can leave this run without approval.</span></div>
              </div>
              <StateSwap className="hosted-run-state" state={hostedRun.status}>
                {hostedRun.status === "idle" ? (
                  <button className="launch-runtime launch-runtime--active" onClick={() => void createHostedRun()} type="button">
                    Create hosted run <ArrowRight aria-hidden="true" />
                  </button>
                ) : null}
                {hostedRun.status === "creating" ? (
                  <div className="hosted-run-creating" role="status"><LoaderCircle aria-hidden="true" />Creating durable run record…</div>
                ) : null}
                {hostedRun.status === "error" ? (
                  <div className="hosted-run-error" role="alert">
                    <CircleAlert aria-hidden="true" /><span>{hostedRun.message}</span>
                    <button onClick={() => void createHostedRun()} type="button">Retry safely</button>
                  </div>
                ) : null}
                {hostedRun.status === "ready" ? (
                  <motion.section animate={{ opacity: 1, y: 0 }} className="hosted-run" initial={{ opacity: 0, y: 10 }}>
                    <header>
                      <div><span>Run {hostedRun.run.run_id.slice(0, 8)}</span><strong>{hostedRun.run.status === "queued" ? "Queued for hosted worker" : hostedRun.run.status.replaceAll("_", " ")}</strong></div>
                      <i aria-label="Live run status" data-status={hostedRun.run.status} />
                    </header>
                    <AgentExecutionTrace run={hostedRun.run} />
                    {hostedRun.run.status === "failed" ? (
                      <button className="hosted-run-retry" onClick={() => void retryHostedRun(hostedRun.run.run_id)} type="button">
                        Retry from sealed checkpoint <ArrowRight aria-hidden="true" />
                      </button>
                    ) : null}
                    {["awaiting_human_approval", "approved", "rejected"].includes(hostedRun.run.status) ? (
                      <DecisionSheet
                        client={client}
                        onDecided={(decided) =>
                          setHostedRun((current) => current.status === "ready" ? { ...current, run: decided } : current)}
                        run={hostedRun.run}
                      />
                    ) : null}
                    <ol aria-label="Run event stream">
                      {hostedRun.run.events.map((event) => (
                        <li key={event.sequence}>
                          <span>{String(event.sequence).padStart(2, "0")}</span>
                          <div><strong>{event.type.replaceAll("_", " ")}</strong><small>{runEventCopy(event)}</small></div>
                          <time>{new Date(event.occurred_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
                        </li>
                      ))}
                    </ol>
                    <footer><LockKeyhole aria-hidden="true" />External actions: 0 · human approval remains mandatory{hostedRun.idempotentReplay ? " · existing run resumed" : ""}</footer>
                  </motion.section>
                ) : null}
              </StateSwap>
            </div>
          ) : null}
        </StateSwap>
      </motion.section>
    </motion.div>
  );
}

export function CommandCenterView({ client: suppliedClient }: { client?: ControlRoomClient }) {
  const clientResult = useMemo(() => {
    try {
      return { client: suppliedClient ?? createControlRoomClient(), error: null };
    } catch (error) {
      return { client: null, error: error instanceof Error ? error.message : "Live configuration unavailable." };
    }
  }, [suppliedClient]);
  const [attempt, setAttempt] = useState(0);
  const [directory, setDirectory] = useState<DirectoryState>(() => clientResult.client
    ? { status: "loading" }
    : { status: "error", message: clientResult.error ?? "Live configuration unavailable." });
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [launchOpen, setLaunchOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    if (!clientResult.client) {
      return () => controller.abort();
    }
    void clientResult.client.listAccounts(controller.signal).then(
      (result) => {
        const sorted = [...result.accounts].sort((a, b) => daysUntil(a.renewal_at) - daysUntil(b.renewal_at));
        const next = { ...result, accounts: sorted };
        setDirectory({ status: "ready", result: next });
        setSelectedSlug((current) => current ?? sorted[0]?.slug ?? null);
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setDirectory({ status: "error", message: error instanceof Error ? error.message : "Live directory failed." });
        }
      },
    );
    return () => controller.abort();
  }, [attempt, clientResult]);

  const selected = directory.status === "ready"
    ? directory.result.accounts.find((account) => account.slug === selectedSlug) ?? directory.result.accounts[0]
    : undefined;

  return (
    <main className="control-room" id="main-content">
      <header className="control-room__hero">
        <div>
          <span className="control-room__date">Today · live organisation</span>
          <TextReveal as="h1" text={"Protect revenue.\nProve value. Move early."} />
        </div>
        <div className="readiness-line" aria-label="System readiness">
          <span><i />Live readiness</span>
          <span>Supabase <b>{directory.status === "ready" ? "operational" : directory.status}</b></span>
          <span>MCP <b>contract ready</b></span>
          <span>Approval <b>enforced</b></span>
        </div>
      </header>

      <StateSwap className="control-room__body" state={directory.status}>
        {directory.status === "loading" ? <DirectorySkeleton /> : null}
        {directory.status === "error" ? (
          <section className="control-room__error" role="alert">
            <CircleAlert aria-hidden="true" />
            <div><h2>Live directory unavailable</h2><span>{directory.message}</span></div>
            <button onClick={() => { setDirectory({ status: "loading" }); setAttempt((value) => value + 1); }} type="button"><RefreshCw />Retry</button>
          </section>
        ) : null}
        {directory.status === "ready" && selected ? (
          <>
            <Spotlight as="section" className="account-command" aria-label="Selected account command">
              <div className="account-command__identity"><span className="account-monogram">{selected.display_name.slice(0, 1)}</span><div><small>{selected.sector}</small><h2>{selected.display_name}</h2><span>{selected.plan_tier} · {selected.region}</span></div></div>
              <dl>
                <div><dt>Priority</dt><dd data-tone={urgency(selected).tone}><i />{urgency(selected).label}</dd></div>
                {/*
                  The figures count to their real values. `key` restarts the
                  count when the operator selects a different account, so the
                  number never appears to drift from one account's figure to
                  another's.
                */}
                <div><dt>Renewal</dt><dd><AnimatedNumber format={(value) => `${Math.round(value)} days`} key={`renewal-${selected.slug}`} value={daysUntil(selected.renewal_at)} /></dd></div>
                <div><dt>MRR</dt><dd><AnimatedNumber format={(value) => money(value, selected.contract_currency)} key={`mrr-${selected.slug}`} value={selected.monthly_recurring_revenue} /></dd></div>
                <div><dt>Evidence</dt><dd>{relativeFreshness(selected.source_updated_at)} fresh</dd></div>
              </dl>
              <button className="account-command__action" onClick={() => setLaunchOpen(true)} type="button">Start governed case <ArrowRight /></button>
            </Spotlight>

            <div className="control-room__grid">
              <section className="account-ledger" aria-labelledby="priority-accounts-title">
                <div className="section-heading"><div><h2 id="priority-accounts-title">Priority accounts</h2><span>{directory.result.accounts.length} live records · priority by renewal proximity</span></div><span className="source-stamp"><Database />No-store</span></div>
                <div className="account-ledger__columns" aria-hidden="true"><span>Account</span><span>Lifecycle</span><span>Renewal</span><span>Priority</span><span>Evidence</span></div>
                <StaggerReveal as="ol" className="account-ledger__list" trigger="mount">
                  {directory.result.accounts.map((account, index) => {
                    const selectedRow = account.slug === selected.slug;
                    const accountUrgency = urgency(account);
                    return (
                      <StaggerReveal.Item as="li" className="account-ledger__item" key={account.slug}>
                        <button aria-pressed={selectedRow} className={selectedRow ? "is-selected" : ""} onClick={() => setSelectedSlug(account.slug)} type="button">
                          <span className="account-ledger__rank">{String(index + 1).padStart(2, "0")}</span>
                          <span className="account-ledger__name"><strong>{account.display_name}</strong><small>{money(account.monthly_recurring_revenue, account.contract_currency)} MRR · {account.region}</small></span>
                          <span>{account.lifecycle_stage}</span>
                          <span>{daysUntil(account.renewal_at)} days</span>
                          <span className="priority-cue" data-tone={accountUrgency.tone}><i />{accountUrgency.label}</span>
                          <span>{relativeFreshness(account.source_updated_at)}</span>
                          <ArrowRight aria-hidden="true" />
                        </button>
                      </StaggerReveal.Item>
                    );
                  })}
                </StaggerReveal>
              </section>

              <aside className="operations-rail" aria-labelledby="operations-title">
                <div className="section-heading"><div><h2 id="operations-title">System activity</h2><span>Boundaries visible</span></div><Activity /></div>
                <ol>
                  <li><span><Database /></span><div><time>{relativeFreshness(directory.result.source.retrieved_at)} ago</time><strong>Account directory retrieved</strong><small>Supabase · no-store</small></div></li>
                  <li><span><Network /></span><div><time>Ready</time><strong>Evidence tools exposed</strong><small>MCP · read only</small></div></li>
                  <li><span><ShieldCheck /></span><div><time>Policy</time><strong>Human decision retained</strong><small>External actions · 0</small></div></li>
                  <li><span><Sparkles /></span><div><time>Live</time><strong>Hosted run intake online</strong><small>Durable IDs · truthful events</small></div></li>
                </ol>
                <div className="system-strip">
                  <span><Check />Data live</span><span><Check />Consent bound</span><span><Check />Run store live</span>
                </div>
              </aside>
            </div>
          </>
        ) : null}
      </StateSwap>

      <AnimatePresence>{launchOpen && selected && clientResult.client ? <LaunchSheet account={selected} client={clientResult.client} onClose={() => setLaunchOpen(false)} /> : null}</AnimatePresence>
    </main>
  );
}
