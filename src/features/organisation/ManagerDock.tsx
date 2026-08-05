import { FormEvent, useState } from "react";
import { ArrowRight, ChevronDown, Compass, LockKeyhole, UserRoundCog } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

const prompts = [
  "How will evidence be verified?",
  "What can the Manager approve?",
  "Show the five-agent boundary",
] as const;

export function ManagerDock() {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(
      draft.trim()
        ? "Draft saved locally. Manager responses unlock after the Manager runtime gate."
        : "Enter a question for the Manager interface.",
    );
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
          <small>Manager interface · read-only</small>
        </span>
        <ChevronDown aria-hidden="true" className="manager-dock__chevron" size={18} />
      </button>

      <div className="manager-dock__composer">
        <form onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="manager-question">
            Ask the Manager about this case
          </label>
          <input
            id="manager-question"
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask about evidence, trust, or the handoff…"
            value={draft}
          />
          <button aria-label="Save Manager question draft" type="submit">
            <ArrowRight aria-hidden="true" />
          </button>
        </form>
        <div className="manager-dock__route">
          <LockKeyhole aria-hidden="true" size={15} />
          <span>Same Manager agent</span>
          <UserRoundCog aria-hidden="true" size={19} />
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            animate={{ height: "auto", opacity: 1 }}
            className="manager-dock__expanded"
            exit={{ height: 0, opacity: 0 }}
            initial={{ height: 0, opacity: 0 }}
          >
            <div className="manager-dock__prompts">
              {prompts.map((prompt) => (
                <button key={prompt} onClick={() => setDraft(prompt)} type="button">
                  {prompt}
                </button>
              ))}
            </div>
            <p aria-live="polite">{notice || "No response is generated in the interface foundation gate."}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

