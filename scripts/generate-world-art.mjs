// Generates the home screen's illustrated world map (src/assets/map/world/):
//   land.webp     each continent's land in its colour, shaded by real terrain (transparent elsewhere)
//   water.webp    the ocean across the whole rectangular map, lighter in the shallows by the coasts
//
//   node scripts/generate-world-art.mjs
//
// It writes those two files only. The page's clouds and scenery (cloud-corner, cloud-bank, scenery)
// are supplied paintings, prepared by scripts/prepare-world-art.mjs.
//
// The map's rasters are drawn in the world map's own units (src/data/geo/world-map.ts: a flat,
// equirectangular projection centred on 11°E, 1000 × 500), at SCALE times that size, so the page places them over the
// vector map with plain <image> elements and they stay aligned with its land, coasts and hit areas.
// The land is clipped to the continents' own paths; the water fills the map.
//
// Elevation: Terrain Tiles (Mapzen/Tilezen "Terrarium" PNGs on AWS Open Data) at zoom 3, cached in
// node_modules/.cache/arimap-terrain like scripts/generate-relief.mjs's. It only shades the land (tone
// and hillshade, softened); the colours are the continents' own, not land cover. The water's texture
// is noise, not painted. See docs/DATA.md, "World map (home screen)".
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { geoEquirectangular, geoPath } from "d3-geo";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const root = new URL("..", import.meta.url);
const file = (rel) => new URL(rel, root).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const OUT = file("src/assets/map/world/");
mkdirSync(OUT, { recursive: true });

const { WORLD_MAP_WIDTH, WORLD_MAP_HEIGHT, WORLD_REGIONS } = await import(new URL("src/data/geo/world-map.ts", root).href);

// --- The map's projection, exactly as scripts/prepare-world-map.mjs builds it (checked below).
const projection = geoEquirectangular().rotate([-11, 0]).precision(0.2);
projection.fitWidth(WORLD_MAP_WIDTH, { type: "Sphere" });
{
  const [[, top]] = geoPath(projection).bounds({ type: "Sphere" });
  projection.translate([projection.translate()[0], projection.translate()[1] - top]);
}
// The north pole on the map's top edge and the south pole on its bottom: the same placement.
const [, northY] = projection([0, 90]);
const [, southY] = projection([0, -90]);
if (Math.abs(northY) > 0.5 || Math.abs(southY - WORLD_MAP_HEIGHT) > 1) throw new Error(`projection mismatch: ${northY}, ${southY}`);

/** Raster size: the map's units times SCALE, 2000 × 1000: about the device pixels of a 358px-wide map at 3×, or a
 * 1000px-wide desktop map at 2×. GRAIN keeps the painted grain the same size on the map whatever SCALE is (tuned at 1.4). */
const SCALE = 2;
const GRAIN = SCALE / 1.4;
const W = Math.round(WORLD_MAP_WIDTH * SCALE);
const H = Math.round(WORLD_MAP_HEIGHT * SCALE);

// --- Masks, rasterised from the map's own paths (anti-aliased, one channel, 0–255).
async function mask(d, w = W, h = H, s = SCALE) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><path transform="scale(${s})" d="${d}" fill="#fff"/></svg>`;
  const { data } = await sharp(Buffer.from(svg)).extractChannel(0).raw().toBuffer({ resolveWithObject: true });
  return data;
}
async function blur(channel, sigma) {
  // (sharp's blur returns three channels for a one-channel input: keep the first.)
  return await sharp(channel, { raw: { width: W, height: H, channels: 1 } }).blur(sigma).extractChannel(0).raw().toBuffer();
}

const REGIONS = ["europe", "asia", "africa", "north-america", "south-america", "oceania", "antarctica"];
const regionMasks = {};
for (const r of REGIONS) regionMasks[r] = await mask(WORLD_REGIONS[r]);
const land = new Uint8Array(W * H);
const owner = new Int8Array(W * H).fill(-1);
for (let i = 0; i < W * H; i++) {
  let best = 0;
  REGIONS.forEach((r, k) => {
    const v = regionMasks[r][i];
    if (v > best) {
      best = v;
      owner[i] = k;
    }
  });
  land[i] = Math.min(255, REGIONS.reduce((s, r) => s + regionMasks[r][i], 0));
}

// --- Elevation (metres, sea at 0) and hillshade on a Web Mercator mosaic of zoom-3 tiles.
const Z = 3;
const N = 2 ** Z;
const TILE = 256;
const M = N * TILE;
const CACHE = file("node_modules/.cache/arimap-terrain/");
mkdirSync(CACHE, { recursive: true });
async function tile(x, y) {
  const path = `${CACHE}${Z}-${x}-${y}.png`;
  const meta = `${CACHE}${Z}-${x}-${y}.sources`;
  if (!existsSync(path) || !existsSync(meta)) {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${x}/${y}.png`);
      if (res.ok) {
        writeFileSync(path, Buffer.from(await res.arrayBuffer()));
        writeFileSync(meta, res.headers.get("x-amz-meta-x-imagery-sources") ?? "");
        break;
      }
      if (attempt === 3) throw new Error(`tile ${Z}/${x}/${y}: ${res.status}`);
    }
  }
  return path;
}
const elev = new Float32Array(M * M);
for (let ty = 0; ty < N; ty++)
  for (let tx = 0; tx < N; tx++) {
    const { data } = await sharp(await tile(tx, ty)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let py = 0; py < TILE; py++)
      for (let px = 0; px < TILE; px++) {
        const o = (py * TILE + px) * 3;
        const e = data[o] * 256 + data[o + 1] + data[o + 2] / 256 - 32768;
        elev[(ty * TILE + py) * M + tx * TILE + px] = Math.max(0, e);
      }
  }
const mercY = (lat) => ((1 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / Math.PI) / 2) * M;
const latOfRow = (y) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 0.5)) / M))) * 180) / Math.PI;
// Hillshade: light from the north-west, 45° up; slopes exaggerated (zoom 3 is about 20 km a pixel) and
// softened, so it reads as gentle shading at the map's size rather than detail. 0.5 is flat.
const shade = new Float32Array(M * M).fill(0.5);
{
  const EXAG = 24;
  const [lx, ly, lz] = [-Math.SQRT1_2 * Math.SQRT1_2, -Math.SQRT1_2 * Math.SQRT1_2, Math.SQRT1_2];
  for (let y = 1; y < M - 1; y++) {
    const metres = (40075016 / M) * Math.cos((latOfRow(y) * Math.PI) / 180);
    for (let x = 1; x < M - 1; x++) {
      const i = y * M + x;
      const dzdx = ((elev[i + 1] - elev[i - 1]) / (2 * metres)) * EXAG;
      const dzdy = ((elev[i + M] - elev[i - M]) / (2 * metres)) * EXAG;
      const len = Math.hypot(dzdx, dzdy, 1);
      const lit = (-dzdx * lx - dzdy * ly + lz) / len;
      shade[i] = Math.min(1, Math.max(0, 0.5 + (lit - lz) * 2.2));
    }
  }
}
const shadeSoft = await sharp(Buffer.from(shade.map((v) => v * 255).map(Math.round)), { raw: { width: M, height: M, channels: 1 } })
  .blur(1.2)
  .extractChannel(0)
  .raw()
  .toBuffer();
function sample(buf, scale, lon, lat) {
  const x = ((lon + 180) / 360) * M - 0.5;
  const y = mercY(Math.max(-85, Math.min(85, lat))) - 0.5;
  const x0 = Math.floor(x);
  const y0 = Math.max(0, Math.min(M - 2, Math.floor(y)));
  const fx = x - x0;
  const fy = Math.max(0, Math.min(1, y - y0));
  const at = (xx, yy) => buf[yy * M + (((xx % M) + M) % M)] * scale;
  const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * fx;
  const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * fx;
  return a + (b - a) * fy;
}

// --- Deterministic value noise, for the painted grain.
function lattice(seed, x, y) {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(seed, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const smooth = (t) => t * t * (3 - 2 * t);
function noise(seed, x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = smooth(x - x0);
  const fy = smooth(y - y0);
  const a = lattice(seed, x0, y0) + (lattice(seed, x0 + 1, y0) - lattice(seed, x0, y0)) * fx;
  const b = lattice(seed, x0, y0 + 1) + (lattice(seed, x0 + 1, y0 + 1) - lattice(seed, x0, y0 + 1)) * fx;
  return a + (b - a) * fy;
}
function fbm(seed, x, y, octaves) {
  let sum = 0;
  let total = 0;
  for (const [f, w] of octaves) {
    sum += noise(seed + f, x * f, y * f) * w;
    total += w;
  }
  return sum / total;
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const smoothstep = (a, b, v) => smooth(clamp((v - a) / (b - a)));

// Each continent's colours: its lowland, its highland, its shadow and its light. Vivid green Europe,
// warm orange Asia, golden yellow Africa, blue North America, pink South America; Oceania and
// Antarctica quieter, as context.
const PALETTE = {
  europe: ["#44c95b", "#2f9f4a", "#16703a", "#a6f09a"],
  asia: ["#f8a965", "#e88d4c", "#b45f2c", "#ffd8a8"],
  africa: ["#f5cd47", "#e3ad2e", "#b0801a", "#fff09a"],
  "north-america": ["#68a5f3", "#4b86e0", "#2a5cb4", "#bfe0ff"],
  "south-america": ["#f27aa5", "#de5a8b", "#a83766", "#ffc0d8"],
  oceania: ["#c7b8f2", "#ab98e6", "#7d68c4", "#ebe2ff"],
  antarctica: ["#f3f8fc", "#e6f0f7", "#b4cadc", "#ffffff"],
};
const PAL = REGIONS.map((r) => PALETTE[r].map(hex));

// --- Land.
{
  // The coast: a light rim just inside it (from a blur of the land mask).
  const rimNear = await blur(land, 1.6 * SCALE);
  const out = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const [X, Y] = [x / GRAIN, y / GRAIN];
      if (land[i] === 0) continue;
      const k = owner[i] < 0 ? 0 : owner[i];
      const [low, high, dark, light] = PAL[k];
      const ll = projection.invert([(x + 0.5) / SCALE, (y + 0.5) / SCALE]);
      let col = low;
      let lit = 0.5;
      if (ll && Number.isFinite(ll[0])) {
        const e = REGIONS[k] === "antarctica" ? 0 : sample(elev, 1, ll[0], ll[1]);
        lit = sample(shadeSoft, 1 / 255, ll[0], ll[1]);
        // The terrain tiles stop at 85°: flat, unshaded ice towards the poles rather than their last row repeated.
        lit += (0.5 - lit) * smoothstep(76, 84, Math.abs(ll[1]));
        col = mix(low, high, smoothstep(150, 2800, e) * 0.85);
      }
      // Shadows towards the continent's shade, lit slopes towards its light: soft, never black or white.
      col = lit < 0.5 ? mix(col, dark, (0.5 - lit) * 2 * 0.85) : mix(col, light, (lit - 0.5) * 2 * 0.6);
      // Painted grain: broad tonal washes and a finer brush texture.
      const wash = fbm(11 + k, X / 90, Y / 90, [[1, 1], [2, 0.5]]) - 0.5;
      const brush = fbm(31 + k, X / 7, Y / 3.5, [[1, 1], [2.3, 0.6], [5, 0.3]]) - 0.5;
      col = col.map((v) => v * (1 + wash * 0.14 + brush * 0.07));
      col = mix(col, wash > 0 ? light : dark, Math.abs(wash) * 0.18);
      // The light coastal rim.
      const rim = clamp((255 - rimNear[i]) / 255 / 0.45) * (land[i] / 255);
      col = mix(col, [255, 255, 255], rim * 0.32);
      const o = i * 4;
      out[o] = clamp(col[0], 0, 255);
      out[o + 1] = clamp(col[1], 0, 255);
      out[o + 2] = clamp(col[2], 0, 255);
      out[o + 3] = land[i];
    }
  const info = await sharp(out, { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 82, alphaQuality: 90, effort: 6 }).toFile(`${OUT}land.webp`);
  console.log(`land.webp ${W}×${H}, ${(info.size / 1024).toFixed(0)} KiB`);
}

// --- Water: bright turquoise across the whole flat map, a little deeper in the open ocean, lighter over
// the shelves and pale by the coasts, with soft horizontal brush strokes and broad, slow swells of
// lighter and deeper tone. Nothing follows the map's centre or edges: a flat atlas map, not a globe.
{
  const near = await blur(land, 2.2 * SCALE);
  const shelf = await blur(land, 9 * SCALE);
  const far = await blur(land, 26 * SCALE);
  const deep = hex("#1d9fdc");
  const mid = hex("#2cbbe9");
  const shallow = hex("#56d3ef");
  const coast = hex("#a6eef6");
  const out = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const [X, Y] = [x / GRAIN, y / GRAIN];
      const swell = fbm(5, X / 300, Y / 220, [[1, 1], [2, 0.5]]) - 0.5;
      let col = mix(deep, mid, clamp(0.5 + swell * 1.8));
      col = mix(col, shallow, clamp((far[i] / 255) * 2.2) * 0.55);
      col = mix(col, shallow, clamp((shelf[i] / 255) * 2.6) * 0.7);
      col = mix(col, coast, clamp((near[i] / 255) * 2.4) * 0.85);
      const stroke = fbm(7, X / 26, Y / 6, [[1, 1], [2.1, 0.55], [4.3, 0.3]]) - 0.5;
      const wash = fbm(3, X / 140, Y / 110, [[1, 1], [2, 0.5]]) - 0.5;
      col = col.map((c) => c * (1 + stroke * 0.08 + wash * 0.08));
      // Broad lighter patches of turquoise, as a wash of paint leaves them.
      col = mix(col, shallow, clamp(wash * 2.4) * 0.45);
      const o = i * 4;
      out[o] = clamp(col[0], 0, 255);
      out[o + 1] = clamp(col[1], 0, 255);
      out[o + 2] = clamp(col[2], 0, 255);
      out[o + 3] = 255;
    }
  const info = await sharp(out, { raw: { width: W, height: H, channels: 4 } }).removeAlpha().webp({ quality: 78, effort: 6 }).toFile(`${OUT}water.webp`);
  console.log(`water.webp ${W}×${H}, ${(info.size / 1024).toFixed(0)} KiB`);
}
