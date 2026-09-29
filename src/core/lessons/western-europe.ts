import type { LessonDefinition } from "./types";

export const westernEuropeLesson: LessonDefinition = {
  id: "western-europe-1",
  title: {
    en: "France and its neighbours",
    hy: "Ֆրանսիան և իր հարևանները",
  },
  regionName: {
    en: "Western Europe",
    hy: "Արևմտյան Եվրոպա",
  },
  countries: ["FRA", "BEL", "NLD", "LUX", "DEU"],
  // Restricted to the practice region: e.g. France–Switzerland is real but out of scope,
  // and the France–Netherlands border on Saint Martin (Caribbean) is excluded on purpose.
  borders: {
    FRA: ["BEL", "LUX", "DEU"],
    BEL: ["FRA", "NLD", "LUX", "DEU"],
    NLD: ["BEL", "DEU"],
    LUX: ["FRA", "BEL", "DEU"],
    DEU: ["FRA", "BEL", "NLD", "LUX"],
  },
  travel: { mission: { id: "fra-to-nld", from: "FRA", to: "NLD" } },
  map: {
    inset: {
      bounds: [
        [4.9, 49.05],
        [7.35, 50.35],
      ],
      country: "LUX",
    },
    // Vertices of the shared Natural Earth borders, near the middle of each border
    // (see docs/DATA.md, "Travel route line").
    routeCrossings: {
      "BEL-FRA": [4.1804, 50.1272],
      "FRA-LUX": [6.0634, 49.4486],
      "DEU-FRA": [8.0906, 48.9791],
      "BEL-NLD": [5.2333, 51.2558],
      "BEL-LUX": [5.7189, 49.8914],
      "BEL-DEU": [6.3319, 50.447],
      "DEU-NLD": [6.4791, 51.8531],
      "DEU-LUX": [6.4148, 49.8056],
    },
  },
};
