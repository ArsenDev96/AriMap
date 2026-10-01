import type { LessonDefinition } from "./types";

/**
 * The Pelješac Bridge (opened 2022, 2,404 m), drawn along its axis between the
 * points where that line meets Croatian land in the map data (its simplified
 * coast lies up to about 1.2 km from the real ends). Croatia's far south
 * (Pelješac, Dubrovnik, the border with Montenegro) is cut off from the rest of
 * Croatia by Bosnia and Herzegovina's coast at Neum; the bridge joins the two
 * without entering Bosnia and Herzegovina. See docs/DATA.md, "Level 4".
 */
export const PELJESAC_BRIDGE = [
  [17.5554, 42.9547],
  [17.5238, 42.9187],
] as const;

export const adriaticLesson: LessonDefinition = {
  id: "along-the-adriatic",
  regionName: {
    en: "the Adriatic countries",
    hy: "Ադրիատիկյան երկրներ",
  },
  countries: ["ITA", "SVN", "HRV", "BIH", "MNE"],
  // Every real land border among the five (CIA World Factbook; checked against the
  // map data in src/geo/regionMap.test.ts). Restricted to the level's countries:
  // e.g. Italy–Austria and Croatia–Serbia are real but out of scope. Italy meets
  // only Slovenia (no land border with Croatia, Bosnia and Herzegovina or
  // Montenegro), and Slovenia meets neither Bosnia and Herzegovina nor Montenegro.
  // Croatia and Montenegro meet in the far south, at Prevlaka (19 km).
  borders: {
    ITA: ["SVN"],
    SVN: ["ITA", "HRV"],
    HRV: ["SVN", "BIH", "MNE"],
    BIH: ["HRV", "MNE"],
    MNE: ["HRV", "BIH"],
  },
  // Three crossings, by one shortest route: Slovenia, then Croatia. Through Bosnia
  // and Herzegovina takes four; there is no sea crossing.
  travel: { mission: { id: "ita-to-mne", from: "ITA", to: "MNE" } },
  hints: {
    ITA: {
      en: "The long, boot-shaped peninsula on the west side of the Adriatic Sea.",
      hy: "Երկար, կոշիկաձև թերակղզի Ադրիատիկ ծովի արևմտյան կողմում։",
    },
  },
  map: {
    // No close-up and no callout rule: every country here is large enough to tap at
    // the whole-map view. The area the map may show stays inside the prepared data:
    // here its south edge (32°N, below Lampedusa) sets the limit; see docs/DATA.md,
    // "Coverage and view limits".
    coverageHalf: [1000, 505],
    // Vertices of the shared Natural Earth borders, chosen by the rule in docs/DATA.md
    // ("Travel route line", Level 4).
    routeCrossings: {
      "ITA-SVN": [13.6085, 45.9266],
      "HRV-SVN": [15.6635, 45.8762],
      "BIH-HRV": [16.3817, 45.1076],
      "HRV-MNE": [18.4441, 42.4778],
      "BIH-MNE": [18.6643, 43.2332],
    },
    // Where a straight leg would leave its country: Rome to Gorizia would cross the
    // Adriatic (it turns in the Veneto, inland of the lagoon); Podgorica to the
    // Croatian border would cross the Bay of Kotor (it turns in the hills north of
    // it); Zagreb to the Montenegrin border runs down the Dalmatian hinterland, over
    // the Pelješac Bridge, along Pelješac and through Ston, then along the coast past
    // Dubrovnik.
    routeVia: {
      "ITA@ITA-SVN": [[11.78, 45.76]],
      "MNE@HRV-MNE": [[18.78, 42.54]],
      "HRV@HRV-MNE": [
        // Lika, then the Neretva delta, inland of the coast and clear of the border.
        [15.43, 44.43],
        [17.58, 43.02],
        ...PELJESAC_BRIDGE,
        // Ston, Slano, Dubrovnik, and through the narrow strip towards Čilipi.
        [17.735, 42.83],
        [17.89, 42.802],
        [18.111, 42.663],
        [18.165, 42.638],
        [18.235, 42.615],
      ],
    },
    routeLinks: [{ country: "HRV", name: "Pelješac Bridge", points: PELJESAC_BRIDGE }],
  },
};
