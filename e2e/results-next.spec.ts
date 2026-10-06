import { expect, test, type Page } from "@playwright/test";
import { homeToEurope } from "./helpers/home";
import { openWithSave } from "./helpers/save";

/*
 * Continue versus Play again, and what Results offers next.
 * - Continue appears only for an attempt under way (started, not at the Results of a finished attempt):
 *   an unfinished level, or a completed level being played again (Replay journey, Play again). A
 *   finished attempt, at its Results, offers View results (reopening them as they are, without asking)
 *   and Play again (which asks first) instead. A completion record alone (an older save) has no Results to view.
 * - Results: Next level as the pinned main action when another playable level follows in the continent
 *   (at Discover if never started, otherwise exactly where it was left), Back to levels after the last
 *   playable one; Replay journey and Play again above it, in the page.
 * Refreshes, language changes and cancelled confirmations keep everything.
 */

const project = () => test.info().project.name;
const L = ["western-europe-1", "around-the-alps", "central-europe", "along-the-adriatic", "towards-greece", "baltic-journey", "iberian-journey", "eastern-europe"];
const [L1, L2, L3, , , L6, L7, L8] = L;
const COUNTRIES: Record<string, string[]> = {
  "western-europe-1": ["FRA", "BEL", "NLD", "LUX", "DEU"],
  "around-the-alps": ["FRA", "CHE", "DEU", "AUT", "ITA"],
  "central-europe": ["DEU", "POL", "CZE", "SVK", "AUT"],
  "along-the-adriatic": ["ITA", "SVN", "HRV", "BIH", "MNE"],
  "towards-greece": ["HUN", "ROU", "SRB", "BGR", "GRC"],
  "baltic-journey": ["DEU", "POL", "LTU", "LVA", "EST"],
  "iberian-journey": ["PRT", "ESP", "AND", "FRA", "ITA"],
  "eastern-europe": ["POL", "BLR", "UKR", "MDA", "ROU"],
};
const ROUTES: Record<string, [string, string[]]> = {
  "western-europe-1": ["fra-to-nld", ["FRA", "BEL", "NLD"]],
  "around-the-alps": ["fra-to-aut", ["FRA", "DEU", "AUT"]],
  "central-europe": ["pol-to-aut", ["POL", "CZE", "AUT"]],
  "along-the-adriatic": ["ita-to-mne", ["ITA", "SVN", "HRV", "MNE"]],
  "towards-greece": ["hun-to-grc", ["HUN", "ROU", "BGR", "GRC"]],
  "baltic-journey": ["deu-to-est", ["DEU", "POL", "LTU", "LVA", "EST"]],
  "iberian-journey": ["prt-to-ita", ["PRT", "ESP", "FRA", "ITA"]],
  "eastern-europe": ["pol-to-mda", ["POL", "UKR", "MDA"]],
};
const records = (travelDone: boolean) => ({ discoverDone: true, findDone: travelDone, travelDone, lastFindScore: null, bestFindScore: null, travelWithoutHelp: false });
/** A level finished, at its Results. */
const done = (id: string) => {
  const order = COUNTRIES[id];
  const [missionId, route] = ROUTES[id];
  return {
    started: true,
    stage: "results",
    discover: { selected: null, explored: order },
    find: { order, index: 4, question: { target: order[4], wrongGuesses: [], hintLevel: 0, solved: true, feedback: null }, results: order.map((target) => ({ target, wrongGuesses: 0, hintLevel: 0 })), status: "complete" },
    travel: { missionId, path: route, hintUsed: false, undoUsed: false },
    lastTravelResult: { missionId, route, hintUsed: false, undoUsed: false },
    records: { ...records(true), lastFindScore: { independent: 5, total: 5 }, bestFindScore: { independent: 5, total: 5 } },
  };
};
/** Level 3 in Find, on its second question (Czechia), after a wrong tap on Slovakia and the first hint. */
const L3_IN_FIND = {
  started: true,
  stage: "find",
  discover: { selected: null, explored: COUNTRIES[L3] },
  find: {
    order: ["POL", "CZE", "DEU", "SVK", "AUT"],
    index: 1,
    question: { target: "CZE", wrongGuesses: ["SVK"], hintLevel: 1, solved: false, feedback: { kind: "wrong", country: "SVK" } },
    results: [{ target: "POL", wrongGuesses: 0, hintLevel: 0 }],
    status: "asking",
  },
  records: records(false),
};
/** Level 2 completed and its journey being replayed: in Travel, France → Switzerland so far. */
const L2_REPLAYING = { ...done(L2), stage: "travel", travel: { missionId: "fra-to-aut", path: ["FRA", "CHE"], hintUsed: false, undoUsed: false } };
const ALL_DONE = Object.fromEntries(L.map((id) => [id, done(id)]));

async function open(page: Page, levels: Record<string, object>, { screen = "lesson", levelId = L1, recent, locale = "en" }: { screen?: string; levelId?: string; recent?: string[]; locale?: string } = {}) {
  await openWithSave(page, { version: 2, locale, screen, continent: "europe", levelId, recent: recent ?? [levelId], levels });
  await expect(page.locator(".splash")).toHaveCount(0);
}

const saved = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("arimap:state")!) as { levels: Record<string, { started: boolean; stage: string; records: { travelDone: boolean } }> });
const card = (page: Page, id: string) => page.getByTestId(`level-${id}`);
const continueHome = (page: Page) => page.getByTestId("continents-actions").getByRole("button");
const dialog = (page: Page) => page.getByTestId("start-over-dialog");
const journeyComplete = (page: Page) => page.getByRole("heading", { name: "Journey complete!" });

async function expectFindAsLeft(page: Page) {
  await expect(page.getByTestId("find-prompt")).toHaveText("Find Czechia");
  await expect(page.getByTestId("find-progress")).toHaveText("Question 2 of 5");
  await expect(page.getByText("Its capital is Prague.")).toBeVisible();
  await expect(page.getByTestId("find-feedback")).toContainText("Try again.");
}

/** Opens a completed level's one-line card, so its buttons show. */
async function expand(page: Page, id: string) {
  const toggle = card(page, id).getByTestId("level-details-toggle");
  if ((await toggle.count()) > 0 && (await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
}

test.describe("Continue only for an attempt under way", () => {
  test.beforeEach(() => test.skip(project() !== "small-phone", "Runs once."));

  test("unfinished Find: Continue resumes the exact question; a finished level at Results offers Play again, and cancelling keeps it", async ({ page }) => {
    await open(page, { [L1]: done(L1), [L2]: done(L2), [L3]: L3_IN_FIND }, { screen: "continents", levelId: L3, recent: [L3, L2, L1] });
    await expect(continueHome(page)).toHaveAttribute("data-level", L3);
    await continueHome(page).click();
    await expectFindAsLeft(page);
    await page.reload();
    await expectFindAsLeft(page);
    await homeToEurope(page);
    // Level 3 (unfinished): Continue and Start over. Levels 1 and 2 (finished, at their Results): View results and Play again.
    await expect(card(page, L3).getByRole("button", { name: /^Continue/ })).toBeVisible();
    await expect(card(page, L3).getByRole("button", { name: /^Start over/ })).toBeVisible();
    await expect(card(page, L3).getByTestId("view-results")).toHaveCount(0);
    for (const id of [L1, L2]) {
      await expand(page, id);
      await expect(card(page, id).getByRole("button", { name: /^Continue/ })).toHaveCount(0);
      await expect(card(page, id).getByRole("button", { name: /^View results/ })).toHaveCount(1);
      await expect(card(page, id).getByRole("button", { name: /^Play again/ })).toHaveCount(1);
    }
    // Play again asks first; cancelling (Not now, Escape) keeps its Results, its completion and every other level.
    const before = await saved(page);
    await card(page, L2).getByRole("button", { name: /^Play again/ }).click();
    await expect(dialog(page).getByRole("heading")).toHaveText("Play “Around the Alps” again?");
    await dialog(page).getByRole("button", { name: "Not now" }).click();
    await card(page, L2).getByRole("button", { name: /^Play again/ }).click();
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toBeHidden();
    await page.reload();
    expect((await saved(page)).levels).toEqual(before.levels);
    await expect(card(page, L2).getByTestId("level-status")).toHaveText("Completed");
    await card(page, L3).getByRole("button", { name: /^Continue/ }).click();
    await expectFindAsLeft(page);
  });

  test("a Travel replay of a completed level: Continue resumes the replay, from the home screen and from its card", async ({ page }) => {
    await open(page, { [L1]: done(L1), [L2]: L2_REPLAYING }, { screen: "continents", levelId: L2, recent: [L2, L1] });
    await expect(continueHome(page)).toHaveAttribute("data-level", L2);
    await continueHome(page).click();
    await expect(page.locator('[data-testid="map-main"] [data-testid="route-line"]')).toHaveAttribute("data-route", "FRA,CHE");
    await homeToEurope(page);
    await expect(card(page, L2).getByTestId("level-status")).toHaveText("Completed");
    await expand(page, L2);
    await expect(card(page, L2).getByRole("button", { name: /^Play again/ })).toBeVisible();
    // Its saved Results give way to the replay: Continue, not View results.
    await expect(card(page, L2).getByTestId("view-results")).toHaveCount(0);
    await card(page, L2).getByRole("button", { name: /^Continue/ }).click();
    await expect(page.locator('[data-testid="map-main"] [data-testid="route-line"]')).toHaveAttribute("data-route", "FRA,CHE");
    expect((await saved(page)).levels[L2]).toMatchObject({ stage: "travel", records: { travelDone: true } });
  });

  test("everything finished: no Continue anywhere, Explore Europe stays on the home screen", async ({ page }) => {
    await open(page, ALL_DONE, { screen: "continents", levelId: L8, recent: [...L].reverse() });
    await expect(continueHome(page)).toHaveAttribute("data-testid", "explore-europe");
    await continueHome(page).click();
    for (const id of L) {
      await expand(page, id);
      await expect(card(page, id).getByRole("button", { name: /^Continue/ })).toHaveCount(0);
      await expect(card(page, id).getByTestId("view-results")).toBeVisible();
    }
    await expect(page.getByTestId("welcome-actions")).toHaveCount(0);
  });
});

test.describe("View results", () => {
  test.beforeEach(() => test.skip(project() !== "small-phone", "Runs once."));

  test("reopens a finished level's saved Results as they are, without asking; refresh, Home and language keep them", async ({ page }) => {
    await open(page, { [L1]: done(L1), [L2]: done(L2) }, { screen: "levels", levelId: L2, recent: [L2, L1] });
    const before = (await saved(page)).levels;
    await expand(page, L1);
    const view = card(page, L1).getByTestId("view-results");
    await expect(view).toHaveText("View results");
    await expect(view).toHaveAccessibleName("View results: France and its neighbours");
    await expect(view).not.toHaveAttribute("aria-haspopup");
    await view.click();
    // Straight to the saved Results: no question, nothing reset.
    await expect(dialog(page)).toBeHidden();
    await expect(journeyComplete(page)).toBeVisible();
    await expect(page.getByTestId("result-route")).toHaveText(/France.*Belgium.*Netherlands/);
    await expect(page.getByTestId("result-find")).toContainText("5/5");
    await expect(page.getByTestId("next-level")).toHaveAttribute("data-level", L2);
    expect((await saved(page)).levels).toEqual(before);
    await page.reload();
    await expect(journeyComplete(page)).toBeVisible();
    // Armenian: the same Results, and the card's label in Armenian.
    await page.getByRole("button", { name: "Հայերեն", exact: true }).first().click();
    await expect(page.getByRole("heading", { name: "Ճամփորդությունն ավարտվեց։" })).toBeVisible();
    await homeToEurope(page);
    await expand(page, L1);
    await expect(card(page, L1).getByTestId("view-results")).toHaveText("Դիտել արդյունքը");
    await expect(card(page, L1).getByTestId("view-results")).toHaveAccessibleName("Դիտել արդյունքը՝ Ֆրանսիան և իր հարևանները");
    expect((await saved(page)).levels).toEqual(before);
    // Play again beside it still asks first.
    await card(page, L1).getByRole("button", { name: /^Խաղալ նորից/ }).click();
    await expect(dialog(page)).toBeVisible();
    await page.keyboard.press("Escape");
    expect((await saved(page)).levels).toEqual(before);
  });

  test("a completion record alone (an older save, no Results kept): Play again, and no Results made up", async ({ page }) => {
    const recordOnly = { started: false, stage: "discover", records: { ...records(true), lastFindScore: { independent: 4, total: 5 } } };
    await open(page, { [L1]: recordOnly }, { screen: "levels", levelId: L1 });
    await expand(page, L1);
    await expect(card(page, L1).getByTestId("level-status")).toHaveText("Completed");
    await expect(card(page, L1).getByTestId("view-results")).toHaveCount(0);
    await expect(card(page, L1).getByRole("button", { name: /^Continue/ })).toHaveCount(0);
    // Nothing to lose, so it starts at once, at Discover; the level stays completed.
    await card(page, L1).getByRole("button", { name: /^Play again/ }).click();
    await expect(dialog(page)).toBeHidden();
    await expect(page.getByTestId("discover-progress")).toContainText("0/5");
    expect((await saved(page)).levels[L1]).toMatchObject({ started: true, stage: "discover", records: { travelDone: true } });
  });
});

test.describe("Results: what next", () => {
  test.beforeEach(() => test.skip(project() !== "small-phone", "Runs once."));

  test("Next level opens an unstarted level at Discover; the finished level keeps its Results", async ({ page }) => {
    await open(page, { [L1]: done(L1) });
    await expect(journeyComplete(page)).toBeVisible();
    const next = page.getByTestId("next-level");
    await expect(next).toHaveAccessibleName("Next level: Level 2, Around the Alps");
    await expect(next).toContainText("Level 2");
    await expect(page.getByTestId("replay-journey")).toHaveText("Replay journey");
    await expect(page.getByTestId("results-play-again")).toHaveText("Play again");
    await next.click();
    await expect(page.getByRole("heading", { name: "Tap a country to learn about it." })).toBeVisible();
    await expect(page.getByTestId("discover-progress")).toContainText("0/5");
    const s = await saved(page);
    expect(s.levels[L2]).toMatchObject({ started: true, stage: "discover" });
    expect(s.levels[L1]).toMatchObject({ stage: "results", records: { travelDone: true } });
    await page.reload();
    await expect(page.getByTestId("discover-progress")).toContainText("0/5");
  });

  test("Next level resumes a level already in progress exactly where it was left", async ({ page }) => {
    await open(page, { [L1]: done(L1), [L2]: done(L2), [L3]: L3_IN_FIND }, { levelId: L2, recent: [L2, L3, L1] });
    await expect(page.getByTestId("next-level")).toHaveAccessibleName("Next level: Level 3, Central Europe");
    await page.getByTestId("next-level").click();
    await expectFindAsLeft(page);
    expect((await saved(page)).levels[L2]).toMatchObject({ stage: "results" });
  });

  test("after the last playable level: Back to levels, never coming-soon content; Level 6 still offers Level 7, and Level 7 Level 8", async ({ page }) => {
    await open(page, ALL_DONE, { levelId: L6 });
    await expect(page.getByTestId("next-level")).toHaveAccessibleName("Next level: Level 7, Iberian Journey");
    await open(page, ALL_DONE, { levelId: L7 });
    await expect(page.getByTestId("next-level")).toHaveAccessibleName("Next level: Level 8, Eastern Europe");
    await expect(page.getByTestId("next-level")).toHaveAttribute("data-level", L8);
    await expect(page.getByTestId("back-to-levels")).toHaveCount(0);
    await open(page, ALL_DONE, { levelId: L8 });
    await expect(journeyComplete(page)).toBeVisible();
    await expect(page.getByTestId("next-level")).toHaveCount(0);
    await page.getByTestId("back-to-levels").click();
    await expect(page.getByTestId("welcome")).toBeVisible();
    await expect(page.getByTestId("continent-title")).toHaveText("Europe");
    expect((await saved(page)).levels[L8]).toMatchObject({ stage: "results", records: { travelDone: true } });
  });

  test("Play again asks first (cancelling keeps Results, also after a refresh); Replay journey then Continue resumes it", async ({ page }) => {
    await open(page, { [L1]: done(L1), [L2]: done(L2) }, { recent: [L1, L2] });
    await page.getByTestId("results-play-again").click();
    await expect(dialog(page).getByRole("heading")).toHaveText("Play “France and its neighbours” again?");
    await expect(dialog(page).getByRole("button", { name: "Not now" })).toBeFocused();
    await dialog(page).getByRole("button", { name: "Not now" }).click();
    await expect(journeyComplete(page)).toBeVisible();
    await page.reload();
    await expect(journeyComplete(page)).toBeVisible();
    // Replay journey: Travel again; Home, then Continue, resumes that replay.
    await page.getByTestId("replay-journey").click();
    await expect(page.getByTestId("crossings-left")).toBeVisible();
    await page.getByTestId("home").click();
    await expect(continueHome(page)).toHaveAttribute("data-level", L1);
    await continueHome(page).click();
    await expect(page.getByTestId("crossings-left")).toBeVisible();
    // Play again confirmed (from a fresh Results): Discover, the level and the next stay completed and open.
    await open(page, { [L1]: done(L1), [L2]: done(L2) }, { recent: [L1, L2] });
    await page.getByTestId("results-play-again").click();
    await dialog(page).getByRole("button", { name: "Play again" }).click();
    await expect(page.getByTestId("discover-progress")).toContainText("0/5");
    const s = await saved(page);
    expect(s.levels[L1]).toMatchObject({ stage: "discover", records: { travelDone: true } });
    expect(s.levels[L2]).toMatchObject({ stage: "results", records: { travelDone: true } });
    await homeToEurope(page);
    await expect(card(page, L3).getByTestId("level-status")).toHaveText("Ready to play");
  });

  test("switching language keeps Results and names its actions in Armenian", async ({ page }) => {
    await open(page, { [L1]: done(L1) }, { locale: "hy" });
    const next = page.getByTestId("next-level");
    await expect(next).toContainText("Հաջորդ մակարդակը");
    await expect(next).toHaveAccessibleName(/^Հաջորդ մակարդակը՝ Մակարդակ 2, .+/);
    // Short Armenian labels (every word fits a phone at 200% text); the names say what each acts on.
    await expect(page.getByTestId("replay-journey")).toHaveText("Նորից ճամփորդել");
    await expect(page.getByTestId("replay-journey")).toHaveAccessibleName("Նորից ճամփորդել՝ Ֆրանսիան և իր հարևանները");
    await expect(page.getByTestId("results-play-again")).toHaveText("Խաղալ նորից");
    const before = (await saved(page)).levels;
    await page.getByRole("button", { name: "English", exact: true }).first().click();
    await expect(next).toHaveAccessibleName("Next level: Level 2, Around the Alps");
    await expect(journeyComplete(page)).toBeVisible();
    expect((await saved(page)).levels).toEqual(before);
    await open(page, ALL_DONE, { levelId: L8, locale: "hy" });
    await expect(page.getByTestId("back-to-levels")).toHaveText("Վերադառնալ ցանկին");
    await expect(page.getByTestId("back-to-levels")).toHaveAccessibleName("Վերադառնալ ցանկին՝ Եվրոպայի մակարդակներին");
    await page.getByRole("button", { name: "English", exact: true }).first().click();
    await expect(page.getByTestId("back-to-levels")).toHaveAccessibleName("Back to levels: Europe");
  });
});

/**
 * The words of a box's visible text broken across lines without need (a visually hidden part is
 * skipped). Only a word wider than all the room inside the box (its width less its padding) may
 * break, as a last resort; any other broken word is listed.
 */
function brokenWords(locator: ReturnType<Page["locator"]>) {
  return locator.evaluate((el) => {
    const range = document.createRange();
    const out: string[] = [];
    const wider = (word: string, from: Element) => {
      const probe = document.createElement("span");
      probe.textContent = word;
      const style = getComputedStyle(from);
      Object.assign(probe.style, { position: "absolute", visibility: "hidden", whiteSpace: "nowrap", font: style.font, letterSpacing: style.letterSpacing });
      document.body.append(probe);
      const width = probe.getBoundingClientRect().width;
      probe.remove();
      const box = getComputedStyle(el);
      return width > el.clientWidth - parseFloat(box.paddingLeft) - parseFloat(box.paddingRight);
    };
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.parentElement!.getBoundingClientRect().width <= 1) continue;
      for (const m of (node.textContent ?? "").matchAll(/\S+/g)) {
        range.setStart(node, m.index!);
        range.setEnd(node, m.index! + m[0].length);
        if (new Set([...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top))).size > 1 && !wider(m[0], node.parentElement!)) out.push(m[0]);
      }
    }
    return out;
  });
}

/** Sets the root text size (100 = the usual 16px) and waits for the layout to follow. */
async function textSize(page: Page, size: number) {
  await page.evaluate(async (s) => {
    document.documentElement.style.fontSize = s === 100 ? "" : `${s}%`;
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, size);
}

const fontSize = (locator: ReturnType<Page["locator"]>) => locator.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
const SECONDARY = ["replay-journey", "results-play-again"];

/**
 * The actions on phones (a short one included) and on desktop, at the usual text size and at 200%:
 * - the main action pinned at the bottom, on screen as Results opens;
 * - each of Replay journey and Play again, scrolled to on its own, wholly in view between the top of
 *   the scrolling panel (under the map on a phone) and the pinned main action;
 * - every button a full touch target with its text at the full enlarged size (the test fails if text
 *   is made smaller to fit), wrapping between words, every word whole;
 * - each country's result beside it or, where both don't fit, under it: in full, at full size, inside
 *   the panel; nothing wider than the screen.
 */
test("Results actions and rows: full-size text, whole words, each action reachable, at every size and text size", async ({ page }) => {
  const sizes = project() === "desktop" ? [[1366, 800]] : project() === "small-phone" ? [[320, 568], [390, 664], [390, 844]] : [];
  test.skip(sizes.length === 0, "Runs at 320×568, 390×664 and 390×844 (small-phone), and on desktop.");
  test.setTimeout(600_000);
  for (const [width, height] of sizes)
    for (const locale of ["en", "hy"] as const)
      for (const last of [false, true])
        for (const size of [100, 200]) {
          await page.setViewportSize({ width, height });
          await open(page, last ? ALL_DONE : { [L1]: done(L1) }, { levelId: last ? L8 : L1, locale });
          await textSize(page, size);
          const where = `${width}×${height} ${locale} ${last ? "last level" : "Level 1"} ${size}%`;
          const rem = (16 * size) / 100;
          const name = `${locale}-${last ? "last" : "next"}${size === 100 ? "" : `-text${size}`}-${width}x${height}`;
          const mainId = last ? "back-to-levels" : "next-level";
          const main = page.getByTestId(mainId);
          const panel = page.getByTestId("panel");

          // Pinned and on screen as Results opens.
          const m = (await main.boundingBox())!;
          expect(m.y + m.height, `${where}: main action below the screen`).toBeLessThanOrEqual(height + 0.5);
          expect(m.y, `${where}: main action above the screen`).toBeGreaterThanOrEqual(0);
          if (size === 100) await page.screenshot({ path: `screenshots/${project()}/results-actions-${name.replace(`-${width}x`, `-top-${width}x`)}.png` });

          // The text at its full size, enlarged with the rest: never made smaller to fit.
          expect(await fontSize(main), `${where}: main action text size`).toBeCloseTo(1.1 * rem, 0);
          if (!last) expect(await fontSize(main.locator("span").nth(1)), `${where}: Next level's level line`).toBeCloseTo(0.9 * rem, 0);
          for (const id of SECONDARY) expect(await fontSize(page.getByTestId(id)), `${where}: ${id} text size`).toBeCloseTo(1.05 * rem, 0);
          // Labels wrap between words, the buttons growing taller; every word whole.
          for (const id of [...SECONDARY, mainId]) {
            const b = (await page.getByTestId(id).boundingBox())!;
            expect(b.height, `${where}: ${id} touch target`).toBeGreaterThanOrEqual(44);
            expect(b.x >= -0.5 && b.x + b.width <= width + 0.5, `${where}: ${id} off screen sideways`).toBe(true);
            expect(await brokenWords(page.getByTestId(id)), `${where}: ${id} words broken`).toEqual([]);
          }

          // Each secondary action, scrolled to on its own: wholly between the panel's top (under the map on
          // a phone) and the pinned main action, never partly hidden at either edge.
          for (const id of SECONDARY) {
            const button = page.getByTestId(id);
            await button.evaluate((el) => {
              const scroller = el.closest<HTMLElement>('[data-testid="panel"]')!;
              scroller.scrollTop += el.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 8;
            });
            const [b, p, m2] = [(await button.boundingBox())!, (await panel.boundingBox())!, (await main.boundingBox())!];
            expect(b.y, `${where}: ${id} partly hidden at the panel's top`).toBeGreaterThanOrEqual(p.y - 0.5);
            expect(b.y + b.height, `${where}: ${id} partly under the main action`).toBeLessThanOrEqual(m2.y + 0.5);
            if (size === 200 && height < 700) await page.screenshot({ path: `screenshots/${project()}/results-actions-${name.replace(`-text${size}`, `-text${size}-${id}`)}.png` });
          }

          // Each country with its result (Find), and each stop with its role (the route): side by side, or
          // the result under the name; in full, at full size.
          const answers = page.getByTestId("result-find-answers").locator("li");
          await expect(answers).toHaveCount(5);
          const stops = page.getByTestId("result-route").locator("li");
          const rows = await answers.or(stops).evaluateAll((lis) =>
            lis.map((li) => {
              const r = li.getBoundingClientRect();
              // A stop holds its marker, then its name and role together.
              const pair = li.children.length === 2 && li.children[0].getAttribute("aria-hidden") === "true" ? li.children[1] : li;
              const [n, t] = [...pair.children].map((c) => c.getBoundingClientRect());
              return {
                overflow: li.scrollWidth - li.clientWidth,
                outside: Math.max(n.right, t.right) - r.right,
                besideOrUnder: t.top >= n.bottom - 1 || (t.left >= n.right && Math.abs(t.top + t.height / 2 - (n.top + n.height / 2)) < 6),
                tagFont: parseFloat(getComputedStyle(pair.children[1]).fontSize),
              };
            }),
          );
          rows.forEach((row, i) => {
            expect(row.overflow, `${where}: row ${i + 1} wider than itself`).toBeLessThanOrEqual(0);
            expect(row.outside, `${where}: row ${i + 1} result outside its row`).toBeLessThanOrEqual(0.5);
            expect(row.besideOrUnder, `${where}: row ${i + 1} result neither beside nor under the name`).toBe(true);
            expect(row.tagFont, `${where}: row ${i + 1} result text size`).toBeCloseTo(0.8 * rem, 0);
          });
          for (const row of await answers.or(stops).all()) expect(await brokenWords(row), `${where}: result words broken`).toEqual([]);
          expect(await panel.evaluate((el) => el.scrollWidth - el.clientWidth), `${where}: panel wider than itself`).toBeLessThanOrEqual(0);
          expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${where}: horizontal scroll`).toBeLessThanOrEqual(0);
          if (size === 200) {
            await answers.first().evaluate((el) => el.scrollIntoView({ block: "start" }));
            await page.screenshot({ path: `screenshots/${project()}/results-rows-${name}.png` });
          }

          // Scrolled to the end, as a player would: both secondary actions above the main action.
          await panel.evaluate((el) => (el.scrollTop = el.scrollHeight));
          await page.screenshot({ path: `screenshots/${project()}/results-actions-${name}.png` });
        }
});

/**
 * A finished level's card, at the usual text size and at 200%: View results and Play again at full
 * (enlarged) size (exactly twice their usual size at 200%), every word whole, full touch targets, inside the card.
 */
test("level card: View results and Play again, full-size text and whole words at every size", async ({ page }) => {
  const sizes = project() === "desktop" ? [[1366, 800]] : project() === "small-phone" ? [[320, 568], [390, 844]] : [];
  test.skip(sizes.length === 0, "Runs at 320×568 and 390×844 (small-phone), and on desktop.");
  test.setTimeout(300_000);
  const usual: number[] = [];
  for (const [width, height] of sizes)
    for (const locale of ["en", "hy"] as const)
      for (const size of [100, 200]) {
        await page.setViewportSize({ width, height });
        await open(page, { [L1]: done(L1), [L2]: done(L2) }, { screen: "levels", levelId: L2, recent: [L2, L1], locale });
        await textSize(page, size);
        const where = `${width}×${height} ${locale} ${size}%`;
        await expand(page, L1);
        const c = card(page, L1);
        const view = c.getByTestId("view-results");
        await view.evaluate((el) => el.scrollIntoView({ block: "center" }));
        const box = (await c.boundingBox())!;
        for (const [i, button] of [view, c.getByRole("button", { name: locale === "en" ? /^Play again/ : /^Խաղալ նորից/ })].entries()) {
          const b = (await button.boundingBox())!;
          // Enlarged with the text: twice the usual size at 200%, never made smaller to fit.
          if (size === 100) usual[i] = await fontSize(button);
          else expect(await fontSize(button), `${where}: text size`).toBeCloseTo((usual[i] * size) / 100, 0);
          expect(b.height, `${where}: touch target`).toBeGreaterThanOrEqual(44);
          expect(b.x >= box.x - 0.5 && b.x + b.width <= box.x + box.width + 0.5, `${where}: button outside its card`).toBe(true);
          expect(await brokenWords(button), `${where}: words broken`).toEqual([]);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${where}: horizontal scroll`).toBeLessThanOrEqual(0);
        await page.screenshot({ path: `screenshots/${project()}/level-card-view-results-${locale}${size === 100 ? "" : `-text${size}`}-${width}x${height}.png` });
      }
});
