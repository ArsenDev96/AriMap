import { expect, test, type Page } from "@playwright/test";
import { openWithSave } from "./helpers/save";
import { homeToEurope } from "./helpers/home";

/*
 * Level 8 (Eastern Europe) from Discover to Results, its unlock from Level 7 (an existing save), its five
 * landmark cards (Poland's and Romania's artwork shared with earlier levels; Belarus's, Ukraine's and
 * Moldova's own, supplied 2026-10-05: whole, unstretched, above the pinned button on phones, and reached by
 * scrolling with enlarged text and in short landscape), Find's hints and spoiler-free map (no artwork, even
 * after a hint names the landmark), the
 * Poland → Moldova journey (one shortest route, through Ukraine; Belarus and Romania offered too, and running
 * out of crossings there, recovered by Undo or Restart), Level 7's Next level, the level selection once all
 * eight levels are completed, and its map: framing (Crimea included, as part of Ukraine), the traveller's pin
 * in Warsaw and Chisinau, and the landscape it loads.
 */

const L1 = "western-europe-1";
const L2 = "around-the-alps";
const L3 = "central-europe";
const L4 = "along-the-adriatic";
const L5 = "towards-greece";
const L6 = "baltic-journey";
const L7 = "iberian-journey";
const L8 = "eastern-europe";
const L8_COUNTRIES = ["POL", "BLR", "UKR", "MDA", "ROU"];
const NAMES: Record<string, string> = { POL: "Poland", BLR: "Belarus", UKR: "Ukraine", MDA: "Moldova", ROU: "Romania" };
const NAMES_HY: Record<string, string> = { POL: "Լեհաստան", BLR: "Բելառուս", UKR: "Ուկրաինա", MDA: "Մոլդովա", ROU: "Ռումինիա" };
const CAPITALS: Record<string, string> = { POL: "Warsaw", BLR: "Minsk", UKR: "Kyiv", MDA: "Chisinau", ROU: "Bucharest" };
const CAPITALS_HY: Record<string, string> = { POL: "Վարշավա", BLR: "Մինսկ", UKR: "Կիև", MDA: "Քիշնև", ROU: "Բուխարեստ" };
const LANDMARKS: Record<string, string> = { POL: "Wawel Castle", BLR: "Mir Castle", UKR: "Saint Sophia Cathedral", MDA: "Soroca Fortress", ROU: "Bran Castle" };
const LANDMARKS_HY: Record<string, string> = { POL: "Վավելի ամրոց", BLR: "Միրի ամրոց", UKR: "Սուրբ Սոֆիայի տաճար", MDA: "Սորոկիի ամրոց", ROU: "Բրանի դղյակ" };
const LANDMARK_IDS: Record<string, string> = { POL: "wawel-castle", BLR: "mir-castle", UKR: "saint-sophia-cathedral", MDA: "soroca-fortress", ROU: "bran-castle" };
/** The level's own artwork (Poland's and Romania's is shared with earlier levels). */
const EASTERN_ART = ["BLR", "UKR", "MDA"];
const ALT: Record<"en" | "hy", Record<string, string>> = {
  en: {
    POL: "Illustration of Wawel Castle",
    BLR: "Illustration of Mir Castle",
    UKR: "Illustration of Saint Sophia Cathedral",
    MDA: "Illustration of Soroca Fortress",
    ROU: "Illustration of Bran Castle",
  },
  hy: {
    POL: "Նկարազարդում՝ Վավելի ամրոցը",
    BLR: "Նկարազարդում՝ Միրի ամրոցը",
    UKR: "Նկարազարդում՝ Սուրբ Սոֆիայի տաճարը",
    MDA: "Նկարազարդում՝ Սորոկիի ամրոցը",
    ROU: "Նկարազարդում՝ Բրանի դղյակը",
  },
};
/** The description in Discover, repeated by Find's second hint; Poland's and Romania's are this level's own. */
const HINTS: Record<string, string> = {
  POL: "The westernmost country of this region, with a coast on the Baltic Sea.",
  BLR: "A flat country with no coast in the north of this region, with many forests, lakes and marshes.",
  UKR: "The largest country in this region, with a long coast on the Black Sea and the Sea of Azov.",
  MDA: "A small country with no coast, between Romania and Ukraine.",
  ROU: "The southernmost country of this region, with the arc of the Carpathians and a coast on the Black Sea.",
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
  records: { ...records(true), lastFindScore: { independent: 5, total: 5 }, bestFindScore: { independent: 5, total: 5 }, bestRating: 3 },
});
/** A save from before Level 8 existed: Levels 1–7 completed, each with its best stars. */
const EARLIER = {
  [L1]: done(["FRA", "BEL", "NLD", "LUX", "DEU"], "fra-to-nld", ["FRA", "BEL", "NLD"]),
  [L2]: done(["FRA", "CHE", "DEU", "AUT", "ITA"], "fra-to-aut", ["FRA", "DEU", "AUT"]),
  [L3]: done(["DEU", "POL", "CZE", "SVK", "AUT"], "pol-to-aut", ["POL", "CZE", "AUT"]),
  [L4]: done(["ITA", "SVN", "HRV", "BIH", "MNE"], "ita-to-mne", ["ITA", "SVN", "HRV", "MNE"]),
  [L5]: done(["HUN", "ROU", "SRB", "BGR", "GRC"], "hun-to-grc", ["HUN", "ROU", "BGR", "GRC"]),
  [L6]: done(["DEU", "POL", "LTU", "LVA", "EST"], "deu-to-est", ["DEU", "POL", "LTU", "LVA", "EST"]),
  [L7]: done(["PRT", "ESP", "AND", "FRA", "ITA"], "prt-to-ita", ["PRT", "ESP", "FRA", "ITA"]),
};
const EARLIER_RECENT = [L7, L6, L5, L4, L3, L2, L1];
const L8_DONE = done(L8_COUNTRIES, "pol-to-mda", ["POL", "UKR", "MDA"]);
const ALL_DONE = { ...EARLIER, [L8]: L8_DONE };
const ALL_RECENT = [L8, ...EARLIER_RECENT];
const COMPLETION = {
  en: "You've completed all 8 levels! Play any of them again whenever you like.",
  hy: "Ավարտել ես բոլոր 8 մակարդակները։ Կարող ես ցանկացածը նորից խաղալ։",
};

const discoverAt = (selected: string | null) => ({ started: true, stage: "discover", discover: { selected, explored: selected ? [selected] : [] }, records: records(false) });
const findAsking = (target: string, hintLevel = 0) => ({
  started: true,
  stage: "find",
  discover: { selected: null, explored: L8_COUNTRIES },
  find: { order: [target, ...L8_COUNTRIES.filter((c) => c !== target)], index: 0, question: { target, wrongGuesses: [], hintLevel, solved: false, feedback: null }, results: [], status: "asking" },
  records: records(false),
});
const travellingAt = (path: string[]) => ({
  started: true,
  stage: "travel",
  discover: { selected: null, explored: L8_COUNTRIES },
  find: findDone(L8_COUNTRIES),
  travel: { missionId: "pol-to-mda", path, hintUsed: false, undoUsed: false },
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

/** Opens Level 8 directly in a given state, Levels 1–7 completed. */
async function openLevel8(page: Page, level8: object, locale = "en") {
  await saveV2(page, { ...EARLIER, [L8]: level8 }, { locale, screen: "lesson", levelId: L8, recent: ALL_RECENT });
  for (const id of L8_COUNTRIES) await expect(page.locator(`[data-testid="map-main"] path[data-country="${id}"]`)).toBeAttached();
}

async function textSize(page: Page, size: number) {
  await page.evaluate((s) => (document.documentElement.style.fontSize = s === 100 ? "" : `${s}%`), size);
  await fontsSettled(page);
}

async function expectNoHorizontalOverflow(page: Page, where = "") {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${where}: horizontal overflow`).toBeLessThanOrEqual(0);
}

async function shot(page: Page, name: string) {
  const { width, height } = page.viewportSize()!;
  await page.screenshot({ path: `screenshots/${project()}/level8-${name}-${width}x${height}.png` });
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
 * A Level 8 landmark card, with its own illustration (Poland's and Romania's shared with earlier levels): loaded,
 * from its own file, with alt text naming the landmark in the card's language, and the only image in the panel.
 * Every one is well below 2:1 (1.05–1.27:1 for the Eastern three), so on phones it takes the square tile beside
 * the country's name.
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

/**
 * Scrolls the panel until the artwork's tile ends just above the pinned button (the button covers the
 * panel's bottom, so "in view" for the browser isn't in view for the player), then checks that the whole
 * artwork shows between the panel's top and the button, unstretched and inside its tile.
 */
async function expectArtReachable(page: Page, where: string) {
  const panel = page.getByTestId("panel");
  await panel.evaluate((el) => {
    const tile = el.querySelector('[data-testid="landmark-image"]')!.closest("figure")!.querySelector("div")!.getBoundingClientRect();
    const fold = document.querySelector('[data-testid="sticky-actions"]')!.getBoundingClientRect().top;
    el.scrollBy(0, Math.max(0, tile.bottom - fold + 4));
  });
  const art = await drawnArt(page);
  const top = (await panel.boundingBox())!.y;
  const fold = (await page.getByTestId("sticky-actions").boundingBox())!.y;
  expect(art.fit, `${where}: art fit`).toBe("contain");
  expect(Math.abs(art.width / art.height - art.naturalRatio), `${where}: art stretched`).toBeLessThan(0.02);
  expect(art.top >= art.tile.top - 0.5 && art.bottom <= art.tile.bottom + 0.5 && art.left >= art.tile.left - 0.5 && art.right <= art.tile.right + 0.5, `${where}: art outside its tile`).toBe(true);
  expect(art.top, `${where}: art's top above the panel when its bottom shows`).toBeGreaterThanOrEqual(top - 0.5);
  expect(art.bottom, `${where}: art under the button`).toBeLessThanOrEqual(fold + 0.5);
}

/**
 * Every word of the card's text inside the card's padding (Belarus's «տարածաշրջանի» at 200% on a 320px phone ran
 * 1–2px into it), and none broken across lines unless it is wider than the whole line it is on.
 */
async function expectCardTextInside(page: Page, where: string) {
  const problems = await page.getByTestId("country-card").evaluate((card) => {
    const s = getComputedStyle(card);
    const b = card.getBoundingClientRect();
    const [left, right] = [b.left + parseFloat(s.borderLeftWidth) + parseFloat(s.paddingLeft), b.right - parseFloat(s.borderRightWidth) - parseFloat(s.paddingRight)];
    const out: string[] = [];
    const range = document.createRange();
    const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parent = node.parentElement!;
      const style = getComputedStyle(parent);
      // The line's width: the nearest box that isn't inline (flex items such as the capital's value are blockified).
      let block: Element = parent;
      while (getComputedStyle(block).display === "inline" && block.parentElement) block = block.parentElement;
      const line = block.getBoundingClientRect().width;
      for (const m of (node.textContent ?? "").matchAll(/\S+/g)) {
        range.setStart(node, m.index!);
        range.setEnd(node, m.index! + m[0].length);
        const rects = [...range.getClientRects()].filter((r) => r.width > 0);
        if (Math.min(...rects.map((r) => r.left)) < left - 0.5 || Math.max(...rects.map((r) => r.right)) > right + 0.5) out.push(`«${m[0]}» outside the card's padding`);
        if (new Set(rects.map((r) => Math.round(r.top))).size > 1) {
          const probe = document.createElement("span");
          probe.textContent = m[0];
          Object.assign(probe.style, { position: "absolute", visibility: "hidden", whiteSpace: "nowrap", font: style.font, letterSpacing: style.letterSpacing, textTransform: style.textTransform });
          document.body.appendChild(probe);
          if (probe.getBoundingClientRect().width <= line + 0.5) out.push(`«${m[0]}» broken though it fits ${line.toFixed(0)}px`);
          probe.remove();
        }
      }
    }
    return out;
  });
  expect(problems, `${where}: card text`).toEqual([]);
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
  }, L8_COUNTRIES);
  for (const id of L8_COUNTRIES) expect(styling[id], `${id} styled differently from the target ${target}`).toBe(styling[target]);
}

/** The country shapes against the map's edges, and whether the painted overview covers the whole map. */
const mapState = (page: Page) =>
  page.evaluate((ids) => {
    const svg = document.querySelector('[data-testid="map-main"]')!.getBoundingClientRect();
    const countries = ids.map((id) => {
      const r = document.querySelector(`[data-testid="map-main"] path[data-country="${id}"]`)!.getBoundingClientRect();
      return { id, margin: Math.min(r.left - svg.left, r.top - svg.top, svg.right - r.right, svg.bottom - r.bottom), width: r.width, height: r.height };
    });
    const overview = document.querySelector('[data-testid="map-main"] [data-family="land"] image[data-level="overview"]')!.getBoundingClientRect();
    return {
      map: { width: svg.width, height: svg.height },
      countries,
      overviewCovers: overview.left <= svg.left + 0.5 && overview.top <= svg.top + 0.5 && overview.right >= svg.right - 0.5 && overview.bottom >= svg.bottom - 0.5,
    };
  }, L8_COUNTRIES);

/** The traveller's pin as painted (its outline included) against the map's edges: room left, top, right and bottom (px). */
const pinRoom = (page: Page) =>
  page.evaluate(() => {
    const map = document.querySelector('[data-testid="map-main"]')!.getBoundingClientRect();
    const pin = document.querySelector('[data-testid="map-main"] [data-traveller] path')!;
    const r = pin.getBoundingClientRect();
    const outline = parseFloat(getComputedStyle(pin).strokeWidth) / 2;
    return [r.left - outline - map.left, r.top - outline - map.top, map.right - r.right - outline, map.bottom - r.bottom - outline];
  });

const moves = (page: Page) => page.locator('[data-testid^="move-"]').evaluateAll((els) => els.filter((e) => !e.closest("[inert]")).map((e) => e.getAttribute("data-testid")!.slice(5)).sort());

test("Level 8, Eastern Europe: unlock from a Level 7 save, Discover, Find, Travel, Results, and all eight levels completed", async ({ page }) => {
  test.skip(project() !== "mobile", "Runs once, on the Pixel 7 project; layouts are checked at other sizes below.");
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // --- Unlock: a save from before Level 8, with Levels 1–7 completed and their best stars --------------------
  await saveV2(page, EARLIER, { levelId: L7, recent: EARLIER_RECENT });
  for (const id of [L1, L2, L3, L4, L5, L6, L7]) await expect(card(page, id).getByTestId("level-status")).toHaveText("Completed");
  await expect(card(page, L8).getByTestId("level-status")).toHaveText("Ready to play");
  await expect(card(page, L8)).toHaveAttribute("data-up-next", "true");
  await expect(card(page, L8)).toContainText("Poland · Belarus · Ukraine · Moldova · Romania");
  await expect(mainAction(page)).toHaveText(/^Start\s*Level 8 · Eastern Europe$/);
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem("arimap:state")!).levels);
  await mainAction(page).click();

  // --- Discover -----------------------------------------------------------------
  await expect(page.getByTestId("discover-progress")).toContainText("0/5");
  for (const id of L8_COUNTRIES) {
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
  for (const id of [L1, L2, L3, L4, L5, L6, L7]) expect(after[id]).toEqual(before[id]);
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
      const wrong = target === "UKR" ? "BLR" : "UKR";
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
    await expect(page.getByTestId("find-feedback")).toContainText(`Correct! That's ${NAMES[target]}.`);
    await page.getByRole("button", { name: i < 4 ? "Next" : "Continue to Travel" }).click();
  }
  expect([...asked].sort()).toEqual([...L8_COUNTRIES].sort());

  // --- Travel: Poland → Moldova in two crossings ---------------------------------
  await expect(page.getByTestId("crossings-left")).toHaveText("2 crossings left");
  await expect(page.getByTestId("panel")).toContainText("Shortest route: 2 crossings");
  expect(await moves(page)).toEqual(["BLR", "UKR"]);
  // Through Belarus: real neighbours, but the crossings run out in Ukraine.
  await page.getByTestId("move-BLR").click();
  // Poland, the start, is not offered again.
  expect(await moves(page)).toEqual(["UKR"]);
  await page.getByTestId("move-UKR").click();
  const stuck = page.getByTestId("out-of-crossings");
  await expect(stuck).toContainText("No crossings left. Each move crossed a real border, but this route is longer than the shortest one.");
  await expect(page.getByTestId("crossings-left")).toHaveText("0 crossings left");
  expect(await moves(page)).toEqual([]);
  await expect(stuck.getByRole("button", { name: "Undo" })).toBeInViewport();
  await stuck.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByTestId("crossings-left")).toHaveText("1 crossing left");
  await page.getByTestId("travel-tools").getByRole("button", { name: "Restart" }).click();
  await expect(page.getByTestId("crossings-left")).toHaveText("2 crossings left");
  await page.getByTestId("move-UKR").click();
  // Ukraine offers the three others not on the route (Poland, the start, is).
  expect(await moves(page)).toEqual(["BLR", "MDA", "ROU"]);
  await page.getByTestId("move-MDA").click();

  // --- Results: the last level; Back to levels ------------------------------------------------
  await expect(page.getByRole("heading", { name: "Journey complete!" })).toBeVisible();
  for (const name of ["Poland", "Ukraine", "Moldova"]) await expect(page.getByTestId("result-route")).toContainText(name);
  await expect(page.getByTestId("result-crossings")).toContainText("2 of 2");
  await expect(page.getByTestId("result-help")).toContainText("Undo");
  const route = page.locator('[data-testid="map-main"] [data-testid="route-line"]');
  // Warsaw, the Polish–Ukrainian crossing, Kyiv, the Ukrainian–Moldovan crossing, Chisinau: straight legs.
  await expect(route).toHaveAttribute("data-route", "POL,UKR,MDA");
  await expect(route).toHaveAttribute("data-points", "5");
  await expect(page.getByTestId("next-level")).toHaveCount(0);
  await expect(page.getByTestId("back-to-levels")).toBeVisible();
  // Help was used: one star less than the best possible, rated by the existing rule.
  await expect(page.getByTestId("rating-attempt")).toHaveAttribute("data-stars", "2");

  // Replay journey without help: the badge.
  await page.getByRole("button", { name: "Replay journey" }).click();
  await expect(page.getByTestId("crossings-left")).toHaveText("2 crossings left");
  for (const id of ["UKR", "MDA"]) await page.getByTestId(`move-${id}`).click();
  await expect(page.getByTestId("badge")).toBeVisible();

  // --- The level selection: all eight completed --------------------------------------------
  await page.getByTestId("back-to-levels").click();
  for (const id of [L1, L2, L3, L4, L5, L6, L7, L8]) await expect(card(page, id).getByTestId("level-status")).toHaveText("Completed");
  await expect(page.getByTestId("welcome-actions")).toHaveCount(0);
  await expect(page.getByTestId("all-done")).toHaveText(COMPLETION.en);
  await page.reload();
  await expect(page.getByTestId("all-done")).toHaveText(COMPLETION.en);
  expect(errors).toEqual([]);
});

test("Level 7's Next level opens Level 8 (or resumes it); Home, Continue, View results, Start over and refresh keep each level's place", async ({ page }) => {
  test.skip(project() !== "desktop", "Runs once.");
  // Level 7 at its Results, Level 8 never started: Next level opens it at Discover.
  await saveV2(page, EARLIER, { screen: "lesson", levelId: L7, recent: EARLIER_RECENT });
  const next = page.getByTestId("next-level");
  await expect(next).toHaveAccessibleName("Next level: Level 8, Eastern Europe");
  await next.click();
  await expect(page.getByTestId("discover-progress")).toContainText("0/5");
  await tapCountry(page, "MDA");
  await expect(page.getByTestId("country-card")).toHaveAttribute("data-country", "MDA");
  // Home, then Continue: Level 8 where it was; a refresh there too.
  await page.getByTestId("home").click();
  await expect(page.getByTestId("continents-actions").getByRole("button")).toHaveAttribute("data-level", L8);
  await page.getByTestId("continents-actions").getByRole("button").click();
  await expect(page.getByTestId("country-card")).toHaveAttribute("data-country", "MDA");
  await page.reload();
  await expect(page.getByTestId("country-card")).toHaveAttribute("data-country", "MDA");
  // Level 7's View results reopens its Results unchanged; its Next level now resumes Level 8.
  await homeToEurope(page);
  await card(page, L7).getByTestId("level-details-toggle").click();
  await card(page, L7).getByTestId("view-results").click();
  await expect(page.getByRole("heading", { name: "Journey complete!" })).toBeVisible();
  await next.click();
  await expect(page.getByTestId("country-card")).toHaveAttribute("data-country", "MDA");
  // Start over asks, naming the level; confirming resets only Level 8.
  await homeToEurope(page);
  await card(page, L8).getByRole("button", { name: /^Start over/ }).click();
  const dialog = page.getByTestId("start-over-dialog");
  await expect(dialog.getByRole("heading")).toHaveText("Start “Eastern Europe” over?");
  await dialog.getByRole("button", { name: "Start over" }).click();
  await expect(page.getByTestId("discover-progress")).toContainText("0/5");
  await homeToEurope(page);
  for (const id of [L1, L2, L3, L4, L5, L6, L7]) await expect(card(page, id).getByTestId("level-status")).toHaveText("Completed");
  await expect(card(page, L8).getByTestId("level-status")).toHaveText("In progress: Discover");

  // All eight completed: Play again keeps every level completed; the replay is continued, not the message.
  await saveV2(page, ALL_DONE, { levelId: L8, recent: ALL_RECENT });
  await expect(page.getByTestId("all-done")).toHaveText(COMPLETION.en);
  await card(page, L8).getByTestId("level-details-toggle").click();
  await card(page, L8).getByRole("button", { name: /^Play again/ }).click();
  await expect(dialog.getByRole("heading")).toHaveText("Play “Eastern Europe” again?");
  await dialog.getByRole("button", { name: "Play again" }).click();
  await expect(page.getByTestId("discover-progress")).toContainText("0/5");
  await homeToEurope(page);
  for (const id of [L1, L2, L3, L4, L5, L6, L7, L8]) await expect(card(page, id).getByTestId("level-status")).toHaveText("Completed");
  await expect(mainAction(page)).toHaveText(/^Continue\s*Level 8 · Eastern Europe$/);
});

test("Level 8 at phone and desktop sizes: every card, unanswered Find, Travel and Results, in both languages and with enlarged text", async ({ page }) => {
  test.skip(!["small-phone", "desktop", "webkit-phone"].includes(project()), "Runs on small-phone, webkit-phone and desktop.");
  test.setTimeout(900_000);
  const phone = project() !== "desktop";
  const sizes = phone ? [[320, 568], [390, 844]] : [[1366, 800]];
  const panel = page.getByTestId("panel");
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    for (const locale of ["en", "hy"] as const) {
      for (const size of phone ? [100, 150, 200] : [100]) {
        const where = `${width}×${height} ${locale} ${size}%`;
        // Every card: at the normal size its name, capital and whole artwork above the pinned button without
        // scrolling; at any size, the artwork whole and unstretched, and every part reached by scrolling.
        for (const id of L8_COUNTRIES) {
          await openLevel8(page, discoverAt(id), locale);
          await textSize(page, size);
          await expectLandmarkCard(page, id, locale);
          await expect(page.getByTestId("country-card").getByRole("heading", { level: 2 })).toHaveText(locale === "en" ? NAMES[id] : NAMES_HY[id]);
          await expect(page.getByTestId("country-capital")).toContainText(locale === "en" ? CAPITALS[id] : CAPITALS_HY[id]);
          expect(await panel.evaluate((el) => el.scrollTop), `${where} ${id}: card opened scrolled`).toBe(0);
          await expectCardTextInside(page, `${where} ${id}`);
          const fold = (await page.getByTestId("sticky-actions").boundingBox())!.y;
          if (size === 100) {
            const panelBox = (await panel.boundingBox())!;
            for (const part of [page.getByTestId("country-card").getByRole("heading", { level: 2 }), page.getByTestId("country-capital")]) {
              const b = (await part.boundingBox())!;
              expect(b.y, `${where} ${id}: above the panel`).toBeGreaterThanOrEqual(panelBox.y);
              expect(b.y + b.height, `${where} ${id}: under the button`).toBeLessThanOrEqual(fold + 0.5);
            }
            // The whole artwork (every Mir tower and finial, every Saint Sophia cross, Soroca's whole ring and
            // river), uncropped and unstretched, inside its tile and above the button.
            const art = await drawnArt(page);
            expect(art.fit).toBe("contain");
            expect(Math.abs(art.width / art.height - art.naturalRatio), `${where} ${id}: art stretched`).toBeLessThan(0.02);
            expect(art.left, `${where} ${id}: art cut on the left`).toBeGreaterThanOrEqual(Math.max(art.tile.left, panelBox.x, 0) - 0.5);
            expect(art.right, `${where} ${id}: art cut on the right`).toBeLessThanOrEqual(Math.min(art.tile.right, panelBox.x + panelBox.width, width) + 0.5);
            expect(art.top, `${where} ${id}: art above its tile`).toBeGreaterThanOrEqual(Math.max(art.tile.top, panelBox.y) - 0.5);
            expect(art.bottom, `${where} ${id}: art under its tile`).toBeLessThanOrEqual(art.tile.bottom + 0.5);
            expect(art.bottom, `${where} ${id}: art under the button`).toBeLessThanOrEqual(fold + 0.5);
            if (phone) {
              // The square tile, beside the capital, clear of the name and capital.
              const capital = (await page.getByTestId("country-capital").boundingBox())!;
              expect(art.tile.left, `${where} ${id}: tile not beside the capital`).toBeGreaterThanOrEqual(capital.x + 0.5);
              expect(Math.round(art.tile.right - art.tile.left), `${where} ${id}: square tile`).toBe(Math.round(art.tile.bottom - art.tile.top));
            }
            if (EASTERN_ART.includes(id)) {
              console.log(`${where} ${LANDMARK_IDS[id]} drawn ${art.width.toFixed(0)}×${art.height.toFixed(0)}px`);
              await page.getByTestId("landmark-image").screenshot({ path: `screenshots/${project()}/level8-${locale}-${LANDMARK_IDS[id]}-art-${width}x${height}.png` });
            }
          } else {
            // Enlarged text: the artwork keeps its size and shape, whole in its tile, brought into view by scrolling.
            await expectArtReachable(page, `${where} ${id}`);
            if (EASTERN_ART.includes(id) && size === 200) await shot(page, `${locale}-card-${id}-text${size}-art`);
          }
          await panel.evaluate((el) => el.scrollTo(0, el.scrollHeight));
          const end = await panel.evaluate((el) => {
            const sticky = el.querySelector('[data-testid="sticky-actions"]')!.getBoundingClientRect().top;
            const card = el.querySelector('[data-testid="country-card"]')!.getBoundingClientRect().bottom;
            return card - sticky;
          });
          expect(end, `${where} ${id}: the card's end under the button`).toBeLessThanOrEqual(0.5);
          await expectNoHorizontalOverflow(page, `${where} ${id}`);
          if (size !== 150) await shot(page, `${locale}-card-${id}${size === 100 ? "" : `-text${size}`}`);
        }
        // Each illustrated country chosen on the map after the previous card was scrolled to its end: the new
        // card opens at its top (at the normal size with its whole artwork above the button; enlarged, reached
        // by scrolling).
        if (phone && (size === 100 || width === 320)) {
          await openLevel8(page, discoverAt("POL"), locale);
          await textSize(page, size);
          for (const id of EASTERN_ART) {
            await panel.evaluate((el) => el.scrollTo(0, el.scrollHeight));
            const scrolled = await panel.evaluate((el) => el.scrollTop);
            if (size !== 100) expect(scrolled, `${where}: previous card not scrolled`).toBeGreaterThan(0);
            await tapCountry(page, id);
            await expect(page.getByTestId("country-card")).toHaveAttribute("data-country", id);
            await expectLandmarkCard(page, id, locale);
            await fontsSettled(page);
            expect(await panel.evaluate((el) => el.scrollTop), `${where} ${id} chosen after scrolling ${scrolled}px: card opened scrolled`).toBe(0);
            if (size === 100) expect((await drawnArt(page)).bottom, `${where} ${id} chosen on the map: art under the button`).toBeLessThanOrEqual((await page.getByTestId("sticky-actions").boundingBox())!.y + 0.5);
            else await expectArtReachable(page, `${where} ${id} chosen on the map`);
          }
        }
        // Unanswered Find: spoiler-free, the question and hint reached.
        await openLevel8(page, findAsking("MDA"), locale);
        await textSize(page, size);
        await expectFindSpoilerFree(page, "MDA");
        await expectNoHorizontalOverflow(page, `${where} Find`);
        await shot(page, `${locale}-find${size === 100 ? "" : `-text${size}`}`);
        // After the first hint, which names the landmark: still no artwork, for each of the three.
        if (size === 100) {
          for (const target of EASTERN_ART) {
            await openLevel8(page, findAsking(target, 1), locale);
            await expect(panel).toContainText(locale === "en" ? LANDMARKS[target] : LANDMARKS_HY[target]);
            await expectFindSpoilerFree(page, target);
            await shot(page, `${locale}-find-hint-${target}`);
          }
        }
        // Travel from Poland, and out of crossings in Ukraine (through Belarus).
        await openLevel8(page, travellingAt(["POL"]), locale);
        await textSize(page, size);
        await expectNoHorizontalOverflow(page, `${where} Travel`);
        if (size === 100) {
          const s = await page.evaluate(() => {
            const panel = document.querySelector('[data-testid="panel"]')!;
            const first = [...document.querySelectorAll('[data-testid^="move-"]')].map((e) => e.getBoundingClientRect())[0];
            return { bottom: first.bottom, fold: Math.min(panel.getBoundingClientRect().bottom, window.innerHeight) };
          });
          expect(s.bottom, `${where}: first neighbour below the fold`).toBeLessThanOrEqual(s.fold + 0.5);
        }
        await shot(page, `${locale}-travel${size === 100 ? "" : `-text${size}`}`);
        await openLevel8(page, travellingAt(["POL", "BLR", "UKR"]), locale);
        await textSize(page, size);
        await expect(page.getByTestId("out-of-crossings").getByRole("button").first()).toBeVisible();
        await expectNoHorizontalOverflow(page, `${where} out of crossings`);
        // Results: the last level's action pinned and on screen.
        await saveV2(page, ALL_DONE, { locale, screen: "lesson", levelId: L8, recent: ALL_RECENT });
        await textSize(page, size);
        const back = (await page.getByTestId("back-to-levels").boundingBox())!;
        expect(back.y + back.height, `${where}: Back to levels off screen`).toBeLessThanOrEqual(height + 0.5);
        expect(back.height).toBeGreaterThanOrEqual(44);
        await expectNoHorizontalOverflow(page, `${where} Results`);
        await shot(page, `${locale}-results${size === 100 ? "" : `-text${size}`}`);
      }
    }
  }
});

test("Level 8's illustrations in short landscape: each card opens at its top beside the map, its artwork and text reached above its action", async ({ page }) => {
  test.skip(project() !== "mobile", "A phone in landscape (Chromium, Pixel 7).");
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 740, height: 360 });
  const panel = page.getByTestId("panel");
  const report: string[] = [];
  for (const locale of ["en", "hy"] as const) {
    for (const id of EASTERN_ART) {
      const where = `740×360 ${locale} ${id}`;
      await openLevel8(page, discoverAt(id), locale);
      await expectLandmarkCard(page, id, locale);
      // Side by side: the map on the left, the panel beside it.
      const [map, side] = [(await page.getByTestId("map-main").boundingBox())!, (await panel.boundingBox())!];
      expect(map.x + map.width, `${where}: map beside the panel`).toBeLessThanOrEqual(side.x + 0.5);
      expect(await panel.evaluate((el) => el.scrollTop), `${where}: card opened scrolled`).toBe(0);
      const fold = (await page.getByTestId("sticky-actions").boundingBox())!.y;
      const capital = (await page.getByTestId("country-capital").boundingBox())!;
      expect(capital.y + capital.height, `${where}: capital under the action`).toBeLessThanOrEqual(fold + 0.5);
      await expectCardTextInside(page, where);
      await shot(page, `landscape-${locale}-card-${id}`);
      await expectArtReachable(page, where);
      const art = await drawnArt(page);
      expect(Math.max(art.width, art.height), `${where}: art too small`).toBeGreaterThanOrEqual(100);
      report.push(`${where} drawn ${art.width.toFixed(0)}×${art.height.toFixed(0)}px`);
      await shot(page, `landscape-${locale}-card-${id}-art`);
      // Scrolled to its end, the whole card above the action.
      await panel.evaluate((el) => el.scrollTo(0, el.scrollHeight));
      const c = (await page.getByTestId("country-card").boundingBox())!;
      expect(c.y + c.height, `${where}: card bottom`).toBeLessThanOrEqual((await page.getByTestId("sticky-actions").boundingBox())!.y + 0.5);
      await expectNoHorizontalOverflow(page, where);
    }
    // Each chosen on the map after the previous card was scrolled to its end: the new card opens at its top.
    await openLevel8(page, discoverAt("POL"), locale);
    for (const id of EASTERN_ART) {
      await panel.evaluate((el) => el.scrollTo(0, el.scrollHeight));
      await tapCountry(page, id);
      await expect(page.getByTestId("country-card")).toHaveAttribute("data-country", id);
      await fontsSettled(page);
      expect(await panel.evaluate((el) => el.scrollTop), `740×360 ${locale} ${id} chosen on the map: card opened scrolled`).toBe(0);
    }
  }
  console.log(report.join("\n"));
});

test("Level 8's map: every country whole at every size (Crimea included), the overview covering it, and the traveller's pin whole in Warsaw and Chisinau", async ({ page }) => {
  test.skip(project() !== "desktop", "Runs once, across sizes.");
  test.setTimeout(400_000);
  const report: string[] = [];
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [412, 915],
    [740, 360],
    [844, 390],
    [1366, 800],
    [1920, 1080],
    [2560, 1080],
  ]) {
    await page.setViewportSize({ width, height });
    await openLevel8(page, discoverAt(null));
    const s = await mapState(page);
    const where = `${width}×${height}`;
    expect(s.overviewCovers, `${where}: the painted overview covers the map`).toBe(true);
    for (const c of s.countries) expect(c.margin, `${where}: ${c.id} cut`).toBeGreaterThanOrEqual(0);
    report.push(`${where}: map ${s.map.width.toFixed(0)}×${s.map.height.toFixed(0)}, smallest margin ${Math.min(...s.countries.map((c) => c.margin)).toFixed(1)}px`);
    for (const path of [["POL"], ["POL", "UKR", "MDA"]]) {
      await openLevel8(page, path.length === 1 ? travellingAt(path) : { ...L8_DONE, travel: { missionId: "pol-to-mda", path, hintUsed: false, undoUsed: false } });
      for (const r of await pinRoom(page)) expect(r, `${where}: the pin in ${path.at(-1)} cut`).toBeGreaterThanOrEqual(0);
    }
  }
  // Crimea is part of Ukraine on the map: a tap on Crimea selects Ukraine.
  await page.setViewportSize({ width: 1366, height: 800 });
  await openLevel8(page, discoverAt(null));
  const crimea = await page.evaluate(() => {
    const path = document.querySelector('[data-testid="map-main"] path[data-country="UKR"]')!;
    const r = path.getBoundingClientRect();
    // The southern part of Ukraine's shape, below the Perekop isthmus.
    for (let j = 47; j > 30; j--)
      for (let i = 20; i < 34; i++) {
        const [x, y] = [r.left + (r.width * i) / 48, r.top + (r.height * j) / 48];
        if (document.elementFromPoint(x, y) === path) return [x, y];
      }
    return null;
  });
  expect(crimea).not.toBeNull();
  await page.mouse.click(crimea![0], crimea![1]);
  await expect(page.getByTestId("country-card")).toHaveAttribute("data-country", "UKR");
  test.info().annotations.push({ type: "framing", description: report.join("; ") });
});

test("Level 8 loads its own landscape overview, and zoomed tiles only for the view; earlier levels don't load it", async ({ page }) => {
  test.skip(project() !== "mobile", "Runs once.");
  await saveV2(page, { ...EARLIER, [L8]: discoverAt(null) }, { levelId: L7, recent: EARLIER_RECENT });
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.waitForTimeout(500);
  expect(requests.filter((u) => /-(land|tone)\.[\w-]*\.?webp|\/relief\//.test(u)), "landscape on the level selection").toEqual([]);
  // Level 7: never Level 8's overview.
  await card(page, L7).getByTestId("level-details-toggle").click();
  await card(page, L7).getByRole("button", { name: /^Play again/ }).click();
  await page.getByTestId("start-over-dialog").getByRole("button", { name: "Play again" }).click();
  await expect.poll(() => requests.some((u) => /iberian-journey-land/.test(u))).toBe(true);
  expect(requests.filter((u) => /eastern-europe/.test(u)), "Level 8's overview in Level 7").toEqual([]);
  await homeToEurope(page);
  requests.length = 0;

  await card(page, L8).getByRole("button", { name: /^Continue/ }).click();
  const main = page.getByTestId("map-main");
  await expect(main.locator('[data-family="land"] image[data-level="overview"]')).toHaveCount(1);
  await expect.poll(() => requests.some((u) => /eastern-europe-land/.test(u))).toBe(true);
  await page.waitForTimeout(500);
  expect(requests.filter((u) => /(western-europe-1|around-the-alps|central-europe|along-the-adriatic|towards-greece|baltic-journey|iberian-journey)-(land|tone)/.test(u)), "another level's overview").toEqual([]);
  expect(requests.filter((u) => u.includes("/relief/")), "zoomed tiles at the whole-map view").toEqual([]);
  // A selection gives Ukraine a state colour: its overlay is loaded.
  await tapCountry(page, "UKR");
  await expect.poll(() => requests.some((u) => /eastern-europe-tone/.test(u))).toBe(true);
  // Zoomed in, sharper tiles for the visible part only.
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "Zoom in" }).click();
    await page.waitForTimeout(600);
  }
  await expect.poll(() => main.locator("[data-relief] image[data-loaded]").count()).toBeGreaterThan(0);
  expect(requests.filter((u) => u.includes("/relief/")).length).toBeGreaterThan(0);
});
