import type { LessonDefinition } from "./types";
import { westernEuropeLesson } from "./western-europe";

export const LESSONS: Readonly<Record<string, LessonDefinition>> = {
  [westernEuropeLesson.id]: westernEuropeLesson,
};

export const DEFAULT_LESSON_ID = westernEuropeLesson.id;

export function getLesson(id: string): LessonDefinition | undefined {
  return LESSONS[id];
}

export type { LessonDefinition, TravelMission } from "./types";
