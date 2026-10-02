import { expect, test, type Page } from "@playwright/test";
import { openWithSave } from "./helpers/save";

/** Opens the lesson directly in a given state. */
async function openLesson(page: Page, lesson: object) {
  await openWithSave(page, { version: 1, locale: "en", screen: "lesson", lessons: { "western-europe-1": lesson } });
  await expect(page.locator('[data-testid="map-main"] path[data-country="FRA"]')).toBeVisible();
}

const discover = { started: true, stage: "discover", discover: { selected: null, explored: [] } };

/** The view the map is drawn for (the world group's transform), and the drawn layer's CSS transform. */
const drawnState = (page: Page) =>
  page.evaluate(() => {
    const g = document.querySelector('[data-testid="map-main"] [data-relief]')!.parentElement as unknown as SVGGElement;
    const [, x, y, k] = g.getAttribute("transform")!.match(/translate\(([-\d.e]+),([-\d.e]+)\) scale\(([-\d.e]+)\)/)!.map(Number);
    return { x, y, k, layer: (g.ownerSVGElement as SVGSVGElement).style.transform };
  });

/** A point on Germany's own path, near the middle of the map. */
async function pointOnGermany(page: Page) {
  return page.evaluate(() => {
    const path = document.querySelector('[data-testid="map-main"] path[data-country="DEU"]')!;
    const r = path.getBoundingClientRect();
    for (let i = 4; i < 20; i++)
      for (const j of [8, 10, 6, 12]) {
        const x = r.left + (r.width * i) / 24;
        const y = r.top + (r.height * j) / 20;
        if (document.elementFromPoint(x, y) === path) return { x, y };
      }
    return null;
  });
}

test("dragging moves the drawn map without redrawing it; names follow, and the view is drawn again once it settles", async ({ page }) => {
  test.skip(test.info().project.name !== "desktop", "Mouse and wheel; runs once.");
  await openLesson(page, discover);
  const main = page.getByTestId("map-main");
  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.waitForTimeout(500);
  const start = await drawnState(page);
  expect(start.layer).toBe("");

  // Sample every frame during the drag: the drawn view, the layer's transform, and France's name.
  await page.evaluate(() => {
    const w = window as unknown as { samples: { attr: string; layer: string; label: [number, number] }[]; sampling: boolean };
    w.samples = [];
    w.sampling = true;
    const g = document.querySelector('[data-testid="map-main"] [data-relief]')!.parentElement as unknown as SVGGElement;
    const tick = () => {
      const label = document.querySelector('[data-testid="map-main"] [data-label="FRA"] text')!.getBoundingClientRect();
      w.samples.push({ attr: g.getAttribute("transform")!, layer: (g.ownerSVGElement as SVGSVGElement).style.transform, label: [label.left, label.top] });
      if (w.sampling) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const p = (await pointOnGermany(page))!;
  expect(p).not.toBeNull();
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x - 90, p.y - 50, { steps: 15 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  const samples = await page.evaluate(() => {
    const w = window as unknown as { samples: { attr: string; layer: string; label: [number, number] }[]; sampling: boolean };
    w.sampling = false;
    return w.samples;
  });

  // While moving, the drawn map stayed as it was and only its layer moved; France's name moved with it.
  const initialAttr = samples[0].attr;
  const moving = samples.filter((s) => s.layer !== "" && s.attr === initialAttr);
  expect(moving.length, "frames where the drawn layer moved without a redraw").toBeGreaterThan(3);
  for (const s of moving) {
    const [, tx, ty] = s.layer.match(/translate\(([-\d.e]+)px, ?([-\d.e]+)px\)/)!.map(Number);
    expect(Math.abs(s.label[0] - samples[0].label[0] - tx), `name follows the map (x) at ${s.layer}`).toBeLessThan(1.5);
    expect(Math.abs(s.label[1] - samples[0].label[1] - ty), `name follows the map (y) at ${s.layer}`).toBeLessThan(1.5);
  }

  // Released: the map is drawn for the new view, and the layer is back in place.
  const end = await drawnState(page);
  expect(end.layer).toBe("");
  expect(end.k).toBe(start.k);
  expect(Math.abs(end.x - start.x + 90)).toBeLessThan(1.5);
  expect(Math.abs(end.y - start.y + 50)).toBeLessThan(1.5);
  // The drag started on Germany but selected nothing.
  await expect(page.getByTestId("country-card")).toHaveCount(0);
  // A tap still selects.
  const q = (await pointOnGermany(page))!;
  await page.mouse.click(q.x, q.y);
  await expect(page.getByTestId("country-card")).toHaveAttribute("data-country", "DEU");

  // Wheel zoom: once it settles, the map is drawn at the new scale, sharp (no leftover layer scaling).
  const box = (await main.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, -100);
    await page.waitForTimeout(30);
  }
  await page.waitForTimeout(500);
  const zoomed = await drawnState(page);
  expect(zoomed.k).toBeGreaterThan(end.k * 1.5);
  expect(zoomed.layer).toBe("");
  await expect(main.locator('[data-label="FRA"], [data-label="DEU"]').first()).toBeAttached();
});

test("a touch drag that starts on a country pans without selecting it or redrawing on every move", async ({ page }) => {
  test.skip(test.info().project.name !== "mobile", "Touch; runs once.");
  await openLesson(page, discover);
  const start = await drawnState(page);
  await page.evaluate(() => {
    const w = window as unknown as { redraws: number };
    w.redraws = 0;
    const g = document.querySelector('[data-testid="map-main"] [data-relief]')!.parentElement as unknown as SVGGElement;
    new MutationObserver(() => w.redraws++).observe(g, { attributes: true, attributeFilter: ["transform"] });
  });
  const p = (await pointOnGermany(page))!;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: p.x, y: p.y }] });
  for (let i = 1; i <= 12; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: p.x - i * 5, y: p.y + i * 3 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(400);
  const end = await drawnState(page);
  expect(end.x !== start.x || end.y !== start.y, "the map panned").toBe(true);
  expect(end.layer).toBe("");
  // Drawn again once, when the drag ended (and at most once more, had it paused).
  expect(await page.evaluate(() => (window as unknown as { redraws: number }).redraws)).toBeLessThanOrEqual(2);
  await expect(page.getByTestId("country-card")).toHaveCount(0);
});
