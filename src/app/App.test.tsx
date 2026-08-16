import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { App } from "./App";

function renderApp(initialPath = "/cases/overview") {
  window.history.replaceState(null, "", `#${initialPath}`);
  return render(<App />);
}

describe("RetentionLab application shell", () => {
  it("opens the completed case from the archive", async () => {
    renderApp("/portfolio");

    fireEvent.click(await screen.findByRole("button", { name: /Copper Finch/ }));

    expect(window.location.hash).toBe("#/cases/overview");
    expect(await screen.findByRole("heading", { name: /accountable path/i })).toBeInTheDocument();
  });

  it("shows exactly five expandable agent stages", async () => {
    renderApp();

    const agentButtons = (await screen.findAllByRole("button")).filter((button) =>
      button.hasAttribute("aria-expanded"),
    );
    const selectedAgent = agentButtons.find((button) => button.getAttribute("aria-expanded") === "true");

    expect(agentButtons).toHaveLength(5);
    expect(selectedAgent).toHaveTextContent("Researcher");
  });

  it("reveals each specialist contribution inline", async () => {
    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /Maker/ }));

    expect(await screen.findByText(/Maker contribution/i)).toBeInTheDocument();
  });

  it("does not label the live Recovery Room route as connection-pending", async () => {
    renderApp("/cases/recovery-room");

    expect(await screen.findByRole("heading", { name: "Copper Finch live signal garden" })).toBeInTheDocument();
    expect(screen.getByText(/requested from Supabase when this route opens/)).toBeInTheDocument();
    expect(screen.getByText("Live evidence route · no cached fallback")).toBeInTheDocument();
    expect(screen.queryByText("Live connection gate pending")).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Case workspace" })).not.toBeInTheDocument();
  });

  it("answers case questions from the sealed record when no model tier answers", async () => {
    // fetch is stubbed so the unit suite never reaches the deployed function;
    // the refusal it produces is the same one a real outage would.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    renderApp();

    const managerToggle = await screen.findByRole("button", { name: /Ask this case/ });
    fireEvent.click(managerToggle);

    fireEvent.click(await screen.findByRole("button", { name: "Can the organisation contact the customer?" }));
    expect(await screen.findByText(/requires a named human to approve/i)).toBeInTheDocument();
    expect(await screen.findByText("Sealed record")).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("redirects the legacy organisation URL to the active case", async () => {
    renderApp("/cases/organisation");

    await waitFor(() => expect(window.location.hash).toBe("#/cases/overview"));
    expect(await screen.findByRole("heading", { name: /accountable path/i })).toBeInTheDocument();
  });
});
