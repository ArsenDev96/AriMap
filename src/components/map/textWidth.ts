let measureContext: CanvasRenderingContext2D | null | undefined;
const widthCache = new Map<string, number>();

/**
 * Approximate rendered width of map text in the page's font, with a small safety margin: for placing names on the
 * levels' maps (RegionMap.tsx) and the Quick Challenge's (challenge/mapNames.ts). Measured once per text, size and
 * weight; without a canvas, estimated from the text's length.
 */
export function textWidth(text: string, sizePx: number, weight: number): number {
  const key = `${weight}|${sizePx}|${text}`;
  const cached = widthCache.get(key);
  if (cached !== undefined) return cached;
  if (measureContext === undefined) measureContext = document.createElement("canvas").getContext("2d");
  let width = text.length * sizePx * 0.62;
  if (measureContext) {
    measureContext.font = `${weight} ${sizePx}px ${getComputedStyle(document.body).fontFamily}`;
    width = measureContext.measureText(text).width;
  }
  width = Math.ceil(width * 1.06);
  widthCache.set(key, width);
  return width;
}
