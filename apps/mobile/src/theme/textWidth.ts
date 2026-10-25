/**
 * A text's width on screen (dp), from its length, a little generous: bold letters of Android's system font average
 * about 0.5 em in Latin and 0.66 em in Armenian (measured on the lesson map). For layouts that must know before
 * drawing whether a word fits: the map's names (map/labels.ts), and buttons and cards that would otherwise break an
 * Armenian word at large text sizes.
 */
export function textWidth(text: string, fontSize: number): number {
  return text.length * fontSize * (/[԰-֏]/.test(text) ? 0.7 : 0.56);
}

/** The width of the longest word of `texts` (dp), at `fontSize`. */
export function longestWordWidth(texts: readonly string[], fontSize: number): number {
  return Math.max(0, ...texts.flatMap((text) => text.split(/\s+/)).map((word) => textWidth(word, fontSize)));
}
