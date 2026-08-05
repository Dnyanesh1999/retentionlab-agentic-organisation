import { CircleDashed, Database, GitBranch, Headphones, ReceiptText } from "lucide-react";

const sources = [
  { label: "Product", icon: Database },
  { label: "Billing", icon: ReceiptText },
  { label: "Support", icon: Headphones },
  { label: "Repository", icon: GitBranch },
] as const;

export function SourceRail() {
  return (
    <section className="source-rail" aria-label="Source connection status">
      <header>
        <CircleDashed aria-hidden="true" size={16} />
        <strong>Live sources</strong>
        <span>Connection gate pending</span>
      </header>
      <ul>
        {sources.map(({ icon: Icon, label }) => (
          <li key={label}>
            <Icon aria-hidden="true" size={24} strokeWidth={1.45} />
            <span>
              <strong>{label}</strong>
              <small>Not connected</small>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
