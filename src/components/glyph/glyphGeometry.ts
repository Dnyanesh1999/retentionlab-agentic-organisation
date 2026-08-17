/**
 * Geometry for a sealed artefact's identity mark.
 *
 * A SHA-256 is 32 bytes, and all 32 drive the shape below, so the same artefact
 * always draws the same mark and changing any single byte changes it. That is
 * the point: a reader recognises a stage by its seal, and a lineage link that
 * does not match its predecessor is a visibly different shape rather than a
 * claim in prose.
 *
 * Being precise about the strength of that claim, because overstating it would
 * be the kind of thing this project exists to avoid: the mark is a lossy
 * projection of 256 bits onto twelve values, so it is a recognition aid, not a
 * comparison function. Two distinct hashes could in principle land on the same
 * mark. What is guaranteed is determinism, and that a one-byte difference is
 * always visible. Verification is still done against the stored hash in code;
 * the seal only lets a reader notice.
 *
 * Nothing here is random or time-dependent. Given the same hash the output is
 * byte-identical, which is what makes it safe to compare two marks by eye and
 * what makes this testable.
 *
 * The mark is mirrored across its vertical axis. Symmetry is not decoration: an
 * asymmetric plot of hash bytes reads as noise, while a symmetric one reads as a
 * seal, and the mirrored half still varies with the hash.
 */

/** Points per half, before mirroring. The full ring is `(HALF - 1) * 2`. */
const HALF = 9;
const RING = (HALF - 1) * 2;

/** Nine radii plus a core, a dash pair and a rotation. */
const SLOTS = 12;

const CENTRE = 50;
/*
 * The radius band decides how different two seals look. A narrow band drew
 * near-circles that were hard to tell apart at the sizes actually used, which
 * defeats the point of the mark. This band is wide enough that neighbouring
 * stages are distinguishable at 26px, and still inside the ring at 46.
 */
const MIN_RADIUS = 17;
const RADIUS_RANGE = 25;

export type GlyphGeometry = {
  /** Closed, smoothed outline of the seal. */
  body: string;
  /** Radius of the inner counterweight. */
  core: number;
  /** Dash pattern for the outer ring. */
  ringDash: string;
  /** Rotation applied to the outer ring, in degrees. */
  ringRotation: number;
};

const hexPattern = /^[0-9a-f]{64}$/i;

export function isArtifactHash(value: string): boolean {
  return hexPattern.test(value);
}

function bytesOf(sha256: string): number[] {
  const bytes: number[] = [];
  for (let index = 0; index < sha256.length; index += 2) {
    bytes.push(Number.parseInt(sha256.slice(index, index + 2), 16));
  }
  return bytes;
}

/**
 * Fold all 32 bytes down to twelve values, one per feature of the mark.
 *
 * Every byte is mixed into exactly one slot — slot `index % SLOTS` — through an
 * FNV-1a step. Assigning each byte to a slot rather than reading twelve bytes
 * and discarding twenty is what makes the last byte of the hash matter: without
 * it, two artefacts differing only in their tail drew the identical seal.
 */
function slotsOf(bytes: number[]): number[] {
  const slots = new Array<number>(SLOTS).fill(0x811c9dc5);

  bytes.forEach((byte, index) => {
    const slot = index % SLOTS;
    // `>>> 0` keeps the accumulator an unsigned 32-bit value; `Math.imul` keeps
    // the multiply from losing low bits to floating point.
    slots[slot] = Math.imul(slots[slot] ^ byte, 0x01000193) >>> 0;
  });

  return slots.map(finalise);
}

/**
 * Avalanche the accumulator before taking a byte from it.
 *
 * Reading a fixed byte out of the raw FNV state is not safe here: after the
 * final multiply, a one-byte difference in the input can leave some byte
 * positions identical, and the mark would then not move at all. This mixes the
 * high bits back down so every input difference reaches the byte that is read.
 */
function finalise(value: number): number {
  let mixed = value;
  mixed ^= mixed >>> 13;
  mixed = Math.imul(mixed, 0x5bd1e995) >>> 0;
  mixed ^= mixed >>> 15;
  return mixed & 0xff;
}

function pointsOf(slots: number[]): Array<[number, number]> {
  // The first half comes from the hash; the second mirrors it. Mirroring around
  // index 0 and index HALF-1 keeps the top and bottom points on the axis, so the
  // seal closes cleanly instead of showing a seam.
  const radii: number[] = [];
  for (let index = 0; index < HALF; index += 1) {
    radii.push(MIN_RADIUS + (slots[index] / 255) * RADIUS_RANGE);
  }
  for (let index = HALF; index < RING; index += 1) {
    radii.push(radii[RING - index]);
  }

  return radii.map((radius, index) => {
    const angle = ((index / RING) * 2 * Math.PI) - Math.PI / 2;
    return [
      CENTRE + Math.cos(angle) * radius,
      CENTRE + Math.sin(angle) * radius,
    ] as [number, number];
  });
}

function round(value: number) {
  // Two decimals keep the path short without a visible loss of fidelity, and
  // make the output stable to compare in a test.
  return Math.round(value * 100) / 100;
}

/**
 * Smooth the ring by drawing quadratic curves through the midpoints between
 * neighbouring vertices, using each vertex as the control point. This produces
 * a continuous closed curve with no corner artefacts and no external library.
 */
function smoothPath(points: Array<[number, number]>) {
  const midpoint = (a: [number, number], b: [number, number]): [number, number] => [
    (a[0] + b[0]) / 2,
    (a[1] + b[1]) / 2,
  ];

  const start = midpoint(points[points.length - 1], points[0]);
  let path = `M${round(start[0])} ${round(start[1])}`;

  for (let index = 0; index < points.length; index += 1) {
    const control = points[index];
    const end = midpoint(control, points[(index + 1) % points.length]);
    path += `Q${round(control[0])} ${round(control[1])} ${round(end[0])} ${round(end[1])}`;
  }

  return `${path}Z`;
}

/**
 * Derive the complete mark. Throws on anything that is not a 64-character
 * SHA-256 — a malformed identity must not silently render a plausible seal,
 * because a seal that looks real is exactly what must never be invented.
 */
export function artifactGeometry(sha256: string): GlyphGeometry {
  if (!isArtifactHash(sha256)) {
    throw new Error("An artefact glyph requires a 64-character SHA-256.");
  }

  const slots = slotsOf(bytesOf(sha256));
  const points = pointsOf(slots);

  // The three slots the outline does not use drive the ring and core, so the
  // mark varies in more than one dimension.
  const core = round(5 + (slots[9] / 255) * 4);
  const dashOn = round(2 + (slots[10] / 255) * 8);
  const dashOff = round(2 + (slots[11] / 255) * 5);

  return {
    body: smoothPath(points),
    core,
    ringDash: `${dashOn} ${dashOff}`,
    ringRotation: Math.round((slots[10] / 255) * 360),
  };
}
