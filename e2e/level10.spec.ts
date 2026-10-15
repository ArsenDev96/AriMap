import { expect, test, type Page } from "@playwright/test";
import { openWithSave } from "./helpers/save";

/*
 * Level 10 (Nordic Countries) from Discover to Results, its unlock from Level 9 (an existing save), its five
 * landmark cards (all its own artwork, supplied 2026-10-14), Find's hints and spoiler-free map (no artwork, even after
 * a hint names the landmark), the Denmark → Finland journey (one shortest route, over the Øresund and through Sweden;
 * the wrong turn into Norway runs out of crossings, recovered by Undo or Restart; Iceland, learned in Discover and
 * Find, is on no journey, as the level's Travel note says), Level 9's Next level, the level selection once all ten
 * levels are completed, and its map: all five countries whole, Iceland tapped on the map itself, Denmark through the
 * close-up on phones, the close-up beside its toggle on smaller maps (clear of Iceland), and the names of the
 * selected and the traveller's country at 200% text.
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
const L10_COUNTRIES = ["DNK", "SWE", "NOR", "FIN", "ISL"];
const NAMES: Record<string, string> = { DNK: "Denmark", SWE: "Sweden", NOR: "Norway", FIN: "Finland", ISL: "Iceland" };
const NAMES_HY: Record<string, string> = { DNK: "Դանիա", SWE: "Շվեդիա", NOR: "Նորվեգիա", FIN: "Ֆինլանդիա", ISL: "Իսլանդիա" };
const CAPITALS: Record<string, string> = { DNK: "Copenhagen", SWE: "Stockholm", NOR: "Oslo", FIN: "Helsinki", ISL: "Reykjavík" };
const CAPITALS_HY: Record<string, string> = { DNK: "Կոպենհագեն", SWE: "Ստոկհոլմ", NOR: "Օսլո", FIN: "Հելսինկի", ISL: "Ռեյկյավիկ" };
const LANDMARKS: Record<string, string> = { DNK: "Kronborg Castle", SWE: "Visby City Wall", NOR: "Bryggen", FIN: "Olavinlinna", ISL: "Hallgrímskirkja" };
const LANDMARKS_HY: Record<string, string> = { DNK: "Կրոնբորգ ամրոց", SWE: "Վիսբյուի պարիսպ", NOR: "Բրյուգգեն", FIN: "Օլավինլինա ամրոց", ISL: "Հալթգրիմսկիրկյա" };
const LANDMARK_IDS: Record<string, string> = { DNK: "kronborg", SWE: "visby-city-wall", NOR: "bryggen", FIN: "olavinlinna", ISL: "hallgrimskirkja" };
const ALT: Record<"en" | "hy", Record<string, string>> = {
  en: Object.fromEntries(L10_COUNTRIES.map((id) => [id, `Illustration of ${LANDMARKS[id]}`])),
  hy: {
    DNK: "Նկարազարդում՝ Կրոնբորգ ամրոցը",
    SWE: "Նկարազարդում՝ Վիսբյուի պարիսպը",
    NOR: "Նկարազարդում՝ Բրյուգգենը",
    FIN: "Նկարազարդում՝ Օլավինլինա ամրոցը",
    ISL: "Նկարազարդում՝ Հալթգրիմսկիրկյան",
  },
};
/** The description in Discover, repeated by Find's second hint. */
const HINTS: Record<string, string> = {
  DNK: "A small, low country in the south of this region: a peninsula and many islands.",
  SWE: "A long country in the middle of this region, between Norway and Finland.",
  NOR: "A long, mountainous country on the Atlantic coast, west of Sweden, with deep fjords.",
  FIN: "A land of forests and lakes in the east of this region.",
  ISL: "An island country in the North Atlantic, far to the west of the others.",
};
const NOTE =
  "Denmark and Sweden have no land border: the Øresund Bridge and tunnel join them, and the border lies on the bridge. Iceland has no land border, bridge or tunnel to the others, so it isn't on this journey. Journeys here follow borders, bridges and tunnels, not ferries or flights.";

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
/** A save from before Level 10 existed: Levels 1–9 completed, each with its best stars. */
const EARLIER = {
  [L1]: done(["FRA", "BEL", "NLD", "LUX", "DEU"], "fra-to-nld", ["FRA", "BEL", "NLD"]),
  [L2]: done(["FRA", "CHE", "DEU", "AUT", "ITA"], "fra-to-aut", ["FRA", "DEU", "AUT"]),
  [L3]: done(["DEU", "POL", "CZE", "SVK", "AUT"], "pol-to-aut", ["POL", "CZE", "AUT"]),
  [L4]: done(["ITA", "SVN", "HRV", "BIH", "MNE"], "mne-to-ita", ["MNE", "HRV", "SVN", "ITA"]),
  [L5]: done(["HUN", "ROU", "SRB", "BGR", "GRC"], "hun-to-grc", ["HUN", "ROU", "BGR", "GRC"]),
  [L6]: done(["POL", "BLR", "LTU", "LVA", "EST"], "pol-to-est", ["POL", "LTU", "LVA", "EST"], 2),
  [L7]: done(["PRT", "ESP", "AND", "FRA", "ITA"], "prt-to-ita", ["PRT", "ESP", "FRA", "ITA"]),
  [L8]: done(["POL", "BLR", "UKR", "MDA", "ROU"], "pol-to-mda", ["POL", "UKR", "MDA"]),
  [L9]: done(["MNE", "KOS", "ALB", "MKD", "GRC"], "mne-to-mkd", ["MNE", "KOS", "MKD"]),
};
const EARLIER_RECENT = [L9, L8, L7, L6, L5, L4, L3, L2, L1];
const ALL_DONE = { ...EARLIER, [L10]: done(L10_COUNTRIES, "dnk-to-fin", ["DNK", "SWE", "FIN"]) };
const ALL_RECENT = [L10, ...EARLIER_RECENT];
const COMPLETION = {
  en: "You've completed all 10 levels! Play any of them again whenever you like.",
  hy: "Ավարտել ես բոլոր 10 մակարդակները։ Կարող ես ցանկացածը նորից խաղալ։",
};

const discoverAt = (selected: string | null) => ({ started: true, stage: "discover", discover: { selected, explored: selected ? [selected] : [] }, records: records(false) });
const findAsking = (target: string, hintLevel = 0) => ({
  started: true,
  stage: "find",
  discover: { selected: null, explored: L10_COUNTRIES },
  find: { order: [target, ...L10_COUNTRIES.filter((c) => c !== target)], index: 0, question: { target, wrongGuesses: [], hintLevel, solved: false, feedback: null }, results: [], status: "asking" },
  records: records(false),
});
const travelAt = (path: string[]) => ({
  started: true,
  stage: "travel",
  discover: { selected: null, explored: L10_COUNTRIES },
  find: findDone(["SWE", "ISL", "FIN", "NOR", "DNK"]),
  travel: { missionId: "dnk-to-fin", path, hintUsed: false, undoUsed: false },
  records: { ...records(false), findDone: true },
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

/** Opens Level 10 directly in a given state, Levels 1–9 completed (its map data loads with it). */
async function openLevel10(page: Page, level10: object, locale = "en") {
  await saveV2(page, { ...EARLIER, [L10]: level10 }, { locale, screen: "lesson", levelId: L10, recent: ALL_RECENT });
  for (const id of L10_COUNTRIES) await expect(page.locator(`[data-testid="map-main"] path[data-country="${id}"]`)).toBeAttached();
}

async function expectNoHorizontalOverflow(page: Page, where = "") {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${where}: horizontal overflow`).toBeLessThanOrEqual(0);
}

const MAIN = '[data-testid="map-main"]';
const INSET = '[data-testid="map-inset"]';

/** An on-screen point that hits the country's own path on a map (the main map or the close-up), nearest the middle of its hits. */
async function countryPoint(page: Page, id: string, map = MAIN) {
  return page.evaluate(
    ([id, map]) => {
      const path = document.querySelector(`${map} path[data-country="${id}"]`);
      if (!path) return null;
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
    },
    [id, map] as const,
  );
}

async function tapCountry(page: Page, id: string, map = MAIN) {
  const point = await countryPoint(page, id, map);
  expect(point, `${id} should be tappable`).not.toBeNull();
  if (test.info().project.use.hasTouch) await page.touchscreen.tap(point![0], point![1]);
  else await page.mouse.click(point![0], point![1]);
}

/**
 * The largest circle (its diameter, px) of points that all hit the country's own path on a map: how much room a
 * finger has. Sampled on a 1 px grid over the country's box.
 */
async function tapRoom(page: Page, id: string, map = MAIN) {
  return page.evaluate(
    ([id, map]) => {
      const path = document.querySelector(`${map} path[data-country="${id}"]`);
      if (!path) return 0;
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
    },
    [id, map] as const,
  );
}

/** Opens the close-up if it is closed (it opens by default on wide maps only). */
async function openCloseUp(page: Page) {
  const toggle = page.getByTestId("inset-toggle");
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(`${INSET} path[data-country="DNK"]`)).toBeAttached();
}

/**
 * A Level 10 landmark card, with its own illustration: loaded, from its own file, with alt text naming the landmark in
 * the card's language, and the only image in the panel. Every one is below 2:1 (Bryggen's, the widest, 1.84:1), so on
 * phones it takes the square tile beside the country's name.
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
  expect(await page.locator(`${MAIN} text`).allTextContents()).toEqual([]);
  await expect(page.locator("[data-explored-badge], [data-flash], [data-callout], [data-marker-text], [data-marker]")).toHaveCount(0);
  expect(await page.locator(`${MAIN} path[data-tone]:not([data-tone="default"])`).count()).toBe(0);
  await expect(page.getByTestId("landmark-card")).toHaveCount(0);
  await expect(page.getByTestId("panel").locator("img")).toHaveCount(0);
  await expectNoLandmarkArt(page);
  const styling = await page.locator(`${MAIN} path[data-country]`).evaluateAll((els, ids) => {
    const byCountry: Record<string, string> = {};
    for (const e of els) {
      const id = e.getAttribute("data-country")!;
      if (ids.includes(id)) byCountry[id] = [...e.attributes].filter((a) => a.name !== "d" && a.name !== "data-country").map((a) => `${a.name}=${a.value}`).sort().join(" ");
    }
    return byCountry;
  }, L10_COUNTRIES);
  for (const id of L10_COUNTRIES) expect(styling[id], `${id} styled differently from the target ${target}`).toBe(styling[target]);
  // The close-up names no country while Find asks.
  await expect(page.getByTestId("inset-title")).not.toContainText(/Denmark|Դանիա/);
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
  }, L10_COUNTRIES);

/** The names drawn on the main map (a callout on two lines counts as its name). */
const drawnNames = (page: Page, names: Record<string, string>) =>
  page.evaluate((names) => {
    const texts = [...document.querySelectorAll("[data-overlay] text")].filter((e) => e.getBoundingClientRect().width > 0).map((e) => e.textContent);
    return Object.keys(names).filter((id) => texts.some((t, i) => t === names[id] || `${t} ${texts[i + 1]}` === names[id]));
  }, names);

const moves = (page: Page) => page.locator('[data-testid^="move-"]').evaluateAll((els) => els.filter((e) => !e.closest("[inert]")).map((e) => e.getAttribute("data-testid")!.slice(5)).sort());

/** The traveller's pin in a country: "clear" when whole on the map and under neither the zoom controls nor "About the map". */
const travellerPin = (page: Page, id: string) =>
  page.evaluate((id) => {
    const map = document.querySelector('[data-testid="map-main"]')!.getBoundingClientRect();
    const pin = document.querySelector(`[data-testid="map-main"] [data-traveller="${id}"]`)?.getBoundingClientRect();
    if (!pin) return "no pin";
    if (pin.left < map.left || pin.top < map.top || pin.right > map.right || pin.bottom > map.bottom) return "cut by the map's edge";
    for (const chrome of ["map-controls", "map-about"]) {
      const r = document.querySelector(`[data-testid="${chrome}"]`)!.getBoundingClientRect();
      if (pin.left < r.right && r.left < pin.right && pin.top < r.bottom && r.top < pin.bottom) return `under ${chrome}`;
    }
    return "clear";
  }, id);

/**
 * Where the zoom controls are ("on the map", or "below" it: 8px under its right edge, in Travel and Results on a very
 * short map with the panel below it), their buttons' size, the map's height, and how much of Finland's outline (its
 * box, %) is in view.
 */
const toolbar = (page: Page) =>
  page.evaluate(() => {
    const map = document.querySelector('[data-testid="map-main"]')!.getBoundingClientRect();
    const controls = document.querySelector('[data-testid="map-controls"]')!;
    const c = controls.getBoundingClientRect();
    const inside = c.left >= map.left - 0.5 && c.right <= map.right + 0.5 && c.top >= map.top - 0.5 && c.bottom <= map.bottom + 0.5;
    const below = Math.abs(c.top - map.bottom - 8) < 1 && Math.abs(c.right - map.right) < 1;
    const inPanel = !!document.querySelector('[data-testid="map-controls-slot"]')?.contains(controls);
    const fin = document.querySelector('[data-testid="map-main"] path[data-country="FIN"]')!.getBoundingClientRect();
    const seen = Math.max(0, Math.min(fin.right, map.right) - Math.max(fin.left, map.left)) * Math.max(0, Math.min(fin.bottom, map.bottom) - Math.max(fin.top, map.top));
    const size = (b: Element) => b.getBoundingClientRect();
    // Every button is what a tap at its centre reaches.
    const reachable = [...controls.querySelectorAll("button")].every((b) => {
      const r = size(b);
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!hit && b.contains(hit);
    });
    return {
      placement: inside ? "on the map" : below ? "below" : inPanel ? "panel" : "elsewhere",
      reachable,
      buttons: [...controls.querySelectorAll("button")].map((b) => `${Math.round(size(b).width)}×${Math.round(size(b).height)}`).join(" "),
      mapHeight: Math.round(map.height),
      finland: Math.round((100 * seen) / (fin.width * fin.height)),
    };
  });

test("Level 10, Nordic Countries: unlock from a Level 9 save, Discover, Find, Travel, Results, and all ten levels completed", async ({ page }) => {
  test.skip(project() !== "mobile", "Runs once, on the Pixel 7 project; layouts are checked at other sizes below.");
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // --- Unlock: a save from before Level 10, with Levels 1–9 completed and their best stars -------------------
  await saveV2(page, EARLIER, { levelId: L9, recent: EARLIER_RECENT });
  for (const id of [L1, L2, L3, L4, L5, L6, L7, L8, L9]) await expect(card(page, id).getByTestId("level-status")).toHaveText("Completed");
  await expect(card(page, L10).getByTestId("level-status")).toHaveText("Ready to play");
  await expect(card(page, L10)).toHaveAttribute("data-up-next", "true");
  await expect(card(page, L10)).toContainText("Denmark · Sweden · Norway · Finland · Iceland");
  await expect(card(page, L10)).toContainText("Explore the Nordic countries, from Denmark to Iceland.");
  // Its card's picture: Olavinlinna's thumbnail (Finland is the destination).
  await expect(card(page, L10).locator('img[src*="olavinlinna"]')).toHaveCount(1);
  await expect(page.getByTestId("all-done")).toHaveCount(0);
  await expect(mainAction(page)).toHaveText(/^Start\s*Level 10 · Nordic Countries$/);
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem("arimap:state")!).levels);
  await mainAction(page).click();

  // --- Discover -----------------------------------------------------------------
  await expect(page.getByTestId("discover-progress")).toContainText("0/5");
  for (const id of L10_COUNTRIES) {
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
  for (const id of [L1, L2, L3, L4, L5, L6, L7, L8, L9]) expect(after[id]).toEqual(before[id]);
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
      const wrong = target === "SWE" ? "FIN" : "SWE";
      await tapCountry(page, wrong);
      await expect(page.getByTestId("find-feedback")).toContainText(`That's ${NAMES[wrong]}. Try again.`);
      await page.getByRole("button", { name: "Hint", exact: true }).click();
      await expect(page.getByTestId("panel")).toContainText(`Its capital is ${CAPITALS[target]}.`);
      await expect(page.getByTestId("panel")).toContainText(`You'll also find ${LANDMARKS[target]} there.`);
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
  expect([...asked].sort()).toEqual([...L10_COUNTRIES].sort());

  // --- Travel: Denmark → Finland in two crossings, over the Øresund and through Sweden -------------------------
  await expect(page.getByTestId("crossings-left")).toHaveText("2 crossings left");
  await expect(page.getByTestId("panel")).toContainText("Shortest route: 2 crossings");
  // The level's own note: the fixed link, and Iceland not on the journey.
  await expect(page.getByTestId("travel-note")).toHaveText(NOTE);
  // Denmark offers Sweden or Germany (Travel only); Iceland is never offered.
  expect(await moves(page)).toEqual(["DEU", "SWE"]);
  // Denmark → Germany: a crossing left, Poland or the Netherlands, both away from Finland.
  await page.getByTestId("move-DEU").click();
  await expect(page.getByTestId("crossings-left")).toHaveText("1 crossing left");
  expect(await moves(page)).toEqual(["NLD", "POL"]);
  const germany = page.locator(`${MAIN} [data-testid="route-line"]`);
  // Copenhagen across Zealand, the Great Belt, Funen and the Little Belt, Jutland to the border, Hamburg, Berlin.
  await expect(germany).toHaveAttribute("data-route", "DNK,DEU");
  await expect(germany).toHaveAttribute("data-points", "17");
  await expect(page.locator(`${MAIN} [data-country="DEU"]`)).toHaveAttribute("data-tone", "current");
  await page.getByTestId("move-NLD").click();
  await expect(page.getByTestId("out-of-crossings")).toBeVisible();
  await expect(germany).toHaveAttribute("data-route", "DNK,DEU,NLD");
  await expect(germany).toHaveAttribute("data-points", "19");
  // A refresh keeps the journey where it ran out; Retry goes back to Denmark.
  await page.reload();
  await expect(germany).toHaveAttribute("data-route", "DNK,DEU,NLD");
  await page.getByTestId("out-of-crossings").getByRole("button", { name: "Retry" }).click();
  await expect(germany).toHaveCount(0);
  expect(await moves(page)).toEqual(["DEU", "SWE"]);
  await page.getByTestId("move-SWE").click();
  expect(await moves(page)).toEqual(["FIN", "NOR"]);
  // Sweden → Norway: a real neighbour, but the crossings run out in Norway (Norway → Finland is never reached).
  await page.getByTestId("move-NOR").click();
  const stuck = page.getByTestId("out-of-crossings");
  await expect(stuck).toContainText("No crossings left. Each move crossed a real border, but this route is longer than the shortest one.");
  await expect(page.getByTestId("crossings-left")).toHaveText("0 crossings left");
  expect(await moves(page)).toEqual([]);
  const route = page.locator(`${MAIN} [data-testid="route-line"]`);
  // Copenhagen, the inner harbour, the Øresund link to the boundary on the bridge, Lernacken, inland to Stockholm, the
  // crossing nearest Morokulien, Oslo.
  await expect(route).toHaveAttribute("data-route", "DNK,SWE,NOR");
  await expect(route).toHaveAttribute("data-points", "18");
  await stuck.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByTestId("crossings-left")).toHaveText("1 crossing left");
  await expect(route).toHaveAttribute("data-route", "DNK,SWE");
  await expect(route).toHaveAttribute("data-points", "16");
  await page.getByTestId("travel-tools").getByRole("button", { name: "Restart" }).click();
  await expect(page.getByTestId("crossings-left")).toHaveText("2 crossings left");
  for (const id of ["SWE", "FIN"]) await page.getByTestId(`move-${id}`).click();

  // --- Results: the last level; Back to levels ------------------------------------------------
  await expect(page.getByRole("heading", { name: "Journey complete!" })).toBeVisible();
  for (const name of ["Denmark", "Sweden", "Finland"]) await expect(page.getByTestId("result-route")).toContainText(name);
  await expect(page.getByTestId("result-crossings")).toContainText("2 of 2");
  await expect(page.getByTestId("result-help")).toContainText("Undo");
  // ...then on through Sweden, inland past the Gulf of Bothnia, the Haparanda–Tornio crossing, inland through Finland
  // to Helsinki.
  await expect(route).toHaveAttribute("data-route", "DNK,SWE,FIN");
  await expect(route).toHaveAttribute("data-points", "27");
  await expect(page.getByTestId("next-level")).toHaveCount(0);
  await expect(page.getByTestId("back-to-levels")).toBeVisible();
  await expect(page.getByTestId("rating-attempt")).toHaveAttribute("data-stars", "2");

  // Replay journey without help: the badge.
  await page.getByRole("button", { name: "Replay journey" }).click();
  await expect(page.getByTestId("crossings-left")).toHaveText("2 crossings left");
  for (const id of ["SWE", "FIN"]) await page.getByTestId(`move-${id}`).click();
  await expect(page.getByTestId("badge")).toBeVisible();

  // --- The level selection: all ten completed --------------------------------------------
  await page.getByTestId("back-to-levels").click();
  for (const id of [L1, L2, L3, L4, L5, L6, L7, L8, L9, L10]) await expect(card(page, id).getByTestId("level-status")).toHaveText("Completed");
  await expect(page.getByTestId("welcome-actions")).toHaveCount(0);
  await expect(page.getByTestId("all-done")).toHaveText(COMPLETION.en);
  await page.reload();
  await expect(page.getByTestId("all-done")).toHaveText(COMPLETION.en);
  expect(errors).toEqual([]);
});

test("Level 9's Next level opens Level 10; all ten completed in Armenian", async ({ page }) => {
  test.skip(project() !== "desktop", "Runs once.");
  // Level 9 at its Results, Level 10 never started: Next level opens it at Discover.
  await saveV2(page, EARLIER, { screen: "lesson", levelId: L9, recent: EARLIER_RECENT });
  const next = page.getByTestId("next-level");
  await expect(next).toHaveAccessibleName("Next level: Level 10, Nordic Countries");
  await next.click();
  await expect(page.getByTestId("discover-progress")).toContainText("0/5");
  await tapCountry(page, "ISL");
  await expect(page.getByTestId("country-card")).toHaveAttribute("data-country", "ISL");
  await page.reload();
  await expect(page.getByTestId("country-card")).toHaveAttribute("data-country", "ISL");
  // All ten completed, in Armenian.
  await saveV2(page, ALL_DONE, { locale: "hy", levelId: L10, recent: ALL_RECENT });
  await expect(card(page, L10)).toContainText("Հյուսիսային երկրներ");
  await expect(card(page, L10)).toContainText("Դանիա · Շվեդիա · Նորվեգիա · Ֆինլանդիա · Իսլանդիա");
  await expect(page.getByTestId("all-done")).toHaveText(COMPLETION.hy);
});

test("Level 10 on phones and desktop: every card in both languages, Find with Iceland on the map and Denmark (through the close-up on phones), the five whole, the close-up clear of Iceland", async ({ page }) => {
  test.skip(!["small-phone", "desktop"].includes(project()), "Runs on small-phone and desktop.");
  test.setTimeout(600_000);
  const phone = project() !== "desktop";
  const sizes = phone ? [[320, 568], [390, 844], [740, 360]] : [[1366, 800]];
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    for (const locale of ["en", "hy"] as const) {
      const where = `${width}×${height} ${locale}`;
      for (const id of L10_COUNTRIES) {
        await openLevel10(page, discoverAt(id), locale);
        await expectLandmarkCard(page, id, locale);
        await expect(page.getByTestId("country-card").getByRole("heading", { level: 2 })).toHaveText(locale === "en" ? NAMES[id] : NAMES_HY[id]);
        await expect(page.getByTestId("country-capital")).toContainText(locale === "en" ? CAPITALS[id] : CAPITALS_HY[id]);
        // The whole artwork, uncropped and unstretched, inside its tile.
        const art = await drawnArt(page);
        expect(art.fit).toBe("contain");
        expect(Math.abs(art.width / art.height - art.naturalRatio), `${where} ${id}: art stretched`).toBeLessThan(0.02);
        expect(art.top >= art.tile.top - 0.5 && art.bottom <= art.tile.bottom + 0.5 && art.left >= art.tile.left - 0.5 && art.right <= art.tile.right + 0.5, `${where} ${id}: art outside its tile`).toBe(true);
        console.log(`${where} ${LANDMARK_IDS[id]} drawn ${art.width.toFixed(0)}×${art.height.toFixed(0)}px`);
        // The selected country is named on the map, in the close-up's caption too for Denmark once it is open.
        expect(await drawnNames(page, locale === "en" ? NAMES : NAMES_HY), `${where} ${id} named`).toContain(id);
        await expectNoHorizontalOverflow(page, `${where} ${id}`);
      }
      // Find, unanswered: the five whole on the map, the painted overview under all of it; Iceland answered by a tap
      // on the map itself, with room for a finger.
      await openLevel10(page, findAsking("ISL"), locale);
      // The close-up: open by default on wide maps only.
      await expect(page.getByTestId("inset-toggle")).toHaveAttribute("aria-expanded", phone ? "false" : "true");
      await expectFindSpoilerFree(page, "ISL");
      const state = await mapState(page);
      for (const c of state.countries) expect(c.margin, `${where} ${c.id} cut by the map's edge`).toBeGreaterThanOrEqual(0);
      expect(state.overviewCovers, `${where}: overview covers the map`).toBe(true);
      const room = await tapRoom(page, "ISL");
      console.log(`${where} ISL: a ${room.toFixed(0)} px circle fits inside it`);
      expect(room, `${where} ISL: room to tap`).toBeGreaterThanOrEqual(20);
      // The close-up open leaves Iceland and the others as much room (beside its toggle on smaller maps).
      await openCloseUp(page);
      if (phone) await expect(page.locator("[data-beside]")).toHaveCount(1);
      for (const id of ["ISL", "SWE", "NOR", "FIN"]) {
        const open = await tapRoom(page, id);
        console.log(`${where} ${id} with the close-up open: ${open.toFixed(0)} px`);
        expect(open, `${where} ${id}: room to tap with the close-up open`).toBeGreaterThanOrEqual(20);
      }
      await tapCountry(page, "ISL");
      await expect(page.getByTestId("find-feedback")).toContainText(locale === "en" ? "Correct! That's Iceland." : "Ճիշտ է");
      // Denmark: through the close-up on phones (11–18 px across on the main map), on the map itself on desktop.
      await openLevel10(page, findAsking("DNK"), locale);
      if (phone) {
        await openCloseUp(page);
        const inset = await tapRoom(page, "DNK", INSET);
        console.log(`${where} DNK in the close-up: ${inset.toFixed(0)} px`);
        expect(inset, `${where} DNK: room to tap in the close-up`).toBeGreaterThanOrEqual(20);
        await tapCountry(page, "DNK", INSET);
      } else {
        expect(await tapRoom(page, "DNK"), `${where} DNK: room to tap`).toBeGreaterThanOrEqual(20);
        await tapCountry(page, "DNK");
      }
      await expect(page.getByTestId("find-feedback")).toContainText(locale === "en" ? "Correct! That's Denmark." : "Ճիշտ է");
    }
  }
});

test("Level 10's traveller pin whole and clear of the map controls: Germany, Poland and the Netherlands entered and restored, Undo, Restart, Results", async ({ page }) => {
  test.skip(!["small-phone", "desktop"].includes(project()), "Runs on small-phone and desktop.");
  test.setTimeout(600_000);
  // Phones (320×568; 390×844; landscape, with 200% text too) and a desktop. Without the clearance, Warsaw's pin lay
  // under the controls on 320 and 390px phones and in landscape, and Helsinki's in Results on a 320px phone. With 200%
  // text on a 320×568 phone (a 304×150 map in English, 304×112 in Armenian, 304×156 in English Results), the controls
  // are below the map, so its view never zooms in to keep the pin clear of them, and Finland stays in view; in
  // landscape with 200% text (280×182, 280×180 in Armenian), beside the panel, they are at the panel's top, likewise.
  const sizes = project() === "desktop" ? [[1366, 800, 100]] : [[320, 568, 100], [320, 568, 200], [390, 844, 100], [568, 320, 100], [568, 320, 200]];
  for (const [width, height, text] of sizes) {
    await page.setViewportSize({ width, height });
    for (const locale of ["en", "hy"] as const) {
      const where = `${width}×${height}${text === 100 ? "" : ` ${text}% text`} ${locale}`;
      const enlarge = () => text !== 100 && page.evaluate((s) => (document.documentElement.style.fontSize = `${s}%`), text);
      // With 200% text the controls are off the map: below it on the 320×568 phone, in the panel beside it in landscape.
      const placement = text !== 200 ? "on the map" : width === 320 ? "below" : "panel";
      const expectClear = async (id: string, at: string) => {
        await expect.poll(() => travellerPin(page, id), `${where}, ${at}: ${id}`).toBe("clear");
        await expect.poll(async () => (await toolbar(page)).placement, `${where}, ${at}: the zoom controls`).toBe(placement);
        const t = await toolbar(page);
        expect(t.buttons, `${where}, ${at}: the zoom buttons' size`).toBe("44×44 44×44 44×44");
        expect(t.reachable, `${where}, ${at}: the zoom buttons uncovered`).toBe(true);
        if (placement !== "on the map") {
          // The map keeps the height it has in Discover and Find (Results' shorter header gives it 6px more).
          expect(placement === "below" ? [150, 156, 112] : [182, 188, 180, 186], `${where}, ${at}: the map's height`).toContain(t.mapHeight);
          await expect.poll(async () => (await toolbar(page)).finland, `${where}, ${at}: Finland in view`).toBe(100);
        }
        if (placement === "panel") {
          // Kept at the panel's top, and reachable, with its content scrolled to the end.
          const panel = page.getByTestId("panel");
          const top = async () => (await page.getByTestId("map-controls").boundingBox())!.y - (await panel.boundingBox())!.y;
          const before = await top();
          await panel.evaluate((el) => el.scrollTo(0, el.scrollHeight));
          expect(await top(), `${where}, ${at}: the zoom controls scrolled away`).toBeCloseTo(before, 0);
          expect((await toolbar(page)).reachable, `${where}, ${at}: the zoom buttons covered while scrolled`).toBe(true);
          await panel.evaluate((el) => el.scrollTo(0, 0));
        }
      };
      // A saved journey restored in each.
      for (const path of [
        ["DNK", "DEU"],
        ["DNK", "DEU", "POL"],
        ["DNK", "DEU", "NLD"],
      ]) {
        await openLevel10(page, travelAt(path), locale);
        await enlarge();
        await expectClear(path.at(-1)!, "restored");
      }
      // Entered from Denmark; Undo and Restart.
      await openLevel10(page, travelAt(["DNK"]), locale);
      await enlarge();
      await expectClear("DNK", "start");
      await page.getByTestId("move-DEU").click();
      await expectClear("DEU", "entered");
      await page.getByTestId("move-POL").click();
      await expectClear("POL", "entered");
      await page.getByTestId("out-of-crossings").getByRole("button").first().click();
      await expectClear("DEU", "Undo");
      await page.getByTestId("move-NLD").click();
      await expectClear("NLD", "entered");
      await page.getByTestId("out-of-crossings").getByRole("button").first().click();
      await page.getByTestId("travel-tools").getByRole("button").nth(2).click();
      await expectClear("DNK", "Restart");
      // Results, restored: the traveller in Helsinki.
      await openLevel10(page, ALL_DONE[L10], locale);
      await enlarge();
      await expectClear("FIN", "Results");
      if (placement === "panel") {
        // Turned upright (the controls below the map) and back (in the panel again).
        await page.setViewportSize({ width: 320, height: 568 });
        await expect.poll(async () => (await toolbar(page)).placement, `${where}: upright`).toBe("below");
        await page.setViewportSize({ width, height });
        await expectClear("FIN", "Results, turned upright and back");
      }
    }
  }
});

test("Level 10 at 320×568 with 200% text: the five whole; the selected and the traveller's country named, Denmark through the close-up; every country reachable", async ({ page }) => {
  test.skip(project() !== "small-phone", "Runs once, at 320×568.");
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 320, height: 568 });
  // 200% text (the root size, as a browser's text-size setting gives it): a 304×150 map in English, 304×112 in
  // Armenian, its controls in a row across its bottom right, over the label points of Denmark, Sweden and Norway.
  await page.addInitScript(() => {
    const enlarge = () => document.documentElement && (document.documentElement.style.fontSize = "200%");
    if (!enlarge()) new MutationObserver((_, o) => enlarge() && o.disconnect()).observe(document, { childList: true });
  });
  for (const [locale, height, names] of [
    ["en", 150, NAMES],
    ["hy", 112, NAMES_HY],
  ] as const) {
    // Discover, a country selected: its name on the map (Denmark's only in the close-up, which stays closed until asked).
    for (const id of ["SWE", "NOR", "FIN", "ISL"]) {
      const where = `${locale}, ${id} selected`;
      await openLevel10(page, discoverAt(id), locale);
      await expect.poll(() => page.getByTestId("map-main").evaluate((e) => Math.round(e.getBoundingClientRect().height)), `${where}: the map's height`).toBe(height);
      await expect.poll(async () => Math.min(...(await mapState(page)).countries.map((c) => c.margin)), `${where}: the five whole, with a small margin`).toBeGreaterThanOrEqual(8);
      await expect.poll(() => drawnNames(page, names), `${where}: named`).toContain(id);
      await expectNoHorizontalOverflow(page, where);
    }
    await openLevel10(page, discoverAt("DNK"), locale);
    await expect(page.getByTestId("inset-toggle")).toHaveAttribute("aria-expanded", "false");
    await openCloseUp(page);
    await expect(page.getByTestId("inset-title")).toContainText(locale === "en" ? "Denmark" : "Դանիա");
    // Travel: the traveller's country named, in Sweden and (after the wrong turn) in Norway.
    for (const path of [
      ["DNK", "SWE"],
      ["DNK", "SWE", "NOR"],
    ]) {
      const here = path.at(-1)!;
      await openLevel10(page, travelAt(path), locale);
      await expect.poll(() => drawnNames(page, names), `${locale}, Travel in ${here}: named`).toContain(here);
    }
    // Find: Iceland reachable with the close-up closed (it is by default); Denmark, under the map controls here,
    // through the close-up, which opened covers Iceland on a map this short.
    await openLevel10(page, findAsking("ISL"), locale);
    await expect(page.getByTestId("inset-toggle")).toHaveAttribute("aria-expanded", "false");
    expect(await tapRoom(page, "ISL"), `${locale}: room to tap Iceland`).toBeGreaterThanOrEqual(12);
    await tapCountry(page, "ISL");
    await expect(page.getByTestId("find-feedback")).toContainText(locale === "en" ? "Correct! That's Iceland." : "Ճիշտ է");
    await openLevel10(page, findAsking("DNK"), locale);
    await openCloseUp(page);
    expect(await tapRoom(page, "DNK", INSET), `${locale}: room to tap Denmark in the close-up`).toBeGreaterThanOrEqual(20);
    await tapCountry(page, "DNK", INSET);
    await expect(page.getByTestId("find-feedback")).toContainText(locale === "en" ? "Correct! That's Denmark." : "Ճիշտ է");
  }
});
