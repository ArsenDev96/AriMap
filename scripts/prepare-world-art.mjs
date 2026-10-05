// Prepares display copies of the home screen's painted sky and scenery.
//
// Usage: node scripts/prepare-world-art.mjs
//
// Reads the supplied paintings in src/assets/map/world/ (cloud-corner.png, cloud-bank.png and
// scenery.png, kept unchanged) and writes trimmed, downsized WebP copies with transparency beside
// them (cloud-corner.webp, cloud-bank.webp, scenery.webp), which the home screen sets as CSS images
// (ContinentScreen.tsx). CSS images are served as they are (no next/image), so each copy is sized
// for the largest it is drawn at on a 390px phone at 3× and no larger. The map's own layers
// (land.webp, water.webp) come from scripts/generate-world-art.mjs, which never writes these.
// See docs/DATA.md, "World map (home screen)".
import sharp from "sharp";
import { resolve } from "node:path";

const DIR = resolve("src/assets/map/world");
/** Pixels at or below this alpha are invisible on the sky: trimmed away with the empty margins. */
const ALPHA_THRESHOLD = 4;

/** Each painting and its copy's width: about 3× the widest the page draws it (ContinentScreen.module.css). */
const PAINTINGS = [
  // At the page's top corners, about 240px wide.
  { name: "cloud-corner", width: 720 },
  // Behind the map's lower edge, about 420px wide.
  { name: "cloud-bank", width: 1280 },
  // The foot of the page, its full width (390px; up to 430px on the largest phones).
  { name: "scenery", width: 1280 },
];

for (const { name, width } of PAINTINGS) {
  const input = `${DIR}/${name}.png`;
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let [x0, y0, x1, y1] = [info.width, info.height, -1, -1];
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++)
      if (data[(y * info.width + x) * 4 + 3] > ALPHA_THRESHOLD) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
  if (x1 < 0) throw new Error(`${name}.png: no visible pixels`);
  const region = { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
  const out = `${DIR}/${name}.webp`;
  const result = await sharp(input)
    .extract(region)
    .resize({ width: Math.min(width, region.width) })
    // Soft, painterly art: at 1:1 this quality is indistinguishable from 82 at about half the size.
    .webp({ quality: 65, alphaQuality: 70, effort: 6 })
    .toFile(out);
  console.log(`${name}.webp ${result.width}×${result.height} (from ${info.width}×${info.height}, trimmed to ${region.width}×${region.height}), ${(result.size / 1024).toFixed(0)} KiB`);
}
