// Prepares the Quick Challenge's own map of Europe, committed at src/data/geo/europe-challenge.topo.json.
// The levels' data (europe-west.topo.json, scripts/prepare-geo.mjs) stops at 62°N and 48°E; this file
// covers the whole of Europe, from Iceland to the Urals and the North Cape, and is loaded by the challenge
// only, so no level's map or download changes.
//
// Usage:
//   1. Download Natural Earth 1:10m Admin 0 – Countries (v5.1.1, as for the levels):
//      https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_0_countries.zip
//   2. Unzip it and run:
//      node scripts/prepare-challenge-geo.mjs path/to/ne_10m_admin_0_countries.shp
//
// See docs/DATA.md, "Quick Challenge map", for the rationale behind each step.
import mapshaper from "mapshaper";
import { geoAzimuthalEqualArea, geoBounds } from "d3-geo";
import { feature, mergeArcs } from "topojson-client";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const input = process.argv[2];
if (!input) {
  console.error("Usage: node scripts/prepare-challenge-geo.mjs <ne_10m_admin_0_countries.shp>");
  process.exit(1);
}
const output = resolve("src/data/geo/europe-challenge.topo.json");

// The levels' projection, exactly (src/geo/regionMap.ts: equal-area azimuthal centred at 8°E 50°N, fitted to
// Level 1's countries in a 1000-unit square), so the challenge's map lines up with the levels' painted relief
// tiles. Its scale and translation are written into the output, so the page needs no other data to rebuild it.
const levels = JSON.parse(readFileSync(resolve("src/data/geo/europe-west.topo.json"), "utf8"));
const levelFeatures = feature(levels, levels.objects.countries).features;
const projection = geoAzimuthalEqualArea()
  .rotate([-8, -50])
  .fitSize([1000, 1000], { type: "FeatureCollection", features: levelFeatures.filter((f) => ["FRA", "BEL", "NLD", "LUX", "DEU"].includes(f.id)) });

// Europe's countries (src/core/challenge/europe.ts): kept at the finest detail, the microstates at their full
// source detail (a ring marks them on the map, but zoomed in their real shape shows).
const EUROPE = [
  "FRA", "BEL", "NLD", "DEU", "CHE", "AUT", "LUX", "LIE", "MCO",
  "GBR", "IRL", "DNK", "EST", "LVA", "LTU", "NOR", "SWE", "FIN", "ISL",
  "PRT", "ESP", "ITA", "SVN", "HRV", "BIH", "MNE", "SRB", "KOS", "ALB", "MKD", "GRC", "AND", "SMR", "VAT", "MLT",
  "POL", "CZE", "SVK", "HUN", "ROU", "BGR", "BLR", "UKR", "MDA", "RUS",
];
const MICROSTATES = ["LUX", "AND", "MLT", "LIE", "SMR", "MCO", "VAT"];

// Remote islands left out, each a lon/lat box holding nothing else: as in the levels' data, Portugal's Azores,
// Madeira and Savage Islands and Spain's Canary Islands (900–1,500 km off the mainland, south-west of the frame:
// kept, they would widen it by a third). Everything else is kept, the Arctic islands too: Norway's Svalbard and
// Jan Mayen and Russia's Novaya Zemlya and Franz Josef Land lie within or just beyond the frame the Urals already
// need (this projection tilts Europe's north-east upwards), and erasing them would leave empty sea where they
// are. See docs/DATA.md, "Quick Challenge map".
const ERASE = {
  "Azores, Madeira and the Savage Islands": [-32, 29.8, -15.5, 40.5],
  "Canary Islands": [-18.5, 27.5, -13.35, 29.5],
};

/**
 * The start view's frame, in lon/lat points it must hold: Europe's extremes as the challenge shows them.
 * Russia is framed to the Urals (the Europe–Asia boundary along their crest, the Ural River and the Caspian;
 * north of the crest, between Novaya Zemlya and Yamal), not to its whole shape: the points of the crest and the
 * river are listed, the rest of Europe, its islands included, is taken from the shapes themselves.
 */
const URALS = [
  [67.0, 69.0], [66.2, 68.5], [65.0, 67.5], [63.5, 66.5], [62.0, 65.5], [60.0, 64.0], [59.3, 62.0], [59.0, 60.0],
  [59.5, 58.0], [59.5, 56.0], [59.3, 54.5], [59.0, 53.0], [58.6, 51.2], [55.1, 51.8], [52.5, 51.5], [51.4, 51.2], [51.9, 47.0],
];

const work = mkdtempSync(join(tmpdir(), "challenge-geo-"));
try {
  // 1. Europe and its surroundings, the remote islands erased, as GeoJSON (no clip yet: the frame comes from it).
  const raw = join(work, "raw.json");
  const erase = Object.values(ERASE)
    .map((b) => `-erase bbox=${b.join(",")}`)
    .join(" ");
  await mapshaper.runCommands(
    `-i "${input}" encoding=utf8 -filter-fields ADM0_A3,NAME_EN -rename-fields id=ADM0_A3,name=NAME_EN ` +
      `-clip bbox=-60,20,100,85 remove-slivers ${erase} -o format=geojson "${raw}"`,
  );
  const world = JSON.parse(readFileSync(raw, "utf8"));
  const missing = EUROPE.filter((id) => !world.features.some((f) => f.properties.id === id));
  if (missing.length) throw new Error(`Not in the source: ${missing.join(", ")}`);

  // 2. The frame: every European country but Russia, Russia west of the Urals, and the Urals' points.
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  const take = ([x, y]) => ([x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)]);
  const uralsLon = (lat) => {
    // The crest's longitude at a latitude (the river's westward run sets no limit north of it).
    for (let i = 0; i < URALS.length - 1; i++) {
      const [[a, p], [b, q]] = [URALS[i], URALS[i + 1]];
      if ((lat - p) * (lat - q) <= 0 && p !== q) return a + ((b - a) * (lat - p)) / (q - p);
    }
    // North of the crest's end, the boundary runs through the Kara Sea between Novaya Zemlya (Europe) and Yamal.
    return lat > URALS[0][1] ? URALS[0][0] + (lat - URALS[0][1]) / 2 : 60;
  };
  for (const f of world.features) {
    const id = f.properties.id;
    if (!EUROPE.includes(id)) continue;
    // From the outer rings' points (not path.bounds, which depends on the rings' winding).
    const polygons = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const polygon of polygons)
      for (const [lon, lat] of polygon[0]) if (id !== "RUS" || (lon >= 19 && lon <= uralsLon(lat) && lat >= 41)) take(projection([lon, lat]));
  }
  for (const point of URALS) take(projection(point));
  const focus = [
    [Math.floor(x0), Math.floor(y0)],
    [Math.ceil(x1), Math.ceil(y1)],
  ];
  // What the map may ever show: the frame with a margin (a twentieth of its size) all round. The data is clipped
  // further out still (CLIP_MARGIN), so its straight cut edges are never in view.
  const [fw, fh] = [focus[1][0] - focus[0][0], focus[1][1] - focus[0][1]];
  const m = Math.round(Math.max(fw, fh) / 20);
  const coverage = [
    [focus[0][0] - m, focus[0][1] - m],
    [focus[1][0] + m, focus[1][1] + m],
  ];
  const CLIP_MARGIN = 150;
  const [[cx0, cy0], [cx1, cy1]] = [
    [coverage[0][0] - CLIP_MARGIN, coverage[0][1] - CLIP_MARGIN],
    [coverage[1][0] + CLIP_MARGIN, coverage[1][1] + CLIP_MARGIN],
  ];
  // The clip rectangle in lon/lat: its edges sampled every few units, so the curve they make there is followed.
  const ring = [];
  const N = 400;
  for (let i = 0; i < N; i++) ring.push([cx0 + ((cx1 - cx0) * i) / N, cy0]);
  for (let i = 0; i < N; i++) ring.push([cx1, cy0 + ((cy1 - cy0) * i) / N]);
  for (let i = 0; i < N; i++) ring.push([cx1 - ((cx1 - cx0) * i) / N, cy1]);
  for (let i = 0; i < N; i++) ring.push([cx0, cy1 - ((cy1 - cy0) * i) / N]);
  const lonLat = ring.map((p) => projection.invert(p));
  lonLat.push(lonLat[0]);
  // Clockwise in lon/lat (y up), as mapshaper reads an outer ring (a counter-clockwise one is a hole).
  let area = 0;
  for (let i = 0; i < lonLat.length - 1; i++) area += lonLat[i][0] * lonLat[i + 1][1] - lonLat[i + 1][0] * lonLat[i][1];
  if (area > 0) lonLat.reverse();
  const clip = join(work, "clip.json");
  writeFileSync(clip, JSON.stringify({ type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [lonLat] } }] }));
  const box = geoBounds({ type: "Polygon", coordinates: [lonLat] });

  // 3. Clipped to it and simplified: Europe's countries to ~800 m (a unit is about 1.5 km; the map's deepest zoom
  // on a desktop shows about a unit per pixel), the microstates not at all, the surroundings to ~2.5 km. Shared
  // borders are one TopoJSON arc, so neighbours stay gap-free; keep-shapes never drops a whole small shape.
  const topoRaw = join(work, "topo.json");
  // Åland (ALD) too: it becomes part of Finland's shape (step 5), so it is simplified as Finland is.
  const detail = JSON.stringify([...EUROPE, "ALD"]).replaceAll('"', "'");
  const micro = JSON.stringify(MICROSTATES).replaceAll('"', "'");
  await mapshaper.runCommands(
    `-i "${raw}" -clip "${clip}" remove-slivers ` +
      `-simplify variable interval="${micro}.includes(id) ? 1 : ${detail}.includes(id) ? 800 : 2500" keep-shapes ` +
      `-o format=topojson id-field=id no-quantization "${topoRaw}"`,
  );
  const topo = JSON.parse(readFileSync(topoRaw, "utf8"));
  const [key] = Object.keys(topo.objects);
  const geometries = topo.objects[key].geometries;
  const parts = (g) => (g.type === "Polygon" ? [g.arcs] : g.arcs);
  const setParts = (g, list) => Object.assign(g, list.length === 1 ? { type: "Polygon", arcs: list[0] } : { type: "MultiPolygon", arcs: list });
  const byId = (id) => geometries.find((g) => g.id === id);

  // 4. Crimea drawn as part of Ukraine, as in the levels' data (scripts/prepare-geo.mjs, docs/DATA.md "Preparation"
  // step 5): the one part of Russia's shape within the peninsula's box moves to Ukraine, merged along the arc
  // they share. No vertex moves.
  const CRIMEA = [32.3, 44.3, 36.7, 46.3];
  const arcPoints = (i) => topo.arcs[i < 0 ? ~i : i];
  const inBox = (polygon, [a, b, c, d]) => polygon.flat().flatMap(arcPoints).every(([x, y]) => x >= a && x <= c && y >= b && y <= d);
  {
    const rus = byId("RUS");
    const crimea = parts(rus).filter((p) => inBox(p, CRIMEA));
    if (crimea.length !== 1) throw new Error(`Expected one part of Russia's shape in Crimea, found ${crimea.length}`);
    setParts(rus, parts(rus).filter((p) => !crimea.includes(p)));
    const ukr = byId("UKR");
    setParts(ukr, mergeArcs(topo, [ukr, { type: "Polygon", arcs: crimea[0] }]).arcs);
  }
  // 5. Åland is part of Finland (an autonomous region of it, not a dependency): Natural Earth draws it as its own
  // shape (ALD), so it is merged into Finland's, and a tap on it answers Finland.
  {
    const fin = byId("FIN");
    const ald = byId("ALD");
    setParts(fin, mergeArcs(topo, [fin, ald]).arcs);
    geometries.splice(geometries.indexOf(ald), 1);
  }

  // 6. Quantized (1e5 steps over the data's box, about 150 m), delta-encoded, the object named `countries`, with
  // the projection and the frame.
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
    // Read by src/geo/challengeMap.ts.
    projection: { rotate: [-8, -50], scale: round(projection.scale()), translate: projection.translate().map((v) => round(v)) },
    frame: { focus, coverage },
  };
  writeFileSync(output, JSON.stringify(result));

  const ids = result.objects.countries.geometries.map((g) => g.id).sort();
  console.log(`Wrote ${output}`);
  console.log(`Frame (world units): focus ${JSON.stringify(focus)}, coverage ${JSON.stringify(coverage)}; data clipped to lon ${box[0][0].toFixed(1)}…${box[1][0].toFixed(1)}, lat ${box[0][1].toFixed(1)}…${box[1][1].toFixed(1)}`);
  console.log(`${ids.length} countries: ${ids.join(", ")}`);
  console.log(`${(readFileSync(output).length / 1024).toFixed(1)} KiB`);
} finally {
  if (!process.env.KEEP_WORK) rmSync(work, { recursive: true, force: true });
  else console.log(`work: ${work}`);
}
