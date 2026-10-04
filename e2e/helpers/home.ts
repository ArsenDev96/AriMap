import { expect, type Page } from "@playwright/test";

/*
 * Home in a level opens the continents (ContinentScreen); a level's Start over, Play again and
 * its own Continue are on its continent's level selection, one more tap away. Specs written
 * before continents existed, which went from a level straight back to the level selection, use
 * this for that same path: Home, then Europe.
 */
export async function homeToEurope(page: Page) {
  await page.getByTestId("home").click();
  await expect(page.getByTestId("continents")).toBeVisible();
  await page.getByTestId("explore-europe").click();
  await expect(page.getByTestId("welcome")).toBeVisible();
}
