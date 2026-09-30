import { alpsLesson } from "./alps";
import type { LessonDefinition } from "./types";

const alps = alpsLesson.map;

export const centralEuropeLesson: LessonDefinition = {
  id: "central-europe",
  regionName: {
    en: "Central Europe",
    hy: "Կենտրոնական Եվրոպա",
  },
  countries: ["DEU", "POL", "CZE", "SVK", "AUT"],
  // Restricted to the level's countries: e.g. Poland–Ukraine and Slovakia–Hungary are
  // real but out of scope. Germany and Slovakia do not meet (Czechia lies between
  // them), nor do Poland and Austria (Czechia and Slovakia lie between them).
  borders: {
    DEU: ["POL", "CZE", "AUT"],
    POL: ["DEU", "CZE", "SVK"],
    CZE: ["DEU", "POL", "SVK", "AUT"],
    SVK: ["POL", "CZE", "AUT"],
    AUT: ["DEU", "CZE", "SVK"],
  },
  // Two crossings, by three equally short routes: through Czechia, Slovakia or Germany.
  travel: { mission: { id: "pol-to-aut", from: "POL", to: "AUT" } },
  hints: {
    DEU: {
      en: "The large country in the west of this region, reaching both the North Sea and the Baltic Sea.",
      hy: "Տարածաշրջանի արևմտյան մասի մեծ երկիրը, որը հասնում է և՛ Հյուսիսային, և՛ Բալթիկ ծովերին։",
    },
    AUT: {
      en: "A mountain country with no coast in the south of this region, south of Germany and Czechia.",
      hy: "Լեռնային երկիր առանց ծովի՝ տարածաշրջանի հարավում, Գերմանիայից և Չեխիայից հարավ։",
    },
  },
  map: {
    // No close-up: every country here is large enough to tap at the whole-map view.
    // The area the map may show stays inside the prepared data: here its east edge
    // (36°E, beyond Ukraine) and north edge (62°N) set the limit; see docs/DATA.md,
    // "Coverage and view limits".
    coverageHalf: [715, 760],
    // Vertices of the shared Natural Earth borders, chosen by the rule in docs/DATA.md
    // ("Travel route line"). Germany–Austria is Level 2's crossing, with its turning
    // points: the same capitals.
    routeCrossings: {
      "DEU-POL": [14.6063, 52.2758],
      "CZE-DEU": [13.0697, 50.4911],
      "AUT-DEU": alps.routeCrossings!["AUT-DEU"],
      "CZE-POL": [16.3712, 50.3183],
      "POL-SVK": [20.8678, 49.3115],
      "CZE-SVK": [17.2601, 48.8579],
      "AUT-CZE": [14.8674, 48.7757],
      "AUT-SVK": [16.9508, 48.2765],
    },
    // Level 2's turning points for Germany–Austria: west of the Czech border (Berlin to
    // the Inn), and south of Germany's Berchtesgaden salient (Vienna to the west).
    routeVia: {
      "DEU@AUT-DEU": alps.routeVia!["DEU@AUT-DEU"],
      "AUT@AUT-DEU": alps.routeVia!["AUT@AUT-DEU"],
    },
  },
};
