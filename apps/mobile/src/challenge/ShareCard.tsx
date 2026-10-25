import type { ComponentRef, Ref } from "react";
import { View } from "react-native";
import Svg, { G, Image as SvgImage, Path, Rect, Text as SvgText } from "react-native-svg";
import { qrCode } from "@/core/challenge/qrCode";
import type { ShareText } from "@/core/challenge/share";
import { CARD_COLORS as C, CARD_HEIGHT, CARD_WIDTH, LINE, QR_QUIET, QR_SIZE, SPOTS, templateFit } from "@/core/challenge/shareCardLayout";
import { textWidth } from "../theme/textWidth";

/** The website's postcard template, the card's background (public/images/share; let into the EAS upload by name). */
const TEMPLATE = require("@/../public/images/share/quick-challenge-postcard-template-v2.png");

/**
 * The Quick Challenge's result card, as the website draws it (src/components/challenge/shareCard.ts), as an SVG: the
 * same template, the same places and sizes (src/core/challenge/shareCardLayout.ts), the same words
 * (src/core/challenge/share.ts) and the same QR code (qrCode.ts) to the site. Only the score, the round's size and its
 * time: practice rounds have no name to show, and nothing else about the player is on it. `width` is its size on
 * screen; ShareResult captures it at the card's full 1080 × 1350.
 */
export function ShareCard({ text, width, ref }: { text: ShareText; width: number; ref?: Ref<ComponentRef<typeof View>> }) {
  const { s, X, Y } = templateFit();
  const title = text.capitals ? text.title.toUpperCase() : text.title;
  const caption = text.capitals ? text.caption.toUpperCase() : text.caption;

  // The top cream: the name beside the logo's icon, the title under it (on two lines where one would be drawn
  // noticeably smaller: Armenian's; the name then a little smaller and higher).
  const t = SPOTS.title;
  const titleBlock = wrap(title, (text.capitals ? t.size : t.size + 3) * s, (t.right - t.x) * s, text.capitals ? 2 : 0.5);
  const wrapped = titleBlock.lines.length > 1;
  const name = SPOTS.name;
  const nameSize = fit(text.appName, (wrapped ? name.wrappedSize : name.size) * s, (name.right - name.x) * s);
  const nameBaseline = Y(wrapped ? name.wrappedBaseline : name.baseline);
  const firstTitle = wrapped ? nameBaseline + nameSize * 0.22 + t.gap * s + titleBlock.size * 0.74 : Y(t.baseline);

  // The ticket, turned as its underline is: the score on it, the caption under it, the time by the stopwatch.
  const [[ux0, uy0], [ux1, uy1]] = [SPOTS.underline.from, SPOTS.underline.to];
  const turn = Math.atan2(uy1 - uy0, ux1 - ux0);
  const onTicket = (x: number, y: number) => {
    const [dx, dy] = [(x - ux0) * s, (y - uy0) * s];
    return [dx * Math.cos(turn) + dy * Math.sin(turn), -dx * Math.sin(turn) + dy * Math.cos(turn)] as const;
  };
  const sc = SPOTS.score;
  const [correct, total] = text.score.split("/");
  const denominator = `/${total}`;
  let [big, small] = [sc.big * s, sc.small * s];
  const scoreWidth = digits(correct, big) + sc.gap * s + digits(denominator, small);
  const scoreRoom = (sc.right - sc.x) * s;
  if (scoreWidth > scoreRoom) [big, small] = [(big * scoreRoom) / scoreWidth, (small * scoreRoom) / scoreWidth];
  const [scoreX] = onTicket(sc.x, uy0);
  const cap = SPOTS.caption;
  const [captionX, captionY] = onTicket(cap.x, cap.baseline);
  const captionSpacing = text.capitals ? 3 : 0.5;
  const captionSize = fit(caption, (text.capitals ? cap.size : cap.size + 3) * s, (cap.right - cap.x) * s, captionSpacing);
  const tm = SPOTS.time;
  const [timeX, timeY] = onTicket(tm.x, tm.middle);
  const timeSize = fit(text.time, tm.size * s, (tm.right - tm.x) * s);

  // The bottom right: the QR code above the pill, the invitation beside it, the address in the pill.
  const q = SPOTS.qr;
  const qrX = Math.round(X(q.right) - QR_SIZE);
  const qrY = Math.round(Y(q.bottom) - QR_SIZE);
  const inv = SPOTS.invitation;
  const area = { x: X(inv.x), right: qrX - q.gap * s, top: Y(inv.top), bottom: Y(inv.bottom) };
  const invite = stack(text.turn, inv.size * s, area.right - area.x - 2 * inv.inset * s, area.bottom - area.top);
  const inviteTop = (area.top + area.bottom) / 2 - (invite.size * LINE * invite.lines.length) / 2;
  const p = SPOTS.pill;
  const hostSize = fit(text.host, p.size * s, (p.x1 - p.x0 - 56) * s);

  return (
    <View ref={ref} collapsable={false} style={{ width, height: (width * CARD_HEIGHT) / CARD_WIDTH }} accessible accessibilityRole="image" accessibilityLabel={text.alt}>
      <Svg width={width} height={(width * CARD_HEIGHT) / CARD_WIDTH} viewBox={`0 0 ${CARD_WIDTH} ${CARD_HEIGHT}`}>
        <SvgImage href={TEMPLATE} x={X(0)} y={Y(0)} width={X(1122) - X(0)} height={Y(1402) - Y(0)} preserveAspectRatio="none" />
        <SvgText x={X(name.x)} y={nameBaseline} fontSize={nameSize} fontWeight="900" fill={C.ink}>
          {text.appName}
        </SvgText>
        {titleBlock.lines.map((line, i) => (
          <SvgText key={i} x={X(t.x)} y={firstTitle + titleBlock.size * t.step * i} fontSize={titleBlock.size} fontWeight="900" fill={C.ink} letterSpacing={text.capitals ? 2 * s : 0.5 * s}>
            {line}
          </SvgText>
        ))}
        <G transform={`translate(${X(ux0)} ${Y(uy0)}) rotate(${(turn * 180) / Math.PI})`}>
          <SvgText x={scoreX} y={-sc.above * s} fontSize={big} fontWeight="900" fill={C.ink}>
            {correct}
          </SvgText>
          <SvgText x={scoreX + digits(correct, big) + sc.gap * s} y={-sc.above * s} fontSize={small} fontWeight="900" fill={C.inkSoft}>
            {denominator}
          </SvgText>
          <SvgText x={captionX} y={captionY} fontSize={captionSize} fontWeight="900" fill={C.ink} letterSpacing={captionSpacing * s}>
            {caption}
          </SvgText>
          <SvgText x={timeX} y={timeY + timeSize * 0.35 + 2 * s} fontSize={timeSize} fontWeight="900" fill={C.ink}>
            {text.time}
          </SvgText>
        </G>
        <Qr url={text.url} x={qrX} y={qrY} size={QR_SIZE} />
        {invite.lines.map((line, i) => (
          <SvgText key={i} x={(area.x + area.right) / 2} y={inviteTop + invite.size * LINE * (i + 0.5) + invite.size * 0.35} fontSize={invite.size} fontWeight="900" fill={C.coral} textAnchor="middle">
            {line}
          </SvgText>
        ))}
        <SvgText x={X((p.x0 + p.x1) / 2)} y={Y(p.middle) + hostSize * 0.35 + 1} fontSize={hostSize} fontWeight="800" fill={C.ink} textAnchor="middle">
          {text.host}
        </SvgText>
      </Svg>
    </View>
  );
}

/** The QR code for `url`: navy modules on a white rounded square holding the quiet zone, as the website's card. */
function Qr({ url, x, y, size }: { url: string; x: number; y: number; size: number }) {
  const modules = qrCode(url);
  const count = modules.length + 2 * QR_QUIET;
  const edge = (i: number) => Math.round((i * size) / count);
  let d = "";
  modules.forEach((row, r) =>
    row.forEach((on, c) => {
      if (!on) return;
      const [x0, x1, y0, y1] = [edge(c + QR_QUIET), edge(c + QR_QUIET + 1), edge(r + QR_QUIET), edge(r + QR_QUIET + 1)];
      d += `M${x + x0} ${y + y0}h${x1 - x0}v${y1 - y0}h${x0 - x1}z`;
    }),
  );
  return (
    <>
      <Rect x={x} y={y + 4} width={size} height={size} rx={14} fill="rgba(31, 58, 95, 0.12)" />
      <Rect x={x} y={y} width={size} height={size} rx={14} fill={C.qrLight} />
      <Path d={d} fill={C.ink} />
    </>
  );
}

// Text measured as the app's layouts measure it (theme/textWidth.ts: a little generous), so words fit where the website's
// canvas measures them exactly.

/** Digits are narrower than the estimate's letters: the score's width. */
const digits = (text: string, size: number) => text.length * size * 0.6;

/** The largest size up to `size` at which `text` fits `maxWidth` (never under 60% of it). */
function fit(text: string, size: number, maxWidth: number, spacing = 0): number {
  const width = (f: number) => textWidth(text, f) + spacing * Math.max(0, text.length - 1);
  return width(size) <= maxWidth ? size : Math.max(size * 0.6, (size * maxWidth) / width(size));
}

/** `text` on one line if it fits at 90% of `size` or more; otherwise on two, broken at the space allowing the largest size. */
function wrap(text: string, size: number, maxWidth: number, spacing: number): { size: number; lines: string[] } {
  const one = fit(text, size, maxWidth, spacing);
  const words = text.split(" ");
  if (one >= size * 0.9 || words.length < 2) return { size: one, lines: [text] };
  let best = { size: one, lines: [text] };
  for (let i = 1; i < words.length; i++) {
    const lines = [words.slice(0, i).join(" "), words.slice(i).join(" ")];
    const f = Math.min(...lines.map((line) => fit(line, size, maxWidth, spacing)));
    if (f > best.size) best = { size: f, lines };
  }
  return best;
}

/** `text` in a box, on one or two lines, as large as fits (up to `size`). */
function stack(text: string, size: number, maxWidth: number, maxHeight: number): { size: number; lines: string[] } {
  const words = text.split(" ");
  let best = { size: Math.min(maxHeight / LINE, fit(text, size, maxWidth)), lines: [text] };
  for (let i = 1; i < words.length; i++) {
    const lines = [words.slice(0, i).join(" "), words.slice(i).join(" ")];
    const f = Math.min(maxHeight / (2 * LINE), ...lines.map((line) => fit(line, size, maxWidth)));
    if (f > best.size) best = { size: f, lines };
  }
  return best;
}
