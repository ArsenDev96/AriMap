import type { CountryId } from "../content/types";
import type { LocalizedText } from "../i18n/locales";
import type { ContinentId } from "./continents";
import { adriaticLesson } from "./adriatic";
import { alpsLesson } from "./alps";
import { balticJourneyLesson } from "./baltic-journey";
import { centralEuropeLesson } from "./central-europe";
import { easternEuropeLesson } from "./eastern-europe";
import { iberianJourneyLesson } from "./iberian-journey";
import { towardsGreeceLesson } from "./towards-greece";
import type { LessonDefinition } from "./types";
import { westernEuropeLesson } from "./western-europe";

/**
 * A level as shown on its continent's level selection. `lesson` holds its playable
 * content; a level without one is still being prepared: its card says "Coming soon" and
 * it can never be started. A level with `unlockedBy` opens once that level is
 * completed (its journey finished once), and stays open. Unlocking runs within a
 * continent: a continent's first level has no `unlockedBy`, so no continent waits
 * for another (checked in levels.test.ts).
 */
export interface LevelInfo {
  /** Stable id: the key of the level's saved progress. Never reuse or rename one. */
  id: string;
  /** The continent it belongs to: its levels are listed there, in this list's order. */
  continent: ContinentId;
  /** Position in its continent's list, shown on the card ("Level 2"). */
  number: number;
  title: LocalizedText;
  description: LocalizedText;
  countries: readonly CountryId[];
  lesson?: LessonDefinition;
  unlockedBy?: string;
}

export const LEVELS: readonly LevelInfo[] = [
  {
    id: westernEuropeLesson.id,
    continent: "europe",
    number: 1,
    title: { en: "France and its neighbours", hy: "Ֆրանսիան և իր հարևանները" },
    description: {
      en: "Your first trip: from Paris to the North Sea and Berlin.",
      hy: "Առաջին ճամփորդությունդ՝ Փարիզից մինչև Հյուսիսային ծով և Բեռլին։",
    },
    countries: westernEuropeLesson.countries,
    lesson: westernEuropeLesson,
  },
  {
    id: alpsLesson.id,
    continent: "europe",
    number: 2,
    title: { en: "Around the Alps", hy: "Ալպերի շուրջը" },
    description: {
      en: "Mountain countries around the Alps, from Paris to Vienna and Rome.",
      hy: "Ալպերի շրջակա լեռնային երկրները՝ Փարիզից մինչև Վիեննա և Հռոմ։",
    },
    countries: alpsLesson.countries,
    lesson: alpsLesson,
    unlockedBy: westernEuropeLesson.id,
  },
  {
    id: centralEuropeLesson.id,
    continent: "europe",
    number: 3,
    title: { en: "Central Europe", hy: "Կենտրոնական Եվրոպա" },
    description: {
      en: "Plains, rivers and old cities in the middle of Europe.",
      hy: "Հարթավայրեր, գետեր և հին քաղաքներ Եվրոպայի կենտրոնում։",
    },
    countries: centralEuropeLesson.countries,
    lesson: centralEuropeLesson,
    unlockedBy: alpsLesson.id,
  },
  {
    id: adriaticLesson.id,
    continent: "europe",
    number: 4,
    title: { en: "Along the Adriatic", hy: "Ադրիատիկի ափով" },
    description: {
      en: "From Italy along the Adriatic coast to the Balkans.",
      hy: "Իտալիայից Ադրիատիկի ափով դեպի Բալկաններ։",
    },
    countries: adriaticLesson.countries,
    lesson: adriaticLesson,
    unlockedBy: centralEuropeLesson.id,
  },
  {
    id: towardsGreeceLesson.id,
    continent: "europe",
    number: 5,
    title: { en: "Towards Greece", hy: "Դեպի Հունաստան" },
    description: {
      en: "Across the Danube and the Balkans, all the way to Greece.",
      hy: "Դանուբով և Բալկաններով՝ մինչև Հունաստան։",
    },
    countries: towardsGreeceLesson.countries,
    lesson: towardsGreeceLesson,
    unlockedBy: adriaticLesson.id,
  },
  {
    id: balticJourneyLesson.id,
    continent: "europe",
    number: 6,
    title: { en: "Baltic Journey", hy: "Բալթյան ճամփորդություն" },
    description: {
      en: "From Berlin along the Baltic Sea to Tallinn, through Poland, Lithuania and Latvia.",
      hy: "Բեռլինից Բալթիկ ծովի երկայնքով մինչև Տալլին՝ Լեհաստանով, Լիտվայով և Լատվիայով։",
    },
    countries: balticJourneyLesson.countries,
    lesson: balticJourneyLesson,
    unlockedBy: towardsGreeceLesson.id,
  },
  {
    id: iberianJourneyLesson.id,
    continent: "europe",
    number: 7,
    title: { en: "Iberian Journey", hy: "Պիրենեյան ճամփորդություն" },
    description: {
      en: "From Lisbon across Spain and France to Rome, past tiny Andorra in the Pyrenees.",
      hy: "Լիսաբոնից Իսպանիայով և Ֆրանսիայով մինչև Հռոմ՝ Պիրենեյներում գտնվող փոքրիկ Անդորրայի մոտով։",
    },
    countries: iberianJourneyLesson.countries,
    lesson: iberianJourneyLesson,
    unlockedBy: balticJourneyLesson.id,
  },
  {
    id: easternEuropeLesson.id,
    continent: "europe",
    number: 8,
    title: { en: "Eastern Europe", hy: "Արևելյան Եվրոպա" },
    description: {
      en: "From Warsaw across Ukraine to Chisinau, between the Baltic and the Black Sea.",
      hy: "Վարշավայից Ուկրաինայով մինչև Քիշնև՝ Բալթիկ և Սև ծովերի միջև։",
    },
    countries: easternEuropeLesson.countries,
    lesson: easternEuropeLesson,
    unlockedBy: iberianJourneyLesson.id,
  },
];

export function getLevel(id: string): LevelInfo | undefined {
  return LEVELS.find((level) => level.id === id);
}

/** A continent's levels, in order (none yet for a continent that is coming soon). */
export function levelsOf(continent: ContinentId): readonly LevelInfo[] {
  return LEVELS.filter((level) => level.continent === continent);
}

/** Whether a continent has a level that can be played: otherwise it is coming soon. */
export function hasPlayableLevels(continent: ContinentId): boolean {
  return levelsOf(continent).some((level) => level.lesson);
}
