import { afterEach, describe, expect, it, vi } from "vitest";
import { CHALLENGE_POOL } from "@/core/challenge/europe";
import { qrCode } from "@/core/challenge/qrCode";
import { answer, challengeResult, currentQuestion, tick, type ChallengeResult, type ChallengeRound } from "@/core/challenge/quickChallenge";
import { SITE_URL, shareSummary, shareText } from "@/core/challenge/share";
import { CARD_HEIGHT, CARD_WIDTH, SPOTS, templateFit } from "@/core/challenge/shareCardLayout";
import type { CountryId } from "@/core/content/types";
import { seededRandom } from "@/core/game/random";
import { roundClock, type ClockSources } from "./clock";
import { levelOf, mapTones, roundNames } from "./results";
import { newSession, startSession } from "./session";

/*
 * What a practice round's Results show and share: the map's colours and names, the levels to practise in, and the
 * share card's words in both languages, all from the shared code.
 */

/** Plays a round on a test clock: `plan` per question, "c" right, "w" wrong (another pool country), "s" skipped. */
function play(plan: string, { timeOutAfter }: { timeOutAfter?: number } = {}) {
  let mono = 0;
  const sources: ClockSources = { mono: () => mono, wall: () => 1_700_000_000_000 + mono };
  const clock = roundClock(sources);
  let round: ChallengeRound = startSession(newSession(seededRandom(11), "r"), clock).round;
  for (const [i, step] of [...plan].entries()) {
    if (timeOutAfter !== undefined && i >= timeOutAfter) break;
    mono += 1_000;
    round = tick(round, clock.now());
    const q = currentQuestion(round)!;
    const other = CHALLENGE_POOL.find((id) => id !== q.target)!;
    round = answer(round, q.index, step === "c" ? q.target : step === "w" ? other : null, clock.now()).round;
    mono += 400;
  }
  mono += timeOutAfter !== undefined ? 60_000 : 0;
  round = tick(round, clock.now());
  return { round, result: challengeResult(round)! };
}

describe("practice Results", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("colour every question's country, and the wrong choices, as the website does; name the missed ones first", () => {
    const { round, result } = play("cccwccccccccscc");
    const tones = mapTones(round, result, null);
    for (const q of result.questions) expect(tones[q.target]).toBe(q.outcome === "correct" ? "correct" : "missed");
    const chosen = result.missed.find((m) => m.outcome === "wrong")!.chosen!;
    if (!result.questions.some((q) => q.target === chosen)) expect(tones[chosen]).toBe("chosen");
    const names = roundNames(result);
    expect(names).toHaveLength(15);
    expect(names.slice(0, result.missed.length)).toEqual(result.missed.map((m) => m.target));
  });

  it("during a round, colour only the last answer's countries while its feedback shows", () => {
    let mono = 0;
    const clock = roundClock({ mono: () => mono, wall: () => mono });
    let round = startSession(newSession(seededRandom(2), "r"), clock).round;
    expect(mapTones(round, null, null)).toEqual({});
    const q = currentQuestion(round)!;
    const wrong: CountryId = CHALLENGE_POOL.find((id) => id !== q.target)!;
    mono += 500;
    round = answer(round, q.index, wrong, clock.now()).round;
    const feedback = round.answers[0];
    expect(mapTones(round, null, feedback)).toEqual({ [q.target]: "missed", [wrong]: "chosen" });
  });

  it("link each missed country to the first level that teaches it: every country the challenge asks has one", () => {
    expect(levelOf("FRA")?.number).toBe(1);
    expect(levelOf("EST")?.number).toBe(6);
    expect(levelOf("ISL")?.number).toBe(10);
    expect(levelOf("GBR")?.number).toBe(11);
    expect(levelOf("RUS")?.number).toBe(12);
    expect(CHALLENGE_POOL.filter((id) => !levelOf(id))).toEqual([]);
  });

  it("share the score, the round's size and its time in both languages, with the site's address, and nothing else", () => {
    const timedOut = play("ccccccccccccccc", { timeOutAfter: 12 }).result;
    expect(timedOut).toMatchObject({ endReason: "timeUp", score: 12, total: 15 });
    const en = shareText(shareSummary(timedOut), "en");
    expect(en.score).toBe("12/15");
    expect(en.found).toBe("12/15 countries · 60 seconds");
    expect(en.message).toBe(`12/15 countries · 60 seconds. Can you beat my score? ${SITE_URL}`);
    expect(en.player).toBeNull();
    const hy = shareText(shareSummary(timedOut), "hy");
    expect(hy.found).toBe("12/15 երկիր · 60 վայրկյան");
    expect(hy.capitals).toBe(false);
    expect(hy.url).toBe(SITE_URL);

    const completed: ChallengeResult = play("ccccccccccccccc").result;
    expect(completed).toMatchObject({ endReason: "completed", score: 15 });
    // 15 answers a second apart, with 14 feedbacks between: 20.6 s, shared as 21.
    expect(shareText(shareSummary(completed), "en").found).toBe("15/15 countries · 21 seconds");
  });

  it("the card is the website's: its size, its places in the template, and a QR code to the site", () => {
    expect([CARD_WIDTH, CARD_HEIGHT]).toEqual([1080, 1350]);
    const { s, X, Y } = templateFit();
    // The template covers the card: its corners at or beyond the card's.
    expect(X(0)).toBeLessThanOrEqual(0);
    expect(Y(0)).toBeLessThanOrEqual(0);
    expect(X(1122)).toBeGreaterThanOrEqual(CARD_WIDTH - 1e-9);
    expect(s).toBeGreaterThan(0.95);
    expect(SPOTS.pill.x1).toBeGreaterThan(SPOTS.pill.x0);
    const modules = qrCode(SITE_URL);
    expect(modules.length).toBeGreaterThanOrEqual(21);
    expect(modules.every((row) => row.length === modules.length)).toBe(true);
  });

  it("play with no network at all: nothing is fetched, from Start to Results", () => {
    const fetch = vi.fn(() => Promise.reject(new Error("offline")));
    vi.stubGlobal("fetch", fetch);
    const { result } = play("cwscccccccccccc");
    expect(result.score).toBe(13);
    shareText(shareSummary(result), "hy");
    expect(fetch).not.toHaveBeenCalled();
  });
});
