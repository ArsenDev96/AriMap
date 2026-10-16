import type { LessonDefinition } from "./types";
import { balticJourneyLesson } from "./baltic-journey";
import { easternEuropeLesson } from "./eastern-europe";

export const russiaAndWesternNeighboursLesson: LessonDefinition = {
  id: "russia-and-western-neighbours",
  regionName: {
    en: "north-eastern Europe",
    hy: "Հյուսիսարևելյան Եվրոպա",
  },
  countries: ["RUS", "FIN", "EST", "LVA", "BLR"],
  // Every real land border among the five (CIA World Factbook, final edition; checked against the map data in
  // src/geo/regionMap.test.ts): Russia–Finland, Russia–Estonia, Russia–Latvia, Russia–Belarus, Estonia–Latvia and
  // Latvia–Belarus, all on Russia's mainland. Estonia and Finland share none (the Gulf of Finland lies between), and
  // Russia's Kaliningrad borders only Lithuania and Poland, neither in the level: so no move, crossing or route leg
  // can enter Kaliningrad or jump between it and the mainland. Russia's and Belarus's borders with Ukraine, and
  // Finland's with Sweden and Norway, are real but out of scope. No ferry or flight is added.
  borders: {
    EST: ["LVA", "RUS"],
    LVA: ["EST", "RUS", "BLR"],
    BLR: ["LVA", "RUS"],
    RUS: ["FIN", "EST", "LVA", "BLR"],
    FIN: ["RUS"],
  },
  // Two crossings, by exactly two shortest routes: Estonia → Latvia → Belarus and Estonia → Russia → Belarus. Both of
  // Estonia's neighbours are on one, so the choice that matters is the second move. The wrong turns, Latvia → Russia,
  // Russia → Latvia and Russia → Finland, each use the second crossing (out of crossings there). No state offers a single
  // move, and none is a dead end.
  travel: {
    mission: { id: "est-to-blr", from: "EST", to: "BLR" },
    // Finland is shown beside Estonia's two neighbours at the start, as a geography distractor (Level 7's mechanism):
    // the two share no border (the Gulf of Finland lies between), so choosing it moves nothing and uses no crossing, and
    // Travel says so. Not an edge of `borders`.
    nonNeighbourOptions: [{ route: ["EST"], country: "FIN" }],
    // Kaliningrad is explained in Discover (Russia's hint), not here.
    note: {
      en: "This journey is a map exercise along land borders, not a guide to crossing them today.",
      hy: "Այս ճանապարհորդությունը քարտեզային վարժություն է՝ ցամաքային սահմաններով, և ոչ թե այսօր դրանք հատելու ուղեցույց։",
    },
  },
  // The four taught before keep their own wording elsewhere; here Russia reaches further north and south than any of
  // them, so "northernmost" (Estonia's), "in the east" (Finland's) and "in the north" (Belarus's) no longer fit, and
  // Latvia's places it beside Lithuania, which is not in this level.
  hints: {
    FIN: {
      en: "A land of forests and lakes north of Estonia, across the Gulf of Finland.",
      hy: "Անտառների և լճերի երկիր Էստոնիայից հյուսիս՝ Ֆիննական ծոցի մյուս կողմում։",
    },
    EST: {
      en: "The smallest country of this region, on the Gulf of Finland, with many islands.",
      hy: "Տարածաշրջանի ամենափոքր երկիրը՝ Ֆիննական ծոցի ափին, բազմաթիվ կղզիներով։",
    },
    LVA: {
      en: "On the Baltic Sea around the Gulf of Riga, between Estonia and Belarus.",
      hy: "Բալթիկ ծովի ափին՝ Ռիգայի ծոցի շուրջը, Էստոնիայի և Բելառուսի միջև։",
    },
    BLR: {
      en: "A flat country with no coast, south of Latvia, with many forests, lakes and marshes.",
      hy: "Հարթ երկիր առանց ծովի՝ Լատվիայից հարավ, բազմաթիվ անտառներով, լճերով և ճահիճներով։",
    },
  },
  map: {
    // The eastern data (Finland whole, western Russia to beyond Moscow, Kaliningrad), loaded only with this level; see
    // docs/DATA.md, "Level 12".
    dataset: "east",
    // Russia counts in the frame only by its part within this box: Saint Petersburg, Karelia and Moscow with a margin
    // (Kaliningrad lies in the other four's frame anyway). All of Russia would make the five a speck. The same box as
    // FRAME_WITHIN in scripts/prepare-east-geo.mjs, which cut the data round the frame it gives.
    frameWithin: {
      RUS: [
        [26, 54],
        [39, 70],
      ],
    },
    // The frame is taller than wide (Belarus to the North Cape): the shortest map (304×112, 200% text in Armenian on a
    // 320×568 phone) needs ±2265 across and ±835 up and down to show it whole with its padding: the area
    // scripts/prepare-east-geo.mjs cut the data round (COVERAGE_HALF there).
    coverageHalf: [2270, 840],
    // Russia's own label point (the Quick Challenge's, east of Moscow) is off this level's phone maps: here it is named
    // from the Valdai Hills, between Saint Petersburg and Moscow.
    labels: { RUS: [34.0, 58.0] },
    // At 200% text on a phone the zoom controls, in a row, can cover a label point: a highlighted country's dot moves
    // clear of them, as in Levels 10 and 11.
    calloutDotsClearControls: true,
    // Levels 6 and 8's crossings (vertices of the same borders here: the eastern data keeps their shapes), and new ones
    // on Russia's borders by the same rule (docs/DATA.md, "Travel route line", "Level 12"): all on its mainland.
    // Estonia–Russia's is not by the rule: an approximate crossing near Koidula, on land south of Lake Pskov, about 5 km
    // from the Koidula–Kunichina Gora checkpoint (most of that border runs through Lakes Peipus and Pskov, which the map
    // data draws as land).
    routeCrossings: {
      "EST-LVA": balticJourneyLesson.map.routeCrossings!["EST-LVA"],
      "BLR-LVA": easternEuropeLesson.map.routeCrossings!["BLR-LVA"],
      "EST-RUS": [27.5536, 57.7949],
      "LVA-RUS": [27.7151, 56.9573],
      "BLR-RUS": [31.3246, 54.2291],
      "FIN-RUS": [30.1109, 64.7444],
    },
  },
};
