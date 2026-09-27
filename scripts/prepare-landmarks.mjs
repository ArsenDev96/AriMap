// Prepares display copies of the landmark illustrations.
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
import sharp from "sharp";
import { mkdirSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const SOURCE = resolve("public/images/landmarks");
const OUTPUT = resolve("src/assets/landmarks");
/** Pixels at or below this alpha are background-removal noise, invisible on the card. */
const ALPHA_THRESHOLD = 32;
/** Transparent margin kept around the artwork, as a fraction of its longer side. */
const MARGIN = 0.02;
/** Longest side of the display copy (≈ 3× the largest on-screen size). */
const MAX_SIZE = 720;

mkdirSync(OUTPUT, { recursive: true });

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
}
