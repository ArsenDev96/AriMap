import { expect, test, type Page } from "@playwright/test";
import { openWithSave } from "./helpers/save";

/*
 * The continents above the level selection, as a world map: Continents → a continent's levels →
 * Discover → Find → Travel → Results. Five categories (Europe with the seven levels, four coming soon
 * with no action) on the map's land and as names, Oceania and Antarctica as context only; Europe
 * opened from its land, its name (a button, with its levels completed under it, from the permanent
 * records) or, with nothing to continue, Explore Europe in the action area; Continue there straight
 * into the most recently active unfinished level (exactly where it was, also after a refresh);
 * Europe's level selection with Back to the continents; Home from a level to the continents; starting
 * over or playing again keeping completion and unlocks; a save from before continents opening Europe's
 * levels. In English and Armenian at 320×568, 390×844, a phone in landscape (740×360) and on desktop,
 * with enlarged text, keyboard focus and accessible names. The names are cards off the map: beside it
 * where the screen is short and wide for its text (landscape, desktop), otherwise under it (upright).
 * (The "on" layout, names over the map, is no longer used; its checks stay for reference.) Screens are never pushed
 * onto the browser's history (the app keeps its screen in the save, as before), and a refresh opens
 * the saved screen with no other screen first.
 */

const project = () => test.info().project.name;

const L = ["western-europe-1", "around-the-alps", "central-europe", "along-the-adriatic", "towards-greece", "baltic-journey", "iberian-journey"];
const [L1, L2, L3] = L;
const COUNTRIES: Record<string, string[]> = {
  "western-europe-1": ["FRA", "BEL", "NLD", "LUX", "DEU"],
  "around-the-alps": ["FRA", "CHE", "DEU", "AUT", "ITA"],
  "central-europe": ["DEU", "POL", "CZE", "SVK", "AUT"],
  "along-the-adriatic": ["ITA", "SVN", "HRV", "BIH", "MNE"],
  "towards-greece": ["HUN", "ROU", "SRB", "BGR", "GRC"],
  "baltic-journey": ["DEU", "POL", "LTU", "LVA", "EST"],
  "iberian-journey": ["PRT", "ESP", "AND", "FRA", "ITA"],
};
const ROUTES: Record<string, [string, string[]]> = {
  "western-europe-1": ["fra-to-nld", ["FRA", "BEL", "NLD"]],
  "around-the-alps": ["fra-to-aut", ["FRA", "DEU", "AUT"]],
  "central-europe": ["pol-to-aut", ["POL", "CZE", "AUT"]],
  "along-the-adriatic": ["ita-to-mne", ["ITA", "SVN", "HRV", "MNE"]],
  "towards-greece": ["hun-to-grc", ["HUN", "ROU", "BGR", "GRC"]],
  "baltic-journey": ["deu-to-est", ["DEU", "POL", "LTU", "LVA", "EST"]],
  "iberian-journey": ["prt-to-ita", ["PRT", "ESP", "FRA", "ITA"]],
};
const records = (travelDone: boolean) => ({ discoverDone: true, findDone: travelDone, travelDone, lastFindScore: null, bestFindScore: null, travelWithoutHelp: false });
/** A level finished, at its Results. */
const done = (id: string) => {
  const order = COUNTRIES[id];
  const [missionId, route] = ROUTES[id];
  return {
    started: true,
    stage: "results",
    discover: { selected: null, explored: order },
    find: { order, index: 4, question: { target: order[4], wrongGuesses: [], hintLevel: 0, solved: true, feedback: null }, results: order.map((target) => ({ target, wrongGuesses: 0, hintLevel: 0 })), status: "complete" },
    travel: { missionId, path: route, hintUsed: false, undoUsed: false },
    lastTravelResult: { missionId, route, hintUsed: false, undoUsed: false },
    records: { ...records(true), lastFindScore: { independent: 5, total: 5 }, bestFindScore: { independent: 5, total: 5 } },
  };
};
/** Level 3 in Find, on its second question (Czechia), after a wrong tap on Slovakia and the first hint. */
const L3_IN_FIND = {
  started: true,
  stage: "find",
  discover: { selected: null, explored: COUNTRIES[L3] },
  find: {
    order: ["POL", "CZE", "DEU", "SVK", "AUT"],
    index: 1,
    question: { target: "CZE", wrongGuesses: ["SVK"], hintLevel: 1, solved: false, feedback: { kind: "wrong", country: "SVK" } },
    results: [{ target: "POL", wrongGuesses: 0, hintLevel: 0 }],
    status: "asking",
  },
  records: records(false),
};

type SaveState = { name: string; levels: Record<string, object>; recent: string[] };
const NEW: SaveState = { name: "new", levels: {}, recent: [] };
const LEVEL3: SaveState = { name: "level3", levels: { [L1]: done(L1), [L2]: done(L2), [L3]: L3_IN_FIND }, recent: [L3, L2, L1] };
const ALL_DONE: SaveState = { name: "all-done", levels: Object.fromEntries(L.map((id) => [id, done(id)])), recent: [...L].reverse() };

const NAMES = {
  en: ["Europe", "Asia", "Africa", "North America", "South America"],
  hy: ["Եվրոպա", "Ասիա", "Աֆրիկա", "Հյուսիսային Ամերիկա", "Հարավային Ամերիկա"],
};
const IDS = ["europe", "asia", "africa", "north-america", "south-america"];
const TEXT = {
  en: { levels: "7 levels", completed: (n: number) => `${n} of 7 Europe levels completed`, short: (n: number) => `Completed: ${n}/7`, explore: "Explore Europe", soon: "Coming soon", back: "Back to continents", continue: "Continue", europe: "Europe" },
  hy: { levels: "7 մակարդակ", completed: (n: number) => `Եվրոպայի 7 մակարդակից ավարտված է ${n}-ը`, short: (n: number) => `Ավարտված՝ ${n}/7`, explore: "Բացահայտել Եվրոպան", soon: "Շուտով", back: "Վերադառնալ մայրցամաքներին", continue: "Շարունակել", europe: "Եվրոպա" },
};

/** Records each screen the app shows, in order, from the first paint of every document (to catch a flash of the wrong one). */
async function recordScreens(page: Page) {
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __screens: string[] }).__screens = seen;
    const record = () => {
      for (const id of ["continents", "welcome", "panel"]) if (document.querySelector(`[data-testid="${id}"]`) && seen.at(-1) !== id) seen.push(id);
    };
    new MutationObserver(record).observe(document, { childList: true, subtree: true });
  });
}
const screensSeen = (page: Page) => page.evaluate(() => (window as unknown as { __screens: string[] }).__screens);

async function open(page: Page, s: SaveState, { locale = "en", screen = "continents" } = {}) {
  await openWithSave(page, { version: 2, locale, screen, levelId: s.recent[0] ?? L1, recent: s.recent, levels: s.levels });
  await expect(page.locator(".splash")).toHaveCount(0);
  await fontsSettled(page);
}

async function fontsSettled(page: Page) {
  await page.evaluate(async () => {
    const loads = [document.fonts.load('900 16px "Nunito"', "Aa")];
    if (document.documentElement.lang === "hy") loads.push(document.fonts.load('900 16px "Noto Sans Armenian"', "Աա"));
    await Promise.all(loads).catch(() => undefined);
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
}

async function textSize(page: Page, size: number) {
  await page.evaluate((s) => (document.documentElement.style.fontSize = s === 100 ? "" : `${s}%`), size);
  await fontsSettled(page);
}

async function shot(page: Page, name: string) {
  const { width, height } = page.viewportSize()!;
  await page.screenshot({ path: `screenshots/${project()}/continents-${name}-${width}x${height}.png` });
}
const label = (page: Page, id: string) => page.getByTestId(`continent-${id}`);
const europeName = (page: Page) => page.getByTestId("map-label-europe");
/** Europe's levels completed, where they are shown: under the map (wide screens) or with its button (otherwise). */
const progressArea = (page: Page) => page.getByTestId("continent-europe-progress-area").locator("visible=true");
const progressText = (page: Page) => progressArea(page).getByTestId("continent-progress");
const continueButton = (page: Page) => page.getByTestId("continents-actions").getByRole("button");

type Rect = { x: number; y: number; width: number; height: number };
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5;
const inside = (a: Rect, b: Rect) => a.x >= b.x - 0.5 && a.y >= b.y - 0.5 && a.x + a.width <= b.x + b.width + 0.5 && a.y + a.height <= b.y + b.height + 0.5;

/**
 * A point on a category's land that a tap reaches (nothing drawn over it), in page coordinates, and
 * how much of its land is uncovered (the share of its land's sampled points nothing covers).
 */
async function landPoint(page: Page, id: string) {
  return page.getByTestId(`map-region-${id}`).evaluate((el) => {
    const path = el as SVGPathElement;
    const svg = path.ownerSVGElement!;
    const toUser = svg.getScreenCTM()!.inverse();
    const box = path.getBoundingClientRect();
    let land = 0;
    let open = 0;
    let best: { x: number; y: number } | null = null;
    for (let i = 1; i < 40; i++)
      for (let j = 1; j < 40; j++) {
        const x = box.left + (box.width * i) / 40;
        const y = box.top + (box.height * j) / 40;
        if (!path.isPointInFill(new DOMPoint(x, y).matrixTransform(toUser))) continue;
        land++;
        if (document.elementFromPoint(x, y) !== path) continue;
        open++;
        // The uncovered point nearest the middle of the land's box.
        const d = (x - box.left - box.width / 2) ** 2 + (y - box.top - box.height / 2) ** 2;
        if (!best || d < (best.x - box.left - box.width / 2) ** 2 + (best.y - box.top - box.height / 2) ** 2) best = { x, y };
      }
    return { point: best, uncovered: land ? open / land : 0 };
  });
}

/** A tap (touch screens) or a click on that point of a category's land, with the map scrolled into view first. */
async function tapLand(page: Page, id: string) {
  await page.getByTestId("world-map").evaluate((el) => el.scrollIntoView({ block: "nearest" }));
  const { point } = await landPoint(page, id);
  expect(point, `${id}: no uncovered point on its land`).not.toBeNull();
  if (test.info().project.use.hasTouch) await page.touchscreen.tap(point!.x, point!.y);
  else await page.mouse.click(point!.x, point!.y);
}

/**
 * The continents: the header on screen; the whole map, at its own proportions, in view at the top of the
 * page; the five names in order, none overlapping another, on the map (wide screens) or off it (phones);
 * each name, Europe's button and its progress reached by scrolling and then wholly between the header and
 * the action area (never under it) and on screen; text neither shrunk nor cut; the action area below the
 * content with its one button; nothing wider than the screen.
 */
type Layout = "on" | "beside" | "under";
async function expectMapLayout(page: Page, where: string, { size = 100, layout }: { size?: number; layout: Layout }) {
  const namesOnMap = layout === "on";
  const { width, height } = page.viewportSize()!;
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${where}: horizontal scroll`).toBeLessThanOrEqual(0);
  expect(await page.evaluate(() => document.scrollingElement!.scrollTop), `${where}: the page scrolled`).toBe(0);
  await expect(page.getByTestId("welcome-hero").getByRole("heading", { level: 1 })).toBeInViewport({ ratio: 1 });
  await expect(page.getByTestId("welcome-hero").getByRole("group")).toBeInViewport({ ratio: 1 });

  const scroll = page.getByTestId("continents-scroll");
  const scrollBox = (await scroll.boundingBox())!;
  const bar = (await page.getByTestId("continents-actions").boundingBox())!;
  expect(bar.y, `${where}: the action area over the content`).toBeGreaterThanOrEqual(scrollBox.y + scrollBox.height - 0.5);
  expect(bar.y + bar.height, `${where}: the action area off screen`).toBeLessThanOrEqual(height + 0.5);
  await expect(page.getByTestId("continents-actions").getByRole("button")).toHaveCount(1);
  const action = (await continueButton(page).boundingBox())!;
  expect(action.height, `${where}: main action touch target`).toBeGreaterThanOrEqual(44);
  expect(action.x + action.width, `${where}: main action off screen`).toBeLessThanOrEqual(width + 0.5);

  // The whole world, never stretched: the map's proportions are its data's (1000 × 520), all of it on screen
  // sideways and, at the default text size (enlarged text may need a scroll), in the content's view as it opens.
  const map = (await page.getByTestId("world-map").locator("svg").boundingBox())!;
  expect(map.width / map.height, `${where}: map proportions`).toBeCloseTo(1000 / 520, 2);
  expect(map.x >= -0.5 && map.x + map.width <= width + 0.5, `${where}: map off screen sideways`).toBe(true);
  expect(map.width, `${where}: map width`).toBeGreaterThanOrEqual(199);
  if (size === 100) expect(inside(map, scrollBox), `${where}: the whole map in view as the page opens`).toBe(true);

  // The names: in order, apart, on the map or off it.
  const boxes: Rect[] = [];
  for (const id of IDS) {
    const box = (await label(page, id).boundingBox())!;
    boxes.push(box);
    if (namesOnMap) expect(inside(box, map), `${where}: ${id}'s name not on the map`).toBe(true);
    else expect(overlaps(box, map), `${where}: ${id}'s name over the map`).toBe(false);
  }
  for (let i = 0; i < IDS.length; i++)
    for (let j = i + 1; j < IDS.length; j++) expect(overlaps(boxes[i], boxes[j]), `${where}: ${IDS[i]} and ${IDS[j]} overlap`).toBe(false);
  // Europe's land stays in view beside its name (at least half of it uncovered).
  expect((await landPoint(page, "europe")).uncovered, `${where}: Europe's land covered`).toBeGreaterThanOrEqual(0.5);
  // Europe's levels completed, shown once and never on the map: on wide screens under it, apart from every
  // name; otherwise with Europe's button (directly beneath it beside the map), apart from the other names.
  await expect(progressArea(page), `${where}: Europe's progress shown once`).toHaveCount(1);
  const progress = (await progressArea(page).boundingBox())!;
  expect(overlaps(progress, map), `${where}: Europe's progress on the map`).toBe(false);
  const grouped = await progressArea(page).evaluate((el) => !!el.closest('[data-testid="continent-europe"]'));
  expect(grouped, `${where}: Europe's progress with its button`).toBe(!namesOnMap);
  if (namesOnMap) expect(progress.y, `${where}: Europe's progress not under the map`).toBeGreaterThanOrEqual(map.y + map.height - 0.5);
  const europeButton = (await europeName(page).boundingBox())!;
  if (layout === "beside") {
    expect(progress.y, `${where}: Europe's progress not beneath its button`).toBeGreaterThanOrEqual(europeButton.y + europeButton.height - 0.5);
    expect(progress.x, `${where}: Europe's progress not beside the map`).toBeGreaterThanOrEqual(map.x + map.width - 0.5);
  }
  for (const [i, box] of boxes.entries())
    if (namesOnMap || IDS[i] !== "europe") expect(overlaps(progress, box), `${where}: Europe's progress and ${IDS[i]} overlap`).toBe(false);
  expect(overlaps(progress, europeButton), `${where}: Europe's progress over its button`).toBe(false);
  expect(progress.x >= -0.5 && progress.x + progress.width <= width + 0.5, `${where}: Europe's progress off screen sideways`).toBe(true);
  // The count ("2/7") is kept on one line.
  expect(await progressArea(page).locator('[class*="fraction"]').evaluate((el) => el.getClientRects().length), `${where}: the count broken`).toBe(1);

  // Text at its full size and never cut: every name, status and progress line as wide as its text.
  const text = await page.getByTestId("continents-scroll").evaluate((scroll) =>
    [...scroll.querySelectorAll('[data-testid="continent-list"] li, [data-testid="continent-list"] li *:not(.visually-hidden), [data-testid$="-progress-area"] *:not(.visually-hidden)')].map((el) => ({
      size: parseFloat(getComputedStyle(el).fontSize),
      cut: el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== "visible",
    })),
  );
  expect(Math.min(...text.map((t) => t.size)), `${where}: smallest text`).toBeGreaterThanOrEqual((0.8 * 16 * size) / 100 - 0.5);
  expect(text.filter((t) => t.cut), `${where}: cut text`).toEqual([]);

  // Each name, Europe's button and its progress area: reached by scrolling, then wholly in the content's view
  // (between the header and the action area, never under it; at its top if taller than the view) and on screen.
  for (const part of [...IDS.map((id) => label(page, id)), europeName(page), progressArea(page)]) {
    const tall = await part.evaluate((el, view) => el.getBoundingClientRect().height > view, scrollBox.height);
    await part.evaluate((el, tall) => el.scrollIntoView({ block: tall ? "start" : "nearest" }), tall);
    const b = (await part.boundingBox())!;
    const s = (await scroll.boundingBox())!;
    expect(inside({ ...b, x: 0, width: 0, height: tall ? 0 : b.height }, { ...s, x: 0, width: 0 }), `${where}: ${await part.getAttribute("data-testid")} not wholly in view`).toBe(true);
    expect(b.x >= -0.5 && b.x + b.width <= width + 0.5, `${where}: ${await part.getAttribute("data-testid")} off screen sideways`).toBe(true);
  }
  const button = (await europeName(page).boundingBox())!;
  expect(Math.min(button.width, button.height), `${where}: Europe's touch target`).toBeGreaterThanOrEqual(44);
  await scroll.evaluate((el) => el.scrollTo(0, 0));
}

/** No category's name is broken inside a word, unless the word is wider than all the room it has. */
async function expectNamesWhole(page: Page, where: string) {
  const broken = await page.evaluate(() => {
    const out: string[] = [];
    for (const name of document.querySelectorAll('[data-testid="continent-list"] li [class*="name"]')) {
      const room = name.closest("li")!.clientWidth;
      const range = document.createRange();
      const words = document.createTreeWalker(name, NodeFilter.SHOW_TEXT);
      for (let node = words.nextNode(); node; node = words.nextNode())
        for (const m of (node.textContent ?? "").matchAll(/\S+/g)) {
          range.setStart(node, m.index!);
          range.setEnd(node, m.index! + m[0].length);
          const rects = [...range.getClientRects()].filter((r) => r.width > 0);
          const width = rects.reduce((sum, r) => sum + r.width, 0);
          if (new Set(rects.map((r) => Math.round(r.top))).size > 1 && width <= room + 0.5) out.push(m[0]);
        }
    }
    return out;
  });
  expect(broken, `${where}: names broken inside a word`).toEqual([]);
}

/**
 * The five names in order; Europe's a button named "Europe" (described by its levels completed) with its
 * permanent completion count; the four coming soon in words, with nothing to press or focus and no level
 * wording; Oceania and Antarctica drawn, with no name and no action; the map itself takes no focus.
 */
async function expectNames(page: Page, locale: "en" | "hy", completed: number) {
  const t = TEXT[locale];
  expect(await page.getByTestId("continent-list").locator(":scope > li").evaluateAll((els) => els.map((e) => e.getAttribute("data-continent")))).toEqual(IDS);
  await expect(europeName(page)).toHaveAccessibleName(t.europe);
  await expect(europeName(page)).toHaveAccessibleDescription(t.completed(completed));
  // Europe's button is its name and arrow only. Its levels completed read "Completed: 2/7" (in full for
  // assistive technology), named "Europe" only under the map, where the button is not beside them.
  await expect(europeName(page)).toHaveText(t.europe);
  await expect(progressText(page)).toHaveText(t.short(completed));
  const onMap = !(await progressArea(page).evaluate((el) => !!el.closest('[data-testid="continent-europe"]')));
  await expect(progressArea(page).locator(".visually-hidden")).toHaveText(t.completed(completed));
  await expect(progressArea(page).locator(":scope p > [aria-hidden='true']")).toHaveText(onMap ? [t.europe, t.short(completed)] : [t.short(completed)]);
  await expect(label(page, "europe")).toHaveAttribute("data-status", "open");
  // The two Americas clearly apart: periwinkle blue and rose.
  const fill = (id: string) => page.getByTestId(`map-region-${id}`).evaluate((el) => getComputedStyle(el).fill.match(/\d+/g)!.map(Number));
  const [[nr, ng, nb], [sr, sg, sb]] = [await fill("north-america"), await fill("south-america")];
  expect(nb - nr, "North America blue").toBeGreaterThan(30);
  expect(sr - sb, "South America rose").toBeGreaterThan(20);
  expect(Math.abs(nr - sr) + Math.abs(ng - sg) + Math.abs(nb - sb), "the Americas apart").toBeGreaterThan(80);
  for (const [i, id] of IDS.entries()) {
    if (i === 0) continue;
    await expect(label(page, id)).toHaveAttribute("data-status", "comingSoon");
    await expect(label(page, id)).toHaveText(`${NAMES[locale][i]}${t.soon}`);
    await expect(label(page, id).getByTestId("continent-status")).toBeVisible();
    // Not a locked level: no level wording, and nothing to press or focus.
    await expect(label(page, id).locator("button, a, input, [tabindex]")).toHaveCount(0);
    await expect(label(page, id)).not.toContainText(locale === "en" ? /Locked|Level \d/ : /Փակ|Մակարդակ \d/);
  }
  for (const id of ["oceania", "antarctica"]) await expect(page.locator(`[data-testid="world-map"] path[data-region="${id}"]`)).toHaveCount(1);
  await expect(page.getByTestId("world-map").locator("[tabindex], a, button")).toHaveCount(0);
  await expect(page.getByTestId("world-map").locator("svg")).toHaveAttribute("aria-hidden", "true");
}

test.describe("continents", () => {
  test("the three save states in both languages and at every size: the map, the names, the main action and reachability", async ({ page }) => {
    const sizes = project() === "desktop" ? [[1366, 800]] : project() === "small-phone" ? [[320, 568], [390, 844], [740, 360]] : [];
    test.skip(sizes.length === 0, "Runs on small-phone (320×568, 390×844, 740×360 landscape) and desktop.");
    test.setTimeout(300_000);
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      for (const locale of ["en", "hy"] as const) {
        for (const s of [NEW, LEVEL3, ALL_DONE]) {
          const where = `${width}×${height} ${locale} ${s.name}`;
          await open(page, s, { locale });
          await expect(page.getByTestId("continents")).toBeVisible();
          await expectNames(page, locale, s === NEW ? 0 : s === LEVEL3 ? 2 : 7);
          if (s === LEVEL3) {
            // Continue names the continent and the level, and (where there is room) its title; always all three for assistive technology.
            await expect(continueButton(page)).toHaveAttribute("data-level", L3);
            await expect(continueButton(page)).toHaveAccessibleName(
              locale === "en" ? "Continue: Europe, Level 3, Central Europe" : "Շարունակել՝ Եվրոպա, Մակարդակ 3, Կենտրոնական Եվրոպա",
            );
            await expect(continueButton(page)).toContainText(locale === "en" ? "Europe · Level 3" : "Եվրոպա · Մակարդակ 3");
            await expect(page.getByTestId("explore-europe")).toHaveCount(0);
          } else {
            // Nothing unfinished: Explore Europe is the main action.
            await expect(continueButton(page)).toHaveText(TEXT[locale].explore);
            await expect(continueButton(page)).toHaveAttribute("data-testid", "explore-europe");
            await expect(continueButton(page)).toHaveAttribute("data-primary", "true");
          }
          await expectMapLayout(page, where, { layout: width > 1000 || width === 740 ? "beside" : "under" });
          await expectNamesWhole(page, where);
          await shot(page, `${locale}-${s.name}`);
        }
        // Europe's level selection, from its name, with Back to the continents and the continent's name.
        await open(page, LEVEL3, { locale });
        await europeName(page).click();
        await expect(page.getByTestId("continent-title")).toHaveText(TEXT[locale].europe);
        await expect(page.getByTestId("back-to-continents")).toHaveAccessibleName(TEXT[locale].back);
        await expect(page.getByTestId("levels").locator(":scope > li")).toHaveCount(7);
        await expect(page.getByTestId("welcome-actions").getByRole("button")).toHaveAttribute("data-level", L3);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${width}×${height} ${locale} Europe: horizontal scroll`).toBeLessThanOrEqual(0);
        await shot(page, `${locale}-europe-levels`);
      }
    }
  });

  test("enlarged text: the names leave the map for a supporting layout; everything readable, reached and apart", async ({ page }) => {
    const sizes = project() === "desktop" ? [[1366, 800]] : project() === "small-phone" ? [[320, 568], [740, 360]] : [];
    test.skip(sizes.length === 0, "Runs at 320×568 and 740×360 (small-phone), and on desktop.");
    test.setTimeout(300_000);
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      for (const locale of ["en", "hy"] as const)
        for (const s of [NEW, LEVEL3])
          for (const size of [150, 200]) {
            const where = `${width}×${height} ${locale} ${s.name} ${size}%`;
            await open(page, s, { locale });
            await textSize(page, size);
            await expectMapLayout(page, where, { size, layout: width === 320 ? "under" : "beside" });
            await expectNamesWhole(page, where);
            // The content keeps room to scroll through: at least three lines of its text between the header and the action area.
            const room = await page.getByTestId("continents-scroll").evaluate((el) => el.clientHeight / parseFloat(getComputedStyle(el).fontSize));
            expect(room, `${where}: ${room.toFixed(1)} lines of room`).toBeGreaterThanOrEqual(3);
            if (size === 200 || width === 320) await shot(page, `${locale}-${s.name}-text${size}`);
            // Europe's level selection: Back reachable, nothing wider than the screen.
            await europeName(page).click();
            await expect(page.getByTestId("back-to-continents")).toBeInViewport({ ratio: 1 });
            expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${where} Europe: horizontal scroll`).toBeLessThanOrEqual(0);
            await page.getByTestId("back-to-continents").click();
            await expect(page.getByTestId("continents")).toBeVisible();
            await textSize(page, 100);
          }
    }
  });

  test("Europe opens from its land and from its name; the coming-soon land and names open nothing", async ({ page }) => {
    const sizes = project() === "desktop" ? [[1366, 800]] : project() === "small-phone" ? [[320, 568], [390, 844], [740, 360]] : [];
    test.skip(sizes.length === 0, "Runs on small-phone (taps) and desktop (clicks).");
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      for (const s of [NEW, LEVEL3]) {
        const where = `${width}×${height} ${s.name}`;
        await open(page, s);
        // Coming soon: their land and their names do nothing, and the save still opens the continents.
        for (const id of IDS.slice(1)) {
          await tapLand(page, id);
          // As a tap does: a name over the map passes it to the land under it.
          await label(page, id).click({ force: true });
          await expect(page.getByTestId("continents"), `${where}: ${id}`).toBeVisible();
        }
        expect(await page.evaluate(() => JSON.parse(localStorage.getItem("arimap:state")!).screen), where).toBe("continents");
        // Europe's land: its level selection.
        await tapLand(page, "europe");
        await expect(page.getByTestId("welcome"), where).toBeVisible();
        await expect(page.getByTestId("continent-title")).toHaveText("Europe");
        await page.getByTestId("back-to-continents").click();
        // Europe's name: the same.
        await europeName(page).click();
        await expect(page.getByTestId("welcome"), where).toBeVisible();
        await page.getByTestId("back-to-continents").click();
        await expect(page.getByTestId("continents"), where).toBeVisible();
      }
    }
  });

  test("Level 3 in progress: Continue resumes it exactly, Home returns to the continents, also across refreshes, with no other screen shown first", async ({ page }) => {
    test.skip(project() !== "small-phone", "Runs once.");
    await page.setViewportSize({ width: 390, height: 844 });
    await recordScreens(page);
    await open(page, LEVEL3);
    expect(await screensSeen(page)).toEqual(["continents"]);
    const historyLength = await page.evaluate(() => window.history.length);
    const expectFindAsLeft = async () => {
      await expect(page.getByTestId("find-prompt")).toHaveText("Find Czechia");
      await expect(page.getByTestId("find-progress")).toHaveText("Question 2 of 5");
      await expect(page.getByText("Its capital is Prague.")).toBeVisible();
      await expect(page.getByTestId("find-feedback")).toContainText("Try again.");
    };
    await continueButton(page).click();
    await expectFindAsLeft();
    // A refresh in the level opens it again, straight away.
    await page.reload();
    await expectFindAsLeft();
    expect(await screensSeen(page)).toEqual(["panel"]);
    // Home: the continents, progress kept; a refresh there stays there; Continue resumes it.
    await page.getByTestId("home").click();
    await expect(page.getByTestId("continents")).toBeVisible();
    await expect(continueButton(page)).toHaveAttribute("data-level", L3);
    await expect(progressText(page)).toHaveText("Completed: 2/7");
    await page.reload();
    await expect(page.getByTestId("continents")).toBeVisible();
    expect(await screensSeen(page)).toEqual(["continents"]);
    await continueButton(page).click();
    await expectFindAsLeft();
    // Home → Europe → the level's own Continue: the same place.
    await page.getByTestId("home").click();
    await europeName(page).click();
    await expect(page.getByTestId("welcome")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("welcome")).toBeVisible();
    expect(await screensSeen(page)).toEqual(["welcome"]);
    await page.getByTestId(`level-${L3}`).getByRole("button", { name: /^Continue/ }).click();
    await expectFindAsLeft();
    // Back to the continents from Europe's levels.
    await page.getByTestId("home").click();
    await europeName(page).click();
    await page.getByTestId("back-to-continents").click();
    await expect(page.getByTestId("continents")).toBeVisible();
    // Screens are not browser history entries: Back in the browser leaves the app, as before continents.
    expect(await page.evaluate(() => window.history.length)).toBe(historyLength);
  });

  test("starting over or playing again keeps completion and unlocks; Continue then resumes the replay", async ({ page }) => {
    test.skip(project() !== "small-phone", "Runs once.");
    await page.setViewportSize({ width: 390, height: 844 });
    const dialog = page.getByTestId("start-over-dialog");
    // Level 3 in progress, started over from Europe's levels: still two completed, Level 3 still open, Continue at its Discover.
    await open(page, LEVEL3);
    await europeName(page).click();
    await page.getByTestId(`level-${L3}`).getByRole("button", { name: /^Start over/ }).click();
    await dialog.getByRole("button", { name: "Start over" }).click();
    await expect(page.getByRole("heading", { name: "Tap a country to learn about it." })).toBeVisible();
    await page.getByTestId("home").click();
    await expect(progressText(page)).toHaveText("Completed: 2/7");
    await expect(continueButton(page)).toHaveAttribute("data-level", L3);
    await europeName(page).click();
    await expect(page.getByTestId(`level-${L3}`).getByTestId("level-status")).toHaveText("In progress: Discover");
    await expect(page.getByTestId("level-along-the-adriatic").getByTestId("level-status")).toHaveText(/^Locked/);

    // All seven completed, Level 2 played again: still seven of seven, nothing to continue, every level open.
    await open(page, ALL_DONE);
    await page.getByTestId("explore-europe").click();
    await page.getByTestId(`level-${L2}`).getByTestId("level-details-toggle").click();
    await page.getByTestId(`level-${L2}`).getByRole("button", { name: /^Play again/ }).click();
    await dialog.getByRole("button", { name: "Play again" }).click();
    await expect(page.getByRole("heading", { name: "Tap a country to learn about it." })).toBeVisible();
    await page.getByTestId("home").click();
    await expect(progressText(page)).toHaveText("Completed: 7/7");
    // The replay of Level 2 is an attempt under way: Continue resumes it.
    await expect(continueButton(page)).toHaveAttribute("data-level", L2);
    await page.reload();
    await expect(progressText(page)).toHaveText("Completed: 7/7");
    await europeName(page).click();
    for (const id of L) await expect(page.getByTestId(`level-${id}`).getByTestId("level-status")).toHaveText("Completed");
  });

  test("a new player: Explore Europe, then Level 1; Home then offers Continue", async ({ page }) => {
    test.skip(project() !== "small-phone", "Runs once.");
    await page.setViewportSize({ width: 320, height: 568 });
    await open(page, NEW);
    await expect(progressText(page)).toHaveText("Completed: 0/7");
    await page.getByTestId("explore-europe").click();
    await expect(page.getByTestId("welcome-actions").getByRole("button")).toHaveText(/^Start\s*Level 1 · France and its neighbours$/);
    await expect(page.getByTestId(`level-${L2}`).getByTestId("level-status")).toHaveText(/^Locked/);
    await page.getByTestId("welcome-actions").getByRole("button").click();
    await expect(page.getByRole("heading", { name: "Tap a country to learn about it." })).toBeVisible();
    await page.getByTestId("home").click();
    await expect(continueButton(page)).toHaveAccessibleName("Continue: Europe, Level 1, France and its neighbours");
    await expect(page.getByTestId("explore-europe")).toHaveCount(0);
  });

  test("a save from before continents opens Europe's levels where the player was", async ({ page }) => {
    test.skip(project() !== "small-phone", "Runs once.");
    await openWithSave(page, { version: 2, locale: "hy", screen: "welcome", levelId: L3, recent: LEVEL3.recent, levels: LEVEL3.levels });
    await expect(page.getByTestId("welcome")).toBeVisible();
    await expect(page.getByTestId("continent-title")).toHaveText("Եվրոպա");
    await expect(page.getByTestId("welcome-actions").getByRole("button")).toHaveAttribute("data-level", L3);
  });

  test("lightweight and responsive: no landscape or artwork downloads, and the layout follows the window as it changes", async ({ page }) => {
    test.skip(project() !== "desktop", "Runs once.");
    const requests: string[] = [];
    page.on("request", (r) => requests.push(new URL(r.url()).pathname));
    await open(page, LEVEL3);
    await page.waitForLoadState("networkidle");
    // The map is drawn from data in the page's own code: no images, relief, map tiles or geographic data are fetched.
    expect(requests.filter((p) => !p.startsWith("/_next/static/") && p !== "/" && !/^\/(icon\.svg|manifest\.webmanifest|favicon)/.test(p))).toEqual([]);
    expect(requests.filter((p) => /\.(png|jpe?g|webp|avif|tif|json)$/.test(p))).toEqual([]);
    // One page, resized: the names beside the map, under it, and back.
    for (const [width, height, where] of [[1366, 800, "beside"], [740, 360, "beside"], [390, 844, "under"], [1280, 900, "beside"]] as const) {
      await page.setViewportSize({ width, height });
      const map = (await page.getByTestId("world-map").locator("svg").boundingBox())!;
      const asia = (await label(page, "asia").boundingBox())!;
      const placed = inside(asia, map) ? "on" : asia.x >= map.x + map.width - 0.5 ? "beside" : asia.y >= map.y + map.height - 0.5 ? "under" : "elsewhere";
      expect(placed, `${width}×${height}`).toBe(where);
      expect(map.width / map.height, `${width}×${height}: map proportions`).toBeCloseTo(1000 / 520, 2);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${width}×${height}: horizontal scroll`).toBeLessThanOrEqual(0);
    }
  });

  test("keyboard: the languages, Europe's name, then the main action, each named; the map and coming-soon names take no focus", async ({ page }) => {
    test.skip(project() !== "desktop", "Runs once.");
    for (const locale of ["en", "hy"] as const) {
      for (const s of [LEVEL3, NEW]) {
        await open(page, s, { locale });
        const focused: string[] = [];
        for (let i = 0; i < 5; i++) {
          await page.keyboard.press("Tab");
          focused.push(await page.evaluate(() => {
            const el = document.activeElement as HTMLElement;
            return el.getAttribute("aria-label") ?? el.textContent?.trim() ?? "";
          }));
        }
        // The two languages, Europe (once: its land is not a second stop), then the main action, then out of the page.
        expect(focused.slice(0, 4), `${locale} ${s.name}`).toEqual([
          "English",
          "Հայերեն",
          TEXT[locale].europe,
          s === LEVEL3 ? (locale === "en" ? "Continue: Europe, Level 3, Central Europe" : "Շարունակել՝ Եվրոպա, Մակարդակ 3, Կենտրոնական Եվրոպա") : TEXT[locale].explore,
        ]);
      }
      // Europe's name: a clear focus ring, its land lit with it, and Enter opens Europe.
      await open(page, LEVEL3, { locale });
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      await expect(europeName(page)).toBeFocused();
      const ring = await europeName(page).evaluate((el) => {
        const s = getComputedStyle(el);
        return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
      });
      expect(ring.style).not.toBe("none");
      expect(ring.width).toBeGreaterThanOrEqual(2);
      const land = page.getByTestId("map-region-europe");
      // Lit brighter green with its card (--europe-lit in ContinentScreen.module.css).
      expect(await land.evaluate((el) => getComputedStyle(el).fill)).toBe("rgb(54, 207, 96)");
      if (locale === "en") await shot(page, "keyboard-europe-focus");
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("welcome")).toBeVisible();
      // Back to the continents is the first thing reached on Europe's levels.
      await page.keyboard.press("Tab");
      await expect(page.getByTestId("back-to-continents")).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("continents")).toBeVisible();
    }
  });
});
