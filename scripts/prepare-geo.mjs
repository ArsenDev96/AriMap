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
import { mergeArcs } from "topojson-client";
import { readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
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
// Level 5 (Towards Greece) moved the east edge from 36°E to 48°E and the south
// edge from 32°N to 29.5°N (north of the Canary Islands, which would otherwise
// add a clipped piece of Spain); the west and north edges are unchanged.
const BBOX = "-27,29.5,48,62";
// Portugal's Atlantic autonomous regions, erased like the Canary Islands are left
// out: Madeira (850–1,000 km off the mainland) and the two Azores islands the box's
// west edge reaches (São Miguel and Santa Maria, 1,400 km off; the other seven lie
// beyond it). Kept, they would widen Level 7's frame by a third, and the Azores
// would be a clipped piece of an archipelago. Only Portugal has land here (west of
// 13°W, south of 40.5°N); see docs/DATA.md, "Level 7".
const ATLANTIC_ISLANDS = "-27,29.5,-13,40.5";

// Countries kept at full (~400 m) detail: every playable country, and the
// neighbours visible when zoomed in. Slovakia was added with Level 3 (Central
// Europe); it changed only its borders with Hungary and Ukraine. Level 4 (Along
// the Adriatic) added Slovenia, Croatia, Bosnia and Herzegovina and Montenegro,
// and Serbia, Kosovo and Albania beside Montenegro. Level 5 (Towards Greece)
// added Hungary, Romania, Bulgaria and Greece, and North Macedonia, Moldova,
// Turkey and Ukraine beside them. Level 6 (Baltic Journey) added Lithuania,
// Latvia and Estonia, and Belarus, Russia (Kaliningrad, and beside Estonia and
// Latvia) and Finland (across the Gulf of Finland) beside them. Level 7 (Iberian
// Journey) added Portugal, and Morocco and Gibraltar beside Spain (Spain and
// Andorra already were); see docs/DATA.md.
const DETAIL_IDS = [
  "FRA", "BEL", "NLD", "LUX", "DEU",
  "GBR", "IRL", "ESP", "AND", "MCO", "ITA", "SMR", "VAT", "CHE", "LIE", "AUT", "CZE", "POL", "DNK", "SVK",
  "SVN", "HRV", "BIH", "MNE", "SRB", "KOS", "ALB",
  "HUN", "ROU", "BGR", "GRC", "MKD", "MDA", "TUR", "UKR",
  "LTU", "LVA", "EST", "BLR", "RUS", "FIN",
  "PRT", "MAR", "GIB",
];

// TopoJSON quantization, fixed: the transform mapshaper computed for the data of
// Levels 1–4 (lon −25.859…36, lat 32…62, quantization 1e5). Coordinates are
// rounded on this same grid whatever the box, so every border and coast the
// larger box leaves alone keeps exactly the same coordinates (and the shared
// projection, fitted to Level 1's countries, is unchanged). Rounding to it here
// reproduces the earlier file byte for byte from the earlier box; points beyond
// the old box simply get larger (or negative) integers.
const GRID = { xmin: -25.859486456999946, xmax: 36, ymin: 32, ymax: 62, xq: 99999, yq: 100000 };

const raw = `${output}.unquantized.json`;
const commands = [
  `-i "${input}" encoding=utf8`,
  `-filter-fields ADM0_A3,NAME_EN`,
  `-rename-fields id=ADM0_A3,name=NAME_EN`,
  `-clip bbox=${BBOX} remove-slivers`,
  `-erase bbox=${ATLANTIC_ISLANDS}`,
  // Simplification: ~400 m for the western-European core (lesson countries and
  // the neighbours visible when zoomed in), ~1.5 km for distant context that
  // only appears at the edges of wide screens. Shared borders are stored as a
  // single TopoJSON arc, so neighbouring countries stay identical and gap-free.
  // keep-shapes never deletes whole small shapes (Luxembourg, Andorra, Monaco…).
  `-simplify variable interval="${JSON.stringify(DETAIL_IDS).replaceAll('"', "'")}.includes(id) ? 400 : 1500" keep-shapes`,
  `-o format=topojson id-field=id no-quantization "${raw}"`,
].join(" ");

await mapshaper.runCommands(commands);

const topo = JSON.parse(readFileSync(raw, "utf8"));
rmSync(raw);

// Crimea is drawn as part of Ukraine, its internationally recognised country (UN General
// Assembly resolution 68/262). Natural Earth's default Admin 0 file draws it as part of
// Russia, the side in control ("de facto"); the map does not follow military control. So
// the one part of Russia's shape that is the peninsula (with Sevastopol and the Arabat
// Spit, all within CRIMEA) moves to Ukraine and is merged along the arc they share at
// Perekop and Chonhar, which then belongs to no shape and is never drawn. No vertex moves,
// and every other country's geometry is unchanged. Added with Level 8; see docs/DATA.md.
const CRIMEA = [32.3, 44.3, 36.7, 46.3];
{
  const [key] = Object.keys(topo.objects);
  const geometries = topo.objects[key].geometries;
  const parts = (g) => (g.type === "Polygon" ? [g.arcs] : g.arcs);
  const arcPoints = (i) => topo.arcs[i < 0 ? ~i : i];
  const inCrimea = (polygon) => polygon.flat().flatMap(arcPoints).every(([x, y]) => x >= CRIMEA[0] && x <= CRIMEA[2] && y >= CRIMEA[1] && y <= CRIMEA[3]);
  const rus = geometries.find((g) => g.id === "RUS");
  const ukr = geometries.find((g) => g.id === "UKR");
  const crimea = parts(rus).filter(inCrimea);
  if (crimea.length !== 1) throw new Error(`Expected one part of Russia's shape in Crimea, found ${crimea.length}`);
  const rest = parts(rus).filter((p) => !crimea.includes(p));
  Object.assign(rus, rest.length === 1 ? { type: "Polygon", arcs: rest[0] } : { type: "MultiPolygon", arcs: rest });
  const merged = mergeArcs(topo, [ukr, { type: "Polygon", arcs: crimea[0] }]);
  Object.assign(ukr, merged.arcs.length === 1 ? { type: "Polygon", arcs: merged.arcs[0] } : { type: "MultiPolygon", arcs: merged.arcs });
}

// Quantize on the fixed grid (as mapshaper's own export does: x * mx + bx, rounded),
// delta-encode, and name the object `countries`.
const mx = GRID.xq / (GRID.xmax - GRID.xmin);
const my = GRID.yq / (GRID.ymax - GRID.ymin);
const [bx, by] = [0 - mx * GRID.xmin, 0 - my * GRID.ymin];
const arcs = topo.arcs.map((arc) => {
  let [px, py] = [0, 0];
  return arc.map(([x, y], i) => {
    const [qx, qy] = [Math.round(x * mx + bx), Math.round(y * my + by)];
    const point = i === 0 ? [qx, qy] : [qx - px, qy - py];
    [px, py] = [qx, qy];
    return point;
  });
});
const [key] = Object.keys(topo.objects);
const result = {
  type: "Topology",
  arcs,
  transform: { scale: [1 / mx, 1 / my], translate: [-bx / mx, -by / my] },
  objects: { countries: topo.objects[key] },
};
writeFileSync(output, JSON.stringify(result));

const ids = result.objects.countries.geometries.map((g) => g.id).sort();
console.log(`Wrote ${output}`);
console.log(`${ids.length} countries: ${ids.join(", ")}`);
console.log(`${(readFileSync(output).length / 1024).toFixed(1)} KiB`);
