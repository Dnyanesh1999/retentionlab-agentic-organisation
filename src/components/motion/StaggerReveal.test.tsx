import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StaggerReveal, StaggerItem } from "./StaggerReveal";

describe("StaggerReveal", () => {
  it("renders semantic list DOM and every item under reduced motion", () => {
    render(
      <StaggerReveal aria-label="Case rows" as="ul" reducedMotion trigger="mount">
        <StaggerReveal.Item as="li">Case A</StaggerReveal.Item>
        <StaggerReveal.Item as="li">Case B</StaggerReveal.Item>
        <StaggerReveal.Item as="li">Case C</StaggerReveal.Item>
      </StaggerReveal>,
    );

    const list = screen.getByRole("list", { name: "Case rows" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items.map((node) => node.textContent)).toEqual(["Case A", "Case B", "Case C"]);
  });

  it("keeps children visible (no hidden state left mounted) when motion runs", () => {
    render(
      <StaggerReveal as="ul" trigger="mount">
        <StaggerReveal.Item as="li">Visible row</StaggerReveal.Item>
      </StaggerReveal>,
    );

    expect(screen.getByRole("listitem")).toHaveTextContent("Visible row");
  });

  it("renders a plain element when an item is used outside a container", () => {
    const { container } = render(<StaggerItem as="li">Orphan</StaggerItem>);
    const li = container.querySelector("li");
    expect(li).not.toBeNull();
    expect(li).toHaveTextContent("Orphan");
  });
});
