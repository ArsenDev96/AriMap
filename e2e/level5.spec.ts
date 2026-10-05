import { expect, test, type Locator, type Page } from "@playwright/test";
import { openWithSave } from "./helpers/save";
import { homeToEurope } from "./helpers/home";

/*
 * Level 5 (Towards Greece) from Discover to Results, its unlock from Level 4, its five
 * landmark cards and their illustrations (never shown in Find), the Hungary → Greece journey
 * (two shortest routes), the level selection once it is completed (Level 6 then ready), and its
 * map: framing (Greece's islands included), reset, and the landscape it loads.
 */

const L1 = "western-europe-1";
const L2 = "around-the-alps";
const L3 = "central-europe";
const L4 = "along-the-adriatic";
const L5 = "towards-greece";
const L6 = "baltic-journey";
const L1_ORDER = ["FRA", "BEL", "NLD", "LUX", "DEU"];
const L2_COUNTRIES = ["FRA", "CHE", "DEU", "AUT", "ITA"];
const L3_COUNTRIES = ["DEU", "POL", "CZE", "SVK", "AUT"];
const L4_COUNTRIES = ["ITA", "SVN", "HRV", "BIH", "MNE"];
const L5_COUNTRIES = ["HUN", "ROU", "SRB", "BGR", "GRC"];
const NAMES: Record<string, string> = { Hungary: "HUN", Romania: "ROU", Serbia: "SRB", Bulgaria: "BGR", Greece: "GRC" };
const NAME_OF = Object.fromEntries(Object.entries(NAMES).map(([name, id]) => [id, name]));
const NAMES_HY: Record<string, string> = { HUN: "Հունգարիա", ROU: "Ռումինիա", SRB: "Սերբիա", BGR: "Բուլղարիա", GRC: "Հունաստան" };
const CAPITALS: Record<string, string> = { HUN: "Budapest", ROU: "Bucharest", SRB: "Belgrade", BGR: "Sofia", GRC: "Athens" };
const CAPITALS_HY: Record<string, string> = { HUN: "Բուդապեշտ", ROU: "Բուխարեստ", SRB: "Բելգրադ", BGR: "Սոֆիա", GRC: "Աթենք" };
const LANDMARKS: Record<string, string> = { HUN: "Esztergom Basilica", ROU: "Bran Castle", SRB: "Golubac Fortress", BGR: "Rila Monastery", GRC: "Meteora" };
const LANDMARKS_HY: Record<string, string> = { HUN: "Էստերգոմի բազիլիկ", ROU: "Բրանի դղյակ", SRB: "Գոլուբաց ամրոց", BGR: "Ռիլայի վանք", GRC: "Մետեորա" };
const LANDMARK_IDS: Record<string, string> = { HUN: "esztergom-basilica", ROU: "bran-castle", SRB: "golubac-fortress", BGR: "rila-monastery", GRC: "meteora" };
/** The illustration's alt text: the landmark in its in-sentence form, in each language. */
const ALT: Record<"en" | "hy", Record<string, string>> = {
  en: Object.fromEntries(Object.entries(LANDMARKS).map(([id, name]) => [id, `Illustration of ${name}`])),
  hy: { HUN: "Նկարազարդում՝ Էստերգոմի բազիլիկը", ROU: "Նկարազարդում՝ Բրանի դղյակը", SRB: "Նկարազարդում՝ Գոլուբաց ամրոցը", BGR: "Նկարազարդում՝ Ռիլայի վանքը", GRC: "Նկարազարդում՝ Մետեորան" },
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
const L4_DONE = done(L4_COUNTRIES, "ita-to-mne", ["ITA", "SVN", "HRV", "MNE"]);
const L5_DONE = done(L5_COUNTRIES, "hun-to-grc", ["HUN", "ROU", "BGR", "GRC"]);
const EARLIER = { [L1]: L1_DONE, [L2]: L2_DONE, [L3]: L3_DONE, [L4]: L4_DONE };
const ALL_DONE = { ...EARLIER, [L5]: L5_DONE };

const discoverAt = (selected: string | null) => ({ started: true, stage: "discover", discover: { selected, explored: selected ? [selected] : [] }, records: records(false) });
const findAsking = (target: string, hintLevel = 0) => ({
  started: true,
  stage: "find",
  discover: { selected: null, explored: L5_COUNTRIES },
  find: { order: [target, ...L5_COUNTRIES.filter((c) => c !== target)], index: 0, question: { target, wrongGuesses: [], hintLevel, solved: false, feedback: null }, results: [], status: "asking" },
  records: records(false),
});
const travellingAt = (path: string[]) => ({
  started: true,
  stage: "travel",
  discover: { selected: null, explored: L5_COUNTRIES },
  find: findDone(L5_COUNTRIES),
  travel: { missionId: "hun-to-grc", path, hintUsed: false, undoUsed: false },
  records: { ...records(false), findDone: true },
});

const project = () => test.info().project.name;

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

/** Opens Level 5 directly in a given state, Levels 1–4 completed. */
async function openLevel5(page: Page, level5: object, locale = "en") {
  await saveV2(page, { ...EARLIER, [L5]: level5 }, { locale, screen: "lesson", levelId: L5, recent: [L5, L4, L3, L2, L1] });
  for (const id of L5_COUNTRIES) await expect(page.locator(`[data-testid="map-main"] path[data-country="${id}"]`)).toBeVisible();
}

async function shot(page: Page, name: string) {
  const { width, height } = page.viewportSize()!;
  await page.screenshot({ path: `screenshots/${project()}/level5-${name}-${width}x${height}.png` });
}

const card = (page: Page, id: string) => page.getByTestId(`level-${id}`);
const mainAction = (page: Page) => page.getByTestId("welcome-actions").getByRole("button");

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
    // A word may break only if it is wider than this: the element's own box, or the room across `within`.
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
        out.push({ text: m[0], lines, natural: probe.getBoundingClientRect().width, box });
        probe.remove();
      }
    }
    return out;
  }, room);
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
 * Each capital or landmark name on the map is nearer its own marker than any other marker, so it
 * can't be read as the other one's (Belgrade and Golubac Fortress are about 20px apart on a phone).
 */
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
  await expectNoLandmarkArt(page);
  const names = new RegExp([...Object.keys(NAMES), ...Object.values(NAMES_HY), ...Object.values(LANDMARKS), ...Object.values(CAPITALS)].join("|"));
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
  }, L5_COUNTRIES);
  expect(Object.keys(styling).sort()).toEqual([...L5_COUNTRIES].sort());
  for (const id of L5_COUNTRIES) expect(styling[id], `${id} styled differently from the target ${target}`).toBe(styling[target]);
}

/**
 * A Level 5 landmark card: its own illustration (no other country's stands in), loaded and named
 * in the card's language; then the landmark's name and its fact.
 */
async function expectIllustratedLandmark(page: Page, id: string, locale: "en" | "hy") {
  const figure = page.getByTestId("landmark-card");
  await expect(figure).toHaveAttribute("data-art", "illustration");
  await expect(figure).toHaveAttribute("data-landmark", LANDMARK_IDS[id]);
  // 0.90–1.24:1, well below the 2:1 of very wide art: the square tile beside the name on phones.
  await expect(figure).toHaveAttribute("data-shape", "ordinary");
  const image = page.getByTestId("landmark-image");
  await expect(image).toHaveCount(1);
  await expect(page.getByTestId("panel").locator("img")).toHaveCount(1);
  await expect(image).toHaveAttribute("alt", ALT[locale][id]);
  await expect(image).toHaveAttribute("src", new RegExp(LANDMARK_IDS[id]));
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect(figure).toContainText(locale === "en" ? LANDMARKS[id] : LANDMARKS_HY[id]);
  // Its fact, a sentence, follows the name.
  expect(((await figure.locator("figcaption span").last().textContent()) ?? "").length).toBeGreaterThan(30);
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
  expect(Math.abs(art.width / art.height - art.naturalRatio), `${where}: art stretched`).toBeLessThan(0.02);
  expect(art.top >= art.tile.top - 0.5 && art.bottom <= art.tile.bottom + 0.5 && art.left >= art.tile.left - 0.5 && art.right <= art.tile.right + 0.5, `${where}: art outside its tile`).toBe(true);
  expect(art.top, `${where}: art's top above the panel when its bottom shows`).toBeGreaterThanOrEqual(top - 0.5);
  expect(art.bottom, `${where}: art under the button`).toBeLessThanOrEqual(fold + 0.5);
}

/** No landmark artwork anywhere on the page (Find: the hint names the landmark in words only). */
async function expectNoLandmarkArt(page: Page) {
  await expect(page.getByTestId("landmark-image")).toHaveCount(0);
  const art = new RegExp(Object.values(LANDMARK_IDS).join("|"));
  const sources = await page.locator("img, image").evaluateAll((els) => els.map((e) => e.getAttribute("src") ?? e.getAttribute("href") ?? ""));
  expect(sources.filter((s) => art.test(s))).toEqual([]);
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

/** Travel's neighbour cards: in two columns only when every name fits half the row on one line; never cut. */
async function expectNeighboursClear(page: Page, where: string) {
  const n = await page.evaluate(() => {
    const grid = document.querySelector('[data-testid^="move-"]')!.parentElement!;
    const gs = getComputedStyle(grid);
    return {
      grid: { width: grid.getBoundingClientRect().width, gap: parseFloat(gs.columnGap) || 0 },
      buttons: [...document.querySelectorAll<HTMLElement>('[data-testid^="move-"]')].map((b) => {
        const label = b.querySelector("span")!;
        const cs = getComputedStyle(b);
        const ls = getComputedStyle(label);
        const arrow = b.querySelector("svg")!.getBoundingClientRect();
        const probe = document.createElement("span");
        probe.textContent = label.textContent;
        Object.assign(probe.style, { position: "absolute", visibility: "hidden", whiteSpace: "nowrap", font: ls.font, letterSpacing: ls.letterSpacing });
        document.body.appendChild(probe);
        const natural = probe.getBoundingClientRect().width;
        probe.remove();
        const range = document.createRange();
        range.selectNodeContents(label);
        const lines = new Set([...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top))).size;
        return {
          left: Math.round(b.getBoundingClientRect().left),
          lines,
          natural,
          chrome: parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth) + (parseFloat(cs.columnGap) || 0) + arrow.width,
          overflow: label.scrollWidth - label.clientWidth,
          height: b.getBoundingClientRect().height,
        };
      }),
    };
  });
  const columns = new Set(n.buttons.map((b) => b.left)).size;
  const widest = Math.max(...n.buttons.map((b) => b.natural + b.chrome));
  const fitsTwo = widest <= (n.grid.width - n.grid.gap) / 2 + 0.5;
  expect(columns, `${where}: ${columns} columns; widest needs ${widest.toFixed(1)}px of ${n.grid.width.toFixed(1)}`).toBe(fitsTwo && n.buttons.length > 1 ? 2 : 1);
  for (const b of n.buttons) {
    expect(b.overflow, `${where}: a name overflows`).toBeLessThanOrEqual(1);
    expect(b.height, `${where}: touch target`).toBeGreaterThanOrEqual(44);
    if (columns === 2) expect(b.lines, `${where}: wraps in two columns`).toBe(1);
  }
  return columns;
}

test("Level 5, Towards Greece: unlock, Discover, Find, Travel, Results, and Level 6 unlocked", async ({ page }) => {
  test.skip(project() !== "mobile", "Runs once, on the Pixel 7 project; layouts are checked at other sizes below.");
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" || /hydrat/i.test(m.text())) errors.push(`console ${m.type()}: ${m.text()}`);
  });
  // A save from before Level 5 was playable: Levels 1–4 completed, nothing for Level 5.
  await saveV2(page, EARLIER, { levelId: L4, recent: [L4, L3, L2, L1] });
  await expect(card(page, L5).getByTestId("level-status")).toHaveText("Ready to play");
  await expect(card(page, L5)).toContainText("Hungary · Romania · Serbia · Bulgaria · Greece");
  await expect(card(page, L5)).toHaveAttribute("data-up-next", "true");
  await expect(mainAction(page)).toHaveText(/^Start\s*Level 5 · Towards Greece$/);
  for (const id of [L1, L2, L3, L4]) await expect(card(page, id).getByTestId("level-status")).toHaveText("Completed");
  await mainAction(page).click();

  // --- Discover -----------------------------------------------------------------
  await expect(page.getByRole("heading", { name: "Tap a country to learn about it." })).toBeAttached();
  await expect(page.getByTestId("map-main")).toHaveAttribute("aria-label", "Map of South-eastern Europe");
  await expect(page.getByTestId("inset-toggle")).toHaveCount(0);
  await expect(page.getByTestId("map-inset")).toHaveCount(0);
  await expectMapTextClear(page);
  const cardEl = page.getByTestId("country-card");
  for (const id of L5_COUNTRIES) {
    await tapCountry(page, id);
    await expect(cardEl).toHaveAttribute("data-country", id);
    await expect(cardEl.getByRole("heading", { level: 2 })).toHaveText(NAME_OF[id]);
    await expect(page.getByTestId("country-capital")).toContainText(CAPITALS[id]);
    await expectIllustratedLandmark(page, id, "en");
    await expect(page.locator('[data-testid="map-main"] [data-marker-text]').first()).toBeAttached();
    await expectMapTextClear(page);
    await expectMarkerNamesOwn(page, `${id}`);
    await expectWordsWhole(cardEl.getByRole("heading", { level: 2 }), `${id} card title`);
  }
  // This level's own descriptions.
  await tapCountry(page, "GRC");
  await expect(cardEl).toContainText("southernmost country of this region");
  await tapCountry(page, "ROU");
  await expect(cardEl).toContainText("Black Sea");
  await expect(page.getByTestId("discover-progress")).toContainText("5/5");
  await setLanguage(page, "Հայերեն");
  await tapCountry(page, "BGR");
  await expect(cardEl.getByRole("heading", { name: "Բուլղարիա" })).toBeVisible();
  await expect(page.getByTestId("country-capital")).toContainText("Սոֆիա");
  await expectIllustratedLandmark(page, "BGR", "hy");
  await expect(page.getByTestId("map-main")).toHaveAttribute("aria-label", "Քարտեզ՝ Հարավարևելյան Եվրոպա");
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
      const wrong = target === "HUN" ? "ROU" : "HUN";
      await tapCountry(page, wrong);
      await expect(page.getByTestId("find-feedback")).toContainText("Try again.");
      await page.getByRole("button", { name: "Hint" }).click();
      await expect(page.getByTestId("panel")).toContainText(`Its capital is ${CAPITALS[target]}.`);
      await expect(page.getByTestId("panel")).toContainText(`You'll also find ${LANDMARKS[target]} there.`);
      // The first hint names the capital and landmark only: nothing on the map points at the target.
      await expect(page.getByTestId("panel").locator("img")).toHaveCount(0);
      await expect(page.getByTestId("landmark-card")).toHaveCount(0);
      await expectNoLandmarkArt(page);
      expect(await page.locator('[data-testid="map-main"] text').allTextContents()).toEqual([NAME_OF[wrong]]);
      await expect(page.locator(`[data-testid="map-main"] path[data-country="${target}"][data-tone]:not([data-tone="default"])`)).toHaveCount(0);
      await expect(page.locator("[data-marker-text]")).toHaveCount(0);
      // Home and a refresh keep the question exactly; Continue resumes it.
      await homeToEurope(page);
      await expect(mainAction(page)).toHaveText(/^Continue\s*Level 5 · Towards Greece$/);
      await expect(card(page, L5).getByTestId("level-status")).toHaveText("In progress: Find");
      await page.reload();
      await mainAction(page).click();
      await expect(page.getByTestId("find-prompt")).toHaveText(`Find ${text}`);
      await expect(page.getByText(/Its capital is/)).toBeVisible();
    }
    await tapCountry(page, target);
    await expect(page.getByTestId("find-feedback")).toBeVisible();
    await page.getByRole("button", { name: q < 4 ? "Next" : "Continue to Travel" }).click();
  }
  expect([...asked].sort()).toEqual([...L5_COUNTRIES].sort());

  // --- Travel -------------------------------------------------------------------
  await expect(page.getByRole("heading", { name: /Hungary.*Greece/ })).toBeVisible();
  await expect(page.getByText("Shortest route: 3 crossings")).toBeVisible();
  const moves = async () => (await page.locator('[data-testid^="move-"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")!.slice(5)))).sort();
  const route = page.locator('[data-testid="map-main"] [data-testid="route-line"]');
  // Every real neighbour in the level, and no others.
  expect(await moves()).toEqual(["ROU", "SRB"]);
  await page.getByTestId("move-SRB").click();
  expect(await moves()).toEqual(["BGR", "HUN", "ROU"]);
  // Budapest → the Hungarian–Serbian border → Belgrade: straight legs.
  await expect(route).toHaveAttribute("data-route", "HUN,SRB");
  await expect(route).toHaveAttribute("data-points", "3");
  // Sideways into Romania: Greece is then two crossings away, with one left.
  await page.getByTestId("move-ROU").click();
  expect(await moves()).toEqual(["BGR", "HUN", "SRB"]);
  await page.getByTestId("move-BGR").click();
  await expect(page.getByTestId("out-of-crossings")).toBeVisible();
  await page.getByTestId("out-of-crossings").getByRole("button", { name: "Undo" }).click();
  await expect(page.getByTestId("crossings-left")).toHaveText("1 crossing left");
  await page.reload();
  // A refresh keeps the journey where it was.
  await expect(route).toHaveAttribute("data-route", "HUN,SRB,ROU");
  await page.getByRole("button", { name: "Restart" }).click();
  await expect(route).toHaveCount(0);
  expect(await moves()).toEqual(["ROU", "SRB"]);
  await expect(page.getByText("Help used on this journey")).toBeVisible();
  await page.getByTestId("move-ROU").click();
  await page.getByTestId("move-BGR").click();
  expect(await moves()).toEqual(["GRC", "ROU", "SRB"]);
  await page.getByTestId("move-GRC").click();

  // --- Results ------------------------------------------------------------------
  await expect(page.getByRole("heading", { name: "Journey complete!" })).toBeVisible();
  for (const name of ["Hungary", "Romania", "Bulgaria", "Greece"]) await expect(page.getByTestId("result-route")).toContainText(name);
  await expect(page.getByTestId("result-crossings")).toContainText("3 of 3");
  await expect(page.getByTestId("result-help")).toContainText("Undo");
  await expect(page.getByTestId("result-find-answers").locator("li")).toHaveCount(5);
  await expect(page.getByTestId("result-find")).toContainText("4/5");
  // Sofia turns near Smolyan to the Rhodope crossing; Greece's leg runs up its mainland (11 points in all).
  await expect(route).toHaveAttribute("data-route", "HUN,ROU,BGR,GRC");
  await expect(route).toHaveAttribute("data-points", "11");
  await setLanguage(page, "Հայերեն");
  await expect(page.getByRole("heading", { name: "Ճամփորդությունն ավարտվեց։" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await setLanguage(page, "English");

  // Replay journey without help, by the other shortest route (through Serbia): the badge.
  await page.getByRole("button", { name: "Replay journey" }).click();
  await expect(page.getByTestId("crossings-left")).toHaveText("3 crossings left");
  for (const id of ["SRB", "BGR", "GRC"]) await page.getByTestId(`move-${id}`).click();
  await expect(page.getByRole("heading", { name: "Journey complete!" })).toBeVisible();
  await expect(page.getByTestId("result-help")).toHaveText(/Help used\s*None/);
  await expect(page.getByTestId("badge")).toBeVisible();
  await expect(route).toHaveAttribute("data-route", "HUN,SRB,BGR,GRC");

  // The level selection: Levels 1–5 completed, Level 6 unlocked and up next (e2e/level6.spec.ts plays it;
  // e2e/level8.spec.ts checks all eight completed); every completed level still open to play again.
  await homeToEurope(page);
  for (const id of [L1, L2, L3, L4, L5]) await expect(card(page, id).getByTestId("level-status")).toHaveText("Completed");
  await expect(card(page, L6).getByTestId("level-status")).toHaveText("Ready to play");
  await expect(mainAction(page)).toHaveText(/^Starts*Level 6 · Baltic Journey$/);
  await expect(page.getByTestId("all-done")).toHaveCount(0);
  await expect(page.getByText(/Coming soon/)).toHaveCount(0);
  await page.reload();
  await expect(card(page, L6)).toHaveAttribute("data-up-next", "true");
  for (const id of [L1, L2, L3, L4, L5]) {
    await card(page, id).getByTestId("level-details-toggle").click();
    await expect(card(page, id).getByRole("button", { name: /^Play again/ })).toBeVisible();
    // Finished (at its Results): nothing to continue.
    await expect(card(page, id).getByRole("button", { name: /^Continue/ })).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test("Level 5: Start over and Play again ask first and change only this level; Levels 1–5 stay completed", async ({ page }) => {
  test.skip(project() !== "desktop", "Runs once.");
  // In progress: Start over asks, naming the level; confirming resets only Level 5.
  await saveV2(page, { ...EARLIER, [L5]: findAsking("BGR", 1) }, { levelId: L5, recent: [L5, L4, L3, L2, L1] });
  const dialog = page.getByTestId("start-over-dialog");
  await card(page, L5).getByRole("button", { name: /^Start over/ }).click();
  await expect(dialog.getByRole("heading")).toHaveText("Start “Towards Greece” over?");
  await page.keyboard.press("Escape");
  await expect(card(page, L5).getByTestId("level-status")).toHaveText("In progress: Find");
  await card(page, L5).getByRole("button", { name: /^Start over/ }).click();
  await dialog.getByRole("button", { name: "Start over" }).click();
  await expect(page.getByTestId("discover-progress")).toContainText("0/5");
  await homeToEurope(page);
  for (const id of [L1, L2, L3, L4]) await expect(card(page, id).getByTestId("level-status")).toHaveText("Completed");
  await expect(card(page, L5).getByTestId("level-status")).toHaveText("In progress: Discover");

  // Levels 1–5 completed: playing Level 5 again keeps it (and the others) completed, and Level 6
  // unlocked; nothing was reset automatically.
  await saveV2(page, ALL_DONE, { levelId: L5, recent: [L5, L4, L3, L2, L1] });
  await expect(card(page, L6).getByTestId("level-status")).toHaveText("Ready to play");
  await card(page, L5).getByTestId("level-details-toggle").click();
  await card(page, L5).getByRole("button", { name: /^Play again/ }).click();
  await expect(dialog.getByRole("heading")).toHaveText("Play “Towards Greece” again?");
  await dialog.getByRole("button", { name: "Play again" }).click();
  await expect(page.getByTestId("discover-progress")).toContainText("0/5");
  await homeToEurope(page);
  for (const id of [L1, L2, L3, L4, L5]) await expect(card(page, id).getByTestId("level-status")).toHaveText("Completed");
  await expect(card(page, L6).getByTestId("level-status")).toHaveText("Ready to play");
  // Level 4 played again keeps Level 5 open.
  await card(page, L4).getByTestId("level-details-toggle").click();
  await card(page, L4).getByRole("button", { name: /^Play again/ }).click();
  await dialog.getByRole("button", { name: "Play again" }).click();
  await homeToEurope(page);
  await page.reload();
  await expect(card(page, L5).getByTestId("level-status")).toHaveText("Completed");
  await card(page, L5).getByTestId("level-details-toggle").click();
  await expect(card(page, L5).getByRole("button", { name: /^Continue/ })).toBeVisible();
});

/* Screens at a short and an ordinary phone (small-phone, Chromium; webkit-phone, WebKit) and on desktop,
   in both languages: the level selection, each Discover card, unanswered Find, Travel and Results. */
test("Level 5 at phone and desktop sizes: level selection, every card, unanswered Find, Travel and Results", async ({ page }) => {
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

      // The level selection: Level 5 unlocked, then completed (Level 6 up next).
      await saveV2(page, EARLIER, { locale, recent: [L4, L3, L2, L1], levelId: L4 });
      await expect(card(page, L5)).toHaveAttribute("data-up-next", "true");
      await expect(mainAction(page)).toHaveAttribute("data-level", L5);
      await expect(card(page, L5)).toContainText(locale === "en" ? "Hungary · Romania · Serbia · Bulgaria · Greece" : "Հունգարիա · Ռումինիա · Սերբիա · Բուլղարիա · Հունաստան");
      await expectNoHorizontalOverflow(page);
      await shot(page, `${locale}-levels-unlocked`);
      await saveV2(page, ALL_DONE, { locale, recent: [L5, L4, L3, L2, L1], levelId: L5 });
      await expect(card(page, L5).getByTestId("level-status")).toHaveText(locale === "en" ? "Completed" : "Ավարտված է");
      await expect(mainAction(page)).toHaveAttribute("data-level", L6);
      await expectNoHorizontalOverflow(page);
      await shot(page, `${locale}-levels-l5-completed`);

      // Discover: each country's card, with its illustration.
      const squareArt = Math.min(Math.max(112, 0.33 * width), 132) - 12;
      for (const id of L5_COUNTRIES) {
        await openLevel5(page, discoverAt(id), locale);
        await expect(page.getByTestId("country-card")).toHaveAttribute("data-country", id);
        await expectIllustratedLandmark(page, id, locale);
        const title = page.getByTestId("country-card").locator("h2");
        await expect(title).toHaveText(locale === "en" ? NAME_OF[id] : NAMES_HY[id]);
        await expect(page.getByTestId("country-capital")).toContainText(locale === "en" ? CAPITALS[id] : CAPITALS_HY[id]);
        // No word broken that would fit across the whole card.
        await expectWordsWhole(title, where(`${id} title`), page.getByTestId("country-card"));
        await expectWordsWhole(page.getByTestId("country-capital"), where(`${id} capital`), page.getByTestId("country-card"));
        expect(await panel.evaluate((el) => el.scrollTop), where(`${id} card opened scrolled`)).toBe(0);
        // Without scrolling: the name, the capital and the whole artwork, above the pinned button,
        // uncropped and unstretched.
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
          // The square tile, beside the capital (and the name, when it fits beside it).
          const capital = (await page.getByTestId("country-capital").boundingBox())!;
          expect(art.tile.left, where(`${id} tile not beside the capital`)).toBeGreaterThanOrEqual(capital.x + 0.5);
          expect(Math.round(art.tile.right - art.tile.left), where(`${id} square tile`)).toBe(Math.round(art.tile.bottom - art.tile.top));
        }
        if (id === "GRC") {
          // Meteora at its real size: the monastery on the rock's top, for review.
          const drawn = `${art.width.toFixed(0)}×${art.height.toFixed(0)}px`;
          console.log(`${where("Meteora")} drawn ${drawn}`);
          await page.getByTestId("landmark-image").screenshot({ path: `screenshots/${project()}/level5-${locale}-meteora-art-${width}x${height}.png` });
        }
        await expectMapTextClear(page);
        await expectMarkerNamesOwn(page, where(`${id} map`));
        await expectNoHorizontalOverflow(page);
        await shot(page, `${locale}-discover-${id}`);
        // Scrolled to its end, the whole card sits above the pinned button.
        await panel.evaluate((el) => el.scrollTo(0, el.scrollHeight));
        const c = await box("country-card");
        expect(c.y + c.height, where(`${id} card bottom`)).toBeLessThanOrEqual((await box("sticky-actions")).y + 1);
      }

      // Find, unanswered, and after its first hint.
      await openLevel5(page, findAsking("SRB"), locale);
      await expectFindSpoilerFree(page, "SRB");
      await expectWordsWhole(page.getByTestId("find-prompt"), where("Find prompt"));
      await expectNoHorizontalOverflow(page);
      await shot(page, `${locale}-find`);
      await openLevel5(page, findAsking("GRC", 1), locale);
      await expect(panel).toContainText(locale === "en" ? "Meteora" : "Մետեորան");
      await expectFindSpoilerFree(page, "GRC");
      await shot(page, `${locale}-find-hint`);

      // Travel: at the start, and in Bulgaria (three choices, Greece among them). The first choice whole
      // without scrolling on phones; the cards in one or two columns as their names fit.
      for (const path of [["HUN"], ["HUN", "ROU", "BGR"]]) {
        await openLevel5(page, travellingAt(path), locale);
        await expect(page.locator('[data-testid^="move-"]').first()).toBeVisible();
        await fontsSettled(page);
        if (phone) await expectFirstChoiceInView(page, where(`Travel at ${path.at(-1)}`));
        await expectNeighboursClear(page, where(`Travel at ${path.at(-1)}`));
        await expectMapTextClear(page);
        await expectNoHorizontalOverflow(page);
        await shot(page, `${locale}-travel-${path.at(-1)}`);
      }

      // Results.
      await openLevel5(page, L5_DONE, locale);
      await expect(page.getByTestId("result-crossings")).toContainText("3");
      await expect(page.locator('[data-testid="map-main"] [data-testid="route-line"]')).toHaveAttribute("data-points", "11");
      await expectNoHorizontalOverflow(page);
      await shot(page, `${locale}-results`);
    }
  }

  // Enlarged text (phones): the text grows, nothing is cut, and everything is reached by scrolling.
  if (!phone) return;
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    for (const locale of ["en", "hy"] as const) {
      for (const id of ["ROU", "GRC"]) {
        await openLevel5(page, discoverAt(id), locale);
        for (const size of [150, 200]) {
          const where = `${width}×${height} ${locale} ${id} ${size}%`;
          await textSize(page, size);
          const title = page.getByTestId("country-card").locator("h2");
          expect(parseFloat(await title.evaluate((el) => getComputedStyle(el).fontSize)), where).toBeGreaterThanOrEqual(((width < 420 ? 1.2 : 1.45) * 16 * size) / 100 - 0.5);
          await expectWordsWhole(title, `${where} title`);
          await expectWordsWhole(page.getByTestId("landmark-card").locator("figcaption"), `${where} landmark`);
          // The artwork keeps its size and shape, whole in its tile, and is brought into view by scrolling.
          await expectArtReachable(page, where);
          await shot(page, `${locale}-discover-${id}-text${size}-art`);
          await panel.evaluate((el) => el.scrollTo(0, el.scrollHeight));
          const c = await box("country-card");
          expect(c.y + c.height, `${where}: card bottom`).toBeLessThanOrEqual((await box("sticky-actions")).y + 1);
          await expectNoHorizontalOverflow(page);
          await shot(page, `${locale}-discover-${id}-text${size}`);
          await panel.evaluate((el) => el.scrollTo(0, 0));
        }
        await textSize(page, 100);
      }
      // At 200% on the short phone, each country chosen on the map in turn after the previous card was
      // scrolled to its end: the new card opens at its top, leaves room to read, and is reached whole by scrolling.
      if (width === 320) {
        await openLevel5(page, discoverAt("GRC"), locale);
        await textSize(page, 200);
        for (const id of L5_COUNTRIES) {
          const where = `${width}×${height} ${locale} 200% ${id} chosen on the map`;
          await panel.evaluate((el) => el.scrollTo(0, el.scrollHeight));
          expect(await panel.evaluate((el) => el.scrollTop), `${where}: previous card not scrolled`).toBeGreaterThan(0);
          await tapCountry(page, id);
          await expect(page.getByTestId("country-card")).toHaveAttribute("data-country", id);
          await expectIllustratedLandmark(page, id, locale);
          await fontsSettled(page);
          expect(await panel.evaluate((el) => el.scrollTop), `${where}: card opened scrolled`).toBe(0);
          const room = await page.evaluate(() => {
            const top = document.querySelector('[data-testid="panel"]')!.getBoundingClientRect().top;
            const fold = document.querySelector('[data-testid="sticky-actions"]')!.getBoundingClientRect().top;
            return { window: fold - top, line: parseFloat(getComputedStyle(document.querySelector('[data-testid="country-card"] > p:last-child')!).lineHeight) };
          });
          expect(room.window, `${where}: ${room.window.toFixed(0)}px to read through`).toBeGreaterThanOrEqual(2.5 * room.line);
          await shot(page, `${locale}-discover-${id}-text200-top`);
          await expectArtReachable(page, where);
          await shot(page, `${locale}-discover-${id}-text200-art`);
          await panel.evaluate((el) => el.scrollTo(0, el.scrollHeight));
          const c = await box("country-card");
          expect(c.y + c.height, `${where}: card bottom`).toBeLessThanOrEqual((await box("sticky-actions")).y + 1);
        }
        await textSize(page, 100);
      }
      // Find and Travel at 200%: names wrap between words only; every choice and tool reached by scrolling.
      await openLevel5(page, findAsking("BGR"), locale);
      await textSize(page, 200);
      await expectWordsWhole(page.getByTestId("find-prompt"), `${width}×${height} ${locale} Find 200%`);
      await expectNoHorizontalOverflow(page);
      await shot(page, `${locale}-find-text200`);
      await textSize(page, 100);
      await openLevel5(page, travellingAt(["HUN", "ROU", "BGR"]), locale);
      await textSize(page, 200);
      await expectNeighboursClear(page, `${width}×${height} ${locale} Travel 200%`);
      await panel.evaluate((el) => el.scrollTo(0, el.scrollHeight));
      const tools = (await page.getByTestId("travel-tools").boundingBox())!;
      const p = (await panel.boundingBox())!;
      expect(tools.y + tools.height, `${width}×${height} ${locale} Travel 200%: tools under the panel`).toBeLessThanOrEqual(Math.min(p.y + p.height, height) + 0.5);
      await expectNoHorizontalOverflow(page);
      await shot(page, `${locale}-travel-text200`);
      await textSize(page, 100);
    }
  }
});

/* The whole map: every country whole with padding (Crete and Rhodes included), never beyond the prepared
   data; the furthest islands reached by the normal controls; "Show the whole map" returns to the start. */
test("Level 5's map: the start view and reset show all five countries with Greece's islands; no size shows past the data", async ({ page }) => {
  test.skip(project() !== "desktop", "Runs once, across sizes.");
  test.setTimeout(300_000);
  const mapState = () =>
    page.evaluate((ids) => {
      const svg = document.querySelector('[data-testid="map-main"]')!.getBoundingClientRect();
      const countries = ids.map((id) => {
        const r = document.querySelector(`[data-testid="map-main"] path[data-country="${id}"]`)!.getBoundingClientRect();
        return { id, left: r.left - svg.left, top: r.top - svg.top, right: svg.right - r.right, bottom: svg.bottom - r.bottom, width: r.width, height: r.height };
      });
      const overview = document.querySelector('[data-testid="map-main"] [data-family="land"] image[data-level="overview"]')!.getBoundingClientRect();
      const transform = document.querySelector('[data-testid="map-main"] [data-relief]')!.parentElement!.getAttribute("transform");
      return {
        map: { width: svg.width, height: svg.height },
        countries,
        overviewCovers: overview.left <= svg.left + 0.5 && overview.top <= svg.top + 0.5 && overview.right >= svg.right - 0.5 && overview.bottom >= svg.bottom - 0.5,
        transform,
      };
    }, L5_COUNTRIES);
  // Short and ordinary phones, desktops, wide screens, and phones in landscape.
  const sizes = [[320, 568], [390, 844], [412, 915], [1366, 800], [1920, 1080], [2560, 1080], [740, 360], [844, 390]];
  const report: string[] = [];
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await openLevel5(page, discoverAt(null));
    await page.waitForTimeout(300);
    const start = await mapState();
    const where = `${width}×${height} (map ${Math.round(start.map.width)}×${Math.round(start.map.height)})`;
    expect(start.overviewCovers, `${where}: the view shows past the painted coverage`).toBe(true);
    const margin = Math.min(...start.countries.flatMap((c) => [c.left, c.top, c.right, c.bottom]));
    const greece = start.countries.find((c) => c.id === "GRC")!;
    report.push(`${where}: smallest margin ${margin.toFixed(1)}px; Greece (with Crete and Rhodes) ${greece.width.toFixed(0)}×${greece.height.toFixed(0)}px`);
    const aspect = start.map.width / start.map.height;
    // Whole, with padding, on every map from about 1:1.45 to 2.1:1 (see docs/DATA.md); beyond, the view zooms in slightly instead.
    if (aspect >= 1 / 1.45 && aspect <= 2.12) expect(margin, `${where}: a country touches or crosses the edge`).toBeGreaterThanOrEqual(4);
    await page.screenshot({ path: `screenshots/desktop/level5-map-${width}x${height}.png` });
    // Zoomed in and moved as far as it goes towards Rhodes and Crete (south-east), the landscape still covers the view.
    await page.getByRole("button", { name: "Zoom in" }).click();
    await page.getByRole("button", { name: "Zoom in" }).click();
    await page.waitForTimeout(500);
    expect((await mapState()).transform).not.toBe(start.transform);
    const svg = (await page.getByTestId("map-main").boundingBox())!;
    for (let i = 0; i < 2; i++) {
      await page.mouse.move(svg.x + svg.width * 0.8, svg.y + svg.height * 0.8);
      await page.mouse.down();
      await page.mouse.move(svg.x + svg.width * 0.05, svg.y + svg.height * 0.05, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(400);
    }
    const panned = await page.evaluate(() => {
      const svg = document.querySelector('[data-testid="map-main"]')!.getBoundingClientRect();
      const r = document.querySelector('[data-testid="map-main"] path[data-country="GRC"]')!.getBoundingClientRect();
      return { right: r.right <= svg.right + 0.5, bottom: r.bottom <= svg.bottom + 0.5 };
    });
    // Greece's far south-east (Rhodes) and south (Crete, Gavdos) are within reach of the pan limits.
    expect(panned, `${where}: Greece's south-east edge can't be panned into view`).toEqual({ right: true, bottom: true });
    expect((await mapState()).overviewCovers, `${where}: panned past the painted coverage`).toBe(true);
    if ([390, 1366].includes(width)) await page.screenshot({ path: `screenshots/desktop/level5-map-islands-panned-${width}x${height}.png` });
    await page.getByRole("button", { name: "Show the whole map" }).click();
    await expect.poll(async () => (await mapState()).transform, { timeout: 5000 }).toBe(start.transform);
    expect((await mapState()).overviewCovers).toBe(true);
  }
  test.info().annotations.push({ type: "margins", description: report.join("; ") });
  console.log(report.join("\n"));
});

/* The landscape: only Level 5's own overview, its overlay once a country has a state colour, and tiles only when zoomed. */
test("Level 5 loads its own landscape overview, and zoomed tiles only for the view", async ({ page }) => {
  test.skip(project() !== "mobile", "Runs once.");
  await saveV2(page, { ...EARLIER, [L5]: discoverAt(null) }, { levelId: L4, recent: [L4, L3, L2, L1] });
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await card(page, L5).getByRole("button", { name: /^Continue/ }).click();
  const main = page.getByTestId("map-main");
  await expect(main.locator('[data-family="land"] image[data-level="overview"]')).toHaveCount(1);
  await expect.poll(() => requests.some((u) => /towards-greece-land/.test(u))).toBe(true);
  await page.waitForTimeout(500);
  expect(requests.filter((u) => /(western-europe-1|around-the-alps|central-europe|along-the-adriatic)-(land|tone)/.test(u)), "another level's overview").toEqual([]);
  expect(requests.filter((u) => /towards-greece-tone/.test(u)), "the overlay before any state colour").toEqual([]);
  expect(requests.filter((u) => u.includes("/relief/")), "zoomed tiles at the whole-map view").toEqual([]);
  // A selection gives Greece a state colour: its overlay is loaded.
  await tapCountry(page, "GRC");
  await expect(main.locator('[data-family="tone"] image[data-level="overview"]')).toHaveCount(1);
  await expect.poll(() => requests.some((u) => /towards-greece-tone/.test(u))).toBe(true);
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
