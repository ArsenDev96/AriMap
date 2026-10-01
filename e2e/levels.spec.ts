import { expect, test, type Page } from "@playwright/test";

/*
 * The level selection, Level 2 (Around the Alps) from Discover to Results, and
 * progress kept apart per level across Home, Continue, refreshes and Start over.
 */

const L1 = "western-europe-1";
const L2 = "around-the-alps";
const L3 = "central-europe";
const L1_ORDER = ["FRA", "BEL", "NLD", "LUX", "DEU"];
const L3_COUNTRIES = ["DEU", "POL", "CZE", "SVK", "AUT"];
const L2_COUNTRIES = ["FRA", "CHE", "DEU", "AUT", "ITA"];
const NAMES: Record<string, string> = { France: "FRA", Switzerland: "CHE", Germany: "DEU", Austria: "AUT", Italy: "ITA" };
const LANDMARKS: Record<string, string> = { FRA: "Eiffel Tower", CHE: "Chapel Bridge", DEU: "Brandenburg Gate", AUT: "Schönbrunn Palace", ITA: "Colosseum" };

/** The landmark as the illustration's alt text names it (its in-sentence form), in each language. */
const ALT_EN: Record<string, string> = { FRA: "the Eiffel Tower", CHE: "the Chapel Bridge", DEU: "the Brandenburg Gate", AUT: "Schönbrunn Palace", ITA: "the Colosseum" };
const ALT_HY: Record<string, string> = { CHE: "Մատուռի կամուրջը", AUT: "Շյոնբրունի պալատը", ITA: "Կոլիզեումը" };

const answers = (order: string[]) => order.map((target) => ({ target, wrongGuesses: 0, hintLevel: 0 }));
const records = (travelDone: boolean) => ({ discoverDone: true, findDone: travelDone, travelDone, lastFindScore: null, bestFindScore: null, travelWithoutHelp: false });

/** Level 1 finished, at its Results (as a version 1 save, from before there were levels). */
const LEVEL1_DONE = {
  started: true,
  stage: "results",
  discover: { selected: null, explored: [] },
  find: { order: L1_ORDER, index: 4, question: { target: "DEU", wrongGuesses: [], hintLevel: 0, solved: true, feedback: null }, results: answers(L1_ORDER), status: "complete" },
  travel: { missionId: "fra-to-nld", path: ["FRA", "BEL", "NLD"], hintUsed: false, undoUsed: false },
  lastTravelResult: { missionId: "fra-to-nld", route: ["FRA", "BEL", "NLD"], hintUsed: false, undoUsed: false },
  records: { ...records(true), lastFindScore: { independent: 5, total: 5 }, bestFindScore: { independent: 5, total: 5 } },
};

/**
 * Waits until the game has mounted: it saves the state it loaded when it mounts,
 * which would otherwise overwrite a save written by the test just before.
 */
async function appReady(page: Page) {
  await expect(page.locator(".splash")).toHaveCount(0);
  await expect(page.locator("main").first()).toBeVisible();
}

async function saveV1(page: Page, lesson: object | null, { locale = "en", screen = "welcome" } = {}) {
  await page.goto("/");
  await appReady(page);
  await page.evaluate((v) => localStorage.setItem("arimap:state", v), JSON.stringify({ version: 1, locale, screen, lessons: lesson ? { [L1]: lesson } : {} }));
  await page.reload();
}

async function saveV2(page: Page, levels: Record<string, object>, { locale = "en", screen = "welcome", levelId = L1, recent = [] as string[] } = {}) {
  await page.goto("/");
  await appReady(page);
  await page.evaluate((v) => localStorage.setItem("arimap:state", v), JSON.stringify({ version: 2, locale, screen, levelId, recent, levels }));
  await page.reload();
}

let shotIndex = 0;
async function shot(page: Page, name: string) {
  await page.screenshot({ path: `screenshots/${test.info().project.name}/levels-${String(++shotIndex).padStart(2, "0")}-${name}.png` });
}

const card = (page: Page, id: string) => page.getByTestId(`level-${id}`);

/** Opens a completed level's one-line summary (returning players), so its details and buttons show. */
async function expand(page: Page, id: string) {
  const toggle = card(page, id).getByTestId("level-details-toggle");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
}
const mainAction = (page: Page) => page.getByTestId("welcome-actions").getByRole("button");

async function setLanguage(page: Page, lang: "English" | "Հայերեն") {
  await page.getByRole("button", { name: lang, exact: true }).first().click();
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  // Nor inside the level selection's own scrolling area, where the page itself would not show it.
  const inner = await page.evaluate(() => {
    const scroll = document.querySelector('[data-testid="welcome-scroll"]');
    if (!scroll) return [];
    const wide = scroll.scrollWidth > scroll.clientWidth + 0.5 ? ["the scrolling area"] : [];
    const cards = [...scroll.querySelectorAll("article")].filter((a) => a.getBoundingClientRect().right > scroll.getBoundingClientRect().right + 0.5);
    return [...wide, ...cards.map((a) => a.getAttribute("data-testid"))];
  });
  expect(inner, "wider than the screen").toEqual([]);
}

/** An on-screen point that hits the country's own path (not a neighbour, label or control). */
async function tapCountry(page: Page, id: string) {
  const point = await page.evaluate((id) => {
    const path = document.querySelector(`[data-testid="map-main"] path[data-country="${id}"]`)!;
    const r = path.getBoundingClientRect();
    const hits: [number, number][] = [];
    for (let i = 1; i < 24; i++)
      for (let j = 1; j < 24; j++) {
        const [x, y] = [r.left + (r.width * i) / 24, r.top + (r.height * j) / 24];
        if (document.elementFromPoint(x, y) === path) hits.push([x, y]);
      }
    if (hits.length === 0) return null;
    const cx = hits.reduce((s, h) => s + h[0], 0) / hits.length;
    const cy = hits.reduce((s, h) => s + h[1], 0) / hits.length;
    hits.sort((a, b) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy));
    return hits[0];
  }, id);
  expect(point, `${id} should be tappable`).not.toBeNull();
  if (test.info().project.use.hasTouch) await page.touchscreen.tap(point![0], point![1]);
  else await page.mouse.click(point![0], point![1]);
}

/** Map names never overlap each other, nor the map's controls. */
async function expectMapTextClear(page: Page) {
  const problems = await page.evaluate(() => {
    const box = (el: Element) => el.getBoundingClientRect();
    const hit = (a: DOMRect, b: DOMRect) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
    const texts = [
      ...[...document.querySelectorAll('[data-testid="map-main"] text')].map((t) => ({ name: t.textContent, b: box(t) })),
      ...[...document.querySelectorAll('[data-testid="map-main"] [data-explored-badge]')].map((g) => ({ name: `badge of ${g.parentElement?.getAttribute("data-label")}`, b: box(g) })),
    ];
    const controls = document.querySelector('[data-testid="map-controls"]');
    const out: string[] = [];
    texts.forEach((a, i) => {
      texts.slice(i + 1).forEach((b) => hit(a.b, b.b) && out.push(`${a.name} × ${b.name}`));
      if (controls && hit(a.b, box(controls))) out.push(`${a.name} hidden`);
    });
    return out;
  });
  expect(problems, "map labels collide").toEqual([]);
}

test.describe("level selection", () => {
  test("five levels with their number, name, countries and status in words; only playable ones can be started", async ({ page }) => {
    shotIndex = 0;
    const phone = test.info().project.name !== "desktop";
    for (const [state, label] of [
      [null, "new"],
      [LEVEL1_DONE, "unlocked"],
    ] as const) {
      for (const locale of ["en", "hy"] as const) {
        await saveV1(page, state, { locale });
        const cards = page.getByTestId("levels").locator(":scope > li > article");
        await expect(cards).toHaveCount(5);
        const statuses = await page.getByTestId("level-status").allTextContents();
        const expected =
          locale === "en"
            ? [state ? "Completed" : "Ready to play", state ? "Ready to play" : "Locked", "Locked", "Coming soon", "Coming soon"]
            : [state ? "Ավարտված է" : "Պատրաստ է խաղալու", state ? "Պատրաստ է խաղալու" : "Փակ է", "Փակ է", "Շուտով", "Շուտով"];
        statuses.forEach((text, i) => expect(text.startsWith(expected[i]), `${label} ${locale} card ${i + 1}: ${text}`).toBe(true));
        // Number and name on every card, and its countries.
        for (const [i, id] of [L1, L2, "central-europe", "along-the-adriatic", "towards-greece"].entries()) {
          await expect(card(page, id)).toContainText(locale === "en" ? `Level ${i + 1}` : `Մակարդակ ${i + 1}`);
        }
        await expect(card(page, L2)).toContainText(locale === "en" ? "France · Switzerland · Germany · Austria · Italy" : "Ֆրանսիա · Շվեյցարիա · Գերմանիա · Ավստրիա · Իտալիա");
        await expect(card(page, "towards-greece")).toContainText(locale === "en" ? "Hungary · Romania · Serbia · Bulgaria · Greece" : "Հունգարիա · Ռումինիա · Սերբիա · Բուլղարիա · Հունաստան");
        // Coming soon: says so, and has no action at all. Locked: names what unlocks it, and no action either.
        for (const id of ["central-europe", "along-the-adriatic", "towards-greece"]) await expect(card(page, id).getByRole("button")).toHaveCount(0);
        // Level 3 opens after Level 2, not Level 1.
        await expect(card(page, "central-europe")).toContainText(locale === "en" ? "Complete “Around the Alps” to unlock it." : "Բացելու համար ավարտիր «Ալպերի շուրջը» մակարդակը։");
        await expect(card(page, "central-europe")).toContainText(locale === "en" ? "Germany · Poland · Czechia · Slovakia · Austria" : "Գերմանիա · Լեհաստան · Չեխիա · Սլովակիա · Ավստրիա");
        if (!state) {
          await expect(card(page, L2).getByRole("button")).toHaveCount(0);
          await expect(card(page, L2)).toContainText(locale === "en" ? "Complete “France and its neighbours” to unlock it." : "Բացելու համար ավարտիր «Ֆրանսիան և իր հարևանները» մակարդակը։");
        }
        // The one main action.
        await expect(page.locator(".btn-primary")).toHaveCount(1);
        await expect(mainAction(page)).toHaveText(
          locale === "en" ? (state ? /^Start\s*Level 2 · Around the Alps$/ : /^Start\s*Level 1 · France and its neighbours$/) : state ? /^Սկսել\s*Մակարդակ 2 · Ալպերի շուրջը$/ : /^Սկսել\s*Մակարդակ 1/,
        );
        await expectNoHorizontalOverflow(page);
        await shot(page, `${label}-${locale}`);

        // Every card can be scrolled fully into view above the action area, at the normal and enlarged text sizes.
        for (const size of [100, 150, 200]) {
          await page.evaluate((s) => (document.documentElement.style.fontSize = `${s}%`), size);
          const bar = (await page.getByTestId("welcome-actions").boundingBox())!;
          const scroll = (await page.getByTestId("welcome-scroll").boundingBox())!;
          for (const li of await page.getByTestId("levels").locator(":scope > li").all()) {
            await li.evaluate((el) => el.scrollIntoView({ block: "end" }));
            const b = (await li.boundingBox())!;
            if (b.height <= bar.y - scroll.y) {
              expect(b.y + b.height, `${label} ${locale} ${size}%: card under the action area`).toBeLessThanOrEqual(bar.y + 0.5);
              expect(b.y).toBeGreaterThanOrEqual(scroll.y - 0.5);
            }
            // Its buttons are whole touch targets, not covered by the action area.
            for (const button of await li.getByRole("button").all()) {
              await button.scrollIntoViewIfNeeded();
              const bb = (await button.boundingBox())!;
              expect(bb.height).toBeGreaterThanOrEqual(44);
              expect(bb.y + bb.height, `${label} ${locale} ${size}%: button under the action area`).toBeLessThanOrEqual((await page.getByTestId("welcome-actions").boundingBox())!.y + 0.5);
            }
          }
          await expectNoHorizontalOverflow(page);
          if (size === 200 && phone && locale === "hy") await shot(page, `${label}-${locale}-text200`);
        }
        await page.evaluate(() => (document.documentElement.style.fontSize = ""));
      }
    }
  });

  test("an old save with Level 1 completed opens Level 2 at Discover, with Level 1 still completed", async ({ page }) => {
    test.skip(test.info().project.name !== "small-phone", "Runs once.");
    await saveV1(page, LEVEL1_DONE);
    await mainAction(page).click();
    await expect(page.getByRole("heading", { name: "Tap a country to learn about it." })).toBeAttached();
    await page.getByTestId("home").click();
    await expect(card(page, L1).getByTestId("level-status")).toHaveText("Completed");
    await expect(card(page, L2).getByTestId("level-status")).toHaveText("In progress: Discover");
    // A backup of the old save was kept.
    expect(await page.evaluate(() => localStorage.getItem("arimap:state:backup"))).toContain('"version":1');
  });
});

test("Level 2, Around the Alps: Discover, Find, Travel and Results", async ({ page }) => {
  shotIndex = 10;
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" || /hydrat/i.test(m.text())) errors.push(`console ${m.type()}: ${m.text()}`);
  });
  await saveV1(page, LEVEL1_DONE);
  await card(page, L2).getByRole("button", { name: /^Start/ }).click();

  // --- Discover -----------------------------------------------------------------
  await expect(page.getByRole("heading", { name: "Tap a country to learn about it." })).toBeAttached();
  await expect(page.getByTestId("map-main")).toHaveAttribute("aria-label", "Map of the Alpine countries");
  // No close-up in this level: nothing Luxembourg-specific is inherited.
  await expect(page.getByTestId("inset-toggle")).toHaveCount(0);
  await expect(page.getByTestId("map-inset")).toHaveCount(0);
  await expect(page.locator('[data-testid="map-main"] [data-callout]')).toHaveCount(0);
  const labels = await page.locator('[data-testid="map-main"] text').allTextContents();
  expect(labels).toEqual(expect.arrayContaining(Object.keys(NAMES)));
  await expectMapTextClear(page);
  const cardEl = page.getByTestId("country-card");
  for (const id of L2_COUNTRIES) {
    await tapCountry(page, id);
    await expect(cardEl).toHaveAttribute("data-country", id);
    const landmark = page.getByTestId("landmark-card");
    await expect(landmark).toContainText(LANDMARKS[id]);
    // Every landmark has its own illustration, loaded and named for screen readers.
    await expect(landmark).toHaveAttribute("data-art", "illustration");
    const image = page.getByTestId("landmark-image");
    await expect(image).toHaveCount(1);
    await expect(image).toHaveAttribute("alt", `Illustration of ${ALT_EN[id]}`);
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    await expect(page.locator('[data-testid="map-main"] [data-marker-text]').first()).toBeAttached();
    await expectMapTextClear(page);
    // Germany's hint fits this level's region.
    if (id === "DEU") await expect(cardEl).toContainText("in the north of this region");
    if (id === "ITA") await shot(page, "discover-italy-en");
    if (id === "CHE") {
      await expect(page.getByTestId("country-capital")).toContainText("Bern");
      await shot(page, "discover-switzerland-en");
    }
  }
  await expect(page.getByTestId("discover-progress")).toContainText("5/5");
  await setLanguage(page, "Հայերեն");
  await tapCountry(page, "AUT");
  await expect(cardEl.getByRole("heading", { name: "Ավստրիա" })).toBeVisible();
  await expect(page.getByTestId("landmark-card")).toContainText("Շյոնբրունի պալատ");
  await expectNoHorizontalOverflow(page);
  await expectMapTextClear(page);
  await shot(page, "discover-austria-hy");
  await setLanguage(page, "English");
  await page.getByRole("button", { name: "Start finding" }).click();

  // --- Find ---------------------------------------------------------------------
  const asked: string[] = [];
  for (let q = 0; q < 5; q++) {
    await expect(page.getByTestId("find-progress")).toHaveText(`Question ${q + 1} of 5`);
    const text = (await page.getByTestId("find-prompt").textContent())!.replace(/^Find /, "").trim();
    const target = NAMES[text];
    expect(target, text).toBeDefined();
    asked.push(target);
    // Nothing gives the answer away: no names, markers, colours, badges or callouts, no landmark in the panel.
    expect(await page.locator('[data-testid="map-main"] text').allTextContents()).toEqual([]);
    await expect(page.locator("[data-explored-badge], [data-flash], [data-callout], [data-marker-text]")).toHaveCount(0);
    expect(await page.locator('[data-testid="map-main"] path[data-tone]:not([data-tone="default"])').count()).toBe(0);
    await expect(page.getByTestId("landmark-card")).toHaveCount(0);
    await expect(page.getByTestId("panel")).not.toContainText(LANDMARKS[target]);
    expect(await page.locator('[data-testid="map-main"] [aria-label]').evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")).filter((l) => l && /Switzerland|Austria|Italy|France|Germany/.test(l)))).toEqual([]);
    if (q === 0) {
      const wrong = target === "ITA" ? "AUT" : "ITA";
      await tapCountry(page, wrong);
      await expect(page.getByTestId("find-feedback")).toContainText("Try again.");
      await page.getByRole("button", { name: "Hint" }).click();
      await expect(page.getByTestId("panel")).toContainText(LANDMARKS[target]);
      await shot(page, "find-hint-en");
      // Home and a refresh keep the question exactly; Continue resumes it.
      await page.getByTestId("home").click();
      await expect(mainAction(page)).toHaveText(/^Continue\s*Level 2 · Around the Alps$/);
      await page.reload();
      await mainAction(page).click();
      await expect(page.getByTestId("find-prompt")).toHaveText(`Find ${text}`);
      await expect(page.getByText(/Its capital is/)).toBeVisible();
    }
    await tapCountry(page, target);
    await expect(page.getByTestId("find-feedback")).toBeVisible();
    if (q === 1) await shot(page, "find-correct-en");
    await page.getByRole("button", { name: q < 4 ? "Next" : "Continue to Travel" }).click();
  }
  expect([...asked].sort()).toEqual([...L2_COUNTRIES].sort());

  // --- Travel -------------------------------------------------------------------
  await expect(page.getByRole("heading", { name: /France.*Austria/ })).toBeVisible();
  await expect(page.getByText("Shortest route: 2 crossings")).toBeVisible();
  const moves = async () => (await page.locator('[data-testid^="move-"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")!.slice(5)))).sort();
  expect(await moves()).toEqual(["CHE", "DEU", "ITA"]);
  await page.getByTestId("move-ITA").click();
  expect(await moves()).toEqual(["AUT", "CHE", "FRA"]);
  const route = page.locator('[data-testid="map-main"] [data-testid="route-line"]');
  await expect(route).toHaveAttribute("data-route", "FRA,ITA");
  // France → the Alpine border → a turning point in Italy (inland, not over the sea) → Rome.
  await expect(route).toHaveAttribute("data-points", "4");
  await shot(page, "travel-italy-en");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(route).toHaveCount(0);
  await page.getByTestId("move-DEU").click();
  expect(await moves()).toEqual(["AUT", "CHE", "FRA"]);
  await expect(page.getByTestId("crossings-left")).toHaveText("1 crossing left");
  await shot(page, "travel-germany-en");
  await page.getByTestId("move-AUT").click();

  // --- Results ------------------------------------------------------------------
  await expect(page.getByRole("heading", { name: "Journey complete!" })).toBeVisible();
  await expect(page.getByTestId("result-route")).toContainText("France");
  await expect(page.getByTestId("result-route")).toContainText("Germany");
  await expect(page.getByTestId("result-route")).toContainText("Austria");
  await expect(page.getByTestId("result-crossings")).toContainText("2 of 2");
  await expect(page.getByTestId("result-help")).toContainText("Undo");
  await expect(page.getByTestId("result-find-answers").locator("li")).toHaveCount(5);
  await expect(route).toHaveAttribute("data-route", "FRA,DEU,AUT");
  await shot(page, "results-en");
  await setLanguage(page, "Հայերեն");
  await expect(page.getByRole("heading", { name: "Ճամփորդությունն ավարտվեց։" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await shot(page, "results-hy");
  await setLanguage(page, "English");

  // Replay journey: only Travel starts again, and the level stays completed.
  await page.getByRole("button", { name: "Replay journey" }).click();
  await expect(page.getByTestId("crossings-left")).toHaveText("2 crossings left");
  await page.getByTestId("home").click();
  await expect(card(page, L2).getByTestId("level-status")).toHaveText("Completed");
  await expect(card(page, L1).getByTestId("level-status")).toHaveText("Completed");
  // Completing Level 2 unlocks Level 3: the main action starts it; Levels 4–5 stay out of reach.
  await expect(card(page, "central-europe").getByTestId("level-status")).toHaveText("Ready to play");
  await expect(mainAction(page)).toHaveText(/^Start\s*Level 3 · Central Europe$/);
  for (const id of ["along-the-adriatic", "towards-greece"]) await expect(card(page, id).getByRole("button")).toHaveCount(0);
  await shot(page, "levels-both-completed-en");
  expect(errors).toEqual([]);
});

test.describe("progress per level", () => {
  test.beforeEach(() => {
    test.skip(test.info().project.name !== "desktop", "Runs once.");
  });

  const inTravel = {
    started: true,
    stage: "travel",
    discover: { selected: "ITA", explored: ["ITA", "CHE"] },
    find: { order: L2_COUNTRIES, index: 4, question: { target: "ITA", wrongGuesses: [], hintLevel: 0, solved: true, feedback: null }, results: answers(L2_COUNTRIES), status: "complete" },
    travel: { missionId: "fra-to-aut", path: ["FRA", "CHE"], hintUsed: true, undoUsed: false },
    records: records(false),
  };
  const level1Replaying = { ...LEVEL1_DONE, stage: "travel", travel: { missionId: "fra-to-nld", path: ["FRA", "LUX"], hintUsed: false, undoUsed: false } };

  test("Home and Continue resume the right level and stage, across refreshes and switching levels", async ({ page }) => {
    await saveV2(page, { [L1]: LEVEL1_DONE, [L2]: inTravel }, { levelId: L1, recent: [L1, L2] });
    // Level 1 is completed, so Continue goes to Level 2, the most recent unfinished one.
    await expect(mainAction(page)).toHaveText(/^Continue\s*Level 2/);
    await expand(page, L1);
    await card(page, L1).getByRole("button", { name: /^Continue/ }).click();
    await expect(page.getByRole("heading", { name: "Journey complete!" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Journey complete!" })).toBeVisible();
    await page.getByTestId("home").click();
    await page.reload();
    await mainAction(page).click();
    await expect(page.getByTestId("crossings-left")).toHaveText("1 crossing left");
    await expect(page.getByText("Help used on this journey")).toBeVisible();
    await expect(page.locator('[data-testid="map-main"] [data-testid="route-line"]')).toHaveAttribute("data-route", "FRA,CHE");
  });

  test("starting one level over asks first and leaves the other level as it was", async ({ page }) => {
    await saveV2(page, { [L1]: level1Replaying, [L2]: inTravel }, { levelId: L2, recent: [L2, L1] });
    const dialog = page.getByTestId("start-over-dialog");
    await card(page, L2).getByRole("button", { name: /^Start over/ }).click();
    await expect(dialog.getByRole("heading", { name: "Start “Around the Alps” over?" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Keep my progress" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(card(page, L2).getByTestId("level-status")).toHaveText("In progress: Travel");
    await card(page, L2).getByRole("button", { name: /^Start over/ }).click();
    await dialog.getByRole("button", { name: "Start over" }).click();
    await expect(page.getByRole("heading", { name: "Tap a country to learn about it." })).toBeAttached();
    await expect(page.getByTestId("discover-progress")).toContainText("0/5");
    await page.getByTestId("home").click();
    // Level 1, completed and being replayed, is untouched: its Play again asks too.
    await expect(card(page, L1).getByTestId("level-status")).toHaveText("Completed");
    await expand(page, L1);
    await card(page, L1).getByRole("button", { name: /^Play again/ }).click();
    await expect(dialog.getByRole("heading", { name: "Play “France and its neighbours” again?" })).toBeVisible();
    await dialog.getByRole("button", { name: "Not now" }).click();
    await card(page, L1).getByRole("button", { name: /^Continue/ }).click();
    await expect(page.locator('[data-testid="map-main"] [data-testid="route-line"]')).toHaveAttribute("data-route", "FRA,LUX");
  });
});

/* Returning players: the levels first, the next one marked, completed ones as one line. */

const L1_IN_FIND = {
  started: true,
  stage: "find",
  discover: { selected: null, explored: L1_ORDER },
  find: { order: L1_ORDER, index: 1, question: { target: "BEL", wrongGuesses: [], hintLevel: 0, solved: false, feedback: null }, results: answers(L1_ORDER.slice(0, 1)), status: "asking" },
  records: records(false),
};
const L2_IN_FIND = {
  ...L1_IN_FIND,
  discover: { selected: null, explored: L2_COUNTRIES },
  find: { order: L2_COUNTRIES, index: 1, question: { target: "CHE", wrongGuesses: [], hintLevel: 0, solved: false, feedback: null }, results: answers(L2_COUNTRIES.slice(0, 1)), status: "asking" },
};
const L2_DONE = {
  ...LEVEL1_DONE,
  find: { order: L2_COUNTRIES, index: 4, question: { target: "ITA", wrongGuesses: [], hintLevel: 0, solved: true, feedback: null }, results: answers(L2_COUNTRIES), status: "complete" },
  travel: { missionId: "fra-to-aut", path: ["FRA", "DEU", "AUT"], hintUsed: false, undoUsed: false },
  lastTravelResult: { missionId: "fra-to-aut", route: ["FRA", "DEU", "AUT"], hintUsed: false, undoUsed: false },
};
const L3_IN_FIND = {
  ...L1_IN_FIND,
  discover: { selected: null, explored: L3_COUNTRIES },
  find: { order: L3_COUNTRIES, index: 1, question: { target: "POL", wrongGuesses: [], hintLevel: 0, solved: false, feedback: null }, results: answers(L3_COUNTRIES.slice(0, 1)), status: "asking" },
};
const L3_DONE = {
  ...LEVEL1_DONE,
  find: { order: L3_COUNTRIES, index: 4, question: { target: "AUT", wrongGuesses: [], hintLevel: 0, solved: true, feedback: null }, results: answers(L3_COUNTRIES), status: "complete" },
  travel: { missionId: "pol-to-aut", path: ["POL", "SVK", "AUT"], hintUsed: false, undoUsed: false },
  lastTravelResult: { missionId: "pol-to-aut", route: ["POL", "SVK", "AUT"], hintUsed: false, undoUsed: false },
};
const RETURNING: { name: string; levels: Record<string, object>; recent: string[]; next: string | null; compact: string[] }[] = [
  { name: "Level 1 in progress", levels: { [L1]: L1_IN_FIND }, recent: [L1], next: L1, compact: [] },
  { name: "Level 1 completed, Level 2 ready", levels: { [L1]: LEVEL1_DONE }, recent: [L1], next: L2, compact: [L1] },
  { name: "Level 2 in progress", levels: { [L1]: LEVEL1_DONE, [L2]: L2_IN_FIND }, recent: [L2, L1], next: L2, compact: [L1] },
  { name: "Levels 1 and 2 completed, Level 3 ready", levels: { [L1]: LEVEL1_DONE, [L2]: L2_DONE }, recent: [L2, L1], next: L3, compact: [L1, L2] },
  { name: "Level 3 in progress", levels: { [L1]: LEVEL1_DONE, [L2]: L2_DONE, [L3]: L3_IN_FIND }, recent: [L3, L2, L1], next: L3, compact: [L1, L2] },
  { name: "all three playable levels completed", levels: { [L1]: LEVEL1_DONE, [L2]: L2_DONE, [L3]: L3_DONE }, recent: [L3, L2, L1], next: null, compact: [L1, L2, L3] },
];
/** The first country each level's card lists. */
const FIRST_COUNTRY: Record<string, [string, string]> = { [L1]: ["France ·", "Ֆրանսիա ·"], [L2]: ["France ·", "Ֆրանսիա ·"], [L3]: ["Germany ·", "Գերմանիա ·"] };

/** The part of a box inside the scrolling area and above the action area: what shows without scrolling. */
async function shownWithoutScrolling(page: Page, locator: ReturnType<Page["locator"]>) {
  const [box, scroll] = [(await locator.boundingBox())!, (await page.getByTestId("welcome-scroll").boundingBox())!];
  return box.y >= scroll.y - 0.5 && box.y + box.height <= scroll.y + scroll.height + 0.5;
}

test.describe("returning players", () => {
  test("a new player still gets the full introduction and artwork", async ({ page }) => {
    test.skip(test.info().project.name !== "small-phone", "Runs once.");
    for (const locale of ["en", "hy"] as const) {
      await saveV2(page, {}, { locale });
      await expect(page.getByTestId("welcome")).toHaveAttribute("data-returning", "false");
      await expect(page.getByTestId("welcome-art")).toBeVisible();
      await expect(page.getByTestId("welcome-hero")).toContainText(locale === "en" ? "Learn where countries are on the map" : "Սովորիր");
      await expect(page.getByTestId("up-next")).toHaveCount(0);
      await expect(page.locator("[data-compact]")).toHaveCount(0);
    }
  });

  for (const s of RETURNING) {
    test(`${s.name}: the levels come first, the next one is marked and in view, completed ones are one line`, async ({ page }) => {
      const sizes = test.info().project.name === "desktop" ? [[1366, 800]] : test.info().project.name === "small-phone" ? [[320, 568], [390, 844]] : [];
      test.skip(sizes.length === 0, "Runs at 320×568 and 390×844 (small-phone), and on desktop.");
      for (const [width, height] of sizes) {
        await page.setViewportSize({ width, height });
        for (const locale of ["en", "hy"] as const) {
          const where = `${width}×${height} ${locale}`;
          await saveV2(page, s.levels, { locale, recent: s.recent, levelId: s.recent[0] });
          await expect(page.getByTestId("welcome")).toHaveAttribute("data-returning", "true");
          // The name, tagline and language switch stay; the introduction gives way to the levels.
          const hero = page.getByTestId("welcome-hero");
          await expect(hero.getByRole("heading", { level: 1 })).toHaveText(locale === "en" ? "AriMap" : "ԱրիՄապ");
          await expect(hero).toContainText(locale === "en" ? "Discover the world." : "Բացահայտիր աշխարհը");
          await expect(hero.getByRole("group")).toBeVisible();
          await expect(page.getByText(locale === "en" ? "Learn where countries are on the map" : "Սովորիր, թե որտեղ")).toHaveCount(0);
          // The artwork is a slim ribbon, left out on short screens.
          if (height <= 700) await expect(page.getByTestId("welcome-art")).toBeHidden();
          else expect((await page.getByTestId("welcome-art").boundingBox())!.height, where).toBeLessThanOrEqual(64);

          // Five levels, in order.
          const cards = page.getByTestId("levels").locator(":scope > li > article");
          expect(await cards.evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")))).toEqual([L1, L2, "central-europe", "along-the-adriatic", "towards-greece"].map((id) => `level-${id}`));

          if (s.next) {
            // The main action names its level, and that level's card says "Up next", once.
            await expect(mainAction(page)).toHaveAttribute("data-level", s.next);
            await expect(page.getByTestId("up-next")).toHaveCount(1);
            const next = card(page, s.next);
            await expect(next).toHaveAttribute("data-up-next", "true");
            await expect(next.getByTestId("up-next")).toHaveText(locale === "en" ? "Up next" : "Հաջորդը");
            // Found at once, without scrolling: its number, name and status (and at 390×844, its own button too).
            // At the top, unless completed levels above it would push its status under the action area:
            // then scrolled just enough (its status right above the action area), never past the card's top.
            const scrollTop = await page.getByTestId("welcome-scroll").evaluate((el) => el.scrollTop);
            // (With one completed level above, English still fits at the top; Armenian, drawn in Noto Sans
            // Armenian and longer, can already need the scroll, checked just below.)
            if (s.compact.length < 2 && locale === "en") expect(scrollTop, where).toBe(0);
            if (scrollTop > 0) {
              const status = (await next.getByTestId("level-status").boundingBox())!;
              const scrollBox = (await page.getByTestId("welcome-scroll").boundingBox())!;
              expect(scrollBox.y + scrollBox.height - (status.y + status.height), `${where}: scrolled further than needed`).toBeLessThanOrEqual(13);
            }
            // At 390×844 in English the card's own button shows too (in Armenian it can be just below; it
            // repeats the main action, which is always on screen).
            for (const part of [next.getByRole("heading"), next.getByTestId("level-status"), ...(height >= 800 && locale === "en" ? [next.getByRole("button").first()] : [])]) {
              expect(await shownWithoutScrolling(page, part), `${where}: ${await part.textContent()} shows without scrolling`).toBe(true);
            }
          } else {
            await expect(page.getByTestId("welcome-actions")).toHaveCount(0);
            await expect(page.getByTestId("all-done")).toHaveText(locale === "en" ? "You've completed every level that's ready. More are coming soon." : "Ավարտել ես բոլոր պատրաստ մակարդակները։ Նորերը շուտով կլինեն։");
          }

          // Completed levels: one line with the status in words, the rest (and replaying) a tap away.
          await expect(page.locator("[data-compact]")).toHaveCount(s.compact.length);
          for (const id of s.compact) {
            const c = card(page, id);
            await expect(c).toHaveAttribute("data-compact", "");
            await expect(c.getByTestId("level-status")).toHaveText(locale === "en" ? "Completed" : "Ավարտված է");
            await expect(c.getByText(locale === "en" ? "Play again" : "Խաղալ նորից")).toBeHidden();
            await expand(page, id);
            await expect(c).toContainText(FIRST_COUNTRY[id][locale === "en" ? 0 : 1]);
            for (const button of [c.getByRole("button", { name: locale === "en" ? /^Continue/ : /^Շարունակել/ }), c.getByRole("button", { name: locale === "en" ? /^Play again/ : /^Խաղալ նորից/ })]) {
              await button.scrollIntoViewIfNeeded();
              const b = (await button.boundingBox())!;
              expect(b.height).toBeGreaterThanOrEqual(44);
              expect(await shownWithoutScrolling(page, button), `${where}: ${id} button under the action area`).toBe(true);
            }
            await c.getByTestId("level-details-toggle").click();
            await expect(c.getByText(locale === "en" ? "Play again" : "Խաղալ նորից")).toBeHidden();
          }
          await expectNoHorizontalOverflow(page);
        }
      }
    });
  }

  test("enlarged text: everything stays readable and reachable above the action area", async ({ page }) => {
    test.skip(test.info().project.name !== "small-phone", "Runs once, on phones.");
    for (const [width, height] of [[320, 568], [390, 844]]) {
      await page.setViewportSize({ width, height });
      for (const s of RETURNING) {
        for (const locale of ["en", "hy"] as const) {
          await saveV2(page, s.levels, { locale, recent: s.recent, levelId: s.recent[0] });
          for (const id of s.compact) await expand(page, id);
          for (const size of [150, 200]) {
            await page.evaluate((z) => (document.documentElement.style.fontSize = `${z}%`), size);
            const where = `${width}×${height} ${s.name} ${locale} ${size}%`;
            await expectNoHorizontalOverflow(page);
            // The action area keeps most of the screen for the levels.
            if (s.next) expect((await page.getByTestId("welcome-actions").boundingBox())!.height, where).toBeLessThanOrEqual(height * 0.4);
            // Every card, and each of its buttons, can be scrolled fully into view above the action area.
            for (const li of await page.getByTestId("levels").locator(":scope > li").all()) {
              for (const button of await li.getByRole("button").all()) {
                await button.scrollIntoViewIfNeeded();
                expect(await shownWithoutScrolling(page, button), `${where}: ${await button.textContent()}`).toBe(true);
                expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
              }
              await li.evaluate((el) => el.scrollIntoView({ block: "end" }));
              const b = (await li.boundingBox())!;
              const scroll = (await page.getByTestId("welcome-scroll").boundingBox())!;
              if (b.height <= scroll.height) expect(await shownWithoutScrolling(page, li), where).toBe(true);
            }
          }
          await page.evaluate(() => (document.documentElement.style.fontSize = ""));
        }
      }
    }
  });

  test("no jump after the page appears: the same layout from the first frame, at the top", async ({ context }) => {
    test.skip(test.info().project.name !== "small-phone", "Runs once.");
    const page = await context.newPage();
    await page.setViewportSize({ width: 320, height: 568 });
    await saveV2(page, RETURNING[1].levels, { recent: RETURNING[1].recent });
    // From the first frame the level selection is on screen: where the "Up next" card is, and the scroll position.
    await page.addInitScript(() => {
      const seen: string[] = [];
      (window as unknown as { welcomeFrames: string[] }).welcomeFrames = seen;
      const record = () => {
        const next = document.querySelector("[data-up-next]");
        const scroll = document.querySelector('[data-testid="welcome-scroll"]');
        if (next && scroll) {
          const r = next.getBoundingClientRect();
          const frame = `${Math.round(r.top)},${Math.round(r.height)},${scroll.scrollTop}`;
          if (seen.at(-1) !== frame) seen.push(frame);
        }
        if (seen.length < 20) requestAnimationFrame(record);
      };
      requestAnimationFrame(record);
    });
    await page.reload();
    await expect(page.getByTestId("up-next")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    // Images (the ribbon's stickers) have their size before they load: nothing moves once they do.
    await page.waitForLoadState("networkidle");
    const frames = await page.evaluate(() => (window as unknown as { welcomeFrames: string[] }).welcomeFrames);
    expect(frames.length, `frames: ${frames}`).toBe(1);
    expect(frames[0].endsWith(",0")).toBe(true);
    await page.close();
  });
});

/* Start, Continue, Home, Start over and Play again: which open at once, which ask first. */
test.describe("confirmations", () => {
  test.beforeEach(() => {
    test.skip(test.info().project.name !== "small-phone", "Runs once, at 320px.");
  });

  /** Waits until the level selection shows and the game has saved the state it loaded (so it can be compared). */
  async function welcomeShown(page: Page) {
    await expect(page.getByTestId("welcome")).toBeVisible();
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  }
  const saved = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("arimap:state")!) as { screen: string; levelId: string; levels: Record<string, { stage: string; started: boolean; records: object }> });
  const dialog = (page: Page) => page.getByTestId("start-over-dialog");

  test("Start and Continue open the level at once, from its card or the main action; Home keeps progress", async ({ page }) => {
    // A new player: the main action starts Level 1, with no question.
    await saveV2(page, {});
    await expect(mainAction(page)).toHaveAttribute("data-kind", "start");
    await mainAction(page).click();
    await expect(page.getByRole("heading", { name: "Tap a country to learn about it." })).toBeAttached();
    await tapCountry(page, "BEL");
    await page.getByTestId("home").click();
    // Home: back to the levels, with the place kept; Continue (the main action) resumes it at once.
    await expect(mainAction(page)).toHaveAttribute("data-kind", "continue");
    expect((await saved(page)).levels[L1].stage).toBe("discover");
    await mainAction(page).click();
    await expect(page.getByTestId("country-card")).toHaveAttribute("data-country", "BEL");
    await page.getByTestId("home").click();
    // The card's own Continue does the same.
    await card(page, L1).getByRole("button", { name: /^Continue/ }).click();
    await expect(page.getByTestId("country-card")).toHaveAttribute("data-country", "BEL");

    // Level 1 completed: Level 2's card Start, and the main action's, open it at once.
    await saveV2(page, { [L1]: LEVEL1_DONE }, { recent: [L1] });
    await card(page, L2).getByRole("button", { name: /^Start/ }).click();
    await expect(page.getByTestId("map-main")).toHaveAttribute("aria-label", "Map of the Alpine countries");
    await page.getByTestId("home").click();
    await expect(mainAction(page)).toHaveText(/^Continue\s*Level 2/);
    await mainAction(page).click();
    await expect(page.getByTestId("map-main")).toHaveAttribute("aria-label", "Map of the Alpine countries");
  });

  test("Start over asks first, naming the level; cancelling changes nothing; confirming resets only that level", async ({ page }) => {
    for (const locale of ["en", "hy"] as const) {
      await saveV2(page, { [L1]: LEVEL1_DONE, [L2]: L2_IN_FIND }, { locale, recent: [L2, L1], levelId: L2 });
      await welcomeShown(page);
      const before = await saved(page);
      const startOver = card(page, L2).getByRole("button", { name: locale === "en" ? /^Start over/ : /^Սկսել նորից/ });
      // Each way of cancelling: the keep button (the focused default), Escape, the backdrop.
      for (const cancel of ["keep", "escape", "backdrop"] as const) {
        await startOver.click();
        await expect(dialog(page).getByRole("heading")).toHaveText(locale === "en" ? "Start “Around the Alps” over?" : "Սկսե՞լ «Ալպերի շուրջը» մակարդակը նորից");
        await expect(dialog(page)).toContainText(locale === "en" ? "your other levels don't change" : "մյուս մակարդակները չեն փոխվի");
        const keep = dialog(page).getByRole("button", { name: locale === "en" ? "Keep my progress" : "Պահել առաջընթացը" });
        await expect(keep).toBeFocused();
        if (cancel === "keep") await keep.click();
        else if (cancel === "escape") await page.keyboard.press("Escape");
        else await page.mouse.click(4, 4);
        await expect(dialog(page)).toBeHidden();
        expect(await saved(page), `${locale} ${cancel}`).toEqual(before);
      }
      await expect(card(page, L2).getByTestId("level-status")).toHaveText(locale === "en" ? "In progress: Find" : "Ընթացքի մեջ է՝ Գտիր");
      // Confirming: Level 2 goes back to Discover, keeping its records; Level 1 is exactly as it was.
      await startOver.click();
      await dialog(page).getByRole("button", { name: locale === "en" ? "Start over" : "Սկսել նորից" }).click();
      await expect(page.getByTestId("discover-progress")).toContainText("0/5");
      const after = await saved(page);
      expect(after.levels[L2].stage).toBe("discover");
      expect(after.levels[L2].records).toEqual(before.levels[L2].records);
      expect(after.levels[L1]).toEqual(before.levels[L1]);
      await page.getByTestId("home").click();
      await expect(card(page, L1).getByTestId("level-status")).toHaveText(locale === "en" ? "Completed" : "Ավարտված է");
    }
  });

  test("Play again asks first when it would clear the level's place; its completion and the unlock stay", async ({ page }) => {
    for (const locale of ["en", "hy"] as const) {
      await saveV2(page, { [L1]: LEVEL1_DONE, [L2]: L2_IN_FIND }, { locale, recent: [L2, L1], levelId: L2 });
      await welcomeShown(page);
      const before = await saved(page);
      await expand(page, L1);
      const playAgain = card(page, L1).getByRole("button", { name: locale === "en" ? /^Play again/ : /^Խաղալ նորից/ });
      await playAgain.click();
      await expect(dialog(page).getByRole("heading")).toHaveText(locale === "en" ? "Play “France and its neighbours” again?" : "Խաղա՞լ «Ֆրանսիան և իր հարևանները» մակարդակը նորից");
      await expect(dialog(page)).toContainText(locale === "en" ? "last results in this level will be cleared" : "վերջին արդյունքները կջնջվեն");
      await dialog(page).getByRole("button", { name: locale === "en" ? "Not now" : "Ոչ հիմա" }).click();
      expect(await saved(page)).toEqual(before);
      await playAgain.click();
      await dialog(page).getByRole("button", { name: locale === "en" ? "Play again" : "Խաղալ նորից" }).click();
      await expect(page.getByTestId("discover-progress")).toContainText("0/5");
      const after = await saved(page);
      expect(after.levels[L1].stage).toBe("discover");
      expect(after.levels[L1].records).toEqual(before.levels[L1].records);
      expect(after.levels[L2]).toEqual(before.levels[L2]);
      await page.getByTestId("home").click();
      // Level 1 is still completed, Level 2 still unlocked and where it was.
      await expect(card(page, L1).getByTestId("level-status")).toHaveText(locale === "en" ? "Completed" : "Ավարտված է");
      await expect(card(page, L2).getByTestId("level-status")).toHaveText(locale === "en" ? "In progress: Find" : "Ընթացքի մեջ է՝ Գտիր");
    }
    // Completed, with no saved place left to lose: Play again starts at once.
    await saveV2(page, { [L1]: { ...LEVEL1_DONE, started: false, stage: "discover" } }, { recent: [L1] });
    await expand(page, L1);
    await card(page, L1).getByRole("button", { name: /^Play again/ }).click();
    await expect(page.getByTestId("discover-progress")).toContainText("0/5");
    expect((await saved(page)).levels[L1].records).toMatchObject({ travelDone: true });
  });
});

/* Level 2's landmark cards, on phones and on desktop, in both languages: every illustration
   whole and in view. Very wide art (Schönbrunn Palace; WIDE_ART_ASPECT in LandmarkCard.tsx)
   gets a shallow tile across the card on phones, under the name and capital; the rest keep
   the square tile beside the name. */
const WIDE = ["AUT"];

/** The artwork as drawn (object-fit: contain), not its box: where it is, its size and proportions. */
async function drawnArt(page: Page) {
  return page.getByTestId("landmark-image").evaluate((img: HTMLImageElement) => {
    const r = img.getBoundingClientRect();
    const s = Math.min(r.width / img.naturalWidth, r.height / img.naturalHeight);
    const [w, h] = [img.naturalWidth * s, img.naturalHeight * s];
    const tile = img.closest("figure")!.querySelector("div")!.getBoundingClientRect();
    return {
      left: r.left + (r.width - w) / 2,
      right: r.left + (r.width + w) / 2,
      top: r.top + (r.height - h) / 2,
      bottom: r.top + (r.height + h) / 2,
      width: w,
      height: h,
      naturalRatio: img.naturalWidth / img.naturalHeight,
      fit: getComputedStyle(img).objectFit,
      tile: { left: tile.left, right: tile.right, top: tile.top, bottom: tile.bottom },
    };
  });
}

test("Level 2's landmark cards: each illustration whole, in view and named; very wide art across the card on phones", async ({ page }) => {
  const project = test.info().project.name;
  test.skip(project === "mobile", "Runs across phone sizes (small-phone) and on desktop.");
  test.setTimeout(240_000);
  const phone = project !== "desktop";
  const sizes = phone ? [[320, 568], [320, 640], [390, 664], [390, 844]] : [[1366, 800]];
  const panel = page.getByTestId("panel");
  const box = async (testId: string) => (await page.getByTestId(testId).boundingBox())!;
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    // The art's width in the square tile beside the name (clamp(112px, 33vw, 132px), 6px padding):
    // what very wide art had before, and still what ordinary art gets.
    const squareArt = Math.min(Math.max(112, 0.33 * width), 132) - 12;
    for (const locale of ["en", "hy"] as const) {
      await saveV2(page, { [L1]: LEVEL1_DONE, [L2]: { started: true, stage: "discover" } }, { locale, screen: "lesson", levelId: L2, recent: [L2, L1] });
      // The countries themselves, not only the map's frame: they are drawn once the map has its size.
      for (const id of L2_COUNTRIES) await expect(page.locator(`[data-testid="map-main"] path[data-country="${id}"]`)).toBeVisible();
      for (const id of ["CHE", "AUT", "ITA", "FRA", "DEU"]) {
        const where = `${width}×${height} ${locale} ${id}`;
        await tapCountry(page, id);
        await expect(page.getByTestId("country-card")).toHaveAttribute("data-country", id);
        const figure = page.getByTestId("landmark-card");
        await expect(figure).toHaveAttribute("data-art", "illustration");
        await expect(figure).toHaveAttribute("data-shape", WIDE.includes(id) ? "wide" : "ordinary");
        const image = page.getByTestId("landmark-image");
        if (ALT_HY[id]) await expect(image).toHaveAttribute("alt", locale === "en" ? `Illustration of ${ALT_EN[id]}` : `Նկարազարդում՝ ${ALT_HY[id]}`);
        await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
        // A new country's card opens at its top (the previous one was left scrolled to its end).
        expect(await panel.evaluate((el) => el.scrollTop), `${where}: card opened scrolled`).toBe(0);

        // Without scrolling: the name, the capital and the whole drawn artwork, above the pinned button.
        const art = await drawnArt(page);
        const panelBox = (await panel.boundingBox())!;
        const fold = (await box("sticky-actions")).y;
        expect(art.fit).toBe("contain");
        // Its own proportions (contain never stretches), inside its tile, the panel and the screen.
        expect(Math.abs(art.width / art.height - art.naturalRatio), `${where}: art stretched`).toBeLessThan(0.02);
        expect(art.left, `${where}: art cut on the left`).toBeGreaterThanOrEqual(Math.max(art.tile.left, panelBox.x, 0) - 0.5);
        expect(art.right, `${where}: art cut on the right`).toBeLessThanOrEqual(Math.min(art.tile.right, panelBox.x + panelBox.width, width) + 0.5);
        expect(art.top, `${where}: art above its tile`).toBeGreaterThanOrEqual(Math.max(art.tile.top, panelBox.y) - 0.5);
        expect(art.bottom, `${where}: art under its tile`).toBeLessThanOrEqual(art.tile.bottom + 0.5);
        expect(art.bottom, `${where}: art under the button`).toBeLessThanOrEqual(fold + 1);
        const head = page.getByTestId("country-card").locator("h2");
        const capital = page.getByTestId("country-capital");
        for (const part of [head, capital]) {
          const b = (await part.boundingBox())!;
          expect(b.y, `${where}: ${await part.textContent()} above the panel`).toBeGreaterThanOrEqual(panelBox.y);
          expect(b.y + b.height, `${where}: ${await part.textContent()} under the button`).toBeLessThanOrEqual(fold + 1);
        }
        const caption = (await figure.locator("figcaption").boundingBox())!;
        const capitalBox = (await capital.boundingBox())!;
        if (phone && WIDE.includes(id)) {
          // Across the card, under the name and capital, before the landmark's name, centred in its tile,
          // and about twice the width it had in the square tile.
          expect(art.tile.top, `${where}: tile beside the name`).toBeGreaterThanOrEqual(capitalBox.y + capitalBox.height - 0.5);
          expect(caption.y, `${where}: text beside the art`).toBeGreaterThanOrEqual(art.tile.bottom - 0.5);
          const card = await box("country-card");
          expect(art.tile.right - art.tile.left, `${where}: tile not across the card`).toBeGreaterThanOrEqual(card.width * 0.8);
          expect(Math.abs((art.left + art.right) / 2 - (art.tile.left + art.tile.right) / 2), `${where}: art off centre`).toBeLessThan(2);
          expect(art.width, `${where}: art ${art.width}px wide, square tile gave ${squareArt}px`).toBeGreaterThanOrEqual(1.9 * squareArt);
        } else {
          // The approved layouts: on phones the square tile beside the name and capital; on desktop,
          // the panel-wide tile above the landmark's name.
          if (phone) {
            expect(art.tile.left, `${where}: tile not beside the name`).toBeGreaterThanOrEqual(capitalBox.x + 0.5);
            expect(Math.round(art.tile.right - art.tile.left), `${where}: square tile`).toBe(Math.round(art.tile.bottom - art.tile.top));
          }
          expect(Math.max(art.width, art.height), `${where}: art too small`).toBeGreaterThanOrEqual(phone ? squareArt - 0.5 : 96);
          const b = await box("landmark-image");
          expect(b.x + b.width <= caption.x + 1 || b.y + b.height <= caption.y + 1, `${where}: art overlaps the text`).toBe(true);
        }
        if (ALT_HY[id]) await page.screenshot({ path: `screenshots/${project}/levels-art-${id}-${locale}-${width}x${height}.png` });

        // Scrolled to its end, the whole card (artwork and text) sits above the pinned button.
        await panel.evaluate((el) => el.scrollTo(0, el.scrollHeight));
        const card = await box("country-card");
        expect(card.y + card.height, `${where}: card bottom`).toBeLessThanOrEqual((await box("sticky-actions")).y + 1);
        await expectNoHorizontalOverflow(page);
        // Left scrolled: the next country's card must still open at its top.
      }
    }
  }

  // Enlarged text (phones): the text keeps its size and the card scrolls fully above the pinned
  // button; nothing is squeezed to fit above the fold.
  if (!phone) return;
  for (const [width, height] of [[320, 568], [390, 844]]) {
    await page.setViewportSize({ width, height });
    for (const locale of ["en", "hy"] as const) {
      await saveV2(page, { [L1]: LEVEL1_DONE, [L2]: { started: true, stage: "discover", discover: { selected: "AUT", explored: ["AUT"] } } }, { locale, screen: "lesson", levelId: L2, recent: [L2, L1] });
      await expect(page.getByTestId("landmark-card")).toHaveAttribute("data-shape", "wide");
      for (const size of [150, 200]) {
        const where = `${width}×${height} ${locale} ${size}%`;
        await page.evaluate((s) => (document.documentElement.style.fontSize = `${s}%`), size);
        const fonts = await page.getByTestId("country-card").evaluate((card) => ({
          title: parseFloat(getComputedStyle(card.querySelector("h2")!).fontSize),
          fact: parseFloat(getComputedStyle(card.querySelector("figcaption span:last-child")!).fontSize),
        }));
        expect(fonts.title, where).toBeGreaterThanOrEqual(((width < 420 ? 1.2 : 1.45) * 16 * size) / 100 - 0.5);
        expect(fonts.fact, where).toBeGreaterThanOrEqual((0.95 * 16 * size) / 100 - 0.5);
        const art = await drawnArt(page);
        expect(Math.abs(art.width / art.height - art.naturalRatio), `${where}: art stretched`).toBeLessThan(0.02);
        expect(art.right - art.left, `${where}: art`).toBeGreaterThan(0);
        await panel.evaluate((el) => el.scrollTo(0, el.scrollHeight));
        const card = await box("country-card");
        expect(card.y + card.height, `${where}: card bottom`).toBeLessThanOrEqual((await box("sticky-actions")).y + 1);
        await expectNoHorizontalOverflow(page);
        await panel.evaluate((el) => el.scrollTo(0, 0));
      }
      await page.evaluate(() => (document.documentElement.style.fontSize = ""));
    }
  }
});
