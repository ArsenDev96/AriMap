/// <reference types="node" />
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CHALLENGE_POOL, RING_COUNTRIES } from "@/core/challenge/europe";
import { countryName } from "@/core/content/names";
import { shuffle, seededRandom } from "@/core/game/random";
import type { Locale } from "@/core/i18n/locales";
import { localize } from "@/core/i18n/translate";
import { fitWithRings, viewAt } from "@/geo/challengeCamera";
import { challengeMapFrom } from "@/geo/challengeMap";
import type { Transform } from "@/geo/regionMap";
import { crosses, LABEL_FONT, placeLabels, type Box } from "../map/labels";
import { ringsFor } from "../map/pick";
import { nameRequests, ringBoxes } from "./mapNames";

/*
 * The challenge's Results and review name the round's countries on the map (ChallengeMap.tsx, labels.ts). A leader
 * from a country to its name never crosses another name, a ring or the map's buttons, and no name sits on a leader:
 * Phase 3's preview showed North Macedonia's leader through "Albania".
 */

const map = challengeMapFrom(JSON.parse(readFileSync(path.resolve(__dirname, "../../../../src/data/geo/europe-challenge.topo.json"), "utf8")));

function startView(width: number, height: number): Transform {
  const [[c0x, c0y], [c1x, c1y]] = map.coverage;
  const padding = Math.max(8, Math.min(width, height) * 0.03);
  const fit = fitWithRings(map.focusBounds, Object.values(RING_COUNTRIES).map(map.project), width, height, padding);
  const k = Math.max(fit.k, width / (c1x - c0x), height / (c1y - c0y));
  return viewAt(map.coverage, k, fit.cx, fit.cy, width, height);
}

const inside = (b: Box, [x, y]: readonly [number, number]) => x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1;

describe("the challenge map's names", () => {
  it("never cross a leader: on phones, at 100% and large text, in English and Armenian, at the start view and zoomed", () => {
    let leaders = 0;
    for (const [width, height] of [
      [288, 330],
      [328, 368],
      [374, 427],
    ] as const) {
      const base = startView(width, height);
      // The zoom buttons' column (MapControls), top right.
      const buttons: Box = { x0: width - 8 - 48, y0: 8, x1: width - 8, y1: 8 + 3 * 48 + 8 };
      for (const zoom of [1, 2]) {
        const camera = zoom === 1 ? base : viewAt(map.coverage, base.k * zoom, (width / 2 - base.x) / base.k, (height / 2 - base.y) / base.k, width, height);
        const rings = ringsFor(map.shapes, CHALLENGE_POOL, camera, map.project);
        const obstacles = [...ringBoxes(rings), buttons];
        for (const locale of ["en", "hy"] as Locale[]) {
          for (const font of [LABEL_FONT, LABEL_FONT * 1.35]) {
            for (let seed = 1; seed <= 12; seed++) {
              const names = shuffle(CHALLENGE_POOL, seededRandom(seed)).slice(0, 15);
              const placed = placeLabels(nameRequests(map, names, null, camera, (id) => localize(countryName(id), locale)), obstacles, { width, height }, font, true);
              const where = `${width}×${height} ×${zoom} ${locale} ${font} seed ${seed}`;
              for (const label of placed) {
                if (!label.callout) continue;
                leaders++;
                const { anchor } = label.callout;
                const others = [...placed.filter((o) => o !== label).map((o) => o.box), ...obstacles];
                // What the label point is under, any leader from it starts in.
                for (const box of others) expect(!inside(box, anchor) && crosses(anchor, label.at, box), `${where}: ${label.id}`).toBe(false);
              }
            }
          }
        }
      }
    }
    // The check had leaders to check.
    expect(leaders).toBeGreaterThan(100);
  }, 120_000);
});
