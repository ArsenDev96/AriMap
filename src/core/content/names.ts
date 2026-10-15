import type { LocalizedText } from "../i18n/locales";
import { COUNTRIES } from "./countries";
import type { CountryId } from "./types";

/**
 * Names of countries in levels that are not playable yet, shown on their level
 * cards. They get full content (capital, hint, landmark) in countries.ts when
 * their level is made playable, and are then removed from here. Every level is
 * playable now, so it is empty.
 */
export const UPCOMING_COUNTRY_NAMES: Readonly<Record<CountryId, LocalizedText>> = {};

/**
 * Names of countries played in the Quick Challenge (src/core/challenge/quickChallenge.ts) that no level
 * teaches yet, so they have no full content (capital, hint, landmark) in countries.ts. As in the English
 * and Armenian Wikipedia article titles, like the levels' countries (docs/CONTENT.md).
 */
export const CHALLENGE_COUNTRY_NAMES: Readonly<Record<CountryId, LocalizedText>> = {
  LIE: { en: "Liechtenstein", hy: "Լիխտենշտայն" },
  MCO: { en: "Monaco", hy: "Մոնակո" },
  SMR: { en: "San Marino", hy: "Սան Մարինո" },
  VAT: { en: "Vatican City", hy: "Վատիկան" },
  MLT: { en: "Malta", hy: "Մալթա" },
  RUS: { en: "Russia", hy: "Ռուսաստան" },
};

/** A country's base name, for playable and upcoming levels and the Quick Challenge alike. */
export function countryName(id: CountryId): LocalizedText {
  const name = COUNTRIES[id]?.name ?? UPCOMING_COUNTRY_NAMES[id] ?? CHALLENGE_COUNTRY_NAMES[id];
  if (!name) throw new Error(`Unknown country id: ${id}`);
  return name;
}
