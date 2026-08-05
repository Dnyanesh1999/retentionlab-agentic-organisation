import { ArrowRight, CircleDashed } from "lucide-react";

import { HashLink } from "../../components/HashLink";

type FeaturePreviewProps = {
  title: string;
  description: string;
  gate: string;
};

export function FeaturePreview({ description, gate, title }: FeaturePreviewProps) {
  return (
    <section className="feature-preview">
      <div className="feature-preview__ring" aria-hidden="true">
        <CircleDashed size={54} strokeWidth={1.1} />
      </div>
      <p>{gate}</p>
      <h2>{title}</h2>
      <div className="feature-preview__rule" aria-hidden="true" />
      <p>{description}</p>
      <HashLink to="/cases/organisation">
        Return to the organisation
        <ArrowRight aria-hidden="true" size={17} />
      </HashLink>
    </section>
  );
}
