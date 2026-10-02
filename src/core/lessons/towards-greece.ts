import type { LessonDefinition } from "./types";

export const towardsGreeceLesson: LessonDefinition = {
  id: "towards-greece",
  regionName: {
    en: "South-eastern Europe",
    hy: "Հարավարևելյան Եվրոպա",
  },
  countries: ["HUN", "ROU", "SRB", "BGR", "GRC"],
  // Every real land border among the five (CIA World Factbook; checked against the
  // map data in src/geo/regionMap.test.ts). Restricted to the level's countries:
  // e.g. Hungary–Ukraine, Serbia–North Macedonia and Greece–Turkey are real but out
  // of scope. Hungary meets neither Bulgaria nor Greece; Serbia and Romania do not
  // meet Greece (North Macedonia and Bulgaria lie between). Greece's only neighbour
  // here is Bulgaria. Serbia's shape is Natural Earth's, without Kosovo (docs/DATA.md).
  borders: {
    HUN: ["ROU", "SRB"],
    ROU: ["HUN", "SRB", "BGR"],
    SRB: ["HUN", "ROU", "BGR"],
    BGR: ["ROU", "SRB", "GRC"],
    GRC: ["BGR"],
  },
  // Three crossings, by two equally short routes: through Romania or through Serbia,
  // then Bulgaria. There is no sea crossing.
  travel: { mission: { id: "hun-to-grc", from: "HUN", to: "GRC" } },
  map: {
    // No close-up and no callout rule: every country here is large enough to tap at
    // the whole-map view. The focus includes Crete and Rhodes, Greece's largest
    // islands, which lie within Romania's eastward reach and only extend the frame
    // south by Crete. The area the map may show stays inside the prepared data
    // (its clip box was extended east and south for this level); see docs/DATA.md,
    // "Level 5".
    coverageHalf: [1100, 600],
    // Vertices of the shared Natural Earth borders, chosen by the rule in docs/DATA.md
    // ("Travel route line", Level 5).
    routeCrossings: {
      "HUN-ROU": [21.5878, 46.8821],
      "HUN-SRB": [19.4877, 46.1342],
      "ROU-SRB": [21.4592, 45.1739],
      "BGR-ROU": [25.4263, 43.6544],
      "BGR-SRB": [22.8968, 43.0628],
      "BGR-GRC": [24.5676, 41.468],
    },
    // Where a straight leg would leave its country or graze its border: Athens to the
    // Rhodopes would cross the Euboean and Thermaic gulfs (it runs up Greece's main
    // corridor instead: north of Athens, past Lamia, through Thessaly west of Olympus);
    // Sofia to the same crossing runs along the Greek border (it turns near Smolyan).
    routeVia: {
      "BGR@BGR-GRC": [[24.76, 41.59]],
      "GRC@BGR-GRC": [
        [23.74, 38.21],
        [22.4, 38.74],
        [22.37, 40.56],
      ],
    },
  },
};
