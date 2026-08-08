import type { LucideIcon } from "lucide-react";
import {
  CircleCheck,
  Fingerprint,
  GitCommitVertical,
  Link2,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { gate9Run, humanizeStatus, shortHash, stageLabel, type StageEvidence } from "./gate9Run";
import { useInspectorScroll } from "./inspectorScroll";

type AgentInspectorProps = {
  stage: StageEvidence;
  icon: LucideIcon;
};

function formatTimestamp(iso: string): string {
  return `${iso.slice(0, 10)} · ${iso.slice(11, 16)} UTC`;
}

export function AgentInspector({ stage, icon: Icon }: AgentInspectorProps) {
  const reducedMotion = useReducedMotion();
  const sectionMotion = reducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: -8 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: 8 },
        transition: { duration: 0.2 },
      };

  const { ref: scrollRef, onKeyDown: onScrollKeyDown, progress, hasOverflow, atTop, atBottom, thumbSize } =
    useInspectorScroll<HTMLDivElement>(stage.id);
  const thumbPct = thumbSize * 100;
  const thumbTopPct = progress * (100 - thumbPct);

  return (
    <aside className="agent-inspector" aria-label={`${stage.agentName} details`}>
      <div
        className="agent-inspector__scroll"
        ref={scrollRef}
        onKeyDown={onScrollKeyDown}
        tabIndex={0}
        role="region"
        aria-label={`${stage.agentName} evidence detail`}
      >
        <AnimatePresence mode="wait">
          <motion.div className="agent-inspector__content" key={stage.id} {...sectionMotion}>
            <header className="agent-inspector__header">
              <span className="agent-inspector__icon">
                <Icon aria-hidden="true" size={26} strokeWidth={1.55} />
              </span>
              <div>
                <h2>{stage.agentName}</h2>
                <p>{stage.personality}</p>
              </div>
              <span className="agent-inspector__step">Stage {stage.stage} of 5</span>
            </header>

            <div className="inspector-badges">
              <span className="inspector-badge inspector-badge--status">
                v{stage.version} · {humanizeStatus(stage.statusLabel)}
              </span>
              <span className="inspector-badge">{formatTimestamp(stage.producedAt)}</span>
            </div>

            <section className="inspector-section">
              <ScrollText aria-hidden="true" />
              <div>
                <h3>Cumulative transformation</h3>
                <p>{stage.transformation}</p>
              </div>
            </section>

            <StageDetailSection stage={stage} />

            {stage.recovery ? <RecoverySection stage={stage} /> : null}

            {stage.detail.kind === "manager" ? <GovernanceSection /> : null}

            <section className="inspector-section">
              <Sparkles aria-hidden="true" />
              <div>
                <h3>Model & prompt provenance</h3>
                <dl className="provenance-list">
                  <div>
                    <dt>Resolved model</dt>
                    <dd>{stage.provenance.resolvedModel}</dd>
                  </div>
                  <div>
                    <dt>Requested model</dt>
                    <dd>{stage.provenance.requestedModel}</dd>
                  </div>
                  <div>
                    <dt>Prompt version</dt>
                    <dd>{stage.provenance.promptVersion}</dd>
                  </div>
                </dl>
              </div>
            </section>

            <section className="inspector-section">
              <Fingerprint aria-hidden="true" />
              <div>
                <h3>Immutable hash lineage</h3>
                <p className="inspector-hash">
                  <span className="inspector-hash__label">SHA-256</span>
                  <code title={stage.sha256}>{shortHash(stage.sha256)}</code>
                </p>
                {stage.lineage.length ? (
                  <ul className="lineage-list">
                    {stage.lineage.map((link) => (
                      <li key={`${link.from}-${link.to}`}>
                        <Link2 aria-hidden="true" size={13} />
                        <span>
                          {stageLabel(link.from)} → {stageLabel(link.to)}
                        </span>
                        <code title={link.sha256}>{shortHash(link.sha256)}</code>
                        <em className={link.verified ? "is-verified" : "is-unverified"}>
                          {link.verified ? "verified" : "unverified"}
                        </em>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="lineage-empty">First stage in the chain — no predecessor to verify.</p>
                )}
              </div>
            </section>

            <div className="inspector-status" role="status">
              <ShieldCheck aria-hidden="true" size={17} />
              No external action — sealed for a named human decision · autonomous external actions:{" "}
              {gate9Run.managerOutcome.autonomousExternalActions ? "true" : "false"}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div
        className="agent-inspector__rail"
        data-active={hasOverflow ? "true" : "false"}
        aria-hidden="true"
      >
        <span
          className="agent-inspector__thumb"
          style={{ height: `${thumbPct}%`, top: `${thumbTopPct}%` }}
        />
      </div>
      <div
        className="agent-inspector__edge agent-inspector__edge--top"
        data-visible={hasOverflow && !atTop ? "true" : "false"}
        aria-hidden="true"
      />
      <div
        className="agent-inspector__edge agent-inspector__edge--bottom"
        data-visible={hasOverflow && !atBottom ? "true" : "false"}
        aria-hidden="true"
      />
    </aside>
  );
}

function StageDetailSection({ stage }: { stage: StageEvidence }) {
  const { detail } = stage;

  switch (detail.kind) {
    case "researcher":
      return (
        <section className="inspector-section">
          <CircleCheck aria-hidden="true" />
          <div>
            <h3>Cited observations</h3>
            <p className="inspector-lede">{detail.summary}</p>
            <ul className="evidence-list">
              {detail.observations.map((observation) => (
                <li key={observation.evidenceKey}>
                  <p>{observation.claim}</p>
                  <span className="evidence-meta">
                    <em data-significance={observation.significance}>{observation.significance}</em>
                    <code>{observation.evidenceKey}</code>
                    <small>
                      {observation.sourceTool} · {observation.sourceSystem}
                    </small>
                  </span>
                </li>
              ))}
            </ul>
            <p className="inspector-note">
              Consent channels: {detail.allowedChannels.join(", ")} · sources retrieved with no-store:{" "}
              {detail.allSourcesNoStore ? "true" : "false"}
            </p>
          </div>
        </section>
      );
    case "designer":
      return (
        <section className="inspector-section">
          <CircleCheck aria-hidden="true" />
          <div>
            <h3>Experience principles</h3>
            <p className="inspector-lede">{detail.promise}</p>
            <ul className="detail-list">
              {detail.principles.map((principle) => (
                <li key={principle.name}>
                  <strong>{principle.name}</strong>
                  <span>{principle.rationale}</span>
                </li>
              ))}
            </ul>
            <p className="inspector-note">
              Journey: {detail.journey.map((step) => step.title).join(" → ")}
            </p>
          </div>
        </section>
      );
    case "maker":
      return (
        <section className="inspector-section">
          <CircleCheck aria-hidden="true" />
          <div>
            <h3>Built regions & claims</h3>
            <p className="inspector-lede">{detail.summary}</p>
            <ul className="detail-list">
              {detail.supportedClaims.map((claim) => (
                <li key={claim.claim}>
                  <strong>{claim.claim}</strong>
                  <span>{claim.qualification}</span>
                </li>
              ))}
            </ul>
            <p className="inspector-note inspector-note--commit">
              <GitCommitVertical aria-hidden="true" size={13} />
              commit {detail.commitSha} · {detail.route} · {detail.implementedStates.length} states ·{" "}
              {detail.testCount} tests
            </p>
          </div>
        </section>
      );
    case "communicator":
      return (
        <section className="inspector-section">
          <CircleCheck aria-hidden="true" />
          <div>
            <h3>Sourced message claims</h3>
            <p className="inspector-lede">“{detail.emailSubject}”</p>
            <ul className="evidence-list">
              {detail.messageClaims.map((claim) => (
                <li key={claim.message}>
                  <p>{claim.message}</p>
                  <span className="evidence-meta">
                    <em>{claim.qualification}</em>
                    {claim.evidenceKeys.map((key) => (
                      <code key={key}>{key}</code>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
            <p className="inspector-note">{detail.dataBoundary}</p>
          </div>
        </section>
      );
    case "manager":
      return (
        <section className="inspector-section">
          <CircleCheck aria-hidden="true" />
          <div>
            <h3>Trust evaluation</h3>
            <p className="inspector-lede">{detail.executiveSummary}</p>
            <ul className="trust-list">
              {detail.trustEvaluation.map((check) => (
                <li key={check.key}>
                  <span className="trust-list__status" data-status={check.status}>
                    {check.status}
                  </span>
                  <strong>{check.label}</strong>
                  <span className="trust-list__finding">{check.finding}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      );
    default:
      return null;
  }
}

function RecoverySection({ stage }: { stage: StageEvidence }) {
  const { recovery } = stage;
  if (!recovery) return null;

  return (
    <section className="inspector-section recovery-section" aria-label="Failed-stage recovery">
      <RefreshCw aria-hidden="true" />
      <div>
        <h3>Failed-stage recovery</h3>
        <ol className="recovery-timeline">
          <li className="recovery-timeline__step recovery-timeline__step--failed">
            <span className="recovery-timeline__marker">
              <TriangleAlert aria-hidden="true" size={13} />
            </span>
            <div>
              <strong>{stageLabel(recovery.stage)} v{recovery.failedVersion} failed</strong>
              <p>{recovery.failureError}</p>
            </div>
          </li>
          <li className="recovery-timeline__step recovery-timeline__step--retry">
            <span className="recovery-timeline__marker">
              <RefreshCw aria-hidden="true" size={13} />
            </span>
            <div>
              <strong>Named operator retry</strong>
              <p>{recovery.operatorReason}</p>
            </div>
          </li>
          <li className="recovery-timeline__step recovery-timeline__step--success">
            <span className="recovery-timeline__marker">
              <CircleCheck aria-hidden="true" size={13} />
            </span>
            <div>
              <strong>{stageLabel(recovery.stage)} v{recovery.rerunVersion} succeeded</strong>
              <p>Re-ran cleanly and passed to the Manager. The original failure stays on the record.</p>
            </div>
          </li>
        </ol>
      </div>
    </section>
  );
}

function GovernanceSection() {
  const { managerOutcome, governanceBoundaries, humanReviewFocus } = gate9Run;
  const facts = [
    { label: "Decision", value: managerOutcome.decision },
    { label: "Chain verified", value: managerOutcome.chainVerified ? "true" : "false" },
    { label: "Permitted next action", value: humanizeStatus(managerOutcome.permittedNextAction) },
    {
      label: "Autonomous external actions",
      value: managerOutcome.autonomousExternalActions ? "true" : "false",
    },
  ] as const;

  return (
    <section className="inspector-section governance-section" aria-label="Governance">
      <ShieldCheck aria-hidden="true" />
      <div>
        <h3>Governance</h3>
        <dl className="governance-grid">
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
        <h4 className="governance-subhead">Human must review</h4>
        <ul className="governance-focus">
          {humanReviewFocus.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <h4 className="governance-subhead">Standing boundaries</h4>
        <ul className="governance-boundaries">
          {governanceBoundaries.map((boundary) => (
            <li key={boundary}>{boundary}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
