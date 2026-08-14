import { BrandMark } from "./BrandMark";
import { HashLink } from "./HashLink";

const navItems = [
  { label: "Case archive", to: "/portfolio" },
  { label: "Active case", to: "/cases/overview" },
] as const;

type AppMastheadProps = {
  currentPath: string;
};

export function AppMasthead({ currentPath }: AppMastheadProps) {
  return (
    <header className="masthead">
      <HashLink className="brand" to="/portfolio" aria-label="RetentionLab case archive">
        <BrandMark />
        <span>RetentionLab</span>
      </HashLink>

      <nav className="global-nav" aria-label="Primary navigation">
        {navItems.map((item) => {
          const active = item.label === "Active case" ? currentPath.startsWith("/cases/") : currentPath === item.to;

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

      <span aria-hidden="true" />
    </header>
  );
}
