import { expect, test, type Page } from "@playwright/test";

/** Opens the lesson directly in a given state. */
async function openLesson(page: Page, lesson: object, locale = "en") {
  await page.goto("/");
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
 * leader line, marker or Luxembourg, or lies in the Low Countries.
 */
function sceneryProblems(page: Page) {
  return page.evaluate(() => {
    const svg = document.querySelector('[data-testid="map-main"]')!;
    const boxOf = (el: Element) => el.getBoundingClientRect();
    const hit = (a: DOMRect, b: DOMRect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const keepClear = [
      ...[...svg.querySelectorAll("text, [data-explored-badge], [data-callout] rect, [data-callout] line, [data-callout] circle, [data-traveller]")].map((el) => ({ what: el.textContent || el.tagName, box: boxOf(el) })),
      ...[...svg.querySelectorAll('[data-testid="map-main"] > g:last-of-type circle, [data-testid="map-main"] > g:last-of-type rect')].map((el) => ({ what: `marker ${el.tagName}`, box: boxOf(el) })),
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

test("Discover scenery is decorative: clear of names and Luxembourg, never in the way of taps", async ({ page }) => {
  for (const locale of ["en", "hy"]) {
    await openLesson(page, discover(), locale);
    // Scenery is placed after the first layout, so wait for it.
    await expect.poll(() => symbols(page).count(), `${locale}: scenery drawn`).toBeGreaterThan(3);
    expect(await sceneryProblems(page), locale).toEqual([]);
    // Mountain and hill groups overlap only at their foothills, never pile up.
    const stacked = await page.$$eval('[data-testid="map-main"] [data-pass="light"][data-sym="ridge"], [data-testid="map-main"] [data-pass="light"][data-sym="hills"]', (els) => {
      const boxes = els.map((el) => el.getBoundingClientRect());
      const out: string[] = [];
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) {
          const [a, b] = [boxes[i], boxes[j]];
          const shared = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
          if (shared > 0.4 * Math.min(a.width * a.height, b.width * b.height)) out.push(`${els[i].getAttribute("data-key")} × ${els[j].getAttribute("data-key")}`);
        }
      return out;
    });
    expect(stacked, `${locale}: stacked groups`).toEqual([]);

    // Selected France: names still clear, and France's scenery stays visible,
    // redrawn in the teal palette rather than faded away.
    await openLesson(page, discover("FRA"), locale);
    expect(await sceneryProblems(page), `${locale}, France selected`).toEqual([]);
    const onFrance = await page.$$eval('[data-testid="map-main"] [data-pass="dark"]', (els) => els.map((el) => Number(getComputedStyle(el).opacity)));
    expect(onFrance.length, "scenery on selected France").toBeGreaterThan(0);
    for (const o of onFrance) expect(o).toBe(1);
  }

  // The close-up stays clear of scenery.
  if ((await page.getByTestId("map-inset").count()) === 0) await page.getByTestId("inset-toggle").click();
  await expect(page.getByTestId("map-inset")).toBeVisible();
  await expect(page.locator('[data-testid="map-inset"] [data-scenery]')).toHaveCount(0);

  // A tap on a tree or peak reaches the country underneath.
  await openLesson(page, discover());
  const target = await page.evaluate(() => {
    for (const sym of document.querySelectorAll('[data-testid="map-main"] [data-sym][data-in="DEU"], [data-testid="map-main"] [data-sym][data-in="FRA"]')) {
      const r = sym.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height * 0.6;
      const under = document.elementFromPoint(x, y);
      const country = under?.closest("[data-country]")?.getAttribute("data-country");
      if (country === sym.getAttribute("data-in")) return { x, y, country };
    }
    return null;
  });
  expect(target, "a symbol over a lesson country").not.toBeNull();
  if (test.info().project.name === "desktop") await page.mouse.click(target!.x, target!.y);
  else await page.touchscreen.tap(target!.x, target!.y);
  await expect(page.getByTestId("country-card")).toHaveAttribute("data-country", target!.country!);
});

test("scenery is Discover only", async ({ page }) => {
  test.skip(test.info().project.name !== "mobile", "Runs once.");
  await openLesson(page, {
    started: true,
    stage: "find",
    discover: { selected: null, explored: ["FRA", "BEL", "NLD", "LUX", "DEU"] },
    find: {
      orders: [["BEL", "FRA", "NLD", "LUX", "DEU"], ["LUX", "DEU", "FRA", "NLD", "BEL"]],
      round: 0,
      index: 0,
      question: { target: "BEL", wrongGuesses: [], hintLevel: 0, solved: false, feedback: null },
      results: [[], []],
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
  // A tree or tuft (anchored exactly, without a ridge nudge).
  const key = await page.locator('[data-testid="map-main"] [data-sym="grass"], [data-testid="map-main"] [data-sym="forest"]').first().getAttribute("data-key");
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

test("the Alps are painted relief anchored to the map, not mountain symbols", async ({ page }) => {
  test.skip(test.info().project.name !== "mobile", "Runs once.");
  await openLesson(page, discover());
  const main = page.getByTestId("map-main");
  const base = main.locator('[data-relief="alps"] image[data-level="base"]');
  await expect(base).toHaveCount(1);
  // No Alpine symbols: the relief replaces them. Other ranges keep theirs for now.
  await expect(main.locator('[data-sym][data-key^="m:alps:"]')).toHaveCount(0);
  await expect(main.locator('[data-relief="alps"] image[data-level="detail"]')).toHaveCount(0);

  /** The relief image's screen box, measured and as projected from its world placement. */
  const placement = () =>
    page.evaluate(() => {
      const svg = document.querySelector('[data-testid="map-main"]')!;
      const world = svg.querySelector("[data-scenery]")!.parentElement!.getAttribute("transform")!;
      const [, tx, ty, k] = world.match(/translate\(([-\d.e]+),([-\d.e]+)\) scale\(([-\d.e]+)\)/)!.map(Number);
      const img = svg.querySelector('[data-relief="alps"] image[data-level="base"]')!;
      const [x, y] = ["x", "y"].map((a) => Number(img.getAttribute(a)));
      const s = svg.getBoundingClientRect();
      const r = img.getBoundingClientRect();
      return { expected: [s.left + x * k + tx, s.top + y * k + ty], measured: [r.left, r.top], k };
    });
  const anchored = async (label: string) => {
    const p = await placement();
    expect(Math.abs(p.measured[0] - p.expected[0]), `${label}: x`).toBeLessThan(1);
    expect(Math.abs(p.measured[1] - p.expected[1]), `${label}: y`).toBeLessThan(1);
    return p;
  };
  const whole = await anchored("whole map");

  // A tap on the relief reaches the country underneath (the French Alps, west of Mont Blanc).
  const tapAt = await page.evaluate(() => {
    const svg = document.querySelector('[data-testid="map-main"]')!;
    const world = svg.querySelector("[data-scenery]")!.parentElement!.getAttribute("transform")!;
    const [, tx, ty, k] = world.match(/translate\(([-\d.e]+),([-\d.e]+)\) scale\(([-\d.e]+)\)/)!.map(Number);
    const s = svg.getBoundingClientRect();
    // Mont Blanc's world position (alps-relief.json), 15–30 units west into Savoie.
    for (const dx of [15, 20, 25, 30]) {
      const x = s.left + (598.164 - dx) * k + tx;
      const y = s.top + 690 * k + ty;
      if (document.elementFromPoint(x, y)?.closest("[data-country]")?.getAttribute("data-country") === "FRA") return { x, y };
    }
    return null;
  });
  expect(tapAt, "a point on the French Alps").not.toBeNull();
  await page.touchscreen.tap(tapAt!.x, tapAt!.y);
  await expect(page.getByTestId("country-card")).toHaveAttribute("data-country", "FRA");

  // Selected France: the relief continues over it in the teal palette, at full opacity.
  const dark = main.locator('[data-relief="alps"] [data-pass="dark"] image[data-level="base"]');
  await expect(dark).toHaveCount(1);
  expect(await dark.evaluate((el) => Number(getComputedStyle(el.parentElement!).opacity))).toBe(1);

  // Zoomed in, the detailed level is drawn over the simplified one, still anchored.
  // Each zoom step settles before the next (a click mid-animation zooms from wherever the map is).
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: "Zoom in" }).click();
    await page.waitForTimeout(600);
  }
  await expect(main.locator('[data-relief="alps"] image[data-level="detail"]')).toHaveCount(2);
  const zoomed = await anchored("zoomed in");
  expect(zoomed.k).toBeGreaterThan(whole.k);
  expect(await sceneryProblems(page)).toEqual([]);
});
