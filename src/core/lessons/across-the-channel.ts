import type { LonLat } from "../content/types";
import type { LessonDefinition } from "./types";
import { westernEuropeLesson } from "./western-europe";

/**
 * The France–United Kingdom frontier in the Channel Tunnel: under the Treaty of Canterbury (1986, Article 3) the vertical
 * projection of the continental-shelf boundary of the 1982 agreement (points 1–14, on ED50), whose loxodrome between
 * points 9 (50°57'00"N 1°21'25"E) and 10 (51°02'19"N 1°32'53"E) the tunnels cross. Converted to WGS84 with a standard
 * three-parameter shift (a few metres) and intersected with OpenStreetMap's running tunnels (north 51.01472 N 1.49698 E,
 * south 51.01444 N 1.49638 E): their mean, rounded. About 22.6 km from the French portal and 27.7 km from the English
 * one, along the tunnel. A derived point for a schematic line, not a surveyed one; see docs/DATA.md, "Level 11".
 */
const CHANNEL_TUNNEL_BOUNDARY: LonLat = [1.4967, 51.0146];
/**
 * The Channel Tunnel, France to the United Kingdom: from the portal at Beussingue (Coquelles) to the portal at Castle
 * Hill (Folkestone), OpenStreetMap's Running Tunnel North simplified to within 75 m (Douglas–Peucker, 100 m), with the
 * frontier among its points. Both portals lie on land in the map data; the points between them are under the sea, and
 * under the chalk of Shakespeare Cliff and Folkestone at the English end.
 */
const CHANNEL_TUNNEL: readonly LonLat[] = [
  [1.7805, 50.9229],
  [1.7516, 50.9344],
  [1.7319, 50.9487],
  [1.7163, 50.9556],
  [1.6931, 50.9607],
  [1.6234, 50.9833],
  [1.5754, 50.9913],
  [1.5122, 51.0085],
  CHANNEL_TUNNEL_BOUNDARY,
  [1.4826, 51.022],
  [1.4433, 51.049],
  [1.4094, 51.0684],
  [1.3017, 51.1056],
  [1.2689, 51.1124],
  [1.2423, 51.1132],
  [1.2236, 51.1106],
  [1.184, 51.1006],
  [1.1569, 51.0972],
];

/** Level 1's crossings (the same capitals, and vertices of the same borders here: the Channel data keeps Level 1's shapes). */
const level1 = westernEuropeLesson.map.routeCrossings!;

export const acrossTheChannelLesson: LessonDefinition = {
  id: "across-the-channel",
  regionName: {
    en: "north-western Europe",
    hy: "Հյուսիսարևմտյան Եվրոպա",
  },
  countries: ["GBR", "IRL", "FRA", "BEL", "DEU"],
  // Travel only: Luxembourg, which borders Germany, France and Belgium, so every wrong turn on the Continent offers a
  // second way on (Germany → Belgium offers France or Luxembourg, Germany → Luxembourg France or Belgium). It lies on no
  // shortest route: through it the journey takes three crossings.
  travelOnly: ["LUX"],
  // Every real land border among the six (CIA World Factbook, final edition; checked against the map data in
  // src/geo/regionMap.test.ts): France–Belgium, France–Germany, France–Luxembourg, Belgium–Germany, Belgium–Luxembourg,
  // Germany–Luxembourg, and the United Kingdom–Ireland border on the island of Ireland, between Northern Ireland and
  // Ireland. Restricted to them: Germany's and Belgium's borders with the Netherlands, and Germany's other neighbours,
  // are real but out of scope. France and the United Kingdom share no land border: they are joined by the Channel
  // Tunnel (`map.borderLinks`), a move through it crossing their border under the sea. No ferry or flight is added.
  borders: {
    GBR: ["FRA", "IRL"],
    IRL: ["GBR"],
    FRA: ["GBR", "BEL", "DEU", "LUX"],
    BEL: ["FRA", "DEU", "LUX"],
    DEU: ["FRA", "BEL", "LUX"],
    LUX: ["FRA", "BEL", "DEU"],
  },
  // Two crossings, by one shortest route: France, then the United Kingdom through the Channel Tunnel. The wrong turns
  // are Germany → Belgium and Germany → Luxembourg, after which the crossings run out on the Continent. The journey ends
  // on reaching the United Kingdom, so it never crosses the UK–Ireland border; Ireland is learned in Discover and Find.
  travel: {
    mission: { id: "deu-to-gbr", from: "DEU", to: "GBR" },
    note: {
      en: "France and the United Kingdom are connected under the sea by the Channel Tunnel.",
      hy: "Ֆրանսիան և Միացյալ Թագավորությունը ծովի տակով միացված են Լա Մանշի թունելով։",
    },
  },
  hints: {
    // Its usual hint places it beside the Netherlands, which is not in this level.
    BEL: {
      en: "The smallest country of this region, between France and Germany, with a short North Sea coast.",
      hy: "Տարածաշրջանի ամենափոքր երկիրը՝ Ֆրանսիայի և Գերմանիայի միջև, Հյուսիսային ծովի կարճ ափով։",
    },
  },
  map: {
    // The Channel data (the five whole, Shetland, Orkney, Northern Ireland and Corsica included; the Crown Dependencies
    // as faded neighbours of their own), loaded only with this level; see docs/DATA.md, "Level 11".
    dataset: "channel",
    // The five are taller than wide (Corsica to Shetland): the shortest map (304×112, 200% text in Armenian on a
    // 320×568 phone) needs ±2381 across and ±877 up and down to show them whole with their padding: the area
    // scripts/prepare-channel-geo.mjs cut the data round (COVERAGE_HALF there).
    coverageHalf: [2390, 880],
    // Luxembourg (Travel only) is a few pixels across at the whole-map view: named in a callout, and in the close-up.
    smallCountries: ["LUX"],
    // At 200% text on a phone (304×112 and 304×150 maps; 280×182 in landscape) the zoom controls, in a row, cover the
    // label points of Germany, Belgium and France: a highlighted one's dot moves clear of them, as in Level 10.
    calloutDotsClearControls: true,
    // Belgium, the smallest of the five (a 12 px circle on a 320×568 phone), with Luxembourg and the Strait of Dover (the
    // Channel Tunnel's ends). Bottom-left on wide maps too, over the Bay of Biscay: top-left reaches Ireland's west coast.
    // On smaller maps it opens beside its toggle, along the bottom edge (above it, it would cover Ireland), and never
    // opens by itself: at 200% text on a phone it did, for the United Kingdom's and France's names, which it doesn't
    // show, and covered Ireland. On wide maps it is open by default, as in every level. Measured: docs/DATA.md, "Level 11".
    inset: {
      bounds: [
        [1.0, 49.35],
        [6.6, 51.6],
      ],
      country: "BEL",
      wideMapCorner: "bottom-left",
      smallMapBeside: true,
      autoOpen: false,
    },
    // Level 1's crossings (vertices of the same borders here), and the Channel Tunnel's: the boundary under the sea.
    // The UK–Ireland border has none: no journey crosses it (the journey ends in the United Kingdom).
    routeCrossings: {
      "FRA-GBR": CHANNEL_TUNNEL_BOUNDARY,
      "DEU-FRA": level1["DEU-FRA"],
      "BEL-FRA": level1["BEL-FRA"],
      "BEL-DEU": level1["BEL-DEU"],
      "FRA-LUX": level1["FRA-LUX"],
      "BEL-LUX": level1["BEL-LUX"],
      "DEU-LUX": level1["DEU-LUX"],
    },
    // Paris to the tunnel's French portal and London to its English portal are straight lines on land (checked in
    // src/geo/route.test.ts); each leg then follows the tunnel to the boundary.
    routeVia: {
      "FRA@FRA-GBR": CHANNEL_TUNNEL.slice(0, CHANNEL_TUNNEL.indexOf(CHANNEL_TUNNEL_BOUNDARY)),
      "GBR@FRA-GBR": CHANNEL_TUNNEL.slice(CHANNEL_TUNNEL.indexOf(CHANNEL_TUNNEL_BOUNDARY) + 1).reverse(),
    },
    borderLinks: [{ between: ["FRA", "GBR"], name: "Channel Tunnel", points: CHANNEL_TUNNEL }],
  },
};
