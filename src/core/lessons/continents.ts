import type { LocalizedText } from "../i18n/locales";

/**
 * The continents on the home screen, in the order shown. Each level names its continent
 * (`continent` in levels.ts); a continent's levels are found from that, never from a list of
 * its own. A continent with no playable level yet is "coming soon": it shows no action and
 * cannot be opened.
 *
 * Ids are stable: the save keeps the continent whose levels were last open. Never reuse or
 * rename one.
 */
export const CONTINENT_IDS = ["europe", "asia", "africa", "north-america", "south-america"] as const;

export type ContinentId = (typeof CONTINENT_IDS)[number];

export interface ContinentInfo {
  id: ContinentId;
  name: LocalizedText;
  /** Name as used inside a phrase, e.g. "Explore Europe" / «Բացահայտել Եվրոպան». */
  nameInText: LocalizedText;
  /** Name describing something of the continent's, e.g. "2 of 7 Europe levels" / «Եվրոպայի 7 մակարդակից». */
  nameOf: LocalizedText;
}

export const CONTINENTS: readonly ContinentInfo[] = [
  { id: "europe", name: { en: "Europe", hy: "Եվրոպա" }, nameInText: { en: "Europe", hy: "Եվրոպան" }, nameOf: { en: "Europe", hy: "Եվրոպայի" } },
  { id: "asia", name: { en: "Asia", hy: "Ասիա" }, nameInText: { en: "Asia", hy: "Ասիան" }, nameOf: { en: "Asia", hy: "Ասիայի" } },
  { id: "africa", name: { en: "Africa", hy: "Աֆրիկա" }, nameInText: { en: "Africa", hy: "Աֆրիկան" }, nameOf: { en: "Africa", hy: "Աֆրիկայի" } },
  { id: "north-america", name: { en: "North America", hy: "Հյուսիսային Ամերիկա" }, nameInText: { en: "North America", hy: "Հյուսիսային Ամերիկան" }, nameOf: { en: "North America", hy: "Հյուսիսային Ամերիկայի" } },
  { id: "south-america", name: { en: "South America", hy: "Հարավային Ամերիկա" }, nameInText: { en: "South America", hy: "Հարավային Ամերիկան" }, nameOf: { en: "South America", hy: "Հարավային Ամերիկայի" } },
];

export function isContinentId(value: unknown): value is ContinentId {
  return typeof value === "string" && (CONTINENT_IDS as readonly string[]).includes(value);
}

export function getContinent(id: ContinentId): ContinentInfo {
  return CONTINENTS.find((c) => c.id === id)!;
}
