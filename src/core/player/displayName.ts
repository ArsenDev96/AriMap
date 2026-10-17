/**
 * The player's optional display name: shown on the Quick Challenge leaderboard (later) and on the future
 * Europe Geography Master award. A label anyone can choose, not an identity: names need not be unique,
 * and saving one proves nothing about who the player is.
 *
 * The same rules run on the device (to explain a problem as it is typed) and on the server (which alone
 * decides). The blocked words are a first line only: names on a public leaderboard still need moderation.
 *
 * Framework-independent: no React, DOM, storage or network.
 */

export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 20;

/** At most this many name changes (a first name included) in any NAME_CHANGE_WINDOW_MS. */
export const NAME_CHANGES_PER_WINDOW = 3;
export const NAME_CHANGE_WINDOW_MS = 24 * 60 * 60 * 1000;

export type DisplayNameProblem =
  /** Fewer than DISPLAY_NAME_MIN characters once spaces are tidied. */
  | "tooShort"
  /** More than DISPLAY_NAME_MAX characters. */
  | "tooLong"
  /** A character other than a letter, a digit, a space or - ' . _ */
  | "characters"
  /** No letter at all. */
  | "noLetter"
  /** Looks like a web address. */
  | "link"
  /** A name that could pass for the game's own, or its staff. */
  | "reserved"
  /** Contains a blocked word. */
  | "blocked";

export type DisplayNameCheck = { ok: true; name: string } | { ok: false; problem: DisplayNameProblem };

/** Letters (any script, with their combining marks), digits, spaces, and - ' . _ */
const ALLOWED = /^[\p{L}\p{M}\p{Nd} '\-._]+$/u;
const LETTER = /\p{L}/u;
/** Two words joined by a dot ("ari.map", "www.site"): initials ("J. R.") stay allowed. */
const LINK = /\p{L}{2,}\.\p{L}{2,}/u;

/** Compared with every space, dot, dash, underscore and apostrophe removed, and in lower case. */
const RESERVED = ["arimap", "արիմապ", "admin", "administrator", "moderator", "support", "official", "staff"];

/**
 * Words refused anywhere in a name, after folding (see fold). A short starting list, to be extended
 * (Armenian and transliterated entries in particular) by someone who reads both languages.
 */
const BLOCKED = ["fuck", "shit", "cunt", "bitch", "nigger", "nigga", "faggot", "whore", "slut", "nazi", "hitler"];

/** Spaces tidied: Unicode normal form C, trimmed, each run of spaces made one space. */
export function tidyDisplayName(input: string): string {
  return input.normalize("NFC").trim().replace(/\s+/gu, " ");
}

/** The form compared with reserved and blocked words: lower case, look-alike digits as letters, no separators. */
function fold(name: string): string {
  return name
    .toLowerCase()
    .replace(/[0134578]/g, (d) => ({ "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b" })[d]!)
    .replace(/[ '\-._]/g, "");
}

/** Checks a proposed name. On success, `name` is the tidied name to save. */
export function checkDisplayName(input: string): DisplayNameCheck {
  const name = tidyDisplayName(input);
  const length = [...name].length;
  if (length < DISPLAY_NAME_MIN) return { ok: false, problem: "tooShort" };
  if (length > DISPLAY_NAME_MAX) return { ok: false, problem: "tooLong" };
  if (!ALLOWED.test(name)) return { ok: false, problem: "characters" };
  if (!LETTER.test(name)) return { ok: false, problem: "noLetter" };
  if (LINK.test(name)) return { ok: false, problem: "link" };
  const folded = fold(name);
  if (RESERVED.includes(folded)) return { ok: false, problem: "reserved" };
  if (BLOCKED.some((word) => folded.includes(word))) return { ok: false, problem: "blocked" };
  return { ok: true, name };
}
