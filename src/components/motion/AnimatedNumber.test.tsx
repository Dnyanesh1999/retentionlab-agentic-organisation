import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnimatedNumber } from "./AnimatedNumber";

const money = (value: number) => `€${Math.round(value).toLocaleString("en-IE")}`;

describe("AnimatedNumber", () => {
  it("names the element with the exact final figure, never an intermediate frame", () => {
    render(<AnimatedNumber format={money} value={9600} />);

    // The accessible name is the real value from the first frame onwards, so
    // assistive technology never hears a partial count.
    expect(screen.getByRole("img", { name: "€9,600" })).toBeInTheDocument();
  });

  it("settles on the exact value once the count finishes", async () => {
    const { container } = render(<AnimatedNumber format={money} value={9600} />);

    await waitFor(() => {
      expect(container.textContent).toBe("€9,600");
    });
  });

  it("renders the final value immediately under reduced motion", () => {
    const { container } = render(<AnimatedNumber format={money} reducedMotion value={9600} />);

    expect(container.textContent).toBe("€9,600");
    expect(screen.getByRole("img", { name: "€9,600" })).toHaveAttribute("data-reduced-motion", "true");
  });

  it("counts to a new figure when the underlying value changes", async () => {
    const { container, rerender } = render(<AnimatedNumber format={money} value={9600} />);
    await waitFor(() => expect(container.textContent).toBe("€9,600"));

    rerender(<AnimatedNumber format={money} value={12400} />);

    expect(screen.getByRole("img", { name: "€12,400" })).toBeInTheDocument();
    await waitFor(() => expect(container.textContent).toBe("€12,400"));
  });

  it("formats through the supplied formatter rather than assuming integers", () => {
    render(<AnimatedNumber format={(value) => `${value.toFixed(1)}%`} reducedMotion value={4.25} />);

    expect(screen.getByRole("img", { name: "4.3%" })).toBeInTheDocument();
  });
});
