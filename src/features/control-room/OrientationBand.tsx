import { ArrowRight, BookOpen, Layers, Play } from "lucide-react";

import { HashLink } from "../../components/HashLink";
import { HOSTED_STAGE_ORDER, type HostedStage } from "../../../runtime/hosted/contracts";

/**
 * The first thing a visitor with no context reads.
 *
 * Before this existed the Control Room opened on a slogan, so a cold visitor could not tell what
 * RetentionLab is, who does the work, or what to press first. This band answers those three
 * questions once, in that order, and then gets out of the way.
 *
 * Every claim here is a claim the rest of the product already enforces — five agents, inherited
 * hash verification, a mandatory human boundary, zero external actions. The stage order is read
 * from `HOSTED_STAGE_ORDER` rather than retyped, so the rail cannot drift from the contract the
 * workers actually run, and the `Record<HostedStage, string>` maps fail to compile if an agent is
 * ever added or renamed without updating the copy.
 */

const STAGE_LABEL: Record<HostedStage, string> = {
  researcher: "Researcher",
  designer: "Designer",
  maker: "Maker",
  communicator: "Communicator",
  manager: "Manager",
};

/**
 * One line per agent, describing what it actually seals in a real run — not a generic archetype
 * blurb. These match the sealed summaries in the accepted production run.
 */
const STAGE_PURPOSE: Record<HostedStage, string> = {
  researcher: "Queries live evidence, seals cited observations",
  designer: "Turns those findings into principles and a journey",
  maker: "Builds the customer experience that ships",
  communicator: "Drafts outreach bound to the consented channel",
  manager: "Verifies the whole chain, then stops for a human",
};

type OrientationBandProps = {
  /** Opens the governed launch sheet for the selected account. Absent until the directory is live. */
  onStartRun?: () => void;
  /** Name of the account a run would open against, so the primary door is never a blind press. */
  accountName?: string;
};

export function OrientationBand({ onStartRun, accountName }: OrientationBandProps) {
  return (
    <section aria-labelledby="orientation-title" className="orientation">
      <div className="orientation__lede">
        <h2 id="orientation-title">Five AI agents run this desk</h2>
        <p>
          RetentionLab is a fictional B2B SaaS retention team staffed by five agents. Each seals its work
          as an immutable artefact, and the next refuses to begin unless it can verify the exact SHA-256 it
          inherited. The chain always stops at a human — nothing is ever sent to a customer.
        </p>
      </div>

      {/*
        Deliberately not a StaggerReveal, unlike the account ledger below it.
        A reveal is driven by animation frames, and a tab that loads in the
        background does not get them — measured at 1280 during this work, four
        of the five agents sat frozen at low opacity indefinitely. The ledger
        can afford that because its rows are secondary; these five names are the
        one thing this band exists to say, so they render as plain text.
      */}
      <ol className="orientation__chain">
        {HOSTED_STAGE_ORDER.map((stage, index) => (
          <li className="orientation__stage" key={stage}>
            <span className="orientation__index" aria-hidden="true">{index + 1}</span>
            <strong>{STAGE_LABEL[stage]}</strong>
            <small>{STAGE_PURPOSE[stage]}</small>
          </li>
        ))}
      </ol>

      <div className="orientation__doors">
        <button
          className="orientation__door orientation__door--primary"
          disabled={!onStartRun}
          onClick={onStartRun}
          type="button"
        >
          <Play aria-hidden="true" />
          <span>
            <strong>Watch the five agents run</strong>
            <small>
              {accountName
                ? `Opens a governed run against ${accountName}, on live evidence.`
                : "Available once the live account directory loads."}
            </small>
          </span>
          <ArrowRight aria-hidden="true" />
        </button>

        <HashLink className="orientation__door" to="/cases/overview">
          <BookOpen aria-hidden="true" />
          <span>
            <strong>Read a finished case</strong>
            <small>All five sealed artefacts, the lineage, and the run&rsquo;s real failures.</small>
          </span>
          <ArrowRight aria-hidden="true" />
        </HashLink>

        <HashLink className="orientation__door" to="/portfolio">
          <Layers aria-hidden="true" />
          <span>
            <strong>Browse the archive</strong>
            <small>Cases a human operator approved for internal promotion.</small>
          </span>
          <ArrowRight aria-hidden="true" />
        </HashLink>
      </div>
    </section>
  );
}
