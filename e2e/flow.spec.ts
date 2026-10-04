import { expect, test, type Page } from "@playwright/test";
import { countGameSaves, openWithSave, writeSave } from "./helpers/save";
import { homeToEurope } from "./helpers/home";

// A saved state is written only once the game has made its own first save (see helpers/save.ts).
test.beforeEach(async ({ page }) => {
  await countGameSaves(page);
});

const NAMES: Record<string, string> = {
  France: "FRA",
  Belgium: "BEL",
  "the Netherlands": "NLD",
  Netherlands: "NLD",
  Luxembourg: "LUX",
  Germany: "DEU",
};

const LANDMARKS: Record<string, string> = {
  FRA: "Eiffel Tower",
  BEL: "Atomium",
  NLD: "Amsterdam canal houses",
  LUX: "Adolphe Bridge",
  DEU: "Brandenburg Gate",
};

/** Route stops drawn on the main map, e.g. "FRA,LUX", or "" when there is no line. */
async function drawnRoute(page: Page) {
  const line = page.locator('[data-testid="map-main"] [data-testid="route-line"]');
  return (await line.count()) === 0 ? "" : ((await line.getAttribute("data-route")) ?? "");
}

let shotIndex = 0;
async function shot(page: Page, name: string) {
  const project = test.info().project.name;
  await page.screenshot({ path: `screenshots/${project}/${String(++shotIndex).padStart(2, "0")}-${name}.png` });
}

/** Finds an on-screen point that hits the country's own path (not a neighbour, label or control). */
async function pointOnCountry(page: Page, id: string, map: "map-main" | "map-inset" = "map-main") {
  const point = await page.evaluate(
    ({ id, map }) => {
      const svg = document.querySelector(`[data-testid="${map}"]`)!;
      const path = svg.querySelector(`path[data-country="${id}"]`)!;
      const r = path.getBoundingClientRect();
      const hits: [number, number][] = [];
      const steps = 24;
      for (let i = 1; i < steps; i++) {
        for (let j = 1; j < steps; j++) {
          const x = r.left + (r.width * i) / steps;
          const y = r.top + (r.height * j) / steps;
          if (document.elementFromPoint(x, y) === path) hits.push([x, y]);
        }
      }
      if (hits.length === 0) return null;
      const cx = hits.reduce((s, h) => s + h[0], 0) / hits.length;
      const cy = hits.reduce((s, h) => s + h[1], 0) / hits.length;
      hits.sort((a, b) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy));
      return { x: hits[0][0], y: hits[0][1], hits: hits.length };
    },
    { id, map },
  );
  expect(point, `${id} should be tappable on ${map}`).not.toBeNull();
  return point!;
}

async function tapCountry(page: Page, id: string, map: "map-main" | "map-inset" = "map-main") {
  const { x, y } = await pointOnCountry(page, id, map);
  if (test.info().project.use.hasTouch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

/** Luxembourg is selected through the magnified inset (opened if collapsed); other countries on the main map. */
async function tapActive(page: Page, id: string) {
  if (id === "LUX" && (await page.getByTestId("map-inset").count()) === 0) {
    await page.getByTestId("inset-toggle").click();
  }
  await tapCountry(page, id, id === "LUX" ? "map-inset" : "map-main");
}

async function currentTarget(page: Page): Promise<string> {
  const text = (await page.getByTestId("find-prompt").textContent())!;
  const name = text.replace(/^Find /, "").trim();
  expect(NAMES[name], `unknown prompt "${text}"`).toBeDefined();
  return NAMES[name];
}

async function mapLabels(page: Page) {
  return page.locator('[data-testid="map-main"] text').allTextContents();
}

/** Names on the main map and in the close-up (small countries' names can move into it). */
async function allMapNames(page: Page) {
  return (await page.locator('[data-testid="map-main"] text, [data-testid="map-inset"] text').allTextContents()).sort();
}

async function setLanguage(page: Page, lang: "English" | "Հայերեն") {
  await page.getByRole("button", { name: lang, exact: true }).first().click();
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

/** Luxembourg's callout stays inside the map and never covers the zoom buttons or marker names. */
async function expectCalloutClear(page: Page) {
  const callout = page.locator('[data-testid="map-main"] [data-callout] rect');
  if ((await callout.count()) === 0) return;
  const box = (await callout.boundingBox())!;
  const map = (await page.getByTestId("map-main").boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(map.x);
  expect(box.x + box.width).toBeLessThanOrEqual(map.x + map.width);
  const overlaps = (b: { x: number; y: number; width: number; height: number }) =>
    box.x < b.x + b.width && b.x < box.x + box.width && box.y < b.y + b.height && b.y < box.y + box.height;
  expect(overlaps((await page.getByTestId("map-controls").boundingBox())!), "callout covers the zoom controls").toBe(false);
  // Nor capital/landmark names such as Paris.
  for (const text of await page.locator('[data-testid="map-main"] [data-marker-text]').all()) {
    expect(overlaps((await text.boundingBox())!), `callout covers "${await text.textContent()}"`).toBe(false);
  }
}

/** Map names never overlap each other, and never sit under the zoom controls or the close-up. */
async function expectMapTextClear(page: Page) {
  const problems = await page.evaluate(() => {
    const box = (el: Element) => el.getBoundingClientRect();
    const hit = (a: DOMRect, b: DOMRect) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
    const texts = [
      ...[...document.querySelectorAll('[data-testid="map-main"] text')].map((t) => ({ name: t.textContent, b: box(t) })),
      ...[...document.querySelectorAll('[data-testid="map-main"] [data-explored-badge]')].map((g) => ({ name: `badge of ${g.parentElement?.getAttribute("data-label")}`, b: box(g) })),
    ];
    const panels = [document.querySelector('[data-testid="map-controls"]'), document.querySelector('[data-testid="inset-toggle"]')?.parentElement];
    const out: string[] = [];
    texts.forEach((a, i) => {
      texts.slice(i + 1).forEach((b) => hit(a.b, b.b) && out.push(`${a.name} × ${b.name}`));
      panels.forEach((el) => el && hit(a.b, box(el)) && out.push(`${a.name} hidden`));
    });
    return out;
  });
  expect(problems, "map labels collide").toEqual([]);
}

/** Checks Armenian rendering of the current screen and returns to English. */
async function checkArmenian(page: Page, name: string) {
  await expectCalloutClear(page);
  await expectMapTextClear(page);
  await setLanguage(page, "Հայերեն");
  await expect(page.locator("html")).toHaveAttribute("lang", "hy");
  await expectNoHorizontalOverflow(page);
  await expectCalloutClear(page);
  await expectMapTextClear(page);
  await shot(page, `${name}-hy`);
  await setLanguage(page, "English");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
}

test("complete lesson flow", async ({ page }) => {
  shotIndex = 0;
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" || /hydrat/i.test(m.text())) errors.push(`console ${m.type()}: ${m.text()}`);
  });

  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // --- Welcome -----------------------------------------------------------
  await expect(page.getByRole("heading", { name: "AriMap" })).toBeVisible();
  await expect(page.getByText("Discover the world.")).toBeVisible();
  await expect(page).toHaveTitle("AriMap — Discover the world.");
  await expect(page.getByRole("button", { name: "Continue" })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await shot(page, "welcome-en");
  await setLanguage(page, "Հայերեն");
  await expect(page.getByRole("heading", { name: "ԱրիՄապ" })).toBeVisible();
  await expect(page.getByText("Բացահայտիր աշխարհը")).toBeVisible();
  await expect(page).toHaveTitle("ԱրիՄապ — Բացահայտիր աշխարհը");
  await shot(page, "welcome-hy");
  await setLanguage(page, "English");
  // A new player chooses Europe (the main action there: nothing to continue yet), whose main action starts Level 1.
  await expect(page.getByTestId("explore-europe")).toHaveAttribute("data-primary", "true");
  await page.getByTestId("explore-europe").click();
  await expect(page.getByTestId("welcome-actions").getByRole("button")).toHaveText(/^Start\s*Level 1 · France and its neighbours$/);
  await page.getByTestId("welcome-actions").getByRole("button").click();

  // --- Discover: every country can be selected ------------------------------
  await expect(page.getByRole("heading", { name: "Tap a country to learn about it." })).toBeVisible();
  // The inset only starts open on wide maps, where it covers sea/context rather than lesson countries.
  const mapBox = (await page.getByTestId("map-main").boundingBox())!;
  await expect(page.getByTestId("map-inset")).toHaveCount(mapBox.width >= 600 && mapBox.height >= 420 ? 1 : 0);
  const labels = await mapLabels(page);
  expect(labels).toEqual(expect.arrayContaining(["France", "Belgium", "Netherlands", "Luxembourg", "Germany"]));
  const progressBox = async () => (await page.getByTestId("discover-progress").boundingBox())!;
  const progressBefore = await progressBox();
  let exploredCount = 0;
  for (const [id, name, capital] of [
    ["BEL", "Belgium", "Brussels"],
    ["NLD", "Netherlands", "Amsterdam"],
    ["LUX", "Luxembourg", "Luxembourg City"],
    ["DEU", "Germany", "Berlin"],
    ["FRA", "France", "Paris"],
  ]) {
    await tapActive(page, id);
    const card = page.getByTestId("country-card");
    await expect(card.getByRole("heading", { name })).toBeVisible();
    await expect(card.getByText(capital, { exact: true })).toBeVisible();
    await expect(page.locator('[data-testid="map-main"] text', { hasText: capital })).toHaveCount(1);
    const landmark = card.getByTestId("landmark-card");
    await expect(landmark.getByText(LANDMARKS[id], { exact: true })).toBeVisible();
    const image = card.getByTestId("landmark-image");
    await expect(image).toHaveAttribute("alt", new RegExp(`^Illustration of .*${LANDMARKS[id].split(" ").at(-1)}`, "i"));
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    // The whole illustration is inside the card (object-fit: contain, never cropped).
    expect(await image.evaluate((img: HTMLImageElement) => getComputedStyle(img).objectFit)).toBe("contain");
    const [imageBox, cardBox] = [(await image.boundingBox())!, (await card.boundingBox())!];
    expect(imageBox.x).toBeGreaterThanOrEqual(cardBox.x);
    expect(imageBox.x + imageBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width);
    // The artwork stays in its own box, above the landmark name and fact.
    const captionBox = (await landmark.locator("figcaption").boundingBox())!;
    expect(imageBox.y + imageBox.height, `${id}: art overlaps text`).toBeLessThanOrEqual(captionBox.y + 1);
    if (id === "LUX") {
      // Luxembourg's name sits in a callout joined to the country by a leader line:
      // on the main map, or inside the open close-up on small maps, never both.
      await expect(page.locator('[data-callout="LUX"] line')).toHaveCount(1);
      // The visible caption is short; the accessible label names the country because
      // all names are public in Discover.
      await expect(page.getByTestId("inset-title")).toHaveText("Close-up");
      await expect(page.getByTestId("map-inset")).toHaveAttribute("aria-label", "Close-up: Luxembourg and surroundings");
      await expect(page.getByTestId("inset-area")).toHaveCount(1);
    }
    await expectMapTextClear(page);
    // Each explored country's visible name carries one check badge (on the map or in the close-up).
    exploredCount++;
    await expect(page.locator("[data-explored-badge]")).toHaveCount(exploredCount);
  }
  // 5/5: a short celebration in the same one-line progress row.
  await expect(page.getByTestId("discover-progress")).toContainText("All explored! 5/5");
  const progressAfter = await progressBox();
  expect(Math.abs(progressAfter.height - progressBefore.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(progressAfter.y - progressBefore.y)).toBeLessThanOrEqual(1);
  const card = page.getByTestId("country-card");
  await expect(card.getByText("Eiffel Tower")).toBeVisible();
  // Artwork status is documented for developers, not shown to players.
  await expect(page.getByText(/Provisional/i)).toHaveCount(0);
  // Tapping a faded context country does nothing in Discover.
  await tapCountry(page, "CHE");
  await expect(card.getByRole("heading", { name: "France" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await shot(page, "discover-france");
  await checkArmenian(page, "discover-france");
  // Language change preserved the selection.
  await expect(card.getByRole("heading", { name: "France" })).toBeVisible();

  // One grouped zoom control: every button a comfortable touch target with a name.
  for (const button of await page.getByTestId("map-controls").getByRole("button").all()) {
    const b = (await button.boundingBox())!;
    expect(b.width).toBeGreaterThanOrEqual(44);
    expect(b.height).toBeGreaterThanOrEqual(44);
    expect(await button.getAttribute("aria-label")).toBeTruthy();
  }

  // Zoom controls change the map, and tapping still works while zoomed.
  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.waitForTimeout(400);
  await shot(page, "discover-zoomed");
  await page.getByRole("button", { name: "Show the whole map" }).click();
  await page.waitForTimeout(400);

  await page.getByRole("button", { name: "Start finding" }).click();

  // --- Find: five questions, each lesson country once --------------------
  const asked: string[] = [];
  for (let q = 0; q < 5; q++) {
    const target = await currentTarget(page);
    asked.push(target);
    await expect(page.getByTestId("find-progress")).toHaveText(`Question ${q + 1} of 5`);
    // Fresh question: no names, markers, badges, highlights or feedback on the map.
    expect(await mapLabels(page)).toEqual([]);
    await expect(page.locator("[data-explored-badge], [data-flash], [data-callout]")).toHaveCount(0);
    expect(await page.locator('[data-testid="map-main"] path[data-tone]:not([data-tone="default"])').count()).toBe(0);
    await expect(page.getByTestId("find-feedback")).toHaveCount(0);
    // The close-up must not name a country before it is answered: not in its
    // caption, accessible label or map.
    if (await page.getByTestId("inset-title").count()) {
      await expect(page.getByTestId("inset-title")).toHaveText("Close-up");
      await expect(page.getByTestId("map-inset")).toHaveAttribute("aria-label", "Close-up of the marked area");
      await expect(page.locator('[data-testid="map-inset"] text')).toHaveCount(0);
    }

    if (q === 0) {
      // A drag that starts on the target pans the map but does not answer.
      const p = await pointOnCountry(page, target === "LUX" ? "FRA" : target);
      if (test.info().project.use.hasTouch) {
        const cdp = await page.context().newCDPSession(page);
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: p.x, y: p.y }] });
        for (let i = 1; i <= 6; i++) {
          await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: p.x + i * 10, y: p.y + i * 6 }] });
        }
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      } else {
        await page.mouse.move(p.x, p.y);
        await page.mouse.down();
        await page.mouse.move(p.x + 60, p.y + 40, { steps: 6 });
        await page.mouse.up();
      }
      await page.waitForTimeout(200);
      await expect(page.getByTestId("find-feedback")).toHaveCount(0);
      await page.getByRole("button", { name: "Show the whole map" }).click();
      await page.waitForTimeout(400);

      // Wrong answer: identified, another attempt allowed.
      const wrong = target === "DEU" ? "FRA" : "DEU";
      await tapActive(page, wrong);
      await expect(page.getByTestId("find-feedback")).toContainText(wrong === "DEU" ? "That's Germany. Try again." : "That's France. Try again.");
      // Calm feedback: a brief outline on the tapped country, no movement of the map.
      await expect(page.locator(`[data-testid="map-main"] [data-flash="wrong"]`)).toHaveCount(1);
      expect(await mapLabels(page)).toEqual([wrong === "DEU" ? "Germany" : "France"]);
      await shot(page, "find-wrong");
      await checkArmenian(page, "find-wrong");
      // No landmark image or name before a hint allows it.
      await expect(page.getByTestId("landmark-image")).toHaveCount(0);
      await expect(page.getByTestId("panel")).not.toContainText(LANDMARKS[target]);
      // First hint: capital clue, plus the landmark in words (no image in Find).
      await page.getByRole("button", { name: "Hint" }).click();
      await expect(page.getByText(/Its capital is/)).toBeVisible();
      await expect(page.getByTestId("panel")).toContainText(new RegExp(LANDMARKS[target].split(" ").at(-1)!, "i"));
      await expect(page.getByTestId("landmark-image")).toHaveCount(0);
    }
    if (q === 1) {
      await page.getByRole("button", { name: "Hint" }).click();
      await page.getByRole("button", { name: "More help" }).click();
      await expect(page.getByText("Look inside the dashed circle.")).toBeVisible();
      await shot(page, "find-area-hint");
      await page.getByRole("button", { name: "Show me" }).click();
      await expect(page.locator(`[data-testid="map-main"] path[data-country="${target}"]`)).toHaveAttribute("data-tone", "reveal");
      await shot(page, "find-reveal");
    }
    if (q === 2) {
      // Home in the middle of a question keeps it exactly: the wrong tap, the hint, the question number.
      const wrong = target === "DEU" ? "FRA" : "DEU";
      await tapActive(page, wrong);
      await page.getByRole("button", { name: "Hint" }).click();
      // Home opens the continents, whose Continue resumes it at once, also after a refresh.
      await page.getByRole("button", { name: "Home" }).click();
      const main = page.getByTestId("continents-actions").getByRole("button");
      await expect(main).toHaveText(/^Continue/);
      await page.reload();
      await main.click();
      expect(await currentTarget(page)).toBe(target);
      await expect(page.getByTestId("find-progress")).toHaveText("Question 3 of 5");
      await expect(page.getByText(/Its capital is/)).toBeVisible();
      await expect(page.getByTestId("find-feedback")).toContainText("Try again.");
    }

    await tapActive(page, target);
    await expect(page.getByTestId("find-feedback")).toBeVisible();
    await expect(page.locator(`[data-testid="map-main"] path[data-country="${target}"]`)).toHaveAttribute("data-tone", "correct");
    await expect(page.locator(`[data-testid="map-main"] [data-flash="correct"]`)).toHaveCount(1);
    if (q === 3) {
      await expect(page.getByTestId("find-feedback")).toContainText("Correct!");
      await shot(page, "find-correct");
      // Refresh on a solved question keeps it solved and independent, without replaying the feedback.
      await page.reload();
      await expect(page.getByTestId("find-feedback")).toContainText("Correct!");
      await expect(page.locator("[data-flash]")).toHaveCount(0);
    }
    if (q < 4) await page.getByRole("button", { name: "Next" }).click();
  }
  expect(new Set(asked).size).toBe(5);

  // After the fifth answer: no round summary or second round, just an explicit way on to Travel.
  await expect(page.getByTestId("find-progress")).toHaveText("Question 5 of 5");
  await expect(page.getByRole("button", { name: "Next" })).toHaveCount(0);
  await expect(page.getByTestId("panel")).not.toContainText(/round/i);
  await shot(page, "find-done");
  await checkArmenian(page, "find-done");
  // Refresh mid-lesson resumes the same screen.
  await page.reload();
  await expect(page.getByTestId("find-progress")).toHaveText("Question 5 of 5");
  await page.getByRole("button", { name: "Continue to Travel" }).click();

  // --- Travel -------------------------------------------------------------
  const moves = () => page.locator('[data-testid^="move-"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")!.slice(5)).sort());
  await expect(page.getByTestId("crossings-left")).toHaveText("2 crossings left");
  expect(await moves()).toEqual(["BEL", "DEU", "LUX"]);
  expect((await mapLabels(page)).sort()).toEqual(["France", "Netherlands"]);
  // Focusing a card does not reveal anything on the map.
  await page.getByTestId("move-LUX").focus();
  expect((await mapLabels(page)).sort()).toEqual(["France", "Netherlands"]);
  await shot(page, "travel-start");
  await checkArmenian(page, "travel-start");

  // A longer route through real borders runs out of crossings.
  expect(await drawnRoute(page)).toBe("");
  const traveller = () => page.locator('[data-testid="map-main"] [data-traveller]').getAttribute("data-traveller");
  const newSegments = () => page.locator('[data-testid="map-main"] [data-route-new]').count();
  expect(await traveller()).toBe("FRA");
  await page.getByTestId("move-LUX").click();
  await expect(page.getByTestId("crossings-left")).toHaveText("1 crossing left");
  expect(await drawnRoute(page)).toBe("FRA,LUX");
  expect(await newSegments()).toBe(1);
  expect(await traveller()).toBe("LUX");
  expect(await moves()).toEqual(["BEL", "DEU", "FRA"]);
  const beforeUndoLabels = await allMapNames(page);
  await page.getByTestId("move-BEL").click();
  await expect(page.getByTestId("out-of-crossings")).toBeVisible();
  await expect(page.getByTestId("out-of-crossings")).toContainText("Each move crossed a real border");
  expect(await drawnRoute(page)).toBe("FRA,LUX,BEL");
  await shot(page, "travel-out-of-crossings");

  // Undo restores route, budget and map.
  await page.getByTestId("out-of-crossings").getByRole("button", { name: "Undo" }).click();
  await expect(page.getByTestId("crossings-left")).toHaveText("1 crossing left");
  expect(await moves()).toEqual(["BEL", "DEU", "FRA"]);
  expect(await allMapNames(page)).toEqual(beforeUndoLabels);
  await expect(page.locator('[data-testid="map-main"] path[data-country="BEL"]')).toHaveAttribute("data-tone", "default");
  await expect(page.getByText("Help used on this journey")).toBeVisible();
  // Undo removed the last segment of the drawn route; nothing animates, the traveller is back.
  expect(await drawnRoute(page)).toBe("FRA,LUX");
  expect(await newSegments()).toBe(0);
  expect(await traveller()).toBe("LUX");

  // Restart, then France → Belgium → Netherlands.
  await page.getByRole("button", { name: "Restart" }).click();
  await expect(page.getByTestId("crossings-left")).toHaveText("2 crossings left");
  expect(await drawnRoute(page)).toBe("");
  expect(await traveller()).toBe("FRA");
  await page.getByTestId("move-BEL").click();
  await page.getByTestId("move-NLD").click();
  await expect(page.getByRole("heading", { name: "Journey complete!" })).toBeVisible();
  await expect(page.getByTestId("result-route")).toHaveText(/France.*Belgium.*Netherlands/);
  expect(await drawnRoute(page)).toBe("FRA,BEL,NLD");
  // Capital → border crossing → capital → border crossing → capital.
  await expect(page.locator('[data-testid="map-main"] [data-testid="route-line"]')).toHaveAttribute("data-points", "5");
  // Arrival: the whole route glows once; the traveller stands at the destination's capital.
  await expect(page.locator('[data-testid="map-main"] [data-route-glow]')).toHaveCount(1);
  expect(await traveller()).toBe("NLD");
  await shot(page, "results-route-bel");
  await expect(page.getByTestId("result-crossings")).toHaveText(/Crossings used\s*2 of 2/);
  await expect(page.getByTestId("result-help")).toHaveText(/Help used\s*Undo/);
  await expect(page.getByTestId("badge")).toHaveCount(0);
  // Level 2 follows: Next level is the main action, naming it; nothing advances by itself.
  await expect(page.getByTestId("next-level")).toHaveAttribute("data-level", "around-the-alps");
  await expect(page.getByTestId("next-level")).toHaveAccessibleName("Next level: Level 2, Around the Alps");
  // Find: the five questions just played, two found first try without hints (hints on three).
  await expect(page.getByTestId("result-find")).toContainText("2/5");
  const findAnswers = page.getByTestId("result-find-answers").locator("li");
  await expect(findAnswers).toHaveCount(5);
  expect(await findAnswers.evaluateAll((els) => els.map((e) => e.getAttribute("data-country")))).toEqual(asked);
  await expect(findAnswers.filter({ hasText: "With help" })).toHaveCount(3);
  await expect(findAnswers.filter({ hasText: "First try" })).toHaveCount(2);

  // Replay: France → Germany → Netherlands without help earns the badge.
  await page.getByRole("button", { name: "Replay journey" }).click();
  await page.getByTestId("move-DEU").click();
  // Refresh mid-journey keeps the route and language.
  await setLanguage(page, "Հայերեն");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "hy");
  await expect(page).toHaveTitle("ԱրիՄապ — Բացահայտիր աշխարհը");
  await expect(page.getByTestId("crossings-left")).toHaveText("Մնաց 1 սահմանահատում");
  // Refreshed and in another language: the final state, with nothing replaying.
  await expect.poll(() => drawnRoute(page)).toBe("FRA,DEU");
  expect(await newSegments()).toBe(0);
  expect(await traveller()).toBe("DEU");
  await setLanguage(page, "English");
  expect(await newSegments()).toBe(0);
  await page.getByTestId("move-NLD").click();
  await expect(page.getByTestId("result-route")).toHaveText(/France.*Germany.*Netherlands/);
  expect(await drawnRoute(page)).toBe("FRA,DEU,NLD");
  await expect(page.getByTestId("badge")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await shot(page, "results-badge");
  await checkArmenian(page, "results-badge");

  // Hint during travel shows neighbour names and removes the badge.
  await page.getByRole("button", { name: "Replay journey" }).click();
  await page.getByRole("button", { name: "Hint" }).click();
  expect((await mapLabels(page)).sort()).toEqual(["Belgium", "France", "Germany", "Luxembourg", "Netherlands"]);
  await shot(page, "travel-hint");
  await page.getByTestId("move-BEL").click();
  expect((await mapLabels(page)).sort()).toEqual(["Belgium", "France", "Netherlands"]);
  await page.getByTestId("move-NLD").click();
  await expect(page.getByTestId("badge")).toHaveCount(0);
  await expect(page.getByTestId("result-help")).toHaveText(/Help used\s*Hint/);

  // Home → Europe shows completion and no accidental reset, and Level 2 unlocked;
  // Level 1, finished, keeps these results (and offers Play again, not Continue).
  await homeToEurope(page);
  const level1 = page.getByTestId("level-western-europe-1");
  await expect(level1.getByTestId("level-status")).toHaveText("Completed");
  await page.reload();
  await expect(level1.getByTestId("level-status")).toHaveText("Completed");
  await expect(page.getByTestId("level-around-the-alps").getByTestId("level-status")).toHaveText("Ready to play");
  await expect(page.getByTestId("welcome-actions").getByRole("button")).toHaveText(/^Start\s*Level 2 · Around the Alps$/);
  await shot(page, "welcome-complete");
  // Completed: a one-line summary for a returning player, opened to show its buttons. Its attempt is
  // finished (at its Results), so it offers Play again, which asks first, and no Continue; cancelling keeps it.
  await level1.getByTestId("level-details-toggle").click();
  await expect(level1.getByRole("button", { name: /^Continue/ })).toHaveCount(0);
  await level1.getByRole("button", { name: /^Play again/ }).click();
  await page.getByTestId("start-over-dialog").getByRole("button", { name: "Not now" }).click();
  await expect(level1.getByTestId("level-status")).toHaveText("Completed");
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem("arimap:state")!).levels["western-europe-1"]);
  expect(kept).toMatchObject({ stage: "results", records: { travelDone: true, lastFindScore: { independent: 2, total: 5 } } });

  expect(errors).toEqual([]);
});

test("phone panels scroll fully above pinned actions", async ({ page }) => {
  test.skip(test.info().project.name !== "small-phone", "Runs once, across several phone sizes.");
  const panel = page.getByTestId("panel");
  const toBottom = () => panel.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  const box = async (testId: string) => (await page.getByTestId(testId).boundingBox())!;

  for (const [width, height] of [
    [320, 568],
    [320, 640],
    [390, 664],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    for (const locale of ["en", "hy"]) {
      // Discover with every country selected in turn.
      await openWithSave(page, { version: 1, locale, screen: "lesson", lessons: { "western-europe-1": { started: true, stage: "discover" } } });
      await expect(page.locator('[data-testid="map-main"] path[data-country="FRA"]')).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      for (const id of ["FRA", "BEL", "NLD", "LUX", "DEU"]) {
        // The previous card was left scrolled to its end; the new one must start at its top.
        await tapActive(page, id);
        await expect(page.getByTestId("country-card")).toHaveAttribute("data-country", id);
        const image = page.getByTestId("landmark-image");
        await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
        expect(await panel.evaluate((el) => el.scrollTop), `${width}×${height} ${locale} ${id}: card opened scrolled`).toBe(0);
        // Level 1's art, the Adolphe Bridge (1.71:1) included, is under the wide-art threshold (2:1):
        // the square tile beside the name.
        await expect(page.getByTestId("landmark-card")).toHaveAttribute("data-shape", "ordinary");
        // Without scrolling: name, capital and the whole drawn artwork sit between the panel top and the pinned button.
        const where = `${width}×${height} ${locale} ${id}`;
        const top = (await panel.boundingBox())!.y;
        const fold = (await box("sticky-actions")).y;
        for (const part of [page.getByTestId("country-card").locator("h2"), page.getByTestId("country-capital")]) {
          const b = (await part.boundingBox())!;
          expect(b.y, `${where}: ${await part.textContent()} above the panel`).toBeGreaterThanOrEqual(top);
          expect(b.y + b.height, `${where}: ${await part.textContent()} under the button`).toBeLessThanOrEqual(fold + 1);
        }
        const drawn = await image.evaluate((img: HTMLImageElement) => {
          const r = img.getBoundingClientRect();
          const s = Math.min(r.width / img.naturalWidth, r.height / img.naturalHeight);
          const tile = img.closest("figure")!.querySelector("div")!.getBoundingClientRect();
          const left = r.left + (r.width - img.naturalWidth * s) / 2;
          return { top: r.top + (r.height - img.naturalHeight * s) / 2, bottom: r.top + (r.height + img.naturalHeight * s) / 2, width: img.naturalWidth * s, left, right: left + img.naturalWidth * s, tile: [tile.left, tile.right] };
        });
        expect(drawn.left, `${where}: art cut on the left`).toBeGreaterThanOrEqual(drawn.tile[0] - 0.5);
        expect(drawn.right, `${where}: art cut on the right`).toBeLessThanOrEqual(Math.min(drawn.tile[1], width) + 0.5);
        expect(drawn.top, `${where}: art above the panel`).toBeGreaterThanOrEqual(top);
        expect(drawn.bottom, `${where}: art under the button`).toBeLessThanOrEqual(fold + 1);
        expect(Math.max(drawn.width, drawn.bottom - drawn.top), `${where}: art too small`).toBeGreaterThanOrEqual(96);
        const art = await box("landmark-image");
        const caption = (await page.getByTestId("landmark-card").locator("figcaption").boundingBox())!;
        expect(art.y + art.height, `${where}: art overlaps text`).toBeLessThanOrEqual(caption.y + 1);
        await toBottom();
        const card = await box("country-card");
        const actions = await box("sticky-actions");
        const panelBox = (await panel.boundingBox())!;
        // At the end of the scroll, the whole card (artwork and text) sits above the pinned button.
        expect(card.y + card.height, `${width}×${height} ${locale} ${id}: card bottom`).toBeLessThanOrEqual(actions.y + 1);
        expect(actions.y + actions.height).toBeLessThanOrEqual(panelBox.y + panelBox.height + 1);
      }

      // Travel: Hint, Undo and Restart are reachable and not covered.
      await writeSave(page, {
        version: 1,
        locale,
        screen: "lesson",
        lessons: { "western-europe-1": { started: true, stage: "travel", travel: { missionId: "fra-to-nld", path: ["FRA", "LUX"] } } },
      });
      await expect(page.getByTestId("travel-tools")).toBeAttached();
      await toBottom();
      const tools = await box("travel-tools");
      const panelBox = (await panel.boundingBox())!;
      expect(tools.y + tools.height, `${width}×${height} ${locale}: tools visible`).toBeLessThanOrEqual(panelBox.y + panelBox.height + 1);
      for (const button of await page.getByTestId("travel-tools").getByRole("button").all()) {
        const b = (await button.boundingBox())!;
        const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest("button")?.textContent, [b.x + b.width / 2, b.y + b.height / 2]);
        expect(hit, `${width}×${height} ${locale}: button not covered`).toBe(await button.textContent());
      }
      // Undo is usable at this size and removes the last route segment.
      expect(await drawnRoute(page)).toBe("FRA,LUX");
      await page.getByTestId("travel-tools").getByRole("button").nth(1).click();
      expect(await drawnRoute(page)).toBe("");
    }
  }
});

test("Luxembourg's name stays close to Luxembourg on a 320px map", async ({ page }) => {
  test.skip(test.info().project.name !== "small-phone", "Runs once, at 320px.");
  const lesson = (selected: string | null) =>
    JSON.stringify({ version: 1, locale: "hy", screen: "lesson", lessons: { "western-europe-1": { started: true, stage: "discover", discover: { selected, explored: [] } } } });
  const insetOpen = async () => (await page.getByTestId("map-inset").count()) > 0;
  /** Where Luxembourg's name is: a main-map callout (with its leader length), the close-up, or nowhere. */
  const luxLabel = () =>
    page.evaluate(() => {
      const main = document.querySelector('[data-testid="map-main"] [data-callout="LUX"] line');
      const inset = document.querySelector('[data-testid="map-inset"] [data-callout="LUX"]');
      const inline = document.querySelector('[data-testid="map-main"] [data-label="LUX"]:not([data-callout])');
      const length = main ? Math.hypot(+main.getAttribute("x2")! - +main.getAttribute("x1")!, +main.getAttribute("y2")! - +main.getAttribute("y1")!) : 0;
      return { main: !!main, length, inset: !!inset, inline: !!inline };
    });
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/");
  for (const selected of [null, "FRA", "BEL", "NLD", "LUX", "DEU"]) {
    await writeSave(page, lesson(selected));
    await expect(page.locator('[data-testid="map-main"] path[data-country="FRA"]')).toBeVisible();
    for (const round of ["as opened", "toggled"]) {
      if (round === "toggled") await page.getByTestId("inset-toggle").click();
      const where = await luxLabel();
      const state = `${selected ?? "nothing"} selected, ${round}, close-up ${(await insetOpen()) ? "open" : "closed"}`;
      // Never twice, and never far away.
      expect(where.main && where.inset, `${state}: duplicate`).toBe(false);
      if (where.main) expect(where.length, `${state}: leader too long`).toBeLessThanOrEqual(32);
      // With the close-up open, the name is in it (never over Luxembourg itself).
      if (await insetOpen()) {
        expect(where.inset, `${state}: missing in close-up`).toBe(true);
        const pill = (await page.locator('[data-testid="map-inset"] [data-callout="LUX"] rect').boundingBox())!;
        const country = (await page.locator('[data-testid="map-inset"] path[data-country="LUX"]').boundingBox())!;
        const covers = pill.x < country.x + country.width - 4 && country.x + 4 < pill.x + pill.width && pill.y < country.y + country.height - 4 && country.y + 4 < pill.y + pill.height;
        expect(covers, `${state}: name covers Luxembourg`).toBe(false);
      } else if (round === "as opened") {
        // Closed as the map opened: the main map had room nearby.
        expect(where.main || where.inline, `${state}: missing`).toBe(true);
      }
      await expectMapTextClear(page);
    }
  }
  // A close-up the player closed stays closed while they keep exploring.
  await writeSave(page, lesson("BEL"));
  await expect(page.getByTestId("map-inset")).toHaveCount(1);
  await page.getByTestId("inset-toggle").click();
  await expect(page.getByTestId("map-inset")).toHaveCount(0);
  for (const id of ["NLD", "FRA", "BEL"]) {
    await tapCountry(page, id);
    await expect(page.getByTestId("country-card")).toHaveAttribute("data-country", id);
    await expect(page.getByTestId("map-inset")).toHaveCount(0);
  }
});

test("only Discover opens the close-up by itself; the traveller replaces Luxembourg's dot", async ({ page }) => {
  test.skip(test.info().project.name !== "small-phone", "Runs once, at 320px.");
  const save = (lesson: object) => writeSave(page, { version: 1, locale: "en", screen: "lesson", lessons: { "western-europe-1": lesson } });
  const closeUp = page.getByTestId("map-inset");
  await page.goto("/");

  // Find: a wrong answer, then Luxembourg as the answer, never open the close-up.
  const order = ["LUX", "FRA", "NLD", "BEL", "DEU"];
  await save({ started: true, stage: "find", find: { order, index: 0, question: { target: "LUX", wrongGuesses: [], hintLevel: 0, solved: false, feedback: null }, results: [], status: "asking" } });
  await expect(page.getByTestId("find-prompt")).toBeVisible();
  await expect(page.locator('[data-testid="map-main"] path[data-country="DEU"]')).toBeVisible();
  await tapCountry(page, "DEU");
  await expect(page.getByTestId("find-feedback")).toBeVisible();
  await expect(closeUp).toHaveCount(0);
  await tapCountry(page, "LUX");
  await expect(page.locator('[data-testid="map-main"] path[data-country="LUX"]')).toHaveAttribute("data-tone", "correct");
  await expect(closeUp).toHaveCount(0);
  await expectMapTextClear(page);

  // Travel, with and without reduced motion: moves never open the close-up, and
  // while the traveller stands in Luxembourg its pin replaces the callout's dot.
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    await page.emulateMedia({ reducedMotion });
    await save({ started: true, stage: "travel", travel: { missionId: "fra-to-nld", path: ["FRA"] } });
    await page.getByTestId("travel-tools").getByRole("button", { name: "Hint" }).click();
    const lux = page.locator('[data-testid="map-main"] [data-callout="LUX"]');
    const dot = lux.locator("[data-leader-dot]");
    const where = `reduced motion: ${reducedMotion}`;
    // Before arrival: the ordinary dot.
    await expect(dot, where).toHaveCount(1);
    await page.getByTestId("move-LUX").click();
    await expect(closeUp, where).toHaveCount(0);
    await expect(page.locator('[data-testid="map-main"] [data-traveller]')).toHaveAttribute("data-traveller", "LUX");
    // The pin stands on the real capital and the leader starts at its tip; no second dot.
    await expect(dot, where).toHaveCount(0);
    const [tip, start] = await Promise.all([
      page.locator('[data-testid="map-main"] [data-traveller]').getAttribute("transform"),
      lux.locator("line").evaluate((l) => [l.getAttribute("x1"), l.getAttribute("y1")].map(Number)),
    ]);
    const [tx, ty] = tip!.match(/translate\(([-\d.]+),([-\d.]+)\)/)!.slice(1).map(Number);
    expect(Math.hypot(tx - start[0], ty - start[1]), where).toBeLessThan(0.5);
    // A hand-off dot shows only until the pin lands (at once with reduced motion).
    await expect.poll(() => lux.locator("circle").evaluateAll((els) => els.filter((c) => getComputedStyle(c).opacity !== "0").length), { timeout: 2000 }).toBe(0);
    // Leaving Luxembourg restores the dot; Undo brings the traveller back and removes it again.
    await page.getByTestId("move-DEU").click();
    await expect(closeUp, where).toHaveCount(0);
    await expect(dot, where).toHaveCount(1);
    await page.getByTestId("out-of-crossings").getByRole("button", { name: "Undo" }).click();
    await expect(page.locator('[data-testid="map-main"] [data-traveller]')).toHaveAttribute("data-traveller", "LUX");
    await expect(dot, where).toHaveCount(0);
    await expect(closeUp, where).toHaveCount(0);
  }
  await page.emulateMedia({ reducedMotion: "no-preference" });

  // A Travel move doesn't open the close-up (800×500, where it starts closed): the
  // name takes the best clear spot on the main map, or is left out, never overprinted.
  // This size used to give a 784×202 map, cropped north and south, where Luxembourg's
  // name had no nearby spot after the move ([data-crowded]). Since short landscape
  // screens show the map beside the panel and no map is cropped to fill its width,
  // no size leaves it crowded in Travel (measured from 300×520 to 800×640, and with
  // 150% and 200% text on phones); the move must still leave the close-up closed.
  await page.setViewportSize({ width: 800, height: 500 });
  await save({ started: true, stage: "travel", travel: { missionId: "fra-to-nld", path: ["FRA", "BEL"] } });
  await expect(closeUp).toHaveCount(0);
  await page.getByTestId("move-LUX").click();
  await expect(page.locator('[data-testid="map-main"] [data-traveller]')).toHaveAttribute("data-traveller", "LUX");
  await page.waitForTimeout(300);
  await expect(closeUp).toHaveCount(0);
  await expectMapTextClear(page);
  await page.setViewportSize({ width: 320, height: 568 });

  // The close-up stays available: opened by hand in Travel, it stays open while moving.
  await save({ started: true, stage: "travel", travel: { missionId: "fra-to-nld", path: ["FRA"] } });
  await page.getByTestId("inset-toggle").click();
  await expect(closeUp).toHaveCount(1);
  await page.getByTestId("move-LUX").click();
  await expect(closeUp).toHaveCount(1);
  // Luxembourg's name is then in the close-up only, never on both maps.
  await expect(page.locator('[data-testid="map-main"] [data-callout="LUX"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="map-inset"] [data-callout="LUX"]')).toHaveCount(1);
});

test("reduced motion shows every map change in its final state", async ({ page }) => {
  test.skip(test.info().project.name !== "desktop", "Runs once.");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openWithSave(page, { version: 1, locale: "en", screen: "lesson", lessons: { "western-europe-1": { started: true, stage: "travel", travel: { missionId: "fra-to-nld", path: ["FRA"] } } } });
  await page.getByTestId("move-BEL").click();
  const animations = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('[data-testid="map-main"] *')]
        .map((el) => getComputedStyle(el).animationName)
        .filter((name) => name && name !== "none"),
    );
  expect(await animations()).toEqual([]);
  // The new segment is fully drawn and the traveller stands on Brussels straight away.
  const reveal = page.locator('[data-testid="map-main"] mask polyline');
  expect(await reveal.evaluate((el) => getComputedStyle(el).strokeDashoffset)).toMatch(/^0(px)?$/);
  expect(await page.locator('[data-testid="map-main"] [data-traveller] > g').evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  await page.getByTestId("move-NLD").click();
  await expect(page.getByRole("heading", { name: "Journey complete!" })).toBeVisible();
  expect(await animations()).toEqual([]);
});

test("a large country's name stays inside it when its label point is under the close-up", async ({ page }) => {
  test.skip(test.info().project.name !== "mobile", "Runs once, at 390px.");
  // Reproduces a failure: zoomed in on selected France with the close-up open,
  // France's label point lies under the close-up. Its name became a bottom-edge
  // callout over the close-up toggle, with its leader running behind the panel.
  await page.setViewportSize({ width: 390, height: 844 });
  await openWithSave(page, { version: 1, locale: "en", screen: "lesson", lessons: { "western-europe-1": { started: true, stage: "discover", discover: { selected: "FRA", explored: ["FRA"] } } } });
  await expect(page.locator('[data-testid="map-main"] path[data-country="FRA"]')).toBeVisible();
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: "Zoom in" }).click();
    await page.waitForTimeout(400);
  }
  if ((await page.getByTestId("map-inset").count()) === 0) await page.getByTestId("inset-toggle").click();
  await expect(page.getByTestId("map-inset")).toBeVisible();

  // The close-up's footprint reaches the label layout one frame after it opens, so poll.
  const state = async () => {
    const result = await page.evaluate(() => {
      const svg = document.querySelector('[data-testid="map-main"]')!;
      const g = svg.querySelector('[data-label="FRA"]');
      const text = g?.querySelector("text");
      const r = (el: Element) => el.getBoundingClientRect();
      const hit = (a: DOMRect, b: DOMRect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      const closeUp = r(document.querySelector('[data-testid="inset-toggle"]')!.parentElement!);
      const controls = r(document.querySelector('[data-testid="map-controls"]')!);
      const box = text ? r(text) : null;
      // Leader lines on the main map, sampled, must stay out of the close-up and controls.
      const m = r(svg);
      const leaderThroughChrome = [...svg.querySelectorAll("[data-callout] line")].some((line) => {
        const [x1, y1, x2, y2] = ["x1", "y1", "x2", "y2"].map((k) => +line.getAttribute(k)!);
        return Array.from({ length: 31 }, (_, s) => [m.left + x1 + ((x2 - x1) * s) / 30, m.top + y1 + ((y2 - y1) * s) / 30]).some(([x, y]) =>
          [closeUp, controls].some((c) => x > c.left + 1 && x < c.right - 1 && y > c.top + 1 && y < c.bottom - 1),
        );
      });
      // What lies under the middle of the name (texts don't take pointer events).
      const under = box ? document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)?.closest("[data-country]")?.getAttribute("data-country") : null;
      return {
        shown: !!text,
        callout: g?.hasAttribute("data-callout") ?? false,
        overChrome: box ? hit(box, closeUp) || hit(box, controls) : false,
        under,
        leaderThroughChrome,
        luxInCloseUp: !!document.querySelector('[data-testid="map-inset"] [data-callout="LUX"]'),
      };
    });
    return result;
  };
  const expected = { shown: true, callout: false, overChrome: false, under: "FRA", leaderThroughChrome: false, luxInCloseUp: true };
  await expect.poll(state, { message: "English" }).toEqual(expected);
  await setLanguage(page, "Հայերեն");
  await expect.poll(state, { message: "Armenian" }).toEqual(expected);
});

test("malformed saved data falls back safely", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openWithSave(page, '{"version":1,"locale":"hy","screen":"lesson","lessons":{"western-europe-1":{"started":true,"stage":"travel","travel":{"missionId":"fra-to-nld","path":["FRA","NLD"]}}}}');
  // Invalid journey is dropped; language kept; lesson resumes at Discover.
  await expect(page.locator("html")).toHaveAttribute("lang", "hy");
  await expect(page.getByRole("heading", { name: "Հպիր երկրին՝ դրա մասին իմանալու համար։" })).toBeVisible();
  await writeSave(page, "garbage{");
  await expect(page.getByRole("heading", { name: "AriMap" })).toBeVisible();
  expect(errors).toEqual([]);
});
