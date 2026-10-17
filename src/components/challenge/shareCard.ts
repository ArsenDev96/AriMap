import type { ShareText } from "@/core/challenge/share";
import { qrCode } from "./qrCode";

/**
 * The Quick Challenge's shared result card, drawn as a PNG in the browser on a canvas over the postcard template
 * (public/images/share/quick-challenge-postcard-template.png: the illustrated map, the logo's icon, the scenery, the
 * ticket, its gold underline and stopwatch, and the gold pill, all painted in it). Over it, only words and the QR code:
 * the name and title in the top cream; the score, "Countries found" and the round's time on the ticket; the card's
 * invitation ("Your turn!") and a QR code to the site in the cream at the bottom right; the site's address in the pill. Its words
 * come from src/core/challenge/share.ts, in the language they were made in. No library: the canvas, the page's own
 * fonts, the template and qrCode.ts. See docs/QUICK-CHALLENGE-SHARING.md.
 */

/** Portrait, 4:5: fills a phone's share preview and most feeds without cropping. */
export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;

const TEMPLATE = "/images/share/quick-challenge-postcard-template.png";

/**
 * Where the words go, in the template's own pixels (1122 × 1402), measured from it: each blank area's edges, and the
 * painted marks the words line up with. Font sizes are in the same pixels; the card scales them with the template.
 */
const SPOTS = {
  /**
   * Beside the logo's icon (84–206 × 38–154), to the torn edge of the top cream; over a title on two lines (Armenian's),
   * a little smaller and higher, so both lines fit above the cream's torn foot with a clear gap under the name.
   */
  name: { x: 228, right: 680, baseline: 120, size: 104, wrappedBaseline: 106, wrappedSize: 88 },
  /**
   * Under the name, to where the cream's torn edge turns down (x 700); its torn foot is at about y 214–238. On two lines,
   * the first `gap` under the name's lowest point, the second `step` (a share of the size) below it.
   */
  title: { x: 230, right: 700, baseline: 172, size: 33, gap: 12, step: 0.98 },
  /** The ticket's gold underline, from its left end to its right (it rises a little: the ticket is turned). */
  underline: { from: [110, 1168], to: [575, 1153] },
  /** The score on the underline, clear of the postmark (505–615 × 925–1015). */
  score: { x: 118, right: 488, above: 22, big: 215, small: 108, gap: 8 },
  /** Under the underline, across the ticket. */
  caption: { x: 120, right: 585, baseline: 1220, size: 34 },
  /** Beside the stopwatch (124–192 × 1248–1329), level with its dial's centre. */
  time: { x: 212, right: 585, middle: 1297, size: 46 },
  /**
   * The cream at the bottom right, above the pill (its torn top slopes from about y 1150 on the right to 1200 at its
   * left end, at x 645): the invitation, then the QR code at its right, rising a little over the scenery above. The
   * invitation is centred in the cream left of the QR code, `inset` in from its sides, so no line runs to its edges.
   */
  invitation: { x: 658, top: 1170, bottom: 1293, size: 64, inset: 18 },
  qr: { right: 1104, bottom: 1293, gap: 12 },
  /** The gold pill (687–1067 × 1304–1367). */
  pill: { x0: 687, x1: 1067, middle: 1336, size: 38 },
} as const;

/** The invitation's line spacing, as a share of its size. */
const LINE = 1.06;
/** The QR code's size on the card (px), its light square and quiet zone included. */
const QR_SIZE = 180;
/** The quiet zone round the QR code's modules, in modules: the standard's four. */
const QR_QUIET = 4;

/** The palette (globals.css), fixed here so the image never follows a page style. */
const C = {
  ink: "#1f3a5f",
  inkSoft: "#52627f",
  coral: "#e85b45",
  qrLight: "#ffffff",
} as const;

/** Longest a font's load is waited for: offline, the card is drawn in the fallback fonts rather than never. */
const FONT_WAIT_MS = 5000;

export interface ShareCard {
  blob: Blob;
  width: number;
  height: number;
}

/** Draws the card for `text`, once the fonts its words need (Armenian's included) and the template have loaded. */
export async function renderShareCard(text: ShareText): Promise<ShareCard> {
  // The page's own stack (globals.css --font, its var() resolved): Nunito, then Noto Sans Armenian for Armenian letters.
  const family = getComputedStyle(document.documentElement).getPropertyValue("--font").trim() || "Nunito, system-ui, sans-serif";
  // English's title and caption in spaced capitals; Armenian's in its own case, lightly spaced (ShareText's `capitals`).
  const title = text.capitals ? text.title.toUpperCase() : text.title;
  const caption = text.capitals ? text.caption.toUpperCase() : text.caption;
  const words = [text.appName, title, text.score, caption, text.time, text.turn, text.host].join(" ");
  await within(FONT_WAIT_MS, Promise.all([900, 800].map((weight) => document.fonts.load(`${weight} 48px ${family}`, words))).then(() => document.fonts.ready));
  const template = await loadImage(TEMPLATE);

  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2D canvas");
  const font = (weight: number, size: number) => `${weight} ${size}px ${family}`;

  // The template, scaled evenly to cover the card and centred (it is 4:5 within a fraction of a pixel).
  const s = Math.max(CARD_WIDTH / template.naturalWidth, CARD_HEIGHT / template.naturalHeight);
  const [ox, oy] = [(CARD_WIDTH - template.naturalWidth * s) / 2, (CARD_HEIGHT - template.naturalHeight * s) / 2];
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(template, ox, oy, template.naturalWidth * s, template.naturalHeight * s);
  const X = (x: number) => ox + x * s;
  const Y = (y: number) => oy + y * s;

  // --- The top cream: the name beside the logo's icon, the title under it (on two lines, if it would otherwise be
  // drawn noticeably smaller: Armenian's; the name is then a little smaller and higher, with a clear gap under it).
  ctx.fillStyle = C.ink;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const t = SPOTS.title;
  const titleSpacing = (text.capitals ? 2 : 0.5) * s;
  const titleBlock = wrap(ctx, title, 900, (text.capitals ? t.size : t.size + 3) * s, (t.right - t.x) * s, family, titleSpacing);
  const wrapped = titleBlock.lines.length > 1;
  const name = SPOTS.name;
  ctx.font = font(900, fit(ctx, text.appName, 900, (wrapped ? name.wrappedSize : name.size) * s, (name.right - name.x) * s, family));
  const nameBaseline = Y(wrapped ? name.wrappedBaseline : name.baseline);
  const nameDescent = ctx.measureText(text.appName).actualBoundingBoxDescent;
  ctx.fillText(text.appName, X(name.x), nameBaseline);
  ctx.font = font(900, titleBlock.size);
  ctx.letterSpacing = `${titleSpacing}px`;
  const firstBaseline = wrapped ? nameBaseline + nameDescent + t.gap * s + ctx.measureText(titleBlock.lines[0]).actualBoundingBoxAscent : Y(t.baseline);
  titleBlock.lines.forEach((line, i) => ctx.fillText(line, X(t.x), firstBaseline + titleBlock.size * t.step * i));
  ctx.letterSpacing = "0px";

  // --- The ticket, turned as its underline is: the score on the underline, the caption under it, the time by the
  // stopwatch. Drawn in the ticket's own frame, from the underline's left end.
  const [[ux0, uy0], [ux1, uy1]] = [SPOTS.underline.from, SPOTS.underline.to];
  const turn = Math.atan2(uy1 - uy0, ux1 - ux0);
  /** A template point in the ticket's frame (card px, from the underline's left end, along it). */
  const onTicket = (x: number, y: number) => {
    const [dx, dy] = [(x - ux0) * s, (y - uy0) * s];
    return [dx * Math.cos(turn) + dy * Math.sin(turn), -dx * Math.sin(turn) + dy * Math.cos(turn)] as const;
  };
  ctx.save();
  ctx.translate(X(ux0), Y(uy0));
  ctx.rotate(turn);

  // The score: the correct answers large and dark, "/15" smaller and softer, on one baseline.
  const sc = SPOTS.score;
  const [correct, total] = text.score.split("/");
  const denominator = `/${total}`;
  let [big, small] = [sc.big * s, sc.small * s];
  ctx.font = font(900, big);
  let bigWidth = ctx.measureText(correct).width;
  ctx.font = font(900, small);
  const scoreWidth = bigWidth + sc.gap * s + ctx.measureText(denominator).width;
  const scoreRoom = (sc.right - sc.x) * s;
  if (scoreWidth > scoreRoom) {
    [big, small, bigWidth] = [(big * scoreRoom) / scoreWidth, (small * scoreRoom) / scoreWidth, (bigWidth * scoreRoom) / scoreWidth];
  }
  const [scoreX] = onTicket(sc.x, uy0);
  const scoreBaseline = -sc.above * s;
  ctx.fillStyle = C.ink;
  ctx.font = font(900, big);
  ctx.fillText(correct, scoreX, scoreBaseline);
  ctx.fillStyle = C.inkSoft;
  ctx.font = font(900, small);
  ctx.fillText(denominator, scoreX + bigWidth + sc.gap * s, scoreBaseline);

  // The caption.
  const cap = SPOTS.caption;
  const captionSpacing = (text.capitals ? 3 : 0.5) * s;
  const [captionX, captionY] = onTicket(cap.x, cap.baseline);
  ctx.fillStyle = C.ink;
  ctx.font = font(900, fit(ctx, caption, 900, (text.capitals ? cap.size : cap.size + 3) * s, (cap.right - cap.x) * s, family, captionSpacing));
  ctx.letterSpacing = `${captionSpacing}px`;
  ctx.fillText(caption, captionX, captionY);
  ctx.letterSpacing = "0px";

  // The round's time.
  const tm = SPOTS.time;
  const [timeX, timeY] = onTicket(tm.x, tm.middle);
  ctx.textBaseline = "middle";
  ctx.font = font(900, fit(ctx, text.time, 900, tm.size * s, (tm.right - tm.x) * s, family));
  ctx.fillText(text.time, timeX, timeY + 2 * s);
  ctx.restore();

  // --- The bottom right: the QR code over the cream's right, above the pill, and the invitation beside it.
  const q = SPOTS.qr;
  const qrX = Math.round(X(q.right) - QR_SIZE);
  const qrY = Math.round(Y(q.bottom) - QR_SIZE);
  drawQr(ctx, text.url, qrX, qrY, QR_SIZE);

  const inv = SPOTS.invitation;
  const area = { x: X(inv.x), right: qrX - q.gap * s, top: Y(inv.top), bottom: Y(inv.bottom) };
  const invite = stack(ctx, text.turn, 900, inv.size * s, area.right - area.x - 2 * inv.inset * s, area.bottom - area.top, family);
  const lineHeight = invite.size * LINE;
  const blockTop = (area.top + area.bottom) / 2 - (lineHeight * invite.lines.length) / 2;
  ctx.fillStyle = C.coral;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = font(900, invite.size);
  invite.lines.forEach((line, i) => ctx.fillText(line, (area.x + area.right) / 2, blockTop + lineHeight * (i + 0.5)));

  // --- The site's address in the pill.
  const p = SPOTS.pill;
  ctx.fillStyle = C.ink;
  ctx.font = font(800, fit(ctx, text.host, 800, p.size * s, (p.x1 - p.x0 - 56) * s, family));
  ctx.fillText(text.host, X((p.x0 + p.x1) / 2), Y(p.middle) + 1);

  const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/png"));
  if (!blob) throw new Error("The card could not be encoded");
  return { blob, width: CARD_WIDTH, height: CARD_HEIGHT };
}

/**
 * The QR code for `url` at (`x`, `y`), `size` px square: navy modules on a solid white square holding the quiet zone,
 * with rounded corners and a soft shadow, as a sticker on the card. Each module's edges fall on whole pixels, so none
 * is blurred.
 */
function drawQr(ctx: CanvasRenderingContext2D, url: string, x: number, y: number, size: number) {
  const modules = qrCode(url);
  const count = modules.length + 2 * QR_QUIET;
  const edge = (i: number) => Math.round((i * size) / count);
  ctx.save();
  ctx.shadowColor = "rgba(31, 58, 95, 0.22)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 4;
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, 14);
  ctx.fillStyle = C.qrLight;
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = C.ink;
  modules.forEach((row, r) =>
    row.forEach((on, c) => {
      if (!on) return;
      const [x0, x1, y0, y1] = [edge(c + QR_QUIET), edge(c + QR_QUIET + 1), edge(r + QR_QUIET), edge(r + QR_QUIET + 1)];
      ctx.fillRect(x + x0, y + y0, x1 - x0, y1 - y0);
    }),
  );
}

/** The largest size up to `size` at which `text` fits `maxWidth` (never under 60% of it), with `spacing` between letters. */
function fit(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, maxWidth: number, family: string, spacing = 0): number {
  ctx.letterSpacing = `${spacing}px`;
  let found = size * 0.6;
  for (let f = size; f > size * 0.6; f -= 0.5) {
    ctx.font = `${weight} ${f}px ${family}`;
    if (ctx.measureText(text).width - spacing <= maxWidth) {
      found = f;
      break;
    }
  }
  ctx.letterSpacing = "0px";
  return found;
}

/**
 * `text` on one line if it fits `maxWidth` at 90% of `size` or more; otherwise on two lines, broken at the space that
 * allows the largest size, and of those the most balanced.
 */
function wrap(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, maxWidth: number, family: string, spacing = 0) {
  const one = fit(ctx, text, weight, size, maxWidth, family, spacing);
  const words = text.split(" ");
  if (one >= size * 0.9 || words.length < 2) return { size: one, lines: [text] };
  const best = arrangements(words, 2)
    .map((lines) => ({ lines, size: Math.min(...lines.map((line) => fit(ctx, line, weight, size, maxWidth, family, spacing))) }))
    .reduce((a, b) => (b.size > a.size || (b.size === a.size && longest(ctx, b, weight, family) < longest(ctx, a, weight, family)) ? b : a));
  return best.size > one ? best : { size: one, lines: [text] };
}

/**
 * `text` in a box `maxWidth` × `maxHeight`, on as many lines (up to four) as let it be largest (up to `size`): each
 * line within the width, the lines (LINE apart) within the height; of equal sizes, the fewest lines, then the most
 * balanced.
 */
function stack(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, maxWidth: number, maxHeight: number, family: string) {
  const words = text.split(" ");
  let best: { lines: string[]; size: number } | null = null;
  for (let n = 1; n <= Math.min(4, words.length); n++)
    for (const lines of arrangements(words, n)) {
      const f = Math.min(maxHeight / (n * LINE), ...lines.map((line) => fit(ctx, line, weight, size, maxWidth, family)));
      const candidate = { lines, size: Math.floor(f * 2) / 2 };
      if (!best || candidate.size > best.size || (candidate.size === best.size && candidate.lines.length === best.lines.length && longest(ctx, candidate, weight, family) < longest(ctx, best, weight, family)))
        best = candidate;
    }
  return best!;
}

/** Every way to set `words` on `n` lines, in order. */
function arrangements(words: readonly string[], n: number): string[][] {
  if (n === 1) return [[words.join(" ")]];
  const out: string[][] = [];
  for (let i = 1; i <= words.length - n + 1; i++) for (const rest of arrangements(words.slice(i), n - 1)) out.push([words.slice(0, i).join(" "), ...rest]);
  return out;
}

/** The widest of a block's lines at its size. */
function longest(ctx: CanvasRenderingContext2D, block: { lines: readonly string[]; size: number }, weight: number, family: string): number {
  ctx.font = `${weight} ${block.size}px ${family}`;
  return Math.max(...block.lines.map((line) => ctx.measureText(line).width));
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
