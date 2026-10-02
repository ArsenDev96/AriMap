import type { Page } from "@playwright/test";

/*
 * Writing a saved state for a test to open.
 *
 * The game saves the state it loaded once it has mounted: one write of "arimap:state", a few
 * milliseconds after the splash has gone (and after the page looks ready). A save a test writes
 * before then is overwritten by the one the page opened with. So each page counts the game's
 * writes from before its own scripts run, and a test waits for that first write, on the page
 * it is about to write to, before writing its own.
 *
 * The count wraps Storage.prototype.setItem and calls the real one first, unchanged: the same
 * arguments and `this`, its return value, and any error (storage full or blocked) thrown before
 * anything is counted. Only localStorage writes of the game's key are counted.
 */

export const SAVE_KEY = "arimap:state";

type Counted = { __arimapGameSaves?: number };

const counting = new WeakSet<Page>();

/** Counts the game's saves on every document this page loads from now on. Once per page. */
export async function countGameSaves(page: Page) {
  if (counting.has(page)) return;
  counting.add(page);
  await page.addInitScript((key) => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (this: Storage, k: string, value: string) {
      const result = setItem.call(this, k, value);
      if (k === key && this === window.localStorage) (window as Counted).__arimapGameSaves = ((window as Counted).__arimapGameSaves ?? 0) + 1;
      return result;
    };
  }, SAVE_KEY);
}

/** Waits for the game's first save on the page's current document: the one it makes as it mounts. */
export async function gameSaved(page: Page) {
  if (!counting.has(page)) throw new Error("gameSaved: call countGameSaves(page) before the page loads");
  await page.waitForFunction(() => ((window as Counted).__arimapGameSaves ?? 0) > 0);
}

/**
 * Replaces the save on the page's current document once the game has made its own, then
 * reloads so the game opens it. A string is written as it is (e.g. malformed data).
 */
export async function writeSave(page: Page, save: object | string) {
  await gameSaved(page);
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [SAVE_KEY, typeof save === "string" ? save : JSON.stringify(save)] as const);
  await page.reload();
}

/** Opens the app and replaces its save (see writeSave), then reloads into it. */
export async function openWithSave(page: Page, save: object | string) {
  await countGameSaves(page);
  await page.goto("/");
  await writeSave(page, save);
}
