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
import { useEffect, useMemo, useState } from "react";

import { ProgressVeil, StateSwap, StaggerReveal } from "../../components/motion";
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

const launchStages = ["Validate account", "Bind live evidence", "Enforce approval"];

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

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="launch-backdrop"
      exit={{ opacity: 0 }}
      initial={{ opacity: 0 }}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <motion.section
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
              <button className="launch-runtime" disabled type="button">
                Runtime connection is the next slice
              </button>
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
          <h1>Protect revenue.<br />Prove value. Move early.</h1>
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
            <section className="account-command" aria-label="Selected account command">
              <div className="account-command__identity"><span className="account-monogram">{selected.display_name.slice(0, 1)}</span><div><small>{selected.sector}</small><h2>{selected.display_name}</h2><span>{selected.plan_tier} · {selected.region}</span></div></div>
              <dl>
                <div><dt>Priority</dt><dd data-tone={urgency(selected).tone}><i />{urgency(selected).label}</dd></div>
                <div><dt>Renewal</dt><dd>{daysUntil(selected.renewal_at)} days</dd></div>
                <div><dt>MRR</dt><dd>{money(selected.monthly_recurring_revenue, selected.contract_currency)}</dd></div>
                <div><dt>Evidence</dt><dd>{relativeFreshness(selected.source_updated_at)} fresh</dd></div>
              </dl>
              <button className="account-command__action" onClick={() => setLaunchOpen(true)} type="button">Start governed case <ArrowRight /></button>
            </section>

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
                  <li><span><Sparkles /></span><div><time>Next</time><strong>Agent runtime connection</strong><small>Five-stage governed run</small></div></li>
                </ol>
                <div className="system-strip">
                  <span><Check />Data live</span><span><Check />Consent bound</span><span><LoaderCircle />Runtime next</span>
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
