import { DatabaseZap, ShieldCheck } from "lucide-react";

export function LivingCase() {
  return (
    <section className="living-case" aria-labelledby="living-case-title">
      <span className="living-case__compass" aria-hidden="true">
        <svg viewBox="0 0 52 52">
          <path d="M26 2 30 20 45 11 32 24 50 26 32 30 41 45 28 32 26 50 22 32 7 41 20 28 2 26 20 22 11 7 24 20Z" />
        </svg>
      </span>
      <p>RetentionLab is ready to examine</p>
      <h2 id="living-case-title">a live customer case through one accountable chain.</h2>
      <div className="living-case__rule" aria-hidden="true" />
      <dl>
        <div>
          <DatabaseZap aria-hidden="true" size={20} strokeWidth={1.5} />
          <dt>Evidence source</dt>
          <dd>Not connected</dd>
        </div>
        <div>
          <ShieldCheck aria-hidden="true" size={20} strokeWidth={1.5} />
          <dt>Current state</dt>
          <dd>Foundation gate</dd>
        </div>
      </dl>
    </section>
  );
}

