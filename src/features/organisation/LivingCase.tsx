import { DatabaseZap, GitCompareArrows, ShieldCheck } from "lucide-react";

import { gate9Run, humanizeStatus } from "./gate9Run";

const verifiedLinks = gate9Run.lineageLinks.filter((link) => link.verified).length;

export function LivingCase() {
  return (
    <section className="living-case" aria-labelledby="living-case-title">
      <span className="living-case__compass" aria-hidden="true">
        <svg viewBox="0 0 52 52">
          <path d="M26 2 30 20 45 11 32 24 50 26 32 30 41 45 28 32 26 50 22 32 7 41 20 28 2 26 20 22 11 7 24 20Z" />
        </svg>
      </span>
      <p>RetentionLab examined the Copper Finch case</p>
      <h2 id="living-case-title">through one accountable five-agent chain.</h2>
      <div className="living-case__rule" aria-hidden="true" />
      <dl>
        <div>
          <DatabaseZap aria-hidden="true" size={20} strokeWidth={1.5} />
          <dt>Account</dt>
          <dd>{gate9Run.accountSlug}</dd>
        </div>
        <div>
          <ShieldCheck aria-hidden="true" size={20} strokeWidth={1.5} />
          <dt>Run state</dt>
          <dd>{humanizeStatus(gate9Run.finalStatus)}</dd>
        </div>
        <div>
          <GitCompareArrows aria-hidden="true" size={20} strokeWidth={1.5} />
          <dt>Chain</dt>
          <dd>Verified · {verifiedLinks} links</dd>
        </div>
      </dl>
      <p className="living-case__snapshot">
        Immutable assessed-run snapshot · no live query is running
      </p>
    </section>
  );
}
