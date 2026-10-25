/// <reference types="node" />
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { challengeMapFrom } from "@/geo/challengeMap";
import { COUNTRIES } from "../content/countries";
import { seededRandom } from "../game/random";
import { LEVELS, travelCountries } from "../lessons";
import { CHALLENGE_POOL } from "./europe";
import { borders, createNeighboursRound, NEIGHBOUR_OPTIONS, neighbourAnswer, neighbourOptions, neighboursPool, NEIGHBOURS_RULES, poolNeighbours } from "./neighbours";
import { answer, challengeResult, currentQuestion, startChallenge, tick } from "./quickChallenge";

const map = challengeMapFrom(JSON.parse(readFileSync(path.resolve(__dirname, "../../data/geo/europe-challenge.topo.json"), "utf8")));
const neighbours = map.neighbours;

describe("the neighbours round", () => {
  it("knows each country's land neighbours from the map's shared borders, as every level's border graph has them", () => {
    // Every pair of countries a level travels through: a border in the level's graph (checked against the CIA World
    // Factbook, docs/DATA.md) exactly where the map shares one. The levels' fixed links (the Øresund, the Channel
    // Tunnel) join countries that share no land border, and are no neighbours here.
    for (const level of LEVELS) {
      const lesson = level.lesson!;
      const ids = travelCountries(lesson);
      const linked = (a: string, b: string) => (lesson.map.borderLinks ?? []).some((l) => l.between.includes(a) && l.between.includes(b));
      for (const a of ids) {
        for (const b of ids) if (a < b) expect(borders(neighbours, a, b), `${level.id}: ${a}–${b}`).toBe(lesson.borders[a].includes(b) && !linked(a, b));
      }
    }
    expect(borders(neighbours, "DNK", "SWE")).toBe(false);
    expect(borders(neighbours, "FRA", "GBR")).toBe(false);
    // A few beyond the levels' pairs, and no sea crossing: the United Kingdom meets Ireland only; Denmark, Germany only.
    expect(poolNeighbours(neighbours, "GBR")).toEqual(["IRL"]);
    expect(poolNeighbours(neighbours, "DNK")).toEqual(["DEU"]);
    expect([...poolNeighbours(neighbours, "HUN")].sort()).toEqual(["AUT", "HRV", "ROU", "SRB", "SVK", "SVN", "UKR"]);
    expect(borders(neighbours, "ITA", "HRV")).toBe(false);
  });

  it("asks every country of the pool but Iceland, the one with no land neighbour; each has a label point for distances", () => {
    expect(CHALLENGE_POOL.filter((id) => poolNeighbours(neighbours, id).length === 0)).toEqual(["ISL"]);
    expect(neighboursPool(neighbours)).toHaveLength(39);
    for (const id of CHALLENGE_POOL) expect(COUNTRIES[id]?.label.coordinates, id).toBeTruthy();
  });

  it("offers four countries for each question: exactly one of its neighbours, never the country itself, all answerable", () => {
    const pool = neighboursPool(neighbours);
    for (const target of pool) {
      for (let seed = 1; seed <= 20; seed++) {
        const options = neighbourOptions(neighbours, target, seededRandom(seed), pool);
        expect(options, target).toHaveLength(NEIGHBOUR_OPTIONS);
        expect(new Set(options).size, target).toBe(NEIGHBOUR_OPTIONS);
        expect(options, target).not.toContain(target);
        expect(options.filter((o) => borders(neighbours, target, o)), target).toHaveLength(1);
        for (const o of options) expect(pool, `${target}: ${o}`).toContain(o);
      }
    }
  });

  it("plays by the shared engine: a neighbour answers the country, another option is a wrong answer recorded as chosen", () => {
    const { round: drawn, options } = createNeighboursRound(neighbours, seededRandom(7));
    expect(drawn.rules).toBe(NEIGHBOURS_RULES);
    expect(drawn.questions).toHaveLength(15);
    expect(drawn.questions).not.toContain("ISL");
    expect(options).toHaveLength(15);
    let round = startChallenge(drawn, 0);
    expect(round.deadline).toBe(600_000);
    let now = 0;
    for (let i = 0; i < 15; i++) {
      const q = currentQuestion(round)!;
      const right = options[i].find((o) => borders(neighbours, q.target, o))!;
      const wrong = options[i].find((o) => !borders(neighbours, q.target, o))!;
      // Right on even questions, wrong on odd ones.
      const choice = i % 2 === 0 ? right : wrong;
      now += 5_000;
      round = answer(round, q.index, neighbourAnswer(neighbours, q.target, choice), now).round;
      now += 3_000;
      round = tick(round, now);
    }
    const result = challengeResult(round)!;
    expect(result).toMatchObject({ endReason: "completed", score: 8, incorrect: 7 });
    for (const m of result.missed) expect(m.chosen && !borders(neighbours, m.target, m.chosen)).toBe(true);
  });
});
