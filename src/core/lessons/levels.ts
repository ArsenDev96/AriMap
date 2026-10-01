import type { CountryId } from "../content/types";
import type { LocalizedText } from "../i18n/locales";
import { adriaticLesson } from "./adriatic";
import { alpsLesson } from "./alps";
import { centralEuropeLesson } from "./central-europe";
import type { LessonDefinition } from "./types";
import { westernEuropeLesson } from "./western-europe";

/**
 * A level as shown on the level selection. `lesson` holds its playable content;
 * a level without one is still being prepared: its card says "Coming soon" and
 * it can never be started. A level with `unlockedBy` opens once that level is
 * completed (its journey finished once), and stays open.
 */
export interface LevelInfo {
  /** Stable id: the key of the level's saved progress. Never reuse or rename one. */
  id: string;
  /** Position in the list, shown on the card ("Level 2"). */
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
  // Level 5: metadata only. Its country group is connected by real land borders
  // (checked against the map data in src/geo/regionMap.test.ts), but its content,
  // journey and map coverage are not prepared yet.
  {
    id: "towards-greece",
    number: 5,
    title: { en: "Towards Greece", hy: "Դեպի Հունաստան" },
    description: {
      en: "Across the Danube and the Balkans, all the way to Greece.",
      hy: "Դանուբով և Բալկաններով՝ մինչև Հունաստան։",
    },
    countries: ["HUN", "ROU", "SRB", "BGR", "GRC"],
    unlockedBy: adriaticLesson.id,
  },
];

export function getLevel(id: string): LevelInfo | undefined {
  return LEVELS.find((level) => level.id === id);
}
