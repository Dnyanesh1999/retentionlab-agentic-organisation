import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TextReveal } from "./TextReveal";

const HERO = "Protect revenue.\nProve value. Move early.";

describe("TextReveal", () => {
  it("keeps the complete line as the heading's accessible name", () => {
    render(<TextReveal as="h1" text={HERO} />);

    // Splitting into words must not cost the heading its name: the animated
    // words are aria-hidden, so the unsplit string has to be supplied.
    expect(screen.getByRole("heading", { level: 1, name: HERO })).toBeInTheDocument();
  });

  it("splits into one masked word per token and hides them from assistive technology", () => {
    const { container } = render(<TextReveal as="h1" text="Protect revenue." />);

    const masks = container.querySelectorAll(".text-reveal__mask");
    expect(masks).toHaveLength(2);
    masks.forEach((mask) => expect(mask).toHaveAttribute("aria-hidden", "true"));
    expect(container.textContent).toBe("Protect revenue.");
  });

  it("preserves an authored line break as a break token", () => {
    const { container } = render(<TextReveal as="h1" text={HERO} />);

    expect(container.querySelectorAll("br")).toHaveLength(1);
    expect(container.querySelectorAll(".text-reveal__mask")).toHaveLength(6);
    // The break replaces the newline; the words either side keep their spacing.
    expect(container.textContent).toBe("Protect revenue.Prove value. Move early.");
  });

  it("renders the plain unsplit string under reduced motion", () => {
    const { container } = render(<TextReveal as="h1" reducedMotion text={HERO} />);

    expect(container.querySelectorAll(".text-reveal__mask")).toHaveLength(0);
    expect(screen.getByRole("heading", { level: 1 })).toHaveAttribute("data-reduced-motion", "true");
    expect(container.textContent).toBe(HERO);
  });

  it("renders the requested element rather than always a span", () => {
    render(<TextReveal as="h2" text="Priority accounts" />);

    expect(screen.getByRole("heading", { level: 2, name: "Priority accounts" })).toBeInTheDocument();
  });
});
