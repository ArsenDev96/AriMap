import { towardsGreeceLesson } from "./towards-greece";
import type { LessonDefinition } from "./types";

/**
 * Level 5's first two turning points on Athens's leg (north of Athens, then west of Lamia), so Athens's
 * line leaves it the same way in both levels: up Greece's mainland corridor, clear of the Euboean Gulf
 * and the Gulf of Corinth.
 */
const ATHENS_NORTH = towardsGreeceLesson.map.routeVia!["GRC@BGR-GRC"].slice(0, 2);

export const heartOfTheBalkansLesson: LessonDefinition = {
  id: "heart-of-the-balkans",
  regionName: {
    en: "the southern Balkans",
    hy: "Հարավային Բալկաններ",
  },
  countries: ["MNE", "KOS", "ALB", "MKD", "GRC"],
  // Every real land border among the five (CIA World Factbook, final edition; checked against the map
  // data in src/geo/regionMap.test.ts). Restricted to the level's countries: e.g. Montenegro–Serbia,
  // Kosovo–Serbia, North Macedonia–Bulgaria and Greece–Turkey are real but out of scope. Montenegro
  // meets neither North Macedonia nor Greece, and Kosovo does not meet Greece. No sea connection is added.
  borders: {
    MNE: ["KOS", "ALB"],
    KOS: ["MNE", "ALB", "MKD"],
    ALB: ["MNE", "KOS", "MKD", "GRC"],
    MKD: ["KOS", "ALB", "GRC"],
    GRC: ["ALB", "MKD"],
  },
  // Two crossings, by two shortest routes: through Kosovo or through Albania. Both first moves are on a
  // shortest route; each wrong turn is the second move (Kosovo → Albania, Albania → Kosovo or Albania →
  // Greece), after which the crossings run out. No dead end can be reached with crossings left.
  travel: { mission: { id: "mne-to-mkd", from: "MNE", to: "MKD" } },
  // Montenegro's usual hint ("in the south-east of this region", written for Level 4) would be wrong
  // here, where it is the north-west of the five. Greece's own hint (the southernmost) is true here.
  hints: {
    MNE: {
      en: "A small mountainous country on the Adriatic in the north-west of this region.",
      hy: "Փոքր լեռնային երկիր Ադրիատիկի ափին՝ տարածաշրջանի հյուսիս-արևմուտքում։",
    },
  },
  map: {
    // No close-up and no callout rule: on the smallest phone map (304×231 at 320×568) Kosovo and
    // Montenegro hold a circle of 22 px, larger than Level 4's Montenegro (15 px), which plays without
    // one; see docs/DATA.md, "Level 9". The focus is Greece's islands as far as the Dodecanese; the area
    // the map may show stays inside the prepared data, with its south edge (29.5°N) setting the limit.
    // Wide enough that the shortest map (304×112, 200% text in Armenian on a 320×568 phone) shows the
    // five whole with their padding, Travel's pin included, rather than zooming in to fill its width.
    coverageHalf: [1000, 410],
    // At 200% text on a 320px phone in Armenian, North Macedonia's name (selected, or Travel's
    // destination) is wider than any room left on the 304×112 map beside the zoom controls: it goes
    // on two lines there, rather than being left out. Everywhere else it keeps one line.
    twoLineCallouts: ["MKD"],
    // Montenegro's callout on a 320px phone in Armenian otherwise lay over the route into Albania.
    calloutsClearRoute: true,
    // Vertices of the shared Natural Earth borders, chosen by the rule in docs/DATA.md ("Travel route
    // line", Level 9).
    routeCrossings: {
      "KOS-MNE": [20.0908, 42.6272],
      "ALB-MNE": [19.518, 42.458],
      "ALB-KOS": [20.457, 42.2504],
      "KOS-MKD": [21.294, 42.1403],
      "ALB-MKD": [20.5102, 41.3444],
      "ALB-GRC": [20.5777, 40.0673],
      "GRC-MKD": [21.9652, 41.1245],
    },
    // Where a straight leg would leave its country or run within 10 km of its edge: Podgorica to the
    // Kosovan border would cross Albania's northern tip at Vermosh (it turns twice in the mountains north
    // of it, the second time just above Plav); Tirana to the Montenegrin border would run within 10 km of
    // the Adriatic coast (it turns inland of Lezhë); Athens to the Albanian and Macedonian borders would cross
    // the Euboean Gulf and the Gulf of Corinth (it takes Level 5's way north out of Attica, west of Lamia).
    routeVia: {
      "MNE@KOS-MNE": [
        [19.69, 42.8],
        [19.93, 42.65],
      ],
      "ALB@ALB-MNE": [[19.75, 41.74]],
      "GRC@ALB-GRC": ATHENS_NORTH,
      "GRC@GRC-MKD": ATHENS_NORTH,
    },
  },
};
