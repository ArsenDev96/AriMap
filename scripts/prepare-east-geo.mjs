// Prepares the country dataset committed at src/data/geo/europe-east.topo.json: Level 12 (Russia and its western
// neighbours), whose map must show Finland whole, from Belarus to the North Cape, with western Russia and Moscow, on maps
// as short as 112 px. The levels' data stops at 62°N and 48°E (scripts/prepare-geo.mjs), which would cut Finland and
// Russia in view. So, as Level 10's northern and Level 11's Channel data (scripts/prepare-north-geo.mjs,
// prepare-channel-geo.mjs), it is a file of its own, loaded only with a level that names it (`map.dataset`,
// src/geo/regionMap.ts): no other level's download changes, and the levels' data stays byte for byte as it is.
//
// Usage:
//   1. Download Natural Earth 1:10m Admin 0 – Countries (v5.1.1):
//      https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_0_countries.zip
//   2. Unzip it and run:
//      node scripts/prepare-east-geo.mjs path/to/ne_10m_admin_0_countries.shp
//
// See docs/DATA.md, "Level 12", for the rationale behind each step.
import mapshaper from "mapshaper";
import { geoAzimuthalEqualArea, geoBounds } from "d3-geo";
import { feature, mergeArcs } from "topojson-client";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const input = process.argv[2];
if (!input) {
  console.error("Usage: node scripts/prepare-east-geo.mjs <ne_10m_admin_0_countries.shp>");
  process.exit(1);
}
const output = resolve(process.env.OUTPUT ?? "src/data/geo/europe-east.topo.json");

// The levels' projection, exactly (src/geo/regionMap.ts: equal-area azimuthal centred at 8°E 50°N, fitted to Level 1's
// countries in a 1000-unit square), so this data lines up with the levels' maps and the painted relief.
const levels = JSON.parse(readFileSync(resolve("src/data/geo/europe-west.topo.json"), "utf8"));
const projection = geoAzimuthalEqualArea()
  .rotate([-8, -50])
  .fitSize([1000, 1000], { type: "FeatureCollection", features: feature(levels, levels.objects.countries).features.filter((f) => ["FRA", "BEL", "NLD", "LUX", "DEU"].includes(f.id)) });

/** Level 12's countries: their frame (the map's focus), with Russia's part in it limited by FRAME_WITHIN. */
const EAST = ["RUS", "FIN", "EST", "LVA", "BLR"];
/**
 * Russia's part in the frame: its shape within this lon/lat box only (Saint Petersburg, Karelia, Moscow with a margin;
 * Kaliningrad lies in the other four's frame anyway), as the level's `map.frameWithin`
 * (src/core/lessons/russia-and-western-neighbours.ts), which must be the same (checked in src/geo/regionMap.test.ts).
 * All of Russia would make the five a speck.
 */
const FRAME_WITHIN = { RUS: [[26, 54], [39, 70]] };
/**
 * Kept at ~400 m, as in the levels' data (scripts/prepare-geo.mjs, DETAIL_IDS), so Estonia's, Latvia's and Belarus's
 * borders are simplified exactly as there: the five, Åland (merged into Finland, step 6), and the neighbours seen beside
 * them zoomed in (Lithuania and Poland round Kaliningrad, Ukraine, Norway and Sweden).
 */
const DETAIL = [...EAST, "ALD", "LTU", "POL", "UKR", "NOR", "SWE"];
/** At ~1.5 km, as the levels' distant context: countries in the start views of wide maps. */
const NEAR = ["DEU", "DNK", "CZE", "SVK", "HUN", "ROU", "MDA"];
// Everything else, seen only at the edges of short or wide maps, at ~2.5 km, as Levels 10 and 11's surroundings.

/**
 * Half-size of the area Level 12's map may ever show, in world units, around the centre of its countries' frame: its
 * `map.coverageHalf`, which must lie inside this data (checked in src/geo/regionMap.test.ts). The frame is taller than
 * wide, so the shortest map, 304×112 (200% text in Armenian on a 320×568 phone), sets both, as for Level 11: showing
 * the frame whole with its 10 px padding takes 304 / 92 of its height across and 112 / 92 of it up and down (step 7
 * checks these against the simplified frame).
 */
const COVERAGE_HALF = [2270, 840];
/** The data is clipped this far beyond that area, so the clip's cut edges are never in view. */
const CLIP_MARGIN = 40;

/**
 * The levels' fixed quantization grid (GRID in scripts/prepare-geo.mjs), so Estonia's, Latvia's and Belarus's borders
 * are rounded exactly as in the levels' data, and Levels 6 and 8's border crossings stay vertices here.
 */
const GRID = { xmin: -25.859486456999946, xmax: 36, ymin: 32, ymax: 62, xq: 99999, yq: 100000 };

/** Sampling step (degrees) along a FRAME_WITHIN box's edges, as in regionMap.ts. */
const FRAME_STEP = 0.25;

/**
 * The frame of the five (world units), as regionMap.ts takes it: each country's outer rings' points, and for Russia only
 * its points within its box and the box's edges where they cross its shape.
 */
function frameOf(features) {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  const take = (p) => {
    const [x, y] = projection(p);
    [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
  };
  for (const f of features) {
    const id = f.properties?.id ?? f.id;
    if (!EAST.includes(id)) continue;
    const box = FRAME_WITHIN[id];
    const inside = ([lon, lat]) => !box || (lon >= box[0][0] && lon <= box[1][0] && lat >= box[0][1] && lat <= box[1][1]);
    const polygons = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const polygon of polygons) for (const p of polygon[0]) if (inside(p)) take(p);
    if (box) for (const p of boxEdge(box)) if (insideLonLat(polygons, p)) take(p);
  }
  return [[x0, y0], [x1, y1]];
}

/**
 * Whether a lon/lat point lies inside polygons (even–odd rule, in lon/lat taken as a plane, as regionMap.ts does): the
 * data never crosses the antimeridian, and d3's spherical test misreads Russia's clipped shape.
 */
function insideLonLat(polygons, [x, y]) {
  let inside = false;
  for (const polygon of polygons)
    for (const ring of polygon)
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [[xi, yi], [xj, yj]] = [ring[i], ring[j]];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
  return inside;
}

/** Points along a lon/lat box's edges, every FRAME_STEP degrees, corners included. */
function boxEdge([[w, s], [e, n]]) {
  const points = [];
  for (let lon = w; lon <= e + 1e-9; lon += FRAME_STEP) points.push([lon, s], [lon, n]);
  for (let lat = s; lat <= n + 1e-9; lat += FRAME_STEP) points.push([w, lat], [e, lat]);
  return points;
}

const work = mkdtempSync(join(tmpdir(), "east-geo-"));
try {
  // 1. Europe and western Asia (a loose lon/lat box, cut to the map's rectangle in step 3).
  const raw = join(work, "raw.json");
  await mapshaper.runCommands(
    `-i "${input}" encoding=utf8 -filter-fields ADM0_A3,NAME_EN -rename-fields id=ADM0_A3,name=NAME_EN ` +
      `-clip bbox=-40,25,120,85 remove-slivers -o format=geojson "${raw}"`,
  );
  const world = JSON.parse(readFileSync(raw, "utf8"));
  const missing = [...EAST, "LTU", "POL", "UKR"].filter((id) => !world.features.some((f) => f.properties.id === id));
  if (missing.length) throw new Error(`Not in the source: ${missing.join(", ")}`);

  // 2. The frame of the five, its centre, and the area the map may show round it.
  const [[x0, y0], [x1, y1]] = frameOf(world.features);
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

  // 4. Clipped to it and simplified (DETAIL and NEAR above). Shared borders are one TopoJSON arc, so neighbours stay
  // gap-free; keep-shapes never drops a whole small shape.
  const topoRaw = join(work, "topo.json");
  const list = (ids) => JSON.stringify(ids).replaceAll('"', "'");
  await mapshaper.runCommands(
    `-i "${raw}" -clip "${clip}" remove-slivers ` +
      `-simplify variable interval="${list(DETAIL)}.includes(id) ? 400 : ${list(NEAR)}.includes(id) ? 1500 : 2500" keep-shapes ` +
      `-o format=topojson id-field=id no-quantization "${topoRaw}"`,
  );
  const topo = JSON.parse(readFileSync(topoRaw, "utf8"));
  const [key] = Object.keys(topo.objects);
  const geometries = topo.objects[key].geometries;
  const parts = (g) => (g.type === "Polygon" ? [g.arcs] : g.arcs);
  const setParts = (g, list) => Object.assign(g, list.length === 1 ? { type: "Polygon", arcs: list[0] } : { type: "MultiPolygon", arcs: list });
  const byId = (id) => geometries.find((g) => g.id === id);

  // 5. Crimea drawn as part of Ukraine, as in the levels' data (scripts/prepare-geo.mjs, docs/DATA.md "Preparation"
  // step 5), if the area reaches it: the parts of Russia's shape within the peninsula's box move to Ukraine, merged
  // along the arcs they share. No vertex moves.
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
  // 6. Åland is part of Finland (an autonomous region of it, not a dependency): merged into Finland's shape, as in the
  // northern, Channel and Quick Challenge's data.
  {
    const fin = byId("FIN");
    const ald = byId("ALD");
    if (fin && ald) {
      setParts(fin, mergeArcs(topo, [fin, ald]).arcs);
      geometries.splice(geometries.indexOf(ald), 1);
    }
    console.log(`Åland: ${ald ? (fin ? "merged into Finland" : "Finland missing!") : "outside the data"}`);
  }

  // 7. Quantized on the levels' fixed grid (as mapshaper's own export does: x * mx + bx, rounded), delta-encoded, the
  // object named `countries`, with the projection and the frame (world units) for the checks.
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
  // The frame the app takes (from the simplified shapes, regionMap.ts) lies a little inside the one above: the coverage
  // round its centre must still lie inside the clip, with room to spare, and still show the frame whole on the 304×112 map.
  const simplified = feature({ ...topo, objects: { countries: topo.objects[key] } }, topo.objects[key]);
  const [[f0, g0], [f1, g1]] = frameOf(simplified.features);
  const [ax, ay] = [(f0 + f1) / 2, (g0 + g1) / 2];
  const room = Math.min(ax - COVERAGE_HALF[0] - rx0, ay - COVERAGE_HALF[1] - ry0, rx1 - ax - COVERAGE_HALF[0], ry1 - ay - COVERAGE_HALF[1]);
  if (room < 20) throw new Error(`The coverage round the simplified frame is only ${room.toFixed(1)} units inside the clip`);
  const need = [((304 / 92) * (g1 - g0)) / 2, ((112 / 92) * (g1 - g0)) / 2];
  if (need[0] > COVERAGE_HALF[0] || need[1] > COVERAGE_HALF[1]) throw new Error(`The 304×112 map needs a coverage of ±${need.map((v) => v.toFixed(1)).join(" × ±")}`);
  console.log(`Simplified frame: ${JSON.stringify([[f0, g0], [f1, g1]].map((p) => p.map((v) => +v.toFixed(1))))} (${(f1 - f0).toFixed(1)} × ${(g1 - g0).toFixed(1)}), its coverage ${room.toFixed(1)} units inside the clip; the 304×112 map needs ±${need.map((v) => v.toFixed(1)).join(" × ±")}`);

  const round = (v, d = 6) => Math.round(v * 10 ** d) / 10 ** d;
  const result = {
    type: "Topology",
    arcs,
    transform: { scale: [1 / mx, 1 / my], translate: [-bx / mx, -by / my] },
    objects: { countries: topo.objects[key] },
    // Checked in src/geo/regionMap.test.ts: the levels' projection, and the rectangle (world units) the data was cut to.
    projection: { rotate: [-8, -50], scale: round(projection.scale()), translate: projection.translate().map((v) => round(v)) },
    frame: { clip: clipRect },
  };
  writeFileSync(output, JSON.stringify(result));

  // 8. Estonia, Latvia and Belarus are the levels' shapes, vertex for vertex (so Levels 6 and 8's crossings are vertices
  // here too): their decoded geometries must equal europe-west.topo.json's.
  const decoded = (data, id) => JSON.stringify(feature(data, data.objects.countries.geometries.find((g) => g.id === id)).geometry);
  for (const id of ["EST", "LVA", "BLR"])
    if (decoded(result, id) !== decoded(levels, id)) throw new Error(`${id} differs from the levels' data`);
  console.log("Estonia, Latvia and Belarus: the levels' shapes, vertex for vertex");

  const ids = result.objects.countries.geometries.map((g) => g.id).sort();
  console.log(`Wrote ${output}`);
  console.log(`Frame (world units): the five ${JSON.stringify([[x0, y0], [x1, y1]].map((p) => p.map((v) => +v.toFixed(1))))}, clip ${JSON.stringify(clipRect)}; data clipped to lon ${box[0][0].toFixed(1)}…${box[1][0].toFixed(1)}, lat ${box[0][1].toFixed(1)}…${box[1][1].toFixed(1)}`);
  console.log(`${ids.length} countries: ${ids.join(", ")}`);
  console.log(`${(readFileSync(output).length / 1024).toFixed(1)} KiB`);
} finally {
  if (!process.env.KEEP_WORK) rmSync(work, { recursive: true, force: true });
  else console.log(`work: ${work}`);
}
