import { fireEvent, render, screen } from "@testing-library/react";

import { CasebookView } from "./CasebookView";

describe("production casebook views", () => {
  it("opens the assessed case from the archive", () => {
    window.history.replaceState(null, "", "#/portfolio");
    render(<CasebookView view="archive" />);

    fireEvent.click(screen.getByRole("button", { name: /Copper Finch/ }));

    expect(window.location.hash).toBe("#/cases/overview");
  });

  it("returns from the case record to the archive", () => {
    window.history.replaceState(null, "", "#/cases/overview");
    render(<CasebookView view="case" />);

    fireEvent.click(screen.getByRole("button", { name: "Case archive" }));

    expect(window.location.hash).toBe("#/portfolio");
  });

  it("keeps the live recovery experience reachable", async () => {
    render(<CasebookView view="case" />);
    fireEvent.click(screen.getByRole("button", { name: "Experience" }));

    expect(await screen.findByRole("link", { name: /Open the live Signal Garden/ })).toHaveAttribute(
      "href",
      "#/cases/recovery-room",
    );
  });
});
