import type { CountryId } from "@/core/content/types";
import type { Point } from "@/geo/regionMap";

/**
 * Where the lesson map's country names go, on screen. A simpler cousin of the website's label layout
 * (src/components/map/RegionMap.tsx): each name is centred on its country's label point, moved to the nearest clear
 * place (up or down a line or two, or a little sideways) where a marker (a capital, a landmark, the traveller), a
 * name already placed or the map's buttons are in the way, and kept within the map; a small country
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
    // The clear place nearest the label point with its centre on the country, else the nearest clear place, joined
    // to the country by a leader.
    const centre = (b: Box): Point => [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];
    const away = (b: Box) => Math.hypot(centre(b)[0] - ax, centre(b)[1] - ay);
    const nearest = (boxes: Box[]) => (boxes.length ? boxes.reduce((best, b) => (away(b) < away(best) ? b : best)) : undefined);
    const clear = [...rows, ...slid].filter((b) => !taken.some((t) => overlaps(b, t)));
    const onCountry = (b: Box) => !r.covers || r.covers(centre(b));
    const box = nearest(clear.filter(onCountry)) ?? nearest(clear) ?? rows[0];
    taken.push(box);
    placed.push({ id: r.id, at: centre(box), box, callout: onCountry(box) ? null : { anchor: r.anchor } });
  }
  return placed;
}
