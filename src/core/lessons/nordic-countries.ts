import type { LonLat } from "../content/types";
import type { LessonDefinition } from "./types";

/**
 * The Denmark–Sweden boundary where the Øresund Bridge crosses it: Sweden's statutory line in the Øresund (SFS
 * 2017:1272, annex 1, turning points 55–56, in SWEREF 99, within a metre of WGS84: the 1932 declaration's line on a
 * modern datum, which Denmark's order BEK 1662/2020 also follows), where it meets the bridge deck (OpenStreetMap's
 * ways for it). On the western approach bridge, about 2.3 km east of Peberholm and 5.5 km from Lernacken; see
 * docs/DATA.md, "Level 10".
 */
const ORESUND_BOUNDARY: LonLat = [12.80898, 55.57926];
/** A point on Amager (Copenhagen Airport, Kastrup) in the map data: the Danish land the fixed link starts from. */
const KASTRUP: LonLat = [12.645, 55.62];
/** A point on Swedish land in the map data just east of Lernacken, where the bridge lands (Lernacken itself is reclaimed land, offshore in it). */
const LERNACKEN_SHORE: LonLat = [12.9305, 55.575];
/**
 * The Øresund link, Denmark to Sweden: Kastrup, the Drogden Tunnel's west portal (on reclaimed land the map data
 * shows as sea), its east end on the artificial island Peberholm (Danish; too small to be drawn at this scale, so
 * not in the map data), the bridge's west abutment on Peberholm, the boundary, the bridge's east abutment at
 * Lernacken, Swedish land. Portal: Øresundsbron's published layout (±100 m); abutments: OpenStreetMap.
 */
const ORESUND_LINK: readonly LonLat[] = [KASTRUP, [12.6771, 55.6312], [12.7296, 55.6097], [12.7763, 55.5892], ORESUND_BOUNDARY, [12.8925, 55.5655], LERNACKEN_SHORE];
/**
 * Copenhagen's inner harbour, between Zealand (the capital's point) and Amager (the airport and the link): the map
 * data's coast leaves 1.8 km of water between the two points the line joins, which the city's harbour bridges
 * (Knippelsbro, Langebro) cross in a few hundred metres.
 */
const COPENHAGEN_HARBOUR: readonly [LonLat, LonLat] = [
  [12.5625, 55.6759],
  [12.5901, 55.6724],
];

export const nordicCountriesLesson: LessonDefinition = {
  id: "nordic-countries",
  regionName: {
    en: "the Nordic countries",
    hy: "Հյուսիսային երկրներ",
  },
  countries: ["DNK", "SWE", "NOR", "FIN", "ISL"],
  // Every real land border among the five (CIA World Factbook, final edition; checked against the map data in
  // src/geo/regionMap.test.ts): Sweden–Norway, Sweden–Finland and Norway–Finland. Restricted to the level's
  // countries: Denmark–Germany, Norway–Russia and Finland–Russia are real but out of scope. Denmark and Sweden
  // share no land border: they are joined by the Øresund's fixed link (`map.borderLinks`), a move across it
  // crossing their border on the bridge. Iceland has no land border and no fixed link: no journey reaches it.
  // No sea connection (ferry or flight) is added.
  borders: {
    DNK: ["SWE"],
    SWE: ["DNK", "NOR", "FIN"],
    NOR: ["SWE", "FIN"],
    FIN: ["SWE", "NOR"],
    ISL: [],
  },
  // Two crossings, by one shortest route: Sweden (Denmark's only neighbour here) over the Øresund, then Finland at
  // Haparanda–Tornio. The wrong turn is Sweden → Norway, after which the crossings run out: Norway → Finland, a real
  // border, is never reached within the budget (checked in src/core/progress/levels.test.ts), so the route line has
  // no leg for it. No dead end can be reached with crossings left.
  travel: {
    mission: { id: "dnk-to-fin", from: "DNK", to: "FIN" },
    note: {
      en: "Denmark and Sweden have no land border: the Øresund Bridge and tunnel join them, and the border lies on the bridge. Iceland has no land border, bridge or tunnel to the others, so it isn't on this journey. Journeys here follow borders, bridges and tunnels, not ferries or flights.",
      hy: "Դանիան և Շվեդիան ցամաքային սահման չունեն․ նրանց միացնում են Էրեսունդի կամուրջն ու թունելը, իսկ սահմանն անցնում է կամրջի վրայով։ Իսլանդիան մյուսների հետ ո՛չ ցամաքային սահման ունի, ո՛չ կամուրջ կամ թունել, ուստի այս ճամփորդության մաս չէ։ Այստեղ ճամփորդությունը հետևում է սահմաններին, կամուրջներին ու թունելներին, ոչ թե լաստանավերին կամ թռիչքներին։",
    },
  },
  map: {
    // The northern data (Iceland, Scandinavia and Finland whole; Svalbard left out, Jan Mayen kept as Norway's,
    // Åland merged into Finland), loaded only with this level; see docs/DATA.md, "Level 10".
    dataset: "north",
    // Wide enough that the shortest map (304×112, 200% text in Armenian on a 320×568 phone) shows the five whole
    // with their padding, and tall enough for a 396×413 phone map: the area scripts/prepare-north-geo.mjs cut the
    // data round (COVERAGE_HALF there).
    coverageHalf: [2095, 990],
    // Denmark, the smallest of the five (an 11 px circle on a 320×568 phone), with the Øresund to Malmö; Bornholm
    // stays on the main map. Bottom-left on wide maps too: their top-left is Iceland.
    inset: {
      bounds: [
        [7.9, 54.45],
        [13.15, 57.85],
      ],
      country: "DNK",
      wideMapCorner: "bottom-left",
    },
    // Vertices of the shared Natural Earth borders (the Øresund's: the statutory boundary on the bridge): Sweden–
    // Finland at the Torne's mouth between Haparanda and Tornio, Sweden–Norway nearest Morokulien (Eda–Magnor, on
    // the Stockholm–Oslo road). Norway–Finland has none: no journey reaches it (see `travel`).
    routeCrossings: {
      "DNK-SWE": ORESUND_BOUNDARY,
      "FIN-SWE": [24.164, 65.8409],
      "NOR-SWE": [12.2903, 59.9587],
    },
    // Where a straight leg would leave its country (checked in src/geo/route.test.ts): Copenhagen to the link crosses
    // the inner harbour to Amager, then follows the link; Stockholm to Lernacken would cut across bays of the Baltic
    // coast (it turns inland: Katrineholm, Linköping, south of Lake Vättern, Hässleholm, Malmö); Stockholm to Haparanda
    // would cross the Gulf of Bothnia (it runs inland: Uppsala, Bollnäs, Sollefteå, Lycksele, Älvsbyn, north of Kalix);
    // Helsinki to Tornio would cut the Gulf's coast (it runs inland, by Jyväskylä and west of Kajaani, then to the Torne).
    routeVia: {
      "DNK@DNK-SWE": [...COPENHAGEN_HARBOUR, ...ORESUND_LINK.slice(0, ORESUND_LINK.indexOf(ORESUND_BOUNDARY))],
      "SWE@DNK-SWE": [
        [16.2, 59.0],
        [15.62, 58.41],
        [14.6, 57.4],
        [13.77, 56.16],
        [13.0, 55.6],
        ...ORESUND_LINK.slice(ORESUND_LINK.indexOf(ORESUND_BOUNDARY) + 1).reverse(),
      ],
      "SWE@FIN-SWE": [
        [17.64, 59.86],
        [16.39, 61.35],
        [17.27, 63.17],
        [18.67, 64.6],
        [21.0, 65.68],
        [23.2, 66.1],
      ],
      "FIN@FIN-SWE": [
        [25.7, 62.2],
        [27.0, 64.5],
        [24.9, 66.05],
      ],
    },
    routeLinks: [{ country: "DNK", name: "Copenhagen's inner-harbour bridges", points: COPENHAGEN_HARBOUR }],
    borderLinks: [{ between: ["DNK", "SWE"], name: "Øresund Bridge and Drogden Tunnel", points: ORESUND_LINK }],
  },
};
