import type { LessonDefinition } from "./types";

export const easternEuropeLesson: LessonDefinition = {
  id: "eastern-europe",
  regionName: {
    en: "Eastern Europe",
    hy: "Արևելյան Եվրոպա",
  },
  countries: ["POL", "BLR", "UKR", "MDA", "ROU"],
  // Every real land border among the five (CIA World Factbook, last edition; checked
  // against the map data in src/geo/regionMap.test.ts). Restricted to the level's
  // countries: e.g. Poland–Germany, Belarus–Lithuania, Ukraine–Russia, Ukraine–Hungary
  // and Romania–Bulgaria are real but out of scope. Poland and Belarus meet neither
  // Moldova nor Romania: Ukraine lies between. Moldova lies between Romania and Ukraine
  // only. Ukraine and Romania meet in two places (Maramureș and Bukovina in the north,
  // the Danube delta in the south), one border here. No sea connection is added.
  borders: {
    POL: ["BLR", "UKR"],
    BLR: ["POL", "UKR"],
    UKR: ["POL", "BLR", "MDA", "ROU"],
    MDA: ["UKR", "ROU"],
    ROU: ["UKR", "MDA"],
  },
  // Two crossings, by exactly one shortest route: Ukraine, then Moldova. Only Ukraine
  // borders both Poland and Moldova; through Belarus or Romania takes three, so a player
  // who goes that way runs out of crossings before Moldova.
  travel: { mission: { id: "pol-to-mda", from: "POL", to: "MDA" } },
  // Poland's usual hint ("in the north-east of this region") and Romania's ("the largest
  // country in this region") were written for Levels 3 and 5; here Poland is in the west
  // and Ukraine is the largest, with the Carpathians and a Black Sea coast too. So each is
  // told by where it lies instead.
  hints: {
    POL: {
      en: "The westernmost country of this region, with a coast on the Baltic Sea.",
      hy: "Տարածաշրջանի ամենաարևմտյան երկիրը՝ Բալթիկ ծովի ափով։",
    },
    ROU: {
      en: "The southernmost country of this region, with the arc of the Carpathians and a coast on the Black Sea.",
      hy: "Տարածաշրջանի ամենահարավային երկիրը՝ Կարպատների աղեղով և Սև ծովի ափով։",
    },
  },
  map: {
    // The focus is the five countries whole, Crimea included (it is part of Ukraine in
    // the map data: docs/DATA.md, "Level 8"). The area the map may show stays inside the
    // prepared data: here its east edge (48°E, beyond the Sea of Azov) and north edge
    // (62°N) set the limit, which allows at most about ±677 vertically at ±720. ±720 × ±675
    // shows the five countries whole on portrait phones (zoomed in by up to 4% to stay
    // inside it), phones in landscape and desktops up to 1920×1080 at their full width.
    coverageHalf: [720, 675],
    // Vertices of the shared Natural Earth borders, chosen by the rule in docs/DATA.md
    // ("Travel route line", Level 8): every leg straight, at least 10 km from its
    // country's edges.
    routeCrossings: {
      "BLR-POL": [23.9224, 52.7426],
      "POL-UKR": [23.5655, 50.2577],
      "BLR-UKR": [27.973, 51.5579],
      "MDA-UKR": [29.4589, 47.2934],
      "ROU-UKR": [24.6617, 47.8538],
      "MDA-ROU": [27.9631, 47.0435],
    },
  },
};
