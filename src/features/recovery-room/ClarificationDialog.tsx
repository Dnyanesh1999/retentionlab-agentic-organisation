import { Sprout, X } from "lucide-react";
import { useEffect, useId, useRef, type FormEvent, type KeyboardEvent, type MouseEvent } from "react";

import { clarificationObservationMaxLength } from "./clarificationContracts";

export type ClarificationDismissReason = "close" | "not_now" | "escape" | "backdrop";

export type ClarificationDialogProps = {
  open: boolean;
  observation: string;
  submitting?: boolean;
  submitError?: string | null;
  reducedMotion?: boolean;
  onObservationChange: (value: string) => void;
  onShare: () => void;
  onDismiss: (reason: ClarificationDismissReason) => void;
};

const focusableSelector = [
  "button:not([disabled])",
  "textarea:not([disabled])",
  "[href]",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function ClarificationDialog({
  open,
  observation,
  submitting = false,
  submitError,
  reducedMotion = false,
  onObservationChange,
  onShare,
  onDismiss,
}: ClarificationDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) {
        if (typeof dialog.showModal === "function") dialog.showModal();
        else dialog.setAttribute("open", "");
      }
      textareaRef.current?.focus();
      return;
    }

    if (dialog.open) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }
  }, [open]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!submitting) onShare();
  };

  const handleBackdrop = (event: MouseEvent<HTMLDialogElement>) => {
    if (!submitting && event.target === event.currentTarget) onDismiss("backdrop");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (!submitting) onDismiss("escape");
      return;
    }

    if (event.key !== "Tab") return;

    const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>(focusableSelector)];
    if (focusable.length === 0) return;

    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <dialog
      aria-busy={submitting}
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      aria-modal="true"
      className="clarification-dialog"
      data-reduced-motion={String(reducedMotion)}
      onCancel={(event) => event.preventDefault()}
      onKeyDown={handleKeyDown}
      onMouseDown={handleBackdrop}
      ref={dialogRef}
      role="dialog"
    >
      <form className="clarification-dialog__sheet" onSubmit={handleSubmit}>
        <Sprout aria-hidden="true" className="clarification-dialog__sprout" strokeWidth={1.5} />
        <button
          aria-label="Close clarification"
          className="clarification-dialog__close"
          disabled={submitting}
          onClick={() => onDismiss("close")}
          type="button"
        >
          <X aria-hidden="true" strokeWidth={1.5} />
        </button>

        <h2 id={titleId}>Help us understand</h2>
        <div className="clarification-dialog__description" id={descriptionId}>
          <p>Is there a specific workflow step where things feel stuck?</p>
          <p>Your response is optional and will not be used beyond improving this signal garden.</p>
        </div>

        <label htmlFor={`${titleId}-observation`}>Optional observation</label>
        <textarea
          disabled={submitting}
          id={`${titleId}-observation`}
          maxLength={clarificationObservationMaxLength}
          onChange={(event) => onObservationChange(event.currentTarget.value)}
          placeholder="Share only what feels useful…"
          ref={textareaRef}
          value={observation}
        />

        {submitError ? <p className="clarification-dialog__error" role="alert">{submitError}</p> : null}

        <div className="clarification-dialog__actions">
          <button className="clarification-dialog__share" disabled={submitting} type="submit">
            {submitting ? "Sharing observation…" : "Share observation"}
          </button>
          <button
            className="clarification-dialog__not-now"
            disabled={submitting}
            onClick={() => onDismiss("not_now")}
            type="button"
          >
            Not now
          </button>
        </div>
      </form>
    </dialog>
  );
}
