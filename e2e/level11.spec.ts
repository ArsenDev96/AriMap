import { expect, test, type Page } from "@playwright/test";
import { openWithSave } from "./helpers/save";

/*
 * Level 11 (Across the Channel) from Discover to Results, its unlock from Level 10 (an existing save), its five
 * landmark cards (Big Ben's and the Cliffs of Moher's own artwork, supplied 2026-10-15; France's, Belgium's and
 * Germany's from Level 1), Find's spoiler-free map, the Germany → United Kingdom journey (one shortest route, through
 * France and the Channel Tunnel; the wrong turns into Belgium and Luxembourg, Travel only, run out of crossings on the
 * Continent, recovered by Undo, Retry or Restart; Ireland, learned in Discover and Find, lies beyond the journey's end),
 * Level 10's Next level, the level selection once all eleven levels are completed, and its map: the five whole,
 * Ireland tapped on the map itself, Belgium through the close-up on phones (the close-up beside its toggle, clear of
 * Ireland), the traveller's pin whole and clear of the map controls.
 */

const L = ["western-europe-1", "around-the-alps", "central-europe", "along-the-adriatic", "towards-greece", "baltic-journey", "iberian-journey", "eastern-europe", "heart-of-the-balkans", "nordic-countries"];
const [L1, , , , , L6, , , , L10] = L;
const L11 = "across-the-channel";
const L11_COUNTRIES = ["GBR", "IRL", "FRA", "BEL", "DEU"];
const NAMES: Record<string, string> = { GBR: "United Kingdom", IRL: "Ireland", FRA: "France", BEL: "Belgium", DEU: "Germany", LUX: "Luxembourg" };
const NAMES_HY: Record<string, string> = { GBR: "Միացյալ Թագավորություն", IRL: "Իռլանդիա", FRA: "Ֆրանսիա", BEL: "Բելգիա", DEU: "Գերմանիա", LUX: "Լյուքսեմբուրգ" };
const CAPITALS: Record<string, string> = { GBR: "London", IRL: "Dublin", FRA: "Paris", BEL: "Brussels", DEU: "Berlin" };
const CAPITALS_HY: Record<string, string> = { GBR: "Լոնդոն", IRL: "Դուբլին", FRA: "Փարիզ", BEL: "Բրյուսել", DEU: "Բեռլին" };
const LANDMARKS: Record<string, string> = { GBR: "Big Ben", IRL: "Cliffs of Moher", FRA: "Eiffel Tower", BEL: "Atomium", DEU: "Brandenburg Gate" };
const LANDMARKS_HY: Record<string, string> = { GBR: "Բիգ Բեն", IRL: "Մոհերի ժայռեր", FRA: "Էյֆելյան աշտարակ", BEL: "Ատոմիում", DEU: "Բրանդենբուրգյան դարպասներ" };
const LANDMARK_IDS: Record<string, string> = { GBR: "big-ben", IRL: "cliffs-of-moher", FRA: "eiffel-tower", BEL: "atomium", DEU: "brandenburg-gate" };
const ALT: Record<"en" | "hy", Record<string, string>> = {
  en: { GBR: "Illustration of Big Ben", IRL: "Illustration of the Cliffs of Moher", FRA: "Illustration of the Eiffel Tower", BEL: "Illustration of the Atomium", DEU: "Illustration of the Brandenburg Gate" },
  hy: {
    GBR: "Նկարազարդում՝ Բիգ Բենը",
    IRL: "Նկարազարդում՝ Մոհերի ժայռերը",
    FRA: "Նկարազարդում՝ Էյֆելյան աշտարակը",
    BEL: "Նկարազարդում՝ Ատոմիումը",
    DEU: "Նկարազարդում՝ Բրանդենբուրգյան դարպասները",
  },
};
/** The description in Discover, repeated by Find's second hint: Belgium's is the level's own. */
const HINTS: Record<string, string> = {
  GBR: "An island country across the Channel from France. It includes Great Britain and Northern Ireland.",
  IRL: "The westernmost country of this region. It shares the island of Ireland with Northern Ireland, part of the United Kingdom.",
  FRA: "The largest country in this region, with coasts on the Atlantic and the Mediterranean.",
  BEL: "The smallest country of this region, between France and Germany, with a short North Sea coast.",
  DEU: "The large country in the east of this region, reaching both the North Sea and the Baltic Sea.",
};
/** Names as used in a sentence (Find's feedback: "That's the United Kingdom."). */
const IN_TEXT: Record<string, string> = { ...NAMES, GBR: "the United Kingdom" };
const NOTE = { en: "France and the United Kingdom are connected under the sea by the Channel Tunnel.", hy: "Ֆրանսիան և Միացյալ Թագավորությունը ծովի տակով միացված են Լա Մանշի թունելով։" };

const answers = (order: string[]) => order.map((target) => ({ target, wrongGuesses: 0, hintLevel: 0 }));
const records = (travelDone: boolean) => ({ discoverDone: true, findDone: travelDone, travelDone, lastFindScore: null, bestFindScore: null, travelWithoutHelp: false });
const findDone = (order: string[]) => ({ order, index: 4, question: { target: order[4], wrongGuesses: [], hintLevel: 0, solved: true, feedback: null }, results: answers(order), status: "complete" });
/** A level finished, at its Results, with its best stars. */
const done = (order: string[], missionId: string, route: string[], bestRating: number, revision?: number) => ({
  started: true,
  stage: "results",
  ...(revision ? { revision } : {}),
  discover: { selected: null, explored: [] },
  find: findDone(order),
  travel: { missionId, path: route, hintUsed: false, undoUsed: false },
  lastTravelResult: { missionId, route, hintUsed: false, undoUsed: false },
  records: { ...records(true), lastFindScore: { independent: 5, total: 5 }, bestFindScore: { independent: 5, total: 5 }, bestRating },
});
/**
 * A save from before Level 11 existed: Levels 1–10 completed, with mixed best stars saved. Their saved Results (every
 * answer on the first try, no help) support three stars each, so the game counts 30 (README, "Saves").
 */
const EARLIER = {
  [L[0]]: done(["FRA", "BEL", "NLD", "LUX", "DEU"], "fra-to-nld", ["FRA", "BEL", "NLD"], 3),
  [L[1]]: done(["FRA", "CHE", "DEU", "AUT", "ITA"], "fra-to-aut", ["FRA", "DEU", "AUT"], 2),
  [L[2]]: done(["DEU", "POL", "CZE", "SVK", "AUT"], "pol-to-aut", ["POL", "CZE", "AUT"], 1),
  [L[3]]: done(["ITA", "SVN", "HRV", "BIH", "MNE"], "mne-to-ita", ["MNE", "HRV", "SVN", "ITA"], 3),
  [L[4]]: done(["HUN", "ROU", "SRB", "BGR", "GRC"], "hun-to-grc", ["HUN", "ROU", "BGR", "GRC"], 2),
  [L[5]]: done(["POL", "BLR", "LTU", "LVA", "EST"], "pol-to-est", ["POL", "LTU", "LVA", "EST"], 3, 2),
  [L[6]]: done(["PRT", "ESP", "AND", "FRA", "ITA"], "prt-to-ita", ["PRT", "ESP", "FRA", "ITA"], 1),
  [L[7]]: done(["POL", "BLR", "UKR", "MDA", "ROU"], "pol-to-mda", ["POL", "UKR", "MDA"], 2),
  [L[8]]: done(["MNE", "KOS", "ALB", "MKD", "GRC"], "mne-to-mkd", ["MNE", "KOS", "MKD"], 3),
  [L[9]]: done(["DNK", "SWE", "NOR", "FIN", "ISL"], "dnk-to-fin", ["DNK", "SWE", "FIN"], 3),
};
const EARLIER_RECENT = [...L].reverse();
const ALL_DONE = { ...EARLIER, [L11]: done(L11_COUNTRIES, "deu-to-gbr", ["DEU", "FRA", "GBR"], 3) };
const ALL_RECENT = [L11, ...EARLIER_RECENT];
const COMPLETION = {
  en: "You've completed all 11 levels! Play any of them again whenever you like.",
  hy: "Ավարտել ես բոլոր 11 մակարդակները։ Կարող ես ցանկացածը նորից խաղալ։",
};

const discoverAt = (selected: string | null) => ({ started: true, stage: "discover", discover: { selected, explored: selected ? [selected] : [] }, records: records(false) });
const findAsking = (target: string) => ({
  started: true,
  stage: "find",
  discover: { selected: null, explored: L11_COUNTRIES },
  find: { order: [target, ...L11_COUNTRIES.filter((c) => c !== target)], index: 0, question: { target, wrongGuesses: [], hintLevel: 0, solved: false, feedback: null }, results: [], status: "asking" },
  records: records(false),
});
const travelAt = (path: string[]) => ({
  started: true,
  stage: "travel",
  discover: { selected: null, explored: L11_COUNTRIES },
  find: findDone(["IRL", "BEL", "GBR", "DEU", "FRA"]),
  travel: { missionId: "deu-to-gbr", path, hintUsed: false, undoUsed: false },
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

/** Opens Level 11 directly in a given state, Levels 1–10 completed (its map data loads with it). */
async function openLevel11(page: Page, level11: object, locale = "en") {
  await saveV2(page, { ...EARLIER, [L11]: level11 }, { locale, screen: "lesson", levelId: L11, recent: ALL_RECENT });
  for (const id of L11_COUNTRIES) await expect(page.locator(`[data-testid="map-main"] path[data-country="${id}"]`)).toBeAttached();
}

async function expectNoHorizontalOverflow(page: Page, where = "") {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${where}: horizontal overflow`).toBeLessThanOrEqual(0);
}

const MAIN = '[data-testid="map-main"]';
const INSET = '[data-testid="map-inset"]';

/**
 * An on-screen point that hits the country's own path on a map (the main map or the close-up): well inside it (its
 * neighbours on the sampling grid hit it too), nearest the middle of its hits. The middle of the United Kingdom's hits
 * lies at Morecambe Bay, on the coast, where a tap may reach the shallow-water band instead (WebKit).
 */
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
      const key = (h: readonly number[]) => `${Math.round(h[0] * 100)},${Math.round(h[1] * 100)}`;
      const hit = new Set(hits.map(key));
      const [sx, sy] = [r.width / 48, r.height / 48];
      const inner = hits.filter(([x, y]) => [-1, 0, 1].every((i) => [-1, 0, 1].every((j) => hit.has(key([x + i * sx, y + j * sy])))));
      const pool = inner.length ? inner : hits;
      pool.sort((a, b) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy));
      return pool[0];
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
 * finger has. Sampled on a 1 px grid over the country's box (Ireland and Belgium, the smallest of the five).
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
  await expect(page.locator(`${INSET} path[data-country="BEL"]`)).toBeAttached();
}

/**
 * A Level 11 landmark card, with its illustration: loaded, from its own file, with alt text naming the landmark in the
 * card's language, and the only image in the panel. Every one is below 2:1 (the Cliffs of Moher's, the widest, 1.89:1;
 * Big Ben's, the tallest, 0.71:1), so on phones it takes the square tile beside the country's name.
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
  }, L11_COUNTRIES);
  for (const id of L11_COUNTRIES) expect(styling[id], `${id} styled differently from the target ${target}`).toBe(styling[target]);
  // The close-up names no country while Find asks: its caption is "Close-up", its accessible name "of the marked area".
  await expect(page.getByTestId("inset-title")).not.toContainText(/Belgium|Բելգիա/);
  for (const label of await page.locator(INSET).evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? ""))) expect(label).not.toMatch(/Belgium|Բելգիա/);
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
  }, L11_COUNTRIES);

/** The names drawn on the main map (a callout on two lines counts as its name). */
const drawnNames = (page: Page, names: Record<string, string>) =>
  page.evaluate((names) => {
    const texts = [...document.querySelectorAll("[data-overlay] text")].filter((e) => e.getBoundingClientRect().width > 0).map((e) => e.textContent);
    return Object.keys(names).filter((id) => texts.some((t, i) => t === names[id] || `${t} ${texts[i + 1]}` === names[id]));
  }, names);

/** The moves offered, in the order shown. */
const moves = (page: Page) => page.locator('[data-testid^="move-"]').evaluateAll((els) => els.filter((e) => !e.closest("[inert]")).map((e) => e.getAttribute("data-testid")!.slice(5)));

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
 * short map with the panel below it; or at the top of the panel beside it), their buttons' size, the map's height, and
 * how much of the United Kingdom's outline (its box, %) is in view.
 */
const toolbar = (page: Page) =>
  page.evaluate(() => {
    const map = document.querySelector('[data-testid="map-main"]')!.getBoundingClientRect();
    const controls = document.querySelector('[data-testid="map-controls"]')!;
    const c = controls.getBoundingClientRect();
    const inside = c.left >= map.left - 0.5 && c.right <= map.right + 0.5 && c.top >= map.top - 0.5 && c.bottom <= map.bottom + 0.5;
    const below = Math.abs(c.top - map.bottom - 8) < 1 && Math.abs(c.right - map.right) < 1;
    const inPanel = !!document.querySelector('[data-testid="map-controls-slot"]')?.contains(controls);
    const uk = document.querySelector('[data-testid="map-main"] path[data-country="GBR"]')!.getBoundingClientRect();
    const seen = Math.max(0, Math.min(uk.right, map.right) - Math.max(uk.left, map.left)) * Math.max(0, Math.min(uk.bottom, map.bottom) - Math.max(uk.top, map.top));
    const reachable = [...controls.querySelectorAll("button")].every((b) => {
      const r = b.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!hit && b.contains(hit);
    });
    return {
      placement: inside ? "on the map" : below ? "below" : inPanel ? "panel" : "elsewhere",
      reachable,
      buttons: [...controls.querySelectorAll("button")].map((b) => `${Math.round(b.getBoundingClientRect().width)}×${Math.round(b.getBoundingClientRect().height)}`).join(" "),
      mapHeight: Math.round(map.height),
      uk: Math.round((100 * seen) / (uk.width * uk.height)),
    };
  });

test("Level 11, Across the Channel: unlock from a Level 10 save, Discover, Find, Travel through the Channel Tunnel, Results, and all eleven levels completed", async ({ page }) => {
  test.skip(project() !== "mobile", "Runs once, on the Pixel 7 project; layouts are checked at other sizes below.");
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // --- Unlock: a save from before Level 11, with Levels 1–10 completed and their best stars ------------------
  await saveV2(page, EARLIER, { levelId: L10, recent: EARLIER_RECENT });
  for (const id of L) await expect(card(page, id).getByTestId("level-status")).toHaveText("Completed");
  await expect(card(page, L11).getByTestId("level-status")).toHaveText("Ready to play");
  await expect(card(page, L11)).toHaveAttribute("data-up-next", "true");
  await expect(card(page, L11)).toContainText("United Kingdom · Ireland · France · Belgium · Germany");
  await expect(card(page, L11)).toContainText("Explore north-western Europe, from Germany to Ireland.");
  // Its card's picture: Big Ben's thumbnail (the United Kingdom is the destination).
  await expect(card(page, L11).locator('img[src*="big-ben"]')).toHaveCount(1);
  await expect(page.getByTestId("continent-stars").first()).toHaveAttribute("data-max", "33");
  await expect(page.getByTestId("continent-stars").first()).toHaveAttribute("data-earned", "30");
  await expect(page.getByTestId("all-done")).toHaveCount(0);
  await expect(mainAction(page)).toHaveText(/^Start\s*Level 11 · Across the Channel$/);
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem("arimap:state")!).levels);
  await mainAction(page).click();

  // --- Discover: Belgium through the close-up on this phone (its tap circle about 22 px on the main map) -------
  await expect(page.getByTestId("discover-progress")).toContainText("0/5");
  for (const id of L11_COUNTRIES) {
    if (id === "BEL") {
      await openCloseUp(page);
      await tapCountry(page, id, INSET);
    } else await tapCountry(page, id);
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
  for (const id of L) expect(after[id]).toEqual(before[id]);
  await page.getByRole("button", { name: "Start finding" }).click();

  // --- Find: five questions, each country once; spoiler-free before an answer ---------------------------------
  const asked: string[] = [];
  for (let i = 0; i < 5; i++) {
    const prompt = (await page.getByTestId("find-prompt").textContent())!;
    const target = L11_COUNTRIES.find((id) => prompt.includes(NAMES[id]))!;
    expect(target, prompt).toBeTruthy();
    asked.push(target);
    await expectFindSpoilerFree(page, target);
    if (i === 0) {
      // A wrong tap first, then the hints: the capital and landmark in words, then the description.
      const wrong = target === "FRA" ? "DEU" : "FRA";
      await tapCountry(page, wrong);
      await expect(page.getByTestId("find-feedback")).toContainText(`That's ${IN_TEXT[wrong]}. Try again.`);
      await page.getByRole("button", { name: "Hint", exact: true }).click();
      await expect(page.getByTestId("panel")).toContainText(`Its capital is ${CAPITALS[target]}.`);
      await expectNoLandmarkArt(page);
      await page.getByRole("button", { name: "More help" }).click();
      await expect(page.getByTestId("panel")).toContainText(HINTS[target]);
      await expectNoLandmarkArt(page);
    }
    if (target === "BEL") {
      await openCloseUp(page);
      await tapCountry(page, target, INSET);
    } else await tapCountry(page, target);
    await expect(page.getByTestId("find-feedback")).toContainText(`${i === 0 ? "Found it!" : "Correct!"} That's ${IN_TEXT[target]}.`);
    await page.getByRole("button", { name: i < 4 ? "Next" : "Continue to Travel" }).click();
  }
  expect([...asked].sort()).toEqual([...L11_COUNTRIES].sort());

  // --- Travel: Germany → the United Kingdom in two crossings, through France and the Channel Tunnel -----------
  await expect(page.getByTestId("crossings-left")).toHaveText("2 crossings left");
  await expect(page.getByTestId("panel")).toContainText("Shortest route: 2 crossings");
  // The level's own note: the tunnel under the sea.
  await expect(page.getByTestId("travel-note")).toHaveText(NOTE.en);
  // Germany offers France, Belgium or Luxembourg (Travel only); never the United Kingdom or Ireland.
  expect(await moves(page)).toEqual(["FRA", "BEL", "LUX"]);
  const route = page.locator(`${MAIN} [data-testid="route-line"]`);
  // Germany → Belgium: a crossing left, France or Luxembourg; either runs out of crossings on the Continent.
  await page.getByTestId("move-BEL").click();
  await expect(page.getByTestId("crossings-left")).toHaveText("1 crossing left");
  expect(await moves(page)).toEqual(["FRA", "LUX"]);
  await page.getByTestId("move-LUX").click();
  await expect(page.getByTestId("out-of-crossings")).toBeVisible();
  await expect(route).toHaveAttribute("data-route", "DEU,BEL,LUX");
  await expect(route).toHaveAttribute("data-points", "5");
  // Luxembourg, a few pixels across, is named in a callout while the traveller is there.
  expect(await drawnNames(page, NAMES)).toContain("LUX");
  await page.getByTestId("out-of-crossings").getByRole("button", { name: "Undo" }).click();
  await page.getByTestId("move-FRA").click();
  // In France with no crossing left: the tunnel is there, but the journey stops.
  const stuck = page.getByTestId("out-of-crossings");
  await expect(stuck).toContainText("No crossings left.");
  expect(await moves(page)).toEqual([]);
  // A refresh keeps the journey where it ran out; Retry goes back to Germany.
  await page.reload();
  await expect(route).toHaveAttribute("data-route", "DEU,BEL,FRA");
  await stuck.getByRole("button", { name: "Retry" }).click();
  await expect(route).toHaveCount(0);
  expect(await moves(page)).toEqual(["FRA", "BEL", "LUX"]);
  await page.getByTestId("move-LUX").click();
  expect(await moves(page)).toEqual(["FRA", "BEL"]);
  await page.getByTestId("travel-tools").getByRole("button", { name: "Restart" }).click();
  await expect(page.getByTestId("crossings-left")).toHaveText("2 crossings left");
  await page.getByTestId("move-FRA").click();
  // France offers the United Kingdom, through the tunnel, and its neighbours on the Continent.
  expect(await moves(page)).toEqual(["GBR", "BEL", "LUX"]);
  await expect(route).toHaveAttribute("data-route", "DEU,FRA");
  await expect(route).toHaveAttribute("data-points", "3");
  await page.getByTestId("move-GBR").click();

  // --- Results: the last level; Back to levels ------------------------------------------------
  await expect(page.getByRole("heading", { name: "Journey complete!" })).toBeVisible();
  for (const name of ["Germany", "France", "United Kingdom"]) await expect(page.getByTestId("result-route")).toContainText(name);
  await expect(page.getByTestId("result-crossings")).toContainText("2 of 2");
  await expect(page.getByTestId("result-help")).toContainText("Undo");
  // Berlin, Level 1's crossing, Paris, the French portal at Coquelles, the tunnel under the Channel (the frontier on
  // it), the English portal at Folkestone, London.
  await expect(route).toHaveAttribute("data-route", "DEU,FRA,GBR");
  await expect(route).toHaveAttribute("data-points", "22");
  await expect(page.getByTestId("next-level")).toHaveCount(0);
  await expect(page.getByTestId("back-to-levels")).toBeVisible();
  await expect(page.getByTestId("rating-attempt")).toHaveAttribute("data-stars", "2");

  // Replay journey without help: the badge.
  await page.getByRole("button", { name: "Replay journey" }).click();
  await expect(page.getByTestId("crossings-left")).toHaveText("2 crossings left");
  for (const id of ["FRA", "GBR"]) await page.getByTestId(`move-${id}`).click();
  await expect(page.getByTestId("badge")).toBeVisible();

  // --- The level selection: all eleven completed --------------------------------------------
  await page.getByTestId("back-to-levels").click();
  for (const id of [...L, L11]) await expect(card(page, id).getByTestId("level-status")).toHaveText("Completed");
  await expect(page.getByTestId("welcome-actions")).toHaveCount(0);
  await expect(page.getByTestId("all-done")).toHaveText(COMPLETION.en);
  await page.reload();
  await expect(page.getByTestId("all-done")).toHaveText(COMPLETION.en);
  expect(errors).toEqual([]);
});

test("Level 10's Next level opens Level 11; all eleven completed in Armenian", async ({ page }) => {
  test.skip(project() !== "desktop", "Runs once.");
  // Level 10 at its Results, Level 11 never started: Next level opens it at Discover.
  await saveV2(page, EARLIER, { screen: "lesson", levelId: L10, recent: EARLIER_RECENT });
  const next = page.getByTestId("next-level");
  await expect(next).toHaveAccessibleName("Next level: Level 11, Across the Channel");
  await next.click();
  await expect(page.getByTestId("discover-progress")).toContainText("0/5");
  await tapCountry(page, "IRL");
  await expect(page.getByTestId("country-card")).toHaveAttribute("data-country", "IRL");
  await page.reload();
  await expect(page.getByTestId("country-card")).toHaveAttribute("data-country", "IRL");
  // Level 6's attempt keeps the version it was made on; every earlier best rating is kept, never lowered (those
  // saved below what their Results support are raised to it: 3 each), and every completion record stays.
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("arimap:state")!).levels);
  expect(saved[L6].revision).toBe(2);
  for (const id of L) {
    expect(saved[id].records.bestRating, id).toBeGreaterThanOrEqual((EARLIER as Record<string, { records: { bestRating: number } }>)[id].records.bestRating);
    expect(saved[id].records.travelDone, id).toBe(true);
  }
  // All eleven completed, in Armenian.
  await saveV2(page, ALL_DONE, { locale: "hy", levelId: L11, recent: ALL_RECENT });
  await expect(card(page, L11)).toContainText("Լա Մանշի այն կողմ");
  await expect(card(page, L11)).toContainText("Միացյալ Թագավորություն · Իռլանդիա · Ֆրանսիա · Բելգիա · Գերմանիա");
  await expect(page.getByTestId("all-done")).toHaveText(COMPLETION.hy);
  await expect(page.getByTestId("continent-stars").first()).toHaveAttribute("data-earned", "33");
  await expect(page.getByTestId("continent-stars").first()).toHaveAttribute("data-max", "33");
});

test("Level 11 on phones and desktop: every card in both languages, Find with Ireland on the map and Belgium (through the close-up on phones), the five whole, the close-up clear of Ireland", async ({ page }) => {
  test.skip(!["small-phone", "desktop"].includes(project()), "Runs on small-phone and desktop.");
  test.setTimeout(600_000);
  const phone = project() !== "desktop";
  const sizes = phone ? [[320, 568], [390, 844], [740, 360]] : [[1366, 800]];
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    for (const locale of ["en", "hy"] as const) {
      const where = `${width}×${height} ${locale}`;
      for (const id of L11_COUNTRIES) {
        await openLevel11(page, discoverAt(id), locale);
        await expectLandmarkCard(page, id, locale);
        await expect(page.getByTestId("country-card").getByRole("heading", { level: 2 })).toHaveText(locale === "en" ? NAMES[id] : NAMES_HY[id]);
        await expect(page.getByTestId("country-capital")).toContainText(locale === "en" ? CAPITALS[id] : CAPITALS_HY[id]);
        // The whole artwork, uncropped and unstretched, inside its tile.
        const art = await drawnArt(page);
        expect(art.fit).toBe("contain");
        expect(Math.abs(art.width / art.height - art.naturalRatio), `${where} ${id}: art stretched`).toBeLessThan(0.02);
        expect(art.top >= art.tile.top - 0.5 && art.bottom <= art.tile.bottom + 0.5 && art.left >= art.tile.left - 0.5 && art.right <= art.tile.right + 0.5, `${where} ${id}: art outside its tile`).toBe(true);
        // The selected country is named on the map.
        expect(await drawnNames(page, locale === "en" ? NAMES : NAMES_HY), `${where} ${id} named`).toContain(id);
        await expectNoHorizontalOverflow(page, `${where} ${id}`);
      }
      // Find, unanswered: the five whole on the map, the painted overview under all of it; Ireland answered by a tap
      // on the map itself, with room for a finger.
      await openLevel11(page, findAsking("IRL"), locale);
      // The close-up: open by default on wide maps only.
      await expect(page.getByTestId("inset-toggle")).toHaveAttribute("aria-expanded", phone ? "false" : "true");
      await expectFindSpoilerFree(page, "IRL");
      const state = await mapState(page);
      for (const c of state.countries) expect(c.margin, `${where} ${c.id} cut by the map's edge`).toBeGreaterThanOrEqual(0);
      expect(state.overviewCovers, `${where}: overview covers the map`).toBe(true);
      // Ireland's tap circle: 20 px at 320×568, 34 at 390×844, 24 at 740×360, 56 at 1366×800 (measured).
      expect(await tapRoom(page, "IRL"), `${where} IRL: room to tap`).toBeGreaterThanOrEqual(20);
      // The close-up open leaves Ireland its room: beside its toggle, along the bottom edge, on smaller maps.
      await openCloseUp(page);
      if (phone) await expect(page.locator("[data-beside]")).toHaveCount(1);
      expect(await tapRoom(page, "IRL"), `${where} IRL: room to tap with the close-up open`).toBeGreaterThanOrEqual(20);
      const [inset, ireland] = await Promise.all([page.locator(INSET).boundingBox(), page.locator(`${MAIN} path[data-country="IRL"]`).boundingBox()]);
      const apart = inset!.x >= ireland!.x + ireland!.width || ireland!.x >= inset!.x + inset!.width || inset!.y >= ireland!.y + ireland!.height || ireland!.y >= inset!.y + inset!.height;
      expect(apart, `${where}: the close-up clear of Ireland`).toBe(true);
      await tapCountry(page, "IRL");
      await expect(page.getByTestId("find-feedback")).toContainText(locale === "en" ? "Correct! That's Ireland." : "Ճիշտ է");
      // Belgium: through the close-up on phones (a 12–22 px circle on the main map), on the map itself on desktop.
      await openLevel11(page, findAsking("BEL"), locale);
      if (phone) {
        await openCloseUp(page);
        expect(await tapRoom(page, "BEL", INSET), `${where} BEL: room to tap in the close-up`).toBeGreaterThanOrEqual(30);
        await tapCountry(page, "BEL", INSET);
      } else {
        expect(await tapRoom(page, "BEL"), `${where} BEL: room to tap`).toBeGreaterThanOrEqual(30);
        await tapCountry(page, "BEL");
      }
      await expect(page.getByTestId("find-feedback")).toContainText(locale === "en" ? "Correct! That's Belgium." : "Ճիշտ է");
    }
  }
});

test("Level 11's traveller pin whole and clear of the map controls: the Continent's wrong turns and the tunnel, restored, Undo, Restart, Results", async ({ page }) => {
  test.skip(!["small-phone", "desktop"].includes(project()), "Runs on small-phone and desktop.");
  test.setTimeout(600_000);
  // Phones (320×568; 390×844; landscape, with 200% text too) and a desktop. With 200% text on a 320×568 phone (a
  // 304×150 map in English, 304×112 in Armenian), the controls are below the map in Travel and Results; in landscape
  // with 200% text, at the panel's top. No start view moves for the pin (computed: src/geo/regionMap.test.ts), and the
  // United Kingdom stays in view.
  const sizes = project() === "desktop" ? [[1366, 800, 100]] : [[320, 568, 100], [320, 568, 200], [390, 844, 100], [568, 320, 100], [568, 320, 200]];
  for (const [width, height, text] of sizes) {
    await page.setViewportSize({ width, height });
    for (const locale of ["en", "hy"] as const) {
      const where = `${width}×${height}${text === 100 ? "" : ` ${text}% text`} ${locale}`;
      const enlarge = () => text !== 100 && page.evaluate((s) => (document.documentElement.style.fontSize = `${s}%`), text);
      const placement = text !== 200 ? "on the map" : width === 320 ? "below" : "panel";
      const expectClear = async (id: string, at: string) => {
        await expect.poll(() => travellerPin(page, id), `${where}, ${at}: ${id}`).toBe("clear");
        await expect.poll(async () => (await toolbar(page)).placement, `${where}, ${at}: the zoom controls`).toBe(placement);
        const t = await toolbar(page);
        expect(t.buttons, `${where}, ${at}: the zoom buttons' size`).toBe("44×44 44×44 44×44");
        expect(t.reachable, `${where}, ${at}: the zoom buttons uncovered`).toBe(true);
        await expect.poll(async () => (await toolbar(page)).uk, `${where}, ${at}: the United Kingdom in view`).toBe(100);
      };
      // Saved journeys restored, wrong turns included.
      for (const path of [
        ["DEU", "BEL"],
        ["DEU", "LUX"],
        ["DEU", "BEL", "FRA"],
        ["DEU", "LUX", "BEL"],
        ["DEU", "FRA"],
      ]) {
        await openLevel11(page, travelAt(path), locale);
        await enlarge();
        await expectClear(path.at(-1)!, `restored ${path.join(">")}`);
      }
      // Entered from Germany; Undo and Restart.
      await openLevel11(page, travelAt(["DEU"]), locale);
      await enlarge();
      await expectClear("DEU", "start");
      await page.getByTestId("move-LUX").click();
      await expectClear("LUX", "entered");
      await page.getByTestId("move-FRA").click();
      await expectClear("FRA", "entered, out of crossings");
      await page.getByTestId("out-of-crossings").getByRole("button").first().click();
      await expectClear("LUX", "Undo");
      await page.getByTestId("travel-tools").getByRole("button").nth(2).click();
      await expectClear("DEU", "Restart");
      // Results, restored: the traveller in London.
      await openLevel11(page, ALL_DONE[L11], locale);
      await enlarge();
      await expectClear("GBR", "Results");
    }
  }
});

test("Level 11 at 320×568 with 200% text: the five whole; the selected and the traveller's country named, Belgium through the close-up; every country reachable", async ({ page }) => {
  test.skip(project() !== "small-phone", "Runs once, at 320×568.");
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(() => {
    const enlarge = () => document.documentElement && (document.documentElement.style.fontSize = "200%");
    if (!enlarge()) new MutationObserver((_, o) => enlarge() && o.disconnect()).observe(document, { childList: true });
  });
  for (const [locale, height, names] of [
    ["en", 150, NAMES],
    ["hy", 112, NAMES_HY],
  ] as const) {
    // Discover, a country selected: its name on the map, but Germany's in Armenian (304×112: its only part clear of the
    // controls' row is a strip too short for its name; the card names it). The close-up never opens by itself here
    // (`inset.autoOpen: false`): it did for the United Kingdom's and France's names, and covered Ireland.
    for (const id of ["GBR", "IRL", "FRA", "DEU"]) {
      const where = `${locale}, ${id} selected`;
      await openLevel11(page, discoverAt(id), locale);
      await expect.poll(() => page.getByTestId("map-main").evaluate((e) => Math.round(e.getBoundingClientRect().height)), `${where}: the map's height`).toBe(height);
      await expect.poll(async () => Math.min(...(await mapState(page)).countries.map((c) => c.margin)), `${where}: the five whole, with their padding`).toBeGreaterThanOrEqual(9);
      if (!(locale === "hy" && id === "DEU")) await expect.poll(() => drawnNames(page, names), `${where}: named`).toContain(id);
      await expect(page.getByTestId("inset-toggle"), `${where}: the close-up stays closed`).toHaveAttribute("aria-expanded", "false");
      expect(await tapRoom(page, "IRL"), `${where}: room to tap Ireland`).toBeGreaterThanOrEqual(10);
      await expectNoHorizontalOverflow(page, where);
    }
    await openLevel11(page, discoverAt("BEL"), locale);
    await expect(page.getByTestId("inset-toggle")).toHaveAttribute("aria-expanded", "false");
    await openCloseUp(page);
    // Its accessible name names Belgium (the visible caption is only "Close-up").
    await expect(page.getByTestId("map-inset")).toHaveAttribute("aria-label", locale === "en" ? /Belgium/ : /Բելգիա/);
    // Travel: the traveller's country named, Luxembourg too.
    for (const path of [["DEU", "FRA"], ["DEU", "LUX"]]) {
      const here = path.at(-1)!;
      await openLevel11(page, travelAt(path), locale);
      await expect.poll(() => drawnNames(page, names), `${locale}, Travel in ${here}: named`).toContain(here);
    }
    // Find: Ireland reachable with the close-up closed (it is by default; open, it covers Ireland on a map this short).
    await openLevel11(page, findAsking("IRL"), locale);
    await expect(page.getByTestId("inset-toggle")).toHaveAttribute("aria-expanded", "false");
    expect(await tapRoom(page, "IRL"), `${locale}: room to tap Ireland`).toBeGreaterThanOrEqual(10);
    await tapCountry(page, "IRL");
    await expect(page.getByTestId("find-feedback")).toContainText(locale === "en" ? "Correct! That's Ireland." : "Ճիշտ է");
    await openLevel11(page, findAsking("BEL"), locale);
    await openCloseUp(page);
    expect(await tapRoom(page, "BEL", INSET), `${locale}: room to tap Belgium in the close-up`).toBeGreaterThanOrEqual(30);
    await tapCountry(page, "BEL", INSET);
    await expect(page.getByTestId("find-feedback")).toContainText(locale === "en" ? "Correct! That's Belgium." : "Ճիշտ է");
  }
});
