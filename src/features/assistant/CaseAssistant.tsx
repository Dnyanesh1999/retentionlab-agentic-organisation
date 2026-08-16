/**
 * CaseAssistant — ask this case a question.
 *
 * Built around provenance. Four tiers can answer, and the reader is always
 * told which one did: a generated answer verified against the record, a
 * deterministic answer composed from the record, the retrieved passages with
 * no prose at all, or an honest refusal.
 *
 * A lower tier is never dressed up as a higher one. When the model tier stands
 * down the reason is shown in plain words, so a fallback reads as a deliberate
 * behaviour rather than as something broken.
 */
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Bot, FileLock2, LoaderCircle, MessageSquareText, Quote, Sparkles, X } from "lucide-react";

import { LENIS_PREVENT, StateSwap } from "../../components/motion";
import { askWithFallback, explainReason, type LadderResult } from "./askLadder";
import { createAssistantClient, type AssistantClient } from "./assistantClient";
import { suggestedQuestions } from "./groundedAnswers";

import "./assistant.css";

type PanelState =
  | { status: "idle" }
  | { status: "thinking" }
  | { status: "settled"; result: LadderResult };

export function CaseAssistant({ client: suppliedClient }: { client?: AssistantClient | null }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [state, setState] = useState<PanelState>({ status: "idle" });
  const controller = useRef<AbortController | null>(null);

  const client = useMemo(
    () => (suppliedClient === undefined ? createAssistantClient() : suppliedClient),
    [suppliedClient],
  );

  useEffect(() => () => controller.current?.abort(), []);

  async function ask(question: string) {
    if (!question.trim()) return;

    // Only the newest question may settle the panel.
    controller.current?.abort();
    const next = new AbortController();
    controller.current = next;

    setDraft(question);
    setState({ status: "thinking" });

    const result = await askWithFallback(question, client, next.signal);
    if (!next.signal.aborted) {
      setState({ status: "settled", result });
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(draft);
  }

  const settled = state.status === "settled" ? state.result : null;

  return (
    <div className={`case-assistant${open ? " is-open" : ""}`}>
      <StateSwap className="case-assistant__swap" state={open ? "open" : "closed"} live="off">
        {open ? (
          <section {...LENIS_PREVENT} className="case-assistant__panel" aria-label="Ask this case">
            <header>
              <span>
                <Bot aria-hidden="true" size={18} /> Ask this case
              </span>
              <button aria-label="Close case assistant" onClick={() => setOpen(false)} type="button">
                <X aria-hidden="true" size={18} />
              </button>
            </header>
            <p>Every answer is checked against this case's sealed record.</p>

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
              <button disabled={state.status === "thinking"} type="submit">
                {state.status === "thinking" ? "Asking…" : "Ask"}
              </button>
            </form>

            <div className="case-assistant__questions">
              {suggestedQuestions.map((item) => (
                <button key={item.id} onClick={() => void ask(item.question)} type="button">
                  {item.question}
                </button>
              ))}
            </div>

            <StateSwap
              className="case-assistant__answer"
              state={state.status === "settled" ? state.result.tier : state.status}
            >
              {state.status === "thinking" ? (
                <p role="status">
                  <LoaderCircle aria-hidden="true" size={15} />
                  Checking the sealed record…
                </p>
              ) : settled ? (
                <AnswerView result={settled} />
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

function FellBackFrom({ reason }: { reason?: string }) {
  if (!reason) return null;

  return (
    <p className="case-assistant__fallback">
      {explainReason(reason)} Answering from the sealed record instead.
    </p>
  );
}

function AnswerView({ result }: { result: LadderResult }) {
  if (result.tier === "model-cited") {
    return (
      <div>
        <p>
          <Sparkles aria-hidden="true" size={15} />
          {result.answer}
        </p>
        <p className="case-assistant__provenance" data-tier="model-cited">
          <Quote aria-hidden="true" size={13} />
          <span>Generated · every quote verified</span>
        </p>
        <ul className="case-assistant__citations">
          {result.citations.map((citation, index) => (
            <li key={`${citation.chunkId}-${index}`}>
              <q>{citation.quote}</q>
              <small>{citation.source}</small>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (result.tier === "sealed-record") {
    return (
      <div>
        <p>
          <Sparkles aria-hidden="true" size={15} />
          {result.answer}
        </p>
        <p className="case-assistant__provenance" data-tier="sealed-record">
          <FileLock2 aria-hidden="true" size={13} />
          <span>Sealed record</span>
          <small>{result.source}</small>
        </p>
        <FellBackFrom reason={result.fallbackFrom} />
      </div>
    );
  }

  if (result.tier === "evidence") {
    return (
      <div>
        <p>
          <MessageSquareText aria-hidden="true" size={15} />
          {explainReason(result.fallbackFrom)} Here is what the record says.
        </p>
        <ul className="case-assistant__citations">
          {result.evidence.map((excerpt, index) => (
            <li key={`${excerpt.source}-${index}`}>
              <q>{excerpt.text}</q>
              <small>{excerpt.source}</small>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div>
      <p>
        <MessageSquareText aria-hidden="true" size={15} />
        {result.notice}
      </p>
      <FellBackFrom reason={result.fallbackFrom} />
    </div>
  );
}
