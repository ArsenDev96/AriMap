import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import relief from "@/assets/map/relief.json";
import type { LonLat } from "@/core/content/types";
import { getRegionMap, viewLimits } from "./regionMap";
import { FORESTS, MOUNTAIN_RANGES } from "./terrain";

const LESSON = ["FRA", "BEL", "NLD", "LUX", "DEU"];
const map = getRegionMap(LESSON);

describe("painted relief", () => {
  it("was generated with the map's own projection", () => {
    for (const { lonLat, world } of relief.check) {
      const [x, y] = map.project(lonLat as unknown as LonLat);
      expect(Math.abs(x - world[0]), String(lonLat)).toBeLessThan(0.01);
      expect(Math.abs(y - world[1]), String(lonLat)).toBeLessThan(0.01);
    }
  });

  it("covers everything the map can show, and every country that can take a state colour", () => {
    const { land, tone } = relief.overview;
    const [[c0x, c0y], [c1x, c1y]] = map.coverage;
    expect(land.x).toBeLessThanOrEqual(c0x);
    expect(land.y).toBeLessThanOrEqual(c0y);
    expect(land.x + land.width).toBeGreaterThanOrEqual(c1x - 1);
    expect(land.y + land.height).toBeGreaterThanOrEqual(c1y - 1);
    for (const id of LESSON) {
      const [[x0, y0], [x1, y1]] = map.shapes.find((s) => s.id === id)!.bounds;
      expect(x0, id).toBeGreaterThanOrEqual(tone.x);
      expect(y0, id).toBeGreaterThanOrEqual(tone.y);
      expect(x1, id).toBeLessThanOrEqual(tone.x + tone.width);
      expect(y1, id).toBeLessThanOrEqual(tone.y + tone.height);
    }
  });

  it("has zoomed tiles only where the map can be zoomed and panned, and every listed tile exists", () => {
    const [[e0x, e0y], [e1x, e1y]] = viewLimits(map, 390, 400, 16).translateExtent;
    let previous = 0;
    for (const level of relief.levels) {
      expect(level.minDensity).toBeGreaterThan(previous);
      previous = level.minDensity;
      // The tile grid spans the pan area, and not much more.
      expect(level.origin[0]).toBeLessThanOrEqual(e0x);
      expect(level.origin[1]).toBeLessThanOrEqual(e0y);
      expect(level.origin[0] + level.cols * level.tileWorld).toBeGreaterThanOrEqual(e1x);
      expect(level.origin[1] + level.rows * level.tileWorld).toBeGreaterThanOrEqual(e1y);
      expect(level.origin[0] + (level.cols - 1) * level.tileWorld).toBeLessThan(e1x);
      expect(level.origin[1] + (level.rows - 1) * level.tileWorld).toBeLessThan(e1y);
      for (const family of ["land", "tone"] as const)
        for (const tile of level[family]) expect(existsSync(`public/relief/${relief.version}/${level.name}/${family}/${tile}.webp`), `${level.name} ${family} ${tile}`).toBe(true);
    }
  });

  it("shows mountains and upland ranges where they are, and leaves open lowlands flat", async () => {
    const { data, info } = await sharp("src/assets/map/relief/overview-land.webp").raw().toBuffer({ resolveWithObject: true });
    const o = relief.overview.land;
    /** Strongest relief opacity (0–255) within a few km of a point. */
    const alphaNear = (p: LonLat, r = 2) => {
      const [x, y] = map.project(p);
      const [i, j] = [Math.floor(x - o.x), Math.floor(y - o.y)];
      let m = 0;
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) m = Math.max(m, data[((j + dj) * info.width + i + di) * info.channels + 3]);
      return m;
    };
    // Every named range (independent crest data through real summits, see terrain.ts) is visible along its crest.
    for (const range of MOUNTAIN_RANGES) {
      const strongest = Math.max(...range.crests.flat().map((p) => alphaNear(p)));
      expect(strongest, range.id).toBeGreaterThanOrEqual(range.id === "alps" || range.id === "pyrenees" ? 200 : 45);
    }
    // Open farmland and city centres on low ground: no relief and no forest.
    // (Madrid is on the Meseta, a high plateau with scattered woods: still subtle.)
    const open: Record<string, LonLat> = {
      "Beauce (farmland)": [1.6, 48.3],
      "Champagne (farmland)": [4.2, 48.9],
      "Flevoland (polder)": [5.6, 52.5],
      "Magdeburger Börde (farmland)": [11.6, 52.0],
      "Paris centre": [2.35, 48.86],
      "Amsterdam centre": [4.9, 52.37],
      "London centre": [-0.13, 51.5],
    };
    for (const [place, p] of Object.entries(open)) expect(alphaNear(p, 1), place).toBeLessThanOrEqual(25);
    expect(alphaNear([-3.7, 40.42], 3), "Madrid").toBeLessThanOrEqual(40);
  });

  it("paints forests where WorldCover has tree cover, not on open farmland", async () => {
    const { data, info } = await sharp("src/assets/map/relief/overview-land.webp").raw().toBuffer({ resolveWithObject: true });
    const o = relief.overview.land;
    const alphaNear = (p: LonLat, r: number) => {
      const [x, y] = map.project(p);
      const [i, j] = [Math.floor(x - o.x), Math.floor(y - o.y)];
      let m = 0;
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) m = Math.max(m, data[((j + dj) * info.width + i + di) * info.channels + 3]);
      return m;
    };
    // Named forests (independent reference points: the Wikipedia articles'
    // coordinates), including lowland ones where only forest can paint the land.
    for (const f of FORESTS) expect(alphaNear(f.center, 2), f.id).toBeGreaterThanOrEqual(40);
    // Large open farmland with no woods: nothing painted.
    for (const p of [[1.6, 48.3], [4.2, 48.9], [5.6, 52.5], [11.6, 52.0]] as LonLat[]) expect(alphaNear(p, 0), String(p)).toBeLessThanOrEqual(10);
  });
});

