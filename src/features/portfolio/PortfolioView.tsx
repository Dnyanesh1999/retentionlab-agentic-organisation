import { useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Braces,
  Check,
  CircleUserRound,
  Database,
  ExternalLink,
  FileCheck2,
  GitBranch,
  Globe,
  Hammer,
  Megaphone,
  Network,
  Orbit,
  PenTool,
  Search,
  ShieldCheck,
  Sparkles,
  TestTube2,
} from "lucide-react";

import { HashLink } from "../../components/HashLink";

type Stage = {
  id: string;
  number: string;
  role: string;
  name: string;
  verb: string;
  summary: string;
  output: string;
  icon: LucideIcon;
};

const stages: readonly Stage[] = [
  {
    id: "researcher",
    number: "01",
    role: "Researcher",
    name: "Nia Calder",
    verb: "Investigate",
    summary: "Queries live, allow-listed evidence and separates observed facts from uncertainty.",
    output: "ResearchBrief",
    icon: Search,
  },
  {
    id: "designer",
    number: "02",
    role: "Designer",
    name: "Luca Moretti",
    verb: "Interpret",
    summary: "Turns verified risk evidence into a consent-aware recovery experience specification.",
    output: "RecoveryDesignSpecification",
    icon: PenTool,
  },
  {
    id: "maker",
    number: "03",
    role: "Maker",
    name: "Noor Patel",
    verb: "Build",
    summary: "Creates the functional Signal Garden artefact while preserving evidence lineage.",
    output: "RecoveryRoomArtefact",
    icon: Hammer,
  },
  {
    id: "communicator",
    number: "04",
    role: "Communicator",
    name: "Maeve Quinn",
    verb: "Communicate",
    summary: "Drafts bounded, consent-safe outreach without sending or scheduling anything.",
    output: "CommunicationPlan",
    icon: Megaphone,
  },
  {
    id: "manager",
    number: "05",
    role: "Manager",
    name: "Elias Grant",
    verb: "Govern",
    summary: "Checks the complete chain, records a decision and stops at the human approval boundary.",
    output: "ManagerOperationalDecision",
    icon: CircleUserRound,
  },
] as const;

const evidenceSources = [
  { label: "Product", copy: "Usage, adoption and active-user signals show what changed.", icon: Orbit },
  { label: "Billing", copy: "Invoices, payments and renewal context show what is at risk.", icon: FileCheck2 },
  { label: "Support", copy: "Cases, severity and sentiment show what the customer experienced.", icon: Network },
  { label: "Consent", copy: "Preferences and lawful basis define what the organisation may do.", icon: ShieldCheck },
] as const;

const architecture = [
  { label: "Supabase Postgres + Edge Functions", copy: "Canonical synthetic evidence and public live query boundary.", icon: Database },
  { label: "MCP evidence tools", copy: "Seven allow-listed tools with retrieval time and source provenance.", icon: GitBranch },
  { label: "Five typed agent runtimes", copy: "Strict Zod contracts preserve identity, evidence and predecessor hashes.", icon: Braces },
  { label: "OpenRouter", copy: "Server-side model routing; deterministic validation remains runtime-owned.", icon: Sparkles },
  { label: "Immutable transcript", copy: "JSONL events and SHA-256 links make every handoff replayable and auditable.", icon: FileCheck2 },
  { label: "GitHub Pages experience", copy: "A transparent public case record plus a live Signal Garden.", icon: Globe },
] as const;

const proof = [
  ["335+", "regression and accessibility tests passing"],
  ["5 / 5", "required server and browser preflight variables satisfied"],
  ["7", "verified SHA-256 lineage links in the accepted run"],
  ["0", "autonomous external actions permitted"],
] as const;

const stack = [
  ["React 19 + Vite", "Accessible, responsive product interface", Orbit],
  ["TypeScript + Zod", "Compile-time types and strict runtime contracts", Braces],
  ["Supabase", "Postgres evidence and Edge Functions", Database],
  ["Model Context Protocol", "Standardised evidence tools", GitBranch],
  ["OpenRouter", "Free-model routing behind server boundaries", Sparkles],
  ["Vitest + axe", "Functional, adversarial and accessibility tests", TestTube2],
  ["GitHub Pages", "Public, transparent portfolio deployment", Globe],
] as const;

function ProductFrame() {
  const highlighted = stages[1];
  const HighlightIcon = highlighted.icon;

  return (
    <div className="portfolio-product" aria-label="RetentionLab five-agent product preview">
      <div className="portfolio-product__topline">
        <div>
          <strong>Copper Finch retention case</strong>
          <span>Immutable assessed snapshot</span>
        </div>
        <span className="portfolio-product__decision">
          <Check aria-hidden="true" size={13} />
          Awaiting human approval
        </span>
      </div>

      <div className="portfolio-product__body">
        <div className="portfolio-product__orbit" aria-hidden="true">
          <span className="portfolio-product__orbit-line" />
          <div className="portfolio-product__case">
            <Orbit size={24} />
            <small>Accepted case</small>
            <strong>One accountable recovery chain.</strong>
            <span>5 stages · 7 verified links</span>
          </div>
          {stages.map((stage, index) => {
            const Icon = stage.icon;
            return (
              <div className={`portfolio-product__agent portfolio-product__agent--${index + 1}`} key={stage.id}>
                <span>{stage.number}</span>
                <Icon size={18} />
                <small>{stage.role}</small>
              </div>
            );
          })}
        </div>

        <aside className="portfolio-product__inspector">
          <div className="portfolio-product__inspector-head">
            <span><HighlightIcon aria-hidden="true" size={19} /></span>
            <div>
              <strong>{highlighted.role}</strong>
              <small>{highlighted.name} · active handoff</small>
            </div>
            <em>2 of 5</em>
          </div>
          <dl>
            <div>
              <dt>Receives</dt>
              <dd>Verified research brief and cited evidence</dd>
            </div>
            <div>
              <dt>Produces</dt>
              <dd>{highlighted.output}</dd>
            </div>
            <div>
              <dt>Boundary</dt>
              <dd>No send, publish or data mutation</dd>
            </div>
          </dl>
          <span className="portfolio-product__verified">
            <ShieldCheck aria-hidden="true" size={14} />
            Contract and predecessor hash verified
          </span>
        </aside>
      </div>
    </div>
  );
}

function StageLineage() {
  const [selectedId, setSelectedId] = useState(stages[0].id);
  const selected = stages.find((stage) => stage.id === selectedId) ?? stages[0];

  return (
    <div className="portfolio-lineage">
      <div className="portfolio-lineage__rail" role="list" aria-label="Five-agent handoff">
        {stages.map((stage, index) => {
          const Icon = stage.icon;
          const active = selected.id === stage.id;
          return (
            <div className="portfolio-lineage__item" role="listitem" key={stage.id}>
              <button
                aria-pressed={active}
                className={active ? "is-active" : undefined}
                onClick={() => setSelectedId(stage.id)}
                type="button"
              >
                <span>{stage.number}</span>
                <Icon aria-hidden="true" size={23} />
                <strong>{stage.role}</strong>
                <small>{stage.name}</small>
                <em>{stage.verb}</em>
              </button>
              {index < stages.length - 1 ? <ArrowRight aria-hidden="true" className="portfolio-lineage__arrow" size={20} /> : null}
            </div>
          );
        })}
        <div className="portfolio-lineage__human" aria-label="Human approval gate" role="listitem">
          <ShieldCheck aria-hidden="true" size={25} />
          <strong>Human</strong>
          <small>approval gate</small>
        </div>
      </div>

      <div className="portfolio-lineage__detail" aria-live="polite">
        <div>
          <span>{selected.number}</span>
          <p>{selected.role} · {selected.name}</p>
        </div>
        <strong>{selected.summary}</strong>
        <p>Typed output: <code>{selected.output}</code></p>
      </div>
    </div>
  );
}

export function PortfolioView() {
  const architectureRef = useRef<HTMLElement>(null);

  function revealArchitecture() {
    architectureRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    architectureRef.current?.focus({ preventScroll: true });
  }

  return (
    <main className="portfolio-case" id="main-content">
      <section className="portfolio-hero" aria-labelledby="portfolio-title">
        <div className="portfolio-hero__copy">
          <h1 id="portfolio-title">A five-agent organisation for consent-first customer retention.</h1>
          <p>
            RetentionLab turns live product, billing, support and consent evidence into one governed
            recovery experience—without allowing an agent to act outside the human approval boundary.
          </p>
          <div className="portfolio-hero__actions">
            <HashLink className="portfolio-button portfolio-button--primary" to="/cases/organisation">
              Explore the live case
              <ArrowRight aria-hidden="true" size={18} />
            </HashLink>
            <HashLink className="portfolio-button portfolio-button--secondary" to="/cases/recovery-room">
              Open the Signal Garden
              <ExternalLink aria-hidden="true" size={16} />
            </HashLink>
          </div>
        </div>
        <ProductFrame />
      </section>

      <section className="portfolio-problem" aria-labelledby="portfolio-problem-title">
        <div>
          <h2 id="portfolio-problem-title">Retention work breaks when evidence and action drift apart.</h2>
          <p>
            Teams lose customers not because they lack data, but because the right evidence does not reach
            the right decision at the right time. Fragmented signals, unclear ownership and ungoverned actions
            create blind spots—and risk.
          </p>
        </div>
        <ul className="portfolio-evidence">
          {evidenceSources.map(({ copy, icon: Icon, label }) => (
            <li key={label}>
              <Icon aria-hidden="true" size={24} />
              <div><strong>{label}</strong><span>{copy}</span></div>
            </li>
          ))}
        </ul>
      </section>

      <section className="portfolio-agents" aria-labelledby="portfolio-agents-title">
        <h2 id="portfolio-agents-title">One case. Five specialists. One accountable handoff.</h2>
        <p>Select a specialist to inspect what they contribute to the chain.</p>
        <StageLineage />
        <div className="portfolio-boundary"><ShieldCheck aria-hidden="true" size={17} />No agent can act outside the approval boundary.</div>
      </section>

      <section className="portfolio-architecture" ref={architectureRef} tabIndex={-1} aria-labelledby="portfolio-architecture-title">
        <h2 id="portfolio-architecture-title">Live evidence in. Traceable artefacts out.</h2>
        <div className="portfolio-architecture__flow">
          {architecture.map(({ copy, icon: Icon, label }, index) => (
            <div className="portfolio-architecture__step" key={label}>
              <Icon aria-hidden="true" size={29} />
              <strong>{label}</strong>
              <span>{copy}</span>
              {index < architecture.length - 1 ? <ArrowRight aria-hidden="true" className="portfolio-architecture__arrow" size={20} /> : null}
            </div>
          ))}
        </div>
        <div className="portfolio-guardrails">
          <ShieldCheck aria-hidden="true" size={18} />
          <span>No cached fallback</span>
          <span>Autonomous external actions: false</span>
        </div>
      </section>

      <section className="portfolio-proof" aria-labelledby="portfolio-proof-title">
        <h2 id="portfolio-proof-title">Built like a production system, assessed like an argument.</h2>
        <dl>
          {proof.map(([value, label]) => (
            <div key={label}><dt>{value}</dt><dd>{label}</dd></div>
          ))}
        </dl>
      </section>

      <section className="portfolio-stack" aria-labelledby="portfolio-stack-title">
        <h2 id="portfolio-stack-title">What the project demonstrates.</h2>
        <ul>
          {stack.map(([label, copy, Icon]) => (
            <li key={label}>
              <Icon aria-hidden="true" size={23} />
              <strong>{label}</strong>
              <span>{copy}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="portfolio-closing" aria-labelledby="portfolio-closing-title">
        <div>
          <h2 id="portfolio-closing-title">From final project to portfolio proof.</h2>
          <p>This case shows how coordinated specialists, governed by consent and evidence, turn risk into recovery—without taking the wheel.</p>
        </div>
        <HashLink className="portfolio-button portfolio-button--primary" to="/cases/organisation">
          Walk through the organisation
          <ArrowRight aria-hidden="true" size={18} />
        </HashLink>
        <button className="portfolio-text-link" onClick={revealArchitecture} type="button">
          Read the technical story
          <ExternalLink aria-hidden="true" size={15} />
        </button>
      </section>
    </main>
  );
}
