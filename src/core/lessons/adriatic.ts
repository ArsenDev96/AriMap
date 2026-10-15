import { towardsGreeceLesson } from "./towards-greece";
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
  // Travel only: Hungary and Serbia, real neighbours that give a choice where the five alone gave one
  // way (Slovenia, before Italy) or none (Bosnia and Herzegovina, entered from Croatia). Neither is on a
  // shortest route: Montenegro → Italy stays three crossings, by Croatia and Slovenia only.
  travelOnly: ["HUN", "SRB"],
  // Every real land border among the seven (CIA World Factbook; checked against the
  // map data in src/geo/regionMap.test.ts). Restricted to them: e.g. Italy–Austria
  // and Slovenia–Austria are real but out of scope. Italy meets only Slovenia (no
  // land border with Croatia, Bosnia and Herzegovina or Montenegro), and Slovenia
  // meets neither Bosnia and Herzegovina nor Montenegro. Croatia and Montenegro meet
  // in the far south, at Prevlaka (19 km).
  borders: {
    ITA: ["SVN"],
    SVN: ["ITA", "HRV", "HUN"],
    HRV: ["SVN", "BIH", "MNE", "HUN", "SRB"],
    BIH: ["HRV", "MNE", "SRB"],
    MNE: ["HRV", "BIH", "SRB"],
    HUN: ["SVN", "HRV", "SRB"],
    SRB: ["HRV", "BIH", "MNE", "HUN"],
  },
  // Three crossings, by one shortest route: Croatia, then Slovenia. Montenegro offers
  // Croatia, Bosnia and Herzegovina or Serbia; Croatia then Slovenia, Bosnia and
  // Herzegovina, Hungary or Serbia; Slovenia then Italy or Hungary. Every other way
  // takes four crossings or more. Bosnia and Herzegovina has only three neighbours, so
  // entered second (from Croatia or Serbia) it leaves one way on (never none, as
  // before Serbia). There is no sea crossing.
  travel: {
    mission: { id: "mne-to-ita", from: "MNE", to: "ITA" },
    // Until 2026-10-06 the journey ran the other way. Saved attempts and results for it keep it.
    earlierMissions: [{ id: "ita-to-mne", from: "ITA", to: "MNE" }],
  },
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
    // Budapest (Hungary is Travel only) lies 20 units inside the coverage's north edge: the traveller's pin there
    // needs up to 164 above it (25 px at the smallest map's zoom, 304×112 at 200% text). Travel reaches 160 further
    // north, inside the data, and the level's relief overview with it; see docs/DATA.md, "Level 4".
    travelReachNorth: 160,
    // Vertices of the shared Natural Earth borders, chosen by the rule in docs/DATA.md
    // ("Travel route line", Level 4).
    routeCrossings: {
      "ITA-SVN": [13.6085, 45.9266],
      "HRV-SVN": [15.6635, 45.8762],
      "BIH-HRV": [16.3817, 45.1076],
      "HRV-MNE": [18.4441, 42.4778],
      "BIH-MNE": [18.6643, 43.2332],
      // Travel only, at road crossings (docs/DATA.md, "Level 4"): Goričan–Letenye, Pince–Dolga vas,
      // Level 5's Röszke–Horgoš, Zvornik, Bajakovo–Batrovci and Dobrakovo.
      "HRV-HUN": [16.7126, 46.4126],
      "HUN-SVN": [16.5011, 46.5449],
      "HUN-SRB": towardsGreeceLesson.map.routeCrossings!["HUN-SRB"],
      "BIH-SRB": [19.1072, 44.3828],
      "HRV-SRB": [19.0862, 45.0608],
      "MNE-SRB": [19.7611, 43.1087],
    },
    // Where a straight leg would leave its country: Rome to Gorizia would cross the
    // Adriatic (it turns in the Veneto, inland of the lagoon); Podgorica to the
    // Croatian border would cross the Bay of Kotor (it turns in the hills north of
    // it); Zagreb to the Montenegrin border runs down the Dalmatian hinterland, over
    // the Pelješac Bridge, along Pelješac and through Ston, then along the coast past
    // Dubrovnik; Ljubljana to the Hungarian border would cut through Croatia's
    // Međimurje (it turns at Maribor).
    routeVia: {
      "ITA@ITA-SVN": [[11.78, 45.76]],
      "MNE@HRV-MNE": [[18.78, 42.54]],
      "SVN@HUN-SVN": [[15.65, 46.555]],
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
