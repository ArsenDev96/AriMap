import { Redirect, useLocalSearchParams } from "expo-router";
import { getLevel } from "@/core/lessons";
import { canPlay } from "@/core/progress/appState";
import { useGame } from "../../game/GameProvider";
import { LessonScreen } from "../../lesson/LessonScreen";

/** A level, played from Discover to Results (LessonScreen). Only a playable, unlocked level opens, as on the website. */
export default function Level() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useGame();
  const level = typeof id === "string" ? getLevel(id) : undefined;
  if (!level || !level.lesson || !canPlay(state, level.id)) return <Redirect href="/" />;
  return <LessonScreen levelId={level.id} />;
}
