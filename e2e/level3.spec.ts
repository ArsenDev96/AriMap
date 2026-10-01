import { expect, test, type Page } from "@playwright/test";

/*
 * Level 3 (Central Europe) from Discover to Results, its unlock and place on the
 * level selection, its three new landmark illustrations (whole, named, and never
 * in Find), and its map: framing, reset, and the landscape it loads.
 */

const L1 = "western-europe-1";
const L2 = "around-the-alps";
const L3 = "central-europe";
const L1_ORDER = ["FRA", "BEL", "NLD", "LUX", "DEU"];
const L2_COUNTRIES = ["FRA", "CHE", "DEU", "AUT", "ITA"];
const L3_COUNTRIES = ["DEU", "POL", "CZE", "SVK", "AUT"];
const NAMES: Record<string, string> = { Germany: "DEU", Poland: "POL", Czechia: "CZE", Slovakia: "SVK", Austria: "AUT" };
const NAME_OF = Object.fromEntries(Object.entries(NAMES).map(([name, id]) => [id, name]));
const LANDMARKS: Record<string, string> = { DEU: "Brandenburg Gate", POL: "Wawel Castle", CZE: "Charles Bridge", SVK: "Bratislava Castle", AUT: "Schönbrunn Palace" };
const LANDMARKS_HY: Record<string, string> = { POL: "Վավելի ամրոց", CZE: "Կառլի կամուրջ", SVK: "Բրատիսլավայի ամրոց" };
const CAPITALS: Record<string, string> = { DEU: "Berlin", POL: "Warsaw", CZE: "Prague", SVK: "Bratislava", AUT: "Vienna" };
/** Level 3's new landmarks, with their own illustrations. */
const NEW = ["POL", "CZE", "SVK"];
/** The illustrations' alt text names the landmark in its in-sentence form. */
const ALT: Record<"en" | "hy", Record<string, string>> = {
  en: { POL: "Illustration of Wawel Castle", CZE: "Illustration of the Charles Bridge", SVK: "Illustration of Bratislava Castle" },
  hy: { POL: "Նկարազարդում՝ Վավելի ամրոցը", CZE: "Նկարազարդում՝ Կառլի կամուրջը", SVK: "Նկարազարդում՝ Բրատիսլավայի ամրոցը" },
};

const answers = (order: string[]) => order.map((target) => ({ target, wrongGuesses: 0, hintLevel: 0 }));
const records = (travelDone: boolean) => ({ discoverDone: true, findDone: travelDone, travelDone, lastFindScore: null, bestFindScore: null, travelWithoutHelp: false });
const findDone = (order: string[]) => ({ order, index: 4, question: { target: order[4], wrongGuesses: [], hintLevel: 0, solved: true, feedback: null }, results: answers(order), status: "complete" });
/** A level finished, at its Results. */
const done = (order: string[], missionId: string, route: string[]) => ({
  started: true,
  stage: "results",
  discover: { selected: null, explored: [] },
  find: findDone(order),
  travel: { missionId, path: route, hintUsed: false, undoUsed: false },
  lastTravelResult: { missionId, route, hintUsed: false, undoUsed: false },
  records: { ...records(true), lastFindScore: { independent: 5, total: 5 }, bestFindScore: { independent: 5, total: 5 } },
});
const L1_DONE = done(L1_ORDER, "fra-to-nld", ["FRA", "BEL", "NLD"]);
const L2_DONE = done(L2_COUNTRIES, "fra-to-aut", ["FRA", "DEU", "AUT"]);
const L3_DONE = done(L3_COUNTRIES, "pol-to-aut", ["POL", "CZE", "AUT"]);

const discoverAt = (selected: string | null) => ({ started: true, stage: "discover", discover: { selected, explored: selected ? [selected] : [] }, records: records(false) });
const findAsking = (target: string, hintLevel = 0) => ({
  started: true,
  stage: "find",
  discover: { selected: null, explored: L3_COUNTRIES },
  find: { order: [target, ...L3_COUNTRIES.filter((c) => c !== target)], index: 0, question: { target, wrongGuesses: [], hintLevel, solved: false, feedback: null }, results: [], status: "asking" },
  records: records(false),
});
const travelling = {
  started: true,
  stage: "travel",
  discover: { selected: null, explored: L3_COUNTRIES },
  find: findDone(L3_COUNTRIES),
  travel: { missionId: "pol-to-aut", path: ["POL", "SVK"], hintUsed: false, undoUsed: false },
  records: { ...records(false), findDone: true },
};

/**
 * Waits until the game has mounted: it saves the state it loaded when it mounts,
 * which would otherwise overwrite a save written by the test just before.
 */
async function appReady(page: Page) {
  await expect(page.locator(".splash")).toHaveCount(0);
  await expect(page.locator("main").first()).toBeVisible();
}

async function saveV2(page: Page, levels: Record<string, object>, { locale = "en", screen = "welcome", levelId = L1, recent = [] as string[] } = {}) {
  await page.goto("/");
  await appReady(page);
  await page.evaluate((v) => localStorage.setItem("arimap:state", v), JSON.stringify({ version: 2, locale, screen, levelId, recent, levels }));
  await page.reload();
}

/** Opens Level 3 directly in a given state, Levels 1 and 2 completed. */
async function openLevel3(page: Page, level3: object, locale = "en") {
  await saveV2(page, { [L1]: L1_DONE, [L2]: L2_DONE, [L3]: level3 }, { locale, screen: "lesson", levelId: L3, recent: [L3, L2, L1] });
  for (const id of L3_COUNTRIES) await expect(page.locator(`[data-testid="map-main"] path[data-country="${id}"]`)).toBeVisible();
}

async function shot(page: Page, name: string) {
  const { width, height } = page.viewportSize()!;
  await page.screenshot({ path: `screenshots/${test.info().project.name}/level3-${name}-${width}x${height}.png` });
}

const card = (page: Page, id: string) => page.getByTestId(`level-${id}`);
const mainAction = (page: Page) => page.getByTestId("welcome-actions").getByRole("button");

async function setLanguage(page: Page, lang: "English" | "Հայերեն") {
  await page.getByRole("button", { name: lang, exact: true }).first().click();
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
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

/**
 * Nothing on the map singles out the Find target: no names, markers, badges or
 * callouts, no state colours, no country names in accessible labels, and the
 * target's shape carries exactly the same attributes as every other country's.
 */
async function expectFindSpoilerFree(page: Page, target: string) {
  expect(await page.locator('[data-testid="map-main"] text').allTextContents()).toEqual([]);
  await expect(page.locator("[data-explored-badge], [data-flash], [data-callout], [data-marker-text]")).toHaveCount(0);
  expect(await page.locator('[data-testid="map-main"] path[data-tone]:not([data-tone="default"])').count()).toBe(0);
  await expect(page.getByTestId("landmark-card")).toHaveCount(0);
  // No artwork anywhere in the panel, and not the landmark's name before a hint.
  await expect(page.getByTestId("panel").locator("img")).toHaveCount(0);
  const names = new RegExp([...Object.keys(NAMES), ...Object.values(LANDMARKS), "Լեհաստան", "Չեխիա", "Սլովակիա", "Գերմանիա", "Ավստրիա"].join("|"));
  expect(await page.locator('[data-testid="map-main"] [aria-label], [data-testid="map-main"] title').evaluateAll((els, source) => els.map((e) => e.getAttribute("aria-label") ?? e.textContent ?? "").filter((l) => new RegExp(source).test(l)), names.source)).toEqual([]);
  const styling = await page.locator('[data-testid="map-main"] path[data-country]').evaluateAll((els, ids) => {
    const byCountry: Record<string, string[]> = {};
    for (const e of els) {
      const id = e.getAttribute("data-country")!;
      if (!ids.includes(id)) continue;
      const attrs = [...e.attributes].filter((a) => a.name !== "d" && a.name !== "data-country").map((a) => `${a.name}=${a.value}`);
      (byCountry[id] ??= []).push(attrs.sort().join(" "));
    }
    return Object.fromEntries(Object.entries(byCountry).map(([id, list]) => [id, list.sort().join(" | ")]));
  }, L3_COUNTRIES);
  expect(Object.keys(styling).sort()).toEqual([...L3_COUNTRIES].sort());
  for (const id of L3_COUNTRIES) expect(styling[id], `${id} styled differently from the target ${target}`).toBe(styling[target]);
}

/** A new landmark's card: its own illustration, loaded, named in the card's language; its name and fact. */
async function expectIllustratedLandmark(page: Page, id: string, locale: "en" | "hy") {
  const figure = page.getByTestId("landmark-card");
  await expect(figure).toHaveAttribute("data-art", "illustration");
  await expect(figure).toHaveAttribute("data-landmark", { POL: "wawel-castle", CZE: "charles-bridge", SVK: "bratislava-castle" }[id]!);
  // About 1.5:1, below the 2:1 of very wide art: the square tile beside the name on phones.
  await expect(figure).toHaveAttribute("data-shape", "ordinary");
  const image = page.getByTestId("landmark-image");
  await expect(image).toHaveCount(1);
  await expect(image).toHaveAttribute("alt", ALT[locale][id]);
  await expect(image).toHaveAttribute("src", new RegExp({ POL: "wawel-castle", CZE: "charles-bridge", SVK: "bratislava-castle" }[id]!));
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect(figure).toContainText(locale === "en" ? LANDMARKS[id] : LANDMARKS_HY[id]);
}

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

test("Level 3, Central Europe: Discover, Find, Travel and Results", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" || /hydrat/i.test(m.text())) errors.push(`console ${m.type()}: ${m.text()}`);
  });
  // A save from before Level 3 was playable: Levels 1 and 2 completed, nothing for Level 3.
  await saveV2(page, { [L1]: L1_DONE, [L2]: L2_DONE }, { levelId: L2, recent: [L2, L1] });
  await expect(card(page, L3).getByTestId("level-status")).toHaveText("Ready to play");
  await expect(mainAction(page)).toHaveText(/^Start\s*Level 3 · Central Europe$/);
  await mainAction(page).click();

  // --- Discover -----------------------------------------------------------------
  await expect(page.getByRole("heading", { name: "Tap a country to learn about it." })).toBeAttached();
  await expect(page.getByTestId("map-main")).toHaveAttribute("aria-label", "Map of Central Europe");
  // No close-up in this level: nothing Luxembourg-specific is inherited.
  await expect(page.getByTestId("inset-toggle")).toHaveCount(0);
  await expect(page.getByTestId("map-inset")).toHaveCount(0);
  const labels = await page.locator('[data-testid="map-main"] text').allTextContents();
  expect(labels).toEqual(expect.arrayContaining(Object.keys(NAMES)));
  await expectMapTextClear(page);
  const cardEl = page.getByTestId("country-card");
  for (const id of L3_COUNTRIES) {
    await tapCountry(page, id);
    await expect(cardEl).toHaveAttribute("data-country", id);
    await expect(page.getByTestId("country-capital")).toContainText(CAPITALS[id]);
    await expect(page.getByTestId("landmark-card")).toContainText(LANDMARKS[id]);
    if (NEW.includes(id)) await expectIllustratedLandmark(page, id, "en");
    else {
      // Germany and Austria keep their own illustrations from earlier levels.
      await expect(page.getByTestId("landmark-card")).toHaveAttribute("data-art", "illustration");
      await expect.poll(() => page.getByTestId("landmark-image").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    }
    await expect(page.locator('[data-testid="map-main"] [data-marker-text]').first()).toBeAttached();
    await expectMapTextClear(page);
    // Germany's and Austria's descriptions fit this level's region.
    if (id === "DEU") await expect(cardEl).toContainText("in the west of this region");
    if (id === "AUT") await expect(cardEl).toContainText("in the south of this region");
    if (id === "POL") await expect(cardEl).toContainText("Kraków");
  }
  await expect(page.getByTestId("discover-progress")).toContainText("5/5");
  await setLanguage(page, "Հայերեն");
  await tapCountry(page, "CZE");
  await expect(cardEl.getByRole("heading", { name: "Չեխիա" })).toBeVisible();
  await expect(page.getByTestId("country-capital")).toContainText("Պրահա");
  await expectIllustratedLandmark(page, "CZE", "hy");
  await expectNoHorizontalOverflow(page);
  await expectMapTextClear(page);
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
    await expectFindSpoilerFree(page, target);
    await expect(page.getByTestId("panel")).not.toContainText(LANDMARKS[target]);
    if (q === 0) {
      const wrong = target === "SVK" ? "POL" : "SVK";
      await tapCountry(page, wrong);
      await expect(page.getByTestId("find-feedback")).toContainText("Try again.");
      await page.getByRole("button", { name: "Hint" }).click();
      await expect(page.getByTestId("panel")).toContainText(`Its capital is ${CAPITALS[target]}.`);
      await expect(page.getByTestId("panel")).toContainText(LANDMARKS[target]);
      // The first hint names the capital and landmark only: still no artwork, and nothing on the map
      // points at the target (only the country tapped by mistake is named and coloured).
      await expect(page.getByTestId("panel").locator("img")).toHaveCount(0);
      await expect(page.getByTestId("landmark-card")).toHaveCount(0);
      expect(await page.locator('[data-testid="map-main"] text').allTextContents()).toEqual([NAME_OF[wrong]]);
      await expect(page.locator(`[data-testid="map-main"] path[data-country="${target}"][data-tone]:not([data-tone="default"])`)).toHaveCount(0);
      await expect(page.locator("[data-marker-text]")).toHaveCount(0);
      // Home and a refresh keep the question exactly; Continue resumes it.
      await page.getByTestId("home").click();
      await expect(mainAction(page)).toHaveText(/^Continue\s*Level 3 · Central Europe$/);
      await expect(card(page, L3).getByTestId("level-status")).toHaveText("In progress: Find");
      await page.reload();
      await mainAction(page).click();
      await expect(page.getByTestId("find-prompt")).toHaveText(`Find ${text}`);
      await expect(page.getByText(/Its capital is/)).toBeVisible();
    }
    await tapCountry(page, target);
    await expect(page.getByTestId("find-feedback")).toBeVisible();
    await page.getByRole("button", { name: q < 4 ? "Next" : "Continue to Travel" }).click();
  }
  expect([...asked].sort()).toEqual([...L3_COUNTRIES].sort());

  // --- Travel -------------------------------------------------------------------
  await expect(page.getByRole("heading", { name: /Poland.*Austria/ })).toBeVisible();
  await expect(page.getByText("Shortest route: 2 crossings")).toBeVisible();
  const moves = async () => (await page.locator('[data-testid^="move-"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")!.slice(5)))).sort();
  const route = page.locator('[data-testid="map-main"] [data-testid="route-line"]');
  // Every real neighbour in the level, and no others (no Poland–Austria border).
  expect(await moves()).toEqual(["CZE", "DEU", "SVK"]);
  await page.getByTestId("move-SVK").click();
  expect(await moves()).toEqual(["AUT", "CZE", "POL"]);
  // Warsaw → the Polish–Slovak border → Bratislava.
  await expect(route).toHaveAttribute("data-route", "POL,SVK");
  await expect(route).toHaveAttribute("data-points", "3");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(route).toHaveCount(0);
  await expect(page.getByTestId("crossings-left")).toHaveText("2 crossings left");
  await page.getByTestId("move-DEU").click();
  // Germany has no border with Slovakia.
  expect(await moves()).toEqual(["AUT", "CZE", "POL"]);
  await page.getByRole("button", { name: "Restart" }).click();
  await expect(route).toHaveCount(0);
  expect(await moves()).toEqual(["CZE", "DEU", "SVK"]);
  await expect(page.getByText("Help used on this journey")).toBeVisible();
  await page.getByTestId("move-CZE").click();
  expect(await moves()).toEqual(["AUT", "DEU", "POL", "SVK"]);
  await expect(page.getByTestId("crossings-left")).toHaveText("1 crossing left");
  await page.getByTestId("move-AUT").click();

  // --- Results ------------------------------------------------------------------
  await expect(page.getByRole("heading", { name: "Journey complete!" })).toBeVisible();
  for (const name of ["Poland", "Czechia", "Austria"]) await expect(page.getByTestId("result-route")).toContainText(name);
  await expect(page.getByTestId("result-crossings")).toContainText("2 of 2");
  await expect(page.getByTestId("result-help")).toContainText("Undo");
  await expect(page.getByTestId("badge")).toHaveCount(0);
  await expect(page.getByTestId("result-find-answers").locator("li")).toHaveCount(5);
  await expect(page.getByTestId("result-find")).toContainText("4/5");
  await expect(route).toHaveAttribute("data-route", "POL,CZE,AUT");
  await setLanguage(page, "Հայերեն");
  await expect(page.getByRole("heading", { name: "Ճամփորդությունն ավարտվեց։" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await setLanguage(page, "English");

  // Replay journey: the other shortest route, through Slovakia, without help this time.
  await page.getByRole("button", { name: "Replay journey" }).click();
  await expect(page.getByTestId("crossings-left")).toHaveText("2 crossings left");
  await page.getByTestId("move-SVK").click();
  await page.getByTestId("move-AUT").click();
  await expect(page.getByRole("heading", { name: "Journey complete!" })).toBeVisible();
  await expect(route).toHaveAttribute("data-route", "POL,SVK,AUT");
  await expect(page.getByTestId("result-help")).toHaveText(/Help used\s*None/);
  await expect(page.getByTestId("badge")).toBeVisible();

  // The level selection: Level 3 completed, Levels 4–5 still coming soon, with no way in.
  await page.getByTestId("home").click();
  for (const id of [L1, L2, L3]) await expect(card(page, id).getByTestId("level-status")).toHaveText("Completed");
  for (const id of ["along-the-adriatic", "towards-greece"]) {
    await expect(card(page, id).getByTestId("level-status")).toHaveText(/^Coming soon/);
    await expect(card(page, id).getByRole("button")).toHaveCount(0);
  }
  await expect(page.getByTestId("welcome-actions")).toHaveCount(0);
  await expect(page.getByTestId("all-done")).toBeVisible();
  // Across a refresh too.
  await page.reload();
  await expect(card(page, L3).getByTestId("level-status")).toHaveText("Completed");
  await expect(page.getByTestId("welcome-actions")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Level 3 travel: the Germany route is a shortest route too, drawn through Germany's turning point", async ({ page }) => {
  test.skip(test.info().project.name !== "desktop", "Runs once.");
  await openLevel3(page, { ...travelling, travel: { missionId: "pol-to-aut", path: ["POL"], hintUsed: false, undoUsed: false } });
  const route = page.locator('[data-testid="map-main"] [data-testid="route-line"]');
  await page.getByRole("button", { name: "Hint" }).click();
  await page.getByTestId("move-DEU").click();
  await expect(route).toHaveAttribute("data-route", "POL,DEU");
  await page.getByTestId("move-AUT").click();
  await expect(page.getByRole("heading", { name: "Journey complete!" })).toBeVisible();
  // Germany → Austria keeps Level 2's line: west of Czechia and south of the Berchtesgaden salient.
  await expect(route).toHaveAttribute("data-route", "POL,DEU,AUT");
  await expect(route).toHaveAttribute("data-points", "7");
  await expect(page.getByTestId("result-crossings")).toContainText("2 of 2");
  await expect(page.getByTestId("result-help")).toContainText("Hint");
});

/* Screenshots and layout at 320×568, 390×844 (phones) and 1366×800 (desktop), in both languages. */
test("Level 3 at phone and desktop sizes: the level selection, the three new cards, Find, Travel and Results", async ({ page }) => {
  const project = test.info().project.name;
  test.skip(project === "mobile", "Runs at 320×568 and 390×844 (small-phone), and on desktop.");
  test.setTimeout(300_000);
  const phone = project !== "desktop";
  const sizes = phone ? [[320, 568], [390, 844]] : [[1366, 800]];
  const panel = page.getByTestId("panel");
  const box = async (testId: string) => (await page.getByTestId(testId).boundingBox())!;
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    for (const locale of ["en", "hy"] as const) {
      const where = (what: string) => `${width}×${height} ${locale} ${what}`;

      // The level selection with Level 3 unlocked: up next, its card and the main action name it.
      await saveV2(page, { [L1]: L1_DONE, [L2]: L2_DONE }, { locale, recent: [L2, L1], levelId: L2 });
      await expect(card(page, L3).getByTestId("level-status")).toHaveText(locale === "en" ? "Ready to play" : "Պատրաստ է խաղալու");
      await expect(card(page, L3)).toHaveAttribute("data-up-next", "true");
      await expect(mainAction(page)).toHaveAttribute("data-level", L3);
      await expect(card(page, L3)).toContainText(locale === "en" ? "Germany · Poland · Czechia · Slovakia · Austria" : "Գերմանիա · Լեհաստան · Չեխիա · Սլովակիա · Ավստրիա");
      for (const id of ["along-the-adriatic", "towards-greece"]) await expect(card(page, id).getByRole("button")).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
      await shot(page, `${locale}-levels-unlocked`);
      // Completed: Level 3 is one line like the others, and Levels 4–5 remain unavailable.
      await saveV2(page, { [L1]: L1_DONE, [L2]: L2_DONE, [L3]: L3_DONE }, { locale, recent: [L3, L2, L1], levelId: L3 });
      await expect(card(page, L3).getByTestId("level-status")).toHaveText(locale === "en" ? "Completed" : "Ավարտված է");
      await expect(page.getByTestId("all-done")).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await shot(page, `${locale}-levels-completed`);

      // Discover: the three new countries' cards, with their illustrations.
      for (const id of NEW) {
        await openLevel3(page, discoverAt(id), locale);
        await expect(page.getByTestId("country-card")).toHaveAttribute("data-country", id);
        await expectIllustratedLandmark(page, id, locale);
        // Without scrolling: the name and the capital, above the pinned button.
        const fold = (await box("sticky-actions")).y;
        for (const part of [page.getByTestId("country-card").locator("h2"), page.getByTestId("country-capital")]) {
          const b = (await part.boundingBox())!;
          expect(b.y + b.height, where(`${id} ${await part.textContent()} under the button`)).toBeLessThanOrEqual(fold + 1);
        }
        await expectMapTextClear(page);
        await expectNoHorizontalOverflow(page);
        await shot(page, `${locale}-discover-${id}`);
        // Scrolled to its end, the whole card sits above the pinned button.
        await panel.evaluate((el) => el.scrollTo(0, el.scrollHeight));
        const c = await box("country-card");
        expect(c.y + c.height, where(`${id} card bottom`)).toBeLessThanOrEqual((await box("sticky-actions")).y + 1);
      }

      // Find: an unanswered question, then its first hint.
      await openLevel3(page, findAsking("SVK"), locale);
      await expectFindSpoilerFree(page, "SVK");
      await expectNoHorizontalOverflow(page);
      await shot(page, `${locale}-find`);
      await openLevel3(page, findAsking("SVK", 1), locale);
      await expect(panel).toContainText(locale === "en" ? "Bratislava Castle" : "Բրատիսլավայի ամրոցը");
      await expectFindSpoilerFree(page, "SVK");
      await shot(page, `${locale}-find-hint`);

      // Travel: Poland → Slovakia, one crossing left.
      await openLevel3(page, travelling, locale);
      await expect(page.getByTestId("crossings-left")).toHaveText(locale === "en" ? "1 crossing left" : "Մնաց 1 սահմանահատում");
      await expect(page.locator('[data-testid="map-main"] [data-testid="route-line"]')).toHaveAttribute("data-route", "POL,SVK");
      await expectMapTextClear(page);
      await expectNoHorizontalOverflow(page);
      await shot(page, `${locale}-travel`);

      // Results.
      await openLevel3(page, L3_DONE, locale);
      await expect(page.getByTestId("result-crossings")).toContainText("2");
      await expectNoHorizontalOverflow(page);
      await shot(page, `${locale}-results`);
    }
  }

  // Enlarged text (phones): the new cards keep their text size and scroll fully above the pinned button.
  if (!phone) return;
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    for (const locale of ["en", "hy"] as const) {
      for (const id of NEW) {
        await openLevel3(page, discoverAt(id), locale);
        for (const size of [150, 200]) {
          const where = `${width}×${height} ${locale} ${id} ${size}%`;
          await page.evaluate((s) => (document.documentElement.style.fontSize = `${s}%`), size);
          const fonts = await page.getByTestId("country-card").evaluate((c) => ({
            title: parseFloat(getComputedStyle(c.querySelector("h2")!).fontSize),
            fact: parseFloat(getComputedStyle(c.querySelector("figcaption span:last-child")!).fontSize),
          }));
          expect(fonts.title, where).toBeGreaterThanOrEqual(((width < 420 ? 1.2 : 1.45) * 16 * size) / 100 - 0.5);
          expect(fonts.fact, where).toBeGreaterThanOrEqual((0.95 * 16 * size) / 100 - 0.5);
          await expectIllustratedLandmark(page, id, locale);
          const art = await drawnArt(page);
          expect(Math.abs(art.width / art.height - art.naturalRatio), `${where}: art stretched`).toBeLessThan(0.02);
          await panel.evaluate((el) => el.scrollTo(0, el.scrollHeight));
          const c = await box("country-card");
          expect(c.y + c.height, `${where}: card bottom`).toBeLessThanOrEqual((await box("sticky-actions")).y + 1);
          await expectNoHorizontalOverflow(page);
          if (size === 200 || id === "SVK") await shot(page, `${locale}-discover-${id}-text${size}`);
          await panel.evaluate((el) => el.scrollTo(0, 0));
        }
        await page.evaluate(() => (document.documentElement.style.fontSize = ""));
      }
    }
  }
});

/* The three new illustrations at the four established phone sizes (and on desktop), in both languages:
   the country's name, its capital and the whole artwork together above the pinned button, uncropped
   and undistorted, and no artwork in Find. */
test("Level 3's landmark illustrations: whole, undistorted, named, with the name and capital above the pinned button", async ({ page }) => {
  const project = test.info().project.name;
  test.skip(project === "mobile", "Runs across phone sizes (small-phone) and on desktop.");
  test.setTimeout(240_000);
  const phone = project !== "desktop";
  const sizes = phone ? [[320, 568], [320, 640], [390, 664], [390, 844]] : [[1366, 800]];
  const panel = page.getByTestId("panel");
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    const squareArt = Math.min(Math.max(112, 0.33 * width), 132) - 12;
    for (const locale of ["en", "hy"] as const) {
      for (const id of NEW) {
        const where = `${width}×${height} ${locale} ${id}`;
        await openLevel3(page, discoverAt(id), locale);
        await expectIllustratedLandmark(page, id, locale);
        expect(await panel.evaluate((el) => el.scrollTop), `${where}: card opened scrolled`).toBe(0);
        const art = await drawnArt(page);
        const panelBox = (await panel.boundingBox())!;
        const fold = (await page.getByTestId("sticky-actions").boundingBox())!.y;
        expect(art.fit).toBe("contain");
        expect(Math.abs(art.width / art.height - art.naturalRatio), `${where}: art stretched`).toBeLessThan(0.02);
        expect(art.left, `${where}: art cut on the left`).toBeGreaterThanOrEqual(Math.max(art.tile.left, panelBox.x, 0) - 0.5);
        expect(art.right, `${where}: art cut on the right`).toBeLessThanOrEqual(Math.min(art.tile.right, panelBox.x + panelBox.width, width) + 0.5);
        expect(art.top, `${where}: art above its tile`).toBeGreaterThanOrEqual(Math.max(art.tile.top, panelBox.y) - 0.5);
        expect(art.bottom, `${where}: art under its tile`).toBeLessThanOrEqual(art.tile.bottom + 0.5);
        expect(art.bottom, `${where}: art under the button`).toBeLessThanOrEqual(fold + 1);
        expect(Math.max(art.width, art.height), `${where}: art too small`).toBeGreaterThanOrEqual(phone ? squareArt - 0.5 : 96);
        for (const part of [page.getByTestId("country-card").locator("h2"), page.getByTestId("country-capital")]) {
          const b = (await part.boundingBox())!;
          expect(b.y, `${where}: ${await part.textContent()} above the panel`).toBeGreaterThanOrEqual(panelBox.y);
          expect(b.y + b.height, `${where}: ${await part.textContent()} under the button`).toBeLessThanOrEqual(fold + 1);
        }
        // On phones the square tile beside the name and capital.
        if (phone) {
          const capital = (await page.getByTestId("country-capital").boundingBox())!;
          expect(art.tile.left, `${where}: tile not beside the name`).toBeGreaterThanOrEqual(capital.x + 0.5);
          expect(Math.round(art.tile.right - art.tile.left), `${where}: square tile`).toBe(Math.round(art.tile.bottom - art.tile.top));
        }
        await page.screenshot({ path: `screenshots/${project}/level3-art-${id}-${locale}-${width}x${height}.png` });
      }
    }
    // Find never shows artwork, even with the landmark named in its hint.
    await openLevel3(page, findAsking("POL", 1), "en");
    await expect(panel).toContainText("Wawel Castle");
    await expect(panel.locator("img")).toHaveCount(0);
    await expect(page.getByTestId("landmark-card")).toHaveCount(0);
  }
});

/* The whole map: every country whole with padding, and never beyond the prepared data. */
test("Level 3's map: the start view and reset show all five countries; no size shows past the data", async ({ page }) => {
  test.skip(test.info().project.name !== "desktop", "Runs once, across sizes.");
  test.setTimeout(240_000);
  const mapState = () =>
    page.evaluate((ids) => {
      const svg = document.querySelector('[data-testid="map-main"]')!.getBoundingClientRect();
      const countries = ids.map((id) => {
        const r = document.querySelector(`[data-testid="map-main"] path[data-country="${id}"]`)!.getBoundingClientRect();
        return { id, left: r.left - svg.left, top: r.top - svg.top, right: svg.right - r.right, bottom: svg.bottom - r.bottom };
      });
      const overview = document.querySelector('[data-testid="map-main"] [data-family="land"] image[data-level="overview"]')!.getBoundingClientRect();
      const transform = document.querySelector('[data-testid="map-main"] [data-relief]')!.parentElement!.getAttribute("transform");
      return {
        map: { width: svg.width, height: svg.height },
        countries,
        // The painted overview spans the level's coverage, which lies inside the prepared data.
        overviewCovers: overview.left <= svg.left + 0.5 && overview.top <= svg.top + 0.5 && overview.right >= svg.right - 0.5 && overview.bottom >= svg.bottom - 0.5,
        transform,
      };
    }, L3_COUNTRIES);
  // Phones (portrait, and a short landscape one), desktops, and wide screens.
  const sizes = [[320, 568], [390, 844], [412, 915], [1366, 800], [1920, 1080], [2560, 1080], [740, 360], [844, 390]];
  const report: string[] = [];
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await openLevel3(page, discoverAt(null));
    await page.waitForTimeout(300);
    const start = await mapState();
    const where = `${width}×${height} (map ${Math.round(start.map.width)}×${Math.round(start.map.height)})`;
    expect(start.overviewCovers, `${where}: the view shows past the painted coverage`).toBe(true);
    const margin = Math.min(...start.countries.flatMap((c) => [c.left, c.top, c.right, c.bottom]));
    report.push(`${where}: smallest margin ${margin.toFixed(1)}px`);
    const aspect = start.map.width / start.map.height;
    // Whole, with padding, on every map from 1:1.8 to 2.2:1 (see docs/DATA.md); beyond, the view zooms in slightly instead.
    if (aspect >= 1 / 1.8 && aspect <= 2.2) expect(margin, `${where}: a country touches or crosses the edge`).toBeGreaterThanOrEqual(4);
    await page.screenshot({ path: `screenshots/desktop/level3-map-${width}x${height}.png` });
    // Zoomed in and moved, "Show the whole map" returns to the same view.
    await page.getByRole("button", { name: "Zoom in" }).click();
    await page.getByRole("button", { name: "Zoom in" }).click();
    await page.waitForTimeout(500);
    expect((await mapState()).transform).not.toBe(start.transform);
    await page.getByRole("button", { name: "Show the whole map" }).click();
    await expect.poll(async () => (await mapState()).transform, { timeout: 5000 }).toBe(start.transform);
    expect((await mapState()).overviewCovers).toBe(true);
  }
  test.info().annotations.push({ type: "margins", description: report.join("; ") });
  console.log(report.join("\n"));
});

/* The landscape: only Level 3's own overview, its overlay once a country has a state colour, and tiles only when zoomed. */
test("Level 3 loads its own landscape overview, and zoomed tiles only for the view", async ({ page }) => {
  test.skip(test.info().project.name !== "mobile", "Runs once.");
  await saveV2(page, { [L1]: L1_DONE, [L2]: L2_DONE, [L3]: discoverAt(null) }, { levelId: L2, recent: [L2, L1] });
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await card(page, L3).getByRole("button", { name: /^Continue/ }).click();
  const main = page.getByTestId("map-main");
  await expect(main.locator('[data-family="land"] image[data-level="overview"]')).toHaveCount(1);
  await expect.poll(() => requests.some((u) => /central-europe-land/.test(u))).toBe(true);
  await page.waitForTimeout(500);
  expect(requests.filter((u) => /western-europe-1-(land|tone)|around-the-alps-(land|tone)/.test(u)), "another level's overview").toEqual([]);
  expect(requests.filter((u) => /central-europe-tone/.test(u)), "the overlay before any state colour").toEqual([]);
  expect(requests.filter((u) => u.includes("/relief/")), "zoomed tiles at the whole-map view").toEqual([]);
  // A selection gives Poland a state colour: its overlay is loaded.
  await tapCountry(page, "POL");
  await expect(main.locator('[data-family="tone"] image[data-level="overview"]')).toHaveCount(1);
  await expect.poll(() => requests.some((u) => /central-europe-tone/.test(u))).toBe(true);
  // Zoomed in on the Tatras, sharper tiles for the visible part only.
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "Zoom in" }).click();
    await page.waitForTimeout(600);
  }
  await expect.poll(() => main.locator("[data-relief] image[data-loaded]").count()).toBeGreaterThan(0);
  expect(requests.filter((u) => u.includes("/relief/")).length).toBeGreaterThan(0);
  const outside = await page.evaluate(() => {
    const svg = document.querySelector('[data-testid="map-main"]')!.getBoundingClientRect();
    const [mx, my] = [svg.width / 4, svg.height / 4];
    return [...document.querySelectorAll('[data-testid="map-main"] [data-relief] image:not([data-level="overview"])')].filter((img) => {
      const r = img.getBoundingClientRect();
      return r.right < svg.left - mx || r.left > svg.right + mx || r.bottom < svg.top - my || r.top > svg.bottom + my;
    }).length;
  });
  expect(outside, "tiles far outside the view").toBe(0);
});
