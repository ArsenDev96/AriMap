import type { AnswerRecord, ChallengeResult, ChallengeRound } from "@/core/challenge/quickChallenge";
import type { CountryId } from "@/core/content/types";
import { levelsOf, type LevelInfo } from "@/core/lessons";
import type { ChallengeTone } from "./ChallengeMap";

/**
 * The map's colours (the website's mapTones): after the round, every question's country (found, or where a missed one
 * was) and the wrong choices; during it, the last answer's while its feedback shows.
 */
export function mapTones(round: ChallengeRound, result: ChallengeResult | null, feedback: AnswerRecord | null): Partial<Record<CountryId, ChallengeTone>> {
  if (result) {
    const tones: Partial<Record<CountryId, ChallengeTone>> = {};
    for (const q of result.questions) if (q.outcome === "wrong" && q.chosen && !tones[q.chosen]) tones[q.chosen] = "chosen";
    for (const q of result.questions) tones[q.target] = q.outcome === "correct" ? "correct" : "missed";
    return tones;
  }
  if (round.status !== "playing" || !feedback) return {};
  if (feedback.outcome === "correct") return { [feedback.target]: "correct" };
  return { [feedback.target]: "missed", ...(feedback.chosen ? { [feedback.chosen]: "chosen" } : {}) };
}

/** Named on the map once the round has ended (the website's roundNames): the missed ones first, then the found. */
export function roundNames(result: ChallengeResult): CountryId[] {
  const missed = result.questions.filter((q) => q.outcome !== "correct");
  const found = result.questions.filter((q) => q.outcome === "correct");
  return [...missed, ...found].map((q) => q.target);
}

/** The first European level that teaches a country, if any. */
export function levelOf(id: CountryId): LevelInfo | undefined {
  return levelsOf("europe").find((level) => level.lesson?.countries.includes(id));
}
