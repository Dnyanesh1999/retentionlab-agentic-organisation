import type { LucideIcon } from "lucide-react";
import { Activity, FileText, Network, Scale, ShieldCheck, Sparkles } from "lucide-react";

export type CaseTabId = "pulse" | "organisation" | "evidence" | "recovery-room" | "trust-gate" | "audit";

export type CaseTab = {
  id: CaseTabId;
  label: string;
  icon: LucideIcon;
};

export const caseTabs: readonly CaseTab[] = [
  { id: "pulse", label: "Pulse", icon: Activity },
  { id: "organisation", label: "Organisation", icon: Network },
  { id: "evidence", label: "Evidence", icon: FileText },
  { id: "recovery-room", label: "Recovery Room", icon: Sparkles },
  { id: "trust-gate", label: "Trust Gate", icon: ShieldCheck },
  { id: "audit", label: "Audit", icon: Scale },
] as const;

export function isCaseTabId(value: string | undefined): value is CaseTabId {
  return caseTabs.some((tab) => tab.id === value);
}

