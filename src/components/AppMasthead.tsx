import { CircleUserRound } from "lucide-react";

import { BrandMark } from "./BrandMark";
import { HashLink } from "./HashLink";

const navItems = [
  { label: "Portfolio", to: "/portfolio" },
  { label: "Cases", to: "/cases/organisation" },
  { label: "Governance", to: "/governance" },
] as const;

type AppMastheadProps = {
  currentPath: string;
};

export function AppMasthead({ currentPath }: AppMastheadProps) {
  return (
    <header className="masthead">
      <HashLink className="brand" to="/cases/organisation" aria-label="RetentionLab cases">
        <BrandMark />
        <span>RetentionLab</span>
      </HashLink>

      <nav className="global-nav" aria-label="Primary navigation">
        {navItems.map((item) => {
          const active = item.label === "Cases" ? currentPath.startsWith("/cases/") : currentPath === item.to;

          return (
            <HashLink
              aria-current={active ? "page" : undefined}
              className={`global-nav__link${active ? " is-active" : ""}`}
              key={item.to}
              to={item.to}
            >
              {item.label}
            </HashLink>
          );
        })}
      </nav>

      <div className="profile-control" aria-label="Current user">
        <CircleUserRound aria-hidden="true" strokeWidth={1.5} />
        <span className="profile-control__copy">
          <strong>Maya Chen</strong>
          <small>Customer Success</small>
        </span>
      </div>
    </header>
  );
}
