import { pushHashRoute } from "../../app/hashRoute";
import { CaseAssistant } from "../assistant/CaseAssistant";
import {
  ApprovedCaseScreen,
  CaseArchiveScreen,
  CaseRecordScreen,
} from "../design-lab/DesignLabView";

type CasebookViewProps =
  | { view: "archive" | "case"; runId?: undefined }
  | { view: "approved"; runId: string };

export function CasebookView({ view, runId }: CasebookViewProps) {
  if (view === "archive") {
    return (
      <div className="casebook-product">
        <CaseArchiveScreen onOpenCase={() => pushHashRoute("/cases/overview")} />
      </div>
    );
  }

  if (view === "approved") {
    return (
      <div className="casebook-product">
        <ApprovedCaseScreen runId={runId} />
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
