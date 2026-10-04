import { expect, test, type Page } from "@playwright/test";
import { openWithSave } from "./helpers/save";

/*
 * The continents above the level selection: Continents → a continent's levels → Discover → Find →
 * Travel → Results. Five continents (Europe with the seven levels, four coming soon with no action),
 * Europe's level count and completed levels from the permanent records, Continue on the continents
 * straight into the most recently active unfinished level (exactly where it was, also after a
 * refresh), Europe's level selection with Back to the continents, Home from a level to the
 * continents, starting over or playing again keeping completion and unlocks, and a save from before
 * continents opening Europe's levels. In English and Armenian at 320×568, 390×844, a phone in
 * landscape (740×360) and on desktop, with enlarged text, keyboard focus and accessible names.
 * Screens are never pushed onto the browser's history (the app keeps its screen in the save, as
 * before), and a refresh opens the saved screen with no other screen first.
 */

const project = () => test.info().project.name;

const L = ["western-europe-1", "around-the-alps", "central-europe", "along-the-adriatic", "towards-greece", "baltic-journey", "iberian-journey"];
const [L1, L2, L3] = L;
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

type SaveState = { name: string; levels: Record<string, object>; recent: string[] };
const NEW: SaveState = { name: "new", levels: {}, recent: [] };
const LEVEL3: SaveState = { name: "level3", levels: { [L1]: done(L1), [L2]: done(L2), [L3]: L3_IN_FIND }, recent: [L3, L2, L1] };
const ALL_DONE: SaveState = { name: "all-done", levels: Object.fromEntries(L.map((id) => [id, done(id)])), recent: [...L].reverse() };

const NAMES = {
  en: ["Europe", "Asia", "Africa", "North America", "South America"],
  hy: ["Եվրոպա", "Ասիա", "Աֆրիկա", "Հյուսիսային Ամերիկա", "Հարավային Ամերիկա"],
};
const IDS = ["europe", "asia", "africa", "north-america", "south-america"];
const TEXT = {
  en: { levels: "7 levels", completed: (n: number) => `${n} of 7 levels completed`, explore: "Explore Europe", soon: "Coming soon", back: "Back to continents", continue: "Continue", europe: "Europe" },
  hy: { levels: "7 մակարդակ", completed: (n: number) => `7 մակարդակից ավարտված է ${n}-ը`, explore: "Բացահայտել Եվրոպան", soon: "Շուտով", back: "Վերադառնալ մայրցամաքներին", continue: "Շարունակել", europe: "Եվրոպա" },
};

/** Records each screen the app shows, in order, from the first paint of every document (to catch a flash of the wrong one). */
async function recordScreens(page: Page) {
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __screens: string[] }).__screens = seen;
    const record = () => {
      for (const id of ["continents", "welcome", "panel"]) if (document.querySelector(`[data-testid="${id}"]`) && seen.at(-1) !== id) seen.push(id);
    };
    new MutationObserver(record).observe(document, { childList: true, subtree: true });
  });
}
const screensSeen = (page: Page) => page.evaluate(() => (window as unknown as { __screens: string[] }).__screens);

async function open(page: Page, s: SaveState, { locale = "en", screen = "continents" } = {}) {
  await openWithSave(page, { version: 2, locale, screen, levelId: s.recent[0] ?? L1, recent: s.recent, levels: s.levels });
  await expect(page.locator(".splash")).toHaveCount(0);
  await fontsSettled(page);
}

async function fontsSettled(page: Page) {
  await page.evaluate(async () => {
    const loads = [document.fonts.load('900 16px "Nunito"', "Aa")];
    if (document.documentElement.lang === "hy") loads.push(document.fonts.load('900 16px "Noto Sans Armenian"', "Աա"));
    await Promise.all(loads).catch(() => undefined);
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
}

async function textSize(page: Page, size: number) {
  await page.evaluate((s) => (document.documentElement.style.fontSize = s === 100 ? "" : `${s}%`), size);
  await fontsSettled(page);
}

async function shot(page: Page, name: string) {
  const { width, height } = page.viewportSize()!;
  await page.screenshot({ path: `screenshots/${project()}/continents-${name}-${width}x${height}.png` });
}

const card = (page: Page, id: string) => page.getByTestId(`continent-${id}`);
const continueButton = (page: Page) => page.getByTestId("continents-actions").getByRole("button");

/**
 * The continents: the header (name, tagline or at least the name, language) on screen; the five cards in order;
 * each, and each of its buttons, reached by scrolling the list and then wholly between the header and the action
 * area (never under it); the action area below the list, not over it; nothing wider than the screen.
 */
async function expectContinentsReachable(page: Page, where: string) {
  const { width, height } = page.viewportSize()!;
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${where}: horizontal scroll`).toBeLessThanOrEqual(0);
  expect(await page.evaluate(() => document.scrollingElement!.scrollTop), `${where}: the page scrolled`).toBe(0);
  const title = page.getByTestId("welcome-hero").getByRole("heading", { level: 1 });
  await expect(title).toBeInViewport({ ratio: 1 });
  await expect(page.getByTestId("welcome-hero").getByRole("group")).toBeInViewport({ ratio: 1 });
  const scroll = page.getByTestId("continents-scroll");
  const bar = page.getByTestId("continents-actions");
  const barBox = (await bar.count()) > 0 ? (await bar.boundingBox())! : null;
  const scrollBox = (await scroll.boundingBox())!;
  if (barBox) {
    expect(barBox.y, `${where}: the action area over the list`).toBeGreaterThanOrEqual(scrollBox.y + scrollBox.height - 0.5);
    expect(barBox.y + barBox.height, `${where}: the action area off screen`).toBeLessThanOrEqual(height + 0.5);
    const button = (await continueButton(page).boundingBox())!;
    expect(button.height, `${where}: Continue touch target`).toBeGreaterThanOrEqual(44);
    expect(button.x + button.width, `${where}: Continue off screen`).toBeLessThanOrEqual(width + 0.5);
  }
  for (const id of IDS) {
    const parts = [card(page, id), ...(await card(page, id).getByRole("button").all())];
    for (const part of parts) {
      // Scrolled into the list (at its top, if taller than the list: two cards side by side share a row's height): then wholly in it.
      const tall = await part.evaluate((el, list) => el.getBoundingClientRect().height > list, scrollBox.height);
      await part.evaluate((el, tall) => el.scrollIntoView({ block: tall ? "start" : "nearest" }), tall);
      const b = (await part.boundingBox())!;
      const s = (await scroll.boundingBox())!;
      expect(b.y, `${where}: ${id} above the list`).toBeGreaterThanOrEqual(s.y - 0.5);
      if (!tall) expect(b.y + b.height, `${where}: ${id} under the list's bottom`).toBeLessThanOrEqual(s.y + s.height + 0.5);
      expect(b.x >= -0.5 && b.x + b.width <= width + 0.5, `${where}: ${id} off screen sideways`).toBe(true);
    }
  }
  await scroll.evaluate((el) => el.scrollTo(0, 0));
}

/** No continent's name is broken inside a word, unless the word is wider than the whole card (the name then has its own line under the globe). */
async function expectNamesWhole(page: Page, where: string) {
  const broken = await page.evaluate(() => {
    const out: string[] = [];
    for (const h of document.querySelectorAll('[data-testid="continent-list"] h3')) {
      const room = h.parentElement!.clientWidth;
      const range = document.createRange();
      const words = document.createTreeWalker(h, NodeFilter.SHOW_TEXT);
      for (let node = words.nextNode(); node; node = words.nextNode())
        for (const m of (node.textContent ?? "").matchAll(/\S+/g)) {
          range.setStart(node, m.index!);
          range.setEnd(node, m.index! + m[0].length);
          const rects = [...range.getClientRects()].filter((r) => r.width > 0);
          const width = rects.reduce((sum, r) => sum + r.width, 0);
          if (new Set(rects.map((r) => Math.round(r.top))).size > 1 && width <= room + 0.5) out.push(m[0]);
        }
    }
    return out;
  });
  expect(broken, `${where}: names broken inside a word`).toEqual([]);
}

/** The five cards' names in order, Europe's count, progress and button, and the four coming soon with no action. */
async function expectCards(page: Page, locale: "en" | "hy", completed: number, primary: boolean) {
  const t = TEXT[locale];
  expect(await page.getByTestId("continent-list").locator(":scope > li > article").evaluateAll((els) => els.map((e) => e.getAttribute("data-continent")))).toEqual(IDS);
  for (const [i, id] of IDS.entries()) await expect(card(page, id).getByRole("heading", { level: 3 })).toHaveText(NAMES[locale][i]);
  await expect(card(page, "europe").getByTestId("continent-levels")).toHaveText(t.levels);
  await expect(card(page, "europe").getByTestId("continent-progress")).toHaveText(t.completed(completed));
  const explore = page.getByTestId("explore-europe");
  await expect(explore).toHaveText(t.explore);
  await expect(explore).toHaveAccessibleName(t.explore);
  if (primary) await expect(explore).toHaveAttribute("data-primary", "true");
  else await expect(explore).not.toHaveAttribute("data-primary");
  for (const id of IDS.slice(1)) {
    await expect(card(page, id)).toHaveAttribute("data-status", "comingSoon");
    await expect(card(page, id).getByTestId("continent-status")).toContainText(t.soon);
    // Not a locked level: no level wording, and nothing to press or focus.
    await expect(card(page, id).locator("button, a, input, [tabindex]")).toHaveCount(0);
    await expect(card(page, id)).not.toContainText(locale === "en" ? /Locked|Level \d/ : /Փակ|Մակարդակ \d/);
  }
}

test.describe("continents", () => {
  test("the three save states in both languages and at every size: cards, statuses, Continue and reachability", async ({ page }) => {
    const sizes = project() === "desktop" ? [[1366, 800]] : project() === "small-phone" ? [[320, 568], [390, 844], [740, 360]] : [];
    test.skip(sizes.length === 0, "Runs on small-phone (320×568, 390×844, 740×360 landscape) and desktop.");
    test.setTimeout(300_000);
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      for (const locale of ["en", "hy"] as const) {
        for (const s of [NEW, LEVEL3, ALL_DONE]) {
          const where = `${width}×${height} ${locale} ${s.name}`;
          await open(page, s, { locale });
          await expect(page.getByTestId("continents")).toBeVisible();
          const completed = s === NEW ? 0 : s === LEVEL3 ? 2 : 7;
          await expectCards(page, locale, completed, s !== LEVEL3);
          if (s === LEVEL3) {
            // Continue names the continent and the level, and (where there is room) its title; always all three for assistive technology.
            await expect(continueButton(page)).toHaveAttribute("data-level", L3);
            await expect(continueButton(page)).toHaveAccessibleName(
              locale === "en" ? "Continue: Europe, Level 3, Central Europe" : "Շարունակել՝ Եվրոպա, Մակարդակ 3, Կենտրոնական Եվրոպա",
            );
            await expect(continueButton(page)).toContainText(locale === "en" ? "Europe · Level 3" : "Եվրոպա · Մակարդակ 3");
          } else {
            // Nothing unfinished: no Continue, and Europe's button is the main action.
            await expect(page.getByTestId("continents-actions")).toHaveCount(0);
          }
          await expectContinentsReachable(page, where);
          await expectNamesWhole(page, where);
          await shot(page, `${locale}-${s.name}`);
        }
        // Europe's level selection, with Back to the continents and the continent's name.
        await open(page, LEVEL3, { locale });
        await page.getByTestId("explore-europe").click();
        await expect(page.getByTestId("continent-title")).toHaveText(TEXT[locale].europe);
        await expect(page.getByTestId("back-to-continents")).toHaveAccessibleName(TEXT[locale].back);
        await expect(page.getByTestId("levels").locator(":scope > li")).toHaveCount(7);
        await expect(page.getByTestId("welcome-actions").getByRole("button")).toHaveAttribute("data-level", L3);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${width}×${height} ${locale} Europe: horizontal scroll`).toBeLessThanOrEqual(0);
        await shot(page, `${locale}-europe-levels`);
      }
    }
  });

  test("enlarged text: every continent and action reached by scrolling, nothing cut or covered, on the continents and Europe's levels", async ({ page }) => {
    test.skip(project() !== "small-phone", "Runs on small-phone.");
    test.setTimeout(300_000);
    for (const [width, height] of [
      [320, 568],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height });
      for (const locale of ["en", "hy"] as const)
        for (const s of [NEW, LEVEL3])
          for (const size of [150, 200]) {
            const where = `${width}×${height} ${locale} ${s.name} ${size}%`;
            await open(page, s, { locale });
            await textSize(page, size);
            const name = page.getByTestId("continent-europe").getByRole("heading", { level: 3 });
            expect(parseFloat(await name.evaluate((e) => getComputedStyle(e).fontSize)), `${where}: name size`).toBeGreaterThanOrEqual((1.3 * 16 * size) / 100 - 0.5);
            await expectContinentsReachable(page, where);
            await expectNamesWhole(page, where);
            // The list keeps room to scroll through: at least two lines of its text between the header and the action area.
            const room = await page.getByTestId("continents-scroll").evaluate((el) => el.clientHeight / parseFloat(getComputedStyle(el).fontSize));
            expect(room, `${where}: ${room.toFixed(1)} lines of room`).toBeGreaterThanOrEqual(3);
            if (width === 320 && size === 200) await shot(page, `${locale}-${s.name}-text${size}`);
            // Europe's level selection: Back reachable, nothing wider than the screen.
            await page.getByTestId("explore-europe").click();
            await expect(page.getByTestId("back-to-continents")).toBeInViewport({ ratio: 1 });
            expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${where} Europe: horizontal scroll`).toBeLessThanOrEqual(0);
            if (width === 320 && size === 200 && s === LEVEL3) await shot(page, `${locale}-europe-levels-text${size}`);
            await page.getByTestId("back-to-continents").click();
            await expect(page.getByTestId("continents")).toBeVisible();
            await textSize(page, 100);
          }
    }
  });

  test("Level 3 in progress: Continue resumes it exactly, Home returns to the continents, also across refreshes, with no other screen shown first", async ({ page }) => {
    test.skip(project() !== "small-phone", "Runs once.");
    await page.setViewportSize({ width: 390, height: 844 });
    await recordScreens(page);
    await open(page, LEVEL3);
    expect(await screensSeen(page)).toEqual(["continents"]);
    const historyLength = await page.evaluate(() => window.history.length);
    const expectFindAsLeft = async () => {
      await expect(page.getByTestId("find-prompt")).toHaveText("Find Czechia");
      await expect(page.getByTestId("find-progress")).toHaveText("Question 2 of 5");
      await expect(page.getByText("Its capital is Prague.")).toBeVisible();
      await expect(page.getByTestId("find-feedback")).toContainText("Try again.");
    };
    await continueButton(page).click();
    await expectFindAsLeft();
    // A refresh in the level opens it again, straight away.
    await page.reload();
    await expectFindAsLeft();
    expect(await screensSeen(page)).toEqual(["panel"]);
    // Home: the continents, progress kept; a refresh there stays there; Continue resumes it.
    await page.getByTestId("home").click();
    await expect(page.getByTestId("continents")).toBeVisible();
    await expect(continueButton(page)).toHaveAttribute("data-level", L3);
    await page.reload();
    await expect(page.getByTestId("continents")).toBeVisible();
    expect(await screensSeen(page)).toEqual(["continents"]);
    await continueButton(page).click();
    await expectFindAsLeft();
    // Home → Europe → the level's own Continue: the same place.
    await page.getByTestId("home").click();
    await page.getByTestId("explore-europe").click();
    await expect(page.getByTestId("welcome")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("welcome")).toBeVisible();
    expect(await screensSeen(page)).toEqual(["welcome"]);
    await page.getByTestId(`level-${L3}`).getByRole("button", { name: /^Continue/ }).click();
    await expectFindAsLeft();
    // Back to the continents from Europe's levels.
    await page.getByTestId("home").click();
    await page.getByTestId("explore-europe").click();
    await page.getByTestId("back-to-continents").click();
    await expect(page.getByTestId("continents")).toBeVisible();
    // Screens are not browser history entries: Back in the browser leaves the app, as before continents.
    expect(await page.evaluate(() => window.history.length)).toBe(historyLength);
  });

  test("starting over or playing again keeps completion and unlocks; a replay is not an unfinished level", async ({ page }) => {
    test.skip(project() !== "small-phone", "Runs once.");
    await page.setViewportSize({ width: 390, height: 844 });
    const dialog = page.getByTestId("start-over-dialog");
    // Level 3 in progress, started over from Europe's levels: still two completed, Level 3 still open, Continue at its Discover.
    await open(page, LEVEL3);
    await page.getByTestId("explore-europe").click();
    await page.getByTestId(`level-${L3}`).getByRole("button", { name: /^Start over/ }).click();
    await dialog.getByRole("button", { name: "Start over" }).click();
    await expect(page.getByRole("heading", { name: "Tap a country to learn about it." })).toBeVisible();
    await page.getByTestId("home").click();
    await expect(card(page, "europe").getByTestId("continent-progress")).toHaveText("2 of 7 levels completed");
    await expect(continueButton(page)).toHaveAttribute("data-level", L3);
    await page.getByTestId("explore-europe").click();
    await expect(page.getByTestId(`level-${L3}`).getByTestId("level-status")).toHaveText("In progress: Discover");
    await expect(page.getByTestId("level-along-the-adriatic").getByTestId("level-status")).toHaveText(/^Locked/);

    // All seven completed, Level 2 played again: still seven of seven, nothing to continue, every level open.
    await open(page, ALL_DONE);
    await page.getByTestId("explore-europe").click();
    await page.getByTestId(`level-${L2}`).getByTestId("level-details-toggle").click();
    await page.getByTestId(`level-${L2}`).getByRole("button", { name: /^Play again/ }).click();
    await dialog.getByRole("button", { name: "Play again" }).click();
    await expect(page.getByRole("heading", { name: "Tap a country to learn about it." })).toBeVisible();
    await page.getByTestId("home").click();
    await expect(card(page, "europe").getByTestId("continent-progress")).toHaveText("7 of 7 levels completed");
    await expect(page.getByTestId("continents-actions")).toHaveCount(0);
    await expect(page.getByTestId("explore-europe")).toHaveAttribute("data-primary", "true");
    await page.reload();
    await expect(card(page, "europe").getByTestId("continent-progress")).toHaveText("7 of 7 levels completed");
    await page.getByTestId("explore-europe").click();
    for (const id of L) await expect(page.getByTestId(`level-${id}`).getByTestId("level-status")).toHaveText("Completed");
  });

  test("a new player: Europe, then Level 1; coming-soon continents open nothing", async ({ page }) => {
    test.skip(project() !== "small-phone", "Runs once.");
    await page.setViewportSize({ width: 320, height: 568 });
    await open(page, NEW);
    for (const id of IDS.slice(1)) {
      await card(page, id).click();
      await expect(page.getByTestId("continents")).toBeVisible();
    }
    await page.getByTestId("explore-europe").click();
    await expect(page.getByTestId("welcome-actions").getByRole("button")).toHaveText(/^Start\s*Level 1 · France and its neighbours$/);
    await expect(page.getByTestId(`level-${L2}`).getByTestId("level-status")).toHaveText(/^Locked/);
    await page.getByTestId("welcome-actions").getByRole("button").click();
    await expect(page.getByRole("heading", { name: "Tap a country to learn about it." })).toBeVisible();
    await page.getByTestId("home").click();
    await expect(continueButton(page)).toHaveAccessibleName("Continue: Europe, Level 1, France and its neighbours");
  });

  test("a save from before continents opens Europe's levels where the player was", async ({ page }) => {
    test.skip(project() !== "small-phone", "Runs once.");
    await openWithSave(page, { version: 2, locale: "hy", screen: "welcome", levelId: L3, recent: LEVEL3.recent, levels: LEVEL3.levels });
    await expect(page.getByTestId("welcome")).toBeVisible();
    await expect(page.getByTestId("continent-title")).toHaveText("Եվրոպա");
    await expect(page.getByTestId("welcome-actions").getByRole("button")).toHaveAttribute("data-level", L3);
  });

  test("keyboard: every action on the continents and Europe's levels is reached with Tab and named; coming-soon cards take no focus", async ({ page }) => {
    test.skip(project() !== "desktop", "Runs once.");
    for (const locale of ["en", "hy"] as const) {
      await open(page, LEVEL3, { locale });
      const focused: string[] = [];
      for (let i = 0; i < 8; i++) {
        await page.keyboard.press("Tab");
        focused.push(await page.evaluate(() => {
          const el = document.activeElement as HTMLElement;
          return `${el.closest("[data-testid^='continent-']")?.getAttribute("data-testid") ?? ""}|${el.getAttribute("aria-label") ?? el.textContent?.trim()}`;
        }));
      }
      // The two languages, Explore Europe, then Continue; nothing in a coming-soon card.
      const names = focused.map((f) => f.split("|")[1]);
      expect(names.slice(0, 4), locale).toEqual([
        "English",
        "Հայերեն",
        TEXT[locale].explore,
        locale === "en" ? "Continue: Europe, Level 3, Central Europe" : "Շարունակել՝ Եվրոպա, Մակարդակ 3, Կենտրոնական Եվրոպա",
      ]);
      expect(focused.filter((f) => /continent-(asia|africa|north-america|south-america)/.test(f)), locale).toEqual([]);
      // Europe by keyboard; Back to the continents is the first thing in the list, and Enter takes it.
      await page.getByTestId("explore-europe").focus();
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("welcome")).toBeVisible();
      // Back to the continents is the first thing reached on Europe's levels.
      await page.keyboard.press("Tab");
      await expect(page.getByTestId("back-to-continents")).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("continents")).toBeVisible();
    }
  });
});
