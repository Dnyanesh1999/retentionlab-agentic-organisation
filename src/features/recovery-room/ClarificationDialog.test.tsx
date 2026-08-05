import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ClarificationDialog, type ClarificationDialogProps } from "./ClarificationDialog";

function renderDialog(overrides: Partial<ClarificationDialogProps> = {}) {
  const props: ClarificationDialogProps = {
    open: true,
    observation: "",
    onObservationChange: vi.fn(),
    onShare: vi.fn(),
    onDismiss: vi.fn(),
    ...overrides,
  };

  return { props, ...render(<ClarificationDialog {...props} />) };
}

describe("ClarificationDialog", () => {
  it("announces the exact optional purpose and starts with an empty, non-required field", () => {
    renderDialog();

    expect(screen.getByRole("dialog", { name: "Help us understand" })).toHaveAttribute(
      "aria-modal",
      "true",
    );
    expect(screen.getByText("Is there a specific workflow step where things feel stuck?")).toBeVisible();
    expect(screen.getByText(
      "Your response is optional and will not be used beyond improving this signal garden.",
    )).toBeVisible();

    const observation = screen.getByRole("textbox", { name: "Optional observation" });
    expect(observation).toHaveValue("");
    expect(observation).not.toBeRequired();
    expect(observation).toHaveFocus();
  });

  it("allows explicit sharing when the optional field is empty and blocks duplicate submit while busy", async () => {
    const user = userEvent.setup();
    const { props, rerender } = renderDialog();

    await user.click(screen.getByRole("button", { name: "Share observation" }));
    expect(props.onShare).toHaveBeenCalledTimes(1);

    rerender(<ClarificationDialog {...props} submitting />);
    expect(screen.getByRole("button", { name: "Sharing observation…" })).toBeDisabled();
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-busy", "true");
  });

  it.each([
    ["Not now", "not_now"],
    ["Close clarification", "close"],
  ] as const)("dismisses through %s without sharing", async (buttonName, reason) => {
    const user = userEvent.setup();
    const { props } = renderDialog();

    await user.click(screen.getByRole("button", { name: buttonName }));

    expect(props.onDismiss).toHaveBeenCalledWith(reason);
    expect(props.onShare).not.toHaveBeenCalled();
  });

  it("dismisses through Escape or the backdrop without sharing", () => {
    const { props } = renderDialog();
    const dialog = screen.getByRole("dialog");

    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent.mouseDown(dialog);

    expect(props.onDismiss).toHaveBeenNthCalledWith(1, "escape");
    expect(props.onDismiss).toHaveBeenNthCalledWith(2, "backdrop");
    expect(props.onShare).not.toHaveBeenCalled();
  });

  it("keeps Tab and Shift+Tab inside the open dialog", () => {
    renderDialog();
    const dialog = screen.getByRole("dialog");
    const close = screen.getByRole("button", { name: "Close clarification" });
    const notNow = screen.getByRole("button", { name: "Not now" });

    notNow.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(close).toHaveFocus();

    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(notNow).toHaveFocus();
  });

  it("preserves a supplied draft and announces a fail-closed submit error", () => {
    renderDialog({
      observation: "The export step feels stuck.",
      submitError: "Observation not shared. Your text is still here.",
    });

    expect(screen.getByRole("textbox")).toHaveValue("The export step feels stuck.");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Observation not shared. Your text is still here.",
    );
  });
});
