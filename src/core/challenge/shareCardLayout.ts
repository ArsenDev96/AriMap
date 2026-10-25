/**
 * The Quick Challenge's shared result card: its size, and where its words and QR code go over the postcard template
 * (public/images/share/quick-challenge-postcard-template-v2.png). Plain numbers, no canvas or React: the website draws
 * the card with them on a canvas (src/components/challenge/shareCard.ts), the app as an SVG (apps/mobile), so both
 * cards are the same. See docs/QUICK-CHALLENGE-SHARING.md.
 */

/** Portrait, 4:5: fills a phone's share preview and most feeds without cropping. */
export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;

/** The template's own size (px); it is scaled evenly to cover the card. */
export const TEMPLATE_WIDTH = 1122;
export const TEMPLATE_HEIGHT = 1402;

/**
 * Where the words go, in the template's own pixels (1122 × 1402), measured from it: each blank area's edges, and the
 * painted marks the words line up with. Font sizes are in the same pixels; the card scales them with the template.
 */
export const SPOTS = {
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
  /**
   * The player's display name, in the ticket's upper part: left-aligned with the score and as wide as it may be (left
   * of the postmark, 508–612 × 839–929), centred in the band from `top` to `bottom` above the underline (in the
   * ticket's frame; its top edge is about 324 above it, the full-size score's digits reach about 174). One line up to
   * `size`, kept while it fits at `oneLine` or more; a longer name on two lines (`step` of the size apart) up to
   * `twoLines`, broken at a space, or between letters where it has none (or a space would leave it much smaller).
   * Twenty characters on two lines fit at about 36 even in the widest letters: a name is never cut, and never tiny.
   */
  player: { top: 295, bottom: 198, size: 60, oneLine: 44, twoLines: 46, step: 1.05 },
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
export const LINE = 1.06;
/** The QR code's size on the card (card px), its light square and quiet zone included. */
export const QR_SIZE = 180;
/** The quiet zone round the QR code's modules, in modules: the standard's four. */
export const QR_QUIET = 4;

/** The palette (globals.css), fixed here so the image never follows a page style. */
export const CARD_COLORS = {
  ink: "#1f3a5f",
  inkSoft: "#52627f",
  coral: "#e85b45",
  qrLight: "#ffffff",
} as const;

/**
 * The scale and offset that cover the card with the template, centred (it is 4:5 within a fraction of a pixel), and
 * a template point on the card.
 */
export function templateFit(templateWidth = TEMPLATE_WIDTH, templateHeight = TEMPLATE_HEIGHT) {
  const s = Math.max(CARD_WIDTH / templateWidth, CARD_HEIGHT / templateHeight);
  const [ox, oy] = [(CARD_WIDTH - templateWidth * s) / 2, (CARD_HEIGHT - templateHeight * s) / 2];
  return { s, ox, oy, X: (x: number) => ox + x * s, Y: (y: number) => oy + y * s };
}
