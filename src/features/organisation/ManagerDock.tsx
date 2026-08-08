import { FormEvent, useState } from "react";
import { ArrowRight, ChevronDown, Compass, FileLock2, UserRoundCog } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { managerAnswers, resolveManagerAnswer, type ManagerAnswer } from "./managerAnswers";

type Resolved = { answer: ManagerAnswer | null; notice: string } | null;

export function ManagerDock() {
  const reducedMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState("");
  const [resolved, setResolved] = useState<Resolved>(null);

  function selectAnswer(answer: ManagerAnswer) {
    setDraft(answer.question);
    setResolved({ answer, notice: "" });
    setExpanded(true);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResolved(resolveManagerAnswer(draft));
    setExpanded(true);
  }

  return (
    <section className={`manager-dock${expanded ? " is-expanded" : ""}`} aria-label="Manager interface">
      <button
        aria-expanded={expanded}
        className="manager-dock__identity"
        onClick={() => setExpanded((value) => !value)}
        type="button"
      >
        <span className="manager-dock__compass">
          <Compass aria-hidden="true" size={25} strokeWidth={1.35} />
        </span>
        <span>
          <strong>Talk to the organisation</strong>
          <small>Manager · read-only · answers from the sealed record</small>
        </span>
        <ChevronDown aria-hidden="true" className="manager-dock__chevron" size={18} />
      </button>

      <div className="manager-dock__composer">
        <form onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="manager-question">
            Ask the Manager about this sealed decision
          </label>
          <input
            id="manager-question"
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask about the decision, chain or governance…"
            value={draft}
          />
          <button aria-label="Ask the read-only Manager" type="submit">
            <ArrowRight aria-hidden="true" />
          </button>
        </form>
        <div className="manager-dock__route">
          <FileLock2 aria-hidden="true" size={15} />
          <span>Sealed record · not a model call</span>
          <UserRoundCog aria-hidden="true" size={19} />
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            animate={{ height: "auto", opacity: 1 }}
            className="manager-dock__expanded"
            exit={reducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            initial={reducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
          >
            <div className="manager-dock__prompts">
              {managerAnswers.map((entry) => (
                <button
                  key={entry.id}
                  aria-pressed={resolved?.answer?.id === entry.id}
                  onClick={() => selectAnswer(entry)}
                  type="button"
                >
                  {entry.question}
                </button>
              ))}
            </div>
            <div className="manager-dock__answer" aria-live="polite">
              {resolved?.answer ? (
                <>
                  <p>{resolved.answer.answer}</p>
                  <span className="manager-dock__source">Source: {resolved.answer.source}</span>
                </>
              ) : (
                <p>
                  {resolved?.notice
                    || "This read-only Manager view answers only from the sealed decision record — nothing is sent to a model."}
                </p>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
