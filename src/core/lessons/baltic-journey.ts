import { centralEuropeLesson } from "./central-europe";
import { easternEuropeLesson } from "./eastern-europe";
import type { LessonDefinition } from "./types";

/**
 * Level 6 since 2026-10-06 (its second version): Belarus in place of Germany, and the journey
 * Poland → Estonia, with two shortest routes. Attempts started before keep the first version
 * (balticJourneyOriginalLesson, below) until Start over or Play again: see LevelInfo.earlier.
 */
export const balticJourneyLesson: LessonDefinition = {
  id: "baltic-journey",
  revision: 2,
  regionName: {
    en: "the Baltic states and their neighbours",
    hy: "Բալթյան երկրներ և նրանց հարևաններ",
  },
  countries: ["POL", "BLR", "LTU", "LVA", "EST"],
  // Every real land border among the five (CIA World Factbook; checked against the map data in
  // src/geo/regionMap.test.ts). Restricted to the level's countries: e.g. Poland–Russia (Kaliningrad),
  // Lithuania–Russia, Latvia–Russia, Estonia–Russia and Belarus–Ukraine are real but out of scope.
  // Poland meets neither Latvia nor Estonia, Belarus does not meet Estonia, and Estonia meets only
  // Latvia here, so every journey ends Latvia → Estonia. Lithuania and Belarus both border Poland
  // and Latvia, and each other: the two ways north. No sea connection is added.
  borders: {
    POL: ["BLR", "LTU"],
    BLR: ["POL", "LTU", "LVA"],
    LTU: ["POL", "BLR", "LVA"],
    LVA: ["BLR", "LTU", "EST"],
    EST: ["LVA"],
  },
  // Three crossings, by two shortest routes: Lithuania or Belarus, then Latvia. Each wrong turn is
  // a way back south (Lithuania → Belarus, Belarus → Lithuania, or Latvia → either), after which
  // the crossings run out before Estonia. No dead end can be reached with crossings left.
  travel: { mission: { id: "pol-to-est", from: "POL", to: "EST" } },
  // Poland's usual hint ("in the north-east of this region", Level 3's) would be wrong here, where it
  // is the largest and lies in the south-west, and so would Belarus's ("in the north", Level 8's),
  // which lies in the south-east. Lithuania's, Latvia's and Estonia's own hints are true here.
  hints: {
    POL: {
      en: "The largest country of this region, in its south-west, with a coast on the Baltic Sea.",
      hy: "Տարածաշրջանի ամենամեծ երկիրը՝ նրա հարավ-արևմուտքում, Բալթիկ ծովի ափով։",
    },
    BLR: {
      en: "A flat country with no coast in the south-east of this region, with many forests, lakes and marshes.",
      hy: "Հարթ երկիր առանց ծովի՝ տարածաշրջանի հարավ-արևելքում, բազմաթիվ անտառներով, լճերով և ճահիճներով։",
    },
  },
  map: {
    // No close-up and no callout rule: every country here is large enough to tap at the whole-map
    // view. The area the map may show stays inside the prepared data: its north edge (62°N, nearest
    // to the view around 8°E) and east edge (48°E) set the limit, about ±880 × ±485 around the five;
    // see docs/DATA.md, "Level 6".
    coverageHalf: [850, 470],
    // Vertices of the shared Natural Earth borders, chosen by the rule in docs/DATA.md ("Travel route
    // line", Level 6). Poland–Belarus is Level 8's crossing (the same capitals), and Lithuania–Poland,
    // Latvia–Lithuania and Estonia–Latvia are this level's first version's.
    routeCrossings: {
      "BLR-POL": easternEuropeLesson.map.routeCrossings!["BLR-POL"],
      "LTU-POL": [23.2352, 54.2543],
      "BLR-LTU": [25.6162, 54.4412],
      "BLR-LVA": [27.1107, 55.8362],
      "LTU-LVA": [24.0752, 56.2712],
      "EST-LVA": [26.0028, 57.8459],
    },
  },
};

/**
 * Level 6's first version (until 2026-10-06): Germany, Poland, Lithuania, Latvia and Estonia, a
 * chain, and the journey Germany → Estonia. Kept, with its own map, for attempts started on it.
 */
export const balticJourneyOriginalLesson: LessonDefinition = {
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
