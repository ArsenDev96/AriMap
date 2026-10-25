import { COUNTRIES } from "../content/countries";
import type { CountryId, LonLat } from "../content/types";
import { shuffle, type RandomSource } from "../game/random";
import { CHALLENGE_POOL } from "./europe";
import { createChallenge, type ChallengeRound, type ChallengeRules } from "./quickChallenge";

/**
 * The neighbours round: the Quick Challenge without the map, for players who can't see it (a screen reader reads the
 * map as one image, and naming its countries would give the answers away). Each question names a country, as the map
 * round does, and lists four others: the player chooses the one that borders it. Knowing where a country lies is still
 * the task; its name is never an option, and the options are names of countries close to it, three of them not its
 * neighbours.
 *
 * A round of its own, never a map round's score: 15 countries of the pool (all that have a land neighbour in it, so
 * not Iceland), ten times the map round's time (WCAG 2.2.1's extension, for listening to four options each time), and
 * a longer feedback, so a screen reader can say it before the next question. Played by the same engine
 * (quickChallenge.ts): an option that borders the country answers it correctly; another is a wrong answer, recorded
 * with the option chosen. Framework-independent, as the engine.
 */

/** Land neighbours by country: the challenge map's shared borders (challengeMap.ts, `neighbours`). */
export type Neighbours = ReadonlyMap<CountryId, readonly CountryId[]>;

export const NEIGHBOURS_RULES: ChallengeRules = {
  questions: 15,
  durationMs: 600_000,
  feedbackMs: { correct: 1_500, wrong: 2_500, skipped: 1_000 },
};

/** Options per question: one neighbour, and three countries that aren't. */
export const NEIGHBOUR_OPTIONS = 4;

/** Distractors are drawn from this many of the target's nearest non-neighbours, so none is far off and obvious. */
const NEAREST = 6;

/** A country's neighbours that the round can ask about (in the pool). */
export function poolNeighbours(neighbours: Neighbours, id: CountryId, pool: readonly CountryId[] = CHALLENGE_POOL): CountryId[] {
  return (neighbours.get(id) ?? []).filter((n) => n !== id && pool.includes(n));
}

/** The neighbours round's pool: the challenge's countries with a land neighbour among them (all but Iceland). */
export function neighboursPool(neighbours: Neighbours): CountryId[] {
  return CHALLENGE_POOL.filter((id) => poolNeighbours(neighbours, id).length > 0);
}

/** Whether `option` borders `target`. */
export const borders = (neighbours: Neighbours, target: CountryId, option: CountryId) => poolNeighbours(neighbours, target).includes(option);

/** Great-circle distance in radians between two countries' label points (where the levels name them). */
function distance(a: CountryId, b: CountryId): number {
  const [p, q] = [labelPoint(a), labelPoint(b)];
  const rad = Math.PI / 180;
  const [φ1, φ2, Δλ] = [p[1] * rad, q[1] * rad, (q[0] - p[0]) * rad];
  return Math.acos(Math.min(1, Math.sin(φ1) * Math.sin(φ2) + Math.cos(φ1) * Math.cos(φ2) * Math.cos(Δλ)));
}

function labelPoint(id: CountryId): LonLat {
  const country = COUNTRIES[id];
  if (!country) throw new Error(`No label point for ${id}`);
  return country.label.coordinates;
}

/**
 * A question's four options, in random order: one of the target's neighbours, and three of its nearest countries that
 * don't border it (drawn from the NEAREST such), so exactly one option is right.
 */
export function neighbourOptions(neighbours: Neighbours, target: CountryId, random: RandomSource, pool: readonly CountryId[] = CHALLENGE_POOL): CountryId[] {
  const near = poolNeighbours(neighbours, target, pool);
  if (near.length === 0) throw new Error(`${target} has no neighbour in the pool`);
  const right = near[Math.floor(random() * near.length)];
  const others = pool
    .filter((id) => id !== target && !near.includes(id))
    .sort((a, b) => distance(target, a) - distance(target, b))
    .slice(0, NEAREST);
  return shuffle([right, ...shuffle(others, random).slice(0, NEIGHBOUR_OPTIONS - 1)], random);
}

export interface NeighboursRound {
  round: ChallengeRound;
  /** Each question's options, in the order shown. */
  options: CountryId[][];
}

/** A neighbours round, drawn and waiting for Start: its 15 countries and each one's options. */
export function createNeighboursRound(neighbours: Neighbours, random: RandomSource): NeighboursRound {
  const pool = neighboursPool(neighbours);
  const round = createChallenge(random, { pool, rules: NEIGHBOURS_RULES });
  // Options from the round's own pool: each is an answer the engine takes.
  return { round, options: round.questions.map((target) => neighbourOptions(neighbours, target, random, pool)) };
}

/**
 * The engine's answer for an option chosen: the asked country itself when the option borders it (a correct answer),
 * else the option (a wrong answer, recorded with it).
 */
export function neighbourAnswer(neighbours: Neighbours, target: CountryId, option: CountryId): CountryId {
  return borders(neighbours, target, option) ? target : option;
}
