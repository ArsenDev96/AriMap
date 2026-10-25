import type { CountryId } from "@/core/content/types";
import type { Point } from "@/geo/regionMap";

/**
 * Where the lesson map's country names go, on screen. A simpler cousin of the website's label layout
 * (src/components/map/RegionMap.tsx): each name is centred on its country's label point, moved up or down where a
 * marker (a capital, a landmark, the traveller) or a name already placed is in the way; a small country
 * (`map.smallCountries`, Level 1's Luxembourg) narrower on screen than its name gets a callout beside it with a
 * leader line to its label point, as on the website, until zooming makes it wide enough. Pure, so it is tested.
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
}

export interface PlacedLabel {
  id: CountryId;
  /** The name's centre. */
  at: Point;
  box: Box;
  /** A small country's callout: its box (a pill around the name) and the leader from the anchor. */
  callout: { anchor: Point } | null;
}

export const LABEL_FONT = 13;
export const BADGE_SIZE = 12;
const CALLOUT_PAD = 8;
const CALLOUT_REACH = 30;

/**
 * A name's width on screen, from its length, a little generous: bold letters of Android's system font average
 * about 0.5 em in Latin and 0.66 em in Armenian (measured on the lesson map).
 */
export function textWidth(text: string, fontSize: number): number {
  return text.length * fontSize * (/[԰-֏]/.test(text) ? 0.7 : 0.56);
}

const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const inside = (b: Box, w: number, h: number) => b.x0 >= 0 && b.y0 >= 0 && b.x1 <= w && b.y1 <= h;

function boxAt([x, y]: Point, width: number, height: number): Box {
  return { x0: x - width / 2, y0: y - height / 2, x1: x + width / 2, y1: y + height / 2 };
}

export function placeLabels(requests: readonly LabelRequest[], obstacles: readonly Box[], viewport: { width: number; height: number }, fontSize = LABEL_FONT): PlacedLabel[] {
  const { width: vw, height: vh } = viewport;
  const lineHeight = fontSize * 1.25;
  const taken: Box[] = [...obstacles];
  const placed: PlacedLabel[] = [];
  // Small countries' callouts last: the larger names keep their own points.
  const order = [...requests].sort((a, b) => Number(a.small) - Number(b.small));
  for (const r of order) {
    const [ax, ay] = r.anchor;
    // A country whose label point is off the map is not named.
    if (ax < 0 || ay < 0 || ax > vw || ay > vh) continue;
    const textW = textWidth(r.text, fontSize) + (r.badge ? BADGE_SIZE + 4 : 0);
    if (r.small && r.width < textW) {
      const w = textW + 2 * CALLOUT_PAD;
      const h = lineHeight + CALLOUT_PAD;
      // Beside the country, then above or below it, then further out: the first clear of names, markers and the
      // map's buttons.
      const spots: Point[] = [1, 1.8].flatMap((reach) => [
        [ax + CALLOUT_REACH * reach + w / 2, ay + CALLOUT_REACH * 0.6 * reach],
        [ax + CALLOUT_REACH * reach + w / 2, ay - CALLOUT_REACH * 0.6 * reach],
        [ax - CALLOUT_REACH * reach - w / 2, ay + CALLOUT_REACH * 0.6 * reach],
        [ax - CALLOUT_REACH * reach - w / 2, ay - CALLOUT_REACH * 0.6 * reach],
        [ax, ay + CALLOUT_REACH * reach + h / 2],
        [ax, ay - CALLOUT_REACH * reach - h / 2],
      ] as Point[]);
      const fits = spots.map((p) => boxAt(p, w, h)).filter((b) => inside(b, vw, vh));
      const box = fits.find((b) => !taken.some((t) => overlaps(b, t))) ?? fits[0];
      if (!box) continue;
      taken.push(box);
      placed.push({ id: r.id, at: [(box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2], box, callout: { anchor: r.anchor } });
      continue;
    }
    const tries = [0, -1, 1, -2, 2].map((n) => boxAt([ax, ay + n * lineHeight], textW, lineHeight));
    // Kept on the map: a name near its edge moves in rather than being cut.
    const shifted = tries.map((b) => {
      const dx = b.x0 < 2 ? 2 - b.x0 : b.x1 > vw - 2 ? vw - 2 - b.x1 : 0;
      return { x0: b.x0 + dx, x1: b.x1 + dx, y0: b.y0, y1: b.y1 };
    });
    const box = shifted.find((b) => !taken.some((t) => overlaps(b, t))) ?? shifted[0];
    taken.push(box);
    placed.push({ id: r.id, at: [(box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2], box, callout: null });
  }
  return placed;
}
