import { expect, test, type Page } from "@playwright/test";
import { openWithSave } from "./helpers/save";
import { homeToEurope } from "./helpers/home";

/*
 * Phone layout regressions: the level selection keeps the brand and language
 * switch in view above its scrolling list, its cards give a title the whole
 * width when it can't fit beside the badge, and Travel's neighbour buttons keep
 * their names and arrows apart, in one column when two would not fit. Also which
 * font each script is drawn in, and the layout with fonts late or missing.
 *
 * Screenshots go to screenshots/<project>/<SHOT_SET>/ (SHOT_SET defaults to
 * "after"; "before" was used to record the state before the fix). Layout
 * checks are soft, so every screenshot is taken even when one fails.
 */

const SET = process.env.SHOT_SET ?? "after";
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

const answers = (order: string[]) => order.map((target) => ({ target, wrongGuesses: 0, hintLevel: 0 }));
const records = (travelDone: boolean) => ({ discoverDone: true, findDone: travelDone, travelDone, lastFindScore: null, bestFindScore: null, travelWithoutHelp: false });
const findDone = (order: string[]) => ({ order, index: 4, question: { target: order[4], wrongGuesses: [], hintLevel: 0, solved: true, feedback: null }, results: answers(order), status: "complete" });
const done = (order: string[], missionId: string, route: string[]) => ({
  started: true,
  stage: "results",
  discover: { selected: null, explored: [] },
  find: findDone(order),
  travel: { missionId, path: route, hintUsed: false, undoUsed: false },
  lastTravelResult: { missionId, route, hintUsed: false, undoUsed: false },
  records: { ...records(true), lastFindScore: { independent: 5, total: 5 }, bestFindScore: { independent: 5, total: 5 } },
});
const inFind = (order: string[]) => ({
  started: true,
  stage: "find",
  discover: { selected: null, explored: order },
  find: { order, index: 1, question: { target: order[1], wrongGuesses: [], hintLevel: 0, solved: false, feedback: null }, results: answers(order.slice(0, 1)), status: "asking" },
  records: records(false),
});
const travelling = (order: string[], missionId: string, path: string[]) => ({
  started: true,
  stage: "travel",
  discover: { selected: null, explored: order },
  find: findDone(order),
  travel: { missionId, path, hintUsed: false, undoUsed: false },
  records: { ...records(false), findDone: true },
});
const L1_DONE = done(L1_ORDER, "fra-to-nld", ["FRA", "BEL", "NLD"]);
const L2_DONE = done(L2_COUNTRIES, "fra-to-aut", ["FRA", "DEU", "AUT"]);
const L3_DONE = done(L3_COUNTRIES, "pol-to-aut", ["POL", "CZE", "AUT"]);
const L4_DONE = done(L4_COUNTRIES, "ita-to-mne", ["ITA", "SVN", "HRV", "MNE"]);
const L5_DONE = done(L5_COUNTRIES, "hun-to-grc", ["HUN", "ROU", "BGR", "GRC"]);
const L6_DONE = done(L6_COUNTRIES, "deu-to-est", ["DEU", "POL", "LTU", "LVA", "EST"]);
const L7 = "iberian-journey";
const L7_DONE = done(["PRT", "ESP", "AND", "FRA", "ITA"], "prt-to-ita", ["PRT", "ESP", "FRA", "ITA"]);

async function appReady(page: Page) {
  await expect(page.locator(".splash")).toHaveCount(0);
  await expect(page.locator("main").first()).toBeVisible();
}

/** Enlarged text (the root font size, as the other specs set it), then a settled layout. */
async function textSize(page: Page, size: number) {
  await page.evaluate((s) => (document.documentElement.style.fontSize = s === 100 ? "" : `${s}%`), size);
  await fontsSettled(page);
}

/**
 * Waits for the fonts the page's language uses (loading them if nothing has asked for them yet,
 * which document.fonts.ready alone does not wait for), then for the layout, and anything the app
 * measures from it, to settle.
 */
async function fontsSettled(page: Page) {
  await page.evaluate(async () => {
    const loads = [document.fonts.load('900 16px "Nunito"', "Aa")];
    if (document.documentElement.lang === "hy") loads.push(document.fonts.load('900 16px "Noto Sans Armenian"', "Աա"));
    await Promise.all(loads).catch(() => undefined);
    await document.fonts.ready;
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
}

async function save(page: Page, levels: Record<string, object>, { locale = "en", screen = "welcome", levelId = L1, recent = [] as string[] } = {}) {
  await openWithSave(page, { version: 2, locale, screen, levelId, recent, levels });
  await appReady(page);
  await fontsSettled(page);
}


async function shot(page: Page, name: string) {
  const { width, height } = page.viewportSize()!;
  await page.screenshot({ path: `screenshots/${test.info().project.name}/${SET}/${name}-${width}x${height}.png` });
}

const project = () => test.info().project.name;
const isPhoneProject = () => project() === "small-phone" || project() === "webkit-phone";

/* --- Level selection ------------------------------------------------------------ */

const SCENARIOS: { name: string; levels: Record<string, object>; recent: string[]; current: string | null }[] = [
  { name: "l1-in-progress", levels: { [L1]: inFind(L1_ORDER) }, recent: [L1], current: L1 },
  { name: "l2-ready", levels: { [L1]: L1_DONE }, recent: [L1], current: L2 },
  { name: "l3-ready", levels: { [L1]: L1_DONE, [L2]: L2_DONE }, recent: [L2, L1], current: L3 },
  { name: "l3-in-progress", levels: { [L1]: L1_DONE, [L2]: L2_DONE, [L3]: inFind(L3_COUNTRIES) }, recent: [L3, L2, L1], current: L3 },
  { name: "l4-ready", levels: { [L1]: L1_DONE, [L2]: L2_DONE, [L3]: L3_DONE }, recent: [L3, L2, L1], current: L4 },
  { name: "l4-in-progress", levels: { [L1]: L1_DONE, [L2]: L2_DONE, [L3]: L3_DONE, [L4]: inFind(L4_COUNTRIES) }, recent: [L4, L3, L2, L1], current: L4 },
  { name: "l5-ready", levels: { [L1]: L1_DONE, [L2]: L2_DONE, [L3]: L3_DONE, [L4]: L4_DONE }, recent: [L4, L3, L2, L1], current: L5 },
  { name: "l6-ready", levels: { [L1]: L1_DONE, [L2]: L2_DONE, [L3]: L3_DONE, [L4]: L4_DONE, [L5]: L5_DONE }, recent: [L5, L4, L3, L2, L1], current: L6 },
  { name: "l6-in-progress", levels: { [L1]: L1_DONE, [L2]: L2_DONE, [L3]: L3_DONE, [L4]: L4_DONE, [L5]: L5_DONE, [L6]: inFind(L6_COUNTRIES) }, recent: [L6, L5, L4, L3, L2, L1], current: L6 },
  { name: "l7-ready", levels: { [L1]: L1_DONE, [L2]: L2_DONE, [L3]: L3_DONE, [L4]: L4_DONE, [L5]: L5_DONE, [L6]: L6_DONE }, recent: [L6, L5, L4, L3, L2, L1], current: L7 },
  { name: "all-completed", levels: { [L1]: L1_DONE, [L2]: L2_DONE, [L3]: L3_DONE, [L4]: L4_DONE, [L5]: L5_DONE, [L6]: L6_DONE, [L7]: L7_DONE }, recent: [L7, L6, L5, L4, L3, L2, L1], current: null },
];

/** Where things are on the level selection, in viewport pixels. */
const welcomeLayout = (page: Page) =>
  page.evaluate(() => {
    const box = (el: Element | null) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height };
    };
    const scroll = document.querySelector('[data-testid="welcome-scroll"]')!;
    const hero = document.querySelector('[data-testid="welcome-hero"]');
    const current = document.querySelector("[data-up-next]");
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      scroll: { ...box(scroll)!, scrollTop: scroll.scrollTop, scrollHeight: scroll.scrollHeight, clientHeight: scroll.clientHeight },
      // Back to the continents, in the header where AriMap was before continents (AriMap is on the continents).
      brand: box(hero?.querySelector('[data-testid="back-to-continents"]') ?? null),
      toggle: box(hero?.querySelector('[role="group"]') ?? null),
      heroInScroll: !!hero && scroll.contains(hero),
      action: box(document.querySelector('[data-testid="welcome-actions"]')),
      currentTitle: box(current?.querySelector("[data-level-title]") ?? null),
      currentStatus: box(current?.querySelector('[data-testid="level-status"]') ?? null),
      first: box(document.querySelector('[data-testid="levels"] > li')),
      last: box(document.querySelector('[data-testid="levels"] > li:last-child')),
      focused: document.activeElement?.tagName ?? null,
      pageScroll: document.scrollingElement?.scrollTop ?? 0,
    };
  });

test.describe("level selection", () => {
  test("Back to continents and the language switch stay in view above the scrolling list; the current level is in view; every card and action reachable", async ({ page }) => {
    test.setTimeout(600_000);
    const sizes = project() === "desktop" ? [[1366, 800]] : project() === "small-phone" ? [[320, 568], [390, 844]] : project() === "webkit-phone" ? [[320, 568], [390, 664]] : [];
    test.skip(sizes.length === 0, "Runs on the small-phone, webkit-phone and desktop projects.");
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      for (const s of SCENARIOS) {
        for (const locale of ["en", "hy"] as const) {
          for (const size of project() === "desktop" ? [100] : [100, 150, 200]) {
            // Arriving with the text size already enlarged: from inside the last level, by Home.
            await save(page, s.levels, { locale, screen: "lesson", recent: s.recent, levelId: s.recent[0] });
            await textSize(page, size);
            await homeToEurope(page);
            await expect(page.getByTestId("welcome")).toBeVisible();
            await fontsSettled(page);
            const where = `${width}×${height} ${s.name} ${locale} ${size}%`;
            const at = await welcomeLayout(page);
            expect.soft(await page.evaluate(() => document.documentElement.style.fontSize), `${where}: text size`).toBe(size === 100 ? "" : `${size}%`);
            await shot(page, `welcome-${s.name}-${locale}-text${size}`);

            // Back to the continents and the language switch: outside the scrolling list, whole and on screen.
            expect.soft(at.heroInScroll, `${where}: header inside the scrolling list`).toBe(false);
            for (const [what, b] of [["Back to continents", at.brand], ["language switch", at.toggle]] as const) {
              expect.soft(b, `${where}: ${what}`).not.toBeNull();
              if (!b) continue;
              expect.soft(b.top, `${where}: ${what} above the screen`).toBeGreaterThanOrEqual(-0.5);
              expect.soft(b.bottom, `${where}: ${what} under the list's top`).toBeLessThanOrEqual(at.scroll.top + 0.5);
            }
            // The page itself never scrolls; nothing took the keyboard focus.
            expect.soft(at.pageScroll, `${where}: the page scrolled`).toBe(0);
            // (Home is a button, so after it the focus is where the browser leaves it; only the list moved.)
            expect.soft(at.focused === "BODY" || at.focused === null, `${where}: focus moved into the list: ${at.focused}`).toBe(true);
            // The main action below the list, on screen.
            if (at.action) {
              expect.soft(at.scroll.bottom, `${where}: list under the action`).toBeLessThanOrEqual(at.action.top + 0.5);
              expect.soft(at.action.bottom, `${where}: action off screen`).toBeLessThanOrEqual(at.viewport.height + 0.5);
            }
            // The current level's whole title in the list's view, at every text size; its status too
            // at normal text size (at enlarged sizes the card may be taller than the list).
            expect.soft(!s.current || !!at.currentTitle, `${where}: current level's title not found`).toBe(true);
            if (s.current && at.currentStatus && at.currentTitle) {
              expect.soft(at.currentTitle.top, `${where}: current level's title above the list`).toBeGreaterThanOrEqual(at.scroll.top - 0.5);
              expect.soft(at.currentTitle.bottom, `${where}: current level's title under the list`).toBeLessThanOrEqual(at.scroll.bottom + 0.5);
              if (size === 100) expect.soft(at.currentStatus.bottom, `${where}: current level's status hidden`).toBeLessThanOrEqual(at.scroll.bottom + 0.5);
            }

            // Scrolling the list: Back to continents stays put; Level 1 is reachable at the top, the last card at the end.
            const list = page.getByTestId("welcome-scroll");
            await list.evaluate((el) => el.scrollTo(0, 0));
            const top = await welcomeLayout(page);
            expect.soft(top.first!.top, `${where}: Level 1 cut at the top`).toBeGreaterThanOrEqual(top.scroll.top - 0.5);
            await list.evaluate((el) => el.scrollTo(0, el.scrollHeight));
            const end = await welcomeLayout(page);
            expect.soft(end.last!.bottom, `${where}: last card under the action`).toBeLessThanOrEqual(end.scroll.bottom + 0.5);
            if (at.brand && end.brand) expect.soft(end.brand.top, `${where}: Back to continents moved with the list`).toBeCloseTo(at.brand.top, 0);
            if (size === 200 && width <= 390) await shot(page, `welcome-${s.name}-${locale}-text${size}-scrolled-end`);
            await list.evaluate((el) => el.scrollTo(0, 0));
          }
          await textSize(page, 100);
        }
      }
    }
  });

  test("a scroll position the player chose is kept across re-renders and a language change", async ({ page }) => {
    test.skip(project() !== "small-phone" && project() !== "webkit-phone", "Phones.");
    await page.setViewportSize({ width: 320, height: 568 });
    for (const size of [100, 200]) {
      await save(page, SCENARIOS[3].levels, { recent: SCENARIOS[3].recent, levelId: L3 });
      await textSize(page, size);
      const where = `${size}%`;
      const list = page.getByTestId("welcome-scroll");
      const max = await list.evaluate((el) => el.scrollHeight - el.clientHeight);
      expect(max, where).toBeGreaterThan(40);
      await list.evaluate((el) => el.scrollTo(0, 30));
      const stacked = () => page.locator("[data-level-head][data-stacked]").count();
      const before = await stacked();
      // A re-render (a card opened and closed) and a language change keep it.
      // Clicked in the page, so the test itself doesn't scroll the toggle into view.
      const toggle = page.getByTestId("level-western-europe-1").getByTestId("level-details-toggle");
      await toggle.evaluate((el: HTMLElement) => el.click());
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await toggle.evaluate((el: HTMLElement) => el.click());
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      expect(await list.evaluate((el) => el.scrollTop), where).toBe(30);
      expect(await stacked(), `${where}: a re-render changed the cards' layout`).toBe(before);
      await page.getByRole("button", { name: "Հայերեն", exact: true }).first().evaluate((el: HTMLElement) => el.click());
      await expect(page.getByTestId("level-status").first()).toHaveText("Ավարտված է");
      await fontsSettled(page);
      expect(await list.evaluate((el) => el.scrollTop), where).toBe(30);
      expect(await page.evaluate(() => document.scrollingElement!.scrollTop), `${where}: the page scrolled`).toBe(0);
      await page.getByRole("button", { name: "English", exact: true }).first().evaluate((el: HTMLElement) => el.click());
      await fontsSettled(page);
      expect(await list.evaluate((el) => el.scrollTop), where).toBe(30);
      await textSize(page, 100);
    }
  });

  test("a new player gets the world map in the scrolling page, under the header", async ({ page }) => {
    test.skip(project() !== "small-phone" && project() !== "webkit-phone", "Phones.");
    await page.setViewportSize({ width: 320, height: 568 });
    // On the continents (the home screen): the world map scrolls with the continents' names, under the
    // header with the name, tagline and language, and starts at the top, wholly in view.
    await save(page, {}, { screen: "continents" });
    expect(await page.evaluate(() => document.querySelector('[data-testid="continents-scroll"]')!.contains(document.querySelector('[data-testid="world-map"]')))).toBe(true);
    await expect(page.getByTestId("world-map")).toBeInViewport({ ratio: 1 });
    expect(await page.getByTestId("continents-scroll").evaluate((el) => el.scrollTop)).toBe(0);
    await shot(page, "welcome-new-en-text100");
  });
});

/* --- Level cards ------------------------------------------------------------------ */

type Box = { left: number; right: number; top: number; bottom: number; width: number; height: number };

/** The gap beside the title in a card's usual head (--head-gap in WelcomeScreen.module.css). */
const HEAD_GAP = 12;

/** Each level card's head, measured: its parts, the title's words, and whether it is stacked. */
const cardsLayout = (page: Page) =>
  page.evaluate(() => {
    const box = (el: Element | null | undefined) => {
      if (!el || el.getClientRects().length === 0) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
    };
    return [...document.querySelectorAll('[data-testid="levels"] > li > article')].map((card) => {
      const head = card.querySelector("[data-level-head]")!;
      const title = head.querySelector("[data-level-title]")!;
      const hs = getComputedStyle(head);
      const hr = head.getBoundingClientRect();
      const content = {
        left: hr.left + parseFloat(hs.paddingLeft) + parseFloat(hs.borderLeftWidth),
        right: hr.right - parseFloat(hs.paddingRight) - parseFloat(hs.borderRightWidth),
      };
      // Each word: its width in its own font on one line (measured apart from the card), and the
      // number of lines it is laid out on in the card.
      const range = document.createRange();
      const wordsOf = (el: Element | null | undefined) => {
        const words: { text: string; natural: number; lines: number }[] = [];
        if (!el) return words;
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
            words.push({ text: m[0], natural: probe.getBoundingClientRect().width, lines });
            probe.remove();
          }
        }
        return words;
      };
      const words = wordsOf(title);
      // A completed card's status, in its head: its words, and what its pill adds around them (icon, padding).
      const status = head.querySelector('[data-testid="level-status"]');
      const statusText = status?.lastElementChild;
      const statusChrome = status && statusText ? status.getBoundingClientRect().width - statusText.getBoundingClientRect().width : 0;
      range.selectNodeContents(title);
      const glyphs = [...range.getClientRects()].filter((r) => r.width > 0);
      const sides = [...head.querySelectorAll(":scope > [data-level-side]")];
      return {
        id: card.getAttribute("data-testid")!,
        stacked: head.hasAttribute("data-stacked"),
        card: box(card)!,
        content,
        badge: box(sides.find((e) => e.tagName.toLowerCase() !== "svg")),
        chevron: box(sides.find((e) => e.tagName.toLowerCase() === "svg")),
        number: box(head.querySelector("[data-level-number]")),
        status: box(head.querySelector('[data-testid="level-status"]')),
        title: box(title)!,
        titleText: title.textContent ?? "",
        textLeft: Math.min(...glyphs.map((r) => r.left)),
        textRight: Math.max(...glyphs.map((r) => r.right)),
        words,
        statusWords: wordsOf(statusText),
        statusChrome,
      };
    });
  });

/**
 * Checks every card's head: the title beside the badge while its words fit there, otherwise below
 * the badge, number, status and chevron with the whole width; no word broken that fits the title's
 * width; nothing overlapping or outside the card; the page no wider than the screen.
 */
async function expectCardsClear(page: Page, where: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect.soft(overflow, `${where}: the page is wider than the screen`).toBeLessThanOrEqual(0);
  const cards = await cardsLayout(page);
  for (const c of cards) {
    const w = `${where} ${c.id} «${c.titleText}»`;
    const full = c.content.right - c.content.left;
    const beside = full - [c.badge, c.chevron].reduce((sum, b) => sum + (b ? b.width + HEAD_GAP : 0), 0);
    // What the title's column must hold: the title's widest word, and a completed card's status
    // (its widest word in its pill).
    const widest = Math.max(...c.words.map((x) => x.natural), ...c.statusWords.map((x) => x.natural + c.statusChrome));
    // Stacked exactly when that can't fit beside the badge (and chevron); within a pixel either
    // way, the measurements' rounding decides.
    if (Math.abs(widest - beside) > 1) expect.soft(c.stacked, `${w}: stacked? widest word ${widest.toFixed(1)}px, room beside the badge ${beside.toFixed(1)}px`).toBe(widest > beside);
    if (c.stacked) {
      for (const [name, b] of [["badge", c.badge], ["number", c.number], ["status", c.status], ["chevron", c.chevron]] as const) {
        if (b) expect.soft(c.title.top, `${w}: title not below the ${name}`).toBeGreaterThanOrEqual(b.bottom - 0.5);
      }
      expect.soft(Math.abs(c.title.left - c.content.left), `${w}: title doesn't start at the card's content edge`).toBeLessThanOrEqual(1);
      expect.soft(Math.abs(c.title.right - c.content.right), `${w}: title doesn't have the content's whole width`).toBeLessThanOrEqual(1);
    } else if (c.badge) {
      expect.soft(c.title.left, `${w}: title not beside the badge`).toBeGreaterThanOrEqual(c.badge.right + HEAD_GAP - 0.5);
    }
    // A word is broken only when it is wider than the title's whole box; a status word only when
    // it can't fit the card's whole width in its pill.
    for (const x of c.words) {
      if (x.lines > 1) expect.soft(x.natural, `${w}: «${x.text}» broken though it fits the title's ${c.title.width.toFixed(1)}px`).toBeGreaterThan(c.title.width + 0.5);
    }
    for (const x of c.statusWords) {
      if (x.lines > 1) expect.soft(x.natural + c.statusChrome, `${w}: status word «${x.text}» broken though it fits`).toBeGreaterThan(full + 0.5);
    }
    // Nothing overlaps; everything inside the card.
    const parts = ([["badge", c.badge], ["number", c.number], ["status", c.status], ["chevron", c.chevron], ["title", c.title]] as [string, Box | null][]).filter(
      (p): p is [string, Box] => p[1] !== null,
    );
    parts.forEach(([name, b], i) => {
      expect.soft(b.left >= c.card.left - 0.5 && b.right <= c.card.right + 0.5, `${w}: ${name} outside the card`).toBe(true);
      for (const [other, d] of parts.slice(i + 1)) {
        const overlap = Math.min(b.right, d.right) - Math.max(b.left, d.left) > 0.5 && Math.min(b.bottom, d.bottom) - Math.max(b.top, d.top) > 0.5;
        expect.soft(overlap, `${w}: ${name} overlaps ${other}`).toBe(false);
      }
    });
    expect.soft(c.textLeft >= c.content.left - 0.5 && c.textRight <= c.content.right + 0.5, `${w}: the title's text runs outside the card`).toBe(true);
  }
  return cards;
}

/**
 * Every part of every card (its head, its details when open, and each button) can be scrolled
 * fully into the list's view, between the header and the main action: whole if it is no taller
 * than the list, otherwise its top and its bottom in turn. Scrolls only the list.
 */
async function cardsUnreachable(page: Page) {
  return page.evaluate(() => {
    const list = document.querySelector('[data-testid="welcome-scroll"]')!;
    const fails: string[] = [];
    const items: [string, Element][] = [];
    for (const card of document.querySelectorAll('[data-testid="levels"] > li > article')) {
      const id = card.getAttribute("data-testid");
      const head = card.querySelector("[data-level-head]")!;
      items.push([`${id} head`, head]);
      const body = card.hasAttribute("data-compact") ? card.querySelector(":scope > div") : card;
      for (const part of body?.children ?? []) if (!part.contains(head)) items.push([`${id} ${part.tagName.toLowerCase()} «${(part.textContent ?? "").slice(0, 24)}»`, part]);
      for (const button of card.querySelectorAll("button")) items.push([`${id} button «${button.textContent}»`, button]);
    }
    // WebKit keeps scrollTop in whole pixels while boxes sit at fractions of one: within a pixel.
    const slack = 1;
    for (const [name, el] of items) {
      if (el.getClientRects().length === 0) continue; // a closed card's details
      let r = el.getBoundingClientRect();
      let l = list.getBoundingClientRect();
      list.scrollTop += r.top - l.top;
      r = el.getBoundingClientRect();
      if (r.top < l.top - slack || r.top > l.bottom) fails.push(`${name}: its top can't be scrolled into view (${(r.top - l.top).toFixed(1)})`);
      list.scrollTop += Math.ceil(r.bottom - l.bottom);
      r = el.getBoundingClientRect();
      l = list.getBoundingClientRect();
      if (r.bottom > l.bottom + slack) fails.push(`${name}: its bottom can't be scrolled into view (${(r.bottom - l.bottom).toFixed(1)})`);
      if (r.height <= l.height && r.top < l.top - slack) fails.push(`${name}: never whole in view`);
    }
    list.scrollTop = 0;
    return fails;
  });
}

/** The header (brand and language) and the main action on screen around the list; the page itself not scrolled. */
async function expectFrame(page: Page, where: string) {
  const at = await welcomeLayout(page);
  expect.soft(at.pageScroll, `${where}: the page scrolled`).toBe(0);
  expect.soft(await page.evaluate(() => document.scrollingElement!.scrollHeight - window.innerHeight), `${where}: the page itself can scroll`).toBeLessThanOrEqual(0);
  for (const [what, b] of [["brand", at.brand], ["language switch", at.toggle]] as const) {
    expect.soft(!!b && b.top >= -0.5 && b.bottom <= at.scroll.top + 0.5, `${where}: ${what} not whole above the list`).toBe(true);
  }
  if (at.action) {
    expect.soft(at.scroll.bottom, `${where}: list under the action`).toBeLessThanOrEqual(at.action.top + 0.5);
    expect.soft(at.action.bottom, `${where}: action off screen`).toBeLessThanOrEqual(at.viewport.height + 0.5);
  }
  return at;
}

/** Screenshots of the list: as it arrived, then scrolled to Level 1 (opened) and to the last card (Level 5). */
async function cardShots(page: Page, name: string) {
  const list = page.getByTestId("welcome-scroll");
  const scrollTo = (selector: string) =>
    list.evaluate((el, selector) => {
      const target = el.querySelector(selector)!;
      el.scrollTop += target.getBoundingClientRect().top - el.getBoundingClientRect().top;
    }, selector);
  const at = await list.evaluate((el) => el.scrollTop);
  await scrollTo(`[data-testid="level-${L1}"]`);
  await shot(page, `${name}-l1-opened`);
  await scrollTo('[data-testid="levels"] > li:last-child');
  await shot(page, `${name}-last-card`);
  await list.evaluate((el, at) => (el.scrollTop = at), at);
}

const openAllCards = async (page: Page) => {
  for (const toggle of await page.getByTestId("level-details-toggle").all()) {
    if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.evaluate((el: HTMLElement) => el.click());
  }
  await fontsSettled(page);
  // Each chevron turns over as its card opens (0.2s): measured once still, never mid-turn (a turning
  // chevron's box is wider, which would understate the title's room).
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
};

test.describe("level cards", () => {
  // One test per screen size, each in a fresh page: all three sizes in one WebKit page took 8–11 minutes,
  // and once lost the page near the end (no assertion failed; it passed when run again).
  for (const [width, height] of [[320, 568], [390, 844], [1366, 800]]) {
    test(`a title takes the card's whole width when it can't fit beside the badge; nothing overlaps; every part reachable, at ${width}×${height}`, async ({ page }) => {
      test.setTimeout(600_000);
      const projects = width > 1000 ? ["desktop", "webkit-phone"] : ["small-phone", "webkit-phone"];
      test.skip(!projects.includes(project()), `Runs on the ${projects.join(" and ")} projects.`);
      // Level 3 ready and in progress, Level 4 ready and in progress (Bosnia and Herzegovina's long name in
      // its card), Levels 5, 6 and 7 ready, and all seven completed.
      const scenarios = SCENARIOS.filter((s) => ["l3-ready", "l3-in-progress", "l4-ready", "l4-in-progress", "l5-ready", "l6-ready", "l7-ready", "all-completed"].includes(s.name));
      await page.setViewportSize({ width, height });
      for (const s of scenarios) {
        for (const locale of ["en", "hy"] as const) {
          for (const size of [100, 150, 200]) {
            // Arriving with the text size already enlarged: from inside the last level, by Home.
            await save(page, s.levels, { locale, screen: "lesson", recent: s.recent, levelId: s.recent[0] });
            await textSize(page, size);
            await homeToEurope(page);
            await expect(page.getByTestId("welcome")).toBeVisible();
            await fontsSettled(page);
            const where = `${width}×${height} ${s.name} ${locale} ${size}%`;
            // The current level revealed without moving the header, the page or the focus.
            const at = await expectFrame(page, where);
            expect.soft(await page.evaluate(() => !!document.activeElement?.closest('[data-testid="welcome-scroll"]')), `${where}: focus moved into the list`).toBe(false);
            if (s.current && at.currentTitle) {
              expect.soft(at.currentTitle.top >= at.scroll.top - 0.5 && at.currentTitle.bottom <= at.scroll.bottom + 0.5, `${where}: the current level's title not whole in view`).toBe(true);
            }
            await shot(page, `cards-${s.name}-${locale}-text${size}`);
            await expectCardsClear(page, where);
            // Completed cards opened: their summaries keep the same head; details and buttons reachable.
            await openAllCards(page);
            await expectCardsClear(page, `${where}, opened`);
            expect.soft(await cardsUnreachable(page), `${where}: parts that can't be scrolled into view`).toEqual([]);
            await expectFrame(page, `${where}, after scrolling`);
            if (width < 1000 || size !== 150) await cardShots(page, `cards-${s.name}-${locale}-text${size}`);
          }
          await textSize(page, 100);
        }
      }
    });
  }
});

/* --- Fonts ------------------------------------------------------------------------ */

test.describe("fonts", () => {
  test("Latin text is drawn in Nunito and Armenian in Noto Sans Armenian", async ({ page }) => {
    test.skip(project() === "mobile", "Runs on the small-phone, webkit-phone and desktop projects.");
    for (const locale of ["en", "hy"] as const) {
      await save(page, SCENARIOS[2].levels, { locale, recent: SCENARIOS[2].recent, levelId: L3 });
      const r = await page.evaluate(() => {
        const title = document.querySelector("[data-up-next] [data-level-title]")!;
        const ts = getComputedStyle(title);
        // The title's letters (spaces left out: they are Nunito's in either language), set in the
        // app's own font stack and in each font alone, at the title's weight and size.
        const text = (title.textContent ?? "").replace(/\s+/g, "");
        const width = (family: string) => {
          const probe = document.createElement("span");
          probe.textContent = text;
          Object.assign(probe.style, { position: "absolute", visibility: "hidden", whiteSpace: "nowrap", fontStyle: ts.fontStyle, fontWeight: ts.fontWeight, fontSize: ts.fontSize, fontFamily: family });
          document.body.appendChild(probe);
          const w = probe.getBoundingClientRect().width;
          probe.remove();
          return w;
        };
        const status = (family: string, codepoint: string) =>
          [...document.fonts].filter((f) => f.family.replace(/["']/g, "") === family && f.unicodeRange.toUpperCase().includes(codepoint)).map((f) => f.status);
        return {
          text,
          app: width(ts.fontFamily),
          nunito: width('"Nunito"'),
          noto: width('"Noto Sans Armenian"'),
          arial: width("Arial"),
          nunitoFaces: status("Nunito", "U+0-FF"),
          notoFaces: status("Noto Sans Armenian", "U+530-58F"),
        };
      });
      const expected = locale === "hy" ? r.noto : r.nunito;
      expect(Math.abs(r.app - expected), `${locale} «${r.text}»: ${r.app.toFixed(1)}px in the app's fonts; ${expected.toFixed(1)}px in ${locale === "hy" ? "Noto Sans Armenian" : "Nunito"}; ${r.arial.toFixed(1)}px in Arial`).toBeLessThanOrEqual(0.5);
      expect(locale === "hy" ? r.notoFaces : r.nunitoFaces, `${locale}: the web font's faces`).toContain("loaded");
    }
  });

  test("with the fonts late or missing, the level cards and Travel stay usable", async ({ page, browser }) => {
    test.setTimeout(600_000);
    test.skip(!isPhoneProject(), "Phones.");
    await page.setViewportSize({ width: 320, height: 568 });
    const s = SCENARIOS.find((x) => x.name === "l3-in-progress")!;

    // Late: the page as it first appears, in the stand-in fonts, and again once the fonts arrive
    // (the cards are measured again then). A fresh browser context each time, whose first page
    // load is the arrival: a reload could take the fonts from the browser's memory.
    const use = test.info().project.use;
    for (const locale of ["en", "hy"] as const) {
      const context = await browser.newContext({
        baseURL: use.baseURL,
        viewport: { width: 320, height: 568 },
        isMobile: use.isMobile,
        hasTouch: use.hasTouch,
        deviceScaleFactor: use.deviceScaleFactor,
        userAgent: use.userAgent,
      });
      const late = await context.newPage();
      await late.route(/\.woff2$/, async (route) => {
        await new Promise((done) => setTimeout(done, 2500));
        await route.continue().catch(() => undefined);
      });
      const saved = JSON.stringify({ version: 2, locale, screen: "welcome", levelId: L3, recent: s.recent, levels: s.levels });
      await late.addInitScript((v) => {
        if (!sessionStorage.getItem("test:seeded")) {
          localStorage.setItem("arimap:state", v);
          sessionStorage.setItem("test:seeded", "1");
        }
      }, saved);
      // Not waiting for the load event: that waits for the (preloaded) fonts.
      await late.goto("/", { waitUntil: "domcontentloaded" });
      await appReady(late);
      await late.evaluate(() => (document.documentElement.style.fontSize = "200%"));
      await late.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
      const where = `fonts late, ${locale} 200%`;
      const early = await late.evaluate((lang) => [...document.fonts].filter((f) => f.family.replace(/["']/g, "") === (lang === "hy" ? "Noto Sans Armenian" : "Nunito") && f.status === "loaded").length, locale);
      expect.soft(early, `${where}: the fonts had already loaded, so the stand-ins weren't tested`).toBe(0);
      await shot(late, `cards-fonts-late-${locale}-text200-before`);
      await expectFrame(late, `${where}, before they arrive`);
      await expectCardsClear(late, `${where}, before they arrive`);
      await fontsSettled(late);
      await shot(late, `cards-fonts-late-${locale}-text200-after`);
      await expectFrame(late, `${where}, once they arrive`);
      await expectCardsClear(late, `${where}, once they arrive`);
      await context.close();
    }

    // Missing: the fonts never load; the system's fonts stand in.
    await page.route(/\.woff2$/, (route) => route.abort());
    for (const locale of ["en", "hy"] as const) {
      for (const size of [100, 200]) {
        const where = `fonts missing, ${locale} ${size}%`;
        await save(page, s.levels, { locale, recent: s.recent, levelId: L3 });
        await textSize(page, size);
        await expectFrame(page, where);
        await expectCardsClear(page, where);
        await openAllCards(page);
        expect.soft(await cardsUnreachable(page), `${where}: parts that can't be scrolled into view`).toEqual([]);
        await shot(page, `cards-no-fonts-${locale}-text${size}`);
        await openTravel(page, L1, ["FRA", "BEL"], locale);
        await textSize(page, size);
        await expectNeighboursClear(page, `${where}, Travel in Belgium`, ["FRA", "NLD", "LUX", "DEU"]);
        await expectTravelReachable(page, `${where}, Travel in Belgium`);
        await page.locator('[aria-labelledby="neighbors-heading"]').evaluate((el) => el.scrollIntoView({ block: "center" }));
        await shot(page, `travel-belgium-no-fonts-${locale}-text${size}`);
      }
    }
    await page.unroute(/\.woff2$/);
  });
});

/* --- Travel ----------------------------------------------------------------------- */

/** Neighbour buttons: their boxes, the text's own glyph boxes and the arrow's, and an independent single-line width. */
const neighbourLayout = (page: Page) =>
  page.evaluate(() => {
    const grid = document.querySelector('[role="group"][aria-labelledby="neighbors-heading"]')!;
    const gr = grid.getBoundingClientRect();
    const gs = getComputedStyle(grid);
    return {
      grid: { left: gr.left, right: gr.right, width: gr.width, gap: parseFloat(gs.columnGap) || 0 },
      buttons: [...grid.querySelectorAll('button[data-testid^="move-"]')].map((b) => {
        const label = b.querySelector("span")!;
        const arrow = b.querySelector("svg")!;
        const br = b.getBoundingClientRect();
        const ar = arrow.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(label);
        const rects = [...range.getClientRects()].filter((r) => r.width > 0);
        const cs = getComputedStyle(b);
        const ls = getComputedStyle(label);
        // The label's single-line width in its own font, measured apart from the button.
        const probe = document.createElement("span");
        probe.textContent = label.textContent;
        Object.assign(probe.style, { position: "absolute", visibility: "hidden", whiteSpace: "nowrap", font: ls.font, letterSpacing: ls.letterSpacing });
        document.body.appendChild(probe);
        const natural = probe.getBoundingClientRect().width;
        probe.remove();
        const lineTops = new Set(rects.map((r) => Math.round(r.top)));
        return {
          id: b.getAttribute("data-testid")!.slice(5),
          text: label.textContent,
          box: { left: br.left, right: br.right, top: br.top, bottom: br.bottom, height: br.height },
          textLeft: Math.min(...rects.map((r) => r.left)),
          textRight: Math.max(...rects.map((r) => r.right)),
          lines: lineTops.size,
          labelOverflow: label.scrollWidth - label.clientWidth,
          arrow: { left: ar.left, right: ar.right, width: ar.width },
          chrome: parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth) + (parseFloat(cs.columnGap) || 0) + ar.width,
          insetLeft: parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth),
          insetRight: parseFloat(cs.paddingRight) + parseFloat(cs.borderRightWidth),
          natural,
        };
      }),
    };
  });

/** Checks the neighbour buttons: separate name and arrow, one column when two would not fit, whole touch targets. */
async function expectNeighboursClear(page: Page, where: string, expectedMoves?: string[]) {
  const n = await neighbourLayout(page);
  if (expectedMoves) expect.soft(n.buttons.map((b) => b.id).sort(), `${where}: moves`).toEqual([...expectedMoves].sort());
  const columns = new Set(n.buttons.map((b) => Math.round(b.box.left))).size;
  const widest = Math.max(...n.buttons.map((b) => b.natural + b.chrome));
  const fitsTwo = widest <= (n.grid.width - n.grid.gap) / 2 + 0.5;
  expect.soft(columns, `${where}: ${columns} columns; widest label needs ${widest.toFixed(1)}px, half the grid is ${((n.grid.width - n.grid.gap) / 2).toFixed(1)}px`).toBe(fitsTwo && n.buttons.length > 1 ? 2 : 1);
  for (const b of n.buttons) {
    const w = `${where} ${b.id} «${b.text}»`;
    expect.soft(b.arrow.width, `${w}: arrow shrunk`).toBeCloseTo(20, 0);
    expect.soft(b.arrow.left - b.textRight, `${w}: name and arrow closer than 8px (or overlapping)`).toBeGreaterThanOrEqual(7.5);
    expect.soft(b.textLeft, `${w}: name outside the button's padding`).toBeGreaterThanOrEqual(b.box.left + b.insetLeft - 0.5);
    expect.soft(b.arrow.right, `${w}: arrow outside the button's padding`).toBeLessThanOrEqual(b.box.right - b.insetRight + 0.5);
    expect.soft(b.box.right, `${w}: button wider than the grid`).toBeLessThanOrEqual(n.grid.right + 0.5);
    expect.soft(b.labelOverflow, `${w}: name overflows its box`).toBeLessThanOrEqual(1);
    expect.soft(b.box.height, `${w}: touch target`).toBeGreaterThanOrEqual(44);
    // Two columns only for names on one line; a name that fits the full width is never broken.
    if (columns === 2) expect.soft(b.lines, `${w}: wraps in two columns`).toBe(1);
    if (b.natural + b.chrome <= n.grid.width + 0.5 && !/\s/.test(b.text!)) expect.soft(b.lines, `${w}: a word that fits was broken`).toBe(1);
  }
  return { columns };
}

/** Travel's content and controls: the summary at the top, the tools and note at the bottom, all reachable on screen. */
async function expectTravelReachable(page: Page, where: string) {
  const panel = page.getByTestId("panel");
  const inView = async (sel: string) =>
    page.evaluate((sel) => {
      const el = document.querySelector(sel)!;
      const p = document.querySelector('[data-testid="panel"]')!.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, panelTop: p.top, panelBottom: p.bottom, screen: window.innerHeight };
    }, sel);
  await panel.evaluate((el) => el.scrollTo(0, 0));
  for (const sel of ['[data-testid="panel"] h1', '[data-testid="crossings-left"]']) {
    await page.locator(sel).first().evaluate((el) => el.scrollIntoView({ block: "nearest" }));
    const b = await inView(sel);
    expect.soft(b.top, `${where}: ${sel} above the panel`).toBeGreaterThanOrEqual(b.panelTop - 0.5);
    expect.soft(b.bottom, `${where}: ${sel} under the panel`).toBeLessThanOrEqual(Math.min(b.panelBottom, b.screen) + 0.5);
  }
  // At the end of the panel: the tools and the note, each brought fully into view by scrolling.
  await panel.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  const last = await inView('[data-testid="travel-note"]');
  expect.soft(last.bottom, `${where}: the note under the panel's end`).toBeLessThanOrEqual(Math.min(last.panelBottom, last.screen) + 0.5);
  // Each brought into view by scrolling: whole, or (taller than the visible panel, e.g. the note at
  // 200% text) its top and its bottom in turn.
  for (const sel of ['[data-testid="travel-tools"]', '[data-testid="travel-note"]']) {
    await page.locator(sel).evaluate((el) => el.scrollIntoView({ block: "start" }));
    const b = await inView(sel);
    expect.soft(b.top, `${where}: ${sel}: its top can't be scrolled into view`).toBeGreaterThanOrEqual(b.panelTop - 0.5);
    expect.soft(b.top, `${where}: ${sel}: its top under the panel or screen`).toBeLessThanOrEqual(Math.min(b.panelBottom, b.screen));
    await page.locator(sel).evaluate((el) => el.scrollIntoView({ block: "end" }));
    const e = await inView(sel);
    expect.soft(e.bottom, `${where}: ${sel}: its bottom under the panel or the screen's edge`).toBeLessThanOrEqual(Math.min(e.panelBottom, e.screen) + 0.5);
    if (e.bottom - e.top <= e.panelBottom - e.panelTop) expect.soft(e.top, `${where}: ${sel} not whole in view`).toBeGreaterThanOrEqual(e.panelTop - 0.5);
  }
  for (const name of ["Hint", "Undo", "Restart", "Հուշում", "Հետարկել", "Նորից"]) {
    const button = page.getByTestId("travel-tools").getByRole("button", { name, exact: true });
    if ((await button.count()) === 0) continue;
    const b = (await button.boundingBox())!;
    expect.soft(b.height, `${where}: ${name} touch target`).toBeGreaterThanOrEqual(44);
  }
}

async function openTravel(page: Page, level: string, path: string[], locale: string) {
  const setup: Record<string, { levels: Record<string, object>; recent: string[] }> = {
    [L1]: { levels: { [L1]: travelling(L1_ORDER, "fra-to-nld", path) }, recent: [L1] },
    [L2]: { levels: { [L1]: L1_DONE, [L2]: travelling(L2_COUNTRIES, "fra-to-aut", path) }, recent: [L2, L1] },
    [L3]: { levels: { [L1]: L1_DONE, [L2]: L2_DONE, [L3]: travelling(L3_COUNTRIES, "pol-to-aut", path) }, recent: [L3, L2, L1] },
    [L4]: { levels: { [L1]: L1_DONE, [L2]: L2_DONE, [L3]: L3_DONE, [L4]: travelling(L4_COUNTRIES, "ita-to-mne", path) }, recent: [L4, L3, L2, L1] },
  };
  await save(page, setup[level].levels, { locale, screen: "lesson", levelId: level, recent: setup[level].recent });
  await expect(page.locator('[data-testid^="move-"]').first()).toBeVisible();
}

test.describe("Travel neighbour buttons", () => {
  test("Level 1 in Belgium: four neighbours, names clear of arrows, in both languages at 320–414px and enlarged text", async ({ page }) => {
    test.setTimeout(600_000);
    test.skip(!isPhoneProject(), "Runs on the small-phone (Chromium) and webkit-phone (WebKit) projects.");
    const sizes = project() === "webkit-phone" ? [[320, 568], [375, 667], [390, 664], [414, 896]] : [[320, 568], [375, 667], [390, 844], [414, 896]];
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      for (const locale of ["en", "hy"] as const) {
        await openTravel(page, L1, ["FRA", "BEL"], locale);
        for (const size of [100, 150, 200]) {
          await textSize(page, size);
          const where = `${width}×${height} ${locale} ${size}%`;
          await page.locator('[aria-labelledby="neighbors-heading"]').evaluate((el) => el.scrollIntoView({ block: "center" }));
          await shot(page, `travel-belgium-${locale}-text${size}`);
          await expectNeighboursClear(page, where, ["FRA", "NLD", "LUX", "DEU"]);
          await expectTravelReachable(page, where);
        }
        await textSize(page, 100);
      }
    }
  });

  test("every neighbour set a journey offers, in Levels 1–4, in both languages", async ({ page }) => {
    test.setTimeout(600_000);
    test.skip(project() !== "small-phone" && project() !== "desktop", "Chromium phone and desktop.");
    // The countries a journey can stand in with crossings left: the start and its neighbours.
    const states: [string, string[]][] = [
      [L1, ["FRA"]], [L1, ["FRA", "BEL"]], [L1, ["FRA", "LUX"]], [L1, ["FRA", "DEU"]],
      [L2, ["FRA"]], [L2, ["FRA", "CHE"]], [L2, ["FRA", "DEU"]], [L2, ["FRA", "ITA"]],
      [L3, ["POL"]], [L3, ["POL", "CZE"]], [L3, ["POL", "SVK"]], [L3, ["POL", "DEU"]],
      // Level 4 is a chain: Italy's only neighbour is Slovenia; Croatia offers Bosnia and Herzegovina's long name.
      [L4, ["ITA"]], [L4, ["ITA", "SVN"]], [L4, ["ITA", "SVN", "HRV"]],
    ];
    const sizes = project() === "desktop" ? [[1366, 800]] : [[320, 568], [390, 844]];
    const summary: string[] = [];
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      for (const locale of ["en", "hy"] as const) {
        for (const [level, path] of states) {
          await openTravel(page, level, path, locale);
          for (const size of project() === "desktop" ? [100] : [100, 200]) {
            await textSize(page, size);
            const where = `${width}×${height} ${locale} ${size}% ${level} at ${path.at(-1)}`;
            const { columns } = await expectNeighboursClear(page, where);
            summary.push(`${where}: ${columns} col`);
          }
          await textSize(page, 100);
          if (width === 390 && locale === "hy") {
            await page.locator('[aria-labelledby="neighbors-heading"]').evaluate((el) => el.scrollIntoView({ block: "center" }));
            await shot(page, `travel-${level}-${path.at(-1)}-${locale}`);
          }
        }
      }
    }
    test.info().annotations.push({ type: "columns", description: summary.join("; ") });
  });

  test("the first row of neighbours shows without scrolling, before and after a move, in Levels 1–4; the map keeps its height and the text its size", async ({ page }) => {
    test.setTimeout(1_800_000);
    test.skip(!isPhoneProject(), "Runs on the small-phone (Chromium) and webkit-phone (WebKit) projects.");
    // Each journey's start, and the saved places after the first move to each neighbour (and, in
    // Level 4's chain, on into Croatia, whose choices include Bosnia and Herzegovina).
    const journeys: [string, string, string[][]][] = [
      [L1, "FRA", [["FRA", "BEL"], ["FRA", "LUX"], ["FRA", "DEU"]]],
      [L2, "FRA", [["FRA", "CHE"], ["FRA", "DEU"], ["FRA", "ITA"]]],
      [L3, "POL", [["POL", "CZE"], ["POL", "SVK"], ["POL", "DEU"]]],
      [L4, "ITA", [["ITA", "SVN"], ["ITA", "SVN", "HRV"]]],
    ];
    const summary = () =>
      page.evaluate(() => {
        const panel = document.querySelector('[data-testid="panel"]')!.getBoundingClientRect();
        const moves = [...document.querySelectorAll('[data-testid^="move-"]')].map((e) => e.getBoundingClientRect());
        const row = moves.filter((b) => Math.abs(b.top - moves[0].top) < 1);
        const size = (sel: string) => getComputedStyle(document.querySelector(sel)!).fontSize;
        return {
          rowBottom: Math.max(...row.map((b) => b.bottom)),
          fold: Math.min(panel.bottom, window.innerHeight),
          scrollTop: document.querySelector('[data-testid="panel"]')!.scrollTop,
          map: document.querySelector('[data-testid="map-main"]')!.getBoundingClientRect().height,
          // The summary's text sizes: the route, the lead, the crossings, the status, the choices.
          fonts: ['[data-testid="panel"] h1', '[data-testid="panel"] h1 + p', '[data-testid="crossings-left"]', '[role="status"] p', "#neighbors-heading", '[data-testid^="move-"] span'].map(size).join(" "),
        };
      });
    const fontsAt: Record<string, string> = {};
    for (const [width, height] of [[320, 568], [320, 640], [390, 664], [390, 844]]) {
      await page.setViewportSize({ width, height });
      // The map area's height (LessonScreen.module.css), less its 8px top padding: unchanged by the panel.
      const map = (height <= 700 ? Math.min(Math.max(200, 0.42 * height), 520) : Math.min(Math.max(220, 0.46 * height), 520)) - 8;
      for (const locale of ["en", "hy"] as const) {
        for (const [level, start, neighbours] of journeys) {
          const check = async (at: string) => {
            const where = `${width}×${height} ${locale} ${level} ${at}`;
            const s = await summary();
            expect.soft(s.scrollTop, `${where}: the panel opened scrolled`).toBe(0);
            expect.soft(s.rowBottom, `${where}: first row ${(s.rowBottom - s.fold).toFixed(1)}px below the screen`).toBeLessThanOrEqual(s.fold + 0.5);
            expect.soft(Math.abs(s.map - map), `${where}: map ${s.map.toFixed(1)}px, expected ${map.toFixed(1)}px`).toBeLessThanOrEqual(1);
            // The same text sizes on every phone screen, short or tall.
            fontsAt[locale] ??= s.fonts;
            expect.soft(s.fonts, `${where}: text sizes`).toBe(fontsAt[locale]);
            await expectNeighboursClear(page, where);
          };
          // Before a move, then after one made by tapping the first card (shown without scrolling).
          await openTravel(page, level, [start], locale);
          await check(`at ${start}`);
          if (width === 320 && height === 568) await shot(page, `travel-${level}-${start}-${locale}`);
          const first = page.locator('[data-testid^="move-"]').first();
          const moved = (await first.getAttribute("data-testid"))!.slice(5);
          await first.click();
          await expect(page.getByTestId(`move-${start}`)).toBeVisible();
          await fontsSettled(page);
          await check(`moved to ${moved}`);
          if (width === 320 && height === 568) await shot(page, `travel-${level}-${moved}-${locale}`);
          // Every first move, saved (and Level 4's Croatia).
          for (const path of neighbours) {
            await openTravel(page, level, path, locale);
            await check(`at ${path.at(-1)}`);
            if (width === 320 && height === 568 && level === L4) await shot(page, `travel-${level}-${path.at(-1)}-${locale}`);
          }
        }
      }
    }
    // Enlarged text on the shortest screen: the text grows (nothing shrinks to fit) and the panel scrolls.
    await page.setViewportSize({ width: 320, height: 568 });
    for (const locale of ["en", "hy"] as const) {
      for (const [level, , neighbours] of journeys) {
        // Level 4 in Croatia: its longest choice, Bosnia and Herzegovina.
        const path = level === L4 ? neighbours.at(-1)! : neighbours[0];
        await openTravel(page, level, path, locale);
        const base = (await summary()).fonts.split(" ").map(parseFloat);
        for (const size of [150, 200]) {
          await textSize(page, size);
          const where = `320×568 ${locale} ${level} at ${path.at(-1)} ${size}%`;
          const grown = (await summary()).fonts.split(" ").map(parseFloat);
          grown.forEach((px, i) => expect.soft(px, `${where}: text size ${i}`).toBeCloseTo((base[i] * size) / 100, 0));
          await expectNeighboursClear(page, where);
          await expectTravelReachable(page, where);
          await page.getByTestId("panel").evaluate((el) => el.scrollTo(0, 0));
          await shot(page, `travel-${level}-${path.at(-1)}-${locale}-text${size}`);
        }
        await textSize(page, 100);
      }
    }
  });

  test("with the browser's toolbars showing (a shorter viewport), actions stay on screen", async ({ page }) => {
    test.skip(!isPhoneProject(), "Phones.");
    // Safari on a 375×667 iPhone with its toolbars expanded leaves about 375×548; a 320px phone about 320×460.
    for (const [width, height] of [[375, 548], [320, 460]]) {
      await page.setViewportSize({ width, height });
      for (const locale of ["en", "hy"] as const) {
        await openTravel(page, L1, ["FRA", "BEL"], locale);
        const where = `${width}×${height} ${locale}`;
        await expectNeighboursClear(page, where);
        await expectTravelReachable(page, where);
        await shot(page, `travel-belgium-${locale}-toolbars-bottom`);
        await save(page, { [L1]: L1_DONE, [L2]: L2_DONE }, { locale, recent: [L2, L1], levelId: L2 });
        const a = (await page.getByTestId("welcome-actions").boundingBox())!;
        expect.soft(a.y + a.height, `${where}: main action off screen`).toBeLessThanOrEqual(height + 0.5);
        await shot(page, `welcome-l3-ready-${locale}-toolbars`);
      }
    }
  });
});

/* --- Enlarged text: the Results banner and the Discover card ---------------------- */

const COUNTRIES: Record<string, string[]> = { [L1]: L1_ORDER, [L2]: L2_COUNTRIES, [L3]: L3_COUNTRIES, [L4]: L4_COUNTRIES };
const LEVELS_DONE: Record<string, object> = { [L1]: L1_DONE, [L2]: L2_DONE, [L3]: L3_DONE, [L4]: L4_DONE };
/** A level's progress, every level before it completed (so it can be played). */
const upTo = (level: string, own: object) => {
  const ids = [L1, L2, L3, L4];
  return { ...Object.fromEntries(ids.slice(0, ids.indexOf(level)).map((id) => [id, LEVELS_DONE[id]])), [level]: own };
};

/**
 * Where the visible text in `within` falls, word by word, measured from the drawn text (not the
 * page's scroll width): each word inside `box` (`within` itself if none is named: inside its
 * border, so on its background) and on screen, and broken across lines only if it is wider than
 * the box its own lines are laid out in (the content box of its nearest block), or than `fitsIn`'s
 * content box if one is named (so a word broken in a narrow column counts when it would fit across
 * the card). A hyphenated word may wrap after its hyphen, as text does anywhere.
 */
function wordProblems(page: Page, within: string, box?: string, fitsIn?: string) {
  return page.evaluate(
    ([within, box, fitsIn]) => {
      const root = document.querySelector(within)!;
      const frame = (box ? document.querySelector(box)! : root).getBoundingClientRect();
      const frameStyle = getComputedStyle(box ? document.querySelector(box)! : root);
      const left = frame.left + parseFloat(frameStyle.borderLeftWidth);
      const right = frame.right - parseFloat(frameStyle.borderRightWidth);
      const lineBox = (el: Element) => {
        let block = el;
        while (getComputedStyle(block).display === "inline" && block.parentElement) block = block.parentElement;
        const s = getComputedStyle(block);
        // Fractional, unlike clientWidth: a word a fraction of a pixel too wide does not fit.
        return block.getBoundingClientRect().width - parseFloat(s.borderLeftWidth) - parseFloat(s.borderRightWidth) - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
      };
      const out: string[] = [];
      const range = document.createRange();
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const parent = node.parentElement!;
        if (parent.closest(".visually-hidden, [aria-hidden='true']")) continue;
        // Hidden by clipping (as Next level's title is, on a narrow phone with enlarged text): not shown.
        let clipped = false;
        for (let e: Element | null = parent; e && !clipped; e = e.parentElement) clipped = getComputedStyle(e).clipPath !== "none";
        if (clipped) continue;
        for (const m of (node.textContent ?? "").matchAll(/[^\s-]+-?|-/g)) {
          range.setStart(node, m.index!);
          range.setEnd(node, m.index! + m[0].length);
          const rects = [...range.getClientRects()].filter((r) => r.width > 0);
          for (const r of rects) {
            if (r.left < left - 0.5 || r.right > right + 0.5) out.push(`«${m[0]}» at ${r.left.toFixed(0)}–${r.right.toFixed(0)}, outside ${left.toFixed(0)}–${right.toFixed(0)}`);
            if (r.left < 0 || r.right > window.innerWidth) out.push(`«${m[0]}» off screen`);
          }
          if (new Set(rects.map((r) => Math.round(r.top))).size > 1) {
            const ps = getComputedStyle(parent);
            const probe = document.createElement("span");
            probe.textContent = m[0];
            Object.assign(probe.style, { position: "absolute", visibility: "hidden", whiteSpace: "nowrap", font: ps.font, letterSpacing: ps.letterSpacing, textTransform: ps.textTransform });
            document.body.appendChild(probe);
            const natural = probe.getBoundingClientRect().width;
            probe.remove();
            const width = lineBox(fitsIn ? document.querySelector(fitsIn)! : parent);
            // Within half a pixel of the box, the browser's own measure decides whether it fits.
            if (natural < width - 0.5) out.push(`«${m[0]}» broken though it fits (${natural.toFixed(1)} < ${width.toFixed(1)}px)`);
          }
        }
      }
      return out;
    },
    [within, box ?? null, fitsIn ?? null] as const,
  );
}

test.describe("enlarged text", () => {
  test("the Results banner and its action in every level: the title beside the star while it fits, else below it, never out of the banner", async ({ page }) => {
    test.setTimeout(900_000);
    test.skip(!isPhoneProject(), "Runs on the small-phone (Chromium) and webkit-phone (WebKit) projects.");
    for (const [width, height] of [[320, 568], [390, 844]]) {
      await page.setViewportSize({ width, height });
      for (const locale of ["hy", "en"] as const) {
        for (const level of [L1, L2, L3, L4]) {
          await save(page, upTo(level, LEVELS_DONE[level]), { locale, screen: "lesson", levelId: level, recent: [level] });
          for (const size of [100, 150, 200]) {
            await textSize(page, size);
            const where = `${width}×${height} ${locale} ${level} ${size}%`;
            const banner = page.getByTestId("celebration");
            // The text keeps its size.
            expect.soft(parseFloat(await banner.locator("h1").evaluate((el) => getComputedStyle(el).fontSize)), `${where}: title size`).toBeCloseTo((1.35 * 16 * size) / 100, 0);
            expect.soft(await wordProblems(page, '[data-testid="celebration"] h1', '[data-testid="celebration"]'), `${where}: title`).toEqual([]);
            // What is drawn of the star and its confetti never covers the title.
            const covered = await banner.evaluate((el) => {
              const shapes = [...el.querySelectorAll("svg path, svg circle, svg rect")].map((s) => s.getBoundingClientRect());
              const range = document.createRange();
              range.selectNodeContents(el.querySelector("h1")!);
              const text = [...range.getClientRects()].filter((r) => r.width > 0);
              return shapes.some((s) => text.some((t) => s.left < t.right && t.left < s.right && s.top < t.bottom && t.top < s.bottom));
            });
            expect.soft(covered, `${where}: the star covers the title`).toBe(false);
            const b = (await banner.boundingBox())!;
            expect.soft(b.x >= 0 && b.x + b.width <= width, `${where}: banner off screen`).toBe(true);
            // The pinned main action (Next level): its name inside it, and on screen.
            expect.soft(await wordProblems(page, '[data-testid="panel"] .btn-block'), `${where}: Next level`).toEqual([]);
            if (level === L4 && locale === "hy") await shot(page, `results-${level}-${locale}-text${size}`);
          }
        }
      }
    }
  });

  test("Discover at 150% and 200%: the card reads through the panel by scrolling, every word inside it; the map's controls stay clear", async ({ page }) => {
    test.setTimeout(1_200_000);
    test.skip(!isPhoneProject(), "Runs on the small-phone (Chromium) and webkit-phone (WebKit) projects.");
    for (const [width, height] of [[320, 568], [390, 844]]) {
      await page.setViewportSize({ width, height });
      for (const locale of ["hy", "en"] as const) {
        for (const level of [L1, L2, L3, L4]) {
          for (const id of COUNTRIES[level]) {
            await save(page, upTo(level, { started: true, stage: "discover", discover: { selected: id, explored: [id] }, records: records(false) }), { locale, screen: "lesson", levelId: level, recent: [level] });
            for (const size of [150, 200]) {
              await textSize(page, size);
              const where = `${width}×${height} ${locale} ${level} ${id} ${size}%`;
              expect.soft(await wordProblems(page, '[data-testid="country-card"]'), `${where}: card`).toEqual([]);
              const m = await page.evaluate(() => {
                const box = (sel: string) => document.querySelector(sel)!.getBoundingClientRect();
                const overlaps = (a: DOMRect, b: DOMRect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
                const panel = box('[data-testid="panel"]');
                const map = box('[data-testid="map-main"]');
                const controls = box('[data-testid="map-controls"]');
                return {
                  // What the player reads through: the panel above the pinned button.
                  window: box('[data-testid="sticky-actions"]').top - panel.top,
                  line: parseFloat(getComputedStyle(document.querySelector('[data-testid="country-card"] > p:last-child')!).lineHeight),
                  map: map.height,
                  controlsInMap: controls.left >= map.left - 0.5 && controls.right <= map.right + 0.5 && controls.top >= map.top - 0.5 && controls.bottom <= map.bottom + 0.5,
                  controlsClear: !overlaps(controls, box('[data-testid="map-about"]')),
                };
              });
              // At least two and a half lines of the card show at once: the map gives up height for them.
              expect.soft(m.window, `${where}: ${m.window.toFixed(0)}px to read through, lines of ${m.line}px`).toBeGreaterThanOrEqual(2.5 * m.line);
              expect.soft(m.map, `${where}: map height`).toBeGreaterThanOrEqual(100);
              expect.soft(m.controlsInMap, `${where}: zoom controls outside the map`).toBe(true);
              expect.soft(m.controlsClear, `${where}: zoom controls under "About the map"`).toBe(true);
              // Scrolled to its end, the whole card is above the pinned button.
              await page.getByTestId("panel").evaluate((el) => el.scrollTo(0, el.scrollHeight));
              const card = (await page.getByTestId("country-card").boundingBox())!;
              expect.soft(card.y + card.height, `${where}: card bottom`).toBeLessThanOrEqual((await page.getByTestId("sticky-actions").boundingBox())!.y + 1);
              await page.getByTestId("panel").evaluate((el) => el.scrollTo(0, 0));
            }
          }
        }
      }
    }
  });
});

/* --- Discover: the country's name with its art, and the progress line --------------- */

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
  await page.touchscreen.tap(point![0], point![1]);
}

const discoverAt = (selected: string, explored = [selected]) => ({ started: true, stage: "discover", discover: { selected, explored }, records: records(false) });

/** The Discover card's layout: its arrangement, its art as drawn, the pinned button and the room to read above it. */
const discoverCard = (page: Page) =>
  page.evaluate(() => {
    const card = document.querySelector('[data-testid="country-card"]')!;
    const panel = document.querySelector('[data-testid="panel"]')!;
    const fold = document.querySelector('[data-testid="sticky-actions"]')!.getBoundingClientRect().top;
    const box = (el: Element | null) => (el ? el.getBoundingClientRect() : null);
    const img = card.querySelector<HTMLImageElement>('[data-testid="landmark-image"]');
    let art = null;
    if (img) {
      const r = img.getBoundingClientRect();
      const s = Math.min(r.width / img.naturalWidth, r.height / img.naturalHeight);
      const [w, h] = [img.naturalWidth * s, img.naturalHeight * s];
      art = { top: r.top + (r.height - h) / 2, bottom: r.top + (r.height + h) / 2, left: r.left + (r.width - w) / 2, right: r.left + (r.width + w) / 2, size: Math.max(w, h) };
    }
    return {
      head: card.getAttribute("data-head"),
      title: box(card.querySelector("h2"))!.toJSON() as DOMRect,
      capital: box(card.querySelector('[data-testid="country-capital"]'))!.toJSON() as DOMRect,
      tile: box(card.querySelector("figure > div"))?.toJSON() as DOMRect | undefined,
      art,
      fold,
      panelTop: panel.getBoundingClientRect().top,
      scrollTop: panel.scrollTop,
      line: parseFloat(getComputedStyle(card.querySelector(":scope > p:last-child")!).lineHeight),
      titleSize: parseFloat(getComputedStyle(card.querySelector("h2")!).fontSize),
    };
  });

test.describe("Discover card", () => {
  // Names that don't fit beside the art at 320px in Armenian (Levels 1 and 4), and some that do.
  const CASES: [string, string][] = [[L4, "MNE"], [L4, "BIH"], [L1, "NLD"], [L1, "LUX"], [L4, "HRV"], [L4, "SVN"], [L1, "FRA"], [L3, "POL"]];
  const ACROSS_AT_320_HY = ["MNE", "BIH", "NLD", "LUX"];

  test("the name beside the art when it fits, across the card when a word would otherwise break; name, capital and whole art above the pinned button", async ({ page }) => {
    test.setTimeout(900_000);
    test.skip(!isPhoneProject(), "Runs on the small-phone (Chromium) and webkit-phone (WebKit) projects.");
    for (const [width, height] of [[320, 568], [390, 844]]) {
      await page.setViewportSize({ width, height });
      for (const locale of ["hy", "en"] as const) {
        for (const [level, id] of CASES) {
          await save(page, upTo(level, discoverAt(id)), { locale, screen: "lesson", levelId: level, recent: [level] });
          await expect(page.getByTestId("landmark-image")).toHaveCount(1);
          await expect.poll(() => page.getByTestId("landmark-image").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
          for (const size of [100, 200]) {
            await textSize(page, size);
            const where = `${width}×${height} ${locale} ${id} ${size}%`;
            const m = await discoverCard(page);
            // The name keeps its size (1.2rem on narrow phones, 1.45rem otherwise).
            expect.soft(m.titleSize, `${where}: name size`).toBeCloseTo(((width < 420 ? 1.2 : 1.45) * 16 * size) / 100, 0);
            // No word of the name or capital broken unless it is wider than the whole card.
            for (const part of ['[data-testid="country-card"] h2', '[data-testid="country-capital"]'])
              expect.soft(await wordProblems(page, part, '[data-testid="country-card"]', '[data-testid="country-card"]'), `${where}: ${part}`).toEqual([]);
            if (size === 100) {
              // At the default size: across the card only where the Armenian name can't fit beside the art.
              expect.soft(m.head, `${where}: arrangement`).toBe(width === 320 && locale === "hy" && ACROSS_AT_320_HY.includes(id) ? "title" : "beside");
              // The name, the capital and the whole art above the pinned button, the art at its full size.
              expect.soft(m.scrollTop, `${where}: opened scrolled`).toBe(0);
              for (const [what, b] of [["name", m.title], ["capital", m.capital]] as const) expect.soft(b.bottom, `${where}: ${what} under the button`).toBeLessThanOrEqual(m.fold + 0.5);
              expect.soft(m.art!.bottom, `${where}: art under the button`).toBeLessThanOrEqual(m.fold + 0.5);
              expect.soft(m.art!.top, `${where}: art above the panel`).toBeGreaterThanOrEqual(m.panelTop - 0.5);
              expect.soft(m.art!.size, `${where}: art smaller`).toBeGreaterThanOrEqual(Math.min(Math.max(112, 0.33 * width), 132) - 12 - 0.5);
            } else {
              // Enlarged: room to read above the pinned button, and the whole card reached by scrolling.
              expect.soft(m.fold - m.panelTop, `${where}: room to read`).toBeGreaterThanOrEqual(2.5 * m.line);
              await page.getByTestId("panel").evaluate((el) => el.scrollTo(0, el.scrollHeight));
              const card = (await page.getByTestId("country-card").boundingBox())!;
              expect.soft(card.y + card.height, `${where}: card bottom`).toBeLessThanOrEqual(m.fold + 1);
              await page.getByTestId("panel").evaluate((el) => el.scrollTo(0, 0));
            }
            if (ACROSS_AT_320_HY.includes(id) || id === "HRV") await shot(page, `discover-card-${id}-${locale}-text${size}`);
          }
          await textSize(page, 100);
        }
      }
    }
  });

  test("switching countries after scrolling: each card opens at its top, in its own arrangement", async ({ page }) => {
    test.setTimeout(300_000);
    test.skip(!isPhoneProject(), "Runs on the small-phone (Chromium) and webkit-phone (WebKit) projects.");
    await page.setViewportSize({ width: 320, height: 568 });
    const panel = page.getByTestId("panel");
    for (const locale of ["hy", "en"] as const) {
      for (const size of [100, 200]) {
        await save(page, upTo(L4, discoverAt("ITA")), { locale, screen: "lesson", levelId: L4, recent: [L4] });
        await textSize(page, size);
        for (const id of ["MNE", "HRV", "BIH", "SVN"]) {
          const where = `320×568 ${locale} ${size}% ${id}`;
          await panel.evaluate((el) => el.scrollTo(0, el.scrollHeight));
          await tapCountry(page, id);
          await expect(page.getByTestId("country-card")).toHaveAttribute("data-country", id);
          await fontsSettled(page);
          const m = await discoverCard(page);
          expect.soft(m.scrollTop, `${where}: opened scrolled`).toBe(0);
          if (size === 100) expect.soft(m.head, `${where}: arrangement`).toBe(locale === "hy" && ACROSS_AT_320_HY.includes(id) ? "title" : "beside");
          expect.soft(await wordProblems(page, '[data-testid="country-card"] h2', '[data-testid="country-card"]', '[data-testid="country-card"]'), `${where}: name`).toEqual([]);
        }
      }
    }
  });

  test("the progress line before and at 5/5: wraps when it must, never cut, the star and count shown", async ({ page }) => {
    test.setTimeout(300_000);
    test.skip(!isPhoneProject(), "Runs on the small-phone (Chromium) and webkit-phone (WebKit) projects.");
    const progress = () =>
      page.evaluate(() => {
        const row = document.querySelector('[data-testid="discover-progress"]')!;
        const panel = document.querySelector('[data-testid="panel"]')!;
        const p = panel.getBoundingClientRect();
        const ps = getComputedStyle(panel);
        const [left, right] = [p.left + parseFloat(ps.paddingLeft), p.right - parseFloat(ps.paddingRight)];
        const range = document.createRange();
        range.selectNodeContents(row);
        const rects = [...range.getClientRects()].filter((r) => r.width > 0);
        const star = row.querySelector("svg")?.getBoundingClientRect() ?? null;
        const celebrate = row.querySelector("[role=status]");
        // Lines of text (the star icon sits a little lower than the text beside it, so it is left out).
        const lines = (el: Element) => {
          const tops = new Set<number>();
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            if (!n.textContent?.replace(/⁠/g, "").trim()) continue;
            const r = document.createRange();
            r.selectNodeContents(n);
            for (const x of r.getClientRects()) if (x.width > 0) tops.add(Math.round(x.top));
          }
          return tops.size;
        };
        return {
          text: row.textContent ?? "",
          outside: rects.filter((r) => r.left < left - 0.5 || r.right > right + 0.5 || r.right > window.innerWidth).length,
          overflow: row.scrollWidth - row.clientWidth,
          ellipsis: [row, ...row.querySelectorAll("*")].some((el) => getComputedStyle(el).textOverflow === "ellipsis"),
          starShown: star ? star.width > 0 && star.left >= left - 0.5 && star.right <= right + 0.5 : null,
          celebrateLines: celebrate ? lines(celebrate) : 0,
          fontSize: parseFloat(getComputedStyle(row).fontSize),
          // Armenian text drawn in the loaded Noto Sans Armenian, at the row's own weight and size.
          armenianFont: document.fonts.check(`${getComputedStyle(row).fontWeight} ${getComputedStyle(row).fontSize} "Noto Sans Armenian"`, "Բա"),
        };
      });
    for (const [width, height] of [[320, 568], [390, 844]]) {
      await page.setViewportSize({ width, height });
      for (const locale of ["hy", "en"] as const) {
        for (const explored of [L4_COUNTRIES.slice(0, 4), L4_COUNTRIES]) {
          await save(page, upTo(L4, discoverAt("SVN", explored)), { locale, screen: "lesson", levelId: L4, recent: [L4] });
          for (const size of [100, 200]) {
            await textSize(page, size);
            const where = `${width}×${height} ${locale} ${explored.length}/5 ${size}%`;
            // The celebration pops in, briefly a little larger than its size: measured once it has settled.
            await page.getByTestId("discover-progress").evaluate((row) => Promise.all(row.getAnimations({ subtree: true }).map((a) => a.finished)));
            const m = await progress();
            expect.soft(m.text, where).toContain(`${explored.length}/5`);
            expect.soft(m.outside, `${where}: text outside the panel`).toBe(0);
            expect.soft(m.overflow, `${where}: row overflows`).toBeLessThanOrEqual(0);
            expect.soft(m.ellipsis, `${where}: ellipsis`).toBe(false);
            expect.soft(m.fontSize, `${where}: text size`).toBeCloseTo((0.8 * 16 * size) / 100, 0);
            if (locale === "hy") expect.soft(m.armenianFont, `${where}: Noto Sans Armenian loaded`).toBe(true);
            // Wrapping between words; a word broken only if wider than the whole row (the panel's width,
            // not just the text beside the dot: a word that fits the row moves to a line of its own first).
            expect.soft(await wordProblems(page, '[data-testid="discover-progress"]', '[data-testid="panel"]'), `${where}: words`).toEqual([]);
            expect.soft(await wordProblems(page, '[data-testid="discover-progress"]', '[data-testid="panel"]', '[data-testid="panel"]'), `${where}: words across the row`).toEqual([]);
            await page.getByTestId("discover-progress").screenshot({ path: `screenshots/${project()}/${SET}/discover-progress-row-${explored.length}of5-${locale}-text${size}-${width}x${height}.png` });
            if (explored.length === 5) {
              expect.soft(m.starShown, `${where}: star`).toBe(true);
              // At the default size the celebration fits on one line, as before.
              if (size === 100) expect.soft(m.celebrateLines, `${where}: celebration lines`).toBe(1);
            }
            await shot(page, `discover-progress-${explored.length}of5-${locale}-text${size}`);
          }
          await textSize(page, 100);
        }
      }
    }
  });
});
