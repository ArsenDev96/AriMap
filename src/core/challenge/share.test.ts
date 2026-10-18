import { describe, expect, it } from "vitest";
import { answer, challengeResult, createChallenge, startChallenge, tick, type ChallengeRound } from "./quickChallenge";
import { roundSeconds, shareSummary, shareText, SITE_HOST, SITE_URL } from "./share";

/** A round played from Start at 0, each question answered at the time listed (ms): right, wrong or skipped. */
function play(times: readonly number[], outcomes: readonly ("right" | "wrong" | "skip")[], end?: number): ChallengeRound {
  let round = startChallenge(createChallenge(() => 0.5), 0);
  times.forEach((at, i) => {
    round = tick(round, at);
    const target = round.questions[round.index];
    const other = round.pool.find((id) => id !== target)!;
    const choice = outcomes[i] === "right" ? target : outcomes[i] === "wrong" ? other : null;
    round = answer(round, round.index, choice, at).round;
    round = tick(round, at + 400);
  });
  return end === undefined ? tick(round, times.at(-1)! + 400) : tick(round, end);
}

describe("Quick Challenge sharing", () => {
  it("rounds a round's time to the nearest second, at least 1, as the Results do", () => {
    expect(roundSeconds(41_499)).toBe(41);
    expect(roundSeconds(41_500)).toBe(42);
    expect(roundSeconds(200)).toBe(1);
    expect(roundSeconds(60_000)).toBe(60);
  });

  it("shares a timed-out round as its correct answers out of 15 and the whole 60 seconds", () => {
    const round = play([1000, 3000, 5000], ["right", "wrong", "right"], 60_000);
    const result = challengeResult(round)!;
    expect(result.endReason).toBe("timeUp");
    expect(shareSummary(result)).toEqual({ endReason: "timeUp", correct: 2, total: 15, seconds: 60, displayName: null });
    expect(shareText(shareSummary(result), "en").found).toBe("2/15 countries · 60 seconds");
  });

  it("shares a completed round with mistakes by its correct answers, not its questions, and its time", () => {
    const times = Array.from({ length: 15 }, (_, i) => 2000 + i * 2700); // the last at 39.8 s
    const outcomes = times.map((_, i): "right" | "wrong" | "skip" => (i % 5 === 0 ? "wrong" : i === 7 ? "skip" : "right"));
    const result = challengeResult(play(times, outcomes))!;
    expect(result.endReason).toBe("completed");
    expect(shareSummary(result)).toEqual({ endReason: "completed", correct: 11, total: 15, seconds: 40, displayName: null });
    const en = shareText(shareSummary(result), "en");
    expect(en.found).toBe("11/15 countries · 40 seconds");
    expect(en.beat).toBe("Can you beat my score?");
    expect(en.fileName).toBe("arimap-quick-challenge-11-of-15.png");
    const hy = shareText(shareSummary(result), "hy");
    expect(hy.found).toBe("11/15 երկիր · 40 վայրկյան");
    expect(hy.appName).toBe("ԱրիՄապ");
  });

  it("links to the public home page only, and shares nothing about the answers", () => {
    expect(SITE_URL).toBe("https://arimap.world");
    expect(SITE_HOST).toBe("arimap.world");
    const result = challengeResult(play([1000], ["wrong"], 60_000))!;
    for (const locale of ["en", "hy"] as const) {
      const text = shareText(shareSummary(result), locale);
      expect(text.url).toBe(SITE_URL);
      expect(text.message).toContain(SITE_URL);
      // No country of the round (asked or chosen) in anything shared.
      const shared = JSON.stringify(text);
      for (const q of result.questions) expect(shared).not.toContain(q.target);
    }
  });
});
