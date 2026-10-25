import type { CountryId } from "@/core/content/types";
import type { Point } from "@/geo/regionMap";
import { textWidth } from "../theme/textWidth";

/**
 * Where the lesson map's country names go, on screen. A simpler cousin of the website's label layout
 * (src/components/map/RegionMap.tsx): each name is centred on its country's label point, moved to the nearest clear
 * place (up or down a line or two, or a little sideways) where a marker (a capital, a landmark, the traveller), a
 * name already placed or the map's buttons are in the way, and kept within the map; a small country
 * (`map.smallCountries`, Level 1's Luxembourg) narrower on screen than its name gets a callout beside it with a
 * leader line to its label point, as on the website, until zooming makes it wide enough. A leader never crosses a
 * name, marker, ring or button, and no name is placed on a leader (as the website's mapNames.ts keeps them apart).
 * Pure, so it is tested.
 */

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface LabelRequest {
  id: CountryId;
  text: string;
  /** The country's label point, on screen. */
  anchor: Point;
  /** The country's width on screen. */
  width: number;
  small: boolean;
  /** Room after the name for Discover's explored check. */
  badge: boolean;
  /** Whether a point on screen is on the country: a name moved off it is joined to it by a leader. */
  covers?: (p: Point) => boolean;
}

export interface PlacedLabel {
  id: CountryId;
  /** The name's centre. */
  at: Point;
  box: Box;
  /**
   * A callout: the name in a pill, with a leader from the anchor. A small country's, or a name that found no clear
   * place on its own country (Level 4's Montenegro in Armenian at 200% text, beside the map's buttons).
   */
  callout: { anchor: Point } | null;
}

export const LABEL_FONT = 13;
export const BADGE_SIZE = 12;
const CALLOUT_PAD = 8;
const CALLOUT_REACH = 30;

export { textWidth };

const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/** Whether the segment p→q passes through the box's inside (Liang–Barsky clipping; touching an edge is no crossing). */
export function crosses([px, py]: Point, [qx, qy]: Point, b: Box): boolean {
  const [dx, dy] = [qx - px, qy - py];
  let [t0, t1] = [0, 1];
  for (const [p, q] of [
    [-dx, px - b.x0],
    [dx, b.x1 - px],
    [-dy, py - b.y0],
    [dy, b.y1 - py],
  ]) {
    if (p === 0) {
      if (q <= 0) return false;
    } else {
      const r = q / p;
      if (p < 0) t0 = Math.max(t0, r);
      else t1 = Math.min(t1, r);
      if (t0 >= t1) return false;
    }
  }
  return true;
}
const inside = (b: Box, w: number, h: number) => b.x0 >= 0 && b.y0 >= 0 && b.x1 <= w && b.y1 <= h;

function boxAt([x, y]: Point, width: number, height: number): Box {
  return { x0: x - width / 2, y0: y - height / 2, x1: x + width / 2, y1: y + height / 2 };
}

/**
 * The names' places, in `requests`' order (small countries' callouts last). A name with no clear place is drawn where
 * it fits best anyway, over what is there, unless `onlyClear`: then it is left out until zooming makes room (the
 * Quick Challenge's map, which names up to fifteen countries at once, as the website's does).
 */
export function placeLabels(
  requests: readonly LabelRequest[],
  obstacles: readonly Box[],
  viewport: { width: number; height: number },
  fontSize = LABEL_FONT,
  onlyClear = false,
): PlacedLabel[] {
  const { width: vw, height: vh } = viewport;
  const lineHeight = fontSize * 1.25;
  const taken: Box[] = [...obstacles];
  const placed: PlacedLabel[] = [];
  /** Leaders drawn so far, from a country's label point to its name's centre. */
  const leaders: [Point, Point][] = [];
  /** A box clear of what is taken and of every leader. */
  const free = (b: Box) => !taken.some((t) => overlaps(b, t)) && !leaders.some(([p, q]) => crosses(p, q, b));
  // Small countries' callouts last: the larger names keep their own points.
  const order = [...requests].sort((a, b) => Number(a.small) - Number(b.small));
  for (const r of order) {
    const [ax, ay] = r.anchor;
    // A country whose label point is off the map is not named.
    if (ax < 0 || ay < 0 || ax > vw || ay > vh) continue;
    const textW = textWidth(r.text, fontSize) + (r.badge ? BADGE_SIZE + 4 : 0);
    const centre = (b: Box): Point => [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];
    /**
     * Whether a leader from the label point to a name at `b` would cross nothing taken (but what the label point is
     * under, which any leader from it starts in: Level 10's Finland, under the map's buttons).
     */
    const leaderClear = (b: Box) => !taken.some((t) => !(ax > t.x0 && ax < t.x1 && ay > t.y0 && ay < t.y1) && crosses(r.anchor, centre(b), t));
    // A callout beside the country, then above or below it, then further out: the first clear of names, markers and
    // the map's buttons (undefined where none is), or the first on the map (`anyway`).
    const calloutBox = (anyway: boolean): Box | undefined => {
      const w = textW + 2 * CALLOUT_PAD;
      const h = lineHeight + CALLOUT_PAD;
      const spots: Point[] = [1, 1.8].flatMap((reach) => [
        [ax + CALLOUT_REACH * reach + w / 2, ay + CALLOUT_REACH * 0.6 * reach],
        [ax + CALLOUT_REACH * reach + w / 2, ay - CALLOUT_REACH * 0.6 * reach],
        [ax - CALLOUT_REACH * reach - w / 2, ay + CALLOUT_REACH * 0.6 * reach],
        [ax - CALLOUT_REACH * reach - w / 2, ay - CALLOUT_REACH * 0.6 * reach],
        [ax, ay + CALLOUT_REACH * reach + h / 2],
        [ax, ay - CALLOUT_REACH * reach - h / 2],
      ] as Point[]);
      const fits = spots.map((p) => boxAt(p, w, h)).filter((b) => inside(b, vw, vh));
      return fits.find((b) => free(b) && leaderClear(b)) ?? (anyway ? fits[0] : undefined);
    };
    if (r.small && r.width < textW) {
      const box = calloutBox(!onlyClear);
      if (!box) continue;
      taken.push(box);
      leaders.push([r.anchor, centre(box)]);
      placed.push({ id: r.id, at: centre(box), box, callout: { anchor: r.anchor } });
      continue;
    }
    // Kept on the map: a name near its edge moves in rather than being cut.
    const onMap = (b: Box): Box => {
      const dx = b.x0 < 2 ? 2 - b.x0 : b.x1 > vw - 2 ? vw - 2 - b.x1 : 0;
      const dy = b.y0 < 2 ? 2 - b.y0 : b.y1 > vh - 2 ? vh - 2 - b.y1 : 0;
      return { x0: b.x0 + dx, x1: b.x1 + dx, y0: b.y0 + dy, y1: b.y1 + dy };
    };
    const rows = [0, -1, 1, -2, 2].map((n) => onMap(boxAt([ax, ay + n * lineHeight], textW, lineHeight)));
    // Each row also slid sideways just clear of what is in the way (the map's buttons are taller than the names'
    // moves up and down), by at most half the name, so it stays over its country.
    const slid = rows.flatMap((b) =>
      taken
        .filter((t) => overlaps(b, t))
        .flatMap((t) => [t.x0 - 2 - b.x1, t.x1 + 2 - b.x0])
        .filter((dx) => Math.abs(dx) <= textW / 2)
        .map((dx) => ({ x0: b.x0 + dx, x1: b.x1 + dx, y0: b.y0, y1: b.y1 }))
        .filter((s) => inside(s, vw, vh)),
    );
    // The clear place nearest the label point with its centre on the country, else the nearest clear place, else a
    // callout further out (Level 10's Finland, its label point under the map's buttons and beside the traveller):
    // the last two joined to the country by a leader.
    const away = (b: Box) => Math.hypot(centre(b)[0] - ax, centre(b)[1] - ay);
    const nearest = (boxes: Box[]) => (boxes.length ? boxes.reduce((best, b) => (away(b) < away(best) ? b : best)) : undefined);
    const clear = [...rows, ...slid].filter(free);
    const onCountry = (b: Box) => !r.covers || r.covers(centre(b));
    // Off its country, a name needs a leader that crosses nothing.
    const near = nearest(clear.filter(onCountry)) ?? nearest(clear.filter(leaderClear));
    const clearBox = near ?? calloutBox(false);
    if (!clearBox && onlyClear) continue;
    const box = clearBox ?? rows[0];
    const leader = near ? !onCountry(near) : box !== rows[0];
    taken.push(box);
    if (leader) leaders.push([r.anchor, centre(box)]);
    placed.push({ id: r.id, at: centre(box), box, callout: leader ? { anchor: r.anchor } : null });
  }
  return placed;
}
