import { expect, test, type Page } from "@playwright/test";

/*
 * Home and Continue, Start over, and saves from before Find became one round
 * of five questions (see migrateLegacyFind in src/core/progress/storage.ts).
 */

const LESSON = "western-europe-1";
const ORDER = ["FRA", "BEL", "NLD", "LUX", "DEU"];

/**
 * Waits until the game has mounted: it saves the state it loaded when it mounts,
 * which would otherwise overwrite a save written by the test just before.
 */
async function appReady(page: Page) {
  await expect(page.locator(".splash")).toHaveCount(0);
  await expect(page.locator("main").first()).toBeVisible();
}

/**
 * Sets the text size (every size here is in rem, as a browser's text size setting gives it)
 * and returns once the layout has settled.
 */
async function setTextSize(page: Page, percent: number) {
  await page.evaluate(async (s) => {
    document.documentElement.style.fontSize = `${s}%`;
    // The first callback runs before that frame's layout and paint; the second, once they are done.
    for (let i = 0; i < 2; i++) await new Promise((done) => requestAnimationFrame(done));
  }, percent);
}

/**
 * Like setTextSize, for the lesson header, and also returns the header as it was painted in
 * the first frame after the change, to compare with its settled layout: a header that only
 * corrects itself a frame later (a visible jump) shows a different first frame.
 *
 * The first frame is read in a ResizeObserver created here, so after the game's own: its
 * callbacks run once that frame's layout is done, just before it is painted, after the
 * game's header has responded to the new sizes (the last reading of the frame is what is painted).
 */
async function setHeaderTextSize(page: Page, percent: number) {
  return page.evaluate(async (s) => {
    const header = document.querySelector("header")!;
    const layout = () =>
      JSON.stringify([
        header.dataset.layout,
        ...['[data-testid="home"]', "ol", "[role=group]"].map((q) => {
          const b = header.querySelector(q)!.getBoundingClientRect();
          return [b.left, b.top, b.width, b.height].map(Math.round);
        }),
      ]);
    let firstFrame = "";
    let painted = false;
    const observer = new ResizeObserver(() => {
      if (!painted) firstFrame = layout();
    });
    for (const el of [header, ...header.children]) observer.observe(el);
    document.documentElement.style.fontSize = `${s}%`;
    await new Promise((done) => requestAnimationFrame(done));
    // The next frame begins: the first one has been painted.
    await new Promise((done) => requestAnimationFrame(done));
    painted = true;
    observer.disconnect();
    for (let i = 0; i < 2; i++) await new Promise((done) => requestAnimationFrame(done));
    return { firstFrame, settled: layout() };
  }, percent);
}

async function save(page: Page, lesson: object, { locale = "en", screen = "lesson" } = {}) {
  await page.goto("/");
  await appReady(page);
  await page.evaluate((v) => localStorage.setItem("arimap:state", v), JSON.stringify({ version: 1, locale, screen, lessons: { [LESSON]: lesson } }));
  await page.reload();
}

/** Level 1's own Continue on the level selection (the main action may point at Level 2 once Level 1 is complete). */
const continueLevel1 = (page: Page) => page.getByTestId(`level-${LESSON}`).getByRole("button", { name: /^(Continue|Շարունակել)/ });

/** Opens Level 1's card when it is shown as a completed level's one-line summary, so its details and buttons show. */
async function showLevel1(page: Page) {
  const toggle = page.getByTestId(`level-${LESSON}`).getByTestId("level-details-toggle");
  await expect(page.getByTestId(`level-${LESSON}`)).toBeVisible();
  if ((await toggle.count()) > 0 && (await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
}

const answers = (order: string[], n: number, assisted: number[] = []) =>
  order.slice(0, n).map((target, i) => ({ target, wrongGuesses: assisted.includes(i) ? 1 : 0, hintLevel: 0, independent: !assisted.includes(i) }));
const question = (target: string, extra: object = {}) => ({ target, wrongGuesses: [], hintLevel: 0, solved: false, feedback: null, ...extra });

const STAGES: { name: string; lesson: object; ready: (page: Page) => Promise<void> }[] = [
  {
    name: "Discover",
    lesson: { started: true, stage: "discover", discover: { selected: "BEL", explored: ["BEL"] } },
    ready: (page) => expect(page.getByTestId("country-card")).toHaveAttribute("data-country", "BEL"),
  },
  {
    name: "Find",
    lesson: { started: true, stage: "find", find: { order: ORDER, index: 1, question: question("BEL", { hintLevel: 1 }), results: answers(ORDER, 1), status: "asking" } },
    ready: (page) => expect(page.getByTestId("find-prompt")).toHaveText("Find Belgium"),
  },
  {
    name: "Travel",
    lesson: { started: true, stage: "travel", travel: { missionId: "fra-to-nld", path: ["FRA", "BEL"], hintUsed: false, undoUsed: false } },
    ready: (page) => expect(page.getByTestId("crossings-left")).toHaveText("1 crossing left"),
  },
  {
    name: "Results",
    lesson: {
      started: true,
      stage: "results",
      find: { order: ORDER, index: 4, question: question("DEU", { solved: true }), results: answers(ORDER, 5, [2]), status: "complete" },
      travel: { missionId: "fra-to-nld", path: ["FRA", "BEL", "NLD"], hintUsed: false, undoUsed: false },
      lastTravelResult: { missionId: "fra-to-nld", route: ["FRA", "BEL", "NLD"], hintUsed: false, undoUsed: false },
      records: { discoverDone: true, findDone: true, travelDone: true, lastFindScore: { independent: 4, total: 5 }, bestFindScore: { independent: 4, total: 5 }, travelWithoutHelp: true },
    },
    ready: (page) => expect(page.getByRole("heading", { name: "Journey complete!" })).toBeVisible(),
  },
];

test.describe("Home", () => {
  test.beforeEach(() => {
    test.skip(test.info().project.name === "mobile", "Runs at 320px (small-phone) and on desktop.");
  });

  for (const stage of STAGES) {
    test(`in ${stage.name}: a labelled Home button that fits, keeps progress, and Continue resumes it`, async ({ page }) => {
      for (const locale of ["en", "hy"] as const) {
        await save(page, stage.lesson, { locale });
        const home = page.getByTestId("home");
        if (locale === "en") await stage.ready(page);
        else await expect(home).toBeVisible();
        await expect(home).toHaveAccessibleName(locale === "en" ? "Home" : "Գլխավոր");
        await expect(home).toHaveText(locale === "en" ? "Home" : "Գլխավոր");
        // A full touch target, fully on screen, overlapping nothing else in the header.
        const b = (await home.boundingBox())!;
        expect(b.width).toBeGreaterThanOrEqual(44);
        expect(b.height).toBeGreaterThanOrEqual(44);
        const header = page.locator("header");
        const others = await header.evaluate((h, homeEl) => {
          const r = (e: Element) => e.getBoundingClientRect();
          const hb = r(homeEl as Element);
          const parts = [...h.children].filter((c) => c !== homeEl && getComputedStyle(c).display !== "none");
          return {
            overlaps: parts.filter((c) => { const o = r(c); return o.left < hb.right - 0.5 && hb.left < o.right - 0.5 && o.top < hb.bottom - 0.5 && hb.top < o.bottom - 0.5; }).length,
            clipped: [...h.querySelectorAll("button")].some((btn) => { const o = r(btn); return o.left < 0 || o.right > window.innerWidth; }),
            textCut: (homeEl as HTMLElement).scrollWidth > (homeEl as HTMLElement).clientWidth + 1,
          };
        }, await home.elementHandle());
        expect(others, `${stage.name} ${locale}`).toEqual({ overlaps: 0, clipped: false, textCut: false });
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
        // The current step is still named for assistive technology (in Results every step is done, none current).
        await expect(page.locator('header li[aria-current="step"]')).toHaveCount(stage.name === "Results" ? 0 : 1);
        // The three step markers never touch each other, Home or the language toggle.
        const stepGaps = await page.evaluate(() => {
          const r = (e: Element) => e.getBoundingClientRect();
          const boxes = [document.querySelector('[data-testid="home"]')!, ...document.querySelectorAll("header ol li"), document.querySelector("header [role=group]")!].map(r);
          return boxes.slice(1).map((b, i) => Math.round((b.left - boxes[i].right) * 10) / 10);
        });
        for (const gap of stepGaps) expect(gap, `${stage.name} ${locale}: gaps ${stepGaps}`).toBeGreaterThanOrEqual(1);
      }

      // Home, then Continue: exactly the same place, also after a refresh on the home screen.
      await save(page, stage.lesson);
      await stage.ready(page);
      const panel = await page.getByTestId("panel").innerText();
      await page.getByTestId("home").click();
      await expect(page.getByRole("heading", { name: "AriMap" })).toBeVisible();
      await page.reload();
      await showLevel1(page);
      await expect(page.getByRole("button", { name: stage.name === "Results" ? /^Play again/ : /^Start over/ })).toBeVisible();
      await continueLevel1(page).click();
      await stage.ready(page);
      expect(await page.getByTestId("panel").innerText()).toBe(panel);
    });
  }

  test("is reachable by keyboard", async ({ page }) => {
    test.skip(test.info().project.name !== "desktop", "Runs once.");
    await save(page, STAGES[1].lesson);
    await STAGES[1].ready(page);
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("home")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(continueLevel1(page)).toBeVisible();
  });
});

test.describe("Start over", () => {
  test.beforeEach(() => {
    test.skip(test.info().project.name !== "small-phone", "Runs once, at 320px.");
  });

  test("asks first: keeping progress is the default, and confirming goes back to Discover with steps kept", async ({ page }) => {
    const inTravel = STAGES[2].lesson;
    await save(page, { ...inTravel, records: { discoverDone: true, findDone: true, travelDone: false, lastFindScore: null, bestFindScore: null, travelWithoutHelp: false } }, { screen: "welcome" });
    const dialog = page.getByTestId("start-over-dialog");
    const startOver = page.getByRole("button", { name: "Start over" });

    // Cancel (the focused default), Escape and the backdrop all keep the journey.
    await startOver.click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Start “France and its neighbours” over?" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Keep my progress" })).toBeFocused();
    for (const b of await dialog.getByRole("button").all()) {
      const box = (await b.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(320);
    }
    await page.keyboard.press("Enter");
    await expect(dialog).toBeHidden();
    await startOver.click();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await startOver.click();
    await page.mouse.click(5, 5);
    await expect(dialog).toBeHidden();
    await continueLevel1(page).click();
    await expect(page.getByTestId("crossings-left")).toHaveText("1 crossing left");

    // Armenian, then confirm.
    await page.getByTestId("home").click();
    await page.getByRole("button", { name: "Հայերեն" }).click();
    await page.getByRole("button", { name: "Սկսել նորից" }).click();
    await expect(dialog.getByRole("heading", { name: "Սկսե՞լ «Ֆրանսիան և իր հարևանները» մակարդակը նորից" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Պահել առաջընթացը" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    await dialog.getByRole("button", { name: "Սկսել նորից" }).click();
    await expect(page.getByRole("heading", { name: "Հպիր երկրին՝ դրա մասին իմանալու համար։" })).toBeVisible();
    await page.getByRole("button", { name: "English" }).click();
    // Completed steps stay ticked on the home screen.
    await page.getByTestId("home").click();
    await expect(page.getByText("Discover: done")).toBeAttached();
    await expect(page.getByText("Find: done")).toBeAttached();
    await expect(page.getByText("Travel: not done yet")).toBeAttached();
  });
});

test.describe("saves from the two-round Find", () => {
  test.beforeEach(() => {
    test.skip(test.info().project.name !== "mobile", "Runs once.");
  });
  const ORDERS = [ORDER, ["LUX", "FRA", "DEU", "NLD", "BEL"]];

  test("in the first round: the same question and hints, then five questions in all", async ({ page }) => {
    await save(page, {
      started: true,
      stage: "find",
      find: { orders: ORDERS, round: 0, index: 3, question: question("LUX", { hintLevel: 1 }), results: [answers(ORDER, 3, [0]), []], status: "asking" },
    });
    await expect(page.getByTestId("find-prompt")).toHaveText("Find Luxembourg");
    await expect(page.getByTestId("find-progress")).toHaveText("Question 4 of 5");
    await expect(page.getByText(/Its capital is/)).toBeVisible();
    await expect(page.getByTestId("panel")).not.toContainText(/round/i);
  });

  test("in the second round: the finished first round, ready to continue to Travel, then Results out of five", async ({ page }) => {
    await save(page, {
      started: true,
      stage: "find",
      find: { orders: ORDERS, round: 1, index: 2, question: question("DEU", { hintLevel: 2 }), results: [answers(ORDER, 5, [1, 3]), answers(ORDERS[1], 2)], status: "asking" },
      records: { discoverDone: true, findDone: false, travelDone: false, lastFindScore: null, bestFindScore: null, travelWithoutHelp: false },
    });
    await expect(page.getByTestId("find-progress")).toHaveText("Question 5 of 5");
    await expect(page.getByTestId("find-prompt")).toHaveText("Find Germany");
    await expect(page.getByTestId("find-feedback")).toContainText("Correct! That's Germany.");
    await expect(page.getByRole("button", { name: "Next" })).toHaveCount(0);
    await expect(page.getByTestId("panel")).not.toContainText(/round/i);
    await page.getByRole("button", { name: "Continue to Travel" }).click();
    await page.getByTestId("move-BEL").click();
    await page.getByTestId("move-NLD").click();
    await expect(page.getByTestId("result-find")).toContainText("3/5");
    const list = page.getByTestId("result-find-answers").locator("li");
    await expect(list).toHaveCount(5);
    expect(await list.evaluateAll((els) => els.map((e) => e.getAttribute("data-country")))).toEqual(ORDER);
  });

  test("at a round summary (Armenian): the fifth answer and the button to Travel, no round wording", async ({ page }) => {
    await save(
      page,
      {
        started: true,
        stage: "findSummary",
        find: { orders: ORDERS, round: 0, index: 4, question: question("DEU", { solved: true, feedback: { kind: "correct", country: "DEU" } }), results: [answers(ORDER, 5), []], status: "roundComplete" },
      },
      { locale: "hy" },
    );
    await expect(page.getByTestId("find-progress")).toHaveText("Հարց 5/5");
    await expect(page.getByRole("button", { name: "Անցնել ճամփորդությանը" })).toBeVisible();
    await expect(page.getByTestId("panel")).not.toContainText("Փուլ");
  });

  test("in Results after both rounds: scored out of five, and Home and Continue keep it", async ({ page }) => {
    await save(page, {
      started: true,
      stage: "results",
      find: { orders: ORDERS, round: 1, index: 4, question: question("BEL", { solved: true }), results: [answers(ORDER, 5, [0]), answers(ORDERS[1], 5)], status: "complete" },
      travel: { missionId: "fra-to-nld", path: ["FRA", "DEU", "NLD"], hintUsed: false, undoUsed: false },
      lastTravelResult: { missionId: "fra-to-nld", route: ["FRA", "DEU", "NLD"], hintUsed: false, undoUsed: false },
      records: { discoverDone: true, findDone: true, travelDone: true, lastFindScore: { independent: 9, total: 10 }, bestFindScore: { independent: 9, total: 10 }, travelWithoutHelp: true },
    });
    await expect(page.getByRole("heading", { name: "Journey complete!" })).toBeVisible();
    await expect(page.getByTestId("result-find")).toContainText("4/5");
    await expect(page.getByTestId("result-find")).not.toContainText("/10");
    await expect(page.getByTestId("result-find-answers").locator("li")).toHaveCount(5);
    await page.getByTestId("home").click();
    await expect(page.getByTestId(`level-${LESSON}`).getByTestId("level-status")).toHaveText("Completed");
    await showLevel1(page);
    await continueLevel1(page).click();
    await expect(page.getByTestId("result-find")).toContainText("4/5");
  });
});

/* The "travel notebook" interface: layout guarantees that must hold in both languages. */
test.describe("interface", () => {
  test("Welcome: the main action has its own area, covers nothing, and everything above it is reachable", async ({ page }) => {
    test.skip(test.info().project.name !== "small-phone", "Runs once, across phone sizes.");
    for (const [width, height] of [
      [320, 568],
      [320, 640],
      [390, 664],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height });
      for (const locale of ["en", "hy"]) {
        for (const lesson of [null, STAGES[1].lesson]) {
          await page.goto("/");
          await appReady(page);
          await page.evaluate((v) => localStorage.setItem("arimap:state", v), JSON.stringify({ version: 1, locale, screen: "welcome", lessons: lesson ? { [LESSON]: lesson } : {} }));
          await page.reload();
          const where = `${width}×${height} ${locale} ${lesson ? "in progress" : "new"}`;
          const main = page.getByTestId("welcome-actions").getByRole("button");
          await expect(main).toHaveText(lesson ? (locale === "en" ? /^Continue\s*Level 1/ : /^Շարունակել\s*Մակարդակ 1/) : locale === "en" ? /^Start\s*Level 1/ : /^Սկսել\s*Մակարդակ 1/);
          await expect(main).toHaveClass(/btn-primary/);
          // On screen without scrolling, and not covered.
          const b = (await main.boundingBox())!;
          expect(b.y + b.height, `${where}: main action below the fold`).toBeLessThanOrEqual(height);
          const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest("button")?.className ?? "", [b.x + b.width / 2, b.y + b.height / 2]);
          expect(hit, where).toContain("btn-primary");
          // Its area starts where the scrolling content ends: it covers none of it.
          const [content, bar] = await Promise.all([page.getByTestId("welcome-scroll").boundingBox(), page.getByTestId("welcome-actions").boundingBox()]);
          expect(bar!.y, `${where}: action area over the content`).toBeGreaterThanOrEqual(content!.y + content!.height - 0.5);
          expect(bar!.y + bar!.height).toBeLessThanOrEqual(height + 0.5);
          // The last level card (scrolled to the end), and Level 1's step chips and Start over (scrolled to them),
          // show fully above the action area, and are tappable.
          await page.getByTestId("welcome-scroll").evaluate((el) => el.scrollTo(0, el.scrollHeight));
          const targets = [page.getByTestId("levels").locator(":scope > li").last()];
          if (lesson) targets.push(page.getByTestId(`level-${LESSON}`).locator("ol li").last(), page.getByRole("button", { name: locale === "en" ? "Start over" : "Սկսել նորից" }));
          for (const target of targets) {
            if (target !== targets[0]) await target.evaluate((el) => el.scrollIntoView({ block: "nearest" }));
            const t = (await target.boundingBox())!;
            expect(t.y, `${where}: ${await target.textContent()} hidden above`).toBeGreaterThanOrEqual(content!.y - 0.5);
            expect(t.y + t.height, `${where}: ${await target.textContent()} under the action area`).toBeLessThanOrEqual(bar!.y + 0.5);
          }
          if (lesson) {
            const startOver = page.getByRole("button", { name: locale === "en" ? "Start over" : "Սկսել նորից" });
            await expect(startOver).toHaveClass(/btn-ghost/);
            await startOver.click();
            await expect(page.getByTestId("start-over-dialog")).toBeVisible();
            await page.keyboard.press("Escape");
          }
          expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
        }
      }
    }
  });

  test("Travel: neighbour choices fit their names and are full touch targets", async ({ page }) => {
    test.skip(test.info().project.name === "desktop", "Phones.");
    for (const locale of ["en", "hy"] as const) {
      await save(page, { started: true, stage: "travel", travel: { missionId: "fra-to-nld", path: ["FRA", "BEL"], hintUsed: false, undoUsed: false } }, { locale });
      const cards = page.locator('[data-testid^="move-"]');
      await expect(cards).toHaveCount(4);
      for (const card of await cards.all()) {
        const b = (await card.boundingBox())!;
        expect(b.height).toBeGreaterThanOrEqual(44);
        expect(await card.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), `${locale} ${await card.textContent()}`).toBe(true);
        const vw = page.viewportSize()!.width;
        expect(b.x + b.width).toBeLessThanOrEqual(vw);
      }
    }
  });

  test("Find: five question segments, the country asked for emphasized, and no landmark artwork", async ({ page }) => {
    test.skip(test.info().project.name !== "mobile", "Runs once.");
    await save(page, STAGES[1].lesson);
    const pips = page.getByTestId("panel").getByRole("progressbar");
    await expect(pips).toHaveAttribute("aria-valuenow", "1");
    await expect(pips).toHaveAttribute("aria-valuemax", "5");
    await expect(pips.locator("span")).toHaveCount(5);
    await expect(page.getByTestId("find-prompt")).toHaveText("Find Belgium");
    await expect(page.getByTestId("find-prompt").locator("span")).toHaveText("Belgium");
    // The hint names the landmark in words only: no illustration anywhere on the page.
    await expect(page.getByText(/Its capital is/)).toBeVisible();
    await expect(page.locator("img")).toHaveCount(0);
  });

  test("Results: a completion banner, the route and Find, and one replay action; Home is the header's", async ({ page }) => {
    test.skip(test.info().project.name !== "desktop", "Runs once.");
    for (const reducedMotion of ["no-preference", "reduce"] as const) {
      await page.emulateMedia({ reducedMotion });
      await save(page, STAGES[3].lesson);
      const banner = page.getByTestId("celebration");
      await expect(banner.getByRole("heading", { name: "Journey complete!" })).toBeVisible();
      const star = banner.locator("svg path");
      const animation = await star.evaluate((el) => getComputedStyle(el).animationName);
      if (reducedMotion === "reduce") expect(animation).toBe("none");
      else expect(animation).not.toBe("none");
      await expect(page.getByTestId("result-route")).toBeVisible();
      await expect(page.getByTestId("result-find")).toContainText("4/5");
      const actions = page.getByTestId("panel").getByRole("button");
      await expect(actions).toHaveText(["Replay journey"]);
      await expect(page.getByRole("button", { name: "Return to lesson" })).toHaveCount(0);
      await expect(page.getByTestId("home")).toBeVisible();
    }
  });
});

test.describe("corrections", () => {
  test("Travel: a complete row of neighbour choices shows without scrolling, before and after a move", async ({ page }) => {
    test.skip(test.info().project.name !== "small-phone", "Runs once, across phone sizes.");
    for (const [width, height] of [
      [320, 568],
      [320, 640],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height });
      for (const locale of ["en", "hy"] as const) {
        for (const path of [["FRA"], ["FRA", "BEL"]]) {
          await save(page, { started: true, stage: "travel", travel: { missionId: "fra-to-nld", path, hintUsed: false, undoUsed: false } }, { locale });
          const where = `${width}×${height} ${locale} at ${path.at(-1)}`;
          const cards = page.locator('[data-testid^="move-"]');
          await expect(cards.first()).toBeVisible();
          const boxes = await cards.evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ top: r.top, bottom: r.bottom, left: r.left, right: r.right })));
          // The first row: every card sharing the first card's top, all of it on screen.
          const row = boxes.filter((b) => Math.abs(b.top - boxes[0].top) < 1);
          for (const b of row) expect(b.bottom, `${where}: first row cut off`).toBeLessThanOrEqual(height);
          // Two columns only where names fit whole; never cut, never broken mid-word.
          for (const card of await cards.all()) {
            const fit = await card.evaluate((el) => {
              const name = el.querySelector("span")!;
              const lines = Math.round(name.getBoundingClientRect().height / parseFloat(getComputedStyle(name).lineHeight || "20"));
              return { fits: el.scrollWidth <= el.clientWidth + 1, oneWord: !name.textContent!.includes(" "), lines };
            });
            expect(fit.fits, `${where}: ${await card.textContent()}`).toBe(true);
            if (fit.oneWord) expect(fit.lines, `${where}: ${await card.textContent()} broken`).toBeLessThanOrEqual(1);
            expect((await card.boundingBox())!.height).toBeGreaterThanOrEqual(44);
          }
          // Every choice and Hint, Undo and Restart are reachable by scrolling the panel.
          await page.getByTestId("panel").evaluate((el) => el.scrollTo(0, el.scrollHeight));
          const panel = (await page.getByTestId("panel").boundingBox())!;
          for (const button of await page.getByTestId("travel-tools").getByRole("button").all()) {
            const b = (await button.boundingBox())!;
            expect(b.y + b.height, `${where}: tools`).toBeLessThanOrEqual(panel.y + panel.height + 1);
            expect(b.height).toBeGreaterThanOrEqual(44);
          }
          // The map keeps its height (the "Preserve the map" rule: same clamp as before).
          const map = (await page.getByTestId("map-main").boundingBox())!;
          expect(map.height, where).toBeGreaterThanOrEqual(Math.min(200, height * 0.42) - 2);
        }
      }
    }
  });

  test("Results: every step done for eyes and screen readers; Replay journey makes Travel current again", async ({ page }) => {
    test.skip(test.info().project.name !== "mobile", "Runs once.");
    for (const locale of ["en", "hy"] as const) {
      await save(page, STAGES[3].lesson, { locale });
      const steps = page.locator("header ol li");
      await expect(steps).toHaveCount(3);
      await expect(page.locator('header li[aria-current="step"]')).toHaveCount(0);
      const spoken = await steps.evaluateAll((els) => els.map((e) => e.querySelector(".visually-hidden")!.textContent));
      expect(spoken).toEqual(locale === "en" ? ["Discover: done", "Find: done", "Travel: done"] : ["Բացահայտիր՝ արված է", "Գտիր՝ արված է", "Ճամփորդիր՝ արված է"]);
      // Each shows a check, not a number.
      for (const dot of await steps.locator("span[aria-hidden] svg").all()) await expect(dot).toBeVisible();
      await expect(steps.locator("span[aria-hidden] svg")).toHaveCount(3);
      // One heading, no stage label above it.
      const banner = page.getByTestId("celebration");
      await expect(banner.getByRole("heading")).toHaveText(locale === "en" ? "Journey complete!" : "Ճամփորդությունն ավարտվեց։");
      await expect(banner).toHaveText(locale === "en" ? "Journey complete!" : "Ճամփորդությունն ավարտվեց։");
      await expect(banner.locator("svg")).toHaveCount(1);

      await page.getByTestId("panel").getByRole("button").last().click();
      await expect(page.getByTestId("crossings-left")).toBeVisible();
      await expect(page.locator('header li[aria-current="step"]')).toContainText(locale === "en" ? "Travel" : "Ճամփորդիր");
      await expect(page.locator('header li[aria-current="step"]')).toHaveAttribute("data-accent", "travel");
      await expect(page.getByTestId("panel").locator("p").first()).toHaveText(locale === "en" ? "Travel" : "Ճամփորդիր");
      await expect(steps.locator("span[aria-hidden] svg")).toHaveCount(2);
    }
  });

  test("Find: the country asked for sits whole on its background, even the longest names at 320px", async ({ page }) => {
    test.skip(test.info().project.name !== "small-phone", "Runs once, at 320px.");
    for (const locale of ["en", "hy"] as const) {
      for (const target of ["NLD", "LUX", "DEU"]) {
        await save(page, { started: true, stage: "find", find: { order: [target, ...ORDER.filter((c) => c !== target)], index: 0, question: question(target), results: [], status: "asking" } }, { locale });
        const title = page.getByTestId("find-prompt");
        const name = title.locator("span");
        const where = `${locale} ${target}`;
        // The instruction word stays outside the highlight.
        const [titleText, nameText] = [await title.textContent(), await name.textContent()];
        expect(titleText!.startsWith(locale === "en" ? "Find " : "Գտիր "), where).toBe(true);
        expect(nameText, where).not.toMatch(/^(Find|Գտիր)/);
        const m = await name.evaluate((el) => {
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          return { right: r.right, left: r.left, words: el.textContent!.split(" ").length, lines: Math.round((r.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)) / parseFloat(cs.lineHeight)), padTop: parseFloat(cs.paddingTop), padX: parseFloat(cs.paddingLeft), bg: cs.backgroundColor, color: cs.color, panelRight: el.closest("section")!.getBoundingClientRect().right };
        });
        expect(m.right, `${where}: overflows`).toBeLessThanOrEqual(m.panelRight);
        expect(m.left).toBeGreaterThanOrEqual(0);
        // A single word is never split across lines.
        expect(m.lines, where).toBeLessThanOrEqual(m.words);
        expect(m.padTop).toBeGreaterThan(0);
        expect(m.padX).toBeGreaterThan(3);
        expect(m.bg).toBe("rgb(255, 240, 179)");
        expect(m.color).toBe("rgb(31, 58, 95)");
        // Nothing on the map gives the answer away.
        expect(await page.locator('[data-testid="map-main"] path[data-tone]:not([data-tone="default"])').count()).toBe(0);
        expect(await page.locator('[data-testid="map-main"] [data-label] text').count()).toBe(0);
      }
    }
  });
});

test.describe("header", () => {
  test("Home, the steps and the language toggle never overlap, at every text size", async ({ page }) => {
    test.skip(test.info().project.name !== "small-phone", "Runs once, across screen widths.");
    test.setTimeout(240_000);
    // Discover has the longest current step name; Results shows three checks and no current step.
    const stages = [
      { name: "Discover", lesson: STAGES[0].lesson },
      { name: "Results", lesson: STAGES[3].lesson },
    ];
    for (const width of [320, 390, 600, 1366]) {
      await page.setViewportSize({ width, height: 800 });
      for (const stage of stages) {
        for (const locale of ["en", "hy"] as const) {
          await save(page, stage.lesson, { locale });
          await expect(page.getByTestId("home")).toBeVisible();
          for (const size of [100, 150, 200]) {
            const frames = await setHeaderTextSize(page, size);
            const where = `${width}px ${stage.name} ${locale} ${size}%`;
            // The layout checked below is already the one painted in the first frame: no jump.
            expect(frames.firstFrame, `${where}: first frame`).toBe(frames.settled);
            const m = await page.evaluate(() => {
              const r = (e: Element) => e.getBoundingClientRect();
              const visible = (e: Element) => getComputedStyle(e).display !== "none" && !e.classList.contains("visually-hidden") && r(e).width > 0;
              const home = document.querySelector('[data-testid="home"]') as HTMLElement;
              const lang = document.querySelector("header [role=group]")!;
              const steps = [...document.querySelectorAll("header ol li")];
              // The three groups, and each step on its own: no two may share any pixels.
              const boxes = [
                { name: "Home", box: r(home) },
                ...steps.map((li, i) => ({ name: `step ${i + 1}`, box: r(li) })),
                { name: "language", box: r(lang) },
              ];
              const overlaps: string[] = [];
              for (let i = 0; i < boxes.length; i++)
                for (let j = i + 1; j < boxes.length; j++) {
                  const [a, b] = [boxes[i].box, boxes[j].box];
                  if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5) overlaps.push(`${boxes[i].name}/${boxes[j].name}`);
                }
              // Nothing inside a step spills out of it (a cut or overflowing name).
              const spills = steps.flatMap((li, i) =>
                [...li.children].filter(visible).filter((c) => r(c).left < r(li).left - 0.5 || r(c).right > r(li).right + 0.5).map(() => `step ${i + 1}`),
              );
              const offScreen = boxes.filter(({ box }) => box.left < 0 || box.right > window.innerWidth).map((b) => b.name);
              const homeLabel = home.querySelector("span")!;
              return {
                overlaps,
                spills,
                offScreen,
                homeLabelShown: visible(homeLabel) && home.scrollWidth <= home.clientWidth + 1,
                homeHeight: r(home).height,
                langButtons: [...lang.querySelectorAll("button")].map((b) => Math.min(r(b).width, r(b).height)),
                homeFont: parseFloat(getComputedStyle(homeLabel).fontSize),
                spoken: steps.map((li) => li.querySelector(".visually-hidden")!.textContent),
                stepsBelow: steps.every((li) => r(li).top >= r(home).bottom) ? "own row" : "one row",
                langBesideHome: r(lang).top < r(home).bottom && r(home).top < r(lang).bottom,
                // Whether Home (in its tight form) and the toggle could share a row at all.
                pairFits: r(home).width + r(lang).width + (parseFloat(getComputedStyle(home.parentElement!).columnGap) || 0) <= home.parentElement!.clientWidth - parseFloat(getComputedStyle(home.parentElement!).paddingLeft) - parseFloat(getComputedStyle(home.parentElement!).paddingRight),
                stepsInARow: steps.every((li) => Math.abs(r(li).top + r(li).height / 2 - (r(steps[0]).top + r(steps[0]).height / 2)) < 1),
              };
            });
            expect(m.overlaps, where).toEqual([]);
            expect(m.spills, where).toEqual([]);
            expect(m.offScreen, where).toEqual([]);
            expect(m.homeLabelShown, `${where}: Home's name`).toBe(true);
            expect(m.homeHeight, where).toBeGreaterThanOrEqual(44);
            for (const b of m.langButtons) expect(b, `${where}: language buttons`).toBeGreaterThanOrEqual(40);
            // The text really is enlarged, not scaled back to fit.
            expect(m.homeFont, where).toBeGreaterThanOrEqual((16 * size) / 100 - 0.5);
            // Every step keeps its name for screen readers, whatever is shown.
            expect(m.spoken.every((s) => s && s.length > 3), where).toBe(true);
            // At most two rows: only the steps move below; Home and the language toggle keep the first,
            // wherever the two fit side by side. (Armenian at 200% on a 320px phone, in Noto Sans
            // Armenian: Home alone is about two-thirds of the row, so the toggle takes a row of its own.)
            if (m.pairFits) expect(m.langBesideHome, where).toBe(true);
            else expect(`${width}px ${locale} ${size}%`, `${where}: Home and the toggle can't share a row`).toBe(`320px hy 200%`);
            expect(m.stepsInARow, where).toBe(true);
            if (width === 1366 || size === 100) expect(m.stepsBelow, where).toBe("one row");
          }
        }
      }
    }
  });
});

test.describe("header, opened with the text already enlarged", () => {
  test("shows its final layout from the first frame: no jump after it appears", async ({ context }) => {
    test.skip(test.info().project.name !== "small-phone", "Runs once, at 320px.");
    // Home and the toggle only fit side by side without Home's icon ("tight"): the case that
    // used to be painted first as one row, then as the toggle wrapped below Home.
    const cases = [
      { locale: "hy", size: 200, layout: "tight" },
      { locale: "en", size: 150, layout: "stacked" },
      { locale: "en", size: 100, layout: "row" },
    ] as const;
    for (const { locale, size, layout } of cases) {
      // A page of its own for each case, so each has only its own start-up script.
      const page = await context.newPage();
      await save(page, STAGES[0].lesson, { locale });
      // From the very start of the page: the enlarged text, and the header's layout as it is
      // before each frame (so as the previous frame was painted), from the frame it first appears in.
      await page.addInitScript((s) => {
        const seen: string[] = [];
        (window as unknown as { headerLayouts: string[] }).headerLayouts = seen;
        // The script can run before the page's <html> element exists.
        const enlarge = () => document.documentElement && (document.documentElement.style.fontSize = `${s}%`);
        if (!enlarge()) new MutationObserver((_, o) => enlarge() && o.disconnect()).observe(document, { childList: true });
        const record = () => {
          const layout = document.querySelector("header")?.getAttribute("data-layout");
          if (layout && seen.at(-1) !== layout) seen.push(layout);
          if (seen.length < 20) requestAnimationFrame(record);
        };
        requestAnimationFrame(record);
      }, size);
      await page.reload();
      await expect(page.getByTestId("home")).toBeVisible();
      await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
      const seen = await page.evaluate(() => (window as unknown as { headerLayouts: string[] }).headerLayouts);
      expect(seen, `${locale} ${size}%`).toEqual([layout]);
      await page.close();
    }
  });
});

test.describe("Find heading", () => {
  test("the country asked for is never clipped: whole when it fits, broken inside only when one word cannot fit", async ({ page }) => {
    test.skip(test.info().project.name !== "small-phone", "Runs once, across phone widths.");
    test.setTimeout(180_000);
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 700 });
      for (const locale of ["en", "hy"] as const) {
        for (const target of ["NLD", "LUX"]) {
          await save(page, { started: true, stage: "find", find: { order: [target, ...ORDER.filter((c) => c !== target)], index: 0, question: question(target), results: [], status: "asking" } }, { locale });
          await expect(page.getByTestId("find-prompt")).toBeVisible();
          for (const size of [100, 150, 200]) {
            await setTextSize(page, size);
            const where = `${width}px ${locale} ${target} ${size}%`;
            const m = await page.getByTestId("find-prompt").evaluate((h1) => {
              const r = (e: Element) => e.getBoundingClientRect();
              const name = h1.querySelector("span")!;
              const panel = h1.closest('[data-testid="panel"]')!;
              // Every piece of text as laid out (glyph boxes), checked against the heading, the panel and the screen.
              const range = document.createRange();
              range.selectNodeContents(h1);
              const hb = r(h1);
              const pb = r(panel);
              const clipped = [...range.getClientRects()].filter(
                (t) => t.width > 0 && (t.left < hb.left - 0.5 || t.right > hb.right + 0.5 || t.left < pb.left - 0.5 || t.right > pb.right + 0.5 || t.right > window.innerWidth),
              ).length;
              const nameClipped = [...name.getClientRects()].filter((t) => t.left < pb.left - 0.5 || t.right > Math.min(pb.right, window.innerWidth) + 0.5).length;
              // The name's width on one line, to know whether it could have stayed whole.
              const probe = name.cloneNode(true) as HTMLElement;
              probe.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap";
              h1.appendChild(probe);
              const oneLine = r(probe).width;
              probe.remove();
              const cs = getComputedStyle(name);
              return {
                clipped,
                nameClipped,
                headingScrolls: h1.scrollWidth > h1.clientWidth + 1,
                panelScrollsSideways: panel.scrollWidth > panel.clientWidth + 1,
                pageScrollsSideways: document.documentElement.scrollWidth > window.innerWidth,
                fits: oneLine <= h1.clientWidth,
                lines: Math.round((r(name).height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)) / parseFloat(cs.lineHeight)),
                font: parseFloat(getComputedStyle(h1).fontSize),
                bg: cs.backgroundColor,
                hidden: [cs.overflow, cs.textOverflow, getComputedStyle(h1).overflow].join(" "),
              };
            });
            expect(m.clipped, `${where}: text outside the heading`).toBe(0);
            expect(m.nameClipped, `${where}: name outside the panel`).toBe(0);
            expect(m.headingScrolls, where).toBe(false);
            expect(m.panelScrollsSideways, where).toBe(false);
            expect(m.pageScrollsSideways, where).toBe(false);
            // Whole on one line whenever it fits.
            if (m.fits) expect(m.lines, `${where}: fits, but broken`).toBe(1);
            // Enlarged as asked (1.5rem), on its highlight, never cut or hidden to fit.
            expect(m.font, where).toBeGreaterThanOrEqual(24 * (size / 100) - 0.5);
            expect(m.bg, where).toBe("rgb(255, 240, 179)");
            expect(m.hidden, where).toBe("visible clip visible");
            // The panel grows downwards instead; the instruction below the name can be scrolled into view above the pinned Hint.
            const reach = await page.getByTestId("panel").evaluate((panel) => {
              panel.scrollTo(0, panel.scrollHeight);
              const lead = panel.querySelector("h1 + p")!.getBoundingClientRect();
              const footer = panel.querySelector("button.btn-secondary")!.parentElement!.getBoundingClientRect();
              return { leadBottom: lead.bottom, footerTop: footer.top };
            });
            expect(reach.leadBottom, `${where}: instruction under the Hint button`).toBeLessThanOrEqual(reach.footerTop + 1);
            await page.getByTestId("panel").evaluate((panel) => panel.scrollTo(0, 0));
          }
        }
      }
    }
  });
});
