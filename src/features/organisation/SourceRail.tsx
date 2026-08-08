import { Archive, Database, GitBranch, Headphones, ReceiptText } from "lucide-react";

import { gate9Run } from "./gate9Run";

// Evidence sources the assessed run queried, mapped from the committed
// Researcher provenance and the Maker implementation commit. This is a record
// of the snapshot's provenance — it is not a live connection status.
const researcher = gate9Run.stages.find((stage) => stage.id === "researcher");
const maker = gate9Run.stages.find((stage) => stage.id === "maker");
const researcherDetail = researcher?.detail.kind === "researcher" ? researcher.detail : null;
const makerDetail = maker?.detail.kind === "maker" ? maker.detail : null;

function queried(tool: string): boolean {
  return researcherDetail?.toolCalls.includes(tool) ?? false;
}

const sources = [
  { label: "Product", icon: Database, detail: queried("list_product_signals") ? "list_product_signals" : "queried" },
  { label: "Billing", icon: ReceiptText, detail: queried("list_billing_events") ? "list_billing_events" : "queried" },
  { label: "Support", icon: Headphones, detail: queried("list_support_events") ? "list_support_events" : "queried" },
  {
    label: "Repository",
    icon: GitBranch,
    detail: makerDetail ? `commit ${makerDetail.commitSha}` : "commit",
  },
] as const;

export function SourceRail() {
  return (
    <section className="source-rail" aria-label="Assessed-run evidence sources">
      <header>
        <Archive aria-hidden="true" size={16} />
        <strong>Evidence sources</strong>
        <span>Captured in the assessed snapshot · not a live query</span>
      </header>
      <ul>
        {sources.map(({ icon: Icon, label, detail }) => (
          <li key={label}>
            <Icon aria-hidden="true" size={24} strokeWidth={1.45} />
            <span>
              <strong>{label}</strong>
              <small>{detail}</small>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
