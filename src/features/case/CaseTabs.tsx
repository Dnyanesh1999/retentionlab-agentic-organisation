import { HashLink } from "../../components/HashLink";
import { caseTabs } from "../../config/caseTabs";

type CaseTabsProps = {
  currentTab: string;
};

export function CaseTabs({ currentTab }: CaseTabsProps) {
  return (
    <nav className="case-tabs" aria-label="Case sections">
      {caseTabs.map(({ id, icon: Icon, label }) => (
        <HashLink
          aria-current={currentTab === id ? "page" : undefined}
          className={`case-tabs__link${currentTab === id ? " is-active" : ""}`}
          key={id}
          to={`/cases/${id}`}
        >
          <Icon aria-hidden="true" size={20} strokeWidth={1.6} />
          <span>{label}</span>
        </HashLink>
      ))}
    </nav>
  );
}
