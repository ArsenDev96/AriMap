import type { CountryId, LonLat } from "../content/types";

/**
 * Europe's countries as the Quick Challenge asks them. Framework-independent: plain data, no React, DOM or map
 * code, so a native app can share it. See docs/DATA.md, "Quick Challenge countries", for the scope and how the
 * map draws each one.
 *
 * Scope: the 44 sovereign states of the UN Statistics Division's "Europe" region (M49), plus Kosovo, which M49
 * does not list (it is not a UN member) and the map data draws as its own shape. All but five microstates
 * (NOT_ASKED) can be asked. The challenge's
 * map (src/data/geo/europe-challenge.topo.json) draws their European territory in full, Russia to the Urals; left
 * out are Portugal's Azores, Madeira and Savage Islands and Spain's Canary Islands, and the territories beyond
 * Europe (see docs/DATA.md, "Quick Challenge countries"). Countries M49 places in Asia but
 * often counted in Europe (EUROPE_EDGE) are drawn as context, never asked; so are dependencies (the Faroe
 * Islands, Gibraltar, Jersey, Guernsey, the Isle of Man). Åland is drawn as part of Finland.
 */
export const EUROPE: readonly CountryId[] = [
  // Western Europe.
  "FRA", "BEL", "NLD", "LUX", "DEU", "CHE", "AUT", "LIE", "MCO",
  // Northern Europe.
  "ISL", "NOR", "SWE", "FIN", "DNK", "GBR", "IRL", "EST", "LVA", "LTU",
  // Southern Europe, with Kosovo after Serbia.
  "PRT", "ESP", "AND", "ITA", "SMR", "VAT", "MLT", "SVN", "HRV", "BIH", "MNE", "SRB", "KOS", "ALB", "MKD", "GRC",
  // Eastern Europe.
  "POL", "CZE", "SVK", "HUN", "ROU", "BGR", "MDA", "UKR", "BLR", "RUS",
];

/**
 * Countries M49 places in Western or Central Asia that span or border Europe: drawn as context, never asked.
 * Cyprus is drawn split as the data draws it (the Republic of Cyprus, Northern Cyprus, the UN buffer zone and the
 * UK's two bases).
 */
export const EUROPE_EDGE: readonly CountryId[] = ["CYP", "TUR", "GEO", "ARM", "AZE", "KAZ"];

/**
 * European countries the challenge never asks, by decision (13 October 2026), not by a size rule: Malta,
 * Liechtenstein, San Marino, Monaco and Vatican City. They stay on the map as context (paler, never an answer, no
 * ring), as EUROPE_EDGE's countries are. Andorra and Luxembourg, as small, are asked, with their rings.
 */
export const NOT_ASKED: readonly CountryId[] = ["MLT", "LIE", "SMR", "MCO", "VAT"];

/** The countries a round's questions are drawn from: Europe (EUROPE) but NOT_ASKED, 40 countries. */
export const CHALLENGE_POOL: readonly CountryId[] = EUROPE.filter((id) => !NOT_ASKED.includes(id));

/**
 * The asked countries smaller than 5,000 km², Luxembourg and Andorra (the next smallest asked, Montenegro, has
 * 13,812 km²), each marked on the map by a ring at this point (inside the country) while it is drawn smaller than the
 * ring (smallCountries.ts). The same rings in every round, whatever is asked.
 */
export const RING_COUNTRIES: Readonly<Record<CountryId, LonLat>> = {
  LUX: [6.1, 49.78],
  AND: [1.56, 42.54],
};
