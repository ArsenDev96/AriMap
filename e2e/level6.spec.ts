import { expect, test, type Locator, type Page } from "@playwright/test";
import { openWithSave } from "./helpers/save";

/*
 * Level 6 (Baltic Journey) from Discover to Results, its unlock from Level 5 (an existing save),
 * its five landmark cards (Germany's and Poland's illustrated, as in earlier levels; Lithuania's,
 * Latvia's and Estonia's as text until their artwork exists), the Germany → Estonia journey
 * (one shortest route), the level selection once all six levels are completed, and its map:
 * framing (Estonia's islands included), reset, and the landscape it loads.
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
const L6_COUNTRIES = ["DEU", "POL", "LTU", "LVA", "EST"];
const NAMES: Record<string, string> = { Germany: "DEU", Poland: "POL", Lithuania: "LTU", Latvia: "LVA", Estonia: "EST" };
const NAME_OF = Object.fromEntries(Object.entries(NAMES).map(([name, id]) => [id, name]));
const NAMES_HY: Record<string, string> = { DEU: "Գերմանիա", POL: "Լեհաստան", LTU: "Լիտվա", LVA: "Լատվիա", EST: "Էստոնիա" };
const CAPITALS: Record<string, string> = { DEU: "Berlin", POL: "Warsaw", LTU: "Vilnius", LVA: "Riga", EST: "Tallinn" };
const CAPITALS_HY: Record<string, string> = { DEU: "Բեռլին", POL: "Վարշավա", LTU: "Վիլնյուս", LVA: "Ռիգա", EST: "Տալլին" };
const LANDMARKS: Record<string, string> = { DEU: "Brandenburg Gate", POL: "Wawel Castle", LTU: "Trakai Island Castle", LVA: "House of the Black Heads", EST: "Tallinn Town Hall" };
const LANDMARKS_HY: Record<string, string> = { DEU: "Բրանդենբուրգյան դարպասներ", POL: "Վավելի ամրոց", LTU: "Տրակայի կղզու դղյակ", LVA: "Սևագլուխների տուն", EST: "Տալլինի ռատուշա" };
/** In a sentence (Find's first hint). */
const LANDMARKS_IN_TEXT: Record<string, string> = { DEU: "the Brandenburg Gate", POL: "Wawel Castle", LTU: "Trakai Island Castle", LVA: "the House of the Black Heads", EST: "Tallinn Town Hall" };
const LANDMARK_IDS: Record<string, string> = { DEU: "brandenburg-gate", POL: "wawel-castle", LTU: "trakai-island-castle", LVA: "house-of-the-black-heads", EST: "tallinn-town-hall" };
/** Germany's and Poland's artwork is shared with earlier levels; the Baltic three have none yet. */
const ILLUSTRATED = ["DEU", "POL"];
const TEXT_ONLY = ["LTU", "LVA", "EST"];

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
/** A save from before Level 6 existed: Levels 1–5 completed. */
const EARLIER = { [L1]: L1_DONE, [L2]: L2_DONE, [L3]: L3_DONE, [L4]: L4_DONE, [L5]: L5_DONE };
const EARLIER_RECENT = [L5, L4, L3, L2, L1];
const ALL_DONE = { ...EARLIER, [L6]: L6_DONE };
const ALL_RECENT = [L6, ...EARLIER_RECENT];

const discoverAt = (selected: string | null) => ({ started: true, stage: "discover", discover: { selected, explored: selected ? [selected] : [] }, records: records(false) });
const findAsking = (target: string, hintLevel = 0) => ({
  started: true,
  stage: "find",
  discover: { selected: null, explored: L6_COUNTRIES },
  find: { order: [target, ...L6_COUNTRIES.filter((c) => c !== target)], index: 0, question: { target, wrongGuesses: [], hintLevel, solved: false, feedback: null }, results: [], status: "asking" },
  records: records(false),
});
const travellingAt = (path: string[]) => ({
  started: true,
  stage: "travel",
  discover: { selected: null, explored: L6_COUNTRIES },
  find: findDone(L6_COUNTRIES),
  travel: { missionId: "deu-to-est", path, hintUsed: false, undoUsed: false },
  records: { ...records(false), findDone: true },
});

const project = () => test.info().project.name;
const COMPLETION = {
  en: "You've completed all 6 levels! Play any of them again whenever you like.",
  hy: "Ավարտել ես բոլոր 6 մակարդակները։ Կարող ես ցանկացածը նորից խաղալ։",
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

/** Opens Level 6 directly in a given state, Levels 1–5 completed. */
async function openLevel6(page: Page, level6: object, locale = "en") {
  await saveV2(page, { ...EARLIER, [L6]: level6 }, { locale, screen: "lesson", levelId: L6, recent: ALL_RECENT });
  for (const id of L6_COUNTRIES) await expect(page.locator(`[data-testid="map-main"] path[data-country="${id}"]`)).toBeVisible();
}

async function shot(page: Page, name: string) {
  const { width, height } = page.viewportSize()!;
  await page.screenshot({ path: `screenshots/${project()}/level6-${name}-${width}x${height}.png` });
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

/**
 * An on-screen point that hits the country's own path (not a neighbour, label or control), nearest
 * the middle of its hits; `part` limits the search to a fraction of the path's box from its left.
 */
async function countryPoint(page: Page, id: string, part: [number, number] = [0, 1]) {
  return page.evaluate(
    ([id, [p0, p1]]) => {
      const path = document.querySelector(`[data-testid="map-main"] path[data-country="${id}"]`)!;
      const r = path.getBoundingClientRect();
      const hits: [number, number][] = [];
      for (let i = 1; i < 48; i++)
        for (let j = 1; j < 48; j++) {
          const f = i / 48;
          if (f < p0 || f > p1) continue;
          const [x, y] = [r.left + r.width * f, r.top + (r.height * j) / 48];
          if (document.elementFromPoint(x, y) === path) hits.push([x, y]);
        }
      if (hits.length === 0) return null;
      const cx = hits.reduce((s, h) => s + h[0], 0) / hits.length;
      const cy = hits.reduce((s, h) => s + h[1], 0) / hits.length;
      hits.sort((a, b) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy));
      return hits[0];
    },
    [id, part] as const,
  );
}

async function tapAt(page: Page, point: [number, number]) {
  if (test.info().project.use.hasTouch) await page.touchscreen.tap(point[0], point[1]);
  else await page.mouse.click(point[0], point[1]);
}

async function tapCountry(page: Page, id: string) {
  const point = await countryPoint(page, id);
  expect(point, `${id} should be tappable`).not.toBeNull();
  await tapAt(page, point!);
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

/** No landmark artwork anywhere on the page (Find: the hint names the landmark in words only). */
async function expectNoLandmarkArt(page: Page) {
  await expect(page.getByTestId("landmark-image")).toHaveCount(0);
  const art = new RegExp(Object.values(LANDMARK_IDS).join("|"));
  const sources = await page.locator("img, image").evaluateAll((els) => els.map((e) => e.getAttribute("src") ?? e.getAttribute("href") ?? ""));
  expect(sources.filter((s) => art.test(s))).toEqual([]);
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
  }, L6_COUNTRIES);
  expect(Object.keys(styling).sort()).toEqual([...L6_COUNTRIES].sort());
  for (const id of L6_COUNTRIES) expect(styling[id], `${id} styled differently from the target ${target}`).toBe(styling[target]);
}

/**
 * A Level 6 landmark card. Germany's and Poland's show their own illustration, as in earlier levels;
 * Lithuania's, Latvia's and Estonia's are text only: the landmark mark beside the name and fact, and
 * no picture frame at all (no empty tile, no image).
 */
async function expectLandmarkCard(page: Page, id: string, locale: "en" | "hy") {
  const figure = page.getByTestId("landmark-card");
  await expect(figure).toHaveAttribute("data-landmark", LANDMARK_IDS[id]);
  await expect(figure).toContainText(locale === "en" ? LANDMARKS[id] : LANDMARKS_HY[id]);
  // Its fact, a sentence, follows the name.
  expect(((await figure.locator("figcaption span").last().textContent()) ?? "").length).toBeGreaterThan(30);
  if (ILLUSTRATED.includes(id)) {
    await expect(figure).toHaveAttribute("data-art", "illustration");
    const image = page.getByTestId("landmark-image");
    await expect(image).toHaveCount(1);
    await expect(image).toHaveAttribute("src", new RegExp(LANDMARK_IDS[id]));
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  } else {
    await expect(figure).toHaveAttribute("data-art", "none");
    await expect(page.getByTestId("landmark-image")).toHaveCount(0);
    await expect(page.getByTestId("panel").locator("img")).toHaveCount(0);
    // No frame or stage for a picture: only the mark (an inline SVG) and the caption.
    expect(await figure.evaluate((f) => [...f.children].map((c) => c.tagName.toLowerCase()))).toEqual(["svg", "figcaption"]);
    // The caption takes the card's width beside the mark, not a narrow column.
    const [fig, caption] = [(await figure.boundingBox())!, (await figure.locator("figcaption").boundingBox())!];
    expect(caption.width, `${id}: caption narrow`).toBeGreaterThan(fig.width * 0.6);
  }
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

/** Travel's neighbour cards: never cut, touch-sized, one line each in two columns. */
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

test("Level 6, Baltic Journey: unlock from a Level 5 save, Discover, Find, Travel, Results, and all six levels completed", async ({ page }) => {
  test.skip(project() !== "mobile", "Runs once, on the Pixel 7 project; layouts are checked at other sizes below.");
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" || /hydrat/i.test(m.text())) errors.push(`console ${m.type()}: ${m.text()}`);
  });
  // A save from before Level 6 existed: Levels 1–5 completed, nothing for Level 6.
  await saveV2(page, EARLIER, { levelId: L5, recent: EARLIER_RECENT });
  await expect(card(page, L6).getByTestId("level-status")).toHaveText("Ready to play");
  await expect(card(page, L6)).toContainText("Germany · Poland · Lithuania · Latvia · Estonia");
  await expect(card(page, L6)).toContainText("Baltic Journey");
  await expect(card(page, L6)).toHaveAttribute("data-up-next", "true");
  await expect(mainAction(page)).toHaveText(/^Start\s*Level 6 · Baltic Journey$/);
  for (const id of [L1, L2, L3, L4, L5]) await expect(card(page, id).getByTestId("level-status")).toHaveText("Completed");
  await expect(page.getByTestId("all-done")).toHaveCount(0);
  await mainAction(page).click();

  // --- Discover -----------------------------------------------------------------
  await expect(page.getByRole("heading", { name: "Tap a country to learn about it." })).toBeAttached();
  await expect(page.getByTestId("map-main")).toHaveAttribute("aria-label", "Map of the Baltic Sea countries");
  await expect(page.getByTestId("inset-toggle")).toHaveCount(0);
  await expect(page.getByTestId("map-inset")).toHaveCount(0);
  await expectMapTextClear(page);
  const cardEl = page.getByTestId("country-card");
  for (const id of L6_COUNTRIES) {
    await tapCountry(page, id);
    await expect(cardEl).toHaveAttribute("data-country", id);
    await expect(cardEl.getByRole("heading", { level: 2 })).toHaveText(NAME_OF[id]);
    await expect(page.getByTestId("country-capital")).toContainText(CAPITALS[id]);
    await expectLandmarkCard(page, id, "en");
    await expect(page.locator('[data-testid="map-main"] [data-marker-text]').first()).toBeAttached();
    await expectMapTextClear(page);
    await expectMarkerNamesOwn(page, `${id}`);
    await expectWordsWhole(cardEl.getByRole("heading", { level: 2 }), `${id} card title`);
  }
  // This level's own descriptions for Germany and Poland (south-west and south here).
  await tapCountry(page, "DEU");
  await expect(cardEl).toContainText("in the south-west of this region");
  await tapCountry(page, "POL");
  await expect(cardEl).toContainText("in the south of this region, east of Germany");
  await tapCountry(page, "EST");
  await expect(cardEl).toContainText("northernmost country of this region");
  await expect(page.getByTestId("discover-progress")).toContainText("5/5");
  await setLanguage(page, "Հայերեն");
  await tapCountry(page, "LVA");
  await expect(cardEl.getByRole("heading", { name: "Լատվիա" })).toBeVisible();
  await expect(page.getByTestId("country-capital")).toContainText("Ռիգա");
  await expectLandmarkCard(page, "LVA", "hy");
  await expect(page.getByTestId("map-main")).toHaveAttribute("aria-label", "Քարտեզ՝ Բալթիկ ծովի երկրներ");
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
      const wrong = target === "DEU" ? "POL" : "DEU";
      await tapCountry(page, wrong);
      await expect(page.getByTestId("find-feedback")).toContainText("Try again.");
      await page.getByRole("button", { name: "Hint" }).click();
      await expect(page.getByTestId("panel")).toContainText(`Its capital is ${CAPITALS[target]}.`);
      await expect(page.getByTestId("panel")).toContainText(`You'll also find ${LANDMARKS_IN_TEXT[target]} there.`);
      // The first hint names the capital and landmark only: nothing on the map points at the target.
      await expectNoLandmarkArt(page);
      await expect(page.getByTestId("landmark-card")).toHaveCount(0);
      expect(await page.locator('[data-testid="map-main"] text').allTextContents()).toEqual([NAME_OF[wrong]]);
      await expect(page.locator(`[data-testid="map-main"] path[data-country="${target}"][data-tone]:not([data-tone="default"])`)).toHaveCount(0);
      await expect(page.locator("[data-marker-text]")).toHaveCount(0);
      // Home and a refresh keep the question exactly; Continue resumes it.
      await page.getByTestId("home").click();
      await expect(mainAction(page)).toHaveText(/^Continue\s*Level 6 · Baltic Journey$/);
      await expect(card(page, L6).getByTestId("level-status")).toHaveText("In progress: Find");
      await page.reload();
      await mainAction(page).click();
      await expect(page.getByTestId("find-prompt")).toHaveText(`Find ${text}`);
      await expect(page.getByText(/Its capital is/)).toBeVisible();
    }
    await tapCountry(page, target);
    await expect(page.getByTestId("find-feedback")).toBeVisible();
    await page.getByRole("button", { name: q < 4 ? "Next" : "Continue to Travel" }).click();
  }
  expect([...asked].sort()).toEqual([...L6_COUNTRIES].sort());

  // --- Travel -------------------------------------------------------------------
  await expect(page.getByRole("heading", { name: /Germany.*Estonia/ })).toBeVisible();
  await expect(page.getByText("Shortest route: 4 crossings")).toBeVisible();
  const moves = async () => (await page.locator('[data-testid^="move-"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")!.slice(5)))).sort();
  const route = page.locator('[data-testid="map-main"] [data-testid="route-line"]');
  // Every real neighbour in the level, and no others: Germany meets only Poland here.
  expect(await moves()).toEqual(["POL"]);
  await page.getByTestId("move-POL").click();
  expect(await moves()).toEqual(["DEU", "LTU"]);
  // Berlin → the Oder → Warsaw: straight legs.
  await expect(route).toHaveAttribute("data-route", "DEU,POL");
  await expect(route).toHaveAttribute("data-points", "3");
  // Back into Germany and on again: a crossing wasted, so the journey runs out in Lithuania.
  await page.getByTestId("move-DEU").click();
  await page.getByTestId("move-POL").click();
  await page.getByTestId("move-LTU").click();
  await expect(page.getByTestId("out-of-crossings")).toBeVisible();
  await page.getByTestId("out-of-crossings").getByRole("button", { name: "Undo" }).click();
  await expect(page.getByTestId("crossings-left")).toHaveText("1 crossing left");
  await page.reload();
  // A refresh keeps the journey where it was.
  await expect(route).toHaveAttribute("data-route", "DEU,POL,DEU,POL");
  await page.getByRole("button", { name: "Restart" }).click();
  await expect(route).toHaveCount(0);
  expect(await moves()).toEqual(["POL"]);
  await expect(page.getByText("Help used on this journey")).toBeVisible();
  await page.getByTestId("move-POL").click();
  await page.getByTestId("move-LTU").click();
  // Lithuania meets Latvia (and Poland), not Estonia.
  expect(await moves()).toEqual(["LVA", "POL"]);
  await page.getByTestId("move-LVA").click();
  expect(await moves()).toEqual(["EST", "LTU"]);
  await page.getByTestId("move-EST").click();

  // --- Results ------------------------------------------------------------------
  await expect(page.getByRole("heading", { name: "Journey complete!" })).toBeVisible();
  for (const name of ["Germany", "Poland", "Lithuania", "Latvia", "Estonia"]) await expect(page.getByTestId("result-route")).toContainText(name);
  await expect(page.getByTestId("result-crossings")).toContainText("4 of 4");
  await expect(page.getByTestId("result-help")).toContainText("Undo");
  await expect(page.getByTestId("result-find-answers").locator("li")).toHaveCount(5);
  await expect(page.getByTestId("result-find")).toContainText("4/5");
  // Capital → crossing → capital for each of the four moves: 9 points, no turning points.
  await expect(route).toHaveAttribute("data-route", "DEU,POL,LTU,LVA,EST");
  await expect(route).toHaveAttribute("data-points", "9");
  await setLanguage(page, "Հայերեն");
  await expect(page.getByRole("heading", { name: "Ճամփորդությունն ավարտվեց։" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await setLanguage(page, "English");

  // Replay journey without help: the badge.
  await page.getByRole("button", { name: "Replay journey" }).click();
  await expect(page.getByTestId("crossings-left")).toHaveText("4 crossings left");
  for (const id of ["POL", "LTU", "LVA", "EST"]) await page.getByTestId(`move-${id}`).click();
  await expect(page.getByRole("heading", { name: "Journey complete!" })).toBeVisible();
  await expect(page.getByTestId("result-help")).toHaveText(/Help used\s*None/);
  await expect(page.getByTestId("badge")).toBeVisible();

  // The level selection: all six levels completed. No level to start, the completion message with the
  // real count, and every level still open to play again.
  await page.getByTestId("home").click();
  for (const id of [L1, L2, L3, L4, L5, L6]) await expect(card(page, id).getByTestId("level-status")).toHaveText("Completed");
  await expect(page.getByTestId("welcome-actions")).toHaveCount(0);
  await expect(page.getByTestId("all-done")).toHaveText(COMPLETION.en);
  await expect(page.getByTestId("all-done")).toHaveAttribute("data-all-complete", "true");
  await page.reload();
  await expect(page.getByTestId("all-done")).toBeVisible();
  for (const id of [L1, L2, L3, L4, L5, L6]) {
    await card(page, id).getByTestId("level-details-toggle").click();
    await expect(card(page, id).getByRole("button", { name: /^Play again/ })).toBeVisible();
    await expect(card(page, id).getByRole("button", { name: /^Continue/ })).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("Level 6: independent saves; Start over and Play again change only this level; all six stay completed", async ({ page }) => {
  test.skip(project() !== "desktop", "Runs once.");
  // In progress in Level 6, with Level 5 being replayed: each keeps its own place.
  const l5Replaying = { ...L5_DONE, stage: "travel", travel: { missionId: "hun-to-grc", path: ["HUN", "SRB"], hintUsed: false, undoUsed: false } };
  await saveV2(page, { ...EARLIER, [L5]: l5Replaying, [L6]: findAsking("LVA", 1) }, { levelId: L6, recent: ALL_RECENT });
  await expect(mainAction(page)).toHaveText(/^Continue\s*Level 6 · Baltic Journey$/);
  await expect(card(page, L6).getByTestId("level-status")).toHaveText("In progress: Find");
  await expect(card(page, L5).getByTestId("level-status")).toHaveText("Completed");
  // Level 5's replay resumes in its Travel; Level 6 then resumes at its Find question with the hint shown.
  await card(page, L5).getByTestId("level-details-toggle").click();
  await card(page, L5).getByRole("button", { name: /^Continue/ }).click();
  await expect(page.locator('[data-testid="map-main"] [data-testid="route-line"]')).toHaveAttribute("data-route", "HUN,SRB");
  await page.getByTestId("home").click();
  await card(page, L6).getByRole("button", { name: /^Continue/ }).click();
  await expect(page.getByTestId("find-prompt")).toHaveText("Find Latvia");
  await expect(page.getByTestId("panel")).toContainText("Its capital is Riga.");
  await page.reload();
  await expect(page.getByTestId("find-prompt")).toHaveText("Find Latvia");
  await page.getByTestId("home").click();

  // Start over asks, naming the level; confirming resets only Level 6.
  const dialog = page.getByTestId("start-over-dialog");
  await card(page, L6).getByRole("button", { name: /^Start over/ }).click();
  await expect(dialog.getByRole("heading")).toHaveText("Start “Baltic Journey” over?");
  await page.keyboard.press("Escape");
  await expect(card(page, L6).getByTestId("level-status")).toHaveText("In progress: Find");
  await card(page, L6).getByRole("button", { name: /^Start over/ }).click();
  await dialog.getByRole("button", { name: "Start over" }).click();
  await expect(page.getByTestId("discover-progress")).toContainText("0/5");
  await page.getByTestId("home").click();
  for (const id of [L1, L2, L3, L4, L5]) await expect(card(page, id).getByTestId("level-status")).toHaveText("Completed");
  await expect(card(page, L6).getByTestId("level-status")).toHaveText("In progress: Discover");
  await card(page, L5).getByTestId("level-details-toggle").click();
  await card(page, L5).getByRole("button", { name: /^Continue/ }).click();
  await expect(page.locator('[data-testid="map-main"] [data-testid="route-line"]')).toHaveAttribute("data-route", "HUN,SRB");
  await page.getByTestId("home").click();

  // All six completed: playing Level 6 again keeps it (and the others) completed, and the completion
  // message stays; nothing was reset automatically.
  await saveV2(page, ALL_DONE, { levelId: L6, recent: ALL_RECENT });
  await expect(page.getByTestId("all-done")).toHaveText(COMPLETION.en);
  await card(page, L6).getByTestId("level-details-toggle").click();
  await card(page, L6).getByRole("button", { name: /^Play again/ }).click();
  await expect(dialog.getByRole("heading")).toHaveText("Play “Baltic Journey” again?");
  await dialog.getByRole("button", { name: "Play again" }).click();
  await expect(page.getByTestId("discover-progress")).toContainText("0/5");
  await page.getByTestId("home").click();
  for (const id of [L1, L2, L3, L4, L5, L6]) await expect(card(page, id).getByTestId("level-status")).toHaveText("Completed");
  await expect(page.getByTestId("all-done")).toHaveAttribute("data-all-complete", "true");
  // Level 5 played again keeps Level 6 open.
  await card(page, L5).getByTestId("level-details-toggle").click();
  await card(page, L5).getByRole("button", { name: /^Play again/ }).click();
  await dialog.getByRole("button", { name: "Play again" }).click();
  await page.getByTestId("home").click();
  await page.reload();
  await expect(card(page, L6).getByTestId("level-status")).toHaveText("Completed");
  await card(page, L6).getByTestId("level-details-toggle").click();
  await expect(card(page, L6).getByRole("button", { name: /^Continue/ })).toBeVisible();
});

/* The level selection on arrival at phone sizes, in both languages and with enlarged text: Level 6's
   title and status in view below the five completed levels; then all six completed. */
test("Level 6 on the level selection: its title and status in view on arrival; all six completed", async ({ page }) => {
  test.skip(!["small-phone", "desktop", "webkit-phone"].includes(project()), "Runs on small-phone, webkit-phone and desktop.");
  test.setTimeout(600_000);
  const sizes = project() === "desktop" ? [[1366, 800]] : project() === "webkit-phone" ? [[320, 568], [390, 664]] : [[320, 568], [390, 844]];
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    for (const locale of ["en", "hy"] as const) {
      for (const size of project() === "desktop" ? [100] : [100, 150, 200]) {
        const where = `${width}×${height} ${locale} ${size}%`;
        // Arriving with the text size already set: from inside Level 5, by Home.
        await saveV2(page, EARLIER, { locale, screen: "lesson", levelId: L5, recent: EARLIER_RECENT });
        await textSize(page, size);
        await page.getByTestId("home").click();
        await expect(page.getByTestId("welcome")).toBeVisible();
        await fontsSettled(page);
        await expect(card(page, L6)).toHaveAttribute("data-up-next", "true");
        await expect(mainAction(page)).toHaveAttribute("data-level", L6);
        const at = await arrival(page);
        expect(at.pageScroll, `${where}: the page scrolled`).toBe(0);
        expect(at.title, where).not.toBeNull();
        expect(at.title!.top, `${where}: Level 6's title above the list`).toBeGreaterThanOrEqual(at.scroll.top - 0.5);
        expect(at.title!.bottom, `${where}: Level 6's title under the list`).toBeLessThanOrEqual(at.scroll.bottom + 0.5);
        if (size === 100) expect(at.status!.bottom, `${where}: Level 6's status hidden`).toBeLessThanOrEqual(at.scroll.bottom + 0.5);
        expect(at.scroll.bottom, `${where}: list under the action`).toBeLessThanOrEqual(at.action!.top + 0.5);
        expect(at.action!.bottom, `${where}: action off screen`).toBeLessThanOrEqual(at.height + 0.5);
        await expectWordsWhole(card(page, L6).locator("[data-level-title]"), `${where} Level 6 title`);
        await expectNoHorizontalOverflow(page);
        await shot(page, `${locale}-levels-unlocked-text${size}`);
        await textSize(page, 100);
      }
      // A fresh load (refresh) arrives the same way.
      await saveV2(page, EARLIER, { locale, levelId: L5, recent: EARLIER_RECENT });
      const fresh = await arrival(page);
      expect(fresh.status!.bottom, `${width}×${height} ${locale} refresh: Level 6's status hidden`).toBeLessThanOrEqual(fresh.scroll.bottom + 0.5);
      await shot(page, `${locale}-levels-unlocked`);

      // All six completed: the completion message with the real count, nothing to start.
      await saveV2(page, ALL_DONE, { locale, recent: ALL_RECENT, levelId: L6 });
      await expect(page.getByTestId("all-done")).toHaveText(COMPLETION[locale]);
      await expect(page.getByTestId("welcome-actions")).toHaveCount(0);
      await expectWordsWhole(page.getByTestId("all-done").locator("span"), `${width}×${height} ${locale} completion message`);
      await expectNoHorizontalOverflow(page);
      await shot(page, `${locale}-levels-all-completed`);
      await page.getByTestId("welcome-scroll").evaluate((el) => el.scrollTo(0, el.scrollHeight));
      await card(page, L6).getByTestId("level-details-toggle").click();
      await expect(card(page, L6).getByRole("button", { name: locale === "en" ? /^Play again/ : /^Խաղալ նորից/ })).toBeVisible();
      await shot(page, `${locale}-levels-all-completed-l6-opened`);
    }
  }
});

/* Screens at a short and an ordinary phone (small-phone, Chromium; webkit-phone, WebKit) and on desktop,
   in both languages: each Discover card, unanswered Find, Travel and Results; enlarged text on phones. */
test("Level 6 at phone and desktop sizes: every card, unanswered Find, Travel and Results", async ({ page }) => {
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

      // Discover: each country's card.
      for (const id of L6_COUNTRIES) {
        await openLevel6(page, discoverAt(id), locale);
        await expect(page.getByTestId("country-card")).toHaveAttribute("data-country", id);
        await expectLandmarkCard(page, id, locale);
        const title = page.getByTestId("country-card").locator("h2");
        await expect(title).toHaveText(locale === "en" ? NAME_OF[id] : NAMES_HY[id]);
        await expect(page.getByTestId("country-capital")).toContainText(locale === "en" ? CAPITALS[id] : CAPITALS_HY[id]);
        await expectWordsWhole(title, where(`${id} title`), page.getByTestId("country-card"));
        await expectWordsWhole(page.getByTestId("country-capital"), where(`${id} capital`), page.getByTestId("country-card"));
        await expectWordsWhole(page.getByTestId("landmark-card").locator("figcaption"), where(`${id} landmark`));
        expect(await panel.evaluate((el) => el.scrollTop), where(`${id} card opened scrolled`)).toBe(0);
        // Without scrolling: the name and the capital above the pinned button.
        const fold = (await box("sticky-actions")).y;
        const panelBox = await box("panel");
        for (const part of [title, page.getByTestId("country-capital")]) {
          const b = (await part.boundingBox())!;
          expect(b.y, where(`${id} ${await part.textContent()} above the panel`)).toBeGreaterThanOrEqual(panelBox.y);
          expect(b.y + b.height, where(`${id} ${await part.textContent()} under the button`)).toBeLessThanOrEqual(fold + 1);
        }
        await expectMapTextClear(page);
        await expectMarkerNamesOwn(page, where(`${id} map`));
        await expectNoHorizontalOverflow(page);
        await shot(page, `${locale}-discover-${id}`);
        // Scrolled to its end, the whole card sits above the pinned button.
        await panel.evaluate((el) => el.scrollTo(0, el.scrollHeight));
        const c = await box("country-card");
        expect(c.y + c.height, where(`${id} card bottom`)).toBeLessThanOrEqual((await box("sticky-actions")).y + 1);
        if (TEXT_ONLY.includes(id)) await shot(page, `${locale}-discover-${id}-scrolled`);
      }

      // Find, unanswered, and after its first hint.
      await openLevel6(page, findAsking("LTU"), locale);
      await expectFindSpoilerFree(page, "LTU");
      await expectWordsWhole(page.getByTestId("find-prompt"), where("Find prompt"));
      await expectNoHorizontalOverflow(page);
      await shot(page, `${locale}-find`);
      await openLevel6(page, findAsking("EST", 1), locale);
      await expect(panel).toContainText(locale === "en" ? "Tallinn Town Hall" : LANDMARKS_HY.EST);
      await expectFindSpoilerFree(page, "EST");
      await shot(page, `${locale}-find-hint`);

      // Travel: at the start, and in Lithuania (two choices). The first choice whole without scrolling on phones.
      for (const path of [["DEU"], ["DEU", "POL", "LTU"]]) {
        await openLevel6(page, travellingAt(path), locale);
        await expect(page.locator('[data-testid^="move-"]').first()).toBeVisible();
        await fontsSettled(page);
        if (phone) await expectFirstChoiceInView(page, where(`Travel at ${path.at(-1)}`));
        await expectNeighboursClear(page, where(`Travel at ${path.at(-1)}`));
        await expectMapTextClear(page);
        await expectNoHorizontalOverflow(page);
        await shot(page, `${locale}-travel-${path.at(-1)}`);
      }

      // Results.
      await openLevel6(page, L6_DONE, locale);
      await expect(page.getByTestId("result-crossings")).toContainText("4");
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
      for (const id of ["LVA", "EST"]) {
        await openLevel6(page, discoverAt(id), locale);
        for (const size of [150, 200]) {
          const where = `${width}×${height} ${locale} ${id} ${size}%`;
          await textSize(page, size);
          const title = page.getByTestId("country-card").locator("h2");
          expect(parseFloat(await title.evaluate((el) => getComputedStyle(el).fontSize)), where).toBeGreaterThanOrEqual(((width < 420 ? 1.2 : 1.45) * 16 * size) / 100 - 0.5);
          await expectWordsWhole(title, `${where} title`);
          await expectWordsWhole(page.getByTestId("landmark-card").locator("figcaption"), `${where} landmark`);
          await expect(page.getByTestId("landmark-card")).toHaveAttribute("data-art", "none");
          await shot(page, `${locale}-discover-${id}-text${size}`);
          await panel.evaluate((el) => el.scrollTo(0, el.scrollHeight));
          const c = await box("country-card");
          expect(c.y + c.height, `${where}: card bottom`).toBeLessThanOrEqual((await box("sticky-actions")).y + 1);
          await expectNoHorizontalOverflow(page);
          await shot(page, `${locale}-discover-${id}-text${size}-end`);
          await panel.evaluate((el) => el.scrollTo(0, 0));
        }
        await textSize(page, 100);
      }
      // Find and Travel at 200%: names wrap between words only; every choice and tool reached by scrolling.
      await openLevel6(page, findAsking("LTU"), locale);
      await textSize(page, 200);
      await expectWordsWhole(page.getByTestId("find-prompt"), `${width}×${height} ${locale} Find 200%`);
      await expectNoHorizontalOverflow(page);
      await shot(page, `${locale}-find-text200`);
      await textSize(page, 100);
      await openLevel6(page, travellingAt(["DEU", "POL", "LTU"]), locale);
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

/* The whole map: every country whole with padding (Estonia's islands included), never beyond the prepared
   data; Estonia's islands reached and tapped with the normal controls; "Show the whole map" returns to the start. */
test("Level 6's map: the start view and reset show all five countries with Estonia's islands; no size shows past the data", async ({ page }) => {
  test.skip(project() !== "desktop", "Runs once, across sizes.");
  test.setTimeout(400_000);
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
    }, L6_COUNTRIES);
  // Short and ordinary phones, desktops, wide screens, and phones in landscape.
  const sizes = [[320, 568], [390, 844], [412, 915], [1366, 800], [1920, 1080], [2560, 1080], [740, 360], [844, 390]];
  const report: string[] = [];
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await openLevel6(page, discoverAt(null));
    await page.waitForTimeout(300);
    const start = await mapState();
    const where = `${width}×${height} (map ${Math.round(start.map.width)}×${Math.round(start.map.height)})`;
    expect(start.overviewCovers, `${where}: the view shows past the painted coverage`).toBe(true);
    const margin = Math.min(...start.countries.flatMap((c) => [c.left, c.top, c.right, c.bottom]));
    const sizesOf = start.countries.map((c) => `${c.id} ${c.width.toFixed(0)}×${c.height.toFixed(0)}`).join(", ");
    report.push(`${where}: smallest margin ${margin.toFixed(1)}px; ${sizesOf}`);
    const aspect = start.map.width / start.map.height;
    // Whole, with padding, on maps from about 1:1.2 to 1.9:1 (see docs/DATA.md); beyond, the view zooms in slightly instead.
    if (aspect >= 1 / 1.2 && aspect <= 1.9) expect(margin, `${where}: a country touches or crosses the edge`).toBeGreaterThanOrEqual(4);
    await page.screenshot({ path: `screenshots/desktop/level6-map-${width}x${height}.png` });
    // Zoomed in and moved as far as it goes north, then north-east (Estonia, the Gulf of Finland, Russia):
    // the landscape still covers the view, so no edge of the prepared data shows.
    await page.getByRole("button", { name: "Zoom in" }).click();
    await page.getByRole("button", { name: "Zoom in" }).click();
    await page.waitForTimeout(500);
    expect((await mapState()).transform).not.toBe(start.transform);
    const svg = (await page.getByTestId("map-main").boundingBox())!;
    const drag = async (from: [number, number], to: [number, number]) => {
      await page.mouse.move(from[0], from[1]);
      await page.mouse.down();
      await page.mouse.move(to[0], to[1], { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(400);
    };
    const at = (fx: number, fy: number): [number, number] => [svg.x + svg.width * fx, svg.y + svg.height * fy];
    for (const [from, to, what] of [
      [at(0.5, 0.1), at(0.5, 0.9), "north"],
      [at(0.5, 0.1), at(0.5, 0.9), "north"],
      [at(0.9, 0.1), at(0.1, 0.9), "north-east"],
      [at(0.9, 0.1), at(0.1, 0.9), "north-east"],
    ] as const) {
      await drag(from, to);
      expect((await mapState()).overviewCovers, `${where}: panned ${what} past the painted coverage`).toBe(true);
    }
    // Then Estonia brought to the middle: all of it in view at this zoom, its islands included.
    for (let i = 0; i < 3; i++) {
      const c = await page.evaluate(() => {
        const r = document.querySelector('[data-testid="map-main"] path[data-country="EST"]')!.getBoundingClientRect();
        return [(r.left + r.right) / 2, (r.top + r.bottom) / 2];
      });
      const mid = at(0.5, 0.5);
      const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
      await drag(mid, [clamp(mid[0] - (c[0] - mid[0]), svg.x + 5, svg.x + svg.width - 5), clamp(mid[1] - (c[1] - mid[1]), svg.y + 5, svg.y + svg.height - 5)]);
    }
    expect((await mapState()).overviewCovers, `${where}: panned past the painted coverage`).toBe(true);
    const est = await page.evaluate(() => {
      const svg = document.querySelector('[data-testid="map-main"]')!.getBoundingClientRect();
      const r = document.querySelector('[data-testid="map-main"] path[data-country="EST"]')!.getBoundingClientRect();
      return { top: r.top >= svg.top - 0.5, left: r.left >= svg.left - 0.5, right: r.right <= svg.right + 0.5, bottom: r.bottom <= svg.bottom + 0.5 };
    });
    // Estonia whole: its north coast, its western islands (Saaremaa, Hiiumaa) and Narva in the east.
    expect(est, `${where}: Estonia can't be panned whole into view`).toEqual({ top: true, left: true, right: true, bottom: true });
    if ([390, 1366].includes(width)) await page.screenshot({ path: `screenshots/desktop/level6-map-islands-panned-${width}x${height}.png` });
    if ([390, 1366].includes(width)) {
      // Saaremaa and Hiiumaa (the western fifth of Estonia's shape is islands only), on the map and tapped: Estonia.
      const island = await countryPoint(page, "EST", [0, 0.2]);
      expect(island, "an Estonian island to tap").not.toBeNull();
      expect(island![0] >= svg.x && island![0] <= svg.x + svg.width && island![1] >= svg.y && island![1] <= svg.y + svg.height, "island point on the map").toBe(true);
      await tapAt(page, island!);
      await expect(page.getByTestId("country-card")).toHaveAttribute("data-country", "EST");
      await page.screenshot({ path: `screenshots/desktop/level6-map-island-tapped-${width}x${height}.png` });
    }
    await page.getByRole("button", { name: "Show the whole map" }).click();
    await expect.poll(async () => (await mapState()).transform, { timeout: 5000 }).toBe(start.transform);
    expect((await mapState()).overviewCovers).toBe(true);
  }
  test.info().annotations.push({ type: "margins", description: report.join("; ") });
  console.log(report.join("\n"));
});

/* The landscape: only Level 6's own overview, its overlay once a country has a state colour, and tiles only when zoomed. */
test("Level 6 loads its own landscape overview, and zoomed tiles only for the view", async ({ page }) => {
  test.skip(project() !== "mobile", "Runs once.");
  await saveV2(page, { ...EARLIER, [L6]: discoverAt(null) }, { levelId: L5, recent: EARLIER_RECENT });
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  // The level selection loads no overview at all.
  await page.waitForTimeout(500);
  expect(requests.filter((u) => /-(land|tone)\.[\w-]*\.?webp|\/relief\//.test(u)), "landscape on the level selection").toEqual([]);
  await card(page, L6).getByRole("button", { name: /^Continue/ }).click();
  const main = page.getByTestId("map-main");
  await expect(main.locator('[data-family="land"] image[data-level="overview"]')).toHaveCount(1);
  await expect.poll(() => requests.some((u) => /baltic-journey-land/.test(u))).toBe(true);
  await page.waitForTimeout(500);
  expect(requests.filter((u) => /(western-europe-1|around-the-alps|central-europe|along-the-adriatic|towards-greece)-(land|tone)/.test(u)), "another level's overview").toEqual([]);
  expect(requests.filter((u) => /baltic-journey-tone/.test(u)), "the overlay before any state colour").toEqual([]);
  expect(requests.filter((u) => u.includes("/relief/")), "zoomed tiles at the whole-map view").toEqual([]);
  // A selection gives Estonia a state colour: its overlay is loaded.
  await tapCountry(page, "EST");
  await expect(main.locator('[data-family="tone"] image[data-level="overview"]')).toHaveCount(1);
  await expect.poll(() => requests.some((u) => /baltic-journey-tone/.test(u))).toBe(true);
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
