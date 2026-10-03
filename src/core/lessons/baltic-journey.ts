import { centralEuropeLesson } from "./central-europe";
import type { LessonDefinition } from "./types";

export const balticJourneyLesson: LessonDefinition = {
  id: "baltic-journey",
  regionName: {
    en: "the Baltic Sea countries",
    hy: "Բալթիկ ծովի երկրներ",
  },
  countries: ["DEU", "POL", "LTU", "LVA", "EST"],
  // Every real land border among the five (CIA World Factbook; checked against the
  // map data in src/geo/regionMap.test.ts). Restricted to the level's countries:
  // e.g. Germany–Denmark, Poland–Russia (Kaliningrad), Lithuania–Belarus and
  // Estonia–Russia are real but out of scope. The five form a chain: Germany meets
  // only Poland here, Poland meets neither Latvia nor Estonia, and Lithuania and
  // Estonia do not meet (Latvia lies between them). Poland and Lithuania meet on a
  // short border between Kaliningrad and Belarus.
  borders: {
    DEU: ["POL"],
    POL: ["DEU", "LTU"],
    LTU: ["POL", "LVA"],
    LVA: ["LTU", "EST"],
    EST: ["LVA"],
  },
  // Four crossings, by exactly one shortest route: Poland, Lithuania, then Latvia.
  // There is no sea crossing.
  travel: { mission: { id: "deu-to-est", from: "DEU", to: "EST" } },
  // Level 1's Germany is "in the east" and Level 3's Poland "in the north-east": both
  // would be wrong here, where Germany is in the south-west and Poland in the south.
  hints: {
    DEU: {
      en: "The large country in the south-west of this region, reaching both the North Sea and the Baltic Sea.",
      hy: "Տարածաշրջանի հարավ-արևմտյան մասի մեծ երկիրը, որը հասնում է և՛ Հյուսիսային, և՛ Բալթիկ ծովերին։",
    },
    POL: {
      en: "A large, mostly flat country in the south of this region, east of Germany, with a coast on the Baltic Sea.",
      hy: "Մեծ, հիմնականում հարթ երկիր տարածաշրջանի հարավում՝ Գերմանիայից արևելք, Բալթիկ ծովի ափով։",
    },
  },
  map: {
    // No close-up and no callout rule: every country here is large enough to tap at
    // the whole-map view. The focus includes Estonia's islands (Saaremaa, Hiiumaa,
    // Ruhnu…), which lie within Germany's and Poland's westward reach, so they do not
    // widen the frame. The area the map may show stays inside the prepared data: here
    // its north edge (62°N, nearest to the view above Norway and Sweden) sets the
    // limit, allowing at most about ±575 vertically; see docs/DATA.md, "Level 6".
    coverageHalf: [1100, 570],
    // Vertices of the shared Natural Earth borders, chosen by the rule in docs/DATA.md
    // ("Travel route line", Level 6). Germany–Poland is Level 3's crossing: the same
    // capitals, and the same rule finds it again.
    routeCrossings: {
      "DEU-POL": centralEuropeLesson.map.routeCrossings!["DEU-POL"],
      "LTU-POL": [23.2352, 54.2543],
      "LTU-LVA": [24.0752, 56.2712],
      "EST-LVA": [26.0028, 57.8459],
    },
  },
};
