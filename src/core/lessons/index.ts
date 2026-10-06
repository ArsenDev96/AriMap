import { LEVELS, levelVersions } from "./levels";
import type { LessonDefinition } from "./types";
import { westernEuropeLesson } from "./western-europe";

/** The playable levels' content, by level id: each level's current version. */
export const LESSONS: Readonly<Record<string, LessonDefinition>> = Object.fromEntries(
  LEVELS.flatMap((level) => (level.lesson ? [[level.id, level.lesson] as const] : [])),
);

/** Every version of every playable level's content, earlier ones included (LevelInfo.earlier). */
export const LESSON_VERSIONS: readonly LessonDefinition[] = LEVELS.flatMap((level) => levelVersions(level).map((v) => v.lesson));

/** Level 1: the level a new player starts with. */
export const DEFAULT_LESSON_ID = westernEuropeLesson.id;

export function getLesson(id: string): LessonDefinition | undefined {
  return LESSONS[id];
}

/**
 * The key of a version's own assets (its relief overview): the level id, with "-r2" and so on for a
 * version after the first, so a level's first version keeps the files it always had.
 */
export function versionKey(lesson: LessonDefinition): string {
  return lesson.revision ? `${lesson.id}-r${lesson.revision}` : lesson.id;
}

export { getLevel, hasPlayableLevels, LEVELS, levelsOf, levelVersion, levelVersions, type LevelInfo, type LevelVersion } from "./levels";
export { CONTINENTS, getContinent, isContinentId, type ContinentId, type ContinentInfo } from "./continents";
export type { LessonDefinition, TravelMission } from "./types";
