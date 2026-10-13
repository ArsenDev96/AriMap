// Paints the Quick Challenge's own landscape (relief and forests) over its whole map of Europe
// (src/data/geo/europe-challenge.topo.json, `frame.coverage`), with the levels' painting and their whole-map
// look (scripts/generate-relief.mjs, its "overview" level), so no level's images change:
//   src/assets/map/challenge/europe-land.webp, europe-tone.webp   (half a pixel per world unit: loaded before Start)
//   public/relief-challenge/<hash>/<family>/<col>-<row>.webp       (a pixel per unit, in 256-unit tiles on the levels'
//                                                                   level-2 grid: loaded only for a zoomed-in view)
//   public/relief-challenge-l2/<hash>/<family>/<col>-<row>.webp    (the levels' level-2 painting, two pixels per unit,
//                                                                   in the same cells where the levels have no level-2
//                                                                   tile: loaded only for a deep zoom)
//   src/assets/map/challenge-relief.json                            (placement and tile manifest)
//
//   node scripts/generate-challenge-relief.mjs           (everything)
//   node scripts/generate-challenge-relief.mjs --l2      (the level-2 tiles only; the rest is kept as it is)
//
// Same data and caches as the levels' relief (Terrarium elevation at zoom 7, and 8 for level 2; ESA WorldCover
// tree cover at its overview 5). The map is painted in overlapping blocks, so memory stays small; the blocks
// overlap by more than any blur reaches, so they meet without seams (with each other and with the levels' tiles).
// See docs/TERRAIN.md, "Quick Challenge".
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { LEVELS, TILE_PX, encode, fetchTile, imagerySources, maxAlpha, paintLevel, projection, wcTile } from "./generate-relief.mjs";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const root = new URL("..", import.meta.url);
const file = (rel) => new URL(rel, root).pathname.replace(/^\/([A-Za-z]:)/, "$1");

const challenge = JSON.parse(readFileSync(file("src/data/geo/europe-challenge.topo.json"), "utf8"));
const relief = JSON.parse(readFileSync(file("src/assets/map/relief.json"), "utf8"));

// The challenge's data is in the levels' projection (prepare-challenge-geo.mjs writes it): checked, so the
// painting lines up with its shapes and with the levels' tiles.
const p = challenge.projection;
if (Math.abs(p.scale - projection.scale()) > 1e-3 || p.translate.some((v, k) => Math.abs(v - projection.translate()[k]) > 1e-3))
  throw new Error("The challenge's projection is not the levels'");

// Tiles of 256 units on the levels' level-2 grid (relief.json), so each lines up with a level-2 tile: the map draws
// the level-2 tile where there is one, and this one elsewhere (Relief.tsx).
const l2 = relief.levels.find((level) => level.name === "l2");
const TILE = l2.tileWorld;
const [[cx0, cy0], [cx1, cy1]] = challenge.frame.coverage;
const origin = [l2.origin[0] - Math.ceil((l2.origin[0] - cx0) / TILE) * TILE, l2.origin[1] - Math.ceil((l2.origin[1] - cy0) / TILE) * TILE];
const cols = Math.ceil((cx1 - origin[0]) / TILE);
const rows = Math.ceil((cy1 - origin[1]) / TILE);
const [W, H] = [cols * TILE, rows * TILE];
console.log(`challenge relief: ${cols}×${rows} tiles, ${W}×${H} units from (${origin})`);

// The levels' whole-map painting, at a pixel per unit.
const level = LEVELS.find((l) => l.name === "overview");
if (level.px !== 1) throw new Error("Expected the overview level at a pixel per unit");

/**
 * The points a block's painting samples (every pixel's centre, at `px` pixels per unit), as lon/lat. The levels'
 * samplers (generate-relief.mjs) fetch every tile in the lon/lat box round an area's corners; the challenge's map
 * reaches within 160 km of the North Pole, where that box spans every longitude, so these fetch only the tiles
 * the block's own points fall in.
 */
function blockPoints(area, px = 1) {
  const points = [];
  const [W, H] = [Math.round((area.x1 - area.x0) * px), Math.round((area.y1 - area.y0) * px)];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) points.push(projection.invert([area.x0 + (i + 0.5) / px, area.y0 + (j + 0.5) / px]));
  return points;
}

/** Elevation (metres, sea clamped to 0) from Terrarium tiles at zoom z, bilinear, as elevationSource in generate-relief.mjs. */
async function sparseElevation(z, points) {
  const n = 2 ** z;
  const TILE_SIZE = 256;
  const tileX = (lon) => ((lon + 180) / 360) * n;
  const tileY = (lat) => ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * n;
  // Terrarium stops at 85.05°N; the map's land does too (north of it is the Arctic Ocean, flat at sea level).
  const MAX_LAT = 85;
  const wanted = new Set();
  for (const [lon, lat] of points) {
    if (Math.abs(lat) > MAX_LAT) continue;
    const [tx, ty] = [Math.floor(tileX(lon)), Math.floor(tileY(lat))];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (ty + dy >= 0 && ty + dy < n) wanted.add(`${(tx + dx + n) % n},${ty + dy}`);
  }
  const tiles = new Map();
  const jobs = [...wanted];
  const worker = async () => {
    for (let job = jobs.pop(); job; job = jobs.pop()) {
      const [tx, ty] = job.split(",").map(Number);
      // fetchTile retries an HTTP error; a dropped connection is retried here too.
      let path;
      for (let attempt = 0; !path; attempt++) {
        try {
          path = await fetchTile(z, tx, ty);
        } catch (error) {
          if (attempt === 3) throw error;
        }
      }
      const { data, info } = await sharp(path).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const metres = new Float32Array(TILE_SIZE * TILE_SIZE);
      for (let k = 0; k < metres.length; k++) {
        const o = k * info.channels;
        metres[k] = Math.max(0, data[o] * 256 + data[o + 1] + data[o + 2] / 256 - 32768);
      }
      tiles.set(job, metres);
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  console.log(`  elevation z${z}: ${tiles.size} tiles`);
  const at = (gx, gy) => {
    const [tx, ty] = [Math.floor(gx / TILE_SIZE), Math.floor(gy / TILE_SIZE)];
    const tile = tiles.get(`${(tx + n) % n},${ty}`);
    return tile ? tile[(gy - ty * TILE_SIZE) * TILE_SIZE + (gx - tx * TILE_SIZE)] : 0;
  };
  return (lon, lat) => {
    if (Math.abs(lat) > MAX_LAT) return 0;
    const x = tileX(lon) * TILE_SIZE - 0.5;
    const y = tileY(lat) * TILE_SIZE - 0.5;
    const [x0, y0] = [Math.floor(x), Math.floor(y)];
    const [fx, fy] = [x - x0, y - y0];
    return (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy;
  };
}

/** Tree cover (1 or 0, nearest) from ESA WorldCover at overview `ov`, as treeSource in generate-relief.mjs. */
async function sparseTrees(ov, points) {
  const wanted = new Set();
  for (const [lon, lat] of points) {
    // A little round each point, for the forest share's samples within a pixel.
    for (const [dlon, dlat] of [[0, 0], [-0.05, 0], [0.05, 0], [0, -0.05], [0, 0.05]]) {
      const [a, b] = [lat + dlat, lon + dlon];
      if (Math.abs(a) < 84) wanted.add(`${Math.floor(a / 3) * 3},${Math.floor(b / 3) * 3}`);
    }
  }
  const tiles = new Map();
  const jobs = [...wanted];
  const worker = async () => {
    for (let job = jobs.pop(); job; job = jobs.pop()) {
      const [lat, lon] = job.split(",").map(Number);
      tiles.set(job, await wcTile(lat, lon, ov));
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  console.log(`  tree cover ov${ov}: ${[...tiles.values()].filter(Boolean).length} of ${tiles.size} tiles have land`);
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

// With --l2, only the level-2 tiles (below) are painted, and everything else is kept.
const onlyL2 = process.argv.includes("--l2");
const MARGIN = 32;

if (!onlyL2) {
  // The whole map, painted block by block (BLOCK units, MARGIN more on each side for the blurs).
  const BLOCK = 1024;
  const land = new Uint8Array(W * H * 4);
  const tone = new Uint8Array(W * H * 4);
  for (let by = 0; by < H; by += BLOCK)
    for (let bx = 0; bx < W; bx += BLOCK) {
      const [w, h] = [Math.min(BLOCK, W - bx), Math.min(BLOCK, H - by)];
      const area = { x0: origin[0] + bx - MARGIN, y0: origin[1] + by - MARGIN, x1: origin[0] + bx + w + MARGIN, y1: origin[1] + by + h + MARGIN };
      console.log(`block (${bx}, ${by})`);
      const points = blockPoints(area);
      const painted = paintLevel(level, area, await sparseElevation(7, points), await sparseTrees(level.wcOverview, points));
      const out = { land: new Float32Array(4), tone: new Float32Array(4) };
      for (let j = 0; j < h; j++)
        for (let i = 0; i < w; i++) {
          painted.pixel(i + MARGIN, j + MARGIN, out, 0);
          const o = ((by + j) * W + bx + i) * 4;
          for (let k = 0; k < 4; k++) {
            land[o + k] = Math.max(0, Math.min(255, Math.round(out.land[k])));
            tone[o + k] = Math.max(0, Math.min(255, Math.round(out.tone[k])));
          }
        }
    }

  // The overview: the whole map at half a pixel per unit (sharp averages with the alpha premultiplied).
  const ASSETS = file("src/assets/map/challenge/");
  rmSync(ASSETS, { recursive: true, force: true });
  mkdirSync(ASSETS, { recursive: true });
  const half = (rgba) =>
    sharp(Buffer.from(rgba.buffer), { raw: { width: W, height: H, channels: 4 } })
      .resize(W / 2, H / 2, { kernel: "lanczos3" })
      .webp({ quality: 72, alphaQuality: 50, effort: 6 })
      .toBuffer();
  const overview = {};
  for (const [family, rgba] of [
    ["land", land],
    ["tone", tone],
  ]) {
    const buf = await half(rgba);
    writeFileSync(`${ASSETS}europe-${family}.webp`, buf);
    overview[family] = { x: origin[0], y: origin[1], width: W, height: H, bytes: buf.length };
    console.log(`overview ${family}: ${W / 2}×${H / 2}px, ${buf.length} B`);
  }

  // The tiles: every one with visible relief (sea and flat lowland are left out, as for the levels).
  const tiles = { px: 1, minDensity: 0.6, tileWorld: TILE, origin, cols, rows, land: [], tone: [], bytes: { land: 0, tone: 0 } };
  const outputs = [];
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++)
      for (const [family, rgba] of [
        ["land", land],
        ["tone", tone],
      ]) {
        const tile = new Uint8Array(TILE * TILE * 4);
        for (let j = 0; j < TILE; j++) tile.set(rgba.subarray(((row * TILE + j) * W + col * TILE) * 4, ((row * TILE + j) * W + (col + 1) * TILE) * 4), j * TILE * 4);
        if (maxAlpha(tile) < 3) continue;
        const buf = await encode(TILE, TILE, tile);
        outputs.push([`${family}/${col}-${row}.webp`, buf]);
        tiles[family].push(`${col}-${row}`);
        tiles.bytes[family] += buf.length;
      }
  console.log(`tiles: ${tiles.land.length} land (${tiles.bytes.land} B), ${tiles.tone.length} tone (${tiles.bytes.tone} B)`);

  // In a folder named by their content hash, so they can be cached forever.
  const hash = createHash("sha256");
  for (const [path, buf] of outputs) hash.update(path).update(buf);
  const version = hash.digest("hex").slice(0, 10);
  rmSync(file("public/relief-challenge"), { recursive: true, force: true });
  for (const [path, buf] of outputs) {
    const target = file(`public/relief-challenge/${version}/${path}`);
    mkdirSync(target.slice(0, target.lastIndexOf("/")), { recursive: true });
    writeFileSync(target, buf);
  }

  const manifest = {
    version,
    overview,
    tiles,
    source: "Elevation: Terrain Tiles (Mapzen/Tilezen Terrarium), zoom 7. Forests: ESA WorldCover 2021 v200 tree cover, overview 5. Painted as the levels' whole-map overview (scripts/generate-relief.mjs).",
    // Attribution check: the elevation sources named by the tiles used (see docs/TERRAIN.md, "Attribution").
    elevationSources: Object.fromEntries([...imagerySources].sort()),
  };
  writeFileSync(file("src/assets/map/challenge-relief.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(`challenge-relief.json (version ${version})`, manifest.elevationSources);
}

// --- Level 2: the levels' zoomed painting (generate-relief.mjs's "l2": two pixels per unit, elevation at zoom 8,
// finer forests), for a view deeper than the whole-map tiles serve well, from the density at which the levels draw
// their level-2 tiles. Each cell (of the grid above, so a tile of 512 px) where the whole-map tiles have relief and
// the levels have no level-2 tile of that family: where they have one, the map draws theirs (Relief.tsx), painted
// the same way, so the two meet without a seam. Each cell is painted with the margin above, wider than any blur reaches.
{
  const fine = LEVELS.find((l) => l.name === "l2");
  if (fine.minDensity !== l2.minDensity || TILE * fine.px !== TILE_PX) throw new Error("Expected the levels' level 2 at their density and tile size");
  const saved = JSON.parse(readFileSync(file("src/assets/map/challenge-relief.json"), "utf8"));
  const { tiles } = saved;
  if (tiles.tileWorld !== TILE || tiles.origin.some((v, k) => v !== origin[k])) throw new Error("The whole-map tiles' grid has changed; run without --l2");
  const theirs = { land: new Set(l2.land), tone: new Set(l2.tone) };
  const [dc, dr] = [(l2.origin[0] - origin[0]) / TILE, (l2.origin[1] - origin[1]) / TILE];
  const level2 = { px: fine.px, minDensity: fine.minDensity, land: [], tone: [], bytes: { land: 0, tone: 0 } };
  const cells = [...new Set([...tiles.land, ...tiles.tone])].map((k) => k.split("-").map(Number)).sort(([c0, r0], [c1, r1]) => r0 - r1 || c0 - c1);
  // The elevation sources of these tiles only (the whole-map tiles' are in the manifest already).
  imagerySources.clear();
  const outputs = [];
  for (const [col, row] of cells) {
    const key = `${col}-${row}`;
    const families = ["land", "tone"].filter((f) => tiles[f].includes(key) && !theirs[f].has(`${col - dc}-${row - dr}`));
    if (families.length === 0) continue;
    const [x0, y0] = [origin[0] + col * TILE, origin[1] + row * TILE];
    const area = { x0: x0 - MARGIN, y0: y0 - MARGIN, x1: x0 + TILE + MARGIN, y1: y0 + TILE + MARGIN };
    console.log(`level 2: cell ${key}`);
    const points = blockPoints(area, fine.px);
    const painted = paintLevel(fine, area, await sparseElevation(8, points), await sparseTrees(fine.wcOverview, points));
    const out = { land: new Float32Array(TILE_PX * TILE_PX * 4), tone: new Float32Array(TILE_PX * TILE_PX * 4) };
    for (let j = 0; j < TILE_PX; j++) for (let i = 0; i < TILE_PX; i++) painted.pixel(i + MARGIN * fine.px, j + MARGIN * fine.px, out, (j * TILE_PX + i) * 4);
    for (const family of families) {
      if (maxAlpha(out[family]) < 3) continue;
      const buf = await encode(TILE_PX, TILE_PX, out[family]);
      outputs.push([`${family}/${key}.webp`, buf]);
      level2[family].push(key);
      level2.bytes[family] += buf.length;
    }
  }
  console.log(`level 2: ${level2.land.length} land (${level2.bytes.land} B), ${level2.tone.length} tone (${level2.bytes.tone} B)`);
  const hash = createHash("sha256");
  for (const [path, buf] of outputs) hash.update(path).update(buf);
  level2.version = hash.digest("hex").slice(0, 10);
  rmSync(file("public/relief-challenge-l2"), { recursive: true, force: true });
  for (const [path, buf] of outputs) {
    const target = file(`public/relief-challenge-l2/${level2.version}/${path}`);
    mkdirSync(target.slice(0, target.lastIndexOf("/")), { recursive: true });
    writeFileSync(target, buf);
  }
  level2.source = "Elevation: Terrain Tiles (Mapzen/Tilezen Terrarium), zoom 8. Forests: ESA WorldCover 2021 v200 tree cover, overview 5. Painted as the levels' level 2 (scripts/generate-relief.mjs).";
  level2.elevationSources = Object.fromEntries([...imagerySources].sort());
  writeFileSync(file("src/assets/map/challenge-relief.json"), JSON.stringify({ ...saved, l2: level2 }, null, 2) + "\n");
  console.log(`challenge-relief.json: level 2 (version ${level2.version})`, level2.elevationSources);
}
