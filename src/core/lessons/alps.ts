import type { LessonDefinition } from "./types";

export const alpsLesson: LessonDefinition = {
  id: "around-the-alps",
  regionName: {
    en: "the Alpine countries",
    hy: "Ալպյան երկրներ",
  },
  countries: ["FRA", "CHE", "DEU", "AUT", "ITA"],
  // Restricted to the level's countries: e.g. Switzerland–Liechtenstein and
  // Austria–Slovenia are real but out of scope. Germany and Italy do not meet
  // (Switzerland and Austria lie between them), nor do France and Austria.
  borders: {
    FRA: ["CHE", "DEU", "ITA"],
    CHE: ["FRA", "DEU", "AUT", "ITA"],
    DEU: ["FRA", "CHE", "AUT"],
    AUT: ["CHE", "DEU", "ITA"],
    ITA: ["FRA", "CHE", "AUT"],
  },
  // Two crossings, by three equally short routes: through Switzerland, Germany or Italy.
  travel: { mission: { id: "fra-to-aut", from: "FRA", to: "AUT" } },
  hints: {
    DEU: {
      en: "The large country in the north of this region, reaching both the North Sea and the Baltic Sea.",
      hy: "Տարածաշրջանի հյուսիսային մասի մեծ երկիրը, որը հասնում է և՛ Հյուսիսային, և՛ Բալթիկ ծովերին։",
    },
  },
  map: {
    // No close-up: every country here is large enough to tap at the whole-map view.
    // The area the map may show stays inside the prepared data (lat 32–62°N,
    // lon 27°W–36°E); see docs/DATA.md, "Coverage and view limits".
    coverageHalf: [1090, 840],
    // Vertices of the shared Natural Earth borders, chosen by the rule in docs/DATA.md
    // ("Travel route line"). France–Germany is Level 1's crossing: the same capitals.
    routeCrossings: {
      "CHE-FRA": [6.1104, 46.5209],
      "DEU-FRA": [8.0906, 48.9791],
      "FRA-ITA": [6.64, 45.0503],
      "CHE-DEU": [8.1221, 47.5922],
      "AUT-CHE": [9.8703, 46.9928],
      "CHE-ITA": [9.1632, 46.1723],
      "AUT-DEU": [12.182, 47.6921],
      "AUT-ITA": [11.5962, 47.0003],
    },
    // Where a straight leg would leave its country: along the Ligurian coast (Rome to
    // the Alps), through Czechia (Berlin to the Inn) or Germany's Berchtesgaden
    // salient and the narrow Tyrol (Vienna to the west).
    routeVia: {
      "ITA@FRA-ITA": [[10.13, 44.18]],
      "DEU@AUT-DEU": [[11.9, 50.51]],
      "AUT@AUT-DEU": [[12.91, 47.25]],
      "AUT@AUT-CHE": [[12.92, 47.36]],
    },
  },
};
