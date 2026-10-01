import { expect, test, type Locator, type Page } from "@playwright/test";

/*
 * Level 4 (Along the Adriatic) from Discover to Results, its unlock from Level 3,
 * its four new countries' landmark cards (text only until their artwork is
 * supplied; Italy keeps the Colosseum), long names (Bosnia and Herzegovina) in
 * every screen, the Italy → Montenegro journey over the Pelješac Bridge, and its
 * map: framing, reset, and the landscape it loads.
 */

const L1 = "western-europe-1";
const L2 = "around-the-alps";
const L3 = "central-europe";
const L4 = "along-the-adriatic";
const L1_ORDER = ["FRA", "BEL", "NLD", "LUX", "DEU"];
const L2_COUNTRIES = ["FRA", "CHE", "DEU", "AUT", "ITA"];
const L3_COUNTRIES = ["DEU", "POL", "CZE", "SVK", "AUT"];
const L4_COUNTRIES = ["ITA", "SVN", "HRV", "BIH", "MNE"];
const NAMES: Record<string, string> = { Italy: "ITA", Slovenia: "SVN", Croatia: "HRV", "Bosnia and Herzegovina": "BIH", Montenegro: "MNE" };
const NAMES_HY: Record<string, string> = { ITA: "Իտալիա", SVN: "Սլովենիա", HRV: "Խորվաթիա", BIH: "Բոսնիա և Հերցեգովինա", MNE: "Չեռնոգորիա" };
const NAME_OF = Object.fromEntries(Object.entries(NAMES).map(([name, id]) => [id, name]));
const LANDMARKS: Record<string, string> = { ITA: "Colosseum", SVN: "Bled Castle", HRV: "City Walls of Dubrovnik", BIH: "Stari Most", MNE: "Ostrog Monastery" };
const LANDMARKS_HY: Record<string, string> = { ITA: "Կոլիզեում", SVN: "Բլեդի ամրոց", HRV: "Դուբրովնիկի պարիսպներ", BIH: "Մոստարի կամուրջ", MNE: "Օստրոգի վանք" };
/** Landmarks named in a sentence (Find's hint). */
const LANDMARKS_IN_TEXT: Record<string, string> = { ITA: "the Colosseum", SVN: "Bled Castle", HRV: "the city walls of Dubrovnik", BIH: "Stari Most", MNE: "Ostrog Monastery" };
const CAPITALS: Record<string, string> = { ITA: "Rome", SVN: "Ljubljana", HRV: "Zagreb", BIH: "Sarajevo", MNE: "Podgorica" };
const CAPITALS_HY: Record<string, string> = { ITA: "Հռոմ", SVN: "Լյուբլյանա", HRV: "Զագրեբ", BIH: "Սարաևո", MNE: "Պոդգորիցա" };
/** Level 4's new countries: their landmarks have no artwork yet, so their cards are text only. */
const NEW = ["SVN", "HRV", "BIH", "MNE"];

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
const L4_DONE = done(L4_COUNTRIES, "ita-to-mne", ["ITA", "SVN", "HRV", "MNE"]);
const EARLIER = { [L1]: L1_DONE, [L2]: L2_DONE, [L3]: L3_DONE };

const discoverAt = (selected: string | null) => ({ started: true, stage: "discover", discover: { selected, explored: selected ? [selected] : [] }, records: records(false) });
const findAsking = (target: string, hintLevel = 0) => ({
  started: true,
  stage: "find",
  discover: { selected: null, explored: L4_COUNTRIES },
  find: { order: [target, ...L4_COUNTRIES.filter((c) => c !== target)], index: 0, question: { target, wrongGuesses: [], hintLevel, solved: false, feedback: null }, results: [], status: "asking" },
  records: records(false),
});
const travellingAt = (path: string[]) => ({
  started: true,
  stage: "travel",
  discover: { selected: null, explored: L4_COUNTRIES },
  find: findDone(L4_COUNTRIES),
  travel: { missionId: "ita-to-mne", path, hintUsed: false, undoUsed: false },
  records: { ...records(false), findDone: true },
});

/**
 * Waits until the game has mounted: it saves the state it loaded when it mounts,
 * which would otherwise overwrite a save written by the test just before.
 */
async function appReady(page: Page) {
  await expect(page.locator(".splash")).toHaveCount(0);
  await expect(page.locator("main").first()).toBeVisible();
}

/** Waits for the fonts the page's language uses, then for the layout to settle. */
async function fontsSettled(page: Page) {
  await page.evaluate(async () => {
    const loads = [document.fonts.load('900 16px "Nunito"', "Aa")];
    if (document.documentElement.lang === "hy") loads.push(document.fonts.load('900 16px "Noto Sans Armenian"', "Աա"));
    await Promise.all(loads).catch(() => undefined);
    await document.fonts.ready;
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
}

async function saveV2(page: Page, levels: Record<string, object>, { locale = "en", screen = "welcome", levelId = L1, recent = [] as string[] } = {}) {
  await page.goto("/");
  await appReady(page);
  await page.evaluate((v) => localStorage.setItem("arimap:state", v), JSON.stringify({ version: 2, locale, screen, levelId, recent, levels }));
  await page.reload();
  await appReady(page);
  await fontsSettled(page);
}

/** Opens Level 4 directly in a given state, Levels 1–3 completed. */
async function openLevel4(page: Page, level4: object, locale = "en") {
  await saveV2(page, { ...EARLIER, [L4]: level4 }, { locale, screen: "lesson", levelId: L4, recent: [L4, L3, L2, L1] });
  for (const id of L4_COUNTRIES) await expect(page.locator(`[data-testid="map-main"] path[data-country="${id}"]`)).toBeVisible();
}

async function shot(page: Page, name: string) {
  const { width, height } = page.viewportSize()!;
  await page.screenshot({ path: `screenshots/${test.info().project.name}/level4-${name}-${width}x${height}.png` });
}

const card = (page: Page, id: string) => page.getByTestId(`level-${id}`);
const mainAction = (page: Page) => page.getByTestId("welcome-actions").getByRole("button");

async function setLanguage(page: Page, lang: "English" | "Հայերեն") {
  await page.getByRole("button", { name: lang, exact: true }).first().click();
  await fontsSettled(page);
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
}

/**
 * No word of the element's text is broken across lines unless it is wider than the
 * element's whole box (the emergency break for very large text), and the text stays
 * inside the element.
 */
async function expectWordsWhole(locator: Locator, where: string) {
  const words = await locator.evaluate((el) => {
    const range = document.createRange();
    const out: { text: string; lines: number; natural: number; box: number }[] = [];
    const box = el.getBoundingClientRect().width;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const style = getComputedStyle(node.parentElement!);
      for (const m of (node.textContent ?? "").matchAll(/\S+/g)) {
        range.setStart(node, m.index!);
        range.setEnd(node, m.index! + m[0].length);
        const lines = new Set([...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top))).size;
        const probe = document.createElement("span");
        probe.textContent = m[0];
        Object.assign(probe.style, { position: "absolute", visibility: "hidden", whiteSpace: "nowrap", font: style.font, letterSpacing: style.letterSpacing, textTransform: style.textTransform });
        document.body.appendChild(probe);
        out.push({ text: m[0], lines, natural: probe.getBoundingClientRect().width, box });
        probe.remove();
      }
    }
    return out;
  });
  for (const w of words) if (w.lines > 1) expect(w.natural, `${where}: «${w.text}» broken though it fits ${w.box.toFixed(0)}px`).toBeGreaterThan(w.box + 0.5);
  expect(await locator.evaluate((el) => el.scrollWidth - el.clientWidth), `${where}: text overflows`).toBeLessThanOrEqual(1);
}

/** An on-screen point that hits the country's own path (not a neighbour, label or control). */
async function tapCountry(page: Page, id: string) {
  const point = await page.evaluate((id) => {
    const path = document.querySelector(`[data-testid="map-main"] path[data-country="${id}"]`)!;
    const r = path.getBoundingClientRect();
    const hits: [number, number][] = [];
    for (let i = 1; i < 32; i++)
      for (let j = 1; j < 32; j++) {
        const [x, y] = [r.left + (r.width * i) / 32, r.top + (r.height * j) / 32];
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
  await expect(page.getByTestId("panel").locator("img")).toHaveCount(0);
  const names = new RegExp([...Object.keys(NAMES), ...Object.values(NAMES_HY), ...Object.values(LANDMARKS), "Bosnia", "Herzegovina"].join("|"));
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
  }, L4_COUNTRIES);
  expect(Object.keys(styling).sort()).toEqual([...L4_COUNTRIES].sort());
  for (const id of L4_COUNTRIES) expect(styling[id], `${id} styled differently from the target ${target}`).toBe(styling[target]);
}

/**
 * A new country's landmark card: text only (its artwork is not supplied yet), so no
 * image, empty frame or stand-in from another country; its name and fact in the card's language.
 */
async function expectTextOnlyLandmark(page: Page, id: string, locale: "en" | "hy") {
  const figure = page.getByTestId("landmark-card");
  await expect(figure).toHaveAttribute("data-art", "none");
  await expect(figure.locator("img")).toHaveCount(0);
  await expect(page.getByTestId("landmark-image")).toHaveCount(0);
  await expect(figure).not.toHaveAttribute("data-shape", /./);
  await expect(figure).toContainText(locale === "en" ? LANDMARKS[id] : LANDMARKS_HY[id]);
  // Its fact, a sentence, follows the name.
  expect(((await figure.locator("figcaption span").last().textContent()) ?? "").length).toBeGreaterThan(30);
}

test("Level 4, Along the Adriatic: Discover, Find, Travel and Results", async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" || /hydrat/i.test(m.text())) errors.push(`console ${m.type()}: ${m.text()}`);
  });
  // A save from before Level 4 was playable: Levels 1–3 completed, nothing for Level 4.
  await saveV2(page, EARLIER, { levelId: L3, recent: [L3, L2, L1] });
  await expect(card(page, L4).getByTestId("level-status")).toHaveText("Ready to play");
  await expect(card(page, L4)).toContainText("Italy · Slovenia · Croatia · Bosnia and Herzegovina · Montenegro");
  await expect(card(page, "towards-greece").getByTestId("level-status")).toHaveText(/^Coming soon/);
  await expect(mainAction(page)).toHaveText(/^Start\s*Level 4 · Along the Adriatic$/);
  await mainAction(page).click();

  // --- Discover -----------------------------------------------------------------
  await expect(page.getByRole("heading", { name: "Tap a country to learn about it." })).toBeAttached();
  await expect(page.getByTestId("map-main")).toHaveAttribute("aria-label", "Map of the Adriatic countries");
  // No close-up in this level: nothing Luxembourg-specific is inherited.
  await expect(page.getByTestId("inset-toggle")).toHaveCount(0);
  await expect(page.getByTestId("map-inset")).toHaveCount(0);
  for (const id of L4_COUNTRIES) await expect(page.locator(`[data-testid="map-main"] path[data-country="${id}"]`)).toBeVisible();
  await expectMapTextClear(page);
  const cardEl = page.getByTestId("country-card");
  for (const id of L4_COUNTRIES) {
    await tapCountry(page, id);
    await expect(cardEl).toHaveAttribute("data-country", id);
    await expect(cardEl.getByRole("heading", { level: 2 })).toHaveText(NAME_OF[id]);
    await expect(page.getByTestId("country-capital")).toContainText(CAPITALS[id]);
    await expect(page.getByTestId("landmark-card")).toContainText(LANDMARKS[id]);
    if (NEW.includes(id)) await expectTextOnlyLandmark(page, id, "en");
    else {
      // Italy keeps the Colosseum's illustration.
      await expect(page.getByTestId("landmark-card")).toHaveAttribute("data-art", "illustration");
      await expect(page.getByTestId("landmark-image")).toHaveAttribute("src", /colosseum/);
    }
    // Capital and landmark names beside their markers, clear of each other. On a 320px phone the
    // Balkans are small: a capital's name may be left out rather than printed over another name
    // (docs/DATA.md, "Rendering"); the card names it.
    if (page.viewportSize()!.width > 320) await expect(page.locator('[data-testid="map-main"] [data-marker-text]').first()).toBeAttached();
    await expectMapTextClear(page);
    await expectWordsWhole(cardEl.getByRole("heading", { level: 2 }), `${id} card title`);
  }
  // This level's own descriptions: Italy on the Adriatic; Croatia's long coast; Bosnia and Herzegovina's short one.
  await tapCountry(page, "ITA");
  await expect(cardEl).toContainText("west side of the Adriatic Sea");
  await tapCountry(page, "BIH");
  await expect(cardEl).toContainText("Neum");
  await expect(page.getByTestId("discover-progress")).toContainText("5/5");
  await setLanguage(page, "Հայերեն");
  await tapCountry(page, "HRV");
  await expect(cardEl.getByRole("heading", { name: "Խորվաթիա" })).toBeVisible();
  await expect(page.getByTestId("country-capital")).toContainText("Զագրեբ");
  await expectTextOnlyLandmark(page, "HRV", "hy");
  await tapCountry(page, "BIH");
  await expect(cardEl.getByRole("heading", { level: 2 })).toHaveText("Բոսնիա և Հերցեգովինա");
  await expectWordsWhole(cardEl.getByRole("heading", { level: 2 }), "BIH card title (hy)");
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
    await expectWordsWhole(page.getByTestId("find-prompt"), `Find ${target}`);
    if (q === 0) {
      const wrong = target === "SVN" ? "HRV" : "SVN";
      await tapCountry(page, wrong);
      await expect(page.getByTestId("find-feedback")).toContainText("Try again.");
      await page.getByRole("button", { name: "Hint" }).click();
      await expect(page.getByTestId("panel")).toContainText(`Its capital is ${CAPITALS[target]}.`);
      await expect(page.getByTestId("panel")).toContainText(`You'll also find ${LANDMARKS_IN_TEXT[target]} there.`);
      // The first hint names the capital and landmark only: no artwork, and nothing on the map points at the target.
      await expect(page.getByTestId("panel").locator("img")).toHaveCount(0);
      await expect(page.getByTestId("landmark-card")).toHaveCount(0);
      expect(await page.locator('[data-testid="map-main"] text').allTextContents()).toEqual([NAME_OF[wrong]]);
      await expect(page.locator(`[data-testid="map-main"] path[data-country="${target}"][data-tone]:not([data-tone="default"])`)).toHaveCount(0);
      await expect(page.locator("[data-marker-text]")).toHaveCount(0);
      // Home and a refresh keep the question exactly; Continue resumes it.
      await page.getByTestId("home").click();
      await expect(mainAction(page)).toHaveText(/^Continue\s*Level 4 · Along the Adriatic$/);
      await expect(card(page, L4).getByTestId("level-status")).toHaveText("In progress: Find");
      await page.reload();
      await mainAction(page).click();
      await expect(page.getByTestId("find-prompt")).toHaveText(`Find ${text}`);
      await expect(page.getByText(/Its capital is/)).toBeVisible();
    }
    await tapCountry(page, target);
    await expect(page.getByTestId("find-feedback")).toBeVisible();
    await page.getByRole("button", { name: q < 4 ? "Next" : "Continue to Travel" }).click();
  }
  expect([...asked].sort()).toEqual([...L4_COUNTRIES].sort());

  // --- Travel -------------------------------------------------------------------
  await expect(page.getByRole("heading", { name: /Italy.*Montenegro/ })).toBeVisible();
  await expect(page.getByText("Shortest route: 3 crossings")).toBeVisible();
  const moves = async () => (await page.locator('[data-testid^="move-"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")!.slice(5)))).sort();
  const route = page.locator('[data-testid="map-main"] [data-testid="route-line"]');
  // Every real neighbour in the level, and no others: Italy meets only Slovenia (no sea crossings).
  expect(await moves()).toEqual(["SVN"]);
  await page.getByTestId("move-SVN").click();
  expect(await moves()).toEqual(["HRV", "ITA"]);
  // Rome → a turning point in the Veneto → the Italian–Slovenian border → Ljubljana.
  await expect(route).toHaveAttribute("data-route", "ITA,SVN");
  await expect(route).toHaveAttribute("data-points", "4");
  await page.getByTestId("move-HRV").click();
  expect(await moves()).toEqual(["BIH", "MNE", "SVN"]);
  // Through Bosnia and Herzegovina takes four crossings: out of crossings there.
  await page.getByTestId("move-BIH").click();
  await expect(page.getByTestId("out-of-crossings")).toBeVisible();
  await page.getByTestId("out-of-crossings").getByRole("button", { name: "Undo" }).click();
  await expect(page.getByTestId("crossings-left")).toHaveText("1 crossing left");
  await page.reload();
  // A refresh keeps the journey where it was.
  await expect(route).toHaveAttribute("data-route", "ITA,SVN,HRV");
  await page.getByRole("button", { name: "Restart" }).click();
  await expect(route).toHaveCount(0);
  expect(await moves()).toEqual(["SVN"]);
  await expect(page.getByText("Help used on this journey")).toBeVisible();
  await page.getByTestId("move-SVN").click();
  await page.getByTestId("move-HRV").click();
  await page.getByTestId("move-MNE").click();

  // --- Results ------------------------------------------------------------------
  await expect(page.getByRole("heading", { name: "Journey complete!" })).toBeVisible();
  for (const name of ["Italy", "Slovenia", "Croatia", "Montenegro"]) await expect(page.getByTestId("result-route")).toContainText(name);
  await expect(page.getByTestId("result-crossings")).toContainText("3 of 3");
  await expect(page.getByTestId("result-help")).toContainText("Undo");
  await expect(page.getByTestId("result-find-answers").locator("li")).toHaveCount(5);
  await expect(page.getByTestId("result-find")).toContainText("4/5");
  // Zagreb → the Montenegrin border is drawn over the Pelješac Bridge, past Neum (18 points in all).
  await expect(route).toHaveAttribute("data-route", "ITA,SVN,HRV,MNE");
  await expect(route).toHaveAttribute("data-points", "18");
  await setLanguage(page, "Հայերեն");
  await expect(page.getByRole("heading", { name: "Ճամփորդությունն ավարտվեց։" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await setLanguage(page, "English");

  // Replay journey without help: the badge.
  await page.getByRole("button", { name: "Replay journey" }).click();
  await expect(page.getByTestId("crossings-left")).toHaveText("3 crossings left");
  for (const id of ["SVN", "HRV", "MNE"]) await page.getByTestId(`move-${id}`).click();
  await expect(page.getByRole("heading", { name: "Journey complete!" })).toBeVisible();
  await expect(page.getByTestId("result-help")).toHaveText(/Help used\s*None/);
  await expect(page.getByTestId("badge")).toBeVisible();

  // The level selection: every playable level completed, Level 5 still coming soon with no way in.
  await page.getByTestId("home").click();
  for (const id of [L1, L2, L3, L4]) await expect(card(page, id).getByTestId("level-status")).toHaveText("Completed");
  await expect(card(page, "towards-greece").getByTestId("level-status")).toHaveText(/^Coming soon/);
  await expect(card(page, "towards-greece").getByRole("button")).toHaveCount(0);
  await expect(page.getByTestId("welcome-actions")).toHaveCount(0);
  await expect(page.getByTestId("all-done")).toBeVisible();
  await page.reload();
  await expect(card(page, L4).getByTestId("level-status")).toHaveText("Completed");
  expect(errors).toEqual([]);
});

test("Level 4: Start over and Play again ask first, and keep the unlock and the other levels", async ({ page }) => {
  test.skip(test.info().project.name !== "desktop", "Runs once.");
  // In progress: Start over asks, naming the level; confirming resets only Level 4.
  await saveV2(page, { ...EARLIER, [L4]: findAsking("BIH", 1) }, { levelId: L4, recent: [L4, L3, L2, L1] });
  const dialog = page.getByTestId("start-over-dialog");
  await card(page, L4).getByRole("button", { name: /^Start over/ }).click();
  await expect(dialog.getByRole("heading")).toHaveText("Start “Along the Adriatic” over?");
  await page.keyboard.press("Escape");
  await expect(card(page, L4).getByTestId("level-status")).toHaveText("In progress: Find");
  await card(page, L4).getByRole("button", { name: /^Start over/ }).click();
  await dialog.getByRole("button", { name: "Start over" }).click();
  await expect(page.getByTestId("discover-progress")).toContainText("0/5");
  await page.getByTestId("home").click();
  for (const id of [L1, L2, L3]) await expect(card(page, id).getByTestId("level-status")).toHaveText("Completed");
  await expect(card(page, L4).getByTestId("level-status")).toHaveText("In progress: Discover");
  // Completed and replayed: Play again keeps the completion; Level 3 started over keeps Level 4 open.
  await saveV2(page, { ...EARLIER, [L4]: { ...L4_DONE, stage: "travel", travel: { missionId: "ita-to-mne", path: ["ITA", "SVN"], hintUsed: false, undoUsed: false } } }, { levelId: L4, recent: [L4, L3, L2, L1] });
  await card(page, L4).getByTestId("level-details-toggle").click();
  await card(page, L4).getByRole("button", { name: /^Play again/ }).click();
  await expect(dialog.getByRole("heading")).toHaveText("Play “Along the Adriatic” again?");
  await dialog.getByRole("button", { name: "Play again" }).click();
  await page.getByTestId("home").click();
  await expect(card(page, L4).getByTestId("level-status")).toHaveText("Completed");
  await card(page, L3).getByTestId("level-details-toggle").click();
  await card(page, L3).getByRole("button", { name: /^Play again/ }).click();
  await dialog.getByRole("button", { name: "Play again" }).click();
  await expect(page.getByTestId("discover-progress")).toContainText("0/5");
  await page.getByTestId("home").click();
  await expect(card(page, L4).getByTestId("level-status")).toHaveText("Completed");
  await page.reload();
  await expect(card(page, L4).getByTestId("level-status")).toHaveText("Completed");
});

/* Screenshots and layout at 320×568, 390×844 (phones) and 1366×800 (desktop), in both languages. */
test("Level 4 at phone and desktop sizes: the level selection, the new cards, Find, Travel, Results and a dialog", async ({ page }) => {
  const project = test.info().project.name;
  test.skip(project === "mobile", "Runs at 320×568 and 390×844 (small-phone), and on desktop.");
  test.setTimeout(600_000);
  const phone = project !== "desktop";
  const sizes = phone ? [[320, 568], [390, 844]] : [[1366, 800]];
  const panel = page.getByTestId("panel");
  const box = async (testId: string) => (await page.getByTestId(testId).boundingBox())!;
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    for (const locale of ["en", "hy"] as const) {
      const where = (what: string) => `${width}×${height} ${locale} ${what}`;

      // The level selection with Level 4 unlocked, then in progress: its card names its five countries in full.
      await saveV2(page, EARLIER, { locale, recent: [L3, L2, L1], levelId: L3 });
      await expect(card(page, L4)).toHaveAttribute("data-up-next", "true");
      await expect(mainAction(page)).toHaveAttribute("data-level", L4);
      await expect(card(page, L4)).toContainText(locale === "en" ? "Italy · Slovenia · Croatia · Bosnia and Herzegovina · Montenegro" : "Իտալիա · Սլովենիա · Խորվաթիա · Բոսնիա և Հերցեգովինա · Չեռնոգորիա");
      await expectNoHorizontalOverflow(page);
      await shot(page, `${locale}-levels-unlocked`);
      await saveV2(page, { ...EARLIER, [L4]: findAsking("BIH") }, { locale, recent: [L4, L3, L2, L1], levelId: L4 });
      await expect(card(page, L4).getByTestId("level-status")).toHaveText(locale === "en" ? "In progress: Find" : "Ընթացքի մեջ է՝ Գտիր");
      await shot(page, `${locale}-levels-in-progress`);
      // The Start over dialog names the level, whole.
      await card(page, L4).getByRole("button", { name: locale === "en" ? /^Start over/ : /^Սկսել նորից/ }).click();
      const dialog = page.getByTestId("start-over-dialog");
      await expect(dialog).toBeVisible();
      const d = (await dialog.boundingBox())!;
      expect(d.x >= 0 && d.x + d.width <= width && d.y >= 0 && d.y + d.height <= height, where("dialog off screen")).toBe(true);
      await expectWordsWhole(dialog.getByRole("heading"), where("dialog title"));
      await shot(page, `${locale}-start-over-dialog`);
      await page.keyboard.press("Escape");

      // Discover: the four new countries' text-only cards, and Bosnia and Herzegovina's long name.
      for (const id of NEW) {
        await openLevel4(page, discoverAt(id), locale);
        await expect(page.getByTestId("country-card")).toHaveAttribute("data-country", id);
        await expectTextOnlyLandmark(page, id, locale);
        const title = page.getByTestId("country-card").locator("h2");
        await expect(title).toHaveText(locale === "en" ? NAME_OF[id] : NAMES_HY[id]);
        await expect(page.getByTestId("country-capital")).toContainText(locale === "en" ? CAPITALS[id] : CAPITALS_HY[id]);
        await expectWordsWhole(title, where(`${id} title`));
        // Without scrolling: the name and the capital, above the pinned button.
        const fold = (await box("sticky-actions")).y;
        for (const part of [title, page.getByTestId("country-capital")]) {
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

      // Find: Bosnia and Herzegovina asked, then its first hint.
      await openLevel4(page, findAsking("BIH"), locale);
      await expectFindSpoilerFree(page, "BIH");
      await expectWordsWhole(page.getByTestId("find-prompt"), where("Find prompt"));
      await expectNoHorizontalOverflow(page);
      await shot(page, `${locale}-find`);
      await openLevel4(page, findAsking("BIH", 1), locale);
      await expect(panel).toContainText(locale === "en" ? "Stari Most" : "Մոստարի կամուրջը");
      await expectFindSpoilerFree(page, "BIH");
      await shot(page, `${locale}-find-hint`);

      // Travel in Croatia: Bosnia and Herzegovina among the choices; the route over the Pelješac Bridge on arrival.
      await openLevel4(page, travellingAt(["ITA", "SVN", "HRV"]), locale);
      await expect(page.getByTestId("crossings-left")).toHaveText(locale === "en" ? "1 crossing left" : "Մնաց 1 սահմանահատում");
      await expect(page.getByTestId("move-BIH")).toHaveText(locale === "en" ? "Bosnia and Herzegovina" : "Բոսնիա և Հերցեգովինա");
      await expectWordsWhole(page.getByTestId("move-BIH").locator("span"), where("Bosnia and Herzegovina choice"));
      await expect(page.locator('[data-testid="map-main"] [data-testid="route-line"]')).toHaveAttribute("data-route", "ITA,SVN,HRV");
      await expectMapTextClear(page);
      await expectNoHorizontalOverflow(page);
      await shot(page, `${locale}-travel`);

      // Results.
      await openLevel4(page, L4_DONE, locale);
      await expect(page.getByTestId("result-crossings")).toContainText("3");
      await expect(page.locator('[data-testid="map-main"] [data-testid="route-line"]')).toHaveAttribute("data-points", "18");
      await expectNoHorizontalOverflow(page);
      await shot(page, `${locale}-results`);
    }
  }

  // Enlarged text (phones): the text grows, nothing is cut, and every card scrolls fully above the pinned button.
  if (!phone) return;
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    for (const locale of ["en", "hy"] as const) {
      await openLevel4(page, discoverAt("BIH"), locale);
      for (const size of [150, 200]) {
        const where = `${width}×${height} ${locale} BIH ${size}%`;
        await page.evaluate((s) => (document.documentElement.style.fontSize = `${s}%`), size);
        await fontsSettled(page);
        const title = page.getByTestId("country-card").locator("h2");
        expect(parseFloat(await title.evaluate((el) => getComputedStyle(el).fontSize)), where).toBeGreaterThanOrEqual(((width < 420 ? 1.2 : 1.45) * 16 * size) / 100 - 0.5);
        await expectWordsWhole(title, `${where} title`);
        await panel.evaluate((el) => el.scrollTo(0, el.scrollHeight));
        const c = await box("country-card");
        expect(c.y + c.height, `${where}: card bottom`).toBeLessThanOrEqual((await box("sticky-actions")).y + 1);
        await expectNoHorizontalOverflow(page);
        await shot(page, `${locale}-discover-BIH-text${size}`);
        await panel.evaluate((el) => el.scrollTo(0, 0));
      }
      await page.evaluate(() => (document.documentElement.style.fontSize = ""));
      // Find for Bosnia and Herzegovina at 200%: the name wraps between words only.
      await openLevel4(page, findAsking("BIH"), locale);
      await page.evaluate(() => (document.documentElement.style.fontSize = "200%"));
      await fontsSettled(page);
      await expectWordsWhole(page.getByTestId("find-prompt"), `${width}×${height} ${locale} Find 200%`);
      await expectNoHorizontalOverflow(page);
      await shot(page, `${locale}-find-text200`);
      await page.evaluate(() => (document.documentElement.style.fontSize = ""));
    }
  }
});

/* The whole map: every country whole with padding, and never beyond the prepared data. */
test("Level 4's map: the start view and reset show all five countries; no size shows past the data", async ({ page }) => {
  test.skip(test.info().project.name !== "desktop", "Runs once, across sizes.");
  test.setTimeout(300_000);
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
        overviewCovers: overview.left <= svg.left + 0.5 && overview.top <= svg.top + 0.5 && overview.right >= svg.right - 0.5 && overview.bottom >= svg.bottom - 0.5,
        transform,
      };
    }, L4_COUNTRIES);
  // Short and ordinary phones, desktops, wide screens, and phones in landscape.
  const sizes = [[320, 568], [390, 844], [412, 915], [1366, 800], [1920, 1080], [2560, 1080], [740, 360], [844, 390]];
  const report: string[] = [];
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await openLevel4(page, discoverAt(null));
    await page.waitForTimeout(300);
    const start = await mapState();
    const where = `${width}×${height} (map ${Math.round(start.map.width)}×${Math.round(start.map.height)})`;
    expect(start.overviewCovers, `${where}: the view shows past the painted coverage`).toBe(true);
    const margin = Math.min(...start.countries.flatMap((c) => [c.left, c.top, c.right, c.bottom]));
    report.push(`${where}: smallest margin ${margin.toFixed(1)}px`);
    const aspect = start.map.width / start.map.height;
    // Whole, with padding, on every map from about 1:1.2 to 2.3:1 (see docs/DATA.md); beyond, the view zooms in slightly instead.
    if (aspect >= 1 / 1.2 && aspect <= 2.3) expect(margin, `${where}: a country touches or crosses the edge`).toBeGreaterThanOrEqual(4);
    await page.screenshot({ path: `screenshots/desktop/level4-map-${width}x${height}.png` });
    // Zoomed in and moved, "Show the whole map" returns to the same view, and the painted landscape still covers it.
    await page.getByRole("button", { name: "Zoom in" }).click();
    await page.getByRole("button", { name: "Zoom in" }).click();
    await page.waitForTimeout(500);
    expect((await mapState()).transform).not.toBe(start.transform);
    // Panned as far as it goes towards Montenegro's south-east, the landscape still covers the view.
    const svg = (await page.getByTestId("map-main").boundingBox())!;
    await page.mouse.move(svg.x + svg.width * 0.8, svg.y + svg.height * 0.8);
    await page.mouse.down();
    await page.mouse.move(svg.x + svg.width * 0.05, svg.y + svg.height * 0.05, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    expect((await mapState()).overviewCovers, `${where}: panned past the painted coverage`).toBe(true);
    await page.getByRole("button", { name: "Show the whole map" }).click();
    await expect.poll(async () => (await mapState()).transform, { timeout: 5000 }).toBe(start.transform);
    expect((await mapState()).overviewCovers).toBe(true);
  }
  test.info().annotations.push({ type: "margins", description: report.join("; ") });
  console.log(report.join("\n"));
});

/* The landscape: only Level 4's own overview, its overlay once a country has a state colour, and tiles only when zoomed. */
test("Level 4 loads its own landscape overview, and zoomed tiles only for the view", async ({ page }) => {
  test.skip(test.info().project.name !== "mobile", "Runs once.");
  await saveV2(page, { ...EARLIER, [L4]: discoverAt(null) }, { levelId: L3, recent: [L3, L2, L1] });
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await card(page, L4).getByRole("button", { name: /^Continue/ }).click();
  const main = page.getByTestId("map-main");
  await expect(main.locator('[data-family="land"] image[data-level="overview"]')).toHaveCount(1);
  await expect.poll(() => requests.some((u) => /along-the-adriatic-land/.test(u))).toBe(true);
  await page.waitForTimeout(500);
  expect(requests.filter((u) => /(western-europe-1|around-the-alps|central-europe)-(land|tone)/.test(u)), "another level's overview").toEqual([]);
  expect(requests.filter((u) => /along-the-adriatic-tone/.test(u)), "the overlay before any state colour").toEqual([]);
  expect(requests.filter((u) => u.includes("/relief/")), "zoomed tiles at the whole-map view").toEqual([]);
  // A selection gives Montenegro a state colour: its overlay is loaded.
  await tapCountry(page, "MNE");
  await expect(main.locator('[data-family="tone"] image[data-level="overview"]')).toHaveCount(1);
  await expect.poll(() => requests.some((u) => /along-the-adriatic-tone/.test(u))).toBe(true);
  // Zoomed in, sharper tiles for the visible part only.
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
