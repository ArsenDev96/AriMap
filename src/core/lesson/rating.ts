import { countIndependent, type FindAnswer } from "../game/find";
import type { LessonProgress, TravelResult } from "./progress";

/**
 * A level's star rating, one rule for every level, given only for a completed full-level attempt
 * (Discover, Find and Travel in one go):
 * - 1 star: the level completed;
 * - 2 stars: and at least all but one of the Find answers (4 of 5) found on the first try, without hints;
 * - 3 stars: and every Find answer found so, and the journey completed "Without help" (no hint, no undo).
 * "On the first try, without hints" is Find's own measure (FindAnswer.independent), and "Without
 * help" is Travel's (TravelResult.independent): no time limits, no other penalties.
 */
export type StarRating = 1 | 2 | 3;
export const MAX_STARS = 3;

export function rateAttempt(answers: readonly FindAnswer[], travel: Pick<TravelResult, "independent">): StarRating {
  const firstTry = countIndependent(answers);
  if (firstTry === answers.length && travel.independent) return 3;
  return firstTry >= answers.length - 1 ? 2 : 1;
}

/**
 * The rating of the finished attempt whose Results are shown: a full-level attempt, at its
 * Results, with its Find complete. None after a journey replay (Replay journey plays Travel
 * alone, so its route is never combined with an earlier Find into a rating).
 */
export function attemptRating(progress: LessonProgress): StarRating | null {
  const { find, lastTravelResult } = progress;
  if (progress.stage !== "results" || progress.journeyReplay || find?.status !== "complete" || !lastTravelResult) return null;
  return rateAttempt(find.results, lastTravelResult);
}

/** The better of a best rating and a new one: a best is never lowered. */
export function betterRating(best: StarRating | null, rating: StarRating | null): StarRating | null {
  if (rating === null) return best;
  return best === null || rating > best ? rating : best;
}

export function isStarRating(v: unknown): v is StarRating {
  return v === 1 || v === 2 || v === 3;
}

/**
 * What a 1- or 2-star attempt lacks for the next star: Find answers on the first try (at least
 * all but one for 2 stars, all for 3), the journey without help (for 3), or both. Null at 3 stars.
 */
export type NextStar = "findMost" | "findAll" | "travel" | "findAllAndTravel";

export function nextStar(answers: readonly FindAnswer[], travel: Pick<TravelResult, "independent">): NextStar | null {
  const rating = rateAttempt(answers, travel);
  if (rating === 1) return "findMost";
  if (rating === 3) return null;
  const allFound = countIndependent(answers) === answers.length;
  return allFound ? "travel" : travel.independent ? "findAll" : "findAllAndTravel";
}
