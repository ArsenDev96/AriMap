import { expect, test, type Page } from "@playwright/test";
import { openWithSave } from "./helpers/save";

/*
 * Star ratings (src/core/lesson/rating.ts), one rule for all seven levels, earned by a completed
 * full-level attempt: 1 star for completing; 2 with at least 4 of 5 Find answers on the first try
 * without hints; 3 with all 5 and the journey "Without help".
 * - Results: this attempt's stars, the best separately when different, "New best!" only as an
 *   attempt beats an earlier best (never again on refresh, a language change or View results), and
 *   for 1–2 stars what earns the next. A journey replay rates nothing.
 * - Cards: the best stars on completed cards, compact and opened; nothing for a level not rated.
 * - Saves: older saves rated from their own complete results; a completion record alone, or an
 *   invalid rating, shows no stars.
 */

const project = () => test.info().project.name;
const L = ["western-europe-1", "around-the-alps", "central-europe", "along-the-adriatic", "towards-greece", "baltic-journey", "iberian-journey"];
const [L1, L2, L3, L4] = L;
const COUNTRIES: Record<string, string[]> = {
  "western-europe-1": ["FRA", "BEL", "NLD", "LUX", "DEU"],
  "around-the-alps": ["FRA", "CHE", "DEU", "AUT", "ITA"],
  "central-europe": ["DEU", "POL", "CZE", "SVK", "AUT"],
  "along-the-adriatic": ["ITA", "SVN", "HRV", "BIH", "MNE"],
  "towards-greece": ["HUN", "ROU", "SRB", "BGR", "GRC"],
  "baltic-journey": ["DEU", "POL", "LTU", "LVA", "EST"],
  "iberian-journey": ["PRT", "ESP", "AND", "FRA", "ITA"],
};
const ROUTES: Record<string, [string, string[]]> = {
  "western-europe-1": ["fra-to-nld", ["FRA", "BEL", "NLD"]],
  "around-the-alps": ["fra-to-aut", ["FRA", "DEU", "AUT"]],
  "central-europe": ["pol-to-aut", ["POL", "CZE", "AUT"]],
  "along-the-adriatic": ["ita-to-mne", ["ITA", "SVN", "HRV", "MNE"]],
  "towards-greece": ["hun-to-grc", ["HUN", "ROU", "BGR", "GRC"]],
  "baltic-journey": ["deu-to-est", ["DEU", "POL", "LTU", "LVA", "EST"]],
  "iberian-journey": ["prt-to-ita", ["PRT", "ESP", "FRA", "ITA"]],
};

interface Played {
  /** Find answers on the first try without hints; the others with a hint, or (odd ones) a wrong tap first. */
  firstTry: number;
  /** The journey with a hint. */
  travelHelp?: boolean;
  /** The level's best rating as saved (undefined: not saved at all, as before ratings). */
  bestRating?: number | null | unknown;
  /** At Results (the default), or one move from the end of the journey. */
  stage?: "results" | "travel";
  /** Saved since ratings (with bestRating): false unless given; before them, not saved at all. */
  journeyReplay?: boolean;
}

/** A level played through Find to its Results (or nearly), as saved. */
function played(id: string, { firstTry, travelHelp = false, bestRating, stage = "results", journeyReplay = bestRating === undefined ? undefined : false }: Played) {
  const order = COUNTRIES[id];
  const [missionId, route] = ROUTES[id];
  const results = order.map((target, i) => ({ target, wrongGuesses: i < firstTry || i % 2 === 0 ? 0 : 1, hintLevel: i < firstTry || i % 2 === 1 ? 0 : 1 }));
  const done = stage === "results";
  return {
    started: true,
    stage,
    discover: { selected: null, explored: order },
    find: { order, index: 4, question: { target: order[4], wrongGuesses: [], hintLevel: 0, solved: true, feedback: null }, results, status: "complete" },
    travel: { missionId, path: done ? route : route.slice(0, -1), hintUsed: travelHelp, undoUsed: false },
    lastTravelResult: done ? { missionId, route, hintUsed: travelHelp, undoUsed: false } : null,
    ...(journeyReplay === undefined ? {} : { journeyReplay }),
    records: {
      discoverDone: true,
      findDone: true,
      travelDone: done || bestRating !== undefined,
      lastFindScore: { independent: firstTry, total: 5 },
      bestFindScore: { independent: firstTry, total: 5 },
      travelWithoutHelp: false,
      ...(bestRating === undefined ? {} : { bestRating }),
    },
  };
}

/** Completed, with only the completion record kept (an older save): nothing to rate. */
const RECORD_ONLY = { started: false, stage: "discover", records: { discoverDone: true, findDone: true, travelDone: true } };
const IN_FIND = {
  started: true,
  stage: "find",
  discover: { selected: null, explored: COUNTRIES[L3] },
  find: { order: COUNTRIES[L3], index: 1, question: { target: "POL", wrongGuesses: [], hintLevel: 0, solved: false, feedback: null }, results: [{ target: "DEU", wrongGuesses: 0, hintLevel: 0 }], status: "asking" },
  records: { discoverDone: true, findDone: false, travelDone: false },
};

async function open(page: Page, levels: Record<string, object>, { screen = "lesson", levelId = L1, locale = "en", recent }: { screen?: string; levelId?: string; locale?: string; recent?: string[] } = {}) {
  await openWithSave(page, { version: 2, locale, screen, continent: "europe", levelId, recent: recent ?? [levelId], levels });
  await expect(page.locator(".splash")).toHaveCount(0);
}

const saved = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("arimap:state")!) as { newBest?: string; levels: Record<string, { stage: string; journeyReplay: boolean; records: { bestRating: number | null; travelDone: boolean } }> });
const card = (page: Page, id: string) => page.getByTestId(`level-${id}`);
/** A screenshot once every one-off animation (the stars and New best popping in) has finished. */
async function shot(page: Page, name: string) {
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished)));
  await page.screenshot({ path: `screenshots/${project()}/stars-${name}.png` });
}
async function textSize(page: Page, size: number) {
  await page.evaluate(async (s) => {
    document.documentElement.style.fontSize = s === 100 ? "" : `${s}%`;
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, size);
}
/**
 * Scrolls the Results panel, and only the panel (the header and its Home stay put, as for a player),
 * so the stars show under the map: the section's top at the panel's top, or further when the room
 * above the pinned action is shorter, so the first row's count is whole above the action. Returns
 * where the count, the pinned action, the panel and Home then are, and how far the page scrolled.
 */
const showStars = (page: Page) =>
  page.getByTestId("rating").evaluate(async (rating) => {
    const panel = rating.closest<HTMLElement>('[data-testid="panel"]')!;
    const pinned = [...panel.children].find((c) => getComputedStyle(c).position === "sticky")!;
    const count = rating.querySelector("p > :last-child") ?? rating.querySelector("p")!;
    const top = (el: Element) => el.getBoundingClientRect().top;
    panel.scrollTop += Math.max(top(rating) - top(panel), count.getBoundingClientRect().bottom - top(pinned) + 8);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const box = count.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + Math.min(box.width / 2, 20), (box.top + box.bottom) / 2);
    return {
      count: { top: box.top, bottom: box.bottom, uncovered: !!hit && count.contains(hit) },
      pinnedTop: top(pinned),
      panelTop: top(panel),
      home: document.querySelector('[data-testid="home"]')!.getBoundingClientRect().top,
      pageScroll: document.scrollingElement!.scrollTop,
      pageTaller: document.documentElement.scrollHeight - window.innerHeight,
    };
  });

/**
 * A rated status pill's parts: its stars (each one's top, to tell they share a line), its words
 * (their box, size, and any word broken across lines) and the pill's box.
 */
const statusParts = (c: ReturnType<typeof card>) =>
  c.getByTestId("level-status").evaluate((pill) => {
    const r = (el: Element) => el.getBoundingClientRect();
    const stars = pill.querySelector('[data-testid="level-stars"]')!;
    const text = pill.lastElementChild!;
    const broken: string[] = [];
    const range = document.createRange();
    const walk = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
    for (let node = walk.nextNode(); node; node = walk.nextNode())
      for (const word of (node.textContent ?? "").matchAll(/\S+/g)) {
        range.setStart(node, word.index);
        range.setEnd(node, word.index + word[0].length);
        if (range.getClientRects().length > 1) broken.push(word[0]);
      }
    const s = getComputedStyle(pill);
    return {
      pill: { left: r(pill).left + parseFloat(s.paddingLeft) + parseFloat(s.borderLeftWidth), right: r(pill).right },
      stars: { left: r(stars).left, right: r(stars).right, bottom: r(stars).bottom, tops: [...stars.querySelectorAll("svg")].map((svg) => r(svg).top) },
      text: { left: r(text).left, top: r(text).top, right: r(text).right, size: parseFloat(getComputedStyle(text).fontSize) },
      broken,
    };
  });

test.describe("Results: the stars", () => {
  test.beforeEach(() => test.skip(project() !== "small-phone", "Runs once."));

  test("1, 2 and 3 stars: this attempt's, the best apart when different, and what earns the next star, in English and Armenian", async ({ page }) => {
    const cases = [
      { name: "1-star", level: played(L1, { firstTry: 3, bestRating: 1 }), stars: 1, best: null, need: "findMost" },
      { name: "2-stars", level: played(L1, { firstTry: 4, bestRating: 2 }), stars: 2, best: null, need: "findAll" },
      { name: "2-stars-best-3", level: played(L1, { firstTry: 5, travelHelp: true, bestRating: 3 }), stars: 2, best: 3, need: "travel" },
      { name: "3-stars", level: played(L1, { firstTry: 5, bestRating: 3 }), stars: 3, best: null, need: null },
    ];
    for (const c of cases)
      for (const locale of ["en", "hy"] as const) {
        await open(page, { [L1]: c.level }, { locale });
        const attempt = page.getByTestId("rating-attempt");
        await expect(attempt).toHaveAttribute("data-stars", String(c.stars));
        await expect(attempt).toHaveText(locale === "en" ? `This attempt${c.stars} of 3 stars` : `Այս փորձը${c.stars} աստղ 3-ից`);
        // The stars themselves are hidden from screen readers: the words say it once.
        await expect(attempt.locator("[aria-hidden='true'] svg")).toHaveCount(3);
        await expect(attempt.locator("svg[data-earned]")).toHaveCount(c.stars);
        if (c.best) await expect(page.getByTestId("rating-best")).toHaveText(locale === "en" ? `Best${c.best} of 3 stars` : `Լավագույնը${c.best} աստղ 3-ից`);
        else await expect(page.getByTestId("rating-best")).toHaveCount(0);
        if (c.need) await expect(page.getByTestId("rating-next")).toHaveAttribute("data-need", c.need);
        else await expect(page.getByTestId("rating-next")).toHaveCount(0);
        await expect(page.getByTestId("new-best")).toHaveCount(0);
        // The Find score and the journey's help summary stay.
        await expect(page.getByTestId("result-find")).toBeVisible();
        await expect(page.getByTestId("result-help")).toBeVisible();
        await showStars(page);
        await shot(page, `results-${c.name}-${locale}`);
      }
    await open(page, { [L1]: cases[0].level });
    await expect(page.getByTestId("rating-next")).toHaveText("Nice work! For the next star, find at least 4 of the 5 countries on the first try, without hints.");
  });

  test("New best: a full attempt beating an earlier best; not for a first rating, an equal or a worse one; never again after a refresh, a language change or View results", async ({ page }) => {
    for (const locale of ["en", "hy"] as const) {
      // Level 1 had 1 star; this attempt (5 of 5 first try, so far without help) ends with the last move.
      await open(page, { [L1]: played(L1, { firstTry: 5, bestRating: 1, stage: "travel" }) }, { locale });
      await page.getByTestId("move-NLD").click();
      await expect(page.getByTestId("new-best")).toHaveText(locale === "en" ? "New best!" : "Նոր ռեկորդ");
      await expect(page.getByTestId("rating-attempt")).toHaveAttribute("data-stars", "3");
      await expect(page.getByTestId("rating-best")).toHaveCount(0);
      expect((await saved(page)).levels[L1].records.bestRating).toBe(3);
      expect(await saved(page)).not.toHaveProperty("newBest");
      await showStars(page);
      await shot(page, `results-new-best-${locale}`);
    }
    // Not again: a language change, a refresh, View results.
    await page.getByRole("button", { name: "English", exact: true }).first().click();
    await expect(page.getByTestId("rating-attempt")).toHaveAttribute("data-stars", "3");
    await expect(page.getByTestId("new-best")).toHaveCount(0);
    await open(page, { [L1]: played(L1, { firstTry: 5, bestRating: 1, stage: "travel" }) });
    await page.getByTestId("move-NLD").click();
    await expect(page.getByTestId("new-best")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("rating-attempt")).toHaveAttribute("data-stars", "3");
    await expect(page.getByTestId("new-best")).toHaveCount(0);
    await page.getByTestId("home").click();
    await page.getByTestId("map-label-europe").click();
    await card(page, L1).getByTestId("level-details-toggle").click();
    await card(page, L1).getByTestId("view-results").click();
    await expect(page.getByTestId("rating-attempt")).toHaveAttribute("data-stars", "3");
    await expect(page.getByTestId("new-best")).toHaveCount(0);

    // A first rating, an equal one and a worse one: no New best; the best never lowered.
    for (const [best, firstTry, attempt, kept] of [[undefined, 5, 3, 3], [3, 5, 3, 3], [3, 3, 1, 3]] as const) {
      await open(page, { [L1]: played(L1, { firstTry, bestRating: best, stage: "travel" }) });
      await page.getByTestId("move-NLD").click();
      await expect(page.getByTestId("rating-attempt")).toHaveAttribute("data-stars", String(attempt));
      await expect(page.getByTestId("new-best")).toHaveCount(0);
      if (kept !== attempt) await expect(page.getByTestId("rating-best")).toHaveAttribute("data-stars", String(kept));
      expect((await saved(page)).levels[L1].records.bestRating).toBe(kept);
    }
  });

  test("Replay journey rates nothing: the best stays, with a word on earning more; Play again's full attempt can", async ({ page }) => {
    // 5 of 5, the journey with a hint: 2 stars.
    await open(page, { [L1]: played(L1, { firstTry: 5, travelHelp: true, bestRating: 2 }), [L2]: played(L2, { firstTry: 5, bestRating: 3 }) });
    await page.getByTestId("replay-journey").click();
    await page.reload();
    for (const id of ["BEL", "NLD"]) await page.getByTestId(`move-${id}`).click();
    await expect(page.getByTestId("badge")).toBeVisible();
    await expect(page.getByTestId("rating-attempt")).toHaveCount(0);
    await expect(page.getByTestId("rating-best")).toHaveAttribute("data-stars", "2");
    await expect(page.getByTestId("rating-replay")).toHaveText("Replaying the journey doesn't change your stars. Play the whole level again to earn more.");
    await expect(page.getByTestId("new-best")).toHaveCount(0);
    let s = await saved(page);
    expect(s.levels[L1]).toMatchObject({ stage: "results", journeyReplay: true, records: { bestRating: 2 } });
    // Another level's rating is its own.
    expect(s.levels[L2].records.bestRating).toBe(3);
    await showStars(page);
    await shot(page, "results-journey-replay-en");
    // Play again (asks first): starts over at Discover; the best stays.
    await page.getByTestId("results-play-again").click();
    await page.getByTestId("start-over-dialog").getByRole("button", { name: "Play again" }).click();
    await expect(page.getByTestId("discover-progress")).toContainText("0/5");
    s = await saved(page);
    expect(s.levels[L1]).toMatchObject({ stage: "discover", journeyReplay: false, records: { bestRating: 2, travelDone: true } });
    await page.getByTestId("home").click();
    await page.getByTestId("map-label-europe").click();
    await expect(card(page, L1).getByTestId("level-stars")).toHaveAttribute("data-stars", "2");
  });
});

test.describe("level cards: the best stars", () => {
  test.beforeEach(() => test.skip(project() !== "small-phone", "Runs once."));

  test("completed cards show their best stars, compact and opened, with the status in words; unplayed and in-progress levels show none", async ({ page }) => {
    for (const locale of ["en", "hy"] as const) {
      await open(page, { [L1]: played(L1, { firstTry: 5, bestRating: 3 }), [L2]: played(L2, { firstTry: 3, bestRating: 1 }), [L3]: IN_FIND }, { screen: "levels", levelId: L3, locale, recent: [L3, L2, L1] });
      for (const [id, stars] of [[L1, 3], [L2, 1]] as const) {
        const c = card(page, id);
        await expect(c).toHaveAttribute("data-compact", "");
        const group = c.getByTestId("level-stars");
        await expect(group).toBeVisible();
        await expect(group).toHaveAttribute("data-stars", String(stars));
        // One description for the group; the stars inside are hidden.
        await expect(group).toHaveAttribute("role", "img");
        await expect(group).toHaveAccessibleName(locale === "en" ? `Best: ${stars} of 3 stars` : `Լավագույնը՝ ${stars} աստղ 3-ից`);
        await expect(group.locator("[aria-hidden='true'] svg")).toHaveCount(3);
        await expect(c.getByTestId("level-status")).toHaveText(locale === "en" ? "Completed" : "Ավարտված է");
      }
      for (const id of [L3, L4]) await expect(card(page, id).getByTestId("level-stars")).toHaveCount(0);
      await card(page, L1).scrollIntoViewIfNeeded();
      await page.evaluate(() => document.querySelector('[data-testid="welcome-scroll"]')?.scrollTo({ top: 0 }));
      await shot(page, `cards-compact-${locale}`);
      // Opened: the stars stay.
      await card(page, L2).getByTestId("level-details-toggle").click();
      await expect(card(page, L2).getByTestId("level-stars")).toBeVisible();
      await card(page, L2).evaluate((el) => el.scrollIntoView({ block: "start" }));
      await shot(page, `cards-expanded-${locale}`);
    }
    // A new player's cards (levels shown in full, not compact): a completed one shows its stars too.
    await open(page, { [L1]: played(L1, { firstTry: 4, bestRating: 2 }) }, { screen: "levels", levelId: L1, recent: [] });
    await expect(card(page, L1).getByTestId("level-stars")).toHaveAttribute("data-stars", "2");
  });

  test("starting over never lowers or erases the best; each level keeps its own", async ({ page }) => {
    await open(page, { [L1]: played(L1, { firstTry: 5, bestRating: 3 }), [L2]: played(L2, { firstTry: 4, bestRating: 2 }) }, { screen: "levels", levelId: L2, recent: [L2, L1] });
    await card(page, L2).getByTestId("level-details-toggle").click();
    await card(page, L2).getByRole("button", { name: /^Play again/ }).click();
    await page.getByTestId("start-over-dialog").getByRole("button", { name: "Play again" }).click();
    await expect(page.getByTestId("discover-progress")).toContainText("0/5");
    await page.reload();
    await page.getByTestId("home").click();
    await page.getByTestId("map-label-europe").click();
    await expect(card(page, L2).getByTestId("level-stars")).toHaveAttribute("data-stars", "2");
    await expect(card(page, L2).getByTestId("level-status")).toHaveText("Completed");
    await expect(card(page, L1).getByTestId("level-stars")).toHaveAttribute("data-stars", "3");
    await page.getByRole("button", { name: "Հայերեն", exact: true }).first().click();
    await expect(card(page, L2).getByTestId("level-stars")).toHaveAccessibleName("Լավագույնը՝ 2 աստղ 3-ից");
  });

  test("older saves: stars from their own complete results; a completion record alone, or an invalid rating, shows none", async ({ page }) => {
    await open(
      page,
      {
        // Before ratings: complete Find (5 first try) and a journey without help: 3 stars.
        [L1]: played(L1, { firstTry: 5 }),
        // Before ratings, completed, but only the record kept.
        [L2]: RECORD_ONLY,
        // An invalid rating on a completion record.
        [L3]: { ...RECORD_ONLY, records: { ...RECORD_ONLY.records, bestRating: 7 } },
      },
      { screen: "levels", levelId: L1, recent: [L1, L2, L3] },
    );
    await expect(card(page, L1).getByTestId("level-stars")).toHaveAttribute("data-stars", "3");
    for (const id of [L2, L3]) {
      await expect(card(page, id).getByTestId("level-status")).toHaveText("Completed");
      await expect(card(page, id).getByTestId("level-stars")).toHaveCount(0);
    }
    // Continent progress counts completion, as before.
    await page.getByTestId("back-to-continents").click();
    await expect(page.getByTestId("continent-progress").first()).toContainText("3/7");
  });
});

/**
 * The stars at 320, 390 and desktop widths, at the usual text size and at 200%: their words at the
 * full enlarged size, inside the panel and the cards, with nothing wider than the screen.
 */
test("stars layout: Results and cards at every size, with enlarged text", async ({ page }) => {
  const sizes = project() === "desktop" ? [[1366, 800]] : project() === "small-phone" ? [[320, 568], [390, 844]] : [];
  test.skip(sizes.length === 0, "Runs at 320×568 and 390×844 (small-phone), and on desktop.");
  test.setTimeout(300_000);
  for (const [width, height] of sizes)
    for (const locale of ["en", "hy"] as const)
      for (const size of [100, 200]) {
        await page.setViewportSize({ width, height });
        const where = `${width}×${height} ${locale} ${size}%`;
        const rem = (16 * size) / 100;
        await open(page, { [L1]: played(L1, { firstTry: 5, travelHelp: true, bestRating: 3 }) }, { locale });
        await textSize(page, size);
        const rating = page.getByTestId("rating");
        // Only the panel scrolls: the page is never taller than the screen, so Home stays at the top.
        const shown = await showStars(page);
        expect(shown.pageTaller, `${where}: page taller than the screen`).toBeLessThanOrEqual(0);
        expect(shown.pageScroll, `${where}: page scrolled`).toBe(0);
        expect(shown.home, `${where}: Home off the top`).toBeGreaterThanOrEqual(0);
        await expect(page.getByTestId("home")).toBeInViewport({ ratio: 1 });
        // The count can be brought whole into the panel's room above its pinned action, and isn't covered there.
        expect(shown.count.top, `${where}: count above the panel's top`).toBeGreaterThanOrEqual(shown.panelTop - 0.5);
        expect(shown.count.bottom, `${where}: count under the pinned action`).toBeLessThanOrEqual(shown.pinnedTop + 0.5);
        expect(shown.count.uncovered, `${where}: count covered`).toBe(true);
        // Full size: the attempt's count at 1.15 times the text, the stars scaling with it.
        expect(await page.getByTestId("rating-attempt").evaluate((el) => parseFloat(getComputedStyle(el).fontSize)), `${where}: stars text size`).toBeCloseTo(1.15 * rem, 0);
        const box = (await rating.boundingBox())!;
        const inside = await rating.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return [...el.querySelectorAll("p > *, p")].every((c) => c.getBoundingClientRect().right <= r.right + 0.5 && c.getBoundingClientRect().left >= r.left - 0.5);
        });
        expect(inside, `${where}: stars row outside its box`).toBe(true);
        expect(box.x >= -0.5 && box.x + box.width <= width + 0.5, `${where}: stars off screen`).toBe(true);
        expect(await page.getByTestId("panel").evaluate((el) => el.scrollWidth - el.clientWidth), `${where}: panel wider than itself`).toBeLessThanOrEqual(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${where}: horizontal scroll`).toBeLessThanOrEqual(0);
        await shot(page, `layout-results-${locale}${size === 100 ? "" : `-text${size}`}-${width}x${height}`);

        // A compact completed card with its stars.
        await open(page, { [L1]: played(L1, { firstTry: 5, bestRating: 3 }), [L2]: played(L2, { firstTry: 4, bestRating: 2 }) }, { screen: "levels", levelId: L2, locale, recent: [L2, L1] });
        await textSize(page, size);
        for (const id of [L1, L2]) {
          const c = card(page, id);
          const stars = c.getByTestId("level-stars");
          const [cb, sb] = [(await c.boundingBox())!, (await stars.boundingBox())!];
          expect(sb.x >= cb.x - 0.5 && sb.x + sb.width <= cb.x + cb.width + 0.5, `${where}: ${id} stars outside the card`).toBe(true);
          // The stars scale with the text (in the status pill: 1.4 × 0.8 × its 0.85rem).
          expect(sb.height, `${where}: ${id} stars size`).toBeGreaterThanOrEqual(1.4 * 0.8 * 0.85 * rem - 1);
          // In the status pill, before "Completed": no line of their own.
          await expect(c.getByTestId("level-status").getByTestId("level-stars")).toHaveCount(1);
          // The three stars together on one line; "Completed" beside them, or (when it can't fit there)
          // under them from the pill's start, never broken inside a word, at its full size.
          const p = await statusParts(c);
          expect(Math.max(...p.stars.tops) - Math.min(...p.stars.tops), `${where}: ${id} stars split`).toBeLessThanOrEqual(1);
          expect(p.broken, `${where}: ${id} status word broken`).toEqual([]);
          expect(p.text.size, `${where}: ${id} status text size`).toBeCloseTo(0.85 * rem, 0);
          expect(p.text.right, `${where}: ${id} status words outside the pill`).toBeLessThanOrEqual(p.pill.right + 0.5);
          const below = p.text.top >= p.stars.bottom - 0.5;
          if (below) expect(p.text.left, `${where}: ${id} status words under the stars, from the pill's start`).toBeCloseTo(p.pill.left, 0);
          else expect(p.text.left, `${where}: ${id} status words beside the stars`).toBeGreaterThanOrEqual(p.stars.right);
          // At the usual text size, as before: beside the stars.
          if (size === 100) expect(below, `${where}: ${id} status words under the stars`).toBe(false);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${where}: horizontal scroll`).toBeLessThanOrEqual(0);
        await page.evaluate(() => document.querySelector('[data-testid="welcome-scroll"]')?.scrollTo({ top: 0 }));
        await shot(page, `layout-cards-${locale}${size === 100 ? "" : `-text${size}`}-${width}x${height}`);
      }
});
