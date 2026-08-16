/**
 * LineageConstellation — the hash chain, as a shape rather than a sentence.
 *
 * Every downstream stage must embed the exact SHA-256 of the predecessor it
 * claims, and the Manager verifies all four before it decides. Until now that
 * was a count — "7 verified links" — which asks the reader to take the number on
 * trust. Here each artefact is drawn as its own seal and each inheritance is
 * drawn as an edge, so the chain and the Manager's fan of verifications are
 * visible at once.
 *
 * The layout is a pentagon in stage order, which is not arbitrary: adjacent
 * stages become adjacent edges, so the Researcher → Communicator chain reads
 * around the rim, and the Manager's four verification links fall across the
 * middle as a fan. The two kinds of link therefore look different without being
 * coloured differently.
 *
 * Accessibility is not left to the graphic. The nodes are real buttons in the
 * document with real text, positioned over the drawing; the `svg` carries only
 * the edges and is hidden. Selecting a stage names its inherited predecessors in
 * a live region, so the relationship is available without seeing the shape.
 *
 * Nothing here re-verifies anything. `verified` is read from the sealed
 * transcript, which checks the hashes at load; drawing an edge as verified when
 * it is not would be exactly the invented assurance this project forbids.
 */
import { useId, useState } from "react";

import { ArtifactGlyph } from "../../components/glyph/ArtifactGlyph";
import { useResolvedReducedMotion } from "../../components/motion/motionContext";
import {
  gate9Run,
  stageLabel,
  type LineageLink,
  type StageId,
} from "../organisation/gate9Run";

import "./lineage.css";

const VIEWBOX = 100;
const CENTRE = VIEWBOX / 2;
const ORBIT = 34;

/** Pentagon points, first stage at the top, in the order the pipeline enforces. */
function nodePosition(index: number, total: number) {
  const angle = ((index / total) * 2 * Math.PI) - Math.PI / 2;
  return {
    x: CENTRE + Math.cos(angle) * ORBIT,
    y: CENTRE + Math.sin(angle) * ORBIT,
  };
}

/**
 * Bow each edge toward the centre. A straight chord between adjacent nodes would
 * sit on top of the rim; pulling it inward separates the chain from the
 * Manager's verification fan without needing a second colour.
 */
function edgePath(from: { x: number; y: number }, to: { x: number; y: number }) {
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const pull = 0.32;
  const controlX = midX + (CENTRE - midX) * pull;
  const controlY = midY + (CENTRE - midY) * pull;
  return `M${from.x.toFixed(2)} ${from.y.toFixed(2)}Q${controlX.toFixed(2)} ${controlY.toFixed(2)} ${to.x.toFixed(2)} ${to.y.toFixed(2)}`;
}

export function LineageConstellation() {
  const stages = gate9Run.stages;
  const [selected, setSelected] = useState<StageId | null>(null);
  const shouldReduceMotion = useResolvedReducedMotion();
  const titleId = useId();

  const positions = new Map(
    stages.map((stage, index) => [stage.id, nodePosition(index, stages.length)]),
  );

  const links: LineageLink[] = stages.flatMap((stage) => stage.lineage);
  const verifiedCount = links.filter((link) => link.verified).length;

  const inherited = selected
    ? links.filter((link) => link.to === selected)
    : [];
  const selectedStage = selected ? stages.find((stage) => stage.id === selected) : null;

  return (
    <section
      aria-labelledby={titleId}
      className={`lineage-constellation${shouldReduceMotion ? " is-static" : ""}`}
      data-reduced-motion={shouldReduceMotion ? "true" : undefined}
    >
      <header className="section-heading">
        <div>
          <h2 id={titleId}>Lineage</h2>
          <p>
            Each artefact is drawn from its own SHA-256. Select a stage to see the predecessors it
            inherited.
          </p>
        </div>
        <span>{verifiedCount} of {links.length} verified</span>
      </header>

      <div className="lineage-constellation__plot">
        <svg
          aria-hidden="true"
          className="lineage-constellation__edges"
          focusable="false"
          role="presentation"
          viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
        >
          {links.map((link) => {
            const from = positions.get(link.from);
            const to = positions.get(link.to);
            if (!from || !to) return null;
            const active = selected === link.to || selected === link.from;
            return (
              <path
                className={`lineage-edge${active ? " is-active" : ""}${link.verified ? "" : " is-unverified"}`}
                d={edgePath(from, to)}
                key={`${link.from}-${link.to}-${link.sha256.slice(0, 8)}`}
              />
            );
          })}
        </svg>

        <ul className="lineage-constellation__nodes">
          {stages.map((stage, index) => {
            const position = nodePosition(index, stages.length);
            const active = selected === stage.id;
            return (
              <li
                key={stage.id}
                style={{ left: `${position.x}%`, top: `${position.y}%` }}
              >
                <button
                  aria-pressed={active}
                  className={`lineage-node${active ? " is-active" : ""}`}
                  onClick={() => setSelected(active ? null : stage.id)}
                  type="button"
                >
                  <ArtifactGlyph muted={selected !== null && !active} sha256={stage.sha256} size={54} />
                  <span className="lineage-node__label">
                    <strong>{stageLabel(stage.id)}</strong>
                    <small>{stage.sha256.slice(0, 8)}…</small>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/*
        The relationship in words. This is the accessible answer to what the
        shape shows, and it is also what a sighted reader needs to know which
        predecessor an edge actually stands for.
      */}
      <p aria-live="polite" className="lineage-constellation__readout">
        {selectedStage ? (
          inherited.length ? (
            <>
              <strong>{stageLabel(selectedStage.id)}</strong> inherited{" "}
              {inherited.map((link, index) => (
                <span key={link.from}>
                  {index > 0 ? ", " : ""}
                  {stageLabel(link.from)} ({link.sha256.slice(0, 8)}…
                  {link.verified ? ", verified" : ", not verified"})
                </span>
              ))}
              .
            </>
          ) : (
            <><strong>{stageLabel(selectedStage.id)}</strong> is the origin record — it inherits nothing.</>
          )
        ) : (
          "Select a stage to name the predecessors it verified."
        )}
      </p>
    </section>
  );
}
