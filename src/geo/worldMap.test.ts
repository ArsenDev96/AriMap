import { describe, expect, it } from "vitest";
import { CONTINENT_IDS } from "@/core/lessons/continents";
import { WORLD_LABELS, WORLD_MAP_HEIGHT, WORLD_MAP_WIDTH, WORLD_REGIONS } from "@/data/geo/world-map";

/** Every point of an SVG path made of M, L and Z commands (d3-geo's output). */
function points(d: string) {
  return [...d.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map(([, x, y]) => [Number(x), Number(y)] as const);
}

/** The home screen's world map (src/data/geo/world-map.ts, made by scripts/prepare-world-map.mjs). */
describe("world map", () => {
  it("has land and a name's place for every category, and land for the context continents", () => {
    for (const id of CONTINENT_IDS) {
      expect(WORLD_REGIONS[id], id).toMatch(/^M/);
      const { x, y } = WORLD_LABELS[id];
      expect(x > 0 && x < 1 && y > 0 && y < 1, id).toBe(true);
    }
    for (const id of ["oceania", "antarctica"] as const) expect(WORLD_REGIONS[id], id).toMatch(/^M/);
  });

  it("keeps all land within the map, a flat equirectangular map twice as wide as it is tall", () => {
    expect(WORLD_MAP_WIDTH / WORLD_MAP_HEIGHT).toBe(2);
    for (const [id, d] of Object.entries(WORLD_REGIONS))
      for (const [x, y] of points(d)) expect(x >= -0.5 && x <= WORLD_MAP_WIDTH + 0.5 && y >= -0.5 && y <= WORLD_MAP_HEIGHT + 0.5, `${id} ${x},${y}`).toBe(true);
  });

  it("places each continent's land where it is: Europe north of Africa and west of Asia, the Americas west of both", () => {
    const centre = (id: keyof typeof WORLD_REGIONS) => {
      const p = points(WORLD_REGIONS[id]);
      return [p.reduce((s, [x]) => s + x, 0) / p.length, p.reduce((s, [, y]) => s + y, 0) / p.length];
    };
    const [europe, asia, africa, north, south] = (["europe", "asia", "africa", "north-america", "south-america"] as const).map(centre);
    expect(europe[1]).toBeLessThan(africa[1]);
    expect(europe[0]).toBeLessThan(asia[0]);
    expect(north[0]).toBeLessThan(europe[0]);
    expect(south[0]).toBeLessThan(africa[0]);
    expect(north[1]).toBeLessThan(south[1]);
  });
});
