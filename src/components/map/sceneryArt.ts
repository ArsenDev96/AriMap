/**
 * Artwork for the Discover scenery, as plain drawing data (paths and circles in
 * px around each symbol's anchor, the middle of its base). Scenery.tsx turns it
 * into reusable SVG symbols. Colours come from CSS classes (Scenery.module.css),
 * so the same art can be recoloured, e.g. over a selected teal country.
 *
 * Style follows the landmark illustrations: soft two-tone fills, a light face
 * and a shaded face, restrained snow, and a soft ink outline on the silhouette
 * only (never along the ground).
 */

export type ArtLayer =
  | { cls: ArtClass; d: string }
  | { cls: ArtClass; circles: readonly (readonly [number, number, number])[] }
  | { cls: ArtClass; ellipse: readonly [number, number, number, number] };

export type ArtClass =
  | "shadow"
  | "outline"
  | "rock"
  | "rockShade"
  | "rockLight"
  | "snow"
  | "snowShade"
  | "hill"
  | "hillShade"
  | "hillBack"
  | "hillOutline"
  | "trunk"
  | "leafOutline"
  | "leafShade"
  | "leaf"
  | "leafLight"
  | "firOutline"
  | "fir"
  | "firShade"
  | "wave"
  | "waveSoft";

export interface Art {
  layers: readonly ArtLayer[];
  /** Footprint in px around the anchor, used for spacing and clearance. */
  box: { x0: number; y0: number; x1: number; y1: number };
}

const pts = (p: readonly (readonly [number, number])[]) => p.map(([x, y]) => `${x},${y}`).join(" ");
const poly = (p: readonly (readonly [number, number])[]) => `M${pts(p)}Z`;
const line = (p: readonly (readonly [number, number])[]) => `M${pts(p)}`;

/**
 * A mountain group: silhouette points (base to base, left to right), plus the
 * shaded faces, extra lit faces and snow caps drawn over it.
 */
function mountains(spec: {
  outline: [number, number][];
  shade: [number, number][][];
  light?: [number, number][][];
  snow?: [number, number][][];
  snowShade?: [number, number][][];
}): readonly ArtLayer[] {
  const xs = spec.outline.map((p) => p[0]);
  const w = (Math.max(...xs) - Math.min(...xs)) / 2;
  return [
    { cls: "shadow", ellipse: [0, 0.4, w * 0.95, 1.8] },
    { cls: "rock", d: poly(spec.outline) },
    ...spec.shade.map((p) => ({ cls: "rockShade" as const, d: poly(p) })),
    ...(spec.light ?? []).map((p) => ({ cls: "rockLight" as const, d: poly(p) })),
    ...(spec.snow ?? []).map((p) => ({ cls: "snow" as const, d: poly(p) })),
    ...(spec.snowShade ?? []).map((p) => ({ cls: "snowShade" as const, d: poly(p) })),
    // Soft outline along the skyline only, open at the ground.
    { cls: "outline", d: line(spec.outline) },
  ];
}

// Three ridge groups: a broad three-peak massif, a twin-peak ridge and a lone peak with a shoulder.
const MASSIF = {
  outline: [
    [-21, 0], [-17.4, -5.6], [-14.6, -10.4], [-12.4, -13.4], [-11, -14.4], [-9.6, -12.9], [-8.2, -13.3], [-5.6, -17.4],
    [-2.8, -21], [-0.8, -22.8], [0.8, -23.4], [2.4, -22.1], [4.6, -18.6], [6.2, -16.3], [7.6, -14.1], [9.2, -12.3],
    [10.6, -11.4], [12.1, -12.3], [13.3, -12.8], [14.8, -11], [17.2, -6.8], [19.5, -2.8], [21, 0],
  ] as [number, number][],
  shade: [
    [[0.8, -23.4], [2.4, -22.1], [4.6, -18.6], [6.2, -16.3], [7.6, -14.1], [9.2, -12.3], [10.6, -11.4], [12.1, -12.3], [13.3, -12.8], [14.8, -11], [17.2, -6.8], [19.5, -2.8], [21, 0], [2.8, 0], [1.6, -5.2], [2.8, -10.4], [1.2, -15.2], [2.2, -19]],
    [[-11, -14.4], [-9.6, -12.9], [-8.2, -13.3], [-7, -9.4], [-8.6, -4.6], [-7.6, 0], [-11, 0], [-10.2, -4.8], [-11.4, -9.4]],
  ] as [number, number][][],
  light: [[[10.6, -11.4], [12.1, -12.3], [13.3, -12.8], [13.8, -9.4], [12.6, -5.2], [13.6, 0], [6.4, 0], [8.8, -5.8]]] as [number, number][][],
  snow: [
    [[-3.6, -19.9], [-0.8, -22.8], [0.8, -23.4], [2.4, -22.1], [3.9, -19.8], [2.7, -19.3], [1.9, -20.3], [0.7, -18.7], [-0.7, -19.9], [-2.1, -18.8]],
    [[-12.5, -13.3], [-11, -14.4], [-9.9, -13.3], [-10.8, -12.6], [-11.5, -13.1], [-12.1, -12.5]],
  ] as [number, number][][],
  snowShade: [[[0.8, -23.4], [2.4, -22.1], [3.9, -19.8], [2.7, -19.3], [1.9, -20.3], [1.6, -21.4]]] as [number, number][][],
};

const TWIN = {
  outline: [
    [-18, 0], [-15, -5.2], [-11.8, -10.8], [-8.6, -16.2], [-6.6, -19.2], [-5.2, -19.8], [-3.8, -18.1], [-1.6, -14.8],
    [0.4, -13.2], [2.4, -14.2], [5.4, -15.1], [7.4, -16.1], [8.9, -15.3], [11.1, -11.8], [14, -6.8], [16.4, -2.6], [18, 0],
  ] as [number, number][],
  shade: [
    [[-5.2, -19.8], [-3.8, -18.1], [-1.6, -14.8], [0.4, -13.2], [0.8, -8], [-0.2, -3.2], [0.6, 0], [-4.9, 0], [-4, -5.2], [-5.4, -10.2], [-4.4, -15]],
    [[7.4, -16.1], [8.9, -15.3], [11.1, -11.8], [14, -6.8], [16.4, -2.6], [18, 0], [8.4, 0], [9.3, -5], [8.1, -10.4]],
  ] as [number, number][][],
  snow: [[[-8, -17.3], [-6.6, -19.2], [-5.2, -19.8], [-3.8, -18.1], [-2.9, -16.7], [-4, -17], [-4.8, -16.1], [-5.8, -17.3], [-6.8, -16.3]]] as [number, number][][],
  snowShade: [[[-5.2, -19.8], [-3.8, -18.1], [-2.9, -16.7], [-4, -17], [-4.6, -17.9]]] as [number, number][][],
};

const LONE = {
  outline: [
    [-15, 0], [-12.2, -5.2], [-9.2, -10.4], [-7.2, -12.1], [-5.5, -15.8], [-3.3, -19.6], [-1.4, -22], [0.3, -21.6],
    [2, -18.8], [3.6, -16.6], [5.3, -15.6], [7.1, -12.2], [10.1, -7.3], [13, -2.6], [15, 0],
  ] as [number, number][],
  shade: [
    [[-1.4, -22], [0.3, -21.6], [2, -18.8], [3.6, -16.6], [5.3, -15.6], [7.1, -12.2], [10.1, -7.3], [13, -2.6], [15, 0], [1.4, 0], [0.3, -6], [1.3, -12], [-0.2, -17]],
  ] as [number, number][][],
  snow: [[[-4.5, -18], [-3.3, -19.6], [-1.4, -22], [0.3, -21.6], [2, -18.8], [1, -18.2], [0, -19.3], [-1, -17.6], [-2.4, -18.7], [-3.4, -17.4]]] as [number, number][][],
  snowShade: [[[-1.4, -22], [0.3, -21.6], [2, -18.8], [1, -18.2], [0, -19.3], [-0.5, -20.5]]] as [number, number][][],
};

/** Same silhouettes as rocky peaks: lower (squashed) and without snow. */
function rocky(spec: typeof MASSIF | typeof TWIN | typeof LONE, squash = 0.78) {
  const s = (p: [number, number][]) => p.map(([x, y]) => [x, +(y * squash).toFixed(2)] as [number, number]);
  return mountains({ outline: s(spec.outline), shade: spec.shade.map(s), light: "light" in spec ? spec.light.map(s) : undefined });
}

const boxOf = (spec: { outline: [number, number][] }, squash = 1) => {
  const xs = spec.outline.map((p) => p[0]);
  const ys = spec.outline.map((p) => p[1] * squash);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: 1 };
};

// --- Hills ---------------------------------------------------------------------

const HILLS_A: readonly ArtLayer[] = [
  { cls: "shadow", ellipse: [0.5, 0.4, 13, 1.4] },
  { cls: "hillBack", d: "M-13,0C-11.6,-4.6 -8.2,-9.2 -3.6,-9.6C0.8,-10 4.4,-6.4 6.4,-2.6L7.4,0Z" },
  { cls: "hillShade", d: "M-3.6,-9.6C0.8,-10 4.4,-6.4 6.4,-2.6L7.4,0L-0.6,0C0.6,-3.6 -0.2,-7.2 -3.6,-9.6Z" },
  { cls: "hillOutline", d: "M-13,0C-11.6,-4.6 -8.2,-9.2 -3.6,-9.6C0.8,-10 4.4,-6.4 6.4,-2.6" },
  { cls: "hill", d: "M1,0C2.6,-3.4 5.2,-6.2 8.4,-6.2C11,-6.2 12.6,-3.4 13.6,0Z" },
  { cls: "hillShade", d: "M8.4,-6.2C11,-6.2 12.6,-3.4 13.6,0L9.4,0C10,-2.4 9.8,-4.6 8.4,-6.2Z" },
  { cls: "hillOutline", d: "M1,0C2.6,-3.4 5.2,-6.2 8.4,-6.2C11,-6.2 12.6,-3.4 13.6,0" },
];

const HILLS_B: readonly ArtLayer[] = [
  { cls: "shadow", ellipse: [0, 0.4, 14, 1.4] },
  { cls: "hill", d: "M-14,0C-12.4,-3.8 -9.8,-6.4 -6.8,-6.4C-4.4,-6.4 -3,-5 -1.6,-4.2C0,-6.8 2.8,-8.4 5.4,-8.4C9,-8.4 11.8,-5 14,0Z" },
  { cls: "hillShade", d: "M5.4,-8.4C9,-8.4 11.8,-5 14,0L6.2,0C7.4,-3 7.2,-6 5.4,-8.4Z" },
  { cls: "hillShade", d: "M-6.8,-6.4C-4.4,-6.4 -3,-5 -1.6,-4.2L-2.6,0L-5.2,0C-4.6,-2.6 -5.2,-4.6 -6.8,-6.4Z" },
  { cls: "hillOutline", d: "M-14,0C-12.4,-3.8 -9.8,-6.4 -6.8,-6.4C-4.4,-6.4 -3,-5 -1.6,-4.2C0,-6.8 2.8,-8.4 5.4,-8.4C9,-8.4 11.8,-5 14,0" },
];

// --- Trees ---------------------------------------------------------------------

type Crown = { x: number; top: number; r: number };

/**
 * A clump of broadleaf trees, back to front. Each crown is three overlapping
 * circles; one outline is drawn under all fills, so crowns merge into one
 * cohesive silhouette with a soft edge. Shade sits low on the right, light high
 * on the left.
 */
function broadleaf(crowns: Crown[]): readonly ArtLayer[] {
  const lobes = (c: Crown, grow = 0, dx = 0, dy = 0) =>
    [
      [c.x - c.r * 0.55 + dx, c.top + c.r * 1.25 + dy, c.r * 0.72 + grow],
      [c.x + c.r * 0.5 + dx, c.top + c.r * 1.1 + dy, c.r * 0.78 + grow],
      [c.x + dx, c.top + c.r * 0.72 + dy, c.r * 0.74 + grow],
    ] as [number, number, number][];
  const layers: ArtLayer[] = [
    { cls: "shadow", ellipse: [0, 0.5, 10, 1.6] },
    { cls: "trunk", d: crowns.map((c) => `M${c.x},${(c.top + c.r * 1.7).toFixed(1)}V0.3`).join("") },
  ];
  for (const c of crowns) {
    layers.push({ cls: "leafOutline", circles: lobes(c, 0.75) });
    layers.push({ cls: "leafShade", circles: lobes(c) });
    layers.push({ cls: "leaf", circles: lobes(c, -0.7, -0.7, -0.8) });
    layers.push({ cls: "leafLight", circles: [[c.x - c.r * 0.45, c.top + c.r * 0.8, c.r * 0.28]] });
  }
  return layers;
}

type Fir = { x: number; h: number; w: number };

/** A fir: three tiers with slightly ragged edges; the right half is shaded. */
function firPath({ x, h, w }: Fir, half?: "right"): string {
  const top = -h - 1.5;
  const tiers = [
    [top + h * 0.34, w * 0.34, w * 0.2],
    [top + h * 0.64, w * 0.44, w * 0.3],
    [-2.2, w * 0.5, 0],
  ] as const;
  const right: [number, number][] = [];
  for (const [y, out, back] of tiers) {
    right.push([x + out, y]);
    if (back) right.push([x + back, y - 0.4]);
  }
  const r = right.map(([px, py]) => [+px.toFixed(2), +py.toFixed(2)] as [number, number]);
  if (half === "right") return poly([[x, top], ...r, [x, -2.2]]);
  const l = r.map(([px, py]) => [+(2 * x - px).toFixed(2), py] as [number, number]).reverse();
  return poly([[x, top], ...r, ...l]);
}

function conifers(firs: Fir[]): readonly ArtLayer[] {
  const layers: ArtLayer[] = [
    { cls: "shadow", ellipse: [0, 0.5, 10, 1.6] },
    { cls: "trunk", d: firs.map((f) => `M${f.x},-2.4V0.3`).join("") },
  ];
  for (const f of firs) {
    layers.push({ cls: "firOutline", d: firPath(f) });
    layers.push({ cls: "fir", d: firPath(f) });
    layers.push({ cls: "firShade", d: firPath(f, "right") });
  }
  return layers;
}

export type ArtId =
  | "alpineMassif"
  | "alpineTwin"
  | "alpineLone"
  | "rockyMassif"
  | "rockyTwin"
  | "rockyLone"
  | "hillsA"
  | "hillsB"
  | "broadleafA"
  | "broadleafB"
  | "coniferA"
  | "coniferB"
  | "wave";

export const ART: Record<ArtId, Art> = {
  alpineMassif: { layers: mountains(MASSIF), box: boxOf(MASSIF) },
  alpineTwin: { layers: mountains(TWIN), box: boxOf(TWIN) },
  alpineLone: { layers: mountains(LONE), box: boxOf(LONE) },
  rockyMassif: { layers: rocky(MASSIF), box: boxOf(MASSIF, 0.78) },
  rockyTwin: { layers: rocky(TWIN), box: boxOf(TWIN, 0.78) },
  rockyLone: { layers: rocky(LONE), box: boxOf(LONE, 0.78) },
  hillsA: { layers: HILLS_A, box: { x0: -13, y0: -10, x1: 13.6, y1: 1 } },
  hillsB: { layers: HILLS_B, box: { x0: -14, y0: -8.5, x1: 14, y1: 1 } },
  broadleafA: {
    layers: broadleaf([
      { x: -4.6, top: -16, r: 5.2 },
      { x: 4.8, top: -13, r: 4.6 },
      { x: 0.4, top: -9.6, r: 4.2 },
    ]),
    box: { x0: -10, y0: -16.5, x1: 9.8, y1: 2 },
  },
  broadleafB: {
    layers: broadleaf([
      { x: 3.8, top: -15, r: 5 },
      { x: -4.2, top: -11.4, r: 4.4 },
    ]),
    box: { x0: -9, y0: -15.5, x1: 9, y1: 2 },
  },
  coniferA: {
    layers: conifers([
      { x: -4.2, h: 15, w: 8.4 },
      { x: 4.4, h: 11.5, w: 7.4 },
      { x: 0.4, h: 9, w: 6.6 },
    ]),
    box: { x0: -8.6, y0: -16.5, x1: 8.2, y1: 2 },
  },
  coniferB: {
    layers: conifers([
      { x: 3.2, h: 16, w: 8.6 },
      { x: -4.4, h: 12, w: 7.6 },
    ]),
    box: { x0: -8.4, y0: -17.5, x1: 7.6, y1: 2 },
  },
  wave: {
    layers: [
      { cls: "wave", d: "M-9,0Q-6.75,-3 -4.5,0T0,0 4.5,0 9,0" },
      { cls: "waveSoft", d: "M-5,1.4Q-3.5,-0.4 -2,1.4" },
    ],
    box: { x0: -9, y0: -3.5, x1: 9, y1: 1.5 },
  },
};
