import { describe, expect, it } from "vitest";
import { getCountry } from "@/core/content/countries";
import { westernEuropeLesson as lesson } from "@/core/lessons/western-europe";
import { insideOutlineOf } from "@/geo/hitTest";
import { regionMapFor, viewLimits } from "@/geo/regionMap";
import { mapPadding, toScreen, toWorld, zoomTo } from "./camera";
import { countryAt, TAP_REACH } from "./pick";

const [W, H] = [380, 320];
const map = regionMapFor(lesson);
const limits = viewLimits(map, W, H, mapPadding(W, H));
const at = (lonLat: readonly [number, number], t = limits.base) => toScreen(t, map.project(lonLat));

describe("which country a tap is on", () => {
  it("each of Level 1's countries, at its label point (Luxembourg too, at the start view of a phone's map)", () => {
    for (const id of lesson.countries) expect(countryAt(map.shapes, lesson.countries, limits.base, at(getCountry(id).label.coordinates)), id).toBe(id);
  });

  it("a faded country around them (Switzerland), for Find's \"not one of the five\"", () => {
    expect(countryAt(map.shapes, lesson.countries, limits.base, at([8.2, 46.8]))).toBe("CHE");
  });

  it("follows the view: the same country after zooming and panning", () => {
    const zoomed = zoomTo(limits.base, limits.base.k * 3, [W / 2, H / 2], W, H, limits);
    const lux = getCountry("LUX").label.coordinates;
    expect(countryAt(map.shapes, lesson.countries, zoomed, at(lux, zoomed))).toBe("LUX");
  });

  it("the sea just off a coast takes the nearest country within reach; open sea is none", () => {
    // Brest, at France's western tip, then a little out to sea and far out in the Atlantic.
    const brest = at([-4.49, 48.39]);
    expect(countryAt(map.shapes, lesson.countries, limits.base, brest)).toBe("FRA");
    const france = map.shapes.find((s) => s.id === "FRA")!;
    // The first point west of Brest that is sea, then a little further out, still within reach of the coast.
    let x = brest[0];
    while (insideOutlineOf(france, toWorld(limits.base, [x, brest[1]]))) x -= 1;
    const offshore: [number, number] = [x - TAP_REACH / 2 + 1, brest[1]];
    expect(map.shapes.some((s) => insideOutlineOf(s, toWorld(limits.base, offshore)))).toBe(false);
    expect(countryAt(map.shapes, lesson.countries, limits.base, offshore)).toBe("FRA");
    expect(countryAt(map.shapes, lesson.countries, limits.base, at([-14, 46]))).toBeNull();
  });
});
