import { ArrowLeft } from "lucide-react";

import { HashLink } from "../../components/HashLink";

type SimplePageProps = {
  title: string;
  description: string;
};

export function SimplePage({ description, title }: SimplePageProps) {
  return (
    <main className="simple-page" id="main-content">
      <p>RetentionLab</p>
      <h1>{title}</h1>
      <div aria-hidden="true" />
      <p>{description}</p>
      <HashLink to="/cases/organisation">
        <ArrowLeft aria-hidden="true" size={17} />
        Return to cases
      </HashLink>
    </main>
  );
}
