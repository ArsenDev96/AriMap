// Prepares the northern country dataset committed at src/data/geo/europe-north.topo.json: Level 10 (the Nordic
// countries), whose countries reach far beyond the levels' data (scripts/prepare-geo.mjs stops at 62°N). It is a file
// of its own, loaded only with a level that names it (`map.dataset`, src/geo/regionMap.ts), so no other level's
// download changes and the levels' data stays byte for byte as it is.
//
// Usage:
//   1. Download Natural Earth 1:10m Admin 0 – Countries (v5.1.1):
//      https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_0_countries.zip
//   2. Unzip it and run:
//      node scripts/prepare-north-geo.mjs path/to/ne_10m_admin_0_countries.shp
//
// See docs/DATA.md, "Level 10", for the rationale behind each step.
import mapshaper from "mapshaper";
import { geoAzimuthalEqualArea, geoBounds } from "d3-geo";
import { feature, mergeArcs } from "topojson-client";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const input = process.argv[2];
if (!input) {
  console.error("Usage: node scripts/prepare-north-geo.mjs <ne_10m_admin_0_countries.shp>");
  process.exit(1);
}
const output = resolve("src/data/geo/europe-north.topo.json");

// The levels' projection, exactly (src/geo/regionMap.ts: equal-area azimuthal centred at 8°E 50°N, fitted to Level 1's
// countries in a 1000-unit square), so this data lines up with the levels' maps and the painted relief.
const levels = JSON.parse(readFileSync(resolve("src/data/geo/europe-west.topo.json"), "utf8"));
const projection = geoAzimuthalEqualArea()
  .rotate([-8, -50])
  .fitSize([1000, 1000], { type: "FeatureCollection", features: feature(levels, levels.objects.countries).features.filter((f) => ["FRA", "BEL", "NLD", "LUX", "DEU"].includes(f.id)) });

/** Level 10's countries: their frame (the map's focus) is taken from their shapes once Svalbard is left out. */
const NORDIC = ["DNK", "SWE", "NOR", "FIN", "ISL"];
/**
 * Kept at ~400 m, as the levels' playable countries are: the five and Åland (merged into Finland, step 5), and the
 * neighbours seen beside them zoomed in (Germany at Denmark's border, Russia at Norway's and Finland's, Estonia
 * across the Gulf of Finland, the Faroes between Iceland and Norway). Everything else, seen only at the edges of
 * short or wide maps, at ~2.5 km, as the Quick Challenge's surroundings.
 */
const DETAIL = [...NORDIC, "ALD", "DEU", "RUS", "EST", "FRO"];

/**
 * Half-size of the area Level 10's map may ever show, in world units, around the centre of its countries' frame: its
 * `map.coverageHalf` (src/core/lessons/nordic-countries.ts), which must lie inside this data (checked in
 * src/geo/regionMap.test.ts). Set by the shortest map, 304×112 (200% text in Armenian on a 320×568 phone), which
 * needs ±2089 units across to show the five whole with their padding, and by a 396×413 phone map (±984 up and down).
 */
const COVERAGE_HALF = [2095, 990];
/** The data is clipped this far beyond that area, so the clip's cut edges are never in view. */
const CLIP_MARGIN = 40;

/**
 * Svalbard (74–81°N) is left out: Norway's Arctic archipelago, 650 km beyond the mainland's North Cape, kept it would
 * stretch the five's frame upwards by about half (docs/DATA.md, "Level 10"). The box holds Svalbard's islands only
 * (Bjørnøya included); Russia's Arctic islands lie east of it. Jan Mayen is kept, as part of Norway: it lies inside
 * the frame the mainland already sets.
 */
const SVALBARD = [5, 73.5, 35.5, 81];

const work = mkdtempSync(join(tmpdir(), "north-geo-"));
try {
  // 1. The north and its surroundings (a loose lon/lat box, cut to the map's rectangle in step 3), Svalbard erased.
  const raw = join(work, "raw.json");
  await mapshaper.runCommands(
    `-i "${input}" encoding=utf8 -filter-fields ADM0_A3,NAME_EN -rename-fields id=ADM0_A3,name=NAME_EN ` +
      `-clip bbox=-110,30,120,86 remove-slivers -erase bbox=${SVALBARD.join(",")} -o format=geojson "${raw}"`,
  );
  const world = JSON.parse(readFileSync(raw, "utf8"));
  const missing = [...NORDIC, "ALD"].filter((id) => !world.features.some((f) => f.properties.id === id));
  if (missing.length) throw new Error(`Not in the source: ${missing.join(", ")}`);
  if (world.features.some((f) => f.properties.id === "NOR" && JSON.stringify(f.geometry.coordinates).match(/,7[4-9]\.|,80\./)))
    throw new Error("Svalbard is still in Norway's shape");

  // 2. The frame of the five (from their outer rings' points, as path.bounds of them in regionMap.ts gives it), its
  // centre, and the area the map may show round it.
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const f of world.features) {
    if (!NORDIC.includes(f.properties.id)) continue;
    const polygons = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const polygon of polygons)
      for (const p of polygon[0]) {
        const [x, y] = projection(p);
        [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
      }
  }
  const [cx, cy] = [(x0 + x1) / 2, (y0 + y1) / 2];
  const coverage = [
    [cx - COVERAGE_HALF[0], cy - COVERAGE_HALF[1]],
    [cx + COVERAGE_HALF[0], cy + COVERAGE_HALF[1]],
  ];
  const clipRect = [
    [Math.floor(coverage[0][0] - CLIP_MARGIN), Math.floor(coverage[0][1] - CLIP_MARGIN)],
    [Math.ceil(coverage[1][0] + CLIP_MARGIN), Math.ceil(coverage[1][1] + CLIP_MARGIN)],
  ];

  // 3. The clip rectangle in lon/lat: its edges sampled every few units, so the curve they make there is followed.
  const [[rx0, ry0], [rx1, ry1]] = clipRect;
  const ring = [];
  const N = 400;
  for (let i = 0; i < N; i++) ring.push([rx0 + ((rx1 - rx0) * i) / N, ry0]);
  for (let i = 0; i < N; i++) ring.push([rx1, ry0 + ((ry1 - ry0) * i) / N]);
  for (let i = 0; i < N; i++) ring.push([rx1 - ((rx1 - rx0) * i) / N, ry1]);
  for (let i = 0; i < N; i++) ring.push([rx0, ry1 - ((ry1 - ry0) * i) / N]);
  const lonLat = ring.map((p) => projection.invert(p));
  lonLat.push(lonLat[0]);
  // Clockwise in lon/lat (y up), as mapshaper reads an outer ring (a counter-clockwise one is a hole).
  let area = 0;
  for (let i = 0; i < lonLat.length - 1; i++) area += lonLat[i][0] * lonLat[i + 1][1] - lonLat[i + 1][0] * lonLat[i][1];
  if (area > 0) lonLat.reverse();
  const clip = join(work, "clip.json");
  writeFileSync(clip, JSON.stringify({ type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [lonLat] } }] }));
  const box = geoBounds({ type: "Polygon", coordinates: [lonLat] });

  // 4. Clipped to it and simplified (DETAIL above). Shared borders are one TopoJSON arc, so neighbours stay gap-free;
  // keep-shapes never drops a whole small shape (Denmark's smaller islands, Jan Mayen).
  const topoRaw = join(work, "topo.json");
  const detail = JSON.stringify(DETAIL).replaceAll('"', "'");
  await mapshaper.runCommands(
    `-i "${raw}" -clip "${clip}" remove-slivers ` +
      `-simplify variable interval="${detail}.includes(id) ? 400 : 2500" keep-shapes ` +
      `-o format=topojson id-field=id no-quantization "${topoRaw}"`,
  );
  const topo = JSON.parse(readFileSync(topoRaw, "utf8"));
  const [key] = Object.keys(topo.objects);
  const geometries = topo.objects[key].geometries;
  const parts = (g) => (g.type === "Polygon" ? [g.arcs] : g.arcs);
  const setParts = (g, list) => Object.assign(g, list.length === 1 ? { type: "Polygon", arcs: list[0] } : { type: "MultiPolygon", arcs: list });
  const byId = (id) => geometries.find((g) => g.id === id);

  // 5. Crimea drawn as part of Ukraine, as in the levels' data (scripts/prepare-geo.mjs, docs/DATA.md "Preparation"
  // step 5): the parts of Russia's shape within the peninsula's box move to Ukraine, merged along the arcs they
  // share. No vertex moves. (The shortest maps' area reaches the Black Sea's north coast, and the clip's bottom edge
  // crosses the peninsula, cutting its piece of Russia's shape in two.)
  const CRIMEA = [32.3, 44.3, 36.7, 46.3];
  const arcPoints = (i) => topo.arcs[i < 0 ? ~i : i];
  const inBox = (polygon, [a, b, c, d]) => polygon.flat().flatMap(arcPoints).every(([x, y]) => x >= a && x <= c && y >= b && y <= d);
  {
    const rus = byId("RUS");
    const ukr = byId("UKR");
    const crimea = rus ? parts(rus).filter((p) => inBox(p, CRIMEA)) : [];
    if (crimea.length > 0) {
      if (!ukr) throw new Error("Crimea is in the data but Ukraine is not");
      setParts(rus, parts(rus).filter((p) => !crimea.includes(p)));
      setParts(ukr, mergeArcs(topo, [ukr, ...crimea.map((arcs) => ({ type: "Polygon", arcs }))]).arcs);
    }
    console.log(`Crimea: ${crimea.length ? `${crimea.length} part(s) moved to Ukraine` : "outside the data"}`);
  }
  // 6. Åland is part of Finland (an autonomous region of it, not a dependency): Natural Earth draws it as its own
  // shape (ALD), so it is merged into Finland's, and a tap on it answers Finland (as in the Quick Challenge's data).
  {
    const fin = byId("FIN");
    const ald = byId("ALD");
    setParts(fin, mergeArcs(topo, [fin, ald]).arcs);
    geometries.splice(geometries.indexOf(ald), 1);
  }

  // 7. Quantized (1e5 steps over the data's box: under 100 m north–south, about 75 m east–west at 64°N), delta-encoded,
  // the object named `countries`, with the projection and the frame (world units) for the checks.
  const [[bx0, by0], [bx1, by1]] = [
    [Math.min(...topo.arcs.flat().map((p) => p[0])), Math.min(...topo.arcs.flat().map((p) => p[1]))],
    [Math.max(...topo.arcs.flat().map((p) => p[0])), Math.max(...topo.arcs.flat().map((p) => p[1]))],
  ];
  const Q = 1e5;
  const [mx, my] = [(Q - 1) / (bx1 - bx0), (Q - 1) / (by1 - by0)];
  const arcs = topo.arcs.map((arc) => {
    let [px, py] = [0, 0];
    return arc.map(([x, y], i) => {
      const [qx, qy] = [Math.round((x - bx0) * mx), Math.round((y - by0) * my)];
      const point = i === 0 ? [qx, qy] : [qx - px, qy - py];
      [px, py] = [qx, qy];
      return point;
    });
  });
  const round = (v, d = 6) => Math.round(v * 10 ** d) / 10 ** d;
  const result = {
    type: "Topology",
    arcs,
    transform: { scale: [1 / mx, 1 / my], translate: [bx0, by0] },
    objects: { countries: topo.objects[key] },
    // Checked in src/geo/regionMap.test.ts: the levels' projection, and the rectangle (world units) the data was cut to.
    projection: { rotate: [-8, -50], scale: round(projection.scale()), translate: projection.translate().map((v) => round(v)) },
    frame: { clip: clipRect },
  };
  writeFileSync(output, JSON.stringify(result));

  const ids = result.objects.countries.geometries.map((g) => g.id).sort();
  console.log(`Wrote ${output}`);
  console.log(`Frame (world units): the five ${JSON.stringify([[x0, y0], [x1, y1]].map((p) => p.map((v) => +v.toFixed(1))))}, clip ${JSON.stringify(clipRect)}; data clipped to lon ${box[0][0].toFixed(1)}…${box[1][0].toFixed(1)}, lat ${box[0][1].toFixed(1)}…${box[1][1].toFixed(1)}`);
  console.log(`${ids.length} countries: ${ids.join(", ")}`);
  console.log(`${(readFileSync(output).length / 1024).toFixed(1)} KiB`);
} finally {
  if (!process.env.KEEP_WORK) rmSync(work, { recursive: true, force: true });
  else console.log(`work: ${work}`);
}
