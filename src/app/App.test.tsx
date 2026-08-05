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
    expect(selectedAgent).toHaveTextContent("Designer");
  });

  it("updates the single inspector when an agent is selected", async () => {
    renderApp();

    fireEvent.click(screen.getByText("Maker").closest("button")!);

    expect(screen.getByRole("complementary", { name: "Maker details" })).toBeInTheDocument();
    expect(await screen.findByText(/Noor Patel/)).toBeInTheDocument();
    expect(await screen.findByText(/typed, renderable and interactive Recovery Room/)).toBeInTheDocument();
  });

  it("routes every case tab to a meaningful preview", () => {
    renderApp();

    fireEvent.click(screen.getByRole("link", { name: "Evidence" }));

    expect(screen.getByRole("heading", { name: "Evidence" })).toBeInTheDocument();
    expect(screen.getByText(/fresh source record/)).toBeInTheDocument();
  });

  it("identifies chat as the same read-only Manager interface", () => {
    renderApp();

    const managerToggle = screen.getByRole("button", { name: /Talk to the organisation/ });
    fireEvent.click(managerToggle);

    expect(managerToggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Same Manager agent")).toBeInTheDocument();
    expect(screen.getByText(/No response is generated/)).toBeInTheDocument();
  });
});
