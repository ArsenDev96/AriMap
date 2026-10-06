// Prepares display copies of the landmark illustrations, and thumbnails of the
// ones on the level selection's cards.
//
// Usage: node scripts/prepare-landmarks.mjs
//
// Reads the supplied originals in public/images/landmarks/ (kept unchanged) and
// writes trimmed, downsized lossless WebP copies to src/assets/landmarks/,
// which the app imports statically so next/image serves resized versions.
//
// The originals are 1254×1254 with very different amounts of transparent
// padding (the bridge uses only ~55% of the height, the tower ~97%). Trimming
// each image to its visible artwork lets every card size the art the same way
// with object-fit: contain. See docs/CONTENT.md.
//
// The level cards' pictures also get a thumbnail in src/assets/landmarks/thumbnails/,
// with the same trim, served as it is (no image service), so a card downloads a
// few KB instead of the whole display copy.
import sharp from "sharp";
import { mkdirSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const SOURCE = resolve("public/images/landmarks");
const OUTPUT = resolve("src/assets/landmarks");
const THUMBNAIL_OUTPUT = join(OUTPUT, "thumbnails");
/** Pixels at or below this alpha are background-removal noise, invisible on the card. */
const ALPHA_THRESHOLD = 32;
/** Transparent margin kept around the artwork, as a fraction of its longer side. */
const MARGIN = 0.02;
/** Longest side of the display copy (≈ 3× the largest on-screen size). */
const MAX_SIZE = 720;
/** The level cards' pictures (LEVEL_ART_COUNTRY in src/components/WelcomeScreen.tsx, by illustration). */
const THUMBNAILS = new Set([
  "eiffel-tower",
  "chapel-bridge",
  "charles-bridge",
  "dubrovnik-city-walls",
  "meteora",
  "trakai-island-castle",
  "sagrada-familia",
  "bran-castle",
]);
/** Longest side of a thumbnail: the card's tile draws the art at most 52 CSS px, at up to 3× pixel density. */
const THUMBNAIL_SIZE = 156;

mkdirSync(OUTPUT, { recursive: true });
mkdirSync(THUMBNAIL_OUTPUT, { recursive: true });

for (const file of readdirSync(SOURCE).filter((f) => f.endsWith(".png")).sort()) {
  const input = join(SOURCE, file);
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * channels + 3] > ALPHA_THRESHOLD) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) throw new Error(`${file}: no visible pixels`);

  const margin = Math.round(Math.max(x1 - x0 + 1, y1 - y0 + 1) * MARGIN);
  const left = Math.max(0, x0 - margin);
  const top = Math.max(0, y0 - margin);
  const region = {
    left,
    top,
    width: Math.min(width, x1 + 1 + margin) - left,
    height: Math.min(height, y1 + 1 + margin) - top,
  };

  const output = join(OUTPUT, file.replace(/\.png$/, ".webp"));
  // Lossless, so next/image's own encoding is the only lossy step.
  const result = await sharp(input)
    .extract(region)
    .resize({ width: MAX_SIZE, height: MAX_SIZE, fit: "inside", withoutEnlargement: true })
    .webp({ lossless: true, effort: 6 })
    .toFile(output);
  console.log(
    `${file}: ${width}×${height} → artwork ${region.width}×${region.height} at (${left}, ${top}) → ${result.width}×${result.height}, ${(result.size / 1024).toFixed(0)} KiB`,
  );

  const key = file.replace(/\.png$/, "");
  if (!THUMBNAILS.has(key)) continue;
  // From the original, in one resize. Near-lossless: transparent and opaque pixels stay so, soft
  // edges and colours move by a few levels (invisible at the drawn size), at about half the size of
  // lossless (lossy WebP's halved colour resolution blurs the outlines at 3×).
  const thumbnail = await sharp(input)
    .extract(region)
    .resize({ width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE, fit: "inside", withoutEnlargement: true })
    .webp({ nearLossless: true, quality: 40, effort: 6 })
    .toFile(join(THUMBNAIL_OUTPUT, `${key}.webp`));
  console.log(`  thumbnail: ${thumbnail.width}×${thumbnail.height}, ${(thumbnail.size / 1024).toFixed(1)} KiB`);
}

const missing = [...THUMBNAILS].filter((key) => !readdirSync(SOURCE).includes(`${key}.png`));
if (missing.length) throw new Error(`No original for the thumbnails of: ${missing.join(", ")}`);
