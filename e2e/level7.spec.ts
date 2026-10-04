import { expect, test, type Locator, type Page } from "@playwright/test";
import { openWithSave } from "./helpers/save";
import { homeToEurope } from "./helpers/home";

/*
 * Level 7 (Iberian Journey) from Discover to Results, its unlock from Level 6 (an existing save), its five
 * landmark cards (France's and Italy's artwork shared with earlier levels; Portugal's, Spain's and Andorra's
 * own, added 2026-10-04), Andorra on small screens (the close-up, as Luxembourg has in
 * Level 1), the Portugal → Italy journey (one shortest route; Andorra offered too), the level selection once
 * all seven levels are completed, and its map: framing, the traveller's pin in Lisbon and Rome, and the
 * landscape it loads.
 */

const L1 = "western-europe-1";
const L2 = "around-the-alps";
const L3 = "central-europe";
const L4 = "along-the-adriatic";
const L5 = "towards-greece";
const L6 = "baltic-journey";
const L7 = "iberian-journey";
const L1_ORDER = ["FRA", "BEL", "NLD", "LUX", "DEU"];
const L2_COUNTRIES = ["FRA", "CHE", "DEU", "AUT", "ITA"];
const L3_COUNTRIES = ["DEU", "POL", "CZE", "SVK", "AUT"];
const L4_COUNTRIES = ["ITA", "SVN", "HRV", "BIH", "MNE"];
const L5_COUNTRIES = ["HUN", "ROU", "SRB", "BGR", "GRC"];
const L6_COUNTRIES = ["DEU", "POL", "LTU", "LVA", "EST"];
const L7_COUNTRIES = ["PRT", "ESP", "AND", "FRA", "ITA"];
const NAMES: Record<string, string> = { Portugal: "PRT", Spain: "ESP", Andorra: "AND", France: "FRA", Italy: "ITA" };
const NAME_OF = Object.fromEntries(Object.entries(NAMES).map(([name, id]) => [id, name]));
const NAMES_HY: Record<string, string> = { PRT: "Պորտուգալիա", ESP: "Իսպանիա", AND: "Անդորրա", FRA: "Ֆրանսիա", ITA: "Իտալիա" };
const CAPITALS: Record<string, string> = { PRT: "Lisbon", ESP: "Madrid", AND: "Andorra la Vella", FRA: "Paris", ITA: "Rome" };
const CAPITALS_HY: Record<string, string> = { PRT: "Լիսաբոն", ESP: "Մադրիդ", AND: "Անդորրա լա Վելյա", FRA: "Փարիզ", ITA: "Հռոմ" };
const LANDMARKS: Record<string, string> = { PRT: "Belém Tower", ESP: "Sagrada Família", AND: "Casa de la Vall", FRA: "Eiffel Tower", ITA: "Colosseum" };
const LANDMARKS_HY: Record<string, string> = { PRT: "Բելեմի աշտարակ", ESP: "Սագրադա Ֆամիլիա", AND: "Կասա դե լա Վալ", FRA: "Էյֆելյան աշտարակ", ITA: "Կոլիզեում" };
/** In a sentence (Find's first hint). */
const LANDMARKS_IN_TEXT: Record<string, string> = { PRT: "Belém Tower", ESP: "the Sagrada Família", AND: "Casa de la Vall", FRA: "the Eiffel Tower", ITA: "the Colosseum" };
const LANDMARK_IDS: Record<string, string> = { PRT: "belem-tower", ESP: "sagrada-familia", AND: "casa-de-la-vall", FRA: "eiffel-tower", ITA: "colosseum" };
/** The level's own artwork (France's and Italy's is shared with earlier levels). */
const IBERIAN_ART = ["PRT", "ESP", "AND"];
const ALT: Record<"en" | "hy", Record<string, string>> = {
  en: {
    PRT: "Illustration of Belém Tower",
    ESP: "Illustration of the Sagrada Família",
    AND: "Illustration of Casa de la Vall",
    FRA: "Illustration of the Eiffel Tower",
    ITA: "Illustration of the Colosseum",
  },
  hy: {
    PRT: "Նկարազարդում՝ Բելեմի աշտարակը",
    ESP: "Նկարազարդում՝ Սագրադա Ֆամիլիան",
    AND: "Նկարազարդում՝ Կասա դե լա Վալը",
    FRA: "Նկարազարդում՝ Էյֆելյան աշտարակը",
    ITA: "Նկարազարդում՝ Կոլիզեումը",
  },
};
const CLOSE_UP_UNNAMED = { en: "Close-up of the marked area", hy: "Նշված տարածքը մոտիկից" };
const CLOSE_UP_NAMED = { en: "Close-up: Andorra and surroundings", hy: "Մոտիկից՝ Անդորրան և շրջակայքը" };

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
const L5_DONE = done(L5_COUNTRIES, "hun-to-grc", ["HUN", "ROU", "BGR", "GRC"]);
const L6_DONE = done(L6_COUNTRIES, "deu-to-est", ["DEU", "POL", "LTU", "LVA", "EST"]);
const L7_DONE = done(L7_COUNTRIES, "prt-to-ita", ["PRT", "ESP", "FRA", "ITA"]);
/** A save from before Level 7 existed: Levels 1–6 completed. */
const EARLIER = { [L1]: L1_DONE, [L2]: L2_DONE, [L3]: L3_DONE, [L4]: L4_DONE, [L5]: L5_DONE, [L6]: L6_DONE };
const EARLIER_RECENT = [L6, L5, L4, L3, L2, L1];
const ALL_DONE = { ...EARLIER, [L7]: L7_DONE };
const ALL_RECENT = [L7, ...EARLIER_RECENT];

const discoverAt = (selected: string | null) => ({ started: true, stage: "discover", discover: { selected, explored: selected ? [selected] : [] }, records: records(false) });
const findAsking = (target: string, hintLevel = 0) => ({
  started: true,
  stage: "find",
  discover: { selected: null, explored: L7_COUNTRIES },
  find: { order: [target, ...L7_COUNTRIES.filter((c) => c !== target)], index: 0, question: { target, wrongGuesses: [], hintLevel, solved: false, feedback: null }, results: [], status: "asking" },
  records: records(false),
});
const travellingAt = (path: string[]) => ({
  started: true,
  stage: "travel",
  discover: { selected: null, explored: L7_COUNTRIES },
  find: findDone(L7_COUNTRIES),
  travel: { missionId: "prt-to-ita", path, hintUsed: false, undoUsed: false },
  records: { ...records(false), findDone: true },
});

const project = () => test.info().project.name;
const COMPLETION = {
  en: "You've completed all 7 levels! Play any of them again whenever you like.",
  hy: "Ավարտել ես բոլոր 7 մակարդակները։ Կարող ես ցանկացածը նորից խաղալ։",
};

/** Waits until the game has mounted and shows its screen. */
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

/** Opens Level 7 directly in a given state, Levels 1–6 completed. */
async function openLevel7(page: Page, level7: object, locale = "en") {
  await saveV2(page, { ...EARLIER, [L7]: level7 }, { locale, screen: "lesson", levelId: L7, recent: ALL_RECENT });
  for (const id of L7_COUNTRIES) await expect(page.locator(`[data-testid="map-main"] path[data-country="${id}"]`)).toBeAttached();
  await expect(page.locator('[data-testid="map-main"] path[data-country="ESP"]')).toBeVisible();
}

async function shot(page: Page, name: string) {
  const { width, height } = page.viewportSize()!;
  await page.screenshot({ path: `screenshots/${project()}/level7-${name}-${width}x${height}.png` });
}

const card = (page: Page, id: string) => page.getByTestId(`level-${id}`);
const mainAction = (page: Page) => page.getByTestId("welcome-actions").getByRole("button");
const closeUp = (page: Page) => page.getByTestId("map-inset");

async function setLanguage(page: Page, lang: "English" | "Հայերեն") {
  await page.getByRole("button", { name: lang, exact: true }).first().click();
  await fontsSettled(page);
}

async function textSize(page: Page, size: number) {
  await page.evaluate((s) => (document.documentElement.style.fontSize = s === 100 ? "" : `${s}%`), size);
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
async function expectWordsWhole(locator: Locator, where: string, within?: Locator) {
  const room = within ? await within.evaluate((el) => {
    const s = getComputedStyle(el);
    return el.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
  }) : 0;
  const words = await locator.evaluate((el, room) => {
    const range = document.createRange();
    const out: { text: string; lines: number; natural: number; box: number }[] = [];
    const box = room || el.getBoundingClientRect().width;
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
        // A word in its own inline box (Find's highlighted country name) needs that box's padding too.
        const own = style.display === "inline-block" ? parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) : 0;
        out.push({ text: m[0], lines, natural: probe.getBoundingClientRect().width + own, box });
        probe.remove();
      }
    }
    return out;
  }, room);
  for (const w of words) if (w.lines > 1) expect(w.natural, `${where}: «${w.text}» broken though it fits ${w.box.toFixed(0)}px`).toBeGreaterThan(w.box + 0.5);
  expect(await locator.evaluate((el) => el.scrollWidth - el.clientWidth), `${where}: text overflows`).toBeLessThanOrEqual(1);
}

/**
 * An on-screen point that hits the country's own path (not a neighbour, label or control) on the main map or
 * in the close-up, nearest the middle of its hits; null if the country can't be hit there.
 */
async function countryPoint(page: Page, id: string, map: "map-main" | "map-inset" = "map-main") {
  return page.evaluate(
    ([id, map]) => {
      const path = document.querySelector(`[data-testid="${map}"] path[data-country="${id}"]`)!;
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

async function tapAt(page: Page, point: [number, number]) {
  if (test.info().project.use.hasTouch) await page.touchscreen.tap(point[0], point[1]);
  else await page.mouse.click(point[0], point[1]);
}

async function tapCountry(page: Page, id: string, map: "map-main" | "map-inset" = "map-main") {
  const point = await countryPoint(page, id, map);
  expect(point, `${id} should be tappable on ${map}`).not.toBeNull();
  await tapAt(page, point!);
}

/** Andorra through the close-up (opened if it is closed), as a player on a small screen does; the others on the main map. */
async function selectCountry(page: Page, id: string) {
  if (id !== "AND") return tapCountry(page, id);
  if ((await closeUp(page).count()) === 0) await page.getByTestId("inset-toggle").click();
  await expect(closeUp(page)).toBeVisible();
  await tapCountry(page, "AND", "map-inset");
}

/**
 * Map names never overlap each other, nor the map's controls or the close-up. Polled: names are placed again
 * once the close-up's new size has been observed (a frame after it opens or closes; slower in WebKit).
 */
async function expectMapTextClear(page: Page) {
  await expect.poll(() => mapTextProblems(page), { message: "map labels collide", timeout: 3000 }).toEqual([]);
}

async function mapTextProblems(page: Page) {
  return page.evaluate(() => {
    const box = (el: Element) => el.getBoundingClientRect();
    const hit = (a: DOMRect, b: DOMRect) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
    const texts = [
      ...[...document.querySelectorAll('[data-testid="map-main"] text')].map((t) => ({ name: t.textContent, b: box(t) })),
      ...[...document.querySelectorAll('[data-testid="map-main"] [data-explored-badge]')].map((g) => ({ name: `badge of ${g.parentElement?.getAttribute("data-label")}`, b: box(g) })),
    ];
    const chrome = [document.querySelector('[data-testid="map-controls"]'), document.querySelector('[data-testid="inset-toggle"]')?.parentElement].filter(Boolean) as Element[];
    const out: string[] = [];
    texts.forEach((a, i) => {
      texts.slice(i + 1).forEach((b) => hit(a.b, b.b) && out.push(`${a.name} × ${b.name}`));
      for (const c of chrome) if (hit(a.b, box(c))) out.push(`${a.name} hidden`);
    });
    return out;
  });
}

/** Each capital or landmark name on the map is nearer its own kind of marker than any other marker. */
async function expectMarkerNamesOwn(page: Page, where: string) {
  const names = await page.evaluate(
    ([capitals, landmarks]) => {
      const main = document.querySelector('[data-testid="map-main"]')!;
      const markers = [...main.querySelectorAll("[data-marker]")].map((g) => {
        const r = g.getBoundingClientRect();
        return { kind: g.getAttribute("data-marker")!, x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 };
      });
      return [...main.querySelectorAll("[data-marker-text]")].map((t) => {
        const r = t.getBoundingClientRect();
        const text = t.textContent ?? "";
        const distance = (m: { x: number; y: number }) => Math.hypot(Math.max(r.left - m.x, 0, m.x - r.right), Math.max(r.top - m.y, 0, m.y - r.bottom));
        const nearest = [...markers].sort((a, b) => distance(a) - distance(b))[0];
        return { text, kind: capitals.includes(text) ? "capital" : landmarks.includes(text) ? "landmark" : "?", nearest: nearest?.kind };
      });
    },
    [[...Object.values(CAPITALS), ...Object.values(CAPITALS_HY)], [...Object.values(LANDMARKS), ...Object.values(LANDMARKS_HY)]],
  );
  for (const n of names) expect(n.nearest, `${where}: «${n.text}» sits nearer the other marker`).toBe(n.kind);
}

/** Andorra's name is shown at most once: on the main map or in the close-up, never both. */
async function expectAndorraNamedOnce(page: Page, where: string) {
  const names = await page.evaluate((names) => {
    const count = (map: string) => [...document.querySelectorAll(`[data-testid="${map}"] text`)].filter((t) => names.includes((t.textContent ?? "").trim())).length;
    return { main: count("map-main"), inset: count("map-inset") };
  }, ["Andorra", "Անդորրա"]);
  expect(names.main + names.inset, `${where}: Andorra named ${names.main} + ${names.inset} times`).toBeLessThanOrEqual(1);
  return names;
}

/** No landmark artwork anywhere on the page (Find: the hint names the landmark in words only). */
async function expectNoLandmarkArt(page: Page) {
  await expect(page.getByTestId("landmark-image")).toHaveCount(0);
  const art = new RegExp(Object.values(LANDMARK_IDS).join("|"));
  const sources = await page.locator("img, image").evaluateAll((els) => els.map((e) => e.getAttribute("src") ?? e.getAttribute("href") ?? ""));
  expect(sources.filter((s) => art.test(s))).toEqual([]);
}

/**
 * Nothing on the map or in the close-up singles out the Find target: no names, markers, badges or callouts, no
 * state colours, no country names in accessible labels (the close-up's included), and the target's shape carries
 * exactly the same attributes as every other country's.
 */
async function expectFindSpoilerFree(page: Page, target: string, locale: "en" | "hy" = "en") {
  expect(await page.locator('[data-testid="map-main"] text, [data-testid="map-inset"] text').allTextContents()).toEqual([]);
  await expect(page.locator("[data-explored-badge], [data-flash], [data-callout], [data-marker-text], [data-marker]")).toHaveCount(0);
  expect(await page.locator('[data-testid="map-main"] path[data-tone]:not([data-tone="default"]), [data-testid="map-inset"] path[data-tone]:not([data-tone="default"])').count()).toBe(0);
  await expect(page.getByTestId("landmark-card")).toHaveCount(0);
  await expect(page.getByTestId("panel").locator("img")).toHaveCount(0);
  await expectNoLandmarkArt(page);
  if ((await closeUp(page).count()) > 0) await expect(closeUp(page)).toHaveAttribute("aria-label", CLOSE_UP_UNNAMED[locale]);
  const names = new RegExp([...Object.keys(NAMES), ...Object.values(NAMES_HY), ...Object.values(LANDMARKS), ...Object.values(CAPITALS)].join("|"));
  const labelled = await page
    .locator('[data-testid="map-main"] [aria-label], [data-testid="map-main"] title, [data-testid="map-inset"], [data-testid="map-inset"] [aria-label], [data-testid="inset-title"]')
    .evaluateAll((els, source) => els.map((e) => e.getAttribute("aria-label") ?? e.textContent ?? "").filter((l) => new RegExp(source).test(l)), names.source);
  expect(labelled).toEqual([]);
  const styling = await page.locator('[data-testid="map-main"] path[data-country]').evaluateAll((els, ids) => {
    const byCountry: Record<string, string[]> = {};
    for (const e of els) {
      const id = e.getAttribute("data-country")!;
      if (!ids.includes(id)) continue;
      const attrs = [...e.attributes].filter((a) => a.name !== "d" && a.name !== "data-country").map((a) => `${a.name}=${a.value}`);
      (byCountry[id] ??= []).push(attrs.sort().join(" "));
    }
    return Object.fromEntries(Object.entries(byCountry).map(([id, list]) => [id, list.sort().join(" | ")]));
  }, L7_COUNTRIES);
  expect(Object.keys(styling).sort()).toEqual([...L7_COUNTRIES].sort());
  for (const id of L7_COUNTRIES) expect(styling[id], `${id} styled differently from the target ${target}`).toBe(styling[target]);
}

/**
 * A Level 7 landmark card, with its own illustration (France's and Italy's shared with earlier levels): loaded,
 * from its own file, with alt text naming the landmark in the card's language, and the only image in the panel.
 * Every one is well below 2:1 (0.93–1.08:1 for the Iberian three), so on phones it takes the square tile beside
 * the country's name.
 */
async function expectLandmarkCard(page: Page, id: string, locale: "en" | "hy") {
  const figure = page.getByTestId("landmark-card");
  await expect(figure).toHaveAttribute("data-landmark", LANDMARK_IDS[id]);
  await expect(figure).toContainText(locale === "en" ? LANDMARKS[id] : LANDMARKS_HY[id]);
  // Its fact, a sentence, follows the name.
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
    el.scrollBy(0, tile.bottom - fold + 4);
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

/** The first row of Travel's neighbour cards, whole above the screen's (or panel's) bottom without scrolling. */
async function expectFirstChoiceInView(page: Page, where: string) {
  const s = await page.evaluate(() => {
    const panel = document.querySelector('[data-testid="panel"]')!;
    const moves = [...document.querySelectorAll('[data-testid^="move-"]')].map((e) => e.getBoundingClientRect());
    const row = moves.filter((b) => Math.abs(b.top - moves[0].top) < 1);
    return { rowBottom: Math.max(...row.map((b) => b.bottom)), fold: Math.min(panel.getBoundingClientRect().bottom, window.innerHeight), scrollTop: panel.scrollTop };
  });
  expect(s.scrollTop, `${where}: the panel opened scrolled`).toBe(0);
  expect(s.rowBottom, `${where}: first choice ${(s.rowBottom - s.fold).toFixed(1)}px below the screen`).toBeLessThanOrEqual(s.fold + 0.5);
}

/** Travel's neighbour cards: never cut, touch-sized, on screen. */
async function expectNeighboursClear(page: Page, where: string) {
  const buttons = await page.locator('[data-testid^="move-"]').evaluateAll((els) =>
    els.map((b) => {
      const label = b.querySelector("span")!;
      return { overflow: label.scrollWidth - label.clientWidth, height: b.getBoundingClientRect().height, right: b.getBoundingClientRect().right };
    }),
  );
  expect(buttons.length, where).toBeGreaterThan(0);
  for (const b of buttons) {
    expect(b.overflow, `${where}: a name overflows`).toBeLessThanOrEqual(1);
    expect(b.height, `${where}: touch target`).toBeGreaterThanOrEqual(44);
    expect(b.right, `${where}: off screen`).toBeLessThanOrEqual(page.viewportSize()!.width + 0.5);
  }
}

/** Where the up-next card's title and status are against the scrolling list and the action bar. */
const arrival = (page: Page) =>
  page.evaluate(() => {
    const box = (el: Element | null) => (el ? el.getBoundingClientRect() : null);
    const scroll = document.querySelector('[data-testid="welcome-scroll"]')!.getBoundingClientRect();
    const current = document.querySelector("[data-up-next]");
    const title = box(current?.querySelector("[data-level-title]") ?? null);
    const status = box(current?.querySelector('[data-testid="level-status"]') ?? null);
    const action = box(document.querySelector('[data-testid="welcome-actions"]'));
    return {
      scroll: { top: scroll.top, bottom: scroll.bottom },
      title: title && { top: title.top, bottom: title.bottom },
      status: status && { top: status.top, bottom: status.bottom },
      action: action && { top: action.top, bottom: action.bottom },
      pageScroll: document.scrollingElement?.scrollTop ?? 0,
      height: window.innerHeight,
    };
  });

/** The world layer's transform (the camera), as drawn. */
const cameraOf = (page: Page) => page.locator('[data-testid="map-main"] [data-relief]').evaluate((el) => el.parentElement!.getAttribute("transform")!);

/** The traveller's pin as painted (its white outline included) against the map's edges: room left, top, right and bottom (px). */
const pinRoom = (page: Page) =>
  page.evaluate(() => {
    const map = document.querySelector('[data-testid="map-main"]')!.getBoundingClientRect();
    const pin = document.querySelector('[data-testid="map-main"] [data-traveller] path')!;
    const r = pin.getBoundingClientRect();
    const outline = parseFloat(getComputedStyle(pin).strokeWidth) / 2;
    return [r.left - outline - map.left, r.top - outline - map.top, map.right - r.right - outline, map.bottom - r.bottom - outline];
  });

/** The country shapes against the map's edges, and whether the painted overview covers the whole map. */
const mapState = (page: Page) =>
  page.evaluate((ids) => {
    const svg = document.querySelector('[data-testid="map-main"]')!.getBoundingClientRect();
    const countries = ids.map((id) => {
      const r = document.querySelector(`[data-testid="map-main"] path[data-country="${id}"]`)!.getBoundingClientRect();
      return { id, left: r.left - svg.left, top: r.top - svg.top, right: svg.right - r.right, bottom: svg.bottom - r.bottom, width: r.width, height: r.height };
    });
    const overview = document.querySelector('[data-testid="map-main"] [data-family="land"] image[data-level="overview"]')!.getBoundingClientRect();
    return {
      map: { width: svg.width, height: svg.height },
      countries,
      overviewCovers: overview.left <= svg.left + 0.5 && overview.top <= svg.top + 0.5 && overview.right >= svg.right - 0.5 && overview.bottom >= svg.bottom - 0.5,
    };
  }, L7_COUNTRIES);

test("Level 7, Iberian Journey: unlock from a Level 6 save, Discover, Find, Travel, Results, and all seven levels completed", async ({ page }) => {
  test.skip(project() !== "mobile", "Runs once, on the Pixel 7 project; layouts are checked at other sizes below.");
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" || /hydrat/i.test(m.text())) errors.push(`console ${m.type()}: ${m.text()}`);
  });
  // A save from before Level 7 existed: Levels 1–6 completed, nothing for Level 7.
  await saveV2(page, EARLIER, { levelId: L6, recent: EARLIER_RECENT });
  await expect(card(page, L7).getByTestId("level-status")).toHaveText("Ready to play");
  await expect(card(page, L7)).toContainText("Portugal · Spain · Andorra · France · Italy");
  await expect(card(page, L7)).toContainText("Iberian Journey");
  await expect(card(page, L7)).toHaveAttribute("data-up-next", "true");
  await expect(mainAction(page)).toHaveText(/^Start\s*Level 7 · Iberian Journey$/);
  for (const id of [L1, L2, L3, L4, L5, L6]) await expect(card(page, id).getByTestId("level-status")).toHaveText("Completed");
  await expect(page.getByTestId("all-done")).toHaveCount(0);
  await mainAction(page).click();

  // --- Discover -----------------------------------------------------------------
  await expect(page.getByRole("heading", { name: "Tap a country to learn about it." })).toBeAttached();
  await expect(page.getByTestId("map-main")).toHaveAttribute("aria-label", "Map of South-western Europe");
  // The close-up, as Luxembourg's in Level 1: top-left on this phone, clear of Portugal.
  await expect(page.getByTestId("inset-toggle")).toBeVisible();
  await expect(page.getByTestId("inset-toggle").locator("..")).toHaveAttribute("data-corner", "top-left");
  await expectMapTextClear(page);
  const cardEl = page.getByTestId("country-card");
  for (const id of L7_COUNTRIES) {
    await selectCountry(page, id);
    await expect(cardEl).toHaveAttribute("data-country", id);
    await expect(cardEl.getByRole("heading", { level: 2 })).toHaveText(NAME_OF[id]);
    await expect(page.getByTestId("country-capital")).toContainText(CAPITALS[id]);
    await expectLandmarkCard(page, id, "en");
    await expectMapTextClear(page);
    await expectMarkerNamesOwn(page, `${id}`);
    await expectAndorraNamedOnce(page, `${id} selected`);
    await expectWordsWhole(cardEl.getByRole("heading", { level: 2 }), `${id} card title`);
  }
  // This level's own description for France; Andorra's and Portugal's own.
  await tapCountry(page, "FRA");
  await expect(cardEl).toContainText("north of the Pyrenees");
  await selectCountry(page, "AND");
  await expect(cardEl).toContainText("tiny landlocked country high in the Pyrenees");
  await expect(closeUp(page)).toHaveAttribute("aria-label", CLOSE_UP_NAMED.en);
  await expect(page.getByTestId("discover-progress")).toContainText("5/5");
  await setLanguage(page, "Հայերեն");
  await selectCountry(page, "AND");
  await expect(cardEl.getByRole("heading", { name: "Անդորրա" })).toBeVisible();
  await expect(page.getByTestId("country-capital")).toContainText("Անդորրա լա Վելյա");
  await expectLandmarkCard(page, "AND", "hy");
  await expect(page.getByTestId("map-main")).toHaveAttribute("aria-label", "Քարտեզ՝ Հարավարևմտյան Եվրոպա");
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
    await expect(page.getByTestId("panel")).not.toContainText(CAPITALS[target]);
    if (q === 0) {
      const wrong = target === "ESP" ? "PRT" : "ESP";
      await tapCountry(page, wrong);
      await expect(page.getByTestId("find-feedback")).toContainText("Try again.");
      await page.getByRole("button", { name: "Hint" }).click();
      await expect(page.getByTestId("panel")).toContainText(`Its capital is ${CAPITALS[target]}.`);
      await expect(page.getByTestId("panel")).toContainText(`You'll also find ${LANDMARKS_IN_TEXT[target]} there.`);
      await expectNoLandmarkArt(page);
      await expect(page.getByTestId("landmark-card")).toHaveCount(0);
      expect(await page.locator('[data-testid="map-main"] text').allTextContents()).toEqual([NAME_OF[wrong]]);
      await expect(page.locator(`[data-testid="map-main"] path[data-country="${target}"][data-tone]:not([data-tone="default"])`)).toHaveCount(0);
      await expect(page.locator("[data-marker-text]")).toHaveCount(0);
      // Home and a refresh keep the question exactly; Continue resumes it.
      await homeToEurope(page);
      await expect(mainAction(page)).toHaveText(/^Continue\s*Level 7 · Iberian Journey$/);
      await expect(card(page, L7).getByTestId("level-status")).toHaveText("In progress: Find");
      await page.reload();
      await mainAction(page).click();
      await expect(page.getByTestId("find-prompt")).toHaveText(`Find ${text}`);
      await expect(page.getByText(/Its capital is/)).toBeVisible();
    }
    // Andorra through the close-up (spoiler-free: it is there for every question), the others on the main map.
    await selectCountry(page, target);
    await expect(page.getByTestId("find-feedback")).toBeVisible();
    await expect(page.locator(`[data-testid="map-main"] path[data-country="${target}"]`)).toHaveAttribute("data-tone", /correct|assisted/);
    await page.getByRole("button", { name: q < 4 ? "Next" : "Continue to Travel" }).click();
  }
  expect([...asked].sort()).toEqual([...L7_COUNTRIES].sort());

  // --- Travel -------------------------------------------------------------------
  await expect(page.getByRole("heading", { name: /Portugal.*Italy/ })).toBeVisible();
  await expect(page.getByText("Shortest route: 3 crossings")).toBeVisible();
  const moves = async () => (await page.locator('[data-testid^="move-"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")!.slice(5)))).sort();
  const route = page.locator('[data-testid="map-main"] [data-testid="route-line"]');
  // Every real neighbour in the level, and no others: Portugal meets only Spain.
  expect(await moves()).toEqual(["ESP"]);
  await page.getByTestId("move-ESP").click();
  // Spain offers Andorra too.
  expect(await moves()).toEqual(["AND", "FRA", "PRT"]);
  // Lisbon → north of the Tagus estuary → the border → Madrid.
  await expect(route).toHaveAttribute("data-route", "PRT,ESP");
  await expect(route).toHaveAttribute("data-points", "4");
  // Through Andorra: one crossing too many, so the journey runs out in France.
  await page.getByTestId("move-AND").click();
  expect(await moves()).toEqual(["ESP", "FRA"]);
  await page.getByTestId("move-FRA").click();
  await expect(page.getByTestId("out-of-crossings")).toBeVisible();
  await page.getByTestId("out-of-crossings").getByRole("button", { name: "Undo" }).click();
  await expect(page.getByTestId("crossings-left")).toHaveText("1 crossing left");
  await page.reload();
  // A refresh keeps the journey where it was.
  await expect(route).toHaveAttribute("data-route", "PRT,ESP,AND");
  await page.getByRole("button", { name: "Restart" }).click();
  await expect(route).toHaveCount(0);
  expect(await moves()).toEqual(["ESP"]);
  await expect(page.getByText("Help used on this journey")).toBeVisible();
  await page.getByTestId("move-ESP").click();
  await page.getByTestId("move-FRA").click();
  expect(await moves()).toEqual(["AND", "ESP", "ITA"]);
  await page.getByTestId("move-ITA").click();

  // --- Results ------------------------------------------------------------------
  await expect(page.getByRole("heading", { name: "Journey complete!" })).toBeVisible();
  for (const name of ["Portugal", "Spain", "France", "Italy"]) await expect(page.getByTestId("result-route")).toContainText(name);
  await expect(page.getByTestId("result-route")).not.toContainText("Andorra");
  await expect(page.getByTestId("result-crossings")).toContainText("3 of 3");
  await expect(page.getByTestId("result-help")).toContainText("Undo");
  await expect(page.getByTestId("result-find-answers").locator("li")).toHaveCount(5);
  await expect(page.getByTestId("result-find")).toContainText("4/5");
  // Lisbon, its turning point, the crossing, Madrid, the Pyrenees, Paris, the Alps, Lunigiana, Rome.
  await expect(route).toHaveAttribute("data-route", "PRT,ESP,FRA,ITA");
  await expect(route).toHaveAttribute("data-points", "9");
  await setLanguage(page, "Հայերեն");
  await expect(page.getByRole("heading", { name: "Ճամփորդությունն ավարտվեց։" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await setLanguage(page, "English");

  // Replay journey without help: the badge.
  await page.getByRole("button", { name: "Replay journey" }).click();
  await expect(page.getByTestId("crossings-left")).toHaveText("3 crossings left");
  for (const id of ["ESP", "FRA", "ITA"]) await page.getByTestId(`move-${id}`).click();
  await expect(page.getByRole("heading", { name: "Journey complete!" })).toBeVisible();
  await expect(page.getByTestId("result-help")).toHaveText(/Help used\s*None/);
  await expect(page.getByTestId("badge")).toBeVisible();

  // The level selection: all seven levels completed. No level to start, the completion message with the
  // real count, and every level still open to play again.
  await homeToEurope(page);
  for (const id of [L1, L2, L3, L4, L5, L6, L7]) await expect(card(page, id).getByTestId("level-status")).toHaveText("Completed");
  await expect(page.getByTestId("welcome-actions")).toHaveCount(0);
  await expect(page.getByTestId("all-done")).toHaveText(COMPLETION.en);
  await expect(page.getByTestId("all-done")).toHaveAttribute("data-all-complete", "true");
  await page.reload();
  await expect(page.getByTestId("all-done")).toBeVisible();
  for (const id of [L1, L2, L3, L4, L5, L6, L7]) {
    await card(page, id).getByTestId("level-details-toggle").click();
    await expect(card(page, id).getByRole("button", { name: /^Play again/ })).toBeVisible();
    // Finished (at its Results): nothing to continue.
    await expect(card(page, id).getByRole("button", { name: /^Continue/ })).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test("Level 7: independent saves; Start over and Play again change only this level; all seven stay completed", async ({ page }) => {
  test.skip(project() !== "desktop", "Runs once.");
  // In progress in Level 7, with Level 6 being replayed: each keeps its own place.
  const l6Replaying = { ...L6_DONE, stage: "travel", travel: { missionId: "deu-to-est", path: ["DEU", "POL"], hintUsed: false, undoUsed: false } };
  await saveV2(page, { ...EARLIER, [L6]: l6Replaying, [L7]: findAsking("AND", 1) }, { levelId: L7, recent: ALL_RECENT });
  await expect(mainAction(page)).toHaveText(/^Continue\s*Level 7 · Iberian Journey$/);
  await expect(card(page, L7).getByTestId("level-status")).toHaveText("In progress: Find");
  await expect(card(page, L6).getByTestId("level-status")).toHaveText("Completed");
  await card(page, L6).getByTestId("level-details-toggle").click();
  await card(page, L6).getByRole("button", { name: /^Continue/ }).click();
  await expect(page.locator('[data-testid="map-main"] [data-testid="route-line"]')).toHaveAttribute("data-route", "DEU,POL");
  await homeToEurope(page);
  await card(page, L7).getByRole("button", { name: /^Continue/ }).click();
  await expect(page.getByTestId("find-prompt")).toHaveText("Find Andorra");
  await expect(page.getByTestId("panel")).toContainText("Its capital is Andorra la Vella.");
  await page.reload();
  await expect(page.getByTestId("find-prompt")).toHaveText("Find Andorra");
  await homeToEurope(page);

  // Start over asks, naming the level; confirming resets only Level 7.
  const dialog = page.getByTestId("start-over-dialog");
  await card(page, L7).getByRole("button", { name: /^Start over/ }).click();
  await expect(dialog.getByRole("heading")).toHaveText("Start “Iberian Journey” over?");
  await page.keyboard.press("Escape");
  await expect(card(page, L7).getByTestId("level-status")).toHaveText("In progress: Find");
  await card(page, L7).getByRole("button", { name: /^Start over/ }).click();
  await dialog.getByRole("button", { name: "Start over" }).click();
  await expect(page.getByTestId("discover-progress")).toContainText("0/5");
  await homeToEurope(page);
  for (const id of [L1, L2, L3, L4, L5, L6]) await expect(card(page, id).getByTestId("level-status")).toHaveText("Completed");
  await expect(card(page, L7).getByTestId("level-status")).toHaveText("In progress: Discover");
  await card(page, L6).getByTestId("level-details-toggle").click();
  await card(page, L6).getByRole("button", { name: /^Continue/ }).click();
  await expect(page.locator('[data-testid="map-main"] [data-testid="route-line"]')).toHaveAttribute("data-route", "DEU,POL");
  await homeToEurope(page);

  // All seven completed: playing Level 7 again keeps it (and the others) completed, and the completion
  // message stays; nothing was reset automatically.
  await saveV2(page, ALL_DONE, { levelId: L7, recent: ALL_RECENT });
  await expect(page.getByTestId("all-done")).toHaveText(COMPLETION.en);
  await card(page, L7).getByTestId("level-details-toggle").click();
  await card(page, L7).getByRole("button", { name: /^Play again/ }).click();
  await expect(dialog.getByRole("heading")).toHaveText("Play “Iberian Journey” again?");
  await dialog.getByRole("button", { name: "Play again" }).click();
  await expect(page.getByTestId("discover-progress")).toContainText("0/5");
  await homeToEurope(page);
  for (const id of [L1, L2, L3, L4, L5, L6, L7]) await expect(card(page, id).getByTestId("level-status")).toHaveText("Completed");
  // The replay is an attempt under way: the main action continues it, in place of the completion message.
  await expect(page.getByTestId("welcome-actions").getByRole("button")).toHaveText(/^Continues*Level 7 · Iberian Journey$/);
  await expect(page.getByTestId("all-done")).toHaveCount(0);
  // Level 6 played again keeps Level 7 open.
  await card(page, L6).getByTestId("level-details-toggle").click();
  await card(page, L6).getByRole("button", { name: /^Play again/ }).click();
  await dialog.getByRole("button", { name: "Play again" }).click();
  await homeToEurope(page);
  await page.reload();
  await expect(card(page, L7).getByTestId("level-status")).toHaveText("Completed");
  await card(page, L7).getByTestId("level-details-toggle").click();
  await expect(card(page, L7).getByRole("button", { name: /^Continue/ })).toBeVisible();
});

/* The level selection on arrival at phone sizes, in both languages and with enlarged text: Level 7's title and
   status in view below the six completed levels; then all seven completed. */
test("Level 7 on the level selection: its title and status in view on arrival; all seven completed", async ({ page }) => {
  test.skip(!["small-phone", "desktop", "webkit-phone"].includes(project()), "Runs on small-phone, webkit-phone and desktop.");
  test.setTimeout(600_000);
  const sizes = project() === "desktop" ? [[1366, 800]] : project() === "webkit-phone" ? [[320, 568]] : [[320, 568], [390, 844]];
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    for (const locale of ["en", "hy"] as const) {
      for (const size of project() === "desktop" ? [100] : [100, 150, 200]) {
        const where = `${width}×${height} ${locale} ${size}%`;
        // Arriving with the text size already set: from inside Level 6, by Home.
        await saveV2(page, EARLIER, { locale, screen: "lesson", levelId: L6, recent: EARLIER_RECENT });
        await textSize(page, size);
        await homeToEurope(page);
        await expect(page.getByTestId("welcome")).toBeVisible();
        await fontsSettled(page);
        await expect(card(page, L7)).toHaveAttribute("data-up-next", "true");
        await expect(mainAction(page)).toHaveAttribute("data-level", L7);
        const at = await arrival(page);
        expect(at.pageScroll, `${where}: the page scrolled`).toBe(0);
        expect(at.title, where).not.toBeNull();
        expect(at.title!.top, `${where}: Level 7's title above the list`).toBeGreaterThanOrEqual(at.scroll.top - 0.5);
        expect(at.title!.bottom, `${where}: Level 7's title under the list`).toBeLessThanOrEqual(at.scroll.bottom + 0.5);
        if (size === 100) expect(at.status!.bottom, `${where}: Level 7's status hidden`).toBeLessThanOrEqual(at.scroll.bottom + 0.5);
        expect(at.scroll.bottom, `${where}: list under the action`).toBeLessThanOrEqual(at.action!.top + 0.5);
        expect(at.action!.bottom, `${where}: action off screen`).toBeLessThanOrEqual(at.height + 0.5);
        await expectWordsWhole(card(page, L7).locator("[data-level-title]"), `${where} Level 7 title`);
        await expectNoHorizontalOverflow(page);
        await shot(page, `${locale}-levels-unlocked-text${size}`);
        await textSize(page, 100);
      }

      // All seven completed: the completion message with the real count, nothing to start.
      await saveV2(page, ALL_DONE, { locale, recent: ALL_RECENT, levelId: L7 });
      await expect(page.getByTestId("all-done")).toHaveText(COMPLETION[locale]);
      await expect(page.getByTestId("welcome-actions")).toHaveCount(0);
      await expectWordsWhole(page.getByTestId("all-done").locator("span"), `${width}×${height} ${locale} completion message`);
      await expectNoHorizontalOverflow(page);
      await shot(page, `${locale}-levels-all-completed`);
      await page.getByTestId("welcome-scroll").evaluate((el) => el.scrollTo(0, el.scrollHeight));
      await card(page, L7).getByTestId("level-details-toggle").click();
      await expect(card(page, L7).getByRole("button", { name: locale === "en" ? /^Play again/ : /^Խաղալ նորից/ })).toBeVisible();
      await shot(page, `${locale}-levels-all-completed-l7-opened`);
    }
  }
});

/* Screens at a short and an ordinary phone (small-phone, Chromium; webkit-phone, WebKit) and on desktop, in both
   languages: each Discover card with its illustration, unanswered Find and each new landmark's hint, Travel and
   Results; enlarged text on phones, and each card opened at its top after the previous one was scrolled. */
test("Level 7 at phone and desktop sizes: every card, unanswered Find, Travel and Results", async ({ page }) => {
  test.skip(!["small-phone", "desktop", "webkit-phone"].includes(project()), "Runs on small-phone, webkit-phone and desktop.");
  test.setTimeout(900_000);
  const phone = project() !== "desktop";
  const sizes = project() === "desktop" ? [[1366, 800]] : project() === "webkit-phone" ? [[320, 568], [390, 664]] : [[320, 568], [390, 844]];
  const panel = page.getByTestId("panel");
  const box = async (testId: string) => (await page.getByTestId(testId).boundingBox())!;
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    for (const locale of ["en", "hy"] as const) {
      const where = (what: string) => `${width}×${height} ${locale} ${what}`;

      // Discover: each country's card, with its illustration.
      const squareArt = Math.min(Math.max(112, 0.33 * width), 132) - 12;
      for (const id of L7_COUNTRIES) {
        await openLevel7(page, discoverAt(id), locale);
        await expect(page.getByTestId("country-card")).toHaveAttribute("data-country", id);
        await expectLandmarkCard(page, id, locale);
        const title = page.getByTestId("country-card").locator("h2");
        await expect(title).toHaveText(locale === "en" ? NAME_OF[id] : NAMES_HY[id]);
        await expect(page.getByTestId("country-capital")).toContainText(locale === "en" ? CAPITALS[id] : CAPITALS_HY[id]);
        await expectWordsWhole(title, where(`${id} title`), page.getByTestId("country-card"));
        await expectWordsWhole(page.getByTestId("country-capital"), where(`${id} capital`), page.getByTestId("country-card"));
        await expectWordsWhole(page.getByTestId("landmark-card").locator("figcaption"), where(`${id} landmark`));
        expect(await panel.evaluate((el) => el.scrollTop), where(`${id} card opened scrolled`)).toBe(0);
        // Without scrolling: the name, the capital and the whole artwork, above the pinned button, uncropped
        // (Belém's turrets and water, every Sagrada Família spire tip, Casa de la Vall's turret) and unstretched.
        const fold = (await box("sticky-actions")).y;
        const panelBox = await box("panel");
        for (const part of [title, page.getByTestId("country-capital")]) {
          const b = (await part.boundingBox())!;
          expect(b.y, where(`${id} ${await part.textContent()} above the panel`)).toBeGreaterThanOrEqual(panelBox.y);
          expect(b.y + b.height, where(`${id} ${await part.textContent()} under the button`)).toBeLessThanOrEqual(fold + 1);
        }
        const art = await drawnArt(page);
        expect(art.fit).toBe("contain");
        expect(Math.abs(art.width / art.height - art.naturalRatio), where(`${id} art stretched`)).toBeLessThan(0.02);
        expect(art.left, where(`${id} art cut on the left`)).toBeGreaterThanOrEqual(Math.max(art.tile.left, panelBox.x, 0) - 0.5);
        expect(art.right, where(`${id} art cut on the right`)).toBeLessThanOrEqual(Math.min(art.tile.right, panelBox.x + panelBox.width, width) + 0.5);
        expect(art.top, where(`${id} art above its tile`)).toBeGreaterThanOrEqual(Math.max(art.tile.top, panelBox.y) - 0.5);
        expect(art.bottom, where(`${id} art under its tile`)).toBeLessThanOrEqual(art.tile.bottom + 0.5);
        expect(art.bottom, where(`${id} art under the button`)).toBeLessThanOrEqual(fold + 1);
        expect(Math.max(art.width, art.height), where(`${id} art too small`)).toBeGreaterThanOrEqual(phone ? squareArt - 0.5 : 96);
        if (phone) {
          // The square tile, beside the capital (and the name, when it fits beside it), clear of both.
          const capital = (await page.getByTestId("country-capital").boundingBox())!;
          expect(art.tile.left, where(`${id} tile not beside the capital`)).toBeGreaterThanOrEqual(capital.x + 0.5);
          expect(Math.round(art.tile.right - art.tile.left), where(`${id} square tile`)).toBe(Math.round(art.tile.bottom - art.tile.top));
          for (const part of [title, page.getByTestId("country-capital")]) {
            const b = (await part.boundingBox())!;
            const apart = b.x + b.width <= art.tile.left + 0.5 || b.y >= art.tile.bottom - 0.5 || b.y + b.height <= art.tile.top + 0.5;
            expect(apart, where(`${id} «${await part.textContent()}» runs into the artwork`)).toBe(true);
          }
        }
        if (IBERIAN_ART.includes(id)) {
          // The artwork at its real size on the page, for review.
          console.log(`${where(LANDMARK_IDS[id])} drawn ${art.width.toFixed(0)}×${art.height.toFixed(0)}px`);
          await page.getByTestId("landmark-image").screenshot({ path: `screenshots/${project()}/level7-${locale}-${LANDMARK_IDS[id]}-art-${width}x${height}.png` });
        }
        await expectMapTextClear(page);
        await expectMarkerNamesOwn(page, where(`${id} map`));
        await expectAndorraNamedOnce(page, where(`${id} selected`));
        await expectNoHorizontalOverflow(page);
        await shot(page, `${locale}-discover-${id}`);
        // Scrolled to its end, the whole card sits above the pinned button.
        await panel.evaluate((el) => el.scrollTo(0, el.scrollHeight));
        const c = await box("country-card");
        expect(c.y + c.height, where(`${id} card bottom`)).toBeLessThanOrEqual((await box("sticky-actions")).y + 1);
        if (IBERIAN_ART.includes(id)) await shot(page, `${locale}-discover-${id}-scrolled`);
      }
      // At normal text size on phones, each new country chosen in turn after the previous card was scrolled to its
      // end: the new card opens at its top, with its whole artwork above the pinned button.
      if (phone) {
        await openLevel7(page, discoverAt("FRA"), locale);
        for (const id of IBERIAN_ART) {
          await panel.evaluate((el) => el.scrollTo(0, el.scrollHeight));
          const scrolled = await panel.evaluate((el) => el.scrollTop);
          await selectCountry(page, id);
          await expect(page.getByTestId("country-card")).toHaveAttribute("data-country", id);
          await expectLandmarkCard(page, id, locale);
          await fontsSettled(page);
          expect(await panel.evaluate((el) => el.scrollTop), where(`${id} chosen after scrolling ${scrolled}px: card opened scrolled`)).toBe(0);
          const art = await drawnArt(page);
          expect(art.bottom, where(`${id} chosen on the map: art under the button`)).toBeLessThanOrEqual((await box("sticky-actions")).y + 1);
        }
      }

      // Find, unanswered (asking for Andorra, and for Portugal: the map and close-up look the same), and after its first hint.
      for (const target of ["AND", "PRT"]) {
        await openLevel7(page, findAsking(target), locale);
        await expectFindSpoilerFree(page, target, locale);
        await expectWordsWhole(page.getByTestId("find-prompt"), where("Find prompt"));
        await expectNoHorizontalOverflow(page);
        await shot(page, `${locale}-find-${target}`);
      }
      // After the first hint, which names the landmark: still no artwork, for each of the three.
      for (const target of IBERIAN_ART) {
        await openLevel7(page, findAsking(target, 1), locale);
        await expect(panel).toContainText(locale === "en" ? LANDMARKS[target] : LANDMARKS_HY[target]);
        await expectFindSpoilerFree(page, target, locale);
        await shot(page, `${locale}-find-hint-${target}`);
      }

      // Travel: at the start, and in Spain (three choices, Andorra among them). The first choice whole without scrolling on phones.
      for (const path of [["PRT"], ["PRT", "ESP"]]) {
        await openLevel7(page, travellingAt(path), locale);
        await expect(page.locator('[data-testid^="move-"]').first()).toBeVisible();
        await fontsSettled(page);
        if (phone) await expectFirstChoiceInView(page, where(`Travel at ${path.at(-1)}`));
        await expectNeighboursClear(page, where(`Travel at ${path.at(-1)}`));
        await expectMapTextClear(page);
        await expectNoHorizontalOverflow(page);
        await shot(page, `${locale}-travel-${path.at(-1)}`);
      }

      // Results.
      await openLevel7(page, L7_DONE, locale);
      await expect(page.getByTestId("result-crossings")).toContainText("3");
      await expect(page.locator('[data-testid="map-main"] [data-testid="route-line"]')).toHaveAttribute("data-points", "9");
      await expectNoHorizontalOverflow(page);
      await shot(page, `${locale}-results`);
    }
  }

  // Enlarged text (phones): the text grows, nothing is cut, and everything is reached by scrolling.
  if (!phone) return;
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    for (const locale of ["en", "hy"] as const) {
      for (const id of IBERIAN_ART) {
        await openLevel7(page, discoverAt(id), locale);
        for (const size of [150, 200]) {
          const where = `${width}×${height} ${locale} ${id} ${size}%`;
          await textSize(page, size);
          const title = page.getByTestId("country-card").locator("h2");
          expect(parseFloat(await title.evaluate((el) => getComputedStyle(el).fontSize)), where).toBeGreaterThanOrEqual(((width < 420 ? 1.2 : 1.45) * 16 * size) / 100 - 0.5);
          await expectWordsWhole(title, `${where} title`);
          await expectWordsWhole(page.getByTestId("country-capital"), `${where} capital`);
          await expectWordsWhole(page.getByTestId("landmark-card").locator("figcaption"), `${where} landmark`);
          await shot(page, `${locale}-discover-${id}-text${size}`);
          // The artwork keeps its size and shape, whole in its tile, and is brought into view by scrolling.
          await expectArtReachable(page, where);
          await shot(page, `${locale}-discover-${id}-text${size}-art`);
          await panel.evaluate((el) => el.scrollTo(0, el.scrollHeight));
          const c = await box("country-card");
          expect(c.y + c.height, `${where}: card bottom`).toBeLessThanOrEqual((await box("sticky-actions")).y + 1);
          await expectNoHorizontalOverflow(page);
          await shot(page, `${locale}-discover-${id}-text${size}-end`);
          await panel.evaluate((el) => el.scrollTo(0, 0));
        }
        await textSize(page, 100);
      }
      // At 200% on the short phone, each new country chosen in turn after the previous card was scrolled to its
      // end: the new card opens at its top, and its artwork and the whole card are reached by scrolling.
      if (width === 320) {
        await openLevel7(page, discoverAt("FRA"), locale);
        await textSize(page, 200);
        for (const id of IBERIAN_ART) {
          const where = `${width}×${height} ${locale} 200% ${id} chosen on the map`;
          await panel.evaluate((el) => el.scrollTo(0, el.scrollHeight));
          expect(await panel.evaluate((el) => el.scrollTop), `${where}: previous card not scrolled`).toBeGreaterThan(0);
          await selectCountry(page, id);
          await expect(page.getByTestId("country-card")).toHaveAttribute("data-country", id);
          await expectLandmarkCard(page, id, locale);
          await fontsSettled(page);
          expect(await panel.evaluate((el) => el.scrollTop), `${where}: card opened scrolled`).toBe(0);
          await expectArtReachable(page, where);
          await panel.evaluate((el) => el.scrollTo(0, el.scrollHeight));
          const c = await box("country-card");
          expect(c.y + c.height, `${where}: card bottom`).toBeLessThanOrEqual((await box("sticky-actions")).y + 1);
        }
        await textSize(page, 100);
      }
      // Find and Travel at 200%: names wrap between words only; every choice and tool reached by scrolling.
      await openLevel7(page, findAsking("AND"), locale);
      await textSize(page, 200);
      await expectWordsWhole(page.getByTestId("find-prompt"), `${width}×${height} ${locale} Find 200%`);
      await expectNoHorizontalOverflow(page);
      // The close-up's toggle stays reachable on the shorter map.
      await expect(page.getByTestId("inset-toggle")).toBeInViewport();
      await shot(page, `${locale}-find-text200`);
      await textSize(page, 100);
      await openLevel7(page, travellingAt(["PRT", "ESP"]), locale);
      await textSize(page, 200);
      await expectNeighboursClear(page, `${width}×${height} ${locale} Travel 200%`);
      await panel.evaluate((el) => el.scrollTo(0, el.scrollHeight));
      const tools = (await page.getByTestId("travel-tools").boundingBox())!;
      const p = (await panel.boundingBox())!;
      expect(tools.y + tools.height, `${width}×${height} ${locale} Travel 200%: tools under the panel`).toBeLessThanOrEqual(Math.min(p.y + p.height, height) + 0.5);
      for (const id of ["AND", "FRA", "PRT"]) await expect(page.getByTestId(`move-${id}`)).toBeAttached();
      await expectNoHorizontalOverflow(page);
      await shot(page, `${locale}-travel-text200`);
      await textSize(page, 100);
    }
  }
});

/* Andorra on a 320px phone: its real outline is about 3.5 × 3 px at the whole-map view, so it is selected through
   the close-up (or by zooming in). Discover and unanswered Find; the close-up sits top-left, clear of Portugal and of
   the other names; Andorra's name appears once; the close-up never names the Find target; the player's choice to
   open or close it holds. */
test("Andorra on a 320px phone: selected through the close-up or by zooming in, in Discover and unanswered Find", async ({ page }) => {
  test.skip(!["small-phone", "webkit-phone"].includes(project()), "Runs on the phone projects.");
  test.setTimeout(400_000);
  await page.setViewportSize({ width: 320, height: 568 });
  const toggle = page.getByTestId("inset-toggle");
  for (const locale of ["en", "hy"] as const) {
    const where = (what: string) => `320×568 ${locale} ${what}`;
    // Discover, nothing selected: Andorra's outline on the main map is tiny; its name nearby or in the close-up.
    await openLevel7(page, discoverAt(null), locale);
    // Once the map has taken its start view (it is drawn at scale 1 for a moment as it sets up).
    const andorraPath = page.locator('[data-testid="map-main"] path[data-country="AND"]');
    await expect.poll(async () => Math.max(...Object.values((await andorraPath.boundingBox())!).slice(2)), { message: where("Andorra's size on the main map") }).toBeLessThan(8);
    await page.waitForTimeout(300);
    const andorra = (await andorraPath.boundingBox())!;
    console.log(`${where("Andorra on the main map")}: ${andorra.width.toFixed(1)}×${andorra.height.toFixed(1)}px`);
    await expect(toggle.locator("..")).toHaveAttribute("data-corner", "top-left");
    await expectAndorraNamedOnce(page, where("nothing selected"));
    await expectMapTextClear(page);
    await shot(page, `${locale}-andorra-discover-start`);

    // Open the close-up: Andorra drawn large, its true outline, clear of Portugal and Lisbon.
    if ((await closeUp(page).count()) === 0) await toggle.click();
    await expect(closeUp(page)).toBeVisible();
    const inset = (await closeUp(page).boundingBox())!;
    const big = (await page.locator('[data-testid="map-inset"] path[data-country="AND"]').boundingBox())!;
    console.log(`${where("Andorra in the close-up")}: ${big.width.toFixed(1)}×${big.height.toFixed(1)}px in a ${inset.width.toFixed(0)}×${inset.height.toFixed(0)}px close-up`);
    expect(Math.min(big.width, big.height), where("Andorra in the close-up")).toBeGreaterThanOrEqual(20);
    expect(big.x >= inset.x && big.x + big.width <= inset.x + inset.width && big.y >= inset.y && big.y + big.height <= inset.y + inset.height, where("Andorra whole in the close-up")).toBe(true);
    const panelBox = (await page.getByTestId("inset-toggle").locator("..").boundingBox())!;
    const lisbon = await page.evaluate(() => {
      const p = document.querySelector('[data-testid="map-main"] path[data-country="PRT"]')!.getBoundingClientRect();
      return { left: p.left, right: p.right, top: p.top, bottom: p.bottom };
    });
    // Portugal's south half (Lisbon is at 70% of its height) stays clear of the open close-up.
    expect(panelBox.y + panelBox.height, where("the close-up covers Lisbon")).toBeLessThan(lisbon.top + (lisbon.bottom - lisbon.top) * 0.6);
    // The dashed area on the main map marks where the close-up is, around Andorra.
    await expect(page.locator('[data-testid="map-main"] [data-testid="inset-area"]')).toHaveCount(1);
    await expectAndorraNamedOnce(page, where("close-up open"));
    await expectMapTextClear(page);
    await shot(page, `${locale}-andorra-closeup-open`);
    await tapCountry(page, "AND", "map-inset");
    await expect(page.getByTestId("country-card")).toHaveAttribute("data-country", "AND");
    await expect(closeUp(page)).toHaveAttribute("aria-label", CLOSE_UP_NAMED[locale]);
    await expectAndorraNamedOnce(page, where("Andorra selected"));
    await expectMapTextClear(page);
    await expectMarkerNamesOwn(page, where("Andorra selected"));
    await shot(page, `${locale}-andorra-closeup-selected`);
    // Closed by the player: it stays closed while they keep exploring; Andorra's name stays nearby or is left out, once.
    await toggle.click();
    await expect(closeUp(page)).toHaveCount(0);
    for (const id of ["ESP", "FRA", "PRT"]) {
      await tapCountry(page, id);
      await expect(page.getByTestId("country-card")).toHaveAttribute("data-country", id);
      await expect(closeUp(page)).toHaveCount(0);
      await expectAndorraNamedOnce(page, where(`${id} selected, close-up closed`));
      await expectMapTextClear(page);
    }
    // Reopened, it shows Andorra again and stays open.
    await toggle.click();
    await expect(closeUp(page)).toBeVisible();
    await tapCountry(page, "ITA");
    await expect(closeUp(page)).toBeVisible();
    await expectAndorraNamedOnce(page, where("reopened"));

    // Without the close-up: zoomed in on the main map, Andorra's own outline is tapped.
    await openLevel7(page, discoverAt(null), locale);
    if ((await closeUp(page).count()) > 0) await toggle.click();
    const svg = (await page.getByTestId("map-main").boundingBox())!;
    for (let i = 0; i < 4; i++) {
      const c = await page.locator('[data-testid="map-main"] path[data-country="AND"]').evaluate((p) => {
        const r = p.getBoundingClientRect();
        return [(r.left + r.right) / 2, (r.top + r.bottom) / 2];
      });
      const [mx, my] = [svg.x + svg.width / 2, svg.y + svg.height / 2];
      const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
      await page.mouse.move(mx, my);
      await page.mouse.down();
      await page.mouse.move(clamp(2 * mx - c[0], svg.x + 5, svg.x + svg.width - 5), clamp(2 * my - c[1], svg.y + 5, svg.y + svg.height - 5), { steps: 6 });
      await page.mouse.up();
      await page.waitForTimeout(300);
      await page.getByRole("button", { name: locale === "en" ? "Zoom in" : "Մեծացնել" }).click();
      await page.waitForTimeout(500);
    }
    const zoomed = (await page.locator('[data-testid="map-main"] path[data-country="AND"]').boundingBox())!;
    expect(Math.min(zoomed.width, zoomed.height), where("Andorra zoomed in")).toBeGreaterThanOrEqual(20);
    await tapCountry(page, "AND");
    await expect(page.getByTestId("country-card")).toHaveAttribute("data-country", "AND");
    await expectMapTextClear(page);
    await shot(page, `${locale}-andorra-zoomed-selected`);

    // Find, unanswered, asking for Andorra and then for Spain: the same close-up toggle and the same unnamed
    // close-up; nothing names or marks the target. Andorra is answered through the close-up.
    for (const target of ["AND", "ESP"]) {
      await openLevel7(page, findAsking(target), locale);
      await expect(toggle).toBeVisible();
      await expect(closeUp(page)).toHaveCount(0);
      await expectFindSpoilerFree(page, target, locale);
      await toggle.click();
      await expect(closeUp(page)).toBeVisible();
      await expectFindSpoilerFree(page, target, locale);
      await expect(page.getByTestId("inset-title")).toHaveText(locale === "en" ? "Close-up" : "Խոշորացում");
      await shot(page, `${locale}-andorra-find-${target}-closeup`);
    }
    await openLevel7(page, findAsking("AND"), locale);
    await toggle.click();
    await tapCountry(page, "AND", "map-inset");
    await expect(page.getByTestId("find-feedback")).toBeVisible();
    await expect(page.locator('[data-testid="map-main"] path[data-country="AND"]')).toHaveAttribute("data-tone", "correct");
    await expectAndorraNamedOnce(page, where("Find answered"));
    await shot(page, `${locale}-andorra-find-answered`);
  }
});

/** Each capital name on the main map or in the close-up: its gap (px) to the nearest capital marker there. */
const capitalGaps = (page: Page) =>
  page.evaluate((capitals) => {
    const out: { map: string; text: string; gap: number }[] = [];
    for (const map of ["map-main", "map-inset"]) {
      const root = document.querySelector(`[data-testid="${map}"]`);
      if (!root) continue;
      const markers = [...root.querySelectorAll('[data-marker="capital"], [data-traveller]')].map((m) => m.getBoundingClientRect());
      for (const t of root.querySelectorAll("[data-marker-text]")) {
        const text = (t.textContent ?? "").trim();
        if (!capitals.includes(text)) continue;
        const r = t.getBoundingClientRect();
        const gap = (m: DOMRect) => Math.hypot(Math.max(m.left - r.right, 0, r.left - m.right), Math.max(m.top - r.bottom, 0, r.top - m.bottom));
        out.push({ map, text, gap: Math.min(...markers.map(gap)) });
      }
    }
    return out;
  }, [...Object.values(CAPITALS), ...Object.values(CAPITALS_HY)]);

/**
 * A country's callout: its leader's length against the country's half-size (the rule for a nearby callout), and the
 * share of the pill lying over another of the level's countries (sampled on a 5×3 grid, under the names).
 */
const calloutOf = (page: Page, id: string) =>
  page.evaluate(
    ([id, others]) => {
      const main = document.querySelector('[data-testid="map-main"]')!;
      const callout = main.querySelector(`[data-callout="${id}"]`);
      if (!callout) return null;
      const line = callout.querySelector("line")!;
      const leader = Math.hypot(+line.getAttribute("x2")! - +line.getAttribute("x1")!, +line.getAttribute("y2")! - +line.getAttribute("y1")!);
      const country = main.querySelector(`path[data-country="${id}"]`)!.getBoundingClientRect();
      const pill = callout.querySelector("rect")!.getBoundingClientRect();
      let over = 0;
      for (let i = 0; i < 5; i++)
        for (let j = 0; j < 3; j++) {
          const [x, y] = [pill.left + (pill.width * (i + 0.5)) / 5, pill.top + (pill.height * (j + 0.5)) / 3];
          const under = document.elementsFromPoint(x, y).find((e) => e.matches('[data-testid="map-main"] path[data-country]'));
          if (under && others.includes(under.getAttribute("data-country")!)) over++;
        }
      return { leader, reach: Math.max(country.width, country.height) / 2, over: over / 15 };
    },
    [id, L7_COUNTRIES.filter((c) => c !== id)] as const,
  );

/* Names close to their places on a 320px phone (the review's Portugal and Andorra la Vella), with the close-up open
   and closed: Portugal's name, too long for Portugal, in a callout close to it, over the sea rather than across Spain;
   Andorra la Vella's name right beside its marker, never left out for want of room nearby; every capital's name
   right beside its own marker; nothing overlapping; Find still spoiler-free with the close-up open. */
test("Level 7's names stay close to their places on a 320px map: Portugal's callout and Andorra la Vella, close-up open and closed", async ({ page }) => {
  test.skip(project() !== "small-phone", "Runs once, at 320×568.");
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 320, height: 568 });
  const report: string[] = [];
  // Right beside its marker (the four nearest sides: about 3–4 px away); any capital name at most a side further out.
  const CLOSE = 6;
  const BESIDE = 13;
  const setCloseUp = async (open: boolean) => {
    if (((await closeUp(page).count()) > 0) !== open) await page.getByTestId("inset-toggle").click();
    await expect(closeUp(page)).toHaveCount(open ? 1 : 0);
    await page.waitForTimeout(300);
  };
  for (const locale of ["en", "hy"] as const) {
    for (const [state, name] of [
      [travellingAt(["PRT"]), "Travel at Lisbon"],
      [travellingAt(["PRT", "ESP"]), "Travel in Spain"],
      [discoverAt("AND"), "Discover, Andorra"],
      [discoverAt("PRT"), "Discover, Portugal"],
      [discoverAt("ESP"), "Discover, Spain"],
    ] as const) {
      await openLevel7(page, state, locale);
      for (const open of [true, false]) {
        await setCloseUp(open);
        const where = `${locale} ${name}, close-up ${open ? "open" : "closed"}`;
        await expectMapTextClear(page);
        await expectAndorraNamedOnce(page, where);
        await expectMarkerNamesOwn(page, where);
        const gaps = await capitalGaps(page);
        for (const g of gaps) expect(g.gap, `${where}: «${g.text}» ${g.gap.toFixed(1)}px from its marker`).toBeLessThanOrEqual(BESIDE);
        if (name === "Discover, Andorra") {
          expect(gaps.map((g) => g.text), `${where}: Andorra la Vella named`).toEqual([locale === "en" ? CAPITALS.AND : CAPITALS_HY.AND]);
          // Before: 8–11 px away in English, on a side further out over the sea or Spain, and left out in Armenian.
          expect(gaps[0].gap, `${where}: Andorra la Vella ${gaps[0].gap.toFixed(1)}px from its marker`).toBeLessThanOrEqual(CLOSE);
          await shot(page, `${locale}-labels-discover-AND-closeup-${open ? "open" : "closed"}`);
          // Andorra's callout on the main map (close-up closed): its dot lies on Andorra la Vella's marker, which
          // stands for it and stays in view (before, the dot hid the capital's marker).
          const main = page.locator('[data-testid="map-main"]');
          if (!open) {
            await expect(main.locator('[data-callout="AND"]')).toHaveAttribute("data-leader-from", "capital");
            await expect(main.locator('[data-callout="AND"] [data-leader-dot]')).toHaveCount(0);
            await expect(main.locator('[data-marker="capital"]')).toHaveCount(1);
          }
        }
        const prt = await calloutOf(page, "PRT");
        if (prt) {
          report.push(`${where}: Portugal's leader ${prt.leader.toFixed(1)}px (near: ${(prt.reach + 18).toFixed(1)}), ${(prt.over * 100).toFixed(0)}% over another country`);
          expect(prt.leader, `${where}: Portugal's callout far away`).toBeLessThanOrEqual(prt.reach + 18);
          expect(prt.over, `${where}: Portugal's callout across another country`).toBeLessThanOrEqual(1 / 3);
        }
        if (name === "Travel at Lisbon") {
          expect(prt, `${where}: Portugal named`).not.toBeNull();
          if (open) await shot(page, `${locale}-labels-travel-PRT`);
        }
        report.push(`${where}: ${gaps.map((g) => `${g.text} ${g.gap.toFixed(1)}px`).join(", ") || "no capital names"}`);
      }
    }
    // Find, with the close-up open: still nothing that names or singles out the target.
    await openLevel7(page, findAsking("AND"), locale);
    await setCloseUp(true);
    await expectFindSpoilerFree(page, "AND", locale);
  }
  console.log(report.join("\n"));
});

/* The whole map: every country whole with padding on whole-region maps (portrait phones, phones in landscape beside
   the panel, desktops, and ultra-wide desktops, where the map stops at the width that shows them whole), never beyond
   the prepared data at any size; enlarged-text maps on a 320px phone are cropped, measured and reported
   (docs/DATA.md, "Level 7"). The traveller's pin whole in Lisbon (Travel) and Rome (arrival, Results, refresh and
   "Show the whole map"). */
test("Level 7's map: framing at every size, and the traveller's pin in Lisbon and Rome", async ({ page }) => {
  test.skip(project() !== "desktop", "Runs once, across sizes.");
  test.setTimeout(400_000);
  const sizes = [[320, 568], [390, 844], [412, 915], [1366, 800], [1920, 1080], [2560, 1080], [740, 360], [844, 390]];
  const report: string[] = [];
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await openLevel7(page, discoverAt(null));
    await page.waitForTimeout(300);
    const start = await mapState(page);
    const where = `${width}×${height} (map ${Math.round(start.map.width)}×${Math.round(start.map.height)})`;
    expect(start.overviewCovers, `${where}: the view shows past the painted coverage`).toBe(true);
    const margin = Math.min(...start.countries.flatMap((c) => [c.left, c.top, c.right, c.bottom]));
    const cut = start.countries.filter((c) => Math.min(c.left, c.top, c.right, c.bottom) < 0).map((c) => `${c.id} by ${(-Math.min(c.left, c.top, c.right, c.bottom)).toFixed(0)}px`);
    const sizesOf = start.countries.map((c) => `${c.id} ${c.width.toFixed(0)}×${c.height.toFixed(0)}`).join(", ");
    report.push(`${where}: smallest margin ${margin.toFixed(1)}px${cut.length ? `; cut: ${cut.join(", ")}` : ""}; ${sizesOf}`);
    const aspect = start.map.width / start.map.height;
    if (aspect >= 0.9 && aspect <= 1.6) expect(margin, `${where}: a country touches or crosses the edge`).toBeGreaterThanOrEqual(4);
    await page.screenshot({ path: `screenshots/desktop/level7-map-${width}x${height}.png` });
    // Zoomed in and moved to the far west and south-west (Portugal, the Atlantic) and the south-east (Sicily): the
    // landscape still covers the view.
    await page.getByRole("button", { name: "Zoom in" }).click();
    await page.getByRole("button", { name: "Zoom in" }).click();
    await page.waitForTimeout(500);
    const svg = (await page.getByTestId("map-main").boundingBox())!;
    const at = (fx: number, fy: number): [number, number] => [svg.x + svg.width * fx, svg.y + svg.height * fy];
    for (const [from, to, what] of [
      [at(0.1, 0.5), at(0.9, 0.5), "west"],
      [at(0.1, 0.5), at(0.9, 0.5), "west"],
      [at(0.1, 0.9), at(0.9, 0.1), "south-west"],
      [at(0.9, 0.9), at(0.1, 0.1), "south-east"],
      [at(0.9, 0.9), at(0.1, 0.1), "south-east"],
    ] as const) {
      await page.mouse.move(from[0], from[1]);
      await page.mouse.down();
      await page.mouse.move(to[0], to[1], { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(400);
      expect((await mapState(page)).overviewCovers, `${where}: panned ${what} past the painted coverage`).toBe(true);
    }
    await page.getByRole("button", { name: "Show the whole map" }).click();
    await page.waitForTimeout(500);
    expect((await mapState(page)).countries.map((c) => c.left.toFixed(1)), `${where}: reset`).toEqual(start.countries.map((c) => c.left.toFixed(1)));
  }
  // Enlarged text shortens the map on phones.
  for (const [width, height, size] of [[320, 568, 150], [320, 568, 200], [390, 844, 200]]) {
    await page.setViewportSize({ width, height });
    await openLevel7(page, discoverAt(null));
    await textSize(page, size);
    await page.waitForTimeout(400);
    const s = await mapState(page);
    const margin = Math.min(...s.countries.flatMap((c) => [c.left, c.top, c.right, c.bottom]));
    const cut = s.countries.filter((c) => Math.min(c.left, c.top, c.right, c.bottom) < 0).map((c) => `${c.id} by ${(-Math.min(c.left, c.top, c.right, c.bottom)).toFixed(0)}px`);
    report.push(`${width}×${height} at ${size}% text (map ${Math.round(s.map.width)}×${Math.round(s.map.height)}): smallest margin ${margin.toFixed(1)}px${cut.length ? `; cut: ${cut.join(", ")}` : ""}`);
    expect(s.overviewCovers).toBe(true);
    await page.screenshot({ path: `screenshots/desktop/level7-map-text${size}-${width}x${height}.png` });
    await textSize(page, 100);
  }

  // The traveller's pin: in Lisbon at the start of Travel, then arriving in Rome, at Results, after a refresh and
  // after "Show the whole map".
  const ROOM = 1.5;
  for (const [width, height] of [[320, 568], [390, 844], [1366, 800], [740, 360]]) {
    await page.setViewportSize({ width, height });
    for (const locale of ["en", "hy"] as const) {
      const where = (what: string) => `${width}×${height} ${locale} ${what}`;
      await openLevel7(page, travellingAt(["PRT"]), locale);
      const box = (await page.getByTestId("map-main").boundingBox())!;
      const whole = box.width / box.height < 1.6;
      await page.waitForTimeout(300);
      const lisbon = await pinRoom(page);
      report.push(`${where("pin in Lisbon")}: room ${lisbon.map((r) => r.toFixed(1)).join("/")}px`);
      if (whole) for (const r of lisbon) expect(r, where("pin in Lisbon")).toBeGreaterThanOrEqual(ROOM);
      await openLevel7(page, travellingAt(["PRT", "ESP", "FRA"]), locale);
      const travelling = await cameraOf(page);
      await page.getByTestId("move-ITA").click();
      await expect(page.getByTestId("result-crossings")).toBeVisible();
      await expect(page.locator('[data-testid="map-main"] [data-traveller]')).toHaveAttribute("data-traveller", "ITA");
      await page.waitForTimeout(1200);
      const arrived = await cameraOf(page);
      const rome = await pinRoom(page);
      report.push(`${where("pin in Rome")}: room ${rome.map((r) => r.toFixed(1)).join("/")}px`);
      if (whole) {
        for (const r of rome) expect(r, where("pin in Rome on arrival")).toBeGreaterThanOrEqual(ROOM);
        // Rome is well inside the map: the start view doesn't change for the pin.
        expect(arrived, where("camera on arrival")).toBe(travelling);
      }
      if (locale === "en") await shot(page, "results-pin");
      await page.reload();
      await appReady(page);
      await fontsSettled(page);
      await page.waitForTimeout(300);
      expect(await cameraOf(page), where("camera after refresh")).toBe(arrived);
      await page.getByRole("button", { name: locale === "en" ? "Zoom in" : "Մեծացնել" }).click();
      await page.waitForTimeout(500);
      expect(await cameraOf(page)).not.toBe(arrived);
      await page.getByRole("button", { name: locale === "en" ? "Show the whole map" : "Ցույց տալ ամբողջ քարտեզը" }).click();
      await expect.poll(() => cameraOf(page), { timeout: 5000 }).toBe(arrived);
      if (whole) for (const r of await pinRoom(page)) expect(r, where("pin after Show the whole map")).toBeGreaterThanOrEqual(ROOM);
    }
  }
  test.info().annotations.push({ type: "framing", description: report.join("; ") });
  console.log(report.join("\n"));
});

/* The landscape: only Level 7's own overview, its overlay once a country has a state colour, and tiles only when
   zoomed; Level 6 never loads Level 7's overview. */
test("Level 7 loads its own landscape overview, and zoomed tiles only for the view; earlier levels don't load it", async ({ page }) => {
  test.skip(project() !== "mobile", "Runs once.");
  await saveV2(page, { ...EARLIER, [L7]: discoverAt(null) }, { levelId: L6, recent: EARLIER_RECENT });
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.waitForTimeout(500);
  expect(requests.filter((u) => /-(land|tone)\.[\w-]*\.?webp|\/relief\//.test(u)), "landscape on the level selection").toEqual([]);
  // Level 6 (and the zoomed tiles it shares with every level): never Level 7's overview.
  await card(page, L6).getByTestId("level-details-toggle").click();
  await card(page, L6).getByRole("button", { name: /^Play again/ }).click();
  await page.getByTestId("start-over-dialog").getByRole("button", { name: "Play again" }).click();
  await expect.poll(() => requests.some((u) => /baltic-journey-land/.test(u))).toBe(true);
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: "Zoom in" }).click();
    await page.waitForTimeout(600);
  }
  expect(requests.filter((u) => /iberian-journey/.test(u)), "Level 7's overview in Level 6").toEqual([]);
  await homeToEurope(page);
  requests.length = 0;

  await card(page, L7).getByRole("button", { name: /^Continue/ }).click();
  const main = page.getByTestId("map-main");
  await expect(main.locator('[data-family="land"] image[data-level="overview"]')).toHaveCount(1);
  await expect.poll(() => requests.some((u) => /iberian-journey-land/.test(u))).toBe(true);
  await page.waitForTimeout(500);
  expect(requests.filter((u) => /(western-europe-1|around-the-alps|central-europe|along-the-adriatic|towards-greece|baltic-journey)-(land|tone)/.test(u)), "another level's overview").toEqual([]);
  expect(requests.filter((u) => /iberian-journey-tone/.test(u)), "the overlay before any state colour").toEqual([]);
  expect(requests.filter((u) => u.includes("/relief/")), "zoomed tiles at the whole-map view").toEqual([]);
  // A selection gives Portugal a state colour: its overlay is loaded.
  await tapCountry(page, "PRT");
  await expect(main.locator('[data-family="tone"] image[data-level="overview"]')).toHaveCount(1);
  await expect.poll(() => requests.some((u) => /iberian-journey-tone/.test(u))).toBe(true);
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
