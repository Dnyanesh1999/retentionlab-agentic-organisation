import { fireEvent, render, screen } from "@testing-library/react";

import { App } from "./App";

function renderApp(initialPath = "/cases/organisation") {
  window.history.replaceState(null, "", `#${initialPath}`);
  return render(<App />);
}

describe("RetentionLab application shell", () => {
  it("shows exactly five selectable agent stages", () => {
    renderApp();

    const agentButtons = screen
      .getAllByRole("button")
      .filter((button) => button.hasAttribute("aria-pressed"));
    const selectedAgent = agentButtons.find((button) => button.getAttribute("aria-pressed") === "true");

    expect(agentButtons).toHaveLength(5);
    expect(selectedAgent).toHaveTextContent("Nia Calder");
  });

  it("updates the single inspector when an agent is selected", async () => {
    renderApp();

    fireEvent.click(screen.getByText("Noor Patel").closest("button")!);

    expect(screen.getByRole("complementary", { name: "Noor Patel details" })).toBeInTheDocument();
    expect(await screen.findByText(/commit c38febd/)).toBeInTheDocument();
  });

  it("routes every case tab to a meaningful preview", () => {
    renderApp();

    fireEvent.click(screen.getByRole("link", { name: "Evidence" }));

    expect(screen.getByRole("heading", { name: "Evidence" })).toBeInTheDocument();
    expect(screen.getByText(/fresh source record/)).toBeInTheDocument();
  });

  it("does not label the live Recovery Room route as connection-pending", () => {
    renderApp("/cases/recovery-room");

    expect(screen.getByRole("heading", { name: "Copper Finch live signal garden" })).toBeInTheDocument();
    expect(screen.getByText(/requested from Supabase when this route opens/)).toBeInTheDocument();
    expect(screen.getByText("Live evidence route · no cached fallback")).toBeInTheDocument();
    expect(screen.queryByText("Live connection gate pending")).not.toBeInTheDocument();
  });

  it("answers Manager questions only from the sealed record, never a model call", () => {
    renderApp();

    const managerToggle = screen.getByRole("button", { name: /Talk to the organisation/ });
    fireEvent.click(managerToggle);

    expect(managerToggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/Sealed record · not a model call/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Can the organisation act without a human?" }));
    expect(screen.getByText(/Autonomous external actions: false/)).toBeInTheDocument();
    expect(screen.getByText(/Source: manager.operational-decision.v1/)).toBeInTheDocument();
  });
});
