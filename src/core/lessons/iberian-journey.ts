import { alpsLesson } from "./alps";
import type { LessonDefinition } from "./types";

export const iberianJourneyLesson: LessonDefinition = {
  id: "iberian-journey",
  regionName: {
    en: "South-western Europe",
    hy: "Հարավարևմտյան Եվրոպա",
  },
  countries: ["PRT", "ESP", "AND", "FRA", "ITA"],
  // Every real land border among the five (CIA World Factbook; checked against the
  // map data in src/geo/regionMap.test.ts). Restricted to the level's countries:
  // e.g. Spain–Gibraltar, Spain–Morocco (Ceuta and Melilla), France–Monaco and
  // Italy–Switzerland are real but out of scope. Portugal's only neighbour is Spain,
  // Andorra lies between Spain and France in the Pyrenees, and Italy meets only
  // France here. No sea connection is added.
  borders: {
    PRT: ["ESP"],
    ESP: ["PRT", "AND", "FRA"],
    AND: ["ESP", "FRA"],
    FRA: ["ESP", "AND", "ITA"],
    ITA: ["FRA"],
  },
  // Three crossings, by exactly one shortest route: Spain, then France. Through
  // Andorra takes four (Spain → Andorra → France is one crossing more than Spain →
  // France), so a player who goes that way runs out of crossings in France.
  travel: { mission: { id: "prt-to-ita", from: "PRT", to: "ITA" } },
  // France's usual hint ("the largest country in this region, with coasts on the
  // Atlantic and the Mediterranean") is true here but fits Spain almost as well: both
  // have the two coasts, and they look about the same size. Here it is told by the
  // Pyrenees instead.
  hints: {
    FRA: {
      en: "The large country north of the Pyrenees, with coasts on the Atlantic and the Mediterranean.",
      hy: "Պիրենեյներից հյուսիս ընկած մեծ երկիրը՝ Ատլանտյան օվկիանոսի և Միջերկրական ծովի ափերով։",
    },
  },
  map: {
    // Andorra is named in a callout, and shown in the close-up, as Luxembourg is in
    // Level 1. At the whole-map view it is about 3.5 × 3 px on a 320px phone and 11 × 9
    // px on a 1366px desktop. The close-up shows its true outline about 31 px wide on a
    // phone (100px panel) and 65 px on a desktop (208px panel), with the Pyrenees
    // border around it. On smaller maps it sits top-left, over the Bay of Biscay: at
    // the bottom left, where Level 1's opens over western France, it would cover
    // Portugal and Lisbon (docs/DATA.md, "Level 7").
    smallCountries: ["AND"],
    inset: {
      bounds: [
        [1.03, 42.25],
        [2.15, 42.83],
      ],
      country: "AND",
      smallMapCorner: "top-left",
    },
    // The focus is the mainland with Spain's Balearic Islands, Ceuta and Melilla,
    // Corsica, Sardinia, Sicily and Lampedusa; Madeira and the Azores are not in the
    // map data (docs/DATA.md, "Level 7"). The area the map may show stays inside the
    // prepared data: here its south edge (29.5°N, over Morocco and the Atlantic) sets
    // the limit. ±910 × ±885 shows the five countries whole on portrait phones and
    // desktops up to 1920×1080.
    coverageHalf: [910, 885],
    // Vertices of the shared Natural Earth borders, chosen by the rule in docs/DATA.md
    // ("Travel route line", Level 7). France–Italy is Level 2's crossing, with its
    // turning point inland of La Spezia: the same capitals, and the same rule finds it.
    routeCrossings: {
      "ESP-PRT": [-6.8282, 40.3805],
      "AND-ESP": [1.448, 42.4346],
      "AND-FRA": [1.6083, 42.6182],
      "ESP-FRA": [-0.2352, 42.7862],
      "FRA-ITA": alpsLesson.map.routeCrossings!["FRA-ITA"],
    },
    // Lisbon lies on the Tagus estuary: a straight line from it to the Spanish border
    // crosses the water, so Portugal's leg turns north of the estuary first, near
    // Torres Vedras.
    routeVia: {
      "PRT@ESP-PRT": [[-9.22, 39.14]],
      "ITA@FRA-ITA": alpsLesson.map.routeVia!["ITA@FRA-ITA"],
    },
  },
};
