import { pushHashRoute } from "../../app/hashRoute";
import {
  CaseArchiveScreen,
  CaseAssistant,
  CaseRecordScreen,
} from "../design-lab/DesignLabView";

type CasebookViewProps = {
  view: "archive" | "case";
};

export function CasebookView({ view }: CasebookViewProps) {
  if (view === "archive") {
    return (
      <div className="casebook-product">
        <CaseArchiveScreen onOpenCase={() => pushHashRoute("/cases/overview")} />
      </div>
    );
  }

  return (
    <div className="casebook-product">
      <CaseRecordScreen onBack={() => pushHashRoute("/portfolio")} />
      <CaseAssistant />
    </div>
  );
}
