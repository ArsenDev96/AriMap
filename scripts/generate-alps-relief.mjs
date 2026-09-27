// Generates the Discover map's Alpine relief (src/assets/map/alps-relief*.webp
// and alps-relief.json) from real elevation data.
//
//   node scripts/generate-alps-relief.mjs path/to/ne_10m_geography_regions_polys.geojson
//
// Elevation: Mapzen/Tilezen Terrarium tiles (AWS Open Data "Terrain Tiles"),
// zoom 8, cached in node_modules/.cache/arimap-terrain. The Natural Earth
// "ALPS" range polygon limits where relief is painted. The raster is drawn in
// the map's own projected "world" coordinates (same projection as
// src/geo/regionMap.ts), so it is placed with a plain <image> and stays
// anchored while zooming and panning. See docs/TERRAIN.md.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { geoAzimuthalEqualArea } from "d3-geo";
import { feature } from "topojson-client";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const root = new URL("..", import.meta.url);
const file = (rel) => new URL(rel, root).pathname.replace(/^\/([A-Za-z]:)/, "$1");

const regionsPath = process.argv[2];
if (!regionsPath) throw new Error("Pass the Natural Earth geography regions GeoJSON.");

// --- The map projection, exactly as getRegionMap() builds it for the lesson.
const LESSON = ["FRA", "BEL", "NLD", "LUX", "DEU"];
const topology = JSON.parse(readFileSync(file("src/data/geo/europe-west.topo.json"), "utf8"));
const countries = feature(topology, topology.objects.countries);
const active = { type: "FeatureCollection", features: countries.features.filter((f) => f.geometry && LESSON.includes(String(f.id))) };
const projection = geoAzimuthalEqualArea().rotate([-8, -50]).fitSize([1000, 1000], active);

// --- The range area: Natural Earth's Alps polygon, projected.
const regions = JSON.parse(readFileSync(regionsPath, "utf8"));
const alps = regions.features.find((f) => f.properties.NAME === "ALPS");
if (!alps || alps.geometry.type !== "Polygon") throw new Error("No ALPS polygon in the regions file.");
const ring = alps.geometry.coordinates[0].map((p) => projection(p));

/** World units per km around the Alps. */
const perKm = (() => {
  const a = projection([10, 46]);
  const b = projection([10, 46.9]); // 100 km north
  return Math.hypot(b[0] - a[0], b[1] - a[1]) / 100.08;
})();

// Feathered margin around the polygon (km): relief fades out over it, so the
// coarse polygon never shows as an edge. Elevation limits the rest.
const FEATHER_KM = 28;
const margin = FEATHER_KM * perKm + 4;
const xs = ring.map((p) => p[0]);
const ys = ring.map((p) => p[1]);
const box = {
  x0: Math.floor(Math.min(...xs) - margin),
  y0: Math.floor(Math.min(...ys) - margin),
  x1: Math.ceil(Math.max(...xs) + margin),
  y1: Math.ceil(Math.max(...ys) + margin),
};
console.log(`world box ${JSON.stringify(box)}, ${perKm.toFixed(3)} units/km`);

// --- Elevation tiles.
const Z = 8;
const TILE = 256;
const CACHE = file("node_modules/.cache/arimap-terrain/");
mkdirSync(CACHE, { recursive: true });
const tileX = (lon) => ((lon + 180) / 360) * 2 ** Z;
const tileY = (lat) => ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * 2 ** Z;

const corners = [];
for (let y = box.y0; y <= box.y1; y += 8) for (let x = box.x0; x <= box.x1; x += 8) corners.push(projection.invert([x, y]));
const lons = corners.map((c) => c[0]);
const lats = corners.map((c) => c[1]);
const tx0 = Math.floor(tileX(Math.min(...lons)));
const tx1 = Math.floor(tileX(Math.max(...lons)));
const ty0 = Math.floor(tileY(Math.max(...lats)));
const ty1 = Math.floor(tileY(Math.min(...lats)));
const MW = (tx1 - tx0 + 1) * TILE;
const MH = (ty1 - ty0 + 1) * TILE;
const mosaic = new Float32Array(MW * MH);
for (let ty = ty0; ty <= ty1; ty++)
  for (let tx = tx0; tx <= tx1; tx++) {
    const path = `${CACHE}${Z}-${tx}-${ty}.png`;
    if (!existsSync(path)) {
      const res = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${tx}/${ty}.png`);
      if (!res.ok) throw new Error(`tile ${Z}/${tx}/${ty}: ${res.status}`);
      writeFileSync(path, Buffer.from(await res.arrayBuffer()));
    }
    const { data, info } = await sharp(path).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const k = (y * TILE + x) * info.channels;
        // Terrarium: metres = R * 256 + G + B / 256 - 32768. Sea is clamped to 0.
        const m = data[k] * 256 + data[k + 1] + data[k + 2] / 256 - 32768;
        mosaic[((ty - ty0) * TILE + y) * MW + (tx - tx0) * TILE + x] = Math.max(0, m);
      }
  }
console.log(`elevation: ${(tx1 - tx0 + 1) * (ty1 - ty0 + 1)} tiles`);

function elevation(lon, lat) {
  const x = (tileX(lon) - tx0) * TILE - 0.5;
  const y = (tileY(lat) - ty0) * TILE - 0.5;
  const x0 = Math.max(0, Math.min(MW - 2, Math.floor(x)));
  const y0 = Math.max(0, Math.min(MH - 2, Math.floor(y)));
  const fx = Math.min(1, Math.max(0, x - x0));
  const fy = Math.min(1, Math.max(0, y - y0));
  const at = (i, j) => mosaic[(y0 + j) * MW + x0 + i];
  return (at(0, 0) * (1 - fx) + at(1, 0) * fx) * (1 - fy) + (at(0, 1) * (1 - fx) + at(1, 1) * fx) * fy;
}

/** Approximate Gaussian blur (three box passes) with radius r px on a W×H grid. */
function blur(src, W, H, r) {
  const a = Float32Array.from(src);
  const b = new Float32Array(src.length);
  const pass = (from, to, horizontal) => {
    const [n, lines] = horizontal ? [W, H] : [H, W];
    for (let l = 0; l < lines; l++) {
      const get = (t) => from[horizontal ? l * W + t : t * W + l];
      let sum = 0;
      for (let t = -r; t <= r; t++) sum += get(Math.max(0, Math.min(n - 1, t)));
      for (let t = 0; t < n; t++) {
        to[horizontal ? l * W + t : t * W + l] = sum / (2 * r + 1);
        sum += get(Math.min(n - 1, t + r + 1)) - get(Math.max(0, t - r));
      }
    }
  };
  for (let p = 0; p < 3; p++) {
    pass(a, b, true);
    pass(b, a, false);
  }
  return a;
}

// --- Range mask: 1 inside the Alps polygon, fading to 0 over FEATHER_KM outside.
function insideRing(x, y) {
  let inside = false;
  for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) {
    const [xa, ya] = ring[a];
    const [xb, yb] = ring[b];
    if (ya > y !== yb > y && x < ((xb - xa) * (y - ya)) / (yb - ya) + xa) inside = !inside;
  }
  return inside;
}
function edgeDistance(x, y) {
  let best = Infinity;
  for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) {
    const [xa, ya] = ring[a];
    const [xb, yb] = ring[b];
    const dx = xb - xa;
    const dy = yb - ya;
    const t = Math.max(0, Math.min(1, ((x - xa) * dx + (y - ya) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(x - xa - t * dx, y - ya - t * dy));
  }
  return best;
}
const smooth = (a, b, v) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// --- Painting.
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
/** Colour at an elevation from a ramp of [metres, colour]. */
const ramp = (stops, e) => {
  if (e <= stops[0][0]) return stops[0][1];
  for (let s = 1; s < stops.length; s++)
    if (e <= stops[s][0]) return mix(stops[s - 1][1], stops[s][1], smooth(stops[s - 1][0], stops[s][0], e));
  return stops[stops.length - 1][1];
};

const PALETTES = {
  // On the green atlas land: deeper green foothills, olive and grey-green
  // middle slopes, muted grey rock, snow only on the highest massifs.
  "alps-relief": {
    zones: [
      [400, hex("#96d06f")],
      [900, hex("#80c05c")],
      [1400, hex("#93b370")],
      [1900, hex("#aeb09f")],
      [2350, hex("#c4c4bd")],
      [2600, hex("#d8dad9")],
      [2850, hex("#fcfdff")],
    ],
    light: hex("#fffcec"),
    shadow: hex("#40606a"),
  },
  // Over a selected (teal) country: the same relief in teal, mint and white.
  "alps-relief-teal": {
    zones: [
      [400, hex("#15a597")],
      [900, hex("#10958a")],
      [1400, hex("#2c9d90")],
      [1900, hex("#6db6ab")],
      [2350, hex("#9dcec5")],
      [2600, hex("#bfe1da")],
      [2850, hex("#f6fcfb")],
    ],
    light: hex("#e6fff8"),
    shadow: hex("#04463f"),
  },
};

// Light from the north-west (upper left on screen), 40° above the horizon.
const AZ = (315 * Math.PI) / 180;
const ALT = (40 * Math.PI) / 180;
const [lx, ly, lz] = [Math.sin(AZ) * Math.cos(ALT), -Math.cos(AZ) * Math.cos(ALT), Math.sin(ALT)];

/**
 * Levels of detail. The whole-map level is simplified to broad ridges and
 * valleys (a phone shows the Alps about 220px wide); the zoomed level keeps
 * more of the real valleys and is drawn over it once the map is zoomed in.
 * `shapeKm` smooths the elevation used for lighting, `zoneKm` the one used for
 * the colour zones; `exaggeration` is vertical, so the relief reads at map scale.
 */
const LEVELS = [
  { name: "base", px: 1.6, shapeKm: 2.4, zoneKm: 6, exaggeration: 5 },
  { name: "detail", px: 3.2, shapeKm: 1.1, zoneKm: 3.5, exaggeration: 3.2 },
];

async function render({ name: level, px, shapeKm, zoneKm, exaggeration }) {
  const W = Math.round((box.x1 - box.x0) * px);
  const H = Math.round((box.y1 - box.y0) * px);
  const toWorld = (i, j) => [box.x0 + (i + 0.5) / px, box.y0 + (j + 0.5) / px];
  const dem = new Float32Array(W * H);
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const [lon, lat] = projection.invert(toWorld(i, j));
      dem[j * W + i] = elevation(lon, lat);
    }
  const pxKm = 1 / (px * perKm);
  const shapeDem = blur(dem, W, H, Math.max(1, Math.round(shapeKm / pxKm)));
  const zoneDem = blur(dem, W, H, Math.max(1, Math.round(zoneKm / pxKm)));
  const cellM = pxKm * 1000;

  const shade = new Float32Array(W * H);
  const mask = new Float32Array(W * H);
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const at = (a, b) => shapeDem[Math.min(H - 1, Math.max(0, b)) * W + Math.min(W - 1, Math.max(0, a))];
      const dzdx = ((at(i + 1, j) - at(i - 1, j)) / (2 * cellM)) * exaggeration;
      const dzdy = ((at(i, j + 1) - at(i, j - 1)) / (2 * cellM)) * exaggeration; // y grows southwards
      const n = Math.hypot(dzdx, dzdy, 1);
      const lit = (-dzdx * lx + -dzdy * ly + lz) / n;
      shade[j * W + i] = lit - lz; // 0 on flat ground, + facing the light, − away
      const [x, y] = toWorld(i, j);
      const d = insideRing(x, y) ? 0 : edgeDistance(x, y) / perKm;
      mask[j * W + i] = 1 - smooth(0, FEATHER_KM, d);
    }

  for (const [name, p] of Object.entries(PALETTES)) {
    const out = Buffer.alloc(W * H * 4);
    for (let q = 0; q < W * H; q++) {
      const s = shade[q];
      // Relief strength: starts in the foothills, full from about 1100 m.
      const lift = smooth(450, 1100, shapeDem[q]);
      let c = ramp(p.zones, zoneDem[q]);
      c = s > 0 ? mix(c, p.light, Math.min(0.8, s * 2)) : mix(c, p.shadow, Math.min(0.6, -s * 1.5));
      // Foothills blend into the land: colour fades in with height, while
      // slopes (lit or shaded) show a little lower down.
      const alpha = mask[q] * Math.min(1, Math.max(lift * 0.95, Math.min(1, Math.abs(s) * 2.2) * smooth(250, 700, shapeDem[q])));
      out[q * 4] = Math.round(c[0]);
      out[q * 4 + 1] = Math.round(c[1]);
      out[q * 4 + 2] = Math.round(c[2]);
      out[q * 4 + 3] = Math.round(Math.max(0, Math.min(1, alpha)) * 255);
    }
    const outName = level === "base" ? name : `${name}-${level}`;
    await sharp(out, { raw: { width: W, height: H, channels: 4 } })
      .webp({ quality: 78, alphaQuality: 70, effort: 6 })
      .toFile(file(`src/assets/map/${outName}.webp`));
    console.log(`${outName}.webp ${W}×${H}`);
  }
  // Where the raster sits, in world units (its pixels are exactly 1 / px wide).
  return { x: box.x0, y: box.y0, width: W / px, height: H / px };
}

const meta = { levels: {} };
for (const level of LEVELS) meta.levels[level.name] = await render(level);

// Control points, so a test can confirm the raster's projection still matches the map's.
meta.check = [
  [6.865, 45.833], // Mont Blanc
  [13.837, 46.378], // Triglav
  [10.985, 47.421], // Zugspitze
].map(([lon, lat]) => {
  const [x, y] = projection([lon, lat]);
  return { lonLat: [lon, lat], world: [+x.toFixed(3), +y.toFixed(3)] };
});
meta.source = "Terrarium z8 (Mapzen/Tilezen terrain tiles), Natural Earth 1:10m ALPS range polygon";
writeFileSync(file("src/assets/map/alps-relief.json"), JSON.stringify(meta, null, 2) + "\n");
console.log("alps-relief.json");
