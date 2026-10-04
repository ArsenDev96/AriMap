import { expect, test, type Page } from "@playwright/test";
import { openWithSave } from "./helpers/save";

/*
 * Short landscape screens (a phone turned sideways): the map on the left at the screen's full height, the panel
 * beside it in a phone-wide column with real reading room, scrolling above its pinned action (LessonScreen.module.css).
 * Level 7 through all four stages at 740×360 and 844×390 in both languages (Chromium; 844×390 in WebKit too), with a
 * real selection and Travel move, enlarged text, Level 7's three landmark illustrations in the scrolling panel at
 * 740×360 (Chromium and WebKit), an earlier level (the layout is shared), turning the phone with
 * progress, selection and a chosen map view kept, and the map on an ultra-wide desktop: no wider than shows the
 * countries whole, centred, rather than cropped to fill the width (maxMapWidth in src/geo/regionMap.ts).
 */

const L = ["western-europe-1", "around-the-alps", "central-europe", "along-the-adriatic", "towards-greece", "baltic-journey", "iberian-journey"];
const L7 = "iberian-journey";
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
const findDone = (order: string[]) => ({
  order,
  index: 4,
  question: { target: order[4], wrongGuesses: [], hintLevel: 0, solved: true, feedback: null },
  results: order.map((target) => ({ target, wrongGuesses: 0, hintLevel: 0 })),
  status: "complete",
});
const done = (id: string) => {
  const [missionId, route] = ROUTES[id];
  return {
    started: true,
    stage: "results",
    discover: { selected: null, explored: [] },
    find: findDone(COUNTRIES[id]),
    travel: { missionId, path: route, hintUsed: false, undoUsed: false },
    lastTravelResult: { missionId, route, hintUsed: false, undoUsed: false },
    records: { ...records(true), lastFindScore: { independent: 5, total: 5 }, bestFindScore: { independent: 5, total: 5 } },
  };
};
const discoverAt = (selected: string | null) => ({ started: true, stage: "discover", discover: { selected, explored: selected ? [selected] : [] }, records: records(false) });
const findAsking = (id: string, target: string) => ({
  started: true,
  stage: "find",
  discover: { selected: null, explored: COUNTRIES[id] },
  find: { order: [target, ...COUNTRIES[id].filter((c) => c !== target)], index: 0, question: { target, wrongGuesses: [], hintLevel: 0, solved: false, feedback: null }, results: [], status: "asking" },
  records: records(false),
});
const travellingAt = (id: string, path: string[]) => ({
  started: true,
  stage: "travel",
  discover: { selected: null, explored: COUNTRIES[id] },
  find: findDone(COUNTRIES[id]),
  travel: { missionId: ROUTES[id][0], path, hintUsed: false, undoUsed: false },
  records: { ...records(false), findDone: true },
});

const project = () => test.info().project.name;

/** Opens a level in a given state, every other level completed. */
async function openLevel(page: Page, levelId: string, state: object, locale = "en") {
  const levels: Record<string, object> = {};
  for (const id of L) levels[id] = id === levelId ? state : done(id);
  await openWithSave(page, { version: 2, locale, screen: "lesson", levelId, recent: [levelId], levels });
  await expect(page.locator(".splash")).toHaveCount(0);
  for (const id of COUNTRIES[levelId]) await expect(page.locator(`[data-testid="map-main"] path[data-country="${id}"]`)).toBeAttached();
  await settle(page);
}

/** Fonts loaded, and the map placed for its size (a frame after it is measured). */
async function settle(page: Page) {
  await page.evaluate(async () => {
    const loads = [document.fonts.load('900 16px "Nunito"', "Aa")];
    if (document.documentElement.lang === "hy") loads.push(document.fonts.load('900 16px "Noto Sans Armenian"', "Աա"));
    await Promise.all(loads).catch(() => undefined);
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  await page.waitForTimeout(400);
}

async function textSize(page: Page, size: number) {
  await page.evaluate((s) => (document.documentElement.style.fontSize = s === 100 ? "" : `${s}%`), size);
  await settle(page);
}

async function shot(page: Page, name: string) {
  const { width, height } = page.viewportSize()!;
  await page.screenshot({ path: `screenshots/${project()}/landscape-${name}-${width}x${height}.png` });
}

/** An on-screen point that hits the country's own path on the main map, nearest the middle of its hits. */
async function countryPoint(page: Page, id: string) {
  return page.evaluate((id) => {
    const path = document.querySelector(`[data-testid="map-main"] path[data-country="${id}"]`)!;
    const r = path.getBoundingClientRect();
    const hits: [number, number][] = [];
    for (let i = 1; i < 40; i++)
      for (let j = 1; j < 40; j++) {
        const [x, y] = [r.left + (r.width * i) / 40, r.top + (r.height * j) / 40];
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

/** Where the screen's parts are: the header, the map, the panel, its pinned action, and the map's controls. */
const layoutOf = (page: Page) =>
  page.evaluate(() => {
    const r = (el: Element | null) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, width: b.width, height: b.height };
    };
    const panel = document.querySelector('[data-testid="panel"]')!;
    const sticky = [...panel.children].find((c) => getComputedStyle(c).position === "sticky") ?? null;
    const controls = [...document.querySelectorAll('[data-testid="map-controls"] button, [data-testid="inset-toggle"], [data-testid="home"], [role="group"] > button[aria-pressed]')];
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      header: r(document.querySelector("header"))!,
      map: r(document.querySelector('[data-testid="map-main"]'))!,
      panel: r(panel)!,
      sticky: r(sticky),
      stickyButtons: sticky ? [...sticky.querySelectorAll("button")].map((b) => ({ ...r(b)!, font: parseFloat(getComputedStyle(b).fontSize), text: b.textContent })) : [],
      controls: controls.map((c) => ({ ...r(c)!, name: c.getAttribute("aria-label") ?? c.textContent })),
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
      scroll: { top: panel.scrollTop, height: panel.scrollHeight, client: panel.clientHeight },
    };
  });

/** The minimum reading room above the pinned action: about seven lines of body text. */
const READING_ROOM = 160;

/**
 * Side by side: the map on the left at the height below the header, the panel on the right, wide enough for a
 * phone's card, with at least READING_ROOM above its pinned action (`room`, less with enlarged text); the header,
 * the map's controls and the action all on screen and touch-sized; nothing wider than the screen.
 */
async function expectSideBySide(page: Page, where: string, room = READING_ROOM) {
  const s = await layoutOf(page);
  const { width: vw, height: vh } = s.viewport;
  expect(s.overflowX, `${where}: horizontal scroll`).toBeLessThanOrEqual(0);
  expect(s.map.right, `${where}: map beside the panel`).toBeLessThanOrEqual(s.panel.left + 0.5);
  expect(s.map.top, `${where}: map below the header`).toBeGreaterThanOrEqual(s.header.bottom - 0.5);
  expect(s.map.bottom, `${where}: map on screen`).toBeLessThanOrEqual(vh + 0.5);
  expect(s.map.height, `${where}: map takes the height below the header`).toBeGreaterThanOrEqual(vh - s.header.bottom - 20);
  expect(s.map.width, `${where}: map width`).toBeGreaterThanOrEqual(vw * 0.4);
  expect(s.panel.width, `${where}: panel width`).toBeGreaterThanOrEqual(280);
  expect(s.panel.bottom, `${where}: panel on screen`).toBeLessThanOrEqual(vh + 0.5);
  const reading = (s.sticky && s.scroll.height > s.scroll.client + 1 ? s.sticky.top : s.panel.bottom) - s.panel.top;
  expect(reading, `${where}: reading room above the pinned action`).toBeGreaterThanOrEqual(room);
  for (const b of s.stickyButtons) {
    expect(b.height, `${where}: «${b.text}» touch target`).toBeGreaterThanOrEqual(44);
    expect(b.bottom, `${where}: «${b.text}» on screen`).toBeLessThanOrEqual(vh + 0.5);
    expect(b.right, `${where}: «${b.text}» on screen`).toBeLessThanOrEqual(vw + 0.5);
  }
  for (const c of s.controls) {
    expect(Math.min(c.width, c.height), `${where}: ${c.name} touch target`).toBeGreaterThanOrEqual(40);
    expect(c.left >= -0.5 && c.top >= -0.5 && c.right <= vw + 0.5 && c.bottom <= vh + 0.5, `${where}: ${c.name} on screen`).toBe(true);
  }
  return s;
}

/**
 * The panel scrolled to its end: every part of its content whole above the pinned action, the action still on
 * screen and enabled. Scrolled back to the top afterwards.
 */
async function expectReadableToEnd(page: Page, where: string) {
  const s = await page.getByTestId("panel").evaluate(async (panel) => {
    panel.scrollTo({ top: panel.scrollHeight });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const sticky = [...panel.children].find((c) => getComputedStyle(c).position === "sticky") ?? null;
    const content = [...panel.children].filter((c) => c !== sticky);
    const last = Math.max(...content.map((c) => c.getBoundingClientRect().bottom));
    const out = {
      atEnd: panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 1,
      last,
      stickyTop: sticky ? sticky.getBoundingClientRect().top : panel.getBoundingClientRect().bottom,
      panelBottom: panel.getBoundingClientRect().bottom,
      buttons: sticky ? [...sticky.querySelectorAll("button")].map((b) => ({ bottom: b.getBoundingClientRect().bottom, disabled: (b as HTMLButtonElement).disabled })) : [],
    };
    return out;
  });
  expect(s.atEnd, `${where}: scrolled to the end`).toBe(true);
  expect(s.last, `${where}: content runs under the pinned action`).toBeLessThanOrEqual(s.stickyTop + 0.5);
  for (const b of s.buttons) expect(b.bottom, `${where}: action off screen`).toBeLessThanOrEqual(page.viewportSize()!.height + 0.5);
}

/** The countries against the map's edges: the smallest margin (negative where one is cut), and which are cut. */
const framing = (page: Page, ids: string[]) =>
  page.evaluate((ids) => {
    const svg = document.querySelector('[data-testid="map-main"]')!.getBoundingClientRect();
    const margins = ids.map((id) => {
      const r = document.querySelector(`[data-testid="map-main"] path[data-country="${id}"]`)!.getBoundingClientRect();
      return { id, m: Math.min(r.left - svg.left, r.top - svg.top, svg.right - r.right, svg.bottom - r.bottom) };
    });
    return { min: Math.min(...margins.map((m) => m.m)), cut: margins.filter((m) => m.m < 0).map((m) => `${m.id} by ${(-m.m).toFixed(0)}px`), map: { width: svg.width, height: svg.height } };
  }, ids);

/** The camera as drawn: the world layer's transform. */
const camera = (page: Page) =>
  page.locator('[data-testid="map-main"] [data-relief]').evaluate((el) => {
    const m = /translate\(([-\d.e]+),\s*([-\d.e]+)\)\s*scale\(([-\d.e]+)\)/.exec(el.parentElement!.getAttribute("transform")!)!;
    const svg = document.querySelector('[data-testid="map-main"]')!.getBoundingClientRect();
    return { x: +m[1], y: +m[2], k: +m[3], width: svg.width, height: svg.height };
  });

/** The world point in the middle of the map. */
const centreOf = (c: { x: number; y: number; k: number; width: number; height: number }) => [(c.width / 2 - c.x) / c.k, (c.height / 2 - c.y) / c.k];

const LABELS = {
  en: { zoomIn: "Zoom in", reset: "Show the whole map" },
  hy: { zoomIn: "Մեծացնել", reset: "Ցույց տալ ամբողջ քարտեզը" },
};

const SIZES: Record<string, [number, number][]> = {
  mobile: [
    [740, 360],
    [844, 390],
  ],
  "webkit-phone": [[844, 390]],
};

test("Level 7 in short landscape: map beside a readable panel through Discover, Find, Travel and Results", async ({ page }) => {
  test.skip(!(project() in SIZES), "Phones in landscape: Chromium (Pixel 7) and WebKit (iPhone 12).");
  test.setTimeout(400_000);
  const report: string[] = [];
  for (const [width, height] of SIZES[project()]) {
    await page.setViewportSize({ width, height });
    for (const locale of ["en", "hy"] as const) {
      const where = (what: string) => `${width}×${height} ${locale} ${what}`;

      // Discover: the whole map, then a real selection on it.
      await openLevel(page, L7, discoverAt(null), locale);
      const start = await expectSideBySide(page, where("Discover"));
      const f = await framing(page, COUNTRIES[L7]);
      report.push(`${where("map")} ${f.map.width.toFixed(0)}×${f.map.height.toFixed(0)}: smallest margin ${f.min.toFixed(1)}px${f.cut.length ? `; cut ${f.cut.join(", ")}` : ""}; panel ${start.panel.width.toFixed(0)}px wide`);
      // The five countries whole in the start view (Andorra is reached through its close-up).
      expect(f.cut, where("countries cut in the start view")).toEqual([]);
      await tapCountry(page, "ESP");
      await expect(page.getByTestId("country-card")).toHaveAttribute("data-country", "ESP");
      const card = await expectSideBySide(page, where("Discover, Spain"));
      report.push(`${where("Discover card")}: ${(card.sticky!.top - card.panel.top).toFixed(0)}px above the pinned action`);
      // The card's name at its phone size; the name and capital in view on arrival.
      const title = page.getByTestId("country-card").locator("h2");
      expect(parseFloat(await title.evaluate((e) => getComputedStyle(e).fontSize)), where("name size")).toBeGreaterThanOrEqual(19.2);
      expect((await page.getByTestId("country-capital").boundingBox())!.y + 20, where("capital in view")).toBeLessThanOrEqual(card.sticky!.top);
      if (locale === "en") await shot(page, `level7-${locale}-discover-ESP`);
      await expectReadableToEnd(page, where("Discover, Spain"));
      if (locale === "hy") await shot(page, `level7-${locale}-discover-ESP-end`);

      // Find: unanswered, then a wrong answer on the map.
      await openLevel(page, L7, findAsking(L7, "AND"), locale);
      await expectSideBySide(page, where("Find"));
      expect(await page.locator('[data-testid="map-main"] text').count(), where("Find shows no names")).toBe(0);
      await tapCountry(page, "ESP");
      await expect(page.getByTestId("find-feedback")).toBeVisible();
      await expectSideBySide(page, where("Find, answered"));
      await expectReadableToEnd(page, where("Find, answered"));

      // Travel: a real move.
      await openLevel(page, L7, travellingAt(L7, ["PRT"]), locale);
      const travel = await expectSideBySide(page, where("Travel"));
      const firstMove = (await page.locator('[data-testid^="move-"]').first().boundingBox())!;
      expect(firstMove.y + firstMove.height, where("first choice in view")).toBeLessThanOrEqual(height);
      expect(firstMove.height, where("choice touch target")).toBeGreaterThanOrEqual(44);
      report.push(`${where("Travel")}: first choice ends at ${(firstMove.y + firstMove.height).toFixed(0)}px of ${height}`);
      void travel;
      await page.getByTestId("move-ESP").click();
      await expect(page.getByTestId("route-line")).toHaveAttribute("data-route", "PRT,ESP");
      await expect(page.locator('[data-testid="map-main"] [data-traveller]')).toHaveAttribute("data-traveller", "ESP");
      await settle(page);
      await expectSideBySide(page, where("Travel, in Spain"));
      if (locale === "hy") await shot(page, `level7-${locale}-travel-ESP`);

      // Results, after the last move.
      await openLevel(page, L7, travellingAt(L7, ["PRT", "ESP", "FRA"]), locale);
      await page.getByTestId("move-ITA").click();
      await expect(page.getByTestId("result-crossings")).toBeVisible();
      await page.waitForTimeout(1200);
      await expectSideBySide(page, where("Results"));
      if (locale === "en") await shot(page, `level7-${locale}-results`);
      await expectReadableToEnd(page, where("Results"));
      if (locale === "en") await shot(page, `level7-${locale}-results-end`);
      // The traveller's pin in Rome, whole on the map.
      const pin = (await page.locator('[data-testid="map-main"] [data-traveller]').boundingBox())!;
      const map = (await page.getByTestId("map-main").boundingBox())!;
      expect(pin.x >= map.x && pin.y >= map.y && pin.x + pin.width <= map.x + map.width && pin.y + pin.height <= map.y + map.height, where("pin in Rome whole")).toBe(true);
    }
  }
  test.info().annotations.push({ type: "landscape", description: report.join("; ") });
  console.log(report.join("\n"));
});

test("Short landscape with enlarged text: still side by side, the panel scrolls to every action", async ({ page }) => {
  test.skip(project() !== "mobile", "Runs once.");
  test.setTimeout(300_000);
  const report: string[] = [];
  for (const [width, height] of [
    [740, 360],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    for (const locale of ["en", "hy"] as const)
      for (const size of [150, 200]) {
        const where = (what: string) => `${width}×${height} ${locale} ${size}% ${what}`;
        for (const [state, name] of [
          [discoverAt("PRT"), "Discover"],
          [travellingAt(L7, ["PRT"]), "Travel"],
          [done(L7), "Results"],
        ] as const) {
          await openLevel(page, L7, state, locale);
          await textSize(page, size);
          // Less reading room with the larger header and action, but still several lines.
          const s = await expectSideBySide(page, where(name), size === 150 ? 120 : 80);
          report.push(`${where(name)}: header ${s.header.height.toFixed(0)}px, map ${s.map.width.toFixed(0)}×${s.map.height.toFixed(0)}, ${((s.sticky && s.scroll.height > s.scroll.client + 1 ? s.sticky.top : s.panel.bottom) - s.panel.top).toFixed(0)}px to read`);
          await expectReadableToEnd(page, where(name));
          if (name === "Discover" && width === 740) await shot(page, `level7-${locale}-discover-PRT-text${size}`);
        }
      }
  }
  console.log(report.join("\n"));
});

/* Level 7's own illustrations (Belém Tower, the Sagrada Família, Casa de la Vall) at 740×360 in both languages: the
   card opens at its top beside the map, and scrolling the panel brings the whole drawn artwork (object-fit: contain,
   measured as drawn, not its box) between the panel's top and the pinned action, unstretched, inside its tile and the
   panel; then the whole card above the action. */
test("Level 7's illustrations in short landscape: each card's artwork and text reached in the panel above its action", async ({ page }) => {
  test.skip(!["mobile", "webkit-phone"].includes(project()), "Phones in landscape: Chromium (Pixel 7) and WebKit (iPhone 12).");
  test.setTimeout(200_000);
  await page.setViewportSize({ width: 740, height: 360 });
  const panel = page.getByTestId("panel");
  const alt = {
    en: { PRT: "Illustration of Belém Tower", ESP: "Illustration of the Sagrada Família", AND: "Illustration of Casa de la Vall" },
    hy: { PRT: "Նկարազարդում՝ Բելեմի աշտարակը", ESP: "Նկարազարդում՝ Սագրադա Ֆամիլիան", AND: "Նկարազարդում՝ Կասա դե լա Վալը" },
  } as const;
  const report: string[] = [];
  for (const locale of ["en", "hy"] as const)
    for (const id of ["PRT", "ESP", "AND"] as const) {
      const where = (what: string) => `740×360 ${locale} ${id} ${what}`;
      await openLevel(page, L7, discoverAt(id), locale);
      const s = await expectSideBySide(page, where("Discover"));
      const image = page.getByTestId("landmark-image");
      await expect(page.getByTestId("landmark-card")).toHaveAttribute("data-art", "illustration");
      await expect(image).toHaveAttribute("alt", alt[locale][id]);
      await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
      expect(await panel.evaluate((el) => el.scrollTop), where("card opened scrolled")).toBe(0);
      const capital = (await page.getByTestId("country-capital").boundingBox())!;
      expect(capital.y + capital.height, where("capital under the action")).toBeLessThanOrEqual(s.sticky!.top + 0.5);
      await shot(page, `level7-${locale}-discover-${id}-art`);
      // Scrolled until the art's tile ends just above the pinned action.
      await panel.evaluate((el) => {
        const tile = el.querySelector('[data-testid="landmark-image"]')!.closest("figure")!.querySelector("div")!.getBoundingClientRect();
        const fold = document.querySelector('[data-testid="sticky-actions"]')!.getBoundingClientRect().top;
        el.scrollBy(0, Math.max(0, tile.bottom - fold + 4));
      });
      const a = await image.evaluate((img: HTMLImageElement) => {
        const r = img.getBoundingClientRect();
        const k = Math.min(r.width / img.naturalWidth, r.height / img.naturalHeight);
        const [w, h] = [img.naturalWidth * k, img.naturalHeight * k];
        const tile = img.closest("figure")!.querySelector("div")!.getBoundingClientRect();
        const panel = document.querySelector('[data-testid="panel"]')!.getBoundingClientRect();
        return {
          art: { left: r.left + (r.width - w) / 2, right: r.left + (r.width + w) / 2, top: r.top + (r.height - h) / 2, bottom: r.top + (r.height + h) / 2, width: w, height: h },
          ratio: img.naturalWidth / img.naturalHeight,
          fit: getComputedStyle(img).objectFit,
          tile: { left: tile.left, right: tile.right, top: tile.top, bottom: tile.bottom },
          panel: { left: panel.left, right: panel.right, top: panel.top },
          fold: document.querySelector('[data-testid="sticky-actions"]')!.getBoundingClientRect().top,
        };
      });
      report.push(`${where("art")} drawn ${a.art.width.toFixed(0)}×${a.art.height.toFixed(0)}px`);
      await shot(page, `level7-${locale}-discover-${id}-art-scrolled`);
      expect(a.fit, where("art fit")).toBe("contain");
      expect(Math.abs(a.art.width / a.art.height - a.ratio), where("art stretched")).toBeLessThan(0.02);
      expect(a.art.top >= a.tile.top - 0.5 && a.art.bottom <= a.tile.bottom + 0.5 && a.art.left >= a.tile.left - 0.5 && a.art.right <= a.tile.right + 0.5, where("art outside its tile")).toBe(true);
      expect(a.art.left >= a.panel.left - 0.5 && a.art.right <= a.panel.right + 0.5, where("art outside the panel")).toBe(true);
      expect(a.art.top, where("art's top above the panel when its bottom shows")).toBeGreaterThanOrEqual(a.panel.top - 0.5);
      expect(a.art.bottom, where("art under the action")).toBeLessThanOrEqual(a.fold + 0.5);
      expect(Math.max(a.art.width, a.art.height), where("art too small")).toBeGreaterThanOrEqual(100);
      await expectReadableToEnd(page, where("Discover"));
    }
  console.log(report.join("\n"));
});

test("An earlier level in short landscape: Level 1 side by side, its countries whole, Luxembourg through the close-up", async ({ page }) => {
  test.skip(project() !== "mobile", "Runs once.");
  const L1 = "western-europe-1";
  for (const [width, height] of [
    [740, 360],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    for (const locale of ["en", "hy"] as const) {
      const where = `Level 1 ${width}×${height} ${locale}`;
      await openLevel(page, L1, discoverAt(null), locale);
      await expectSideBySide(page, where);
      const f = await framing(page, COUNTRIES[L1]);
      expect(f.cut, `${where}: countries cut`).toEqual([]);
      await tapCountry(page, "BEL");
      await expect(page.getByTestId("country-card")).toHaveAttribute("data-country", "BEL");
      await expectSideBySide(page, `${where}, Belgium`);
      await expectReadableToEnd(page, `${where}, Belgium`);
      // Luxembourg: named once, on the main map or in the close-up.
      const named = await page.evaluate(
        (names) => [...document.querySelectorAll('[data-testid="map-main"] text, [data-testid="map-inset"] text')].filter((t) => names.includes((t.textContent ?? "").trim())).length,
        ["Luxembourg", "Լյուքսեմբուրգ"],
      );
      expect(named, `${where}: Luxembourg named`).toBeLessThanOrEqual(1);
      if (locale === "en") await shot(page, `level1-${locale}-discover-BEL`);
    }
  }
});

/*
 * Turning the phone: the stage, the selection and a Travel move stay; a map the player moved stays where they left
 * it (the same place in its middle, zoomed as far past the start view), and a map at its start view takes the new
 * size's start view. "Show the whole map" then returns to that.
 */
test("Turning the phone keeps progress, the selection and the map view the player chose", async ({ page }) => {
  test.skip(!["mobile", "webkit-phone"].includes(project()), "Phones.");
  test.setTimeout(200_000);
  const portrait = { width: 390, height: 844 };
  const landscape = { width: 844, height: 390 };
  const zoomOf = async () => {
    const c = await camera(page);
    await page.getByRole("button", { name: LABELS.en.reset }).click();
    await page.waitForTimeout(600);
    const base = await camera(page);
    return { c, base };
  };

  // At the start view: each orientation's own start view.
  await page.setViewportSize(portrait);
  await openLevel(page, L7, discoverAt("PRT"));
  const p0 = await camera(page);
  await page.setViewportSize(landscape);
  await settle(page);
  await expect(page.getByTestId("country-card")).toHaveAttribute("data-country", "PRT");
  await expectSideBySide(page, "turned to landscape");
  const l0 = await camera(page);
  expect(l0.k, "a new start view for the new size").not.toBeCloseTo(p0.k, 3);
  const { c: l0again, base: lBase } = await zoomOf();
  expect(l0again.k).toBeCloseTo(lBase.k, 4);
  expect(l0again.x).toBeCloseTo(lBase.x, 0);
  expect((await framing(page, COUNTRIES[L7])).cut, "landscape start view").toEqual([]);

  // A view the player chose: zoomed in twice and moved.
  await page.setViewportSize(portrait);
  await settle(page);
  await page.getByRole("button", { name: LABELS.en.zoomIn }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: LABELS.en.zoomIn }).click();
  await page.waitForTimeout(500);
  const chosen = await camera(page);
  const portraitBase = (await zoomOf()).base;
  // zoomOf showed the whole map: choose the view again.
  await page.getByRole("button", { name: LABELS.en.zoomIn }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: LABELS.en.zoomIn }).click();
  await page.waitForTimeout(500);
  const before = await camera(page);
  expect(before.k).toBeCloseTo(chosen.k, 4);
  await page.setViewportSize(landscape);
  await settle(page);
  await expect(page.getByTestId("country-card")).toHaveAttribute("data-country", "PRT");
  const after = await camera(page);
  const { base: landscapeBase } = await zoomOf();
  // Zoomed as far past the start view as before, around the same place.
  expect(after.k / landscapeBase.k, "zoom kept").toBeCloseTo(before.k / portraitBase.k, 2);
  const [bx, by] = centreOf(before);
  const [ax, ay] = centreOf(after);
  expect(Math.hypot(ax - bx, ay - by) * after.k, "same place in the middle (px)").toBeLessThanOrEqual(40);

  // Back to portrait with the view chosen in landscape: kept too.
  await page.getByRole("button", { name: LABELS.en.zoomIn }).click();
  await page.waitForTimeout(500);
  const inLandscape = await camera(page);
  await page.setViewportSize(portrait);
  await settle(page);
  const back = await camera(page);
  expect(back.k / portraitBase.k, "zoom kept on turning back").toBeCloseTo(inLandscape.k / landscapeBase.k, 2);
  await expect(page.getByTestId("country-card")).toHaveAttribute("data-country", "PRT");

  // Travel: a move made in portrait stays after turning, and the next move works in landscape.
  await openLevel(page, L7, travellingAt(L7, ["PRT"]));
  await page.getByTestId("move-ESP").click();
  await expect(page.getByTestId("route-line")).toHaveAttribute("data-route", "PRT,ESP");
  await page.setViewportSize(landscape);
  await settle(page);
  await expect(page.getByTestId("route-line")).toHaveAttribute("data-route", "PRT,ESP");
  await expect(page.locator('[data-testid="map-main"] [data-traveller]')).toHaveAttribute("data-traveller", "ESP");
  await expectSideBySide(page, "Travel turned to landscape");
  await page.getByTestId("move-FRA").click();
  await expect(page.getByTestId("route-line")).toHaveAttribute("data-route", "PRT,ESP,FRA");
  await page.setViewportSize(portrait);
  await settle(page);
  await expect(page.getByTestId("route-line")).toHaveAttribute("data-route", "PRT,ESP,FRA");
  await expect(page.getByTestId("move-ITA")).toBeVisible();
});

/*
 * Ultra-wide desktops: the map stops at the widest it can be shown with the countries whole (Level 7 and Level 2
 * were cropped top and bottom at 2560×1080), centred, with the page around it; the start view and "Show the whole
 * map" show the five countries whole, and the traveller's pin in Lisbon. Ordinary desktops keep the full width.
 */
test("Ultra-wide desktop: the map no wider than shows the countries whole, centred; reset returns there", async ({ page }) => {
  test.skip(project() !== "desktop", "Runs once.");
  test.setTimeout(200_000);
  const area = () =>
    page.evaluate(() => {
      const map = document.querySelector('[data-testid="map-main"]')!.getBoundingClientRect();
      const box = document.querySelector('[data-testid="map-main"]')!.parentElement!.parentElement!.getBoundingClientRect();
      const s = getComputedStyle(document.querySelector('[data-testid="map-main"]')!.parentElement!.parentElement!);
      return { left: map.left - box.left - parseFloat(s.paddingLeft), right: box.right - parseFloat(s.paddingRight) - map.right, width: map.width };
    });
  const report: string[] = [];
  for (const [width, height, levelId, capped] of [
    [2560, 1080, L7, true],
    [2560, 1080, "around-the-alps", true],
    [3440, 1440, L7, true],
    [1920, 1080, L7, false],
    [1366, 800, L7, false],
  ] as const) {
    await page.setViewportSize({ width, height });
    await openLevel(page, levelId, discoverAt(null));
    const where = `${levelId} ${width}×${height}`;
    const a = await area();
    const f = await framing(page, COUNTRIES[levelId]);
    report.push(`${where}: map ${f.map.width.toFixed(0)}×${f.map.height.toFixed(0)}, page beside it ${a.left.toFixed(0)}/${a.right.toFixed(0)}px, smallest margin ${f.min.toFixed(1)}px`);
    if (capped) {
      expect(a.left, `${where}: page beside the map`).toBeGreaterThan(20);
      expect(Math.abs(a.left - a.right), `${where}: centred`).toBeLessThanOrEqual(1);
    } else {
      expect(Math.max(a.left, a.right), `${where}: full width`).toBeLessThanOrEqual(0.5);
    }
    expect(f.min, `${where}: a country touches or crosses the edge`).toBeGreaterThanOrEqual(10);
    if (levelId === L7 && width === 2560) await page.screenshot({ path: `screenshots/desktop/landscape-level7-map-${width}x${height}.png` });
    const start = await camera(page);
    await page.getByRole("button", { name: LABELS.en.zoomIn }).click();
    await page.waitForTimeout(500);
    await page.mouse.move(f.map.width / 2, height / 2);
    await page.mouse.down();
    await page.mouse.move(f.map.width / 2 + 200, height / 2 + 100, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: LABELS.en.reset }).click();
    await expect.poll(async () => JSON.stringify(await camera(page)), { timeout: 5000 }).toBe(JSON.stringify(start));
    expect((await framing(page, COUNTRIES[levelId])).min, `${where}: after reset`).toBeGreaterThanOrEqual(10);
  }
  // The traveller in Lisbon, at the map's south-west, whole in the start view.
  await page.setViewportSize({ width: 2560, height: 1080 });
  await openLevel(page, L7, travellingAt(L7, ["PRT"]));
  const pin = (await page.locator('[data-testid="map-main"] [data-traveller]').boundingBox())!;
  const map = (await page.getByTestId("map-main").boundingBox())!;
  expect(pin.x >= map.x && pin.y >= map.y && pin.x + pin.width <= map.x + map.width && pin.y + pin.height <= map.y + map.height, "pin in Lisbon whole").toBe(true);
  console.log(report.join("\n"));
});
