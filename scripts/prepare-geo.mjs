// Prepares the regional country dataset committed at src/data/geo/europe-west.topo.json.
//
// Usage:
//   1. Download Natural Earth 1:10m Admin 0 – Countries (v5.1.1):
//      https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_0_countries.zip
//   2. Unzip it and run:
//      node scripts/prepare-geo.mjs path/to/ne_10m_admin_0_countries.shp
//
// See docs/DATA.md for the rationale behind each step.
import mapshaper from "mapshaper";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const input = process.argv[2];
if (!input) {
  console.error("Usage: node scripts/prepare-geo.mjs <ne_10m_admin_0_countries.shp>");
  process.exit(1);
}

const output = resolve("src/data/geo/europe-west.topo.json");
mkdirSync(dirname(output), { recursive: true });

// Regional context box (lon/lat). It must contain the whole area the map can
// ever show (src/geo/regionMap.ts limits zoom/pan to a coverage rectangle that
// regionMap.test.ts checks lies inside this box), so artificial clip edges
// never appear on screen. Clipping also discards overseas territories (e.g.
// French Guiana, Saint Martin, Caribbean Netherlands), so they cannot distort
// the viewport or create border shortcuts.
const BBOX = "-27,32,36,62";

// Countries kept at full (~400 m) detail: every playable country, and the
// neighbours visible when zoomed in. Slovakia was added with Level 3 (Central
// Europe); it changed only its borders with Hungary and Ukraine.
const DETAIL_IDS = [
  "FRA", "BEL", "NLD", "LUX", "DEU",
  "GBR", "IRL", "ESP", "AND", "MCO", "ITA", "SMR", "VAT", "CHE", "LIE", "AUT", "CZE", "POL", "DNK", "SVK",
];

const commands = [
  `-i "${input}" encoding=utf8`,
  `-filter-fields ADM0_A3,NAME_EN`,
  `-rename-fields id=ADM0_A3,name=NAME_EN`,
  `-clip bbox=${BBOX} remove-slivers`,
  // Simplification: ~400 m for the western-European core (lesson countries and
  // the neighbours visible when zoomed in), ~1.5 km for distant context that
  // only appears at the edges of wide screens. Shared borders are stored as a
  // single TopoJSON arc, so neighbouring countries stay identical and gap-free.
  // keep-shapes never deletes whole small shapes (Luxembourg, Andorra, Monaco…).
  `-simplify variable interval="${JSON.stringify(DETAIL_IDS).replaceAll('"', "'")}.includes(id) ? 400 : 1500" keep-shapes`,
  `-o format=topojson id-field=id quantization=100000 precision=0.0001 "${output}"`,
].join(" ");

await mapshaper.runCommands(commands);

// Rename the object to a stable name and report a short summary.
const topo = JSON.parse(readFileSync(output, "utf8"));
const [key] = Object.keys(topo.objects);
topo.objects = { countries: topo.objects[key] };
writeFileSync(output, JSON.stringify(topo));

const ids = topo.objects.countries.geometries.map((g) => g.id).sort();
console.log(`Wrote ${output}`);
console.log(`${ids.length} countries: ${ids.join(", ")}`);
console.log(`${(readFileSync(output).length / 1024).toFixed(1)} KiB`);
