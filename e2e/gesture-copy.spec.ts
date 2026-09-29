import { expect, test, type Page } from "@playwright/test";

/*
 * The gesture copy (see RegionMap.tsx): a copy of the landscape kept drawn,
 * nearly transparent, in front of the map at rest, and shown in place of the
 * map while it moves. These tests sample every frame of real gestures.
 */

/** Opens the lesson directly in a given state. */
async function openLesson(page: Page, lesson: object) {
  await page.goto("/");
  await page.evaluate(
    ([v]) => localStorage.setItem("arimap:state", v),
    [JSON.stringify({ version: 1, locale: "en", screen: "lesson", lessons: { "western-europe-1": lesson } })],
  );
  await page.reload();
  await expect(page.locator('[data-testid="map-main"] path[data-country="FRA"]')).toBeVisible();
  // Let the landscape tiles and the copy settle.
  await page.waitForTimeout(1500);
}

const discover = (selected: string | null = null) => ({ started: true, stage: "discover", discover: { selected, explored: ["FRA"] } });
const findAsking = (target: string, feedback: object | null = null, wrongGuesses: string[] = []) => ({
  started: true,
  stage: "find",
  discover: { selected: null, explored: ["FRA", "BEL", "NLD", "LUX", "DEU"] },
  find: {
    orders: [
      [target, ...["FRA", "BEL", "NLD", "LUX", "DEU"].filter((c) => c !== target)],
      ["LUX", "DEU", "FRA", "NLD", "BEL"],
    ],
    round: 0,
    index: 0,
    question: { target, wrongGuesses, hintLevel: 0, solved: false, feedback },
    results: [[], []],
    status: "asking",
  },
});
const travelling = (path: string[]) => ({ started: true, stage: "travel", travel: { missionId: "fra-to-nld", path } });

async function zoomIn(page: Page, times = 1) {
  for (let i = 0; i < times; i++) {
    await page.getByRole("button", { name: "Zoom in" }).click();
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(800);
}

/** An on-screen point on a country's own path on the main map. */
async function pointOn(page: Page, id: string) {
  const p = await page.evaluate((id) => {
    const path = document.querySelector(`[data-testid="map-main"] path[data-country="${id}"]`)!;
    const r = path.getBoundingClientRect();
    for (let i = 4; i < 20; i++)
      for (const j of [10, 8, 12, 6]) {
        const x = r.left + (r.width * i) / 24;
        const y = r.top + (r.height * j) / 20;
        if (document.elementFromPoint(x, y) === path) return { x, y };
      }
    return null;
  }, id);
  expect(p, `${id} should be tappable`).not.toBeNull();
  return p!;
}

interface Frame {
  gesture: boolean;
  view: { w: number; h: number };
  texts: { what: string; label: string | null; b: { x0: number; y0: number; x1: number; y1: number }; size: string | null; height: number }[];
  chrome: { x0: number; y0: number; x1: number; y1: number }[];
  worldTones: string;
  copyTones: string;
  route: string | null;
  bordersScale: number;
  copyScale: number;
}

/** Samples every frame from now on (see Frame); stop with stopSampling. */
async function startSampling(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __frames: unknown[]; __sampling: boolean };
    w.__frames = [];
    w.__sampling = true;
    const main = document.querySelector('[data-testid="map-main"]')!;
    const wrap = main.parentElement!;
    const scale = (el: Element | null) => {
      const m = (el as HTMLElement | null)?.style.transform.match(/scale\(([\d.e-]+)\)/);
      return m ? +m[1] : 1;
    };
    const tick = () => {
      const m = main.getBoundingClientRect();
      const rel = (r: DOMRect) => ({ x0: r.left - m.left, y0: r.top - m.top, x1: r.right - m.left, y1: r.bottom - m.top });
      const texts = [...main.querySelectorAll("[data-overlay] text, [data-overlay] [data-callout] rect")].map((t) => {
        const r = t.getBoundingClientRect();
        return { what: t.textContent || "callout", label: t.closest("[data-label]")?.getAttribute("data-label") ?? null, b: rel(r), size: t.getAttribute("font-size"), height: r.height };
      });
      const chrome = [...wrap.querySelectorAll('[data-testid="map-controls"], [data-testid="map-about"], [data-testid="inset-toggle"]')].map((e) => rel(e.getBoundingClientRect()));
      const panel = wrap.querySelector('[data-testid="map-inset"]')?.closest("figure");
      if (panel) chrome.push(rel(panel.getBoundingClientRect()));
      w.__frames.push({
        gesture: wrap.hasAttribute("data-gesture"),
        view: { w: m.width, h: m.height },
        texts,
        chrome,
        worldTones: [...main.querySelectorAll("path[data-tone]")].map((p) => p.getAttribute("data-tone")).join(),
        copyTones: [...wrap.querySelectorAll("[data-copy-fills] path")].map((p) => p.getAttribute("data-tone")).join(),
        route: main.querySelector('[data-testid="route-line"]')?.getAttribute("data-route") ?? null,
        bordersScale: scale(wrap.querySelector("[data-live-borders]")),
        copyScale: scale(wrap.querySelector("[data-gesture-copy]")),
      });
      if (w.__sampling) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
const stopSampling = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __frames: Frame[]; __sampling: boolean };
    w.__sampling = false;
    return w.__frames;
  });

/** A mouse drag from the map's centre by (dx, dy) px in `steps` moves, one per frame. */
async function drag(page: Page, dx: number, dy: number, steps = 20) {
  const b = (await page.getByTestId("map-main").boundingBox())!;
  const c = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(c.x + (dx * i) / steps, c.y + (dy * i) / steps);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
}

/** Decodes two PNG screenshots in the page and compares them: pixels differing by more than 2 (of 255), and the largest difference. */
async function compareShots(page: Page, a: Buffer, b: Buffer) {
  return page.evaluate(async ([a, b]) => {
    const load = async (src: string) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const c = new OffscreenCanvas(img.width, img.height);
      const x = c.getContext("2d")!;
      x.drawImage(img, 0, 0);
      return x.getImageData(0, 0, img.width, img.height).data;
    };
    const [A, B] = [await load(a), await load(b)];
    let differing = 0;
    let max = 0;
    for (let i = 0; i < A.length; i += 4) {
      const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]));
      if (d > 2) differing++;
      max = Math.max(max, d);
    }
    return { differing, max };
  }, [a, b].map((s) => `data:image/png;base64,${s.toString("base64")}`) as [string, string]);
}

test.beforeEach(() => {
  test.skip(test.info().project.name !== "desktop", "Mouse and wheel; runs once.");
});

test("at rest the gesture copy changes nothing visible, takes no input and is left out of the accessibility tree", async ({ page }) => {
  await openLesson(page, discover("BEL"));
  const main = page.getByTestId("map-main");
  const clip = (await main.boundingBox())!;
  const copy = page.locator("[data-gesture-copy]");
  await expect(copy).toHaveCount(1);
  // Not in the stage (so no locator on the map finds it), hidden from assistive technology, inert.
  expect(await main.locator("[data-gesture-copy]").count()).toBe(0);
  const holder = copy.locator("..");
  await expect(holder).toHaveAttribute("aria-hidden", "true");
  expect(await holder.evaluate((el) => (el as HTMLElement).inert)).toBe(true);
  expect(await holder.locator("[data-country], [data-label], [tabindex], button, a").count()).toBe(0);

  // Pixels: the same (to within 2 of 255) with the copy there or removed.
  const shown = await page.screenshot({ clip });
  const tree = await page.locator("[data-map-style]").ariaSnapshot();
  await page.evaluate(() => document.querySelector("[data-gesture-copy]")!.parentElement!.remove());
  await page.waitForTimeout(300);
  const removed = await page.screenshot({ clip });
  const { differing, max } = await compareShots(page, shown, removed);
  expect(differing).toBe(0);
  expect(max).toBeLessThanOrEqual(2);
  expect(await page.locator("[data-map-style]").ariaSnapshot()).toBe(tree);
});

test("while the map moves, taps and hit testing reach the map, never the copy, and a tap afterwards still selects", async ({ page }) => {
  await openLesson(page, discover());
  await zoomIn(page);
  const hitsInCopy = () =>
    page.evaluate(() => {
      const m = document.querySelector('[data-testid="map-main"]')!.getBoundingClientRect();
      let copy = 0;
      for (let i = 1; i < 10; i++)
        for (let j = 1; j < 8; j++) if (document.elementFromPoint(m.left + (m.width * i) / 10, m.top + (m.height * j) / 8)?.closest("[inert]")) copy++;
      return copy;
    });
  expect(await hitsInCopy()).toBe(0);
  const b = (await page.getByTestId("map-main").boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) {
    await page.mouse.move(b.x + b.width / 2 - i * 10, b.y + b.height / 2);
    await page.waitForTimeout(16);
  }
  await expect(page.locator("[data-map-style]")).toHaveAttribute("data-gesture", "");
  expect(await hitsInCopy()).toBe(0);
  await page.mouse.up();
  await page.waitForTimeout(700);
  await expect(page.locator("[data-map-style]")).not.toHaveAttribute("data-gesture", "");
  const q = await pointOn(page, "DEU");
  await page.mouse.click(q.x, q.y);
  await expect(page.getByTestId("country-card")).toHaveAttribute("data-country", "DEU");
});

test("during a wheel zoom, names keep their size and borders their width while the landscape is magnified", async ({ page }) => {
  await openLesson(page, discover("BEL"));
  await zoomIn(page);
  const main = page.getByTestId("map-main");
  const box = (await main.boundingBox())!;
  const rest = await page.evaluate(() =>
    Object.fromEntries([...document.querySelectorAll('[data-testid="map-main"] [data-overlay] [data-label] text')].map((t) => [t.textContent, t.getBoundingClientRect().height])),
  );
  await startSampling(page);
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.45);
  for (let i = 0; i < 10; i++) {
    await page.mouse.wheel(0, -50);
    await page.waitForTimeout(25);
  }
  await page.waitForTimeout(900);
  const frames = (await stopSampling(page)).filter((f) => f.gesture);
  expect(frames.length, "frames sampled while the map moved").toBeGreaterThan(10);
  // The landscape was magnified (moved as a layer) in some frames...
  expect(Math.max(...frames.map((f) => f.copyScale))).toBeGreaterThan(1.2);
  for (const f of frames) {
    // ...while the borders stayed within 6% of their width (drawn again as the scale changes)...
    expect(f.bordersScale).toBeGreaterThan(0.93);
    expect(f.bordersScale).toBeLessThan(1.07);
    // ...and every name kept its font size and height on screen.
    for (const t of f.texts) {
      if (t.what === "callout") continue;
      expect(t.size, `${t.what} font size`).toMatch(/^(14|12|13|11\.5)$/);
      if (rest[t.what] !== undefined) expect(Math.abs(t.height - rest[t.what]), `${t.what} height`).toBeLessThan(0.75);
    }
  }
});

test("while dragging, names are never cut by the view's edge or drawn under the map controls or the close-up", async ({ page }) => {
  await openLesson(page, discover("BEL"));
  await zoomIn(page, 2);
  await startSampling(page);
  // Right and down (Luxembourg's callout and Brussels reach the right edge, the Netherlands the About button), then back past the start.
  await drag(page, 420, 120, 30);
  await drag(page, -560, -160, 30);
  await page.waitForTimeout(700);
  const frames = (await stopSampling(page)).filter((f) => f.gesture);
  expect(frames.length).toBeGreaterThan(20);
  const hit = (a: Frame["chrome"][number], b: Frame["chrome"][number]) => a.x0 < b.x1 - 1 && b.x0 < a.x1 - 1 && a.y0 < b.y1 - 1 && b.y0 < a.y1 - 1;
  const problems = new Set<string>();
  for (const f of frames)
    for (const t of f.texts) {
      // A name wholly outside the view is clipped and unseen; one cut by the edge is not.
      const visible = t.b.x1 > 0 && t.b.y1 > 0 && t.b.x0 < f.view.w && t.b.y0 < f.view.h;
      const cut = t.b.x0 < -1 || t.b.y0 < -1 || t.b.x1 > f.view.w + 1 || t.b.y1 > f.view.h + 1;
      if (visible && cut) problems.add(`${t.what} cut by the edge`);
      if (f.chrome.some((c) => hit(t.b, c))) problems.add(`${t.what} under the map controls or close-up`);
    }
  expect([...problems]).toEqual([]);
});

test("gestures in Find never show the answer's name or colour", async ({ page }) => {
  // A wrong guess (France) is named; the answer (Belgium) must stay unnamed and uncoloured.
  await openLesson(page, findAsking("BEL", { kind: "wrong", country: "FRA" }, ["FRA"]));
  const names = () => page.evaluate(() => [...document.querySelectorAll('[data-testid="map-main"] [data-overlay] [data-label]')].map((e) => e.getAttribute("data-label")));
  expect(await names()).toEqual(["FRA"]);
  await startSampling(page);
  const b = (await page.getByTestId("map-main").boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, -60);
    await page.waitForTimeout(25);
  }
  await drag(page, -240, 80);
  await page.waitForTimeout(700);
  const frames = await stopSampling(page);
  expect(frames.filter((f) => f.gesture).length).toBeGreaterThan(10);
  const shown = new Set(frames.flatMap((f) => f.texts.map((t) => t.label).filter(Boolean)));
  expect([...shown]).toEqual(["FRA"]);
  expect(frames.some((f) => f.texts.some((t) => t.what.includes("Belgium")))).toBe(false);
  // Map order of the lesson countries: FRA, BEL, NLD, LUX, DEU (as drawn); Belgium stays in its default colour, in the map and the copy.
  const order = await page.evaluate(() => [...document.querySelectorAll('[data-testid="map-main"] path[data-tone]')].map((p) => p.getAttribute("data-country")));
  const bel = order.indexOf("BEL");
  for (const f of frames) {
    expect(f.worldTones.split(",")[bel]).toBe("default");
    expect(f.copyTones.split(",")[bel]).toBe("default");
  }
  expect(await names()).toEqual(["FRA"]);
});

test.describe("a gesture started right after a change shows the new state from its first frame", () => {
  const cases: { name: string; lesson: object; act: (page: Page) => Promise<unknown>; route?: string | null }[] = [
    { name: "selecting a country", lesson: discover(), act: async (page) => { const p = await pointOn(page, "DEU"); await page.mouse.click(p.x, p.y); } },
    { name: "a Find answer", lesson: findAsking("DEU"), act: async (page) => { const p = await pointOn(page, "DEU"); await page.mouse.click(p.x, p.y); } },
    { name: "a Travel move", lesson: travelling(["FRA"]), act: (page) => page.getByTestId("move-BEL").click(), route: "FRA,BEL" },
    { name: "Undo", lesson: travelling(["FRA", "BEL"]), act: (page) => page.getByTestId("travel-tools").getByRole("button", { name: "Undo" }).click(), route: null },
    { name: "Restart", lesson: travelling(["FRA", "LUX"]), act: (page) => page.getByRole("button", { name: "Restart" }).click(), route: null },
  ];
  for (const c of cases)
    test(c.name, async ({ page }) => {
      await openLesson(page, c.lesson);
      await zoomIn(page);
      const before = await page.evaluate(() => [...document.querySelectorAll('[data-testid="map-main"] path[data-tone]')].map((p) => p.getAttribute("data-tone")).join());
      await startSampling(page);
      await c.act(page);
      // No wait: the drag starts as soon as the change is made.
      await drag(page, -160, -60, 15);
      await page.waitForTimeout(700);
      const frames = await stopSampling(page);
      const moving = frames.filter((f) => f.gesture);
      expect(moving.length).toBeGreaterThan(5);
      // The change happened (the colours differ from before), and every frame the copy showed had the map's current colours.
      expect(moving[0].worldTones).not.toBe(before);
      for (const f of moving) expect(f.copyTones, "copy colours while the map moved").toBe(f.worldTones);
      // Routes and markers are drawn over the map, from the current state.
      if (c.route !== undefined) for (const f of moving) expect(f.route).toBe(c.route);
    });
});

test("repeated gestures and resizes keep the copy aligned with the map and add no layers", async ({ page }) => {
  await openLesson(page, discover("BEL"));
  await zoomIn(page);
  const cdp = await page.context().newCDPSession(page);
  const layers = async () => {
    await cdp.send("LayerTree.enable");
    await page.evaluate(() => (document.body.style.outlineColor = document.body.style.outlineColor === "red" ? "blue" : "red"));
    const n = await new Promise<number>((resolve) => {
      cdp.once("LayerTree.layerTreeDidChange", (e) => resolve((e.layers ?? []).filter((l) => l.drawsContent).length));
      setTimeout(() => resolve(-1), 5000);
    });
    await cdp.send("LayerTree.disable");
    return n;
  };
  const initial = await layers();
  expect(initial).toBeGreaterThan(0);
  // On every frame the copy shows, Germany in the copy is exactly where Germany is in the (hidden) map.
  await page.evaluate(() => {
    const w = window as unknown as { __align: { frames: number; worst: number } };
    w.__align = { frames: 0, worst: 0 };
    const main = document.querySelector('[data-testid="map-main"]')!;
    const wrap = main.parentElement!;
    const tick = () => {
      if (wrap.hasAttribute("data-gesture")) {
        const world = [...main.querySelectorAll("path[data-tone]")];
        const i = world.findIndex((p) => p.getAttribute("data-country") === "DEU");
        const a = world[i].getBoundingClientRect();
        const b = wrap.querySelectorAll("[data-copy-fills] path")[i].getBoundingClientRect();
        w.__align.frames++;
        // Centres: some engines include the map's stroke (the copy has none) in an SVG path's box.
        w.__align.worst = Math.max(w.__align.worst, Math.abs(a.left + a.width / 2 - b.left - b.width / 2), Math.abs(a.top + a.height / 2 - b.top - b.height / 2));
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const sizes = [
    { width: 1024, height: 700 },
    { width: 390, height: 780 },
    { width: 1366, height: 800 },
  ];
  for (let cycle = 0; cycle < 6; cycle++) {
    await drag(page, cycle % 2 ? 110 : -110, 40, 12);
    const b = (await page.getByTestId("map-main").boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    for (let i = 0; i < 3; i++) {
      await page.mouse.wheel(0, cycle % 2 ? 80 : -80);
      await page.waitForTimeout(30);
    }
    await page.waitForTimeout(700);
    if (cycle % 2) {
      await page.setViewportSize(sizes[cycle >> 1]);
      await page.waitForTimeout(1000);
    }
  }
  await page.waitForTimeout(1500);
  const align = await page.evaluate(() => (window as unknown as { __align: { frames: number; worst: number } }).__align);
  expect(align.frames).toBeGreaterThan(30);
  expect(align.worst).toBeLessThan(0.5);
  expect(await layers()).toBe(initial);
});

/*
 * Other engines (see gestureModeFor in liveView.ts). The e2e browsers are all
 * Chromium, so these check each mode's behaviour, not how the engine draws it.
 */
const FIREFOX_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:155.0) Gecko/20100101 Firefox/155.0";
const SAFARI_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15";

test.describe("Firefox: the copy draws its own borders", () => {
  test.use({ userAgent: FIREFOX_UA });

  test("no live borders layer; a gesture right after a selection shows the new colours", async ({ page }) => {
    await openLesson(page, discover());
    await expect(page.locator("[data-map-style]")).toHaveAttribute("data-gesture-mode", "copyWithBorders");
    await expect(page.locator("[data-live-borders]")).toHaveCount(0);
    await expect(page.locator('[data-gesture-copy] [class*="borders"]')).toHaveCount(1);
    await zoomIn(page);
    await startSampling(page);
    const p = await pointOn(page, "DEU");
    await page.mouse.click(p.x, p.y);
    await drag(page, -160, -60, 15);
    await page.waitForTimeout(700);
    const moving = (await stopSampling(page)).filter((f) => f.gesture);
    expect(moving.length).toBeGreaterThan(5);
    for (const f of moving) expect(f.copyTones).toBe(f.worldTones);
    await expect(page.getByTestId("country-card")).toHaveAttribute("data-country", "DEU");
  });
});

test.describe("WebKit (and every browser on iOS): the map itself moves, as before the copy", () => {
  test.use({ userAgent: SAFARI_UA });

  test("no copy; the map is the moving layer from the press, names follow, and taps still select", async ({ page }) => {
    await openLesson(page, discover());
    const wrap = page.locator("[data-map-style]");
    await expect(wrap).toHaveAttribute("data-gesture-mode", "layer");
    await expect(page.locator("[data-gesture-copy], [data-live-borders]")).toHaveCount(0);
    await zoomIn(page);
    const world = page.getByTestId("map-main").locator("svg").first();
    const b = (await page.getByTestId("map-main").boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    // Promoted on the press, before any movement.
    await expect(wrap).toHaveAttribute("data-gesture", "");
    const labelBefore = (await page.locator('[data-testid="map-main"] [data-label="FRA"] text').boundingBox())!;
    for (let i = 1; i <= 10; i++) {
      await page.mouse.move(b.x + b.width / 2 - i * 9, b.y + b.height / 2 - i * 3);
      await page.waitForTimeout(16);
    }
    // The visible map moved as a layer, and France's name moved with it.
    const moved = await world.evaluate((el) => ({ transform: (el as SVGSVGElement).style.transform, opacity: getComputedStyle(el).opacity }));
    expect(moved.opacity).toBe("1");
    const [, tx, ty] = moved.transform.match(/translate\(([-\d.e]+)px, ?([-\d.e]+)px\)/)!.map(Number);
    const labelDuring = (await page.locator('[data-testid="map-main"] [data-label="FRA"] text').boundingBox())!;
    expect(Math.abs(labelDuring.x - labelBefore.x - tx)).toBeLessThan(1.5);
    expect(Math.abs(labelDuring.y - labelBefore.y - ty)).toBeLessThan(1.5);
    await page.mouse.up();
    await page.waitForTimeout(700);
    await expect(wrap).not.toHaveAttribute("data-gesture", "");
    await expect(page.getByTestId("country-card")).toHaveCount(0);
    const p = await pointOn(page, "DEU");
    await page.mouse.click(p.x, p.y);
    await expect(page.getByTestId("country-card")).toHaveAttribute("data-country", "DEU");
  });
});
