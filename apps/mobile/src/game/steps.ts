import type { MessageKey } from "@/core/i18n/translate";
import type { LessonStage } from "@/core/lesson/progress";
import { colors } from "../theme/tokens";

/** A level's three steps and the stages in each, with its accent (the website's STEPS, src/components/Header.tsx). */
export const STEPS: readonly { key: MessageKey; stages: readonly LessonStage[]; accent: string; soft: string }[] = [
  { key: "steps.discover", stages: ["discover"], accent: colors.discoverInk, soft: colors.discoverSoft },
  { key: "steps.find", stages: ["find"], accent: colors.findInk, soft: colors.findSoft },
  { key: "steps.travel", stages: ["travel", "results"], accent: colors.travelInk, soft: colors.travelSoft },
];

export const stepOf = (stage: LessonStage) => STEPS.find((s) => s.stages.includes(stage))!;
