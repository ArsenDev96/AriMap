import type { LocalizedText } from "../i18n/locales";
import { COUNTRIES } from "./countries";
import type { CountryId } from "./types";

/**
 * Names of countries in levels that are not playable yet, shown on their level
 * cards. They get full content (capital, hint, landmark) in countries.ts when
 * their level is made playable, and are then removed from here.
 */
export const UPCOMING_COUNTRY_NAMES: Readonly<Record<CountryId, LocalizedText>> = {
  POL: { en: "Poland", hy: "Լեհաստան" },
  CZE: { en: "Czechia", hy: "Չեխիա" },
  SVK: { en: "Slovakia", hy: "Սլովակիա" },
  SVN: { en: "Slovenia", hy: "Սլովենիա" },
  HRV: { en: "Croatia", hy: "Խորվաթիա" },
  BIH: { en: "Bosnia and Herzegovina", hy: "Բոսնիա և Հերցեգովինա" },
  MNE: { en: "Montenegro", hy: "Չեռնոգորիա" },
  HUN: { en: "Hungary", hy: "Հունգարիա" },
  ROU: { en: "Romania", hy: "Ռումինիա" },
  SRB: { en: "Serbia", hy: "Սերբիա" },
  BGR: { en: "Bulgaria", hy: "Բուլղարիա" },
  GRC: { en: "Greece", hy: "Հունաստան" },
};

/** A country's base name, for playable and upcoming levels alike. */
export function countryName(id: CountryId): LocalizedText {
  const name = COUNTRIES[id]?.name ?? UPCOMING_COUNTRY_NAMES[id];
  if (!name) throw new Error(`Unknown country id: ${id}`);
  return name;
}
