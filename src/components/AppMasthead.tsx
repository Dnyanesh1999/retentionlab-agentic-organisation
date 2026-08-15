import { useEffect, useState } from "react";

import { BrandMark } from "./BrandMark";
import { HashLink } from "./HashLink";
import { SharedIndicator } from "./motion/SharedIndicator";

const navItems = [
  { label: "Control room", to: "/control-room" },
  { label: "Case archive", to: "/portfolio" },
  { label: "Active case", to: "/cases/overview" },
] as const;

type AppMastheadProps = {
  currentPath: string;
};

/**
 * True once the page has scrolled off the very top, so the masthead can earn
 * its separation from the canvas instead of always carrying a border.
 */
function useScrolled(threshold = 8): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const measure = () => setScrolled(window.scrollY > threshold);
    measure();
    window.addEventListener("scroll", measure, { passive: true });
    return () => window.removeEventListener("scroll", measure);
  }, [threshold]);

  return scrolled;
}

export function AppMasthead({ currentPath }: AppMastheadProps) {
  const scrolled = useScrolled();

  return (
    <header className="masthead" data-scrolled={scrolled ? "true" : undefined}>
      <HashLink className="brand" to="/control-room" aria-label="RetentionLab control room">
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
              {/* One underline shared across the nav; it travels between items. */}
              {active ? (
                <SharedIndicator className="global-nav__underline" layoutId="global-nav-underline" />
              ) : null}
            </HashLink>
          );
        })}
      </nav>

      <span aria-hidden="true" />
    </header>
  );
}
