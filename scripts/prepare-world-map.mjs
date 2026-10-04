// Prepares the continent map on the home screen, committed at src/data/geo/world-map.ts.
//
// Usage:
//   1. Download Natural Earth 1:110m Admin 0 – Countries (v5.1.1):
//      https://naciscdn.org/naturalearth/110m/cultural/ne_110m_admin_0_countries.zip
//   2. Unzip it and run:
//      node scripts/prepare-world-map.mjs path/to/ne_110m_admin_0_countries.shp
//
// Countries are only the input: each is assigned to a geographic continent (not its
// political one), the few that span two are cut along the lines below, and every
// continent is merged into one outline with no borders inside it. The output is plain SVG
// path data, already projected, so the home screen needs no map library and no download.
// See docs/DATA.md, "World map (home screen)".
import mapshaper from "mapshaper";
import polygonClipping from "polygon-clipping";
import { geoNaturalEarth1, geoPath, geoGraticule } from "d3-geo";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const input = process.argv[2];
if (!input) {
  console.error("Usage: node scripts/prepare-world-map.mjs <ne_110m_admin_0_countries.shp>");
  process.exit(1);
}
const output = resolve("src/data/geo/world-map.ts");

// The map's size in SVG units (the page scales it): Natural Earth's proportions at this width.
const WIDTH = 1000;

// Natural Earth CONTINENT → the map's region. The open ocean's islands (the French Southern
// and Antarctic Lands: Kerguelen) are drawn as context with Antarctica.
const BY_CONTINENT = {
  Europe: "europe",
  Asia: "asia",
  Africa: "africa",
  "North America": "north-america",
  "South America": "south-america",
  Oceania: "oceania",
  Antarctica: "antarctica",
  "Seven seas (open ocean)": "antarctica",
};

// Europe–Asia (simplified, lon/lat): the Ural Mountains' watershed from the Kara Sea to the
// Ural River's source, the Ural River to the Caspian Sea, across the Caspian, the Greater
// Caucasus' main ridge to the Black Sea, and the Bosporus, the Sea of Marmara and the
// Dardanelles. Land on this side of the line is Europe. It only cuts the countries that span
// both (TRANSCONTINENTAL), so it needs no detail away from them.
const EUROPE_SIDE = [
  [-30, 85], [70, 85],
  // Kara Sea, east of Novaya Zemlya, to the Urals' northern end at Baydaratskaya Bay.
  [70, 77], [66, 73], [64.5, 70.5], [66.5, 68.8],
  // The Urals' crest (Polar, Northern, Middle and Southern Urals).
  [64, 67.5], [61, 66], [59.5, 65], [59.3, 63], [59, 61.5], [59.5, 60], [59.5, 58], [60, 56.8], [59.8, 55.5], [59.3, 54.6],
  // The Ural River: Magnitogorsk, Orsk, Orenburg, Oral, Atyrau and its mouth.
  [59, 53.4], [58.6, 51.2], [57.5, 51], [55.1, 51.7], [53, 51.5], [51.4, 51.2], [51.6, 49.5], [51.5, 48], [51.9, 47.1], [51.8, 46.8],
  // Across the Caspian Sea to the Caucasus' eastern end.
  [49.8, 45.5], [49.5, 42.5], [49.3, 41.2],
  // The Greater Caucasus' main ridge (Bazardüzü, Kazbek, Elbrus, Fisht) to the Black Sea at Anapa.
  [48.3, 41.3], [46.5, 41.9], [44.5, 42.7], [42.4, 43.3], [40, 43.9], [38, 44.4], [37, 44.3],
  // Across the Black Sea, the Bosporus, the Sea of Marmara and the Dardanelles.
  [29.3, 41.4], [29.05, 41.15], [29, 41], [28, 40.75], [26.7, 40.35], [26.1, 40], [25.5, 39.5],
  [25.5, 34], [-30, 34], [-30, 85],
];
const TRANSCONTINENTAL = new Set(["RUS", "KAZ", "TUR", "GEO", "AZE"]);

// Africa–Asia: Egypt's Sinai, east of the Suez Canal and the Gulf of Suez, is Asia.
const SINAI_SIDE = [[32.3, 33], [32.35, 31.2], [32.55, 29.9], [33.2, 28.6], [34, 27.5], [35, 26], [40, 26], [40, 33], [32.3, 33]];

// Whole islands whose continent differs from their country's (by the island's centre):
// New Guinea's western half (Indonesia) belongs with the island to Oceania (the Australian
// continent), Hawaii (United States) to Oceania (Polynesia), French Guiana (France) to South
// America. Trinidad lies on South America's continental shelf.
const ISLAND_RULES = [
  { id: "IDN", test: ([lon]) => lon > 131, region: "oceania" },
  { id: "USA", test: ([lon, lat]) => lon < -150 && lat < 30, region: "oceania" },
  { id: "FRA", test: ([lon]) => lon < -30, region: "south-america" },
];
const COUNTRY_RULES = { TTO: "south-america" };

// The map's central meridian: 11°E puts the map's edge (169°W) in the Bering Strait, so
// Chukotka stays whole with Asia and Alaska with North America.
const ROTATE = -11;

const REGIONS = ["europe", "asia", "africa", "north-america", "south-america", "oceania", "antarctica"];

const { "out.json": out } = await mapshaper.applyCommands(
  `-i "${input}" encoding=utf8 -filter-fields ADM0_A3,CONTINENT -simplify 50% keep-shapes -o out.json format=geojson`,
);
const countries = JSON.parse(out).features;

const pieces = Object.fromEntries(REGIONS.map((r) => [r, []]));
const polygonsOf = (geometry) => (geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates);
const centre = (polygon) => {
  const ring = polygon[0];
  const [x, y] = ring.reduce(([a, b], [lon, lat]) => [a + lon, b + lat], [0, 0]);
  return [x / ring.length, y / ring.length];
};

for (const { properties, geometry } of countries) {
  const id = properties.ADM0_A3;
  const region = COUNTRY_RULES[id] ?? BY_CONTINENT[properties.CONTINENT];
  if (!region) throw new Error(`No region for ${id} (${properties.CONTINENT})`);
  for (const polygon of polygonsOf(geometry)) {
    const rule = ISLAND_RULES.find((r) => r.id === id && r.test(centre(polygon)));
    if (rule) {
      pieces[rule.region].push(polygon);
    } else if (TRANSCONTINENTAL.has(id)) {
      pieces.europe.push(...polygonClipping.intersection(polygon, [EUROPE_SIDE]));
      pieces.asia.push(...polygonClipping.difference(polygon, [EUROPE_SIDE]));
    } else if (id === "EGY") {
      pieces.asia.push(...polygonClipping.intersection(polygon, [SINAI_SIDE]));
      pieces.africa.push(...polygonClipping.difference(polygon, [SINAI_SIDE]));
    } else {
      pieces[region].push(polygon);
    }
  }
}

// Land just east of 180° (Chukotka, Wrangel Island, Fiji's eastern islands) is moved to
// 180–191°E, beside the rest of its land, so the two halves merge without a seam.
const unwrap = (polygon) =>
  polygon.every((ring) => ring.every(([lon]) => lon <= -168)) ? polygon.map((ring) => ring.map(([lon, lat]) => [lon + 360, lat])) : polygon;

const projection = geoNaturalEarth1().rotate([ROTATE, 0]).precision(0.2);
projection.fitWidth(WIDTH, { type: "Sphere" });
const path = geoPath(projection).digits(1);
const [[, top], [, bottom]] = path.bounds({ type: "Sphere" });
const HEIGHT = Math.ceil(bottom - top);
projection.translate([projection.translate()[0], projection.translate()[1] - top]);

const shapes = {};
for (const region of REGIONS) {
  // Antarctica is one country, left as it is: merged in a flat lon/lat plane, its edge along the pole would turn inside out.
  const merged = region === "antarctica" ? pieces[region] : polygonClipping.union(...pieces[region].map((p) => [unwrap(p)]));
  // d3-geo expects outer rings clockwise, the opposite of GeoJSON (mapshaper's and polygon-clipping's output).
  const coordinates = merged.map((polygon) => polygon.map((ring) => [...ring].reverse()));
  shapes[region] = path({ type: "MultiPolygon", coordinates });
}

const sphere = path({ type: "Sphere" });
// Faint lines only: resampled more coarsely, to whole units.
const graticule = geoPath(projection.precision(1)).digits(0)(geoGraticule().step([30, 30])());

// The centre of each category's name on the map (lon/lat), when the map has room for the names
// on it. Europe's, a button, sits just south of it over the Mediterranean, so the continent itself
// stays in view; the others are on their land. Oceania and Antarctica are context, with no name.
const LABELS = {
  europe: [14, 33],
  asia: [100, 49],
  africa: [20, -2],
  "north-america": [-100, 45],
  "south-america": [-60, -16],
};
// As fractions of the map's width and height, for positioning over the scaled map.
const labels = Object.fromEntries(
  Object.entries(LABELS).map(([region, point]) => {
    const [x, y] = projection(point);
    return [region, { x: +(x / WIDTH).toFixed(4), y: +(y / HEIGHT).toFixed(4) }];
  }),
);

const ts = `// Generated by scripts/prepare-world-map.mjs from Natural Earth 1:110m Admin 0 – Countries
// (v5.1.1, public domain). Do not edit: see docs/DATA.md, "World map (home screen)".
// Natural Earth projection centred on 11°E, ${WIDTH} × ${HEIGHT} units.

export const WORLD_MAP_WIDTH = ${WIDTH};
export const WORLD_MAP_HEIGHT = ${HEIGHT};

/** The globe's outline (the ocean) and its 30° graticule. */
export const WORLD_SPHERE = ${JSON.stringify(sphere)};
export const WORLD_GRATICULE = ${JSON.stringify(graticule)};

/** Each geographic continent's land, merged (no borders inside). */
export const WORLD_REGIONS = ${JSON.stringify(shapes, null, 2)} as const;

/** The centre of each category's name on the map, as fractions of its width and height. */
export const WORLD_LABELS = ${JSON.stringify(labels, null, 2)} as const;
`;
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, ts);
console.log(`${output}: ${WIDTH}×${HEIGHT}, ${(ts.length / 1024).toFixed(1)} KiB`);
for (const r of REGIONS) console.log(`  ${r}: ${pieces[r].length} pieces, ${(shapes[r].length / 1024).toFixed(1)} KiB`);
