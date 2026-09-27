// Generates the Discover map's tileable surface textures (src/assets/map/).
//   node scripts/generate-map-textures.mjs
// They are purely decorative colour variation (periodic value noise), not
// elevation or land-cover data. Uses sharp, which Next.js already installs.
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const sharp = createRequire(import.meta.url)("sharp");
const OUT = new URL("../src/assets/map/", import.meta.url);
mkdirSync(OUT, { recursive: true });

/** Deterministic lattice value in [0, 1). */
function lattice(seed, x, y) {
  let h = (seed * 374761393 + x * 668265263 + y * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const smooth = (t) => t * t * (3 - 2 * t);

/** Value noise that tiles with `period` cells across the texture. */
function noise(seed, u, v, periodX, periodY) {
  const x = u * periodX;
  const y = v * periodY;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = smooth(x - x0);
  const fy = smooth(y - y0);
  const at = (i, j) => lattice(seed, ((i % periodX) + periodX) % periodX, ((j % periodY) + periodY) % periodY);
  const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * fx;
  const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * fx;
  return a + (b - a) * fy;
}

/** Fractal noise from `octaves` [periodX, periodY, weight], normalised to about [0, 1]. */
function fbm(seed, u, v, octaves) {
  let sum = 0;
  let total = 0;
  octaves.forEach(([px, py, w], i) => {
    sum += noise(seed + i * 17, u, v, px, py) * w;
    total += w;
  });
  return sum / total;
}

async function texture(name, size, pixel) {
  const data = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x / size, y / size);
      const i = (y * size + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = Math.round(Math.max(0, Math.min(1, a)) * 255);
    }
  await sharp(data, { raw: { width: size, height: size, channels: 4 } })
    .webp({ quality: 82, alphaQuality: 80 })
    .toFile(new URL(`${name}.webp`, OUT).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
  console.log(`${name}.webp`);
}

// Land: soft, irregular watercolour patches, lighter (sunlit) and deeper (lush) green.
await texture("land-texture", 256, (u, v) => {
  const n = fbm(3, u, v, [
    [3, 3, 1],
    [6, 6, 0.55],
    [12, 12, 0.3],
    [24, 24, 0.14],
  ]);
  const d = (n - 0.5) * 2.4;
  return d > 0 ? [255, 255, 236, Math.min(0.42, d * 0.5)] : [52, 128, 44, Math.min(0.3, -d * 0.38)];
});

// Water: faint lighter streaks, stretched horizontally, and a gentle deeper mottle.
await texture("sea-texture", 256, (u, v) => {
  const streak = fbm(11, u, v, [
    [2, 8, 1],
    [4, 16, 0.5],
  ]);
  const mottle = fbm(29, u, v, [
    [3, 3, 1],
    [6, 6, 0.4],
  ]);
  const light = Math.max(0, (streak - 0.55) * 2.2);
  if (light > 0.02) return [255, 255, 255, Math.min(0.22, light * 0.5)];
  const deep = Math.max(0, (0.5 - mottle) * 2);
  return [14, 120, 170, Math.min(0.2, deep * 0.3)];
});
