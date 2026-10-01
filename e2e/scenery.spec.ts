import { expect, test, type Page } from "@playwright/test";

/*
 * The game saves the state it loaded once it has mounted: one write, a few milliseconds after the
 * splash has gone. A saved state a test writes before then is overwritten by the one the page opened
 * with. Each page counts the game's writes, so a test can wait for that one before writing its own.
 */
type Saves = { gameSaves?: number };

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      setItem.call(this, key, value);
      if (key === "arimap:state") (window as Saves).gameSaves = ((window as Saves).gameSaves ?? 0) + 1;
    };
  });
});

/** Opens the lesson directly in a given state. */
async function openLesson(page: Page, lesson: object, locale = "en") {
  await page.goto("/");
  await page.waitForFunction(() => ((window as Saves).gameSaves ?? 0) > 0);
  await page.evaluate(
    ([v]) => localStorage.setItem("arimap:state", v),
    [JSON.stringify({ version: 1, locale, screen: "lesson", lessons: { "western-europe-1": lesson } })],
  );
  await page.reload();
  await expect(page.locator('[data-testid="map-main"] path[data-country="FRA"]')).toBeVisible();
}

const discover = (selected: string | null = null) => ({ started: true, stage: "discover", discover: { selected, explored: selected ? [selected] : [] } });

/**
 * Every scenery symbol on the main map that overlaps a name, badge, callout,
 * leader line, marker or Luxembourg.
 */
function sceneryProblems(page: Page) {
  return page.evaluate(() => {
    const svg = document.querySelector('[data-testid="map-main"]')!;
    const boxOf = (el: Element) => el.getBoundingClientRect();
    const hit = (a: DOMRect, b: DOMRect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const keepClear = [
      ...[...svg.querySelectorAll("text, [data-explored-badge], [data-callout] rect, [data-callout] line, [data-callout] circle, [data-traveller]")].map((el) => ({ what: el.textContent || el.tagName, box: boxOf(el) })),
      ...[...svg.querySelectorAll('[data-overlay] circle, [data-overlay] rect')].map((el) => ({ what: `marker ${el.tagName}`, box: boxOf(el) })),
      { what: "Luxembourg", box: boxOf(svg.querySelector('path[data-country="LUX"]')!) },
    ];
    const problems: string[] = [];
    for (const sym of svg.querySelectorAll("[data-sym]")) {
      const where = sym.getAttribute("data-in");
      if (["BEL", "NLD", "LUX"].includes(where!)) problems.push(`${sym.getAttribute("data-sym")} in ${where}`);
      const r = boxOf(sym);
      // 1px tolerance for anti-aliasing.
      const box = new DOMRect(r.left + 1, r.top + 1, r.width - 2, r.height - 2);
      for (const k of keepClear) if (hit(box, k.box)) problems.push(`${sym.getAttribute("data-sym")} (${where}) over ${k.what}`);
    }
    return problems;
  });
}

const symbols = (page: Page, map = "map-main") => page.locator(`[data-testid="${map}"] [data-sym]`);

test("Discover wave marks are decorative: clear of names and Luxembourg", async ({ page }) => {
  for (const locale of ["en", "hy"]) {
    await openLesson(page, discover(), locale);
    // Scenery is placed after the first layout, so wait for it.
    await expect.poll(() => symbols(page).count(), `${locale}: wave marks drawn`).toBeGreaterThan(0);
    // Mountains and forests are painted into the landscape: waves are the only symbols.
    expect(await symbols(page).evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute("data-sym")))])).toEqual(["wave"]);
    expect(await sceneryProblems(page), locale).toEqual([]);
    await openLesson(page, discover("FRA"), locale);
    expect(await sceneryProblems(page), `${locale}, France selected`).toEqual([]);
  }

  // The close-up has no symbols.
  if ((await page.getByTestId("map-inset").count()) === 0) await page.getByTestId("inset-toggle").click();
  await expect(page.getByTestId("map-inset")).toBeVisible();
  await expect(page.locator('[data-testid="map-inset"] [data-scenery]')).toHaveCount(0);
});

test("scenery is Discover only", async ({ page }) => {
  test.skip(test.info().project.name !== "mobile", "Runs once.");
  await openLesson(page, {
    started: true,
    stage: "find",
    discover: { selected: null, explored: ["FRA", "BEL", "NLD", "LUX", "DEU"] },
    find: {
      order: ["BEL", "FRA", "NLD", "LUX", "DEU"],
      index: 0,
      question: { target: "BEL", wrongGuesses: [], hintLevel: 0, solved: false, feedback: null },
      results: [],
      status: "asking",
    },
  });
  await expect(page.locator("[data-scenery]")).toHaveCount(0);
  await openLesson(page, { started: true, stage: "travel", travel: { missionId: "fra-to-nld", path: ["FRA"] } });
  await expect(page.locator("[data-scenery]")).toHaveCount(0);
  await openLesson(page, discover());
  await expect(page.locator("[data-scenery]")).toHaveCount(1);
});

test("scenery stays anchored to its place while zooming and panning", async ({ page }) => {
  test.skip(test.info().project.name !== "desktop", "Runs once.");
  await openLesson(page, discover());
  /** Screen position of a symbol's anchor, measured and as projected from its world position. */
  const anchor = (key: string) =>
    page.evaluate((key) => {
      const sym = document.querySelector(`[data-testid="map-main"] [data-sym][data-key="${key}"]`);
      if (!sym) return null;
      const world = sym.closest("[data-scenery]")!.parentElement!.getAttribute("transform")!;
      const [, tx, ty, k] = world.match(/translate\(([-\d.e]+),([-\d.e]+)\) scale\(([-\d.e]+)\)/)!.map(Number);
      const [, wx, wy] = sym.getAttribute("transform")!.match(/translate\(([-\d.e]+),([-\d.e]+)\)/)!.map(Number);
      const svg = document.querySelector('[data-testid="map-main"]')!.getBoundingClientRect();
      const r = sym.getBoundingClientRect();
      return { expected: [svg.left + wx * k + tx, svg.top + wy * k + ty], measured: [r.left + r.width / 2, r.bottom], k };
    }, key);
  // A wave mark.
  const key = await page.locator('[data-testid="map-main"] [data-sym="wave"]').first().getAttribute("data-key");
  expect(key).not.toBeNull();
  const check = async (label: string) => {
    const a = await anchor(key!);
    if (!a) return null; // left out at this zoom (e.g. now under a name), which is allowed
    expect(Math.abs(a.measured[0] - a.expected[0]), `${label}: x`).toBeLessThan(5);
    expect(Math.abs(a.measured[1] - a.expected[1]), `${label}: y`).toBeLessThan(4);
    return a;
  };
  const before = await check("whole map");
  expect(before).not.toBeNull();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.waitForTimeout(500);
  const zoomed = await check("zoomed in");
  if (zoomed) expect(zoomed.k).toBeGreaterThan(before!.k);
  const box = (await page.getByTestId("map-main").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 120, box.y + box.height / 2 - 60, { steps: 8 });
  await page.mouse.up();
  await check("panned");
  // Names stay clear at every zoom.
  expect(await sceneryProblems(page)).toEqual([]);
});

