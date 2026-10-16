import type { ShareText } from "@/core/challenge/share";
import landArt from "@/assets/map/world/land.webp";
import waterArt from "@/assets/map/world/water.webp";
import { EUROPE_BORDERS } from "@/data/geo/europe-borders";
import { WORLD_GRATICULE, WORLD_MAP_HEIGHT, WORLD_MAP_WIDTH, WORLD_REGIONS } from "@/data/geo/world-map";
import { BRAND_LAND, BRAND_PIN } from "../Header";

/**
 * The Quick Challenge's shared result card, drawn as a PNG in the browser on a canvas: the logo and name, the
 * challenge's label, the home screen card's illustrated Europe (QuickChallenge.tsx's ChallengeArt: the same painted
 * images, outlines and borders), the score, the round's line ("12/15 countries · 60 seconds"), the challenge to
 * beat it and the site's address. Its words come from src/core/challenge/share.ts, in the language they were made in.
 * No library: the canvas, the page's own fonts and images. See docs/QUICK-CHALLENGE-SHARING.md.
 */

/** Portrait, 4:5: fills a phone's share preview and most feeds without cropping. */
export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;

/** The palette (globals.css), fixed here so the image never follows a page style. */
const C = {
  bg: "#fffaf0",
  surface: "#fffdf8",
  ink: "#1f3a5f",
  inkSoft: "#52627f",
  line: "#efe2cb",
  coral: "#e85b45",
  amber: "#ffbb45",
  amberDark: "#c07d05",
  goldSoft: "#fff0c8",
  sea: "#8fd8d6",
  land: "#c4ecd2",
  /** ChallengeArt's own colours (QuickChallenge.module.css). */
  artSea: "#2cbbe9",
  artLand: "#d3ecd5",
} as const;

/** ChallengeArt's frame of Europe, in the world map's units (20°W–40°E, 35°N–73°N). */
const EUROPE_VIEW = { x: 414, y: 47, width: 167, height: 106 };
const BOLT = "M13.5 2 4.5 13.5h6L9.5 22l9-11.5h-6z";
/** Longest a font's load is waited for: offline, the card is drawn in the fallback fonts rather than never. */
const FONT_WAIT_MS = 5000;

const latitudeY = (latitude: number) => WORLD_MAP_HEIGHT / 2 - (latitude * WORLD_MAP_WIDTH) / 360;

export interface ShareCard {
  blob: Blob;
  width: number;
  height: number;
}

/** Draws the card for `text`, once the fonts its words need (Armenian's included) and the map's images have loaded. */
export async function renderShareCard(text: ShareText): Promise<ShareCard> {
  // The page's own stack (globals.css --font, its var() resolved): Nunito, then Noto Sans Armenian for Armenian letters.
  const family = getComputedStyle(document.documentElement).getPropertyValue("--font").trim() || "Nunito, system-ui, sans-serif";
  const words = [text.appName, text.label, text.score, text.found, text.beat, text.host].join(" ");
  await within(FONT_WAIT_MS, Promise.all([900, 800].map((weight) => document.fonts.load(`${weight} 48px ${family}`, words))).then(() => document.fonts.ready));
  const [water, land] = await Promise.all([loadImage(waterArt.src), loadImage(landArt.src)]);

  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2D canvas");
  const font = (weight: number, size: number) => `${weight} ${size}px ${family}`;

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  const pad = 64;
  const inner = CARD_WIDTH - 2 * pad;

  // The logo and the name, and the challenge's label in a gold pill on the right.
  drawBrandMark(ctx, pad, 60, 96);
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = C.ink;
  ctx.font = font(900, fit(ctx, text.appName, 900, 62, 360, family));
  ctx.fillText(text.appName, pad + 96 + 24, 110);
  // The label takes the room the name leaves, at least 72px from it (Armenian's name and label are both longer).
  const nameEnd = pad + 96 + 24 + ctx.measureText(text.appName).width;
  const labelSize = fit(ctx, text.label, 900, 34, CARD_WIDTH - pad - (nameEnd + 72) - (48 + 46), family);
  ctx.font = font(900, labelSize);
  const labelWidth = ctx.measureText(text.label).width;
  const pill = { h: 68, w: labelWidth + 48 + 46 };
  const pillX = CARD_WIDTH - pad - pill.w;
  roundRect(ctx, pillX, 110 - pill.h / 2, pill.w, pill.h, pill.h / 2);
  ctx.fillStyle = C.goldSoft;
  ctx.fill();
  drawBolt(ctx, pillX + 22, 110 - 19, 38);
  ctx.fillStyle = C.ink;
  ctx.fillText(text.label, pillX + 22 + 46, 111);

  // Europe, illustrated.
  drawEurope(ctx, { x: pad, y: 196, width: inner, height: 560 }, water, land);

  // The score, large: the correct answers, then "/15" smaller.
  ctx.textBaseline = "alphabetic";
  const [correct, total] = text.score.split("/");
  ctx.font = font(900, 250);
  const big = ctx.measureText(correct).width;
  ctx.font = font(900, 110);
  const small = ctx.measureText(`/${total}`).width;
  const scoreX = (CARD_WIDTH - big - 14 - small) / 2;
  ctx.fillStyle = C.ink;
  ctx.font = font(900, 250);
  ctx.fillText(correct, scoreX, 1006);
  ctx.fillStyle = C.inkSoft;
  ctx.font = font(900, 110);
  ctx.fillText(`/${total}`, scoreX + big + 14, 1006);

  // The round's line and the challenge, centred.
  ctx.textAlign = "center";
  ctx.fillStyle = C.inkSoft;
  ctx.font = font(800, fit(ctx, text.found, 800, 46, inner, family));
  ctx.fillText(text.found, CARD_WIDTH / 2, 1088);
  ctx.fillStyle = C.coral;
  // Kept 48px in from the card's margins on each side (Armenian's is the longer line; it is drawn a little smaller).
  ctx.font = font(900, fit(ctx, text.beat, 900, 62, inner - 2 * 48, family));
  ctx.fillText(text.beat, CARD_WIDTH / 2, 1182);

  // The site's address in a gold pill at the foot.
  ctx.font = font(800, 40);
  const hostWidth = ctx.measureText(text.host).width;
  const foot = { w: hostWidth + 72, h: 76 };
  roundRect(ctx, (CARD_WIDTH - foot.w) / 2, 1234, foot.w, foot.h, foot.h / 2);
  ctx.fillStyle = C.amber;
  ctx.fill();
  ctx.fillStyle = C.ink;
  ctx.textBaseline = "middle";
  ctx.fillText(text.host, CARD_WIDTH / 2, 1234 + foot.h / 2 + 1);

  const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/png"));
  if (!blob) throw new Error("The card could not be encoded");
  return { blob, width: CARD_WIDTH, height: CARD_HEIGHT };
}

/** The largest size up to `size` at which `text` fits `maxWidth` (never under 60% of it). */
function fit(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, maxWidth: number, family: string): number {
  for (let s = size; s > size * 0.6; s -= 1) {
    ctx.font = `${weight} ${s}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) return s;
  }
  return Math.ceil(size * 0.6);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawBrandMark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 64, size / 64);
  roundRect(ctx, 0, 0, 64, 64, 16);
  ctx.fillStyle = C.sea;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";
  ctx.strokeStyle = C.ink;
  for (const [d, fill] of [
    [BRAND_LAND, C.land],
    [BRAND_PIN, C.coral],
  ] as const) {
    const path = new Path2D(d);
    ctx.fillStyle = fill;
    ctx.fill(path);
    ctx.stroke(path);
  }
  ctx.beginPath();
  ctx.arc(32, 23, 3.6, 0, Math.PI * 2);
  ctx.fillStyle = C.bg;
  ctx.fill();
  ctx.restore();
}

function drawBolt(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  const path = new Path2D(BOLT);
  ctx.fillStyle = C.amber;
  ctx.fill(path);
  ctx.lineWidth = 1.2;
  ctx.lineJoin = "round";
  ctx.strokeStyle = C.amberDark;
  ctx.stroke(path);
  ctx.restore();
}

/**
 * ChallengeArt's Europe in a rounded panel, cropped to fill it: the painted sea, the faint grid, the other continents
 * pale, Europe's painted land clipped to its coast, and its borders as light lines fading out from 61°N (where their
 * data stops, at 62°N).
 */
function drawEurope(ctx: CanvasRenderingContext2D, box: { x: number; y: number; width: number; height: number }, water: HTMLImageElement, land: HTMLImageElement) {
  const v = EUROPE_VIEW;
  const s = Math.max(box.width / v.width, box.height / v.height);
  const tx = box.x + box.width / 2 - (v.x + v.width / 2) * s;
  const ty = box.y + box.height / 2 - (v.y + v.height / 2) * s;
  const px = (n: number) => n / s; // a line width in card pixels, in map units
  const europe = new Path2D(WORLD_REGIONS.europe);

  ctx.save();
  roundRect(ctx, box.x, box.y, box.width, box.height, 44);
  ctx.clip();
  ctx.fillStyle = C.artSea;
  ctx.fillRect(box.x, box.y, box.width, box.height);
  ctx.transform(s, 0, 0, s, tx, ty);
  ctx.drawImage(water, 0, 0, WORLD_MAP_WIDTH, WORLD_MAP_HEIGHT);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
  ctx.lineWidth = px(1.5);
  ctx.stroke(new Path2D(WORLD_GRATICULE));
  for (const region of Object.keys(WORLD_REGIONS) as (keyof typeof WORLD_REGIONS)[]) {
    if (region === "europe") continue;
    const path = new Path2D(WORLD_REGIONS[region]);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
    ctx.lineWidth = px(4);
    ctx.stroke(path);
    ctx.fillStyle = C.artLand;
    ctx.fill(path);
  }
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = px(7);
  ctx.stroke(europe);
  ctx.save();
  ctx.clip(europe);
  ctx.drawImage(land, 0, 0, WORLD_MAP_WIDTH, WORLD_MAP_HEIGHT);
  ctx.restore();
  ctx.restore();

  // The borders on a layer of their own, faded towards the north, then laid on Europe's land.
  const layer = document.createElement("canvas");
  layer.width = CARD_WIDTH;
  layer.height = CARD_HEIGHT;
  const l = layer.getContext("2d");
  if (!l) return;
  l.setTransform(s, 0, 0, s, tx, ty);
  l.clip(europe);
  l.strokeStyle = "rgba(255, 255, 255, 0.75)";
  l.lineWidth = px(2.2);
  l.lineJoin = "round";
  l.lineCap = "round";
  l.stroke(new Path2D(EUROPE_BORDERS));
  l.globalCompositeOperation = "destination-in";
  const fade = l.createLinearGradient(0, latitudeY(64), 0, latitudeY(61));
  fade.addColorStop(0, "rgba(255, 255, 255, 0)");
  fade.addColorStop(1, "#fff");
  l.fillStyle = fade;
  l.fillRect(0, 0, WORLD_MAP_WIDTH, WORLD_MAP_HEIGHT);
  ctx.save();
  roundRect(ctx, box.x, box.y, box.width, box.height, 44);
  ctx.clip();
  ctx.drawImage(layer, 0, 0);
  ctx.restore();

  // A soft white edge, as the home screen's cards have.
  roundRect(ctx, box.x, box.y, box.width, box.height, 44);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.lineWidth = 6;
  ctx.stroke();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = src;
  return image.decode().then(() => image);
}

/** `promise`, or nothing once `ms` have passed (its failure is ignored as well). */
function within(ms: number, promise: Promise<unknown>): Promise<void> {
  return new Promise((done) => {
    const timer = setTimeout(done, ms);
    const finish = () => {
      clearTimeout(timer);
      done();
    };
    promise.then(finish, finish);
  });
}
