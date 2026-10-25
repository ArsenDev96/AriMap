import { describe, expect, it } from "vitest";
import { getCountry } from "@/core/content/countries";
import { westernEuropeLesson } from "@/core/lessons/western-europe";
import { insideOutlineOf } from "./hitTest";
import { regionMapFor, type CountryShape } from "./regionMap";

const shape = (d: string, bounds: CountryShape["bounds"]): CountryShape => ({ id: "X", d, coast: "", bounds });

describe("insideOutlineOf", () => {
  const square = shape("M0,0L10,0L10,10L0,10Z", [
    [0, 0],
    [10, 10],
  ]);

  it("answers for points inside, outside and on the edge", () => {
    expect(insideOutlineOf(square, [5, 5])).toBe(true);
    expect(insideOutlineOf(square, [15, 5])).toBe(false);
    expect(insideOutlineOf(square, [10, 5])).toBe(true);
  });

  it("leaves holes out and counts every island (non-zero winding, as the canvas fills)", () => {
    // An outer ring with a hole wound the other way, and an island.
    const holed = shape("M0,0L10,0L10,10L0,10ZM3,3L3,7L7,7L7,3ZM20,0L25,0L25,5L20,5Z", [
      [0, 0],
      [25, 10],
    ]);
    expect(insideOutlineOf(holed, [1, 1])).toBe(true);
    expect(insideOutlineOf(holed, [5, 5])).toBe(false);
    expect(insideOutlineOf(holed, [22, 2])).toBe(true);
    expect(insideOutlineOf(holed, [15, 2])).toBe(false);
  });

  it("can't answer for curves (the website asks its canvas then)", () => {
    expect(insideOutlineOf(shape("M0,0C5,5 10,5 10,0Z", [[0, 0], [10, 5]]), [5, 2])).toBeNull();
  });

  it("finds each Level 1 country at its own label point, and none of the others there", () => {
    const map = regionMapFor(westernEuropeLesson);
    for (const id of westernEuropeLesson.countries) {
      const at = map.project(getCountry(id).label.coordinates);
      const hits = map.shapes.filter((s) => insideOutlineOf(s, at)).map((s) => s.id);
      expect(hits, id).toEqual([id]);
    }
  });
});
