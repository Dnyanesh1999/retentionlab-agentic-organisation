import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ArtifactGlyph } from "./ArtifactGlyph";
import { artifactGeometry, isArtifactHash } from "./glyphGeometry";

const researcher = "3f8a1c07d2b45e69a01f7c3d8e2b5049cd71ae36f0928b4d5c6e7a8b9c0d1e2f";
const designer = "9c2e5b71a4d038f6e7c1b920a5d4837e6f10c2b3a495d867e0f1a2b3c4d5e6f7";
// Differs from `researcher` only in its final byte: the mark must still change,
// or two artefacts sharing a prefix would be indistinguishable by eye.
const researcherTail = "3f8a1c07d2b45e69a01f7c3d8e2b5049cd71ae36f0928b4d5c6e7a8b9c0d1e30";

describe("artifactGeometry", () => {
  it("draws the same mark for the same artefact every time", () => {
    expect(artifactGeometry(researcher)).toEqual(artifactGeometry(researcher));
  });

  it("draws a different mark for a different artefact", () => {
    expect(artifactGeometry(researcher).body).not.toEqual(artifactGeometry(designer).body);
  });

  it("still differs when only the last byte of the hash differs", () => {
    const original = artifactGeometry(researcher);
    const altered = artifactGeometry(researcherTail);

    expect({ ...original }).not.toEqual({ ...altered });
  });

  it("moves for a change at every one of the 32 byte positions", () => {
    // The claim the mark makes is that a mismatched predecessor looks different.
    // That only holds if no byte of the hash is ignored, so every position is
    // checked rather than a sampled few — an earlier revision silently dropped
    // the last eight bytes and still passed a single-case test.
    const baseline = JSON.stringify(artifactGeometry(researcher));

    for (let position = 0; position < 32; position += 1) {
      const byte = Number.parseInt(researcher.slice(position * 2, position * 2 + 2), 16);
      const flipped = (byte ^ 0xff).toString(16).padStart(2, "0");
      const mutated = researcher.slice(0, position * 2) + flipped + researcher.slice(position * 2 + 2);

      expect(mutated).toHaveLength(64);
      expect(JSON.stringify(artifactGeometry(mutated)), `byte ${position} was ignored`)
        .not.toEqual(baseline);
    }
  });

  it("is symmetric about its vertical axis", () => {
    // Sampled through the rendered path rather than the internals: the mirrored
    // half is what makes the mark read as a seal instead of as noise. Every
    // number in the path is a coordinate and they alternate x, y — so the even
    // positions are the full set of x values, control points included.
    const { body } = artifactGeometry(researcher);
    const coordinates = [...body.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
    // The opening `M` repeats the point the closing curve lands on, so counting
    // it would leave that one coordinate unpaired.
    const xs = coordinates.slice(2).filter((_, index) => index % 2 === 0);

    const ascending = (a: number, b: number) => a - b;
    const original = [...xs].sort(ascending);
    const mirrored = xs.map((x) => 100 - x).sort(ascending);

    expect(xs.length).toBeGreaterThan(16);
    // Each coordinate is rounded to two decimals independently, so a mirrored
    // pair can land 0.01 apart. The tolerance covers that, not a lopsided mark.
    original.forEach((value, index) => {
      expect(value).toBeCloseTo(mirrored[index], 1);
    });
  });

  it("refuses anything that is not a 64-character SHA-256", () => {
    expect(() => artifactGeometry("not-a-hash")).toThrow(/64-character SHA-256/);
    expect(() => artifactGeometry(researcher.slice(0, 63))).toThrow(/64-character SHA-256/);
    expect(isArtifactHash(`${researcher}0`)).toBe(false);
    expect(isArtifactHash("Z".repeat(64))).toBe(false);
  });
});

describe("ArtifactGlyph", () => {
  it("renders a hidden decorative mark, never announced as content", () => {
    const { container } = render(<ArtifactGlyph sha256={researcher} />);
    const svg = container.querySelector("svg");

    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("role", "presentation");
    expect(svg).toHaveAttribute("focusable", "false");
  });

  it("renders nothing at all for a malformed identity", () => {
    // Fail closed: a seal that looks real is exactly what must never be faked.
    const { container } = render(<ArtifactGlyph sha256="pending" />);

    expect(container.querySelector("svg")).toBeNull();
  });

  it("does not schedule a draw-in under reduced motion", () => {
    const { container } = render(<ArtifactGlyph draw reducedMotion sha256={researcher} />);
    const path = container.querySelector(".artifact-glyph__body");

    expect(container.querySelector("svg")).toHaveAttribute("data-reduced-motion", "true");
    // A drawn-in outline starts clipped; under reduced motion it must be whole.
    expect(path).not.toHaveAttribute("stroke-dashoffset");
  });
});
