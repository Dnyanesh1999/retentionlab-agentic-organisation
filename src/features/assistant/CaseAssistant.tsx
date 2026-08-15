/**
 * CaseAssistant — ask the sealed case record a question.
 *
 * This is the surface a model tier will later plug into, so it is built around
 * provenance from the start: every answer carries where it came from, and the
 * reader always sees it. A generated answer and a build-time record answer must
 * never look alike.
 *
 * Today there is exactly one tier — the sealed record — and the panel says so
 * plainly rather than implying a capability it does not have.
 */
import { useState, type FormEvent } from "react";
import { Bot, FileLock2, MessageSquareText, Sparkles, X } from "lucide-react";

import { LENIS_PREVENT, StateSwap } from "../../components/motion";
import { answerFromSealedRecord, suggestedQuestions, type AssistantReply } from "./groundedAnswers";

import "./assistant.css";

export function CaseAssistant() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [reply, setReply] = useState<AssistantReply | null>(null);

  function ask(question: string) {
    setDraft(question);
    setReply(answerFromSealedRecord(question));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReply(answerFromSealedRecord(draft));
  }

  return (
    <div className={`case-assistant${open ? " is-open" : ""}`}>
      <StateSwap className="case-assistant__swap" state={open ? "open" : "closed"} live="off">
        {open ? (
          // The panel is bounded and scrolls itself, so LENIS_PREVENT keeps the
          // wheel over it from scrolling the page behind it. See SmoothScroll.
          <section {...LENIS_PREVENT} className="case-assistant__panel" aria-label="Ask this case">
            <header>
              <span>
                <Bot aria-hidden="true" size={18} /> Ask this case
              </span>
              <button aria-label="Close case assistant" onClick={() => setOpen(false)} type="button">
                <X aria-hidden="true" size={18} />
              </button>
            </header>
            <p>Answers come from the sealed assessed record—not a live model call.</p>

            <form className="case-assistant__composer" onSubmit={handleSubmit}>
              <label className="sr-only" htmlFor="case-assistant-question">
                Ask a question about this sealed case record
              </label>
              <input
                autoComplete="off"
                id="case-assistant-question"
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Ask about the decision, evidence or approval…"
                value={draft}
              />
              <button type="submit">Ask</button>
            </form>

            <div className="case-assistant__questions">
              {suggestedQuestions.map((item) => (
                <button
                  aria-pressed={reply?.status === "answered" && reply.answer.id === item.id}
                  key={item.id}
                  onClick={() => ask(item.question)}
                  type="button"
                >
                  {item.question}
                </button>
              ))}
            </div>

            <StateSwap
              className="case-assistant__answer"
              state={reply?.status === "answered" ? reply.answer.id : (reply?.status ?? "empty")}
            >
              {reply?.status === "answered" ? (
                <div>
                  <p>
                    <Sparkles aria-hidden="true" size={15} />
                    {reply.answer.answer}
                  </p>
                  {/* Provenance is not decoration. It is how a reader tells a
                      record-derived answer from a generated one. */}
                  <p className="case-assistant__provenance">
                    <FileLock2 aria-hidden="true" size={13} />
                    <span>Sealed record</span>
                    <small>{reply.answer.source}</small>
                  </p>
                </div>
              ) : reply?.status === "unmatched" ? (
                <p>
                  <MessageSquareText aria-hidden="true" size={15} />
                  {reply.notice}
                </p>
              ) : (
                <p>
                  <MessageSquareText aria-hidden="true" size={15} />
                  Choose a question to inspect the case record.
                </p>
              )}
            </StateSwap>
          </section>
        ) : (
          <button className="case-assistant__trigger" onClick={() => setOpen(true)} type="button">
            <MessageSquareText aria-hidden="true" size={18} /> Ask this case
          </button>
        )}
      </StateSwap>
    </div>
  );
}
