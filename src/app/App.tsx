import { AppMasthead } from "../components/AppMasthead";
import { isCaseTabId } from "../config/caseTabs";
import { CaseWorkspace } from "../features/case/CaseWorkspace";
import { SimplePage } from "../features/shared/SimplePage";
import { replaceHashRoute, useHashRoute } from "./hashRoute";

export function App() {
  const path = useHashRoute();
  const caseMatch = /^\/cases\/([^/]+)$/.exec(path);
  const requestedTab = caseMatch?.[1];

  let content: React.ReactNode;

  if (isCaseTabId(requestedTab)) {
    content = <CaseWorkspace tab={requestedTab} />;
  } else if (path === "/portfolio") {
    content = (
      <SimplePage
        title="Case portfolio"
        description="Portfolio comparison begins after the first live case passes the complete five-agent pipeline."
      />
    );
  } else if (path === "/governance") {
    content = (
      <SimplePage
        title="Governance"
        description="Prompt versions, approvals and audit exports will become available as their implementation gates pass."
      />
    );
  } else {
    replaceHashRoute("/cases/organisation");
    content = <CaseWorkspace tab="organisation" />;
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <AppMasthead currentPath={path} />
      {content}
    </div>
  );
}
