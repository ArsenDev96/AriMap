import { LEVELS } from "./levels";
import type { LessonDefinition } from "./types";
import { westernEuropeLesson } from "./western-europe";

/** The playable levels' content, by level id. */
export const LESSONS: Readonly<Record<string, LessonDefinition>> = Object.fromEntries(
  LEVELS.flatMap((level) => (level.lesson ? [[level.id, level.lesson] as const] : [])),
);

/** Level 1: the level a new player starts with. */
export const DEFAULT_LESSON_ID = westernEuropeLesson.id;

export function getLesson(id: string): LessonDefinition | undefined {
  return LESSONS[id];
}

export { getLevel, LEVELS, type LevelInfo } from "./levels";
export type { LessonDefinition, TravelMission } from "./types";
