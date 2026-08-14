import { lazy, Suspense } from "react";

import { AppMasthead } from "../components/AppMasthead";
import { replaceHashRoute, useHashRoute } from "./hashRoute";

const CasebookView = lazy(() =>
  import("../features/casebook/CasebookView").then((module) => ({ default: module.CasebookView })),
);
const CaseWorkspace = lazy(() =>
  import("../features/case/CaseWorkspace").then((module) => ({ default: module.CaseWorkspace })),
);
const DesignLabView = lazy(() =>
  import("../features/design-lab/DesignLabView").then((module) => ({ default: module.DesignLabView })),
);

function RouteFallback() {
  return (
    <div className="route-loading" role="status">
      <span className="route-loading__mark" aria-hidden="true" />
      <p>Opening the case record…</p>
    </div>
  );
}

export function App() {
  const path = useHashRoute();

  if (path === "/design-lab") {
    return (
      <Suspense fallback={<div className="route-loading">Preparing the interactive design preview…</div>}>
        <DesignLabView />
      </Suspense>
    );
  }

  let content: React.ReactNode;

  if (path === "/portfolio") {
    content = <CasebookView view="archive" />;
  } else if (path === "/cases/overview") {
    content = <CasebookView view="case" />;
  } else if (path === "/cases/recovery-room") {
    content = <CaseWorkspace tab="recovery-room" />;
  } else {
    const destination = path === "/cases/organisation" || path.startsWith("/cases/")
      ? "/cases/overview"
      : "/portfolio";
    replaceHashRoute(destination);
    content = <CasebookView view={destination === "/portfolio" ? "archive" : "case"} />;
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <AppMasthead currentPath={path} />
      <Suspense fallback={<RouteFallback />}>{content}</Suspense>
    </div>
  );
}
