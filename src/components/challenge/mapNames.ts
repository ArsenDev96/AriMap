import { RING_RADIUS, type Ring } from "@/core/challenge/smallCountries";
import type { CountryId } from "@/core/content/types";
import type { CountryShape, Point } from "@/geo/regionMap";
import { insideShape } from "../map/insideShape";
import { textWidth } from "../map/textWidth";

/**
 * Where the Quick Challenge's map names its countries once a round has ended (its results and review): a few fixed
 * spots per name, tried in order, never a search. In screen pixels of the view drawn (the map's stage).
 */

/** A box on the map's screen, in CSS pixels from its top-left corner. */
export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * A name placed on the map: its middle and font size, and for a name away from its country (beside its ring, or
 * moved off a country too small for it) a leader from the country (`dot`: a dot at its label point) or the ring's
 * edge to the name's box.
 */
export interface PlacedName {
  id: CountryId;
  x: number;
  y: number;
  text: string;
  size: number;
  leader: { from: Point; to: Point; dot: boolean } | null;
}

/**
 * Names' font sizes (px): on a map narrower than COMPACT_MAP_WIDTH a step smaller, as the levels' (RegionMap.tsx's
 * COMPACT_LABEL_FONT_PX); the review's selected country's a step larger. Bold (ChallengeMap.module.css's .name).
 */
const NAME_FONT_PX = 13;
const COMPACT_NAME_FONT_PX = 12;
const FOCUS_NAME_STEP = 2;
const COMPACT_MAP_WIDTH = 420;
const NAME_WEIGHT = 800;
/** Room kept between a name and another name, a leader, a ring, a button or the map's edge (px). */
const NAME_GAP = 2;
/** A ring's white halo reaches this far past its radius (half .ringHalo's stroke). */
const RING_HALO = 1.75;
/** A ring country's name stands this far off its ring, so the leader between them shows (px). */
const RING_LEADER = 7;
/** A leader's dot: no name covers it (px round its label point). */
const DOT_ROOM = 4;
/** Points checked along a name's middle (see readsAsOwn), the end ones this far in from its ends (px): as the levels'. */
const FIT_SAMPLES = 5;
const FIT_INSET = 3;

/**
 * Where a name may go on its own country, nearest first, as offsets from its label point in its box's widths and
 * heights: on the point, just above or below it, a third of its width to either side. As the levels' names first try
 * their own (RegionMap.tsx's labelSpot).
 */
const NAME_SPOTS: readonly Point[] = [
  [0, 0],
  [0, -0.9],
  [0, 0.9],
  [-0.33, 0],
  [0.33, 0],
];
/**
 * Failing those, for a country large enough on screen to hold the name's middle there (its bounding box): two thirds of
 * its width to either side, then in eight directions (up, down, the diagonals, the sides) at FAR_RADII of its line
 * height (Italy's, for one, can go down the boot).
 */
const FAR_SIDE = 0.66;
const FAR_RADII = [1.8, 2.7];
const FAR_ANGLES = [-90, 90, 45, 135, -45, -135, 0, 180].map((deg) => (deg * Math.PI) / 180);
/**
 * Where a name that reads as its country's at none of those goes instead, with a leader to its label point: just off
 * the point, above, below, to either side, then diagonally, then a little further above and below. Nearest first, so
 * leaders stay short. A name with no room at any spot is left out of this view; zoomed in, it finds one.
 */
const CALLOUT_SPOTS: readonly Point[] = [
  [0, -1.2],
  [0, 1.2],
  [0.8, 0],
  [-0.8, 0],
  [0.62, -1.1],
  [-0.62, -1.1],
  [0.62, 1.1],
  [-0.62, 1.1],
  [0, -2],
  [0, 2],
];

const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const grow = (b: Box, d: number): Box => ({ x0: b.x0 - d, y0: b.y0 - d, x1: b.x1 + d, y1: b.y1 + d });
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Nearest point of a box to `p`: where a leader from `p` meets it. */
const nearestOn = (b: Box, [x, y]: Point): Point => [clamp(x, b.x0, b.x1), clamp(y, b.y0, b.y1)];

/** Whether the segment a→b passes through the box (sampled every 2px), as RegionMap.tsx's segmentHits. */
function segmentHits(a: Point, b: Point, box: Box): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2));
  for (let i = 0; i <= steps; i++) {
    const x = a[0] + ((b[0] - a[0]) * i) / steps;
    const y = a[1] + ((b[1] - a[1]) * i) / steps;
    if (x > box.x0 && x < box.x1 && y > box.y0 && y < box.y1) return true;
  }
  return false;
}

export interface NameLayoutInput {
  /** Most important first; `focus`'s is placed before them all. */
  names: readonly CountryId[];
  focus: CountryId | null | undefined;
  /** Each name's label point on screen. */
  anchors: ReadonlyMap<CountryId, Point>;
  /** The rings shown, on screen; a ring country's name goes beside its ring. */
  rings: readonly Ring[];
  /** The map's buttons over it, on screen. */
  chrome: readonly Box[];
  size: { width: number; height: number };
  /** Every shape drawn (for whether a name reads as its country's), and screen to world. */
  shapes: readonly CountryShape[];
  toWorld: (p: Point) => Point;
  /** Bounding boxes of the named countries, on screen. */
  bounds: ReadonlyMap<CountryId, Box>;
  name: (id: CountryId) => string;
}

/**
 * The names drawn for a view: `focus`'s first, then `names` in order, each at the first of its spots that lies inside
 * the map, clear of every name and leader already placed, every ring and the map's buttons. A name first tries its own
 * country (NAME_SPOTS, then the far spots: FAR_SIDE, FAR_RADII), where it must read as that country's (readsAsOwn);
 * then a callout beside it
 * with a leader to its label point (CALLOUT_SPOTS). A ring country's name goes beside its ring (above, below, right,
 * left), with a short leader to it. At most a few dozen boxes are tried per name.
 */
export function placeNames({ names, focus, anchors, rings, chrome, size, shapes, toWorld, bounds, name }: NameLayoutInput): PlacedName[] {
  const font = size.width < COMPACT_MAP_WIDTH ? COMPACT_NAME_FONT_PX : NAME_FONT_PX;
  const ringBox = ({ x, y }: Ring): Box => grow({ x0: x, y0: y, x1: x, y1: y }, RING_RADIUS + RING_HALO);
  const ringBoxes = rings.map(ringBox);
  const shapeById = new Map(shapes.map((s) => [s.id, s]));
  const taken: Box[] = [];
  const leaders: [Point, Point][] = [];
  const placed: PlacedName[] = [];

  /**
   * Whether a name centred at (x, y), `w` wide, reads as its country's: its middle on the country, and each point
   * along its middle on the country or on the sea, never on another country (as the levels' fitsInside).
   */
  const readsAsOwn = (id: CountryId, x: number, y: number, w: number) => {
    const own = shapeById.get(id);
    if (!own || !insideShape(own, toWorld([x, y]))) return false;
    for (let i = 0; i < FIT_SAMPLES; i++) {
      const p = toWorld([x - w / 2 + FIT_INSET + ((w - 2 * FIT_INSET) * i) / (FIT_SAMPLES - 1), y]);
      if (!insideShape(own, p) && shapes.some((s) => s.id !== id && insideShape(s, p))) return false;
    }
    return true;
  };
  /** Whether a box, and the leader to it, are clear of the map's edge and of everything placed so far. */
  const clear = (box: Box, leader: [Point, Point] | null, ownRing: Box | null) => {
    const room = grow(box, NAME_GAP);
    if (room.x0 < 0 || room.y0 < 0 || room.x1 > size.width || room.y1 > size.height) return false;
    if ([...taken, ...ringBoxes, ...chrome].some((o) => overlaps(room, o))) return false;
    if (leaders.some(([a, b]) => segmentHits(a, b, room))) return false;
    if (!leader) return true;
    const [a, b] = leader;
    return ![...taken, ...chrome, ...ringBoxes.filter((r) => r !== ownRing)].some((o) => segmentHits(a, b, o));
  };

  const order = focus && names.includes(focus) ? [focus, ...names.filter((id) => id !== focus)] : names;
  for (const id of order) {
    const ring = rings.find((r) => r.id === id);
    const anchor: Point | undefined = ring ? [ring.x, ring.y] : anchors.get(id);
    if (!anchor) continue;
    const [ax, ay] = anchor;
    if (ax < 0 || ay < 0 || ax > size.width || ay > size.height) continue;
    const text = name(id);
    const fontSize = id === focus ? font + FOCUS_NAME_STEP : font;
    // Its box: the text's width, and the glyphs' height with room for Armenian's taller ascenders and descenders.
    const [w, h] = [textWidth(text, fontSize, NAME_WEIGHT), fontSize + 8];
    const boxAt = (x: number, y: number): Box => ({ x0: x - w / 2, y0: y - h / 2, x1: x + w / 2, y1: y + h / 2 });
    const place = (x: number, y: number, leader: PlacedName["leader"]) => {
      const box = boxAt(x, y);
      taken.push(box);
      if (leader) {
        leaders.push([leader.from, leader.to]);
        if (leader.dot) taken.push(grow({ x0: ax, y0: ay, x1: ax, y1: ay }, DOT_ROOM));
      }
      placed.push({ id, x, y, text, size: fontSize, leader });
    };

    if (ring) {
      const own = ringBox(ring);
      const reach = RING_RADIUS + RING_HALO + RING_LEADER;
      const spots: Point[] = [
        [0, -(reach + h / 2)],
        [0, reach + h / 2],
        [reach + w / 2, 0],
        [-(reach + w / 2), 0],
      ];
      for (const [dx, dy] of spots) {
        const box = boxAt(ax + dx, ay + dy);
        const to = nearestOn(box, anchor);
        const d = Math.hypot(to[0] - ax, to[1] - ay) || 1;
        const from: Point = [ax + ((to[0] - ax) * (RING_RADIUS + RING_HALO)) / d, ay + ((to[1] - ay) * (RING_RADIUS + RING_HALO)) / d];
        if (!clear(box, [from, to], own)) continue;
        place(ax + dx, ay + dy, { from, to, dot: false });
        break;
      }
      continue;
    }

    const own = bounds.get(id);
    // Offsets in pixels: the near spots, then the far ones whose middle lies within the country's bounding box.
    const far: Point[] = [
      [-FAR_SIDE * w, 0],
      [FAR_SIDE * w, 0],
      ...FAR_RADII.flatMap((r) => FAR_ANGLES.map((a): Point => [r * h * Math.cos(a), r * h * Math.sin(a)])),
    ];
    const onCountry: Point[] = [
      ...NAME_SPOTS.map(([sx, sy]): Point => [sx * w, sy * h]),
      ...far.filter(([dx, dy]) => own && ax + dx > own.x0 && ax + dx < own.x1 && ay + dy > own.y0 && ay + dy < own.y1),
    ];
    const spot = onCountry.find(([dx, dy]) => clear(boxAt(ax + dx, ay + dy), null, null) && readsAsOwn(id, ax + dx, ay + dy, w));
    if (spot) {
      place(ax + spot[0], ay + spot[1], null);
      continue;
    }
    const dotRoom = grow({ x0: ax, y0: ay, x1: ax, y1: ay }, DOT_ROOM);
    for (const [sx, sy] of CALLOUT_SPOTS) {
      const [x, y] = [ax + sx * w, ay + sy * h];
      const box = boxAt(x, y);
      if (overlaps(grow(box, NAME_GAP), dotRoom) || [...taken, ...ringBoxes].some((o) => overlaps(dotRoom, o))) continue;
      const to = nearestOn(box, anchor);
      if (!clear(box, [anchor, to], null)) continue;
      place(x, y, { from: anchor, to, dot: true });
      break;
    }
  }
  return placed;
}
