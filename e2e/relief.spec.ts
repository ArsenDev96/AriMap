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
const findAsking = (target: string) => ({
  started: true,
  stage: "find",
  discover: { selected: null, explored: ["FRA", "BEL", "NLD", "LUX", "DEU"] },
  find: {
    // The question asked is the first of the round.
    orders: [[target, ...["BEL", "FRA", "NLD", "LUX", "DEU"].filter((c) => c !== target)], ["FRA", "LUX", "DEU", "NLD", "BEL"]],
    round: 0,
    index: 0,
    question: { target, wrongGuesses: [], hintLevel: 0, solved: false, feedback: null },
    results: [[], []],
    status: "asking",
  },
});
/** A journey in progress, and one completed (its results). */
const travelling = { started: true, stage: "travel", travel: { missionId: "fra-to-nld", path: ["FRA", "BEL"] } };
const completed = {
  started: true,
  stage: "results",
  travel: { missionId: "fra-to-nld", path: ["FRA", "BEL", "NLD"] },
  lastTravelResult: { missionId: "fra-to-nld", route: ["FRA", "BEL", "NLD"], hintUsed: false, undoUsed: false },
};

/** The main map's world transform. */
const worldTransform = (page: Page) =>
  page.evaluate(() => {
    const t = document.querySelector('[data-testid="map-main"] [data-relief]')!.parentElement!.getAttribute("transform")!;
    const [, x, y, k] = t.match(/translate\(([-\d.e]+),([-\d.e]+)\) scale\(([-\d.e]+)\)/)!.map(Number);
    return { x, y, k };
  });

test("the landscape is painted relief everywhere, with no mountain symbols", async ({ page }) => {
  test.skip(test.info().project.name !== "mobile", "Runs once.");
  const tiles: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/relief/")) tiles.push(r.url());
  });

  await openLesson(page, discover());
  const main = page.getByTestId("map-main");
  await expect(main.locator('[data-relief] [data-family="land"] image[data-level="overview"]')).toHaveCount(1);
  // No mountain, hill or tree symbols: they are painted into the landscape (only wave marks remain, at sea).
  await expect(main.locator("[data-sym]").first()).toBeAttached();
  expect(await main.locator("[data-sym]").evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute("data-sym")))])).toEqual(["wave"]);
  // The whole-map view on a phone needs no zoomed tiles.
  await page.waitForTimeout(500);
  expect(tiles, "zoomed tiles at the whole-map view").toEqual([]);

  // Borders, names and markers are drawn after (above) the relief.
  const order = await page.evaluate(() => {
    const svg = document.querySelector('[data-testid="map-main"]')!;
    const relief = svg.querySelector("[data-relief]")!;
    const after = (el: Element | null) => !!el && (relief.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    return { borders: after(svg.querySelector('[class*="borders"]')), names: after(svg.querySelector("text")) };
  });
  expect(order).toEqual({ borders: true, names: true });

  // The overview stays anchored to the map: its placement in world units, projected, is where it is drawn.
  const placed = () =>
    page.evaluate(() => {
      const img = document.querySelector('[data-testid="map-main"] [data-family="land"] image[data-level="overview"]')!;
      const t = document.querySelector('[data-testid="map-main"] [data-relief]')!.parentElement!.getAttribute("transform")!;
      const [, tx, ty, k] = t.match(/translate\(([-\d.e]+),([-\d.e]+)\) scale\(([-\d.e]+)\)/)!.map(Number);
      const s = document.querySelector('[data-testid="map-main"]')!.getBoundingClientRect();
      const r = img.getBoundingClientRect();
      return { dx: r.left - (s.left + Number(img.getAttribute("x")) * k + tx), dy: r.top - (s.top + Number(img.getAttribute("y")) * k + ty) };
    });
  for (const d of Object.values(await placed())) expect(Math.abs(d)).toBeLessThan(1);

  // A tap on the relief reaches the country underneath: the French Alps, west of Mont Blanc (598, 674 in world units).
  const t = await worldTransform(page);
  const box = (await main.boundingBox())!;
  const tapAt = await page.evaluate(
    ({ t, box }) => {
      for (const dx of [15, 20, 25, 30]) {
        const x = box.x + (598 - dx) * t.k + t.x;
        const y = box.y + 690 * t.k + t.y;
        if (document.elementFromPoint(x, y)?.closest("[data-country]")?.getAttribute("data-country") === "FRA") return { x, y };
      }
      return null;
    },
    { t, box },
  );
  expect(tapAt, "a point on the French Alps").not.toBeNull();
  await page.touchscreen.tap(tapAt!.x, tapAt!.y);
  await expect(page.getByTestId("country-card")).toHaveAttribute("data-country", "FRA");
  // Selected France gets the neutral overlay, so its teal stays and the terrain keeps its shading.
  await expect(main.locator('[data-relief] [data-family="tone"] image[data-level="overview"]')).toHaveCount(1);

  // Zoomed in, sharper tiles for the visible part only are fetched, and stay anchored.
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "Zoom in" }).click();
    await page.waitForTimeout(600);
  }
  await expect(main.locator('[data-relief] image[data-level]:not([data-level="overview"])').first()).toBeAttached();
  await expect.poll(() => main.locator("[data-relief] image[data-loaded]").count()).toBeGreaterThan(0);
  expect(tiles.length, "tiles fetched when zoomed").toBeGreaterThan(0);
  // Only tiles near the visible part are drawn (a quarter of the screen of margin).
  const outside = await page.evaluate(() => {
    const svg = document.querySelector('[data-testid="map-main"]')!.getBoundingClientRect();
    const [mx, my] = [svg.width / 4, svg.height / 4];
    return [...document.querySelectorAll('[data-testid="map-main"] [data-relief] image:not([data-level="overview"])')].filter((img) => {
      const r = img.getBoundingClientRect();
      return r.right < svg.left - mx || r.left > svg.right + mx || r.bottom < svg.top - my || r.top > svg.bottom + my;
    }).length;
  });
  expect(outside, "tiles far outside the view").toBe(0);
  for (const d of Object.values(await placed())) expect(Math.abs(d)).toBeLessThan(1);

  // The close-up has the same landscape.
  if ((await page.getByTestId("map-inset").count()) === 0) await page.getByTestId("inset-toggle").click();
  await expect(page.locator('[data-testid="map-inset"] [data-relief] image[data-level="overview"]').first()).toBeAttached();
});

test("the relief is the same in every stage and never depends on the Find question", async ({ page }) => {
  test.skip(test.info().project.name !== "mobile", "Runs once.");
  /** The relief markup of the main map, without React's per-instance ids. */
  const reliefMarkup = () => page.locator('[data-testid="map-main"] [data-relief]').evaluate((el) => el.outerHTML.replace(/_r_\w+?_|:r\w+?:/gi, "#"));

  await openLesson(page, findAsking("BEL"));
  // An unanswered question: no names on the map.
  await expect(page.locator('[data-testid="map-main"] text')).toHaveCount(0);
  const askingBelgium = await reliefMarkup();
  await openLesson(page, findAsking("DEU"));
  await expect(page.locator('[data-testid="map-main"] text')).toHaveCount(0);
  const askingGermany = await reliefMarkup();
  expect(askingGermany).toBe(askingBelgium);
  // Unanswered: no country is in a state colour, so there is no overlay to give anything away.
  await expect(page.locator('[data-testid="map-main"] [data-family="tone"]')).toHaveCount(0);
  await openLesson(page, discover());
  expect(await reliefMarkup()).toBe(askingBelgium);

  // Travel in progress and a completed route: the route is drawn above the relief, visited countries get the overlay.
  for (const [stage, lesson] of [["travel", travelling], ["results", completed]] as const) {
    await openLesson(page, lesson);
    await expect(page.locator('[data-testid="map-main"] [data-tone="visited"]').first(), stage).toBeAttached();
    await expect(page.locator('[data-testid="map-main"] [data-relief] [data-family="land"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="map-main"] [data-relief] [data-family="tone"]')).toHaveCount(1);
    const routeAbove = await page.evaluate(() => {
      const svg = document.querySelector('[data-testid="map-main"]')!;
      const route = svg.querySelector('[class*="route"]');
      return !!route && (svg.querySelector("[data-relief]")!.compareDocumentPosition(route) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    });
    expect(routeAbove, stage).toBe(true);
  }
});

test("About the map lists the map's sources, in English and Armenian", async ({ page }) => {
  test.skip(test.info().project.name !== "mobile", "Runs once.");
  await openLesson(page, discover());
  const button = page.getByRole("button", { name: "About the map" });
  await button.click();
  const dialog = page.getByRole("dialog", { name: "About the map" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Natural Earth");
  await expect(dialog).toContainText("SRTM and GMTED2010 terrain data courtesy of the U.S. Geological Survey.");
  await expect(dialog).toContainText("ETOPO1");
  await expect(dialog).toContainText("Mapzen");
  await expect(dialog).toContainText("© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium");
  await expect(dialog).toContainText("Forests");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(button).toBeFocused();

  await openLesson(page, discover(), "hy");
  await page.getByRole("button", { name: "Քարտեզի մասին" }).click();
  const hy = page.getByRole("dialog", { name: "Քարտեզի մասին" });
  await expect(hy).toContainText("Natural Earth");
  await expect(hy).toContainText("U.S. Geological Survey");
  await expect(hy).toContainText("ESA WorldCover");
  await expect(hy).toContainText("Անտառները");
  await hy.getByRole("button", { name: "Փակել" }).click();
  await expect(hy).toBeHidden();
});
