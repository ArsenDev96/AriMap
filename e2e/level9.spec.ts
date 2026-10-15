import { expect, test, type Page } from "@playwright/test";
import { openWithSave } from "./helpers/save";
import { homeToEurope } from "./helpers/home";

/*
 * Level 9 (Heart of the Balkans) from Discover to Results, its unlock from Level 8 (an existing save), its five
 * landmark cards (Montenegro's and Greece's artwork shared with earlier levels; Kosovo's, Albania's and North
 * Macedonia's own, supplied 2026-10-14), Find's hints and spoiler-free map (no artwork, even after a hint names the
 * landmark), the Montenegro → North Macedonia journey (two shortest routes, through Kosovo or through Albania; each
 * wrong turn runs out of crossings, recovered by Undo or Restart), Level 8's Next level, its own Next level (Level
 * 10), the level selection once Level 9 is completed (Level 10 up next), and its map: all five countries whole,
 * Kosovo and Montenegro tapped on the map itself on phones (no close-up), and the landscape it loads.
 */

const L1 = "western-europe-1";
const L2 = "around-the-alps";
const L3 = "central-europe";
const L4 = "along-the-adriatic";
const L5 = "towards-greece";
const L6 = "baltic-journey";
const L7 = "iberian-journey";
const L8 = "eastern-europe";
const L9 = "heart-of-the-balkans";
const L10 = "nordic-countries";
const L9_COUNTRIES = ["MNE", "KOS", "ALB", "MKD", "GRC"];
const NAMES: Record<string, string> = { MNE: "Montenegro", KOS: "Kosovo", ALB: "Albania", MKD: "North Macedonia", GRC: "Greece" };
const NAMES_HY: Record<string, string> = { MNE: "Չեռնոգորիա", KOS: "Կոսովո", ALB: "Ալբանիա", MKD: "Հյուսիսային Մակեդոնիա", GRC: "Հունաստան" };
const CAPITALS: Record<string, string> = { MNE: "Podgorica", KOS: "Pristina", ALB: "Tirana", MKD: "Skopje", GRC: "Athens" };
const CAPITALS_HY: Record<string, string> = { MNE: "Պոդգորիցա", KOS: "Պրիշտինա", ALB: "Տիրանա", MKD: "Սկոպիե", GRC: "Աթենք" };
const LANDMARKS: Record<string, string> = { MNE: "Ostrog Monastery", KOS: "Prizren Fortress", ALB: "Butrint", MKD: "Church of Saint John at Kaneo", GRC: "Meteora" };
const LANDMARKS_HY: Record<string, string> = { MNE: "Օստրոգի վանք", KOS: "Պրիզրենի ամրոց", ALB: "Բուտրինտ", MKD: "Կանեոյի Սուրբ Հովհաննես եկեղեցի", GRC: "Մետեորա" };
/** As named inside a sentence (Find's first hint, the alt text). */
const LANDMARKS_IN_TEXT: Record<string, string> = { ...LANDMARKS, MKD: "the Church of Saint John at Kaneo" };
const LANDMARK_IDS: Record<string, string> = { MNE: "ostrog-monastery", KOS: "prizren-fortress", ALB: "butrint", MKD: "kaneo-church", GRC: "meteora" };
/** The level's own artwork (Montenegro's and Greece's is shared with earlier levels). */
const BALKAN_ART = ["KOS", "ALB", "MKD"];
const ALT: Record<"en" | "hy", Record<string, string>> = {
  en: Object.fromEntries(L9_COUNTRIES.map((id) => [id, `Illustration of ${LANDMARKS_IN_TEXT[id]}`])),
  hy: {
    MNE: "Նկարազարդում՝ Օստրոգի վանքը",
    KOS: "Նկարազարդում՝ Պրիզրենի ամրոցը",
    ALB: "Նկարազարդում՝ Բուտրինտը",
    MKD: "Նկարազարդում՝ Կանեոյի Սուրբ Հովհաննես եկեղեցին",
    GRC: "Նկարազարդում՝ Մետեորան",
  },
};
/** The description in Discover, repeated by Find's second hint; Montenegro's is this level's own. */
const HINTS: Record<string, string> = {
  MNE: "A small mountainous country on the Adriatic in the north-west of this region.",
  KOS: "A small country with no coast in the north of this region, ringed by mountains.",
  ALB: "A mountainous country on the west coast of this region, between Montenegro and Greece.",
  MKD: "A country with no coast in the east of this region, just north of Greece.",
  GRC: "The southernmost country of this region: a mountainous peninsula with many islands.",
};

const answers = (order: string[]) => order.map((target) => ({ target, wrongGuesses: 0, hintLevel: 0 }));
const records = (travelDone: boolean) => ({ discoverDone: true, findDone: travelDone, travelDone, lastFindScore: null, bestFindScore: null, travelWithoutHelp: false });
const findDone = (order: string[]) => ({ order, index: 4, question: { target: order[4], wrongGuesses: [], hintLevel: 0, solved: true, feedback: null }, results: answers(order), status: "complete" });
/** A level finished, at its Results. */
const done = (order: string[], missionId: string, route: string[], revision?: number) => ({
  started: true,
  stage: "results",
  ...(revision ? { revision } : {}),
  discover: { selected: null, explored: [] },
  find: findDone(order),
  travel: { missionId, path: route, hintUsed: false, undoUsed: false },
  lastTravelResult: { missionId, route, hintUsed: false, undoUsed: false },
  records: { ...records(true), lastFindScore: { independent: 5, total: 5 }, bestFindScore: { independent: 5, total: 5 }, bestRating: 3 },
});
/** A save from before Level 9 existed: Levels 1–8 completed, each with its best stars. */
const EARLIER = {
  [L1]: done(["FRA", "BEL", "NLD", "LUX", "DEU"], "fra-to-nld", ["FRA", "BEL", "NLD"]),
  [L2]: done(["FRA", "CHE", "DEU", "AUT", "ITA"], "fra-to-aut", ["FRA", "DEU", "AUT"]),
  [L3]: done(["DEU", "POL", "CZE", "SVK", "AUT"], "pol-to-aut", ["POL", "CZE", "AUT"]),
  [L4]: done(["ITA", "SVN", "HRV", "BIH", "MNE"], "mne-to-ita", ["MNE", "HRV", "SVN", "ITA"]),
  [L5]: done(["HUN", "ROU", "SRB", "BGR", "GRC"], "hun-to-grc", ["HUN", "ROU", "BGR", "GRC"]),
  [L6]: done(["POL", "BLR", "LTU", "LVA", "EST"], "pol-to-est", ["POL", "LTU", "LVA", "EST"], 2),
  [L7]: done(["PRT", "ESP", "AND", "FRA", "ITA"], "prt-to-ita", ["PRT", "ESP", "FRA", "ITA"]),
  [L8]: done(["POL", "BLR", "UKR", "MDA", "ROU"], "pol-to-mda", ["POL", "UKR", "MDA"]),
};
const EARLIER_RECENT = [L8, L7, L6, L5, L4, L3, L2, L1];
/** Levels 1–9 completed: Level 10 up next (e2e/level10.spec.ts checks all eleven completed). */
const NINE_DONE = { ...EARLIER, [L9]: done(L9_COUNTRIES, "mne-to-mkd", ["MNE", "KOS", "MKD"]) };
const ALL_RECENT = [L9, ...EARLIER_RECENT];

const discoverAt = (selected: string | null) => ({ started: true, stage: "discover", discover: { selected, explored: selected ? [selected] : [] }, records: records(false) });
const findAsking = (target: string, hintLevel = 0) => ({
  started: true,
  stage: "find",
  discover: { selected: null, explored: L9_COUNTRIES },
  find: { order: [target, ...L9_COUNTRIES.filter((c) => c !== target)], index: 0, question: { target, wrongGuesses: [], hintLevel, solved: false, feedback: null }, results: [], status: "asking" },
  records: records(false),
});

const project = () => test.info().project.name;
const card = (page: Page, id: string) => page.getByTestId(`level-${id}`);
const mainAction = (page: Page) => page.getByTestId("welcome-actions").getByRole("button");

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
  await openWithSave(page, { version: 2, locale, screen, levelId, recent, levels });
  await appReady(page);
  await fontsSettled(page);
}

/** Opens Level 9 directly in a given state, Levels 1–8 completed. */
async function openLevel9(page: Page, level9: object, locale = "en") {
  await saveV2(page, { ...EARLIER, [L9]: level9 }, { locale, screen: "lesson", levelId: L9, recent: ALL_RECENT });
  for (const id of L9_COUNTRIES) await expect(page.locator(`[data-testid="map-main"] path[data-country="${id}"]`)).toBeAttached();
}

async function expectNoHorizontalOverflow(page: Page, where = "") {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${where}: horizontal overflow`).toBeLessThanOrEqual(0);
}

/** An on-screen point that hits the country's own path on the main map, nearest the middle of its hits. */
async function countryPoint(page: Page, id: string) {
  return page.evaluate((id) => {
    const path = document.querySelector(`[data-testid="map-main"] path[data-country="${id}"]`)!;
    const r = path.getBoundingClientRect();
    const hits: [number, number][] = [];
    for (let i = 1; i < 48; i++)
      for (let j = 1; j < 48; j++) {
        const [x, y] = [r.left + (r.width * i) / 48, r.top + (r.height * j) / 48];
        if (document.elementFromPoint(x, y) === path) hits.push([x, y]);
      }
    if (hits.length === 0) return null;
    const cx = hits.reduce((s, h) => s + h[0], 0) / hits.length;
    const cy = hits.reduce((s, h) => s + h[1], 0) / hits.length;
    hits.sort((a, b) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy));
    return hits[0];
  }, id);
}

async function tapCountry(page: Page, id: string) {
  const point = await countryPoint(page, id);
  expect(point, `${id} should be tappable`).not.toBeNull();
  if (test.info().project.use.hasTouch) await page.touchscreen.tap(point![0], point![1]);
  else await page.mouse.click(point![0], point![1]);
}

/**
 * The largest circle (its diameter, px) of points that all hit the country's own path on the main map: how
 * much room a finger has. Sampled on a 1 px grid over the country's box.
 */
async function tapRoom(page: Page, id: string) {
  return page.evaluate((id) => {
    const path = document.querySelector(`[data-testid="map-main"] path[data-country="${id}"]`)!;
    const r = path.getBoundingClientRect();
    const [w, h] = [Math.ceil(r.width), Math.ceil(r.height)];
    const hit: boolean[] = [];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) hit.push(document.elementFromPoint(r.left + i + 0.5, r.top + j + 0.5) === path);
    let best = 0;
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        if (!hit[j * w + i]) continue;
        // Distance to the nearest point that misses (or the box's edge).
        let d = Math.min(i + 1, j + 1, w - i, h - j);
        for (let jj = Math.max(0, j - d); jj < Math.min(h, j + d); jj++)
          for (let ii = Math.max(0, i - d); ii < Math.min(w, i + d); ii++) if (!hit[jj * w + ii]) d = Math.min(d, Math.hypot(ii - i, jj - j));
        best = Math.max(best, d);
      }
    return 2 * best;
  }, id);
}

/**
 * A Level 9 landmark card, with its own illustration (Montenegro's and Greece's shared with earlier levels): loaded,
 * from its own file, with alt text naming the landmark in the card's language, and the only image in the panel.
 * Every one is below 2:1 (1.00–1.70:1 for the Balkan three), so on phones it takes the square tile beside the
 * country's name.
 */
async function expectLandmarkCard(page: Page, id: string, locale: "en" | "hy") {
  const figure = page.getByTestId("landmark-card");
  await expect(figure).toHaveAttribute("data-landmark", LANDMARK_IDS[id]);
  await expect(figure).toContainText(locale === "en" ? LANDMARKS[id] : LANDMARKS_HY[id]);
  expect(((await figure.locator("figcaption span").last().textContent()) ?? "").length).toBeGreaterThan(30);
  await expect(figure).toHaveAttribute("data-art", "illustration");
  await expect(figure).toHaveAttribute("data-shape", "ordinary");
  const image = page.getByTestId("landmark-image");
  await expect(image).toHaveCount(1);
  await expect(page.getByTestId("panel").locator("img")).toHaveCount(1);
  await expect(image).toHaveAttribute("alt", ALT[locale][id]);
  await expect(image).toHaveAttribute("src", new RegExp(LANDMARK_IDS[id]));
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
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

/** No landmark artwork anywhere on the page (Find: the hint names the landmark in words only). */
async function expectNoLandmarkArt(page: Page) {
  await expect(page.getByTestId("landmark-image")).toHaveCount(0);
  const art = new RegExp(Object.values(LANDMARK_IDS).join("|"));
  const sources = await page.locator("img, image").evaluateAll((els) => els.map((e) => e.getAttribute("src") ?? e.getAttribute("href") ?? ""));
  expect(sources.filter((s) => art.test(s))).toEqual([]);
}

/** Nothing on the map singles out the Find target: no names, markers, badges or state colours; no artwork. */
async function expectFindSpoilerFree(page: Page, target: string) {
  expect(await page.locator('[data-testid="map-main"] text').allTextContents()).toEqual([]);
  await expect(page.locator("[data-explored-badge], [data-flash], [data-callout], [data-marker-text], [data-marker]")).toHaveCount(0);
  expect(await page.locator('[data-testid="map-main"] path[data-tone]:not([data-tone="default"])').count()).toBe(0);
  await expect(page.getByTestId("landmark-card")).toHaveCount(0);
  await expect(page.getByTestId("panel").locator("img")).toHaveCount(0);
  await expectNoLandmarkArt(page);
  const styling = await page.locator('[data-testid="map-main"] path[data-country]').evaluateAll((els, ids) => {
    const byCountry: Record<string, string> = {};
    for (const e of els) {
      const id = e.getAttribute("data-country")!;
      if (ids.includes(id)) byCountry[id] = [...e.attributes].filter((a) => a.name !== "d" && a.name !== "data-country").map((a) => `${a.name}=${a.value}`).sort().join(" ");
    }
    return byCountry;
  }, L9_COUNTRIES);
  for (const id of L9_COUNTRIES) expect(styling[id], `${id} styled differently from the target ${target}`).toBe(styling[target]);
}

/** The country shapes against the map's edges, and whether the painted overview covers the whole map. */
const mapState = (page: Page) =>
  page.evaluate((ids) => {
    const svg = document.querySelector('[data-testid="map-main"]')!.getBoundingClientRect();
    const countries = ids.map((id) => {
      const r = document.querySelector(`[data-testid="map-main"] path[data-country="${id}"]`)!.getBoundingClientRect();
      return { id, margin: Math.min(r.left - svg.left, r.top - svg.top, svg.right - r.right, svg.bottom - r.bottom) };
    });
    const overview = document.querySelector('[data-testid="map-main"] [data-family="land"] image[data-level="overview"]')!.getBoundingClientRect();
    return {
      countries,
      overviewCovers: overview.left <= svg.left + 0.5 && overview.top <= svg.top + 0.5 && overview.right >= svg.right - 0.5 && overview.bottom >= svg.bottom - 0.5,
    };
  }, L9_COUNTRIES);

const moves = (page: Page) => page.locator('[data-testid^="move-"]').evaluateAll((els) => els.filter((e) => !e.closest("[inert]")).map((e) => e.getAttribute("data-testid")!.slice(5)).sort());

test("Level 9, Heart of the Balkans: unlock from a Level 8 save, Discover, Find, Travel, Results, and Level 10 unlocked", async ({ page }) => {
  test.skip(project() !== "mobile", "Runs once, on the Pixel 7 project; layouts are checked at other sizes below.");
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // --- Unlock: a save from before Level 9, with Levels 1–8 completed and their best stars --------------------
  await saveV2(page, EARLIER, { levelId: L8, recent: EARLIER_RECENT });
  for (const id of [L1, L2, L3, L4, L5, L6, L7, L8]) await expect(card(page, id).getByTestId("level-status")).toHaveText("Completed");
  await expect(card(page, L9).getByTestId("level-status")).toHaveText("Ready to play");
  await expect(card(page, L9)).toHaveAttribute("data-up-next", "true");
  await expect(card(page, L9)).toContainText("Montenegro · Kosovo · Albania · North Macedonia · Greece");
  await expect(card(page, L9)).toContainText("Explore the southern Balkans, from Montenegro to Greece.");
  // Its card's picture: Kaneo Church's thumbnail.
  await expect(card(page, L9).locator('img[src*="kaneo-church"]')).toHaveCount(1);
  await expect(page.getByTestId("all-done")).toHaveCount(0);
  await expect(mainAction(page)).toHaveText(/^Start\s*Level 9 · Heart of the Balkans$/);
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem("arimap:state")!).levels);
  await mainAction(page).click();

  // --- Discover -----------------------------------------------------------------
  await expect(page.getByTestId("discover-progress")).toContainText("0/5");
  for (const id of L9_COUNTRIES) {
    await tapCountry(page, id);
    const country = page.getByTestId("country-card");
    await expect(country).toHaveAttribute("data-country", id);
    await expect(country.getByRole("heading", { level: 2 })).toHaveText(NAMES[id]);
    await expect(page.getByTestId("country-capital")).toContainText(CAPITALS[id]);
    await expect(country).toContainText(HINTS[id]);
    await expectLandmarkCard(page, id, "en");
  }
  await expect(page.getByTestId("discover-progress")).toContainText("5/5");
  // Earlier levels' progress, completion and best stars untouched.
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("arimap:state")!).levels);
  for (const id of [L1, L2, L3, L4, L5, L6, L7, L8]) expect(after[id]).toEqual(before[id]);
  await page.getByRole("button", { name: "Start finding" }).click();

  // --- Find: five questions, each country once; spoiler-free before an answer ---------------------------------
  const asked: string[] = [];
  for (let i = 0; i < 5; i++) {
    const prompt = (await page.getByTestId("find-prompt").textContent())!;
    const target = Object.keys(NAMES).find((id) => prompt.includes(NAMES[id]))!;
    expect(target, prompt).toBeTruthy();
    asked.push(target);
    await expectFindSpoilerFree(page, target);
    if (i === 0) {
      // A wrong tap first, then the hints: the capital and landmark in words, then the level's description.
      const wrong = target === "ALB" ? "GRC" : "ALB";
      await tapCountry(page, wrong);
      await expect(page.getByTestId("find-feedback")).toContainText(`That's ${NAMES[wrong]}. Try again.`);
      await page.getByRole("button", { name: "Hint", exact: true }).click();
      await expect(page.getByTestId("panel")).toContainText(`Its capital is ${CAPITALS[target]}.`);
      await expect(page.getByTestId("panel")).toContainText(`You'll also find ${LANDMARKS_IN_TEXT[target]} there.`);
      // The hint names the landmark in words only: no artwork.
      await expectNoLandmarkArt(page);
      await page.getByRole("button", { name: "More help" }).click();
      await expect(page.getByTestId("panel")).toContainText(HINTS[target]);
      await expectNoLandmarkArt(page);
    }
    await tapCountry(page, target);
    // After a wrong tap or a hint the answer counts as helped: "Found it!" rather than "Correct!".
    await expect(page.getByTestId("find-feedback")).toContainText(`${i === 0 ? "Found it!" : "Correct!"} That's ${NAMES[target]}.`);
    await page.getByRole("button", { name: i < 4 ? "Next" : "Continue to Travel" }).click();
  }
  expect([...asked].sort()).toEqual([...L9_COUNTRIES].sort());

  // --- Travel: Montenegro → North Macedonia in two crossings, through Kosovo or Albania ------------------------
  await expect(page.getByTestId("crossings-left")).toHaveText("2 crossings left");
  await expect(page.getByTestId("panel")).toContainText("Shortest route: 2 crossings");
  // Both first moves are on a shortest route; North Macedonia and Greece are not neighbours of Montenegro.
  expect(await moves(page)).toEqual(["ALB", "KOS"]);
  // Kosovo → Albania: real neighbours, but the crossings run out in Albania.
  await page.getByTestId("move-KOS").click();
  expect(await moves(page)).toEqual(["ALB", "MKD"]);
  await page.getByTestId("move-ALB").click();
  const stuck = page.getByTestId("out-of-crossings");
  await expect(stuck).toContainText("No crossings left. Each move crossed a real border, but this route is longer than the shortest one.");
  await expect(page.getByTestId("crossings-left")).toHaveText("0 crossings left");
  expect(await moves(page)).toEqual([]);
  await stuck.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByTestId("crossings-left")).toHaveText("1 crossing left");
  await page.getByTestId("travel-tools").getByRole("button", { name: "Restart" }).click();
  await expect(page.getByTestId("crossings-left")).toHaveText("2 crossings left");
  // Albania → Greece: out of crossings in Greece. Albania → Kosovo: in Kosovo.
  await page.getByTestId("move-ALB").click();
  expect(await moves(page)).toEqual(["GRC", "KOS", "MKD"]);
  await page.getByTestId("move-GRC").click();
  await expect(stuck).toBeVisible();
  await stuck.getByRole("button", { name: "Undo" }).click();
  await page.getByTestId("move-KOS").click();
  await expect(stuck).toBeVisible();
  await stuck.getByRole("button", { name: "Undo" }).click();
  await page.getByTestId("move-MKD").click();

  // --- Results: Level 10 follows; Next level ------------------------------------------------
  await expect(page.getByRole("heading", { name: "Journey complete!" })).toBeVisible();
  for (const name of ["Montenegro", "Albania", "North Macedonia"]) await expect(page.getByTestId("result-route")).toContainText(name);
  await expect(page.getByTestId("result-crossings")).toContainText("2 of 2");
  await expect(page.getByTestId("result-help")).toContainText("Undo");
  const route = page.locator('[data-testid="map-main"] [data-testid="route-line"]');
  // Podgorica, the Albanian–Montenegrin crossing, the turning point inland of Lezhë, Tirana, the Albanian–Macedonian
  // crossing, Skopje.
  await expect(route).toHaveAttribute("data-route", "MNE,ALB,MKD");
  await expect(route).toHaveAttribute("data-points", "6");
  // Level 10 follows: Next level is the main action, naming it.
  await expect(page.getByTestId("next-level")).toHaveAccessibleName("Next level: Level 10, Nordic Countries");
  await expect(page.getByTestId("back-to-levels")).toHaveCount(0);
  await expect(page.getByTestId("rating-attempt")).toHaveAttribute("data-stars", "2");

  // Replay journey without help, the other way, through Kosovo: the badge.
  await page.getByRole("button", { name: "Replay journey" }).click();
  await expect(page.getByTestId("crossings-left")).toHaveText("2 crossings left");
  for (const id of ["KOS", "MKD"]) await page.getByTestId(`move-${id}`).click();
  await expect(page.getByTestId("badge")).toBeVisible();
  // Podgorica, two turning points north of Albania's border, the Kosovan crossing, Pristina, the Macedonian crossing, Skopje.
  await expect(route).toHaveAttribute("data-route", "MNE,KOS,MKD");
  await expect(route).toHaveAttribute("data-points", "7");

  // --- The level selection: Levels 1–9 completed, Level 10 unlocked and up next; no completion message yet ------
  await homeToEurope(page);
  for (const id of [L1, L2, L3, L4, L5, L6, L7, L8, L9]) await expect(card(page, id).getByTestId("level-status")).toHaveText("Completed");
  await expect(card(page, L10).getByTestId("level-status")).toHaveText("Ready to play");
  await expect(card(page, L10)).toHaveAttribute("data-up-next", "true");
  await expect(mainAction(page)).toHaveText(/^Start\s*Level 10 · Nordic Countries$/);
  await expect(page.getByTestId("all-done")).toHaveCount(0);
  await page.reload();
  await expect(card(page, L10).getByTestId("level-status")).toHaveText("Ready to play");
  await expect(page.getByTestId("all-done")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Level 8's Next level opens Level 9; Level 10 up next once Level 9 is completed, in Armenian", async ({ page }) => {
  test.skip(project() !== "desktop", "Runs once.");
  // Level 8 at its Results, Level 9 never started: Next level opens it at Discover.
  await saveV2(page, EARLIER, { screen: "lesson", levelId: L8, recent: EARLIER_RECENT });
  const next = page.getByTestId("next-level");
  await expect(next).toHaveAccessibleName("Next level: Level 9, Heart of the Balkans");
  await next.click();
  await expect(page.getByTestId("discover-progress")).toContainText("0/5");
  await tapCountry(page, "KOS");
  await expect(page.getByTestId("country-card")).toHaveAttribute("data-country", "KOS");
  await page.reload();
  await expect(page.getByTestId("country-card")).toHaveAttribute("data-country", "KOS");
  // Levels 1–9 completed, in Armenian: Level 10 ready to play and up next, no completion message.
  await saveV2(page, NINE_DONE, { locale: "hy", levelId: L9, recent: ALL_RECENT });
  await expect(card(page, L9)).toContainText("Բալկանների սրտում");
  await expect(card(page, L10).getByTestId("level-status")).toHaveText("Պատրաստ է խաղալու");
  await expect(card(page, L10)).toHaveAttribute("data-up-next", "true");
  await expect(mainAction(page)).toHaveAttribute("data-level", L10);
  await expect(page.getByTestId("all-done")).toHaveCount(0);
});

test("Level 9 on phones and desktop: every card in both languages, Find with Kosovo and Montenegro tapped on the map, the five whole", async ({ page }) => {
  test.skip(!["small-phone", "desktop", "webkit-phone"].includes(project()), "Runs on small-phone, webkit-phone and desktop.");
  test.setTimeout(600_000);
  const phone = project() !== "desktop";
  const sizes = phone ? [[320, 568], [390, 844], [740, 360]] : [[1366, 800]];
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    for (const locale of ["en", "hy"] as const) {
      const where = `${width}×${height} ${locale}`;
      for (const id of L9_COUNTRIES) {
        await openLevel9(page, discoverAt(id), locale);
        await expectLandmarkCard(page, id, locale);
        await expect(page.getByTestId("country-card").getByRole("heading", { level: 2 })).toHaveText(locale === "en" ? NAMES[id] : NAMES_HY[id]);
        await expect(page.getByTestId("country-capital")).toContainText(locale === "en" ? CAPITALS[id] : CAPITALS_HY[id]);
        // The whole artwork, uncropped and unstretched, inside its tile.
        const art = await drawnArt(page);
        expect(art.fit).toBe("contain");
        expect(Math.abs(art.width / art.height - art.naturalRatio), `${where} ${id}: art stretched`).toBeLessThan(0.02);
        expect(art.top >= art.tile.top - 0.5 && art.bottom <= art.tile.bottom + 0.5 && art.left >= art.tile.left - 0.5 && art.right <= art.tile.right + 0.5, `${where} ${id}: art outside its tile`).toBe(true);
        if (BALKAN_ART.includes(id)) console.log(`${where} ${LANDMARK_IDS[id]} drawn ${art.width.toFixed(0)}×${art.height.toFixed(0)}px`);
        await expectNoHorizontalOverflow(page, `${where} ${id}`);
      }
      // Find, unanswered: the five whole on the map, the painted overview under all of it; Kosovo and Montenegro
      // answered by a tap on the map itself (no close-up), with room for a finger.
      for (const target of ["KOS", "MNE"]) {
        await openLevel9(page, findAsking(target), locale);
        await expect(page.getByTestId("inset-toggle")).toHaveCount(0);
        await expectFindSpoilerFree(page, target);
        const state = await mapState(page);
        for (const c of state.countries) expect(c.margin, `${where} ${c.id} cut by the map's edge`).toBeGreaterThanOrEqual(0);
        expect(state.overviewCovers, `${where}: overview covers the map`).toBe(true);
        const room = await tapRoom(page, target);
        console.log(`${where} ${target}: a ${room.toFixed(0)} px circle fits inside it`);
        expect(room, `${where} ${target}: room to tap`).toBeGreaterThanOrEqual(20);
        await tapCountry(page, target);
        await expect(page.getByTestId("find-feedback")).toContainText(locale === "en" ? `Correct! That's ${NAMES[target]}.` : "Ճիշտ է");
      }
    }
  }
});

/** The names drawn on the main map (a callout on two lines counts as its name), and each name's callout box. */
const drawnNames = (page: Page, names: Record<string, string>) =>
  page.evaluate((names) => {
    const texts = [...document.querySelectorAll("[data-overlay] text")].filter((e) => e.getBoundingClientRect().width > 0);
    const found: Record<string, { x0: number; y0: number; x1: number; y1: number } | null> = {};
    for (const [id, name] of Object.entries(names)) {
      const t = texts.find((e, i) => e.textContent === name || `${e.textContent} ${texts[i + 1]?.textContent}` === name);
      if (!t) continue;
      const rect = t.parentElement?.querySelector("rect");
      found[id] = rect ? { x0: +rect.getAttribute("x")!, y0: +rect.getAttribute("y")!, x1: +rect.getAttribute("x")! + +rect.getAttribute("width")!, y1: +rect.getAttribute("y")! + +rect.getAttribute("height")! } : null;
    }
    return found;
  }, names);

test("Level 9 at 320×568: Montenegro's callout clears the route into Albania; at 200% text in Armenian the five are whole and North Macedonia is named", async ({ page }) => {
  test.skip(project() !== "small-phone", "Runs once, at 320×568.");
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 320, height: 568 });
  // Normal text, in Armenian: at Results, the route via Albania (and via Kosovo) runs clear of Montenegro's callout.
  for (const via of ["ALB", "KOS"]) {
    await openLevel9(page, done(L9_COUNTRIES, "mne-to-mkd", ["MNE", via, "MKD"]), "hy");
    await expect(page.locator('[data-testid="map-main"] [data-testid="route-line"]')).toHaveAttribute("data-route", `MNE,${via},MKD`);
    const callout = (await drawnNames(page, NAMES_HY)).MNE;
    expect(callout, `via ${via}: Montenegro's callout`).toBeTruthy();
    const points = await page.locator('[data-testid="map-main"] [data-testid="route-line"] polyline').first().evaluate((e) => e.getAttribute("points")!.split(" ").map((p) => p.split(",").map(Number)));
    for (let i = 1; i < points.length; i++) {
      const [[ax, ay], [bx, by]] = [points[i - 1], points[i]];
      for (let s = 0; s <= 20; s++) {
        const [x, y] = [ax + ((bx - ax) * s) / 20, ay + ((by - ay) * s) / 20];
        expect(x > callout!.x0 && x < callout!.x1 && y > callout!.y0 && y < callout!.y1, `via ${via}: the route runs under Montenegro's callout at ${x.toFixed(0)},${y.toFixed(0)}`).toBe(false);
      }
    }
  }
  // 200% text (the root size, as a browser's text-size setting gives it), in Armenian: a 304×112 map.
  await page.addInitScript(() => {
    const enlarge = () => document.documentElement && (document.documentElement.style.fontSize = "200%");
    if (!enlarge()) new MutationObserver((_, o) => enlarge() && o.disconnect()).observe(document, { childList: true });
  });
  for (const [where, state] of [
    ["Discover, North Macedonia selected", discoverAt("MKD")],
    [
      "Travel, at the start",
      {
        started: true,
        stage: "travel",
        discover: { selected: null, explored: L9_COUNTRIES },
        find: findDone(["KOS", "MNE", "GRC", "ALB", "MKD"]),
        travel: { missionId: "mne-to-mkd", path: ["MNE"], hintUsed: false, undoUsed: false },
        records: { ...records(false), findDone: true },
      },
    ],
  ] as const) {
    await openLevel9(page, state, "hy");
    await expect.poll(() => page.getByTestId("map-main").evaluate((e) => Math.round(e.getBoundingClientRect().height)), `${where}: the map's height`).toBe(112);
    await expect.poll(async () => Math.min(...(await mapState(page)).countries.map((c) => c.margin)), `${where}: the five whole, with a small margin`).toBeGreaterThanOrEqual(8);
    // North Macedonia's name, on two lines where one has no room, beside the country.
    await expect.poll(async () => (await drawnNames(page, NAMES_HY)).MKD !== undefined, `${where}: North Macedonia named`).toBe(true);
    await expectNoHorizontalOverflow(page, where);
  }
});
