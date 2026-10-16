import { expect, test, type Page } from "@playwright/test";
import { openWithSave } from "./helpers/save";

/*
 * Level 12 (Russia and its western neighbours) from Discover to Results, its unlock from Level 11 (an existing save),
 * its five landmark cards (Saint Basil's Cathedral's own artwork, supplied 2026-10-15; Finland's from Level 10,
 * Estonia's and Latvia's from Level 6, Belarus's from Level 8), Find's spoiler-free map, the Estonia → Belarus journey
 * (two shortest routes, through Latvia or Russia; Finland offered at the start, with no border with Estonia, moves
 * nothing and uses no crossing; the wrong turns, Latvia → Russia, Russia → Latvia and Russia → Finland, run out of
 * crossings, recovered by Undo, Retry or Restart), Level 11's Next level, the level selection once all twelve levels
 * are completed, and its map: Finland, Estonia, Latvia and Belarus whole (Russia by its part in the frame), every
 * country tapped on the map itself (Kaliningrad answers for Russia in Find), the traveller's pin whole and clear of
 * the map controls.
 */

const L = ["western-europe-1", "around-the-alps", "central-europe", "along-the-adriatic", "towards-greece", "baltic-journey", "iberian-journey", "eastern-europe", "heart-of-the-balkans", "nordic-countries", "across-the-channel"];
const [L1, , , , , L6, , , , , L11] = L;
const L12 = "russia-and-western-neighbours";
const L12_COUNTRIES = ["RUS", "FIN", "EST", "LVA", "BLR"];
/** Whole on the map: Russia counts in the frame only by its part within it (Saint Petersburg, Karelia, Moscow). */
const WHOLE = ["FIN", "EST", "LVA", "BLR"];
const NAMES: Record<string, string> = { RUS: "Russia", FIN: "Finland", EST: "Estonia", LVA: "Latvia", BLR: "Belarus" };
const NAMES_HY: Record<string, string> = { RUS: "Ռուսաստան", FIN: "Ֆինլանդիա", EST: "Էստոնիա", LVA: "Լատվիա", BLR: "Բելառուս" };
const CAPITALS: Record<string, string> = { RUS: "Moscow", FIN: "Helsinki", EST: "Tallinn", LVA: "Riga", BLR: "Minsk" };
const CAPITALS_HY: Record<string, string> = { RUS: "Մոսկվա", FIN: "Հելսինկի", EST: "Տալլին", LVA: "Ռիգա", BLR: "Մինսկ" };
const LANDMARKS: Record<string, string> = { RUS: "Saint Basil's Cathedral", FIN: "Olavinlinna", EST: "Tallinn Town Hall", LVA: "House of the Black Heads", BLR: "Mir Castle" };
const LANDMARKS_HY: Record<string, string> = { RUS: "Վասիլի Երանելու տաճար", FIN: "Օլավինլինա ամրոց", EST: "Տալլինի ռատուշա", LVA: "Սևագլուխների տուն", BLR: "Միրի ամրոց" };
const LANDMARK_IDS: Record<string, string> = { RUS: "saint-basils-cathedral", FIN: "olavinlinna", EST: "tallinn-town-hall", LVA: "house-of-the-black-heads", BLR: "mir-castle" };
const ALT: Record<"en" | "hy", Record<string, string>> = {
  en: {
    RUS: "Illustration of Saint Basil's Cathedral",
    FIN: "Illustration of Olavinlinna",
    EST: "Illustration of Tallinn Town Hall",
    LVA: "Illustration of the House of the Black Heads",
    BLR: "Illustration of Mir Castle",
  },
  hy: {
    RUS: "Նկարազարդում՝ Վասիլի Երանելու տաճարը",
    FIN: "Նկարազարդում՝ Օլավինլինա ամրոցը",
    EST: "Նկարազարդում՝ Տալլինի ռատուշան",
    LVA: "Նկարազարդում՝ Սևագլուխների տունը",
    BLR: "Նկարազարդում՝ Միրի ամրոցը",
  },
};
/**
 * The description in Discover, repeated by Find's second hint: the level's own for Finland, Estonia, Latvia and
 * Belarus (theirs elsewhere say "northernmost" or "in the north", wrong beside Russia); Russia's its shared one.
 */
const HINTS: Record<string, string> = {
  RUS: "The world's largest country, reaching across Asia to the Pacific. Only its western part fits on this map. Kaliningrad, on the Baltic Sea between Lithuania and Poland, is a separate part of Russia.",
  FIN: "A land of forests and lakes north of Estonia, across the Gulf of Finland.",
  EST: "The smallest country of this region, on the Gulf of Finland, with many islands.",
  LVA: "On the Baltic Sea around the Gulf of Riga, between Estonia and Belarus.",
  BLR: "A flat country with no coast, south of Latvia, with many forests, lakes and marshes.",
};
/** Names as used in a sentence (Find's feedback: "That's Russia."): here the same as the names. */
const IN_TEXT: Record<string, string> = { ...NAMES };
const NOTE = {
  en: "This journey is a map exercise along land borders, not a guide to crossing them today.",
  hy: "Այս ճանապարհորդությունը քարտեզային վարժություն է՝ ցամաքային սահմաններով, և ոչ թե այսօր դրանք հատելու ուղեցույց։",
};
const NOT_NEIGHBOUR = "There's no border between Estonia and Finland. Choose a neighbouring country.";

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
 * A save from before Level 12 existed: Levels 1–11 completed, with mixed best stars saved. Their saved Results (every
 * answer on the first try, no help) support three stars each, so the game counts 33 (README, "Saves").
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
  [L[10]]: done(["GBR", "IRL", "FRA", "BEL", "DEU"], "deu-to-gbr", ["DEU", "FRA", "GBR"], 2),
};
const EARLIER_RECENT = [...L].reverse();
const ALL_DONE = { ...EARLIER, [L12]: done(L12_COUNTRIES, "est-to-blr", ["EST", "LVA", "BLR"], 3) };
const ALL_RECENT = [L12, ...EARLIER_RECENT];
const COMPLETION = {
  en: "You've completed all 12 levels! Play any of them again whenever you like.",
  hy: "Ավարտել ես բոլոր 12 մակարդակները։ Կարող ես ցանկացածը նորից խաղալ։",
};

const discoverAt = (selected: string | null) => ({ started: true, stage: "discover", discover: { selected, explored: selected ? [selected] : [] }, records: records(false) });
const findAsking = (target: string) => ({
  started: true,
  stage: "find",
  discover: { selected: null, explored: L12_COUNTRIES },
  find: { order: [target, ...L12_COUNTRIES.filter((c) => c !== target)], index: 0, question: { target, wrongGuesses: [], hintLevel: 0, solved: false, feedback: null }, results: [], status: "asking" },
  records: records(false),
});
const travelAt = (path: string[]) => ({
  started: true,
  stage: "travel",
  discover: { selected: null, explored: L12_COUNTRIES },
  find: findDone(["EST", "RUS", "BLR", "FIN", "LVA"]),
  travel: { missionId: "est-to-blr", path, hintUsed: false, undoUsed: false },
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

/** Opens Level 12 directly in a given state, Levels 1–11 completed (its map data loads with it). */
async function openLevel12(page: Page, level12: object, locale = "en") {
  await saveV2(page, { ...EARLIER, [L12]: level12 }, { locale, screen: "lesson", levelId: L12, recent: ALL_RECENT });
  for (const id of L12_COUNTRIES) await expect(page.locator(`[data-testid="map-main"] path[data-country="${id}"]`)).toBeAttached();
}

async function expectNoHorizontalOverflow(page: Page, where = "") {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${where}: horizontal overflow`).toBeLessThanOrEqual(0);
}

const MAIN = '[data-testid="map-main"]';

/**
 * An on-screen point that hits the country's own path on the map: well inside it (its neighbours on the sampling grid
 * hit it too), nearest the middle of its hits. Russia's outline runs far off the map: only its part on screen hits.
 */
async function countryPoint(page: Page, id: string) {
  return page.evaluate((id) => {
    const path = document.querySelector(`[data-testid="map-main"] path[data-country="${id}"]`);
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
  }, id);
}

/**
 * A point of Kaliningrad, Russia's part on the Baltic between Lithuania and Poland: Russia's path west of Belarus and
 * south of Latvia (its mainland is east of both), nearest the middle of those hits, on a 1 px grid.
 */
async function kaliningradPoint(page: Page) {
  return page.evaluate(() => {
    const at = (id: string) => document.querySelector(`[data-testid="map-main"] path[data-country="${id}"]`)!;
    const [map, rus, blr, lva] = [document.querySelector('[data-testid="map-main"]')!.getBoundingClientRect(), at("RUS"), at("BLR").getBoundingClientRect(), at("LVA").getBoundingClientRect()];
    const hits: [number, number][] = [];
    for (let x = Math.ceil(map.left) + 0.5; x < blr.left; x++) for (let y = Math.ceil(lva.bottom) + 0.5; y < Math.min(blr.bottom, map.bottom); y++) if (document.elementFromPoint(x, y) === rus) hits.push([x, y]);
    if (hits.length === 0) return null;
    const cx = hits.reduce((s, h) => s + h[0], 0) / hits.length;
    const cy = hits.reduce((s, h) => s + h[1], 0) / hits.length;
    hits.sort((a, b) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy));
    return hits[0];
  });
}

async function tapAt(page: Page, point: [number, number] | null, what: string) {
  expect(point, `${what} should be tappable`).not.toBeNull();
  if (test.info().project.use.hasTouch) await page.touchscreen.tap(point![0], point![1]);
  else await page.mouse.click(point![0], point![1]);
}

async function tapCountry(page: Page, id: string) {
  await tapAt(page, await countryPoint(page, id), id);
}

/**
 * The largest circle (its diameter, px) of points that all hit the country's own path on the map: how much room a
 * finger has. Sampled on a 1 px grid over the country's box (Estonia, the smallest of the five; never Russia, whose box
 * runs far off the map).
 */
async function tapRoom(page: Page, id: string) {
  return page.evaluate((id) => {
    const path = document.querySelector(`[data-testid="map-main"] path[data-country="${id}"]`);
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
  }, id);
}

/**
 * A Level 12 landmark card, with its illustration: loaded, from its own file, with alt text naming the landmark in the
 * card's language, and the only image in the panel. Every one is below 2:1 (Saint Basil's Cathedral's 0.92; the four
 * reused, 0.84–1.84), so on phones it takes the square tile beside the country's name.
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
  }, L12_COUNTRIES);
  for (const id of L12_COUNTRIES) expect(styling[id], `${id} styled differently from the target ${target}`).toBe(styling[target]);
}

/** The four whole countries' shapes against the map's edges, and whether the painted overview covers the whole map. */
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
  }, WHOLE);

/** The names drawn on the main map (a callout on two lines counts as its name). */
const drawnNames = (page: Page, names: Record<string, string>) =>
  page.evaluate((names) => {
    const texts = [...document.querySelectorAll("[data-overlay] text")].filter((e) => e.getBoundingClientRect().width > 0).map((e) => e.textContent);
    return Object.keys(names).filter((id) => texts.some((t, i) => t === names[id] || `${t} ${texts[i + 1]}` === names[id]));
  }, names);

/** The moves offered, in the order shown (a non-neighbour option last). */
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
 * how much of Belarus's outline (its box, %), the destination's, is in view.
 */
const toolbar = (page: Page) =>
  page.evaluate(() => {
    const map = document.querySelector('[data-testid="map-main"]')!.getBoundingClientRect();
    const controls = document.querySelector('[data-testid="map-controls"]')!;
    const c = controls.getBoundingClientRect();
    const inside = c.left >= map.left - 0.5 && c.right <= map.right + 0.5 && c.top >= map.top - 0.5 && c.bottom <= map.bottom + 0.5;
    const below = Math.abs(c.top - map.bottom - 8) < 1 && Math.abs(c.right - map.right) < 1;
    const inPanel = !!document.querySelector('[data-testid="map-controls-slot"]')?.contains(controls);
    const blr = document.querySelector('[data-testid="map-main"] path[data-country="BLR"]')!.getBoundingClientRect();
    const seen = Math.max(0, Math.min(blr.right, map.right) - Math.max(blr.left, map.left)) * Math.max(0, Math.min(blr.bottom, map.bottom) - Math.max(blr.top, map.top));
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
      destination: Math.round((100 * seen) / (blr.width * blr.height)),
    };
  });

test("Level 12, Russia and its western neighbours: unlock from a Level 11 save, Discover, Find, Travel by both routes, Finland's feedback, Results, and all twelve levels completed", async ({ page }) => {
  test.skip(project() !== "mobile", "Runs once, on the Pixel 7 project; layouts are checked at other sizes below.");
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // --- Unlock: a save from before Level 12, with Levels 1–11 completed and their best stars ------------------
  await saveV2(page, EARLIER, { levelId: L11, recent: EARLIER_RECENT });
  for (const id of L) await expect(card(page, id).getByTestId("level-status")).toHaveText("Completed");
  await expect(card(page, L12).getByTestId("level-status")).toHaveText("Ready to play");
  await expect(card(page, L12)).toHaveAttribute("data-up-next", "true");
  await expect(card(page, L12)).toContainText("Russia · Finland · Estonia · Latvia · Belarus");
  await expect(card(page, L12)).toContainText("Explore European Russia and its neighbours, from Finland to Belarus.");
  // Its card's picture: Saint Basil's Cathedral's thumbnail.
  await expect(card(page, L12).locator('img[src*="saint-basils-cathedral"]')).toHaveCount(1);
  // Out of 3 per level (12 levels); Levels 1–11's saved Results support 3 each.
  await expect(page.getByTestId("continent-stars").first()).toHaveAttribute("data-max", "36");
  await expect(page.getByTestId("continent-stars").first()).toHaveAttribute("data-earned", "33");
  await expect(page.getByTestId("all-done")).toHaveCount(0);
  await expect(mainAction(page)).toHaveText(/^Start\s*Level 12 · Russia and its western neighbours$/);
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem("arimap:state")!).levels);
  await mainAction(page).click();

  // --- Discover: the five on the map itself, once its data has loaded ------------------------------------------
  await expect(page.getByTestId("discover-progress")).toContainText("0/5");
  for (const id of L12_COUNTRIES) await expect(page.locator(`${MAIN} path[data-country="${id}"]`)).toBeAttached();
  for (const id of L12_COUNTRIES) {
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
  for (const id of L) expect(after[id]).toEqual(before[id]);
  await page.getByRole("button", { name: "Start finding" }).click();

  // --- Find: five questions, each country once; spoiler-free before an answer ---------------------------------
  const asked: string[] = [];
  for (let i = 0; i < 5; i++) {
    const prompt = (await page.getByTestId("find-prompt").textContent())!;
    const target = L12_COUNTRIES.find((id) => prompt.includes(NAMES[id]))!;
    expect(target, prompt).toBeTruthy();
    asked.push(target);
    await expectFindSpoilerFree(page, target);
    if (i === 0) {
      // A wrong tap first, then the hints: the capital and landmark in words, then the description.
      const wrong = target === "BLR" ? "LVA" : "BLR";
      await tapCountry(page, wrong);
      await expect(page.getByTestId("find-feedback")).toContainText(`That's ${IN_TEXT[wrong]}. Try again.`);
      await page.getByRole("button", { name: "Hint", exact: true }).click();
      await expect(page.getByTestId("panel")).toContainText(`Its capital is ${CAPITALS[target]}.`);
      await expectNoLandmarkArt(page);
      await page.getByRole("button", { name: "More help" }).click();
      await expect(page.getByTestId("panel")).toContainText(HINTS[target]);
      await expectNoLandmarkArt(page);
    }
    await tapCountry(page, target);
    await expect(page.getByTestId("find-feedback")).toContainText(`${i === 0 ? "Found it!" : "Correct!"} That's ${IN_TEXT[target]}.`);
    await page.getByRole("button", { name: i < 4 ? "Next" : "Continue to Travel" }).click();
  }
  expect([...asked].sort()).toEqual([...L12_COUNTRIES].sort());

  // --- Travel: Estonia → Belarus in two crossings, through Latvia or Russia -----------------------------------
  await expect(page.getByRole("heading", { name: /Estonia.*Belarus/ })).toBeVisible();
  await expect(page.getByTestId("crossings-left")).toHaveText("2 crossings left");
  await expect(page.getByTestId("panel")).toContainText("Shortest route: 2 crossings");
  // The level's own note: a map exercise, not guidance on crossing these borders today.
  await expect(page.getByTestId("travel-note")).toHaveText(NOTE.en);
  // Estonia offers Latvia or Russia, and Finland beside them, a card like theirs, though it shares no border with
  // Estonia (the Gulf of Finland lies between); never Belarus.
  expect(await moves(page)).toEqual(["LVA", "RUS", "FIN"]);
  expect(await page.getByTestId("move-FIN").getAttribute("class")).toBe(await page.getByTestId("move-LVA").getAttribute("class"));
  const route = page.locator(`${MAIN} [data-testid="route-line"]`);
  // Choosing Finland, again and again: nothing moves, no crossing is used, no route is drawn; Travel says why.
  for (let i = 0; i < 2; i++) {
    await page.getByTestId("move-FIN").click();
    await expect(page.getByTestId("travel-not-neighbour")).toHaveText(NOT_NEIGHBOUR);
    await expect(page.getByTestId("crossings-left")).toHaveText("2 crossings left");
    await expect(route).toHaveCount(0);
    await expect(page.locator(`${MAIN} [data-traveller="EST"]`)).toHaveCount(1);
    // Finland is named and shown on the map in the wrong-answer colour; Estonia's neighbours are not marked.
    await expect(page.locator(`${MAIN} path[data-country="FIN"]`)).toHaveAttribute("data-tone", "wrong");
    await expect(page.locator(`${MAIN} [data-label="FIN"]`)).toHaveCount(1);
    for (const id of ["LVA", "RUS"]) await expect(page.locator(`${MAIN} path[data-country="${id}"]`)).toHaveAttribute("data-tone", "default");
    expect(await moves(page)).toEqual(["LVA", "RUS", "FIN"]);
  }
  // No help recorded for it.
  await expect(page.getByText("Help used on this journey")).toHaveCount(0);
  // Estonia → Latvia: a crossing left, Russia or Belarus; Finland is offered only at the start.
  await page.getByTestId("move-LVA").click();
  await expect(page.getByTestId("travel-not-neighbour")).toHaveCount(0);
  await expect(page.getByTestId("crossings-left")).toHaveText("1 crossing left");
  expect(await moves(page)).toEqual(["RUS", "BLR"]);
  // Tallinn, Level 6's crossing, Riga.
  await expect(route).toHaveAttribute("data-route", "EST,LVA");
  await expect(route).toHaveAttribute("data-points", "3");
  // Latvia → Russia: out of crossings short of Belarus.
  await page.getByTestId("move-RUS").click();
  await expect(page.getByTestId("out-of-crossings")).toBeVisible();
  await expect(route).toHaveAttribute("data-route", "EST,LVA,RUS");
  await expect(route).toHaveAttribute("data-points", "5");
  expect(await moves(page)).toEqual([]);
  await page.getByTestId("out-of-crossings").getByRole("button", { name: "Undo" }).click();
  await expect(page.getByTestId("crossings-left")).toHaveText("1 crossing left");
  expect(await moves(page)).toEqual(["RUS", "BLR"]);
  await page.getByTestId("travel-tools").getByRole("button", { name: "Undo" }).click();
  // Estonia → Russia: Finland, now a neighbour, Latvia or Belarus.
  await page.getByTestId("move-RUS").click();
  expect(await moves(page)).toEqual(["FIN", "LVA", "BLR"]);
  // Tallinn, the Estonia–Russia crossing, Moscow.
  await expect(route).toHaveAttribute("data-route", "EST,RUS");
  await expect(route).toHaveAttribute("data-points", "3");
  // Russia → Finland: out of crossings in Finland.
  await page.getByTestId("move-FIN").click();
  const stuck = page.getByTestId("out-of-crossings");
  await expect(stuck).toContainText("No crossings left.");
  await expect(route).toHaveAttribute("data-route", "EST,RUS,FIN");
  await expect(route).toHaveAttribute("data-points", "5");
  // A refresh keeps the journey where it ran out; Retry goes back to Estonia, Finland offered beside its neighbours again.
  await page.reload();
  await expect(route).toHaveAttribute("data-route", "EST,RUS,FIN");
  await stuck.getByRole("button", { name: "Retry" }).click();
  await expect(route).toHaveCount(0);
  expect(await moves(page)).toEqual(["LVA", "RUS", "FIN"]);
  // Russia → Latvia: the third wrong turn, then Restart.
  await page.getByTestId("move-RUS").click();
  await page.getByTestId("move-LVA").click();
  await expect(stuck).toBeVisible();
  await expect(route).toHaveAttribute("data-route", "EST,RUS,LVA");
  await expect(route).toHaveAttribute("data-points", "5");
  await stuck.getByRole("button", { name: "Undo" }).click();
  await page.getByTestId("travel-tools").getByRole("button", { name: "Restart" }).click();
  await expect(page.getByTestId("crossings-left")).toHaveText("2 crossings left");
  await expect(route).toHaveCount(0);
  // Through Latvia.
  await page.getByTestId("move-LVA").click();
  await page.getByTestId("move-BLR").click();

  // --- Results: the last level; Back to levels ------------------------------------------------
  await expect(page.getByRole("heading", { name: "Journey complete!" })).toBeVisible();
  for (const name of ["Estonia", "Latvia", "Belarus"]) await expect(page.getByTestId("result-route")).toContainText(name);
  await expect(page.getByTestId("result-route")).not.toContainText("Russia");
  await expect(page.getByTestId("result-crossings")).toContainText("2 of 2");
  await expect(page.getByTestId("result-help")).toContainText("Undo");
  // Tallinn, Level 6's crossing, Riga, Level 8's crossing, Minsk.
  await expect(route).toHaveAttribute("data-route", "EST,LVA,BLR");
  await expect(route).toHaveAttribute("data-points", "5");
  await expect(page.getByTestId("next-level")).toHaveCount(0);
  await expect(page.getByTestId("back-to-levels")).toBeVisible();
  // One answer with help (4 of 5 on the first try) and Undo used: 2 stars.
  await expect(page.getByTestId("rating-attempt")).toHaveAttribute("data-stars", "2");

  // Replay journey through Russia, Finland chosen first: still without help, so the badge.
  await page.getByRole("button", { name: "Replay journey" }).click();
  await expect(page.getByTestId("crossings-left")).toHaveText("2 crossings left");
  await page.getByTestId("move-FIN").click();
  await expect(page.getByTestId("travel-not-neighbour")).toHaveText(NOT_NEIGHBOUR);
  for (const id of ["RUS", "BLR"]) await page.getByTestId(`move-${id}`).click();
  await expect(page.getByRole("heading", { name: "Journey complete!" })).toBeVisible();
  for (const name of ["Estonia", "Russia", "Belarus"]) await expect(page.getByTestId("result-route")).toContainText(name);
  await expect(page.getByTestId("result-help")).toHaveText(/Help used\s*None/);
  // Tallinn, the Estonia–Russia crossing, Moscow, the Belarus–Russia crossing, Minsk.
  await expect(route).toHaveAttribute("data-route", "EST,RUS,BLR");
  await expect(route).toHaveAttribute("data-points", "5");
  await expect(page.getByTestId("badge")).toBeVisible();

  // --- The level selection: all twelve completed --------------------------------------------
  await page.getByTestId("back-to-levels").click();
  for (const id of [...L, L12]) await expect(card(page, id).getByTestId("level-status")).toHaveText("Completed");
  await expect(page.getByTestId("welcome-actions")).toHaveCount(0);
  await expect(page.getByTestId("all-done")).toHaveText(COMPLETION.en);
  await page.reload();
  await expect(page.getByTestId("all-done")).toHaveText(COMPLETION.en);
  expect(errors).toEqual([]);
});

test("Level 11's Next level opens Level 12; all twelve completed in Armenian", async ({ page }) => {
  test.skip(project() !== "desktop", "Runs once.");
  // Level 11 at its Results, Level 12 never started: Next level opens it at Discover.
  await saveV2(page, EARLIER, { screen: "lesson", levelId: L11, recent: EARLIER_RECENT });
  const next = page.getByTestId("next-level");
  await expect(next).toHaveAccessibleName("Next level: Level 12, Russia and its western neighbours");
  await next.click();
  await expect(page.getByTestId("discover-progress")).toContainText("0/5");
  await expect(page.locator(`${MAIN} path[data-country="EST"]`)).toBeAttached();
  await tapCountry(page, "EST");
  await expect(page.getByTestId("country-card")).toHaveAttribute("data-country", "EST");
  await page.reload();
  await expect(page.getByTestId("country-card")).toHaveAttribute("data-country", "EST");
  // Level 6's attempt keeps the version it was made on; every earlier best rating is kept, never lowered (those
  // saved below what their Results support are raised to it: 3 each), and every completion record stays.
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("arimap:state")!).levels);
  expect(saved[L6].revision).toBe(2);
  for (const id of L) {
    expect(saved[id].records.bestRating, id).toBeGreaterThanOrEqual((EARLIER as Record<string, { records: { bestRating: number } }>)[id].records.bestRating);
    expect(saved[id].records.travelDone, id).toBe(true);
  }
  // All twelve completed, in Armenian: 3 stars each.
  await saveV2(page, ALL_DONE, { locale: "hy", levelId: L12, recent: ALL_RECENT });
  await expect(card(page, L12)).toContainText("Ռուսաստանը և նրա արևմտյան հարևանները");
  await expect(card(page, L12)).toContainText("Ռուսաստան · Ֆինլանդիա · Էստոնիա · Լատվիա · Բելառուս");
  await expect(page.getByTestId("all-done")).toHaveText(COMPLETION.hy);
  await expect(page.getByTestId("continent-stars").first()).toHaveAttribute("data-earned", "36");
  await expect(page.getByTestId("continent-stars").first()).toHaveAttribute("data-max", "36");
});

test("Level 12 on phones and desktop: every card in both languages, Find with Estonia and Russia (Kaliningrad too) on the map, the four whole", async ({ page }) => {
  test.skip(!["small-phone", "desktop"].includes(project()), "Runs on small-phone and desktop.");
  test.setTimeout(600_000);
  const phone = project() !== "desktop";
  const sizes = phone ? [[320, 568], [390, 844], [740, 360]] : [[1366, 800]];
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    for (const locale of ["en", "hy"] as const) {
      const where = `${width}×${height} ${locale}`;
      const correct = (id: string) => (locale === "en" ? `Correct! That's ${IN_TEXT[id]}.` : "Ճիշտ է");
      for (const id of L12_COUNTRIES) {
        await openLevel12(page, discoverAt(id), locale);
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
      // Find, unanswered: Finland, Estonia, Latvia and Belarus whole on the map, the painted overview under all of
      // it; Estonia, the smallest, answered by a tap on the map itself (there is no close-up in this level).
      await openLevel12(page, findAsking("EST"), locale);
      await expect(page.getByTestId("inset-toggle")).toHaveCount(0);
      await expectFindSpoilerFree(page, "EST");
      const state = await mapState(page);
      for (const c of state.countries) expect(c.margin, `${where} ${c.id} cut by the map's edge`).toBeGreaterThanOrEqual(0);
      expect(state.overviewCovers, `${where}: overview covers the map`).toBe(true);
      // A floor for a finger, not a measured size (not yet measured for this level).
      expect(await tapRoom(page, "EST"), `${where} EST: room to tap`).toBeGreaterThanOrEqual(12);
      await tapCountry(page, "EST");
      await expect(page.getByTestId("find-feedback")).toContainText(correct("EST"));
      // Russia: its mainland, and Kaliningrad, a part of its shape, both answer for it.
      await openLevel12(page, findAsking("RUS"), locale);
      await tapCountry(page, "RUS");
      await expect(page.getByTestId("find-feedback")).toContainText(correct("RUS"));
      await openLevel12(page, findAsking("RUS"), locale);
      await tapAt(page, await kaliningradPoint(page), `${where} Kaliningrad`);
      await expect(page.getByTestId("find-feedback")).toContainText(correct("RUS"));
    }
  }
});

test("Level 12's traveller pin whole and clear of the map controls: the wrong turns, restored, Undo, Restart, Results", async ({ page }) => {
  test.skip(!["small-phone", "desktop"].includes(project()), "Runs on small-phone and desktop.");
  test.setTimeout(600_000);
  // Phones (320×568; 390×844; landscape, with 200% text too) and a desktop. With 200% text on a 320×568 phone (a
  // 304×150 map in English, 304×112 in Armenian), the controls are below the map in Travel and Results; in landscape
  // with 200% text, at the panel's top. Belarus, the destination, stays in view.
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
        await expect.poll(async () => (await toolbar(page)).destination, `${where}, ${at}: Belarus in view`).toBe(100);
      };
      // Saved journeys restored, wrong turns included.
      for (const path of [
        ["EST", "LVA"],
        ["EST", "RUS"],
        ["EST", "LVA", "RUS"],
        ["EST", "RUS", "LVA"],
        ["EST", "RUS", "FIN"],
      ]) {
        await openLevel12(page, travelAt(path), locale);
        await enlarge();
        await expectClear(path.at(-1)!, `restored ${path.join(">")}`);
      }
      // Entered from Estonia (Finland chosen first: the traveller stays there); Undo and Restart.
      await openLevel12(page, travelAt(["EST"]), locale);
      await enlarge();
      await expectClear("EST", "start");
      await page.getByTestId("move-FIN").click();
      await expectClear("EST", "Finland chosen");
      await page.getByTestId("move-RUS").click();
      await expectClear("RUS", "entered");
      await page.getByTestId("move-FIN").click();
      await expectClear("FIN", "entered, out of crossings");
      await page.getByTestId("out-of-crossings").getByRole("button").first().click();
      await expectClear("RUS", "Undo");
      await page.getByTestId("travel-tools").getByRole("button").nth(2).click();
      await expectClear("EST", "Restart");
      // Results, restored: the traveller in Minsk.
      await openLevel12(page, ALL_DONE[L12], locale);
      await enlarge();
      await expectClear("BLR", "Results");
    }
  }
});

test("Level 12 at 320×568 with 200% text: the four whole; the selected and the traveller's country named, Finland when chosen; every country reachable", async ({ page }) => {
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
    // Discover, a country selected: its name on the map (a callout where it does not fit), the four whole.
    for (const id of L12_COUNTRIES) {
      const where = `${locale}, ${id} selected`;
      await openLevel12(page, discoverAt(id), locale);
      await expect.poll(() => page.getByTestId("map-main").evaluate((e) => Math.round(e.getBoundingClientRect().height)), `${where}: the map's height`).toBe(height);
      await expect.poll(async () => Math.min(...(await mapState(page)).countries.map((c) => c.margin)), `${where}: the four whole, with their padding`).toBeGreaterThanOrEqual(9);
      await expect.poll(() => drawnNames(page, names), `${where}: named`).toContain(id);
      await expectNoHorizontalOverflow(page, where);
    }
    // Travel: the traveller's country named; Finland too, when chosen at the start.
    for (const path of [["EST"], ["EST", "LVA"], ["EST", "RUS"]]) {
      const here = path.at(-1)!;
      await openLevel12(page, travelAt(path), locale);
      await expect.poll(() => drawnNames(page, names), `${locale}, Travel in ${here}: named`).toContain(here);
    }
    await openLevel12(page, travelAt(["EST"]), locale);
    await page.getByTestId("move-FIN").click();
    await expect(page.getByTestId("travel-not-neighbour")).toBeVisible();
    await expect.poll(() => drawnNames(page, names), `${locale}, Finland chosen: named`).toContain("FIN");
    // Find: every country reachable on the map itself.
    for (const id of L12_COUNTRIES) {
      await openLevel12(page, findAsking(id), locale);
      await tapCountry(page, id);
      await expect(page.getByTestId("find-feedback")).toContainText(locale === "en" ? `Correct! That's ${IN_TEXT[id]}.` : "Ճիշտ է");
    }
  }
});
