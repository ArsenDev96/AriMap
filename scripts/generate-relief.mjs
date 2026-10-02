// Generates the map's painted landscape (relief and forests) from real data:
//   src/assets/map/relief/<level id>-land.webp, <level id>-tone.webp  (one level's whole map, loaded with that level)
//   public/relief/<hash>/<lod>/<family>/<col>-<row>.webp               (zoomed tiles, shared by all levels, loaded only when needed)
//   src/assets/map/relief.json                                         (placement and tile manifest)
//
//   node scripts/generate-relief.mjs
//
// Elevation: Terrain Tiles (Mapzen/Tilezen "Terrarium" PNGs on AWS Open Data),
// zoom 7 for the overview and zoom 8 for the zoomed levels, cached in
// node_modules/.cache/arimap-terrain. Forests: ESA WorldCover 2021 v200 tree
// cover (class 10), read from the cloud-optimised GeoTIFFs' internal overviews
// (about 320 m and 160 m per pixel) over HTTP, cached in
// node_modules/.cache/arimap-worldcover. Everything is drawn in the map's own
// projected "world" coordinates (the projection of src/geo/regionMap.ts), so
// the rasters are placed with plain <image> elements and stay anchored while
// zooming and panning. See docs/TERRAIN.md for sources, attribution and the
// artistic simplifications.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { geoAzimuthalEqualArea, geoPath } from "d3-geo";
import { fromUrl } from "geotiff";
import { feature } from "topojson-client";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const root = new URL("..", import.meta.url);
const file = (rel) => new URL(rel, root).pathname.replace(/^\/([A-Za-z]:)/, "$1");

// --- The map projection and areas, exactly as src/geo/regionMap.ts builds them.
// One projection for every level (PROJECTION_FIT in regionMap.ts: Level 1's countries).
const PROJECTION_FIT = ["FRA", "BEL", "NLD", "LUX", "DEU"];
/**
 * The playable levels: their countries and coverage half-size (`map.coverageHalf`,
 * default [1150, 900]), as in src/core/lessons/. src/geo/relief.test.ts checks
 * the manifest against every playable level, so a level added there without
 * rerunning this script fails the tests.
 */
const LEVEL_AREAS = [
  { id: "western-europe-1", countries: ["FRA", "BEL", "NLD", "LUX", "DEU"], coverageHalf: [1150, 900] },
  { id: "around-the-alps", countries: ["FRA", "CHE", "DEU", "AUT", "ITA"], coverageHalf: [1090, 840] },
  { id: "central-europe", countries: ["DEU", "POL", "CZE", "SVK", "AUT"], coverageHalf: [715, 760] },
  { id: "along-the-adriatic", countries: ["ITA", "SVN", "HRV", "BIH", "MNE"], coverageHalf: [1000, 505] },
  { id: "towards-greece", countries: ["HUN", "ROU", "SRB", "BGR", "GRC"], coverageHalf: [1100, 600] },
];
/**
 * Where the zoomed tile grids are anchored: the corner of Level 1's pan area,
 * where the first grid began. Grids grow by whole tiles from here, so Level 1's
 * tiles keep their pixels when levels are added.
 */
const GRID_ANCHOR = [-216, -250];
const topology = JSON.parse(readFileSync(file("src/data/geo/europe-west.topo.json"), "utf8"));
const countries = feature(topology, topology.objects.countries);
const collection = (ids) => ({ type: "FeatureCollection", features: countries.features.filter((f) => f.geometry && ids.includes(String(f.id))) });
const projection = geoAzimuthalEqualArea().rotate([-8, -50]).fitSize([1000, 1000], collection(PROJECTION_FIT));

/**
 * A level's areas: `coverage`, everything its map can ever show (coverage in
 * regionMap.ts); `panArea`, where it can be panned when zoomed in (PAN_MARGIN
 * 0.25 in regionMap.ts); `lessonArea`, its countries, the only ones that ever
 * take a state colour (selection, answers, Travel).
 */
function levelAreas({ id, countries: ids, coverageHalf: [hx, hy] }) {
  const [[fx0, fy0], [fx1, fy1]] = geoPath(projection).bounds(collection(ids));
  const [cx, cy] = [(fx0 + fx1) / 2, (fy0 + fy1) / 2];
  const coverage = { x0: cx - hx, y0: cy - hy, x1: cx + hx, y1: cy + hy };
  const panArea = {
    x0: Math.max(coverage.x0, fx0 - (fx1 - fx0) * 0.25),
    y0: Math.max(coverage.y0, fy0 - (fy1 - fy0) * 0.25),
    x1: Math.min(coverage.x1, fx1 + (fx1 - fx0) * 0.25),
    y1: Math.min(coverage.y1, fy1 + (fy1 - fy0) * 0.25),
  };
  const lessonArea = { x0: fx0 - 4, y0: fy0 - 4, x1: fx1 + 4, y1: fy1 + 4 };
  return { id, coverage, panArea, lessonArea };
}
const AREAS = LEVEL_AREAS.map(levelAreas);
const union = (boxes) => ({
  x0: Math.min(...boxes.map((b) => b.x0)),
  y0: Math.min(...boxes.map((b) => b.y0)),
  x1: Math.max(...boxes.map((b) => b.x1)),
  y1: Math.max(...boxes.map((b) => b.y1)),
});
const overlaps = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/** World units per km, near the projection centre. */
const perKm = (() => {
  const a = projection([8, 49.5]);
  const b = projection([8, 50.4]); // 100 km north
  return Math.hypot(b[0] - a[0], b[1] - a[1]) / 100.08;
})();

// --- Elevation tiles.
const TILE = 256;
const CACHE = file("node_modules/.cache/arimap-terrain/");
mkdirSync(CACHE, { recursive: true });

/** Elevation sources named by the tiles used (their x-amz-meta-x-imagery-sources header), for the attribution check. */
const imagerySources = new Map();
const tilesSeen = new Set();

async function fetchTile(z, x, y) {
  const path = `${CACHE}${z}-${x}-${y}.png`;
  const meta = `${CACHE}${z}-${x}-${y}.sources`;
  if (!existsSync(path) || !existsSync(meta)) {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`);
      if (res.ok) {
        writeFileSync(path, Buffer.from(await res.arrayBuffer()));
        writeFileSync(meta, res.headers.get("x-amz-meta-x-imagery-sources") ?? "");
        break;
      }
      if (attempt === 3) throw new Error(`tile ${z}/${x}/${y}: ${res.status}`);
    }
  }
  // Entries look like "srtm/N45E007.hgt": the source is the part before the slash. Each tile counts once.
  if (tilesSeen.has(meta)) return path;
  tilesSeen.add(meta);
  for (const entry of readFileSync(meta, "utf8").split(",").filter(Boolean)) {
    const source = entry.trim().split("/")[0];
    imagerySources.set(source, (imagerySources.get(source) ?? 0) + 1);
  }
  return path;
}

/** Elevation sampler (metres, sea clamped to 0) over a world-space area, from Terrarium tiles at zoom z. */
async function elevationSource(z, area) {
  const n = 2 ** z;
  const tileX = (lon) => ((lon + 180) / 360) * n;
  const tileY = (lat) => ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * n;
  const corners = [];
  const step = (area.x1 - area.x0) / 64;
  for (let y = area.y0; y <= area.y1 + step; y += step)
    for (let x = area.x0; x <= area.x1 + step; x += step) corners.push(projection.invert([Math.min(x, area.x1), Math.min(y, area.y1)]));
  const tx0 = Math.floor(tileX(Math.min(...corners.map((c) => c[0])))) - 1;
  const tx1 = Math.floor(tileX(Math.max(...corners.map((c) => c[0])))) + 1;
  const ty0 = Math.max(0, Math.floor(tileY(Math.max(...corners.map((c) => c[1])))) - 1);
  const ty1 = Math.min(n - 1, Math.floor(tileY(Math.min(...corners.map((c) => c[1])))) + 1);
  const MW = (tx1 - tx0 + 1) * TILE;
  const MH = (ty1 - ty0 + 1) * TILE;
  const mosaic = new Float32Array(MW * MH);
  const jobs = [];
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) jobs.push([tx, ty]);
  let done = 0;
  const worker = async () => {
    for (let job = jobs.pop(); job; job = jobs.pop()) {
      const [tx, ty] = job;
      const path = await fetchTile(z, tx, ty);
      const { data, info } = await sharp(path).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      for (let y = 0; y < TILE; y++)
        for (let x = 0; x < TILE; x++) {
          const k = (y * TILE + x) * info.channels;
          // Terrarium: metres = R * 256 + G + B / 256 - 32768.
          const m = data[k] * 256 + data[k + 1] + data[k + 2] / 256 - 32768;
          mosaic[((ty - ty0) * TILE + y) * MW + (tx - tx0) * TILE + x] = Math.max(0, m);
        }
      if (++done % 100 === 0) console.log(`  z${z}: ${done} tiles`);
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  console.log(`elevation z${z}: ${(tx1 - tx0 + 1) * (ty1 - ty0 + 1)} tiles`);
  return (lon, lat) => {
    const x = (tileX(lon) - tx0) * TILE - 0.5;
    const y = (tileY(lat) - ty0) * TILE - 0.5;
    const x0 = Math.max(0, Math.min(MW - 2, Math.floor(x)));
    const y0 = Math.max(0, Math.min(MH - 2, Math.floor(y)));
    const fx = Math.min(1, Math.max(0, x - x0));
    const fy = Math.min(1, Math.max(0, y - y0));
    const at = (i, j) => mosaic[(y0 + j) * MW + x0 + i];
    return (at(0, 0) * (1 - fx) + at(1, 0) * fx) * (1 - fy) + (at(0, 1) * (1 - fx) + at(1, 1) * fx) * fy;
  };
}

// --- Tree cover: ESA WorldCover 2021 v200, 3°×3° tiles named by their south-west corner.
const WC_CACHE = file("node_modules/.cache/arimap-worldcover/");
mkdirSync(WC_CACHE, { recursive: true });
const wcName = (lat, lon) =>
  `${lat < 0 ? "S" : "N"}${String(Math.abs(lat)).padStart(2, "0")}${lon < 0 ? "W" : "E"}${String(Math.abs(lon)).padStart(3, "0")}`;

/** One tile's tree mask (1 = tree cover) at internal overview `ov`, or null where WorldCover has no tile (open sea). */
async function wcTile(lat, lon, ov) {
  const name = wcName(lat, lon);
  const png = `${WC_CACHE}${name}-ov${ov}.png`;
  const none = `${WC_CACHE}${name}-ov${ov}.none`;
  if (existsSync(none)) return null;
  if (!existsSync(png)) {
    const url = `https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_${name}_Map.tif`;
    const head = await fetch(url, { method: "HEAD" });
    if (head.status === 404 || head.status === 403) {
      writeFileSync(none, "");
      return null;
    }
    let raster;
    for (let attempt = 0; ; attempt++) {
      try {
        const tiff = await fromUrl(url);
        const image = await tiff.getImage(ov);
        const [classes] = await image.readRasters();
        raster = { width: image.getWidth(), height: image.getHeight(), classes };
        break;
      } catch (error) {
        if (attempt === 3) throw error;
      }
    }
    const mask = Buffer.alloc(raster.width * raster.height);
    for (let k = 0; k < mask.length; k++) mask[k] = raster.classes[k] === 10 ? 255 : 0;
    await sharp(mask, { raw: { width: raster.width, height: raster.height, channels: 1 } }).png().toFile(png);
  }
  // One byte per pixel (sharp expands greyscale PNGs to RGB otherwise).
  const { data, info } = await sharp(png).extractChannel(0).raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data };
}

/** Tree-cover sampler (1 or 0, nearest) over a world-space area, from WorldCover overview `ov`. */
async function treeSource(ov, area) {
  const corners = [];
  const step = (area.x1 - area.x0) / 64;
  for (let y = area.y0; y <= area.y1 + step; y += step)
    for (let x = area.x0; x <= area.x1 + step; x += step) corners.push(projection.invert([Math.min(x, area.x1), Math.min(y, area.y1)]));
  const lon0 = Math.floor(Math.min(...corners.map((c) => c[0])) / 3) * 3;
  const lon1 = Math.floor(Math.max(...corners.map((c) => c[0])) / 3) * 3;
  const lat0 = Math.floor(Math.min(...corners.map((c) => c[1])) / 3) * 3;
  const lat1 = Math.floor(Math.max(...corners.map((c) => c[1])) / 3) * 3;
  const tiles = new Map();
  const jobs = [];
  for (let lat = lat0; lat <= lat1; lat += 3) for (let lon = lon0; lon <= lon1; lon += 3) jobs.push([lat, lon]);
  let done = 0;
  const worker = async () => {
    for (let job = jobs.pop(); job; job = jobs.pop()) {
      tiles.set(`${job[0]},${job[1]}`, await wcTile(job[0], job[1], ov));
      if (++done % 50 === 0) console.log(`  WorldCover ov${ov}: ${done} tiles`);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  console.log(`tree cover ov${ov}: ${[...tiles.values()].filter(Boolean).length} of ${tiles.size} tiles have land`);
  return (lon, lat) => {
    const tlat = Math.floor(lat / 3) * 3;
    const tlon = Math.floor(lon / 3) * 3;
    const t = tiles.get(`${tlat},${tlon}`);
    if (!t) return 0;
    const x = Math.min(t.width - 1, Math.floor(((lon - tlon) / 3) * t.width));
    const y = Math.min(t.height - 1, Math.floor(((tlat + 3 - lat) / 3) * t.height));
    return t.data[y * t.width + x] > 0 ? 1 : 0;
  };
}

/** Deterministic lattice value in [0, 1). */
function lattice(x, y, seed) {
  let h = (seed * 374761393 + x * 668265263 + y * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
/** Smooth value noise at world position (x, y) with lattice spacing `size` world units. */
function valueNoise(x, y, size, seed) {
  const [u, v] = [x / size, y / size];
  const [i, j] = [Math.floor(u), Math.floor(v)];
  const [fx, fy] = [u - i, v - j].map((t) => t * t * (3 - 2 * t));
  const a = lattice(i, j, seed) + (lattice(i + 1, j, seed) - lattice(i, j, seed)) * fx;
  const b = lattice(i, j + 1, seed) + (lattice(i + 1, j + 1, seed) - lattice(i, j + 1, seed)) * fx;
  return a + (b - a) * fy;
}
/**
 * Canopy texture in [0, 1] at a world position: octaves of value noise
 * anchored to world coordinates, so it is continuous across tiles and levels
 * (a finer level adds octaves to the same coarse pattern).
 */
function canopy(x, y, octaves) {
  let sum = 0;
  let total = 0;
  octaves.forEach(([size, weight], k) => {
    sum += valueNoise(x, y, size, 17 + k) * weight;
    total += weight;
  });
  return sum / total;
}

/** Approximate Gaussian blur (three box passes) with radius r px on a W×H grid. */
function blur(src, W, H, r) {
  const a = Float32Array.from(src);
  const b = new Float32Array(src.length);
  const pass = (from, to, horizontal) => {
    const [n, lines] = horizontal ? [W, H] : [H, W];
    for (let l = 0; l < lines; l++) {
      const base = horizontal ? l * W : l;
      const stride = horizontal ? 1 : W;
      let sum = 0;
      for (let t = -r; t <= r; t++) sum += from[base + Math.max(0, Math.min(n - 1, t)) * stride];
      for (let t = 0; t < n; t++) {
        to[base + t * stride] = sum / (2 * r + 1);
        sum += from[base + Math.min(n - 1, t + r + 1) * stride] - from[base + Math.max(0, t - r) * stride];
      }
    }
  };
  for (let p = 0; p < 3; p++) {
    pass(a, b, true);
    pass(b, a, false);
  }
  return a;
}

const smooth = (a, b, v) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
/** Value at an elevation from a ramp of [metres, value]. */
const ramp = (stops, e, lerp) => {
  if (e <= stops[0][0]) return stops[0][1];
  for (let s = 1; s < stops.length; s++) if (e <= stops[s][0]) return lerp(stops[s - 1][1], stops[s][1], smooth(stops[s - 1][0], stops[s][0], e));
  return stops[stops.length - 1][1];
};

// --- Painting (the approved Alpine style, extended to the whole map).
// "land": painted over countries in their normal colour. Deeper green
// foothills, olive and grey-green middle slopes, muted grey rock, snow only on
// the highest massifs. "tone": a neutral overlay for a country in a state
// colour (selected, answered, visited…): light and shadow, pale rock and snow,
// so the state colour stays and the terrain keeps its shading.
const LAND = {
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
};
const TONE = {
  rock: hex("#eef6f4"),
  rockAlpha: [
    [1400, 0],
    [1900, 0.3],
    [2350, 0.5],
    [2600, 0.66],
    [2850, 0.93],
  ],
  light: hex("#ffffff"),
  shadow: hex("#06343a"),
};

// Forests: deeper green with lighter crowns, over the land colours; within a
// country in a state colour, a light dark-teal shading, so the state colour stays.
const FOREST = {
  deep: hex("#2f7a35"),
  crown: hex("#56a447"),
  tone: hex("#063b33"),
};

// Light from the north-west (upper left on screen), 40° above the horizon.
const AZ = (315 * Math.PI) / 180;
const ALT = (40 * Math.PI) / 180;
const [lx, ly, lz] = [Math.sin(AZ) * Math.cos(ALT), -Math.cos(AZ) * Math.cos(ALT), Math.sin(ALT)];

/**
 * Levels of detail. `px` is raster pixels per world unit; `shapeKm` smooths
 * the elevation used for light and shade, `zoneKm` the one used for colour
 * zones; `exaggeration` is vertical, so the relief reads at map scale. The
 * overview is simplified to broad ridges and valleys (a 390px phone shows the
 * Alps about 220px wide); zoomed levels keep more of the real valleys.
 * `minDensity` is the screen density (device pixels per world unit, i.e. zoom
 * scale × devicePixelRatio) from which a level is drawn.
 *
 * Forests: tree cover is read from WorldCover overview `wcOverview` (5 ≈ 320 m,
 * 4 ≈ 160 m per pixel), averaged over `treeSamples`² points per pixel into a
 * forest share and softened (`forestBlur` px), so small woods fade at the whole-map view and
 * reappear when zoomed. `forestAlpha` is the strongest forest tint; the
 * canopy octaves ([lattice size in world units, weight]) and `canopyAmount`
 * give more crown texture on finer levels. Sizes are chosen for the screen:
 * a lattice of 14 units is about 5px at the whole-map view, and the finest
 * (1.1 units) is 2–3px at the zoom where level 3 is drawn.
 */
const LEVELS = [
  {
    name: "overview",
    px: 1,
    shapeKm: 2.4,
    zoneKm: 6,
    exaggeration: 5,
    minDensity: 0,
    wcOverview: 5,
    treeSamples: 4,
    forestBlur: 2,
    forestAlpha: 0.3,
    canopyOctaves: [[14, 1]],
    canopyAmount: 0.16,
  },
  {
    name: "l2",
    px: 2,
    shapeKm: 1.6,
    zoneKm: 4.5,
    exaggeration: 4,
    minDensity: 1.4,
    wcOverview: 5,
    treeSamples: 3,
    forestBlur: 1,
    forestAlpha: 0.36,
    canopyOctaves: [
      [14, 1],
      [5, 0.9],
    ],
    canopyAmount: 0.34,
  },
  {
    name: "l3",
    px: 3.2,
    shapeKm: 1.1,
    zoneKm: 3.5,
    exaggeration: 3.2,
    minDensity: 2.8,
    wcOverview: 4,
    treeSamples: 3,
    forestBlur: 1,
    forestAlpha: 0.4,
    canopyOctaves: [
      [14, 1],
      [5, 0.9],
      [2.2, 0.8],
      [1.1, 0.55],
    ],
    canopyAmount: 0.46,
  },
];
/** Roughness window: local relief (standard deviation of elevation) within about this radius. */
const ROUGH_KM = 5;
const TILE_PX = 512;

function paintLevel(level, area, sample, trees) {
  const { px } = level;
  const W = Math.round((area.x1 - area.x0) * px);
  const H = Math.round((area.y1 - area.y0) * px);
  const toWorld = (i, j) => [area.x0 + (i + 0.5) / px, area.y0 + (j + 0.5) / px];
  console.log(`${level.name}: ${W}×${H}px`);
  const dem = new Float32Array(W * H);
  const lons = new Float32Array(W * H);
  const lats = new Float32Array(W * H);
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const [lon, lat] = projection.invert(toWorld(i, j));
      dem[j * W + i] = sample(lon, lat);
      lons[j * W + i] = lon;
      lats[j * W + i] = lat;
    }
  // Forest share: tree cover sampled on an n×n grid inside each pixel
  // (positions interpolated from the pixel centres' longitude and latitude).
  const n = level.treeSamples;
  const share = new Float32Array(W * H);
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const q = j * W + i;
      const [qx0, qx1] = [j * W + Math.max(0, i - 1), j * W + Math.min(W - 1, i + 1)];
      const [qy0, qy1] = [Math.max(0, j - 1) * W + i, Math.min(H - 1, j + 1) * W + i];
      const spanX = (qx1 - qx0) || 1;
      const spanY = ((qy1 - qy0) / W) || 1;
      const [dlonX, dlatX] = [(lons[qx1] - lons[qx0]) / spanX, (lats[qx1] - lats[qx0]) / spanX];
      const [dlonY, dlatY] = [(lons[qy1] - lons[qy0]) / spanY, (lats[qy1] - lats[qy0]) / spanY];
      let hits = 0;
      for (let b = 0; b < n; b++)
        for (let a = 0; a < n; a++) {
          const [u, v] = [(a + 0.5) / n - 0.5, (b + 0.5) / n - 0.5];
          hits += trees(lons[q] + u * dlonX + v * dlonY, lats[q] + u * dlatX + v * dlatY);
        }
      share[q] = hits / (n * n);
    }
  // Soft, irregular edges (softer on the whole-map level); no outline.
  const forest = blur(share, W, H, level.forestBlur);
  const pxKm = 1 / (px * perKm);
  const r = (km) => Math.max(1, Math.round(km / pxKm));
  const shapeDem = blur(dem, W, H, r(level.shapeKm));
  const zoneDem = blur(dem, W, H, r(level.zoneKm));
  const mean = blur(dem, W, H, r(ROUGH_KM));
  for (let q = 0; q < dem.length; q++) dem[q] *= dem[q];
  const mean2 = blur(dem, W, H, r(ROUGH_KM));
  const cellM = pxKm * 1000;
  const ex = level.exaggeration;

  /** RGBA for both families at one pixel. */
  const pixel = (i, j, out, o) => {
    const q = j * W + i;
    const at = (a, b) => shapeDem[Math.min(H - 1, Math.max(0, b)) * W + Math.min(W - 1, Math.max(0, a))];
    const dzdx = ((at(i + 1, j) - at(i - 1, j)) / (2 * cellM)) * ex;
    const dzdy = ((at(i, j + 1) - at(i, j - 1)) / (2 * cellM)) * ex; // y grows southwards
    const s = (-dzdx * lx + -dzdy * ly + lz) / Math.hypot(dzdx, dzdy, 1) - lz; // 0 flat, + lit, − shaded
    const e = shapeDem[q];
    const z = zoneDem[q];
    const std = Math.sqrt(Math.max(0, mean2[q] - mean[q] * mean[q]));
    // Height counts only where the ground is also rough: a high plateau (the
    // Spanish Meseta) stays nearly flat, a range (the Alps) is fully painted.
    const rough = smooth(60, 320, std);
    const lift = smooth(450, 1100, e) * rough;
    const low = smooth(120, 600, e);

    // Where light and shade show: everywhere in ranges, fading out on low ground.
    const weight = Math.max(lift, low);
    // Gentle slopes of rolling uplands get a little more light and shade, so
    // they read; in the high ranges (lift = 1) this is the approved Alpine formula.
    const gain = 1 + 1.5 * (1 - lift);

    // Forest: a share of tree cover, then canopy texture (lighter crowns, darker gaps).
    const [wx, wy] = toWorld(i, j);
    const crown = canopy(wx, wy, level.canopyOctaves);
    const cover = smooth(0.1, 0.65, forest[q]) * (1 - level.canopyAmount / 2 + level.canopyAmount * crown);

    // Land: elevation colour, forest over it, then light or shade on top, so
    // hills stay readable through the forest.
    const za = lift * 0.95;
    const fa = cover * level.forestAlpha;
    const [lc, la] = s > 0 ? [LAND.light, Math.min(0.8, s * 2 * gain) * weight] : [LAND.shadow, Math.min(0.6, -s * 1.5 * gain) * weight];
    write(out.land, o, [
      [ramp(LAND.zones, z, mix), za],
      [mix(FOREST.deep, FOREST.crown, crown), fa],
      [lc, la],
    ]);

    // Tone: pale rock and snow, a light forest shading, then light or shade.
    const ra = ramp(TONE.rockAlpha, z, (x, y, t) => x + (y - x) * t) * lift;
    const [sc, sa] = s > 0 ? [TONE.light, Math.min(0.55, s * 1.8 * gain) * weight] : [TONE.shadow, Math.min(0.5, -s * 1.4 * gain) * weight];
    write(out.tone, o, [
      [TONE.rock, ra],
      [FOREST.tone, cover * 0.17],
      [sc, sa],
    ]);
  };
  return { W, H, pixel };
}

/** Composites [colour, alpha] layers bottom to top ("over") into out[o..o+3]. */
function write(out, o, layers) {
  let a = 0;
  const c = [0, 0, 0]; // premultiplied
  for (const [lc, la] of layers) {
    for (let k = 0; k < 3; k++) c[k] = lc[k] * la + c[k] * (1 - la);
    a = la + a * (1 - la);
  }
  for (let k = 0; k < 3; k++) out[o + k] = a > 0 ? c[k] / a : 0;
  out[o + 3] = Math.round(a * 255);
}

async function encode(width, height, rgba, quality = 72) {
  const buf = Buffer.alloc(width * height * 4);
  for (let k = 0; k < buf.length; k++) buf[k] = Math.max(0, Math.min(255, Math.round(rgba[k])));
  return sharp(buf, { raw: { width, height, channels: 4 } }).webp({ quality, alphaQuality: 50, effort: 6 }).toBuffer();
}

/** Renders a W×H block of both families starting at pixel (i0, j0). */
function block(painted, i0, j0, w, h) {
  const out = { land: new Float32Array(w * h * 4), tone: new Float32Array(w * h * 4) };
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) painted.pixel(Math.min(painted.W - 1, i0 + i), Math.min(painted.H - 1, j0 + j), out, (j * w + i) * 4);
  return out;
}

const maxAlpha = (rgba) => {
  let m = 0;
  for (let k = 3; k < rgba.length; k += 4) m = Math.max(m, rgba[k]);
  return m;
};

const manifest = { levels: [], overviews: {} };
const outputs = []; // [relative public path, buffer]
const RELIEF_ASSETS = file("src/assets/map/relief/");
rmSync(RELIEF_ASSETS, { recursive: true, force: true });
mkdirSync(RELIEF_ASSETS, { recursive: true });

// --- Overviews, one per level: the land over the level's whole coverage, the tone over its countries.
for (const { id, coverage, lessonArea } of AREAS) {
  const level = LEVELS[0];
  const area = { x0: Math.floor(coverage.x0), y0: Math.floor(coverage.y0), x1: Math.ceil(coverage.x1), y1: Math.ceil(coverage.y1) };
  const painted = paintLevel(level, area, await elevationSource(7, area), await treeSource(level.wcOverview, area));
  const land = block(painted, 0, 0, painted.W, painted.H).land;
  const landBuf = await encode(painted.W, painted.H, land);
  writeFileSync(`${RELIEF_ASSETS}${id}-land.webp`, landBuf);
  const t = { x0: Math.floor(lessonArea.x0), y0: Math.floor(lessonArea.y0), x1: Math.ceil(lessonArea.x1), y1: Math.ceil(lessonArea.y1) };
  const [ti, tj, tw, th] = [(t.x0 - area.x0) * level.px, (t.y0 - area.y0) * level.px, (t.x1 - t.x0) * level.px, (t.y1 - t.y0) * level.px];
  const toneBuf = await encode(tw, th, block(painted, ti, tj, tw, th).tone);
  writeFileSync(`${RELIEF_ASSETS}${id}-tone.webp`, toneBuf);
  manifest.overviews[id] = {
    land: { x: area.x0, y: area.y0, width: painted.W / level.px, height: painted.H / level.px, bytes: landBuf.length },
    tone: { x: t.x0, y: t.y0, width: tw / level.px, height: th / level.px, bytes: toneBuf.length },
  };
  console.log(`${id} overview: land ${landBuf.length} B, tone ${toneBuf.length} B`);
}

// --- Zoomed levels: 512px tiles over every level's pan area, in one grid shared by
// all levels; tone tiles only over the levels' countries. The whole area is painted
// at once, so tiles match where two levels' areas meet.
const panUnion = union(AREAS.map((a) => a.panArea));
const detailSource = await elevationSource(8, { x0: panUnion.x0 - 20, y0: panUnion.y0 - 20, x1: panUnion.x1 + 20, y1: panUnion.y1 + 20 });
for (const level of LEVELS.slice(1)) {
  const tileWorld = TILE_PX / level.px;
  const start = [panUnion.x0, panUnion.y0];
  const origin = GRID_ANCHOR.map((a, k) => a - Math.max(0, Math.ceil((a - start[k]) / tileWorld)) * tileWorld);
  const cols = Math.ceil((panUnion.x1 - origin[0]) / tileWorld);
  const rows = Math.ceil((panUnion.y1 - origin[1]) / tileWorld);
  const area = { x0: origin[0], y0: origin[1], x1: origin[0] + cols * tileWorld, y1: origin[1] + rows * tileWorld };
  const painted = paintLevel(level, area, detailSource, await treeSource(level.wcOverview, area));
  const entry = { name: level.name, minDensity: level.minDensity, px: level.px, tileWorld, origin, cols, rows, land: [], tone: [], bytes: { land: 0, tone: 0 } };
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      const [wx0, wy0] = [origin[0] + col * tileWorld, origin[1] + row * tileWorld];
      const box = { x0: wx0, y0: wy0, x1: wx0 + tileWorld, y1: wy0 + tileWorld };
      // Only where some level can be panned to when zoomed in.
      if (!AREAS.some((a) => overlaps(box, a.panArea))) continue;
      const tile = block(painted, col * TILE_PX, row * TILE_PX, TILE_PX, TILE_PX);
      const toneWanted = AREAS.some((a) => overlaps(box, a.panArea) && overlaps(box, a.lessonArea));
      for (const family of ["land", "tone"]) {
        if (family === "tone" && !toneWanted) continue;
        // Tiles with no visible relief (sea, flat lowland) are left out.
        if (maxAlpha(tile[family]) < 3) continue;
        const buf = await encode(TILE_PX, TILE_PX, tile[family]);
        outputs.push([`${level.name}/${family}/${col}-${row}.webp`, buf]);
        entry[family].push(`${col}-${row}`);
        entry.bytes[family] += buf.length;
      }
    }
  manifest.levels.push(entry);
  console.log(`${level.name}: ${entry.land.length} land + ${entry.tone.length} tone tiles, ${entry.bytes.land + entry.bytes.tone} B`);
}

// Tiles live in a folder named by their content hash, so they can be cached forever.
const hash = createHash("sha256");
for (const [path, buf] of outputs) hash.update(path).update(buf);
manifest.version = hash.digest("hex").slice(0, 10);
rmSync(file("public/relief"), { recursive: true, force: true });
for (const [path, buf] of outputs) {
  const target = file(`public/relief/${manifest.version}/${path}`);
  mkdirSync(target.slice(0, target.lastIndexOf("/")), { recursive: true });
  writeFileSync(target, buf);
}

// Control points, so a test can confirm the rasters' projection still matches the map's.
manifest.check = [
  [6.865, 45.833], // Mont Blanc
  [2.814, 45.528], // Puy de Sancy
  [10.617, 51.801], // Brocken
].map(([lon, lat]) => {
  const [x, y] = projection([lon, lat]);
  return { lonLat: [lon, lat], world: [+x.toFixed(3), +y.toFixed(3)] };
});
manifest.source =
  "Elevation: Terrain Tiles (Mapzen/Tilezen Terrarium), zoom 7 (overview) and 8 (zoomed levels). Forests: ESA WorldCover 2021 v200 tree cover, overviews 5 (overview, l2) and 4 (l3).";
// Attribution check: the elevation sources named by the tiles used (see docs/TERRAIN.md, "Attribution").
manifest.elevationSources = Object.fromEntries([...imagerySources].sort());
console.log("elevation sources:", manifest.elevationSources);
writeFileSync(file("src/assets/map/relief.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`relief.json (version ${manifest.version})`);
