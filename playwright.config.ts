import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
/** Separate build folder: tests always run the current code and never touch .next. */
const DIST_DIR = ".next-e2e";

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { baseURL: `http://localhost:${PORT}` },
  webServer: {
    // Builds the current source first, so a stale build or an old server can't be tested by mistake.
    command: `npx next build && npx next start -p ${PORT}`,
    env: { NEXT_DIST_DIR: DIST_DIR },
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 300_000,
  },
  projects: [
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], browserName: "chromium" },
    },
    {
      name: "small-phone",
      use: { browserName: "chromium", viewport: { width: 320, height: 640 }, hasTouch: true, isMobile: true },
    },
    {
      name: "desktop",
      use: { browserName: "chromium", viewport: { width: 1366, height: 800 } },
    },
    {
      // Safari's engine, as Playwright ships it (a Windows WebKit build with iPhone 12 emulation:
      // viewport, touch, pixel ratio and user agent), not a physical iPhone. Limited to the phone
      // layout checks (and Level 5's, which skips its other tests here). This build lays text out at the weight asked for (widths match Chromium's
      // exactly) but paints variable fonts at their default instance, so its screenshots show
      // Nunito ExtraLight and Noto Sans Armenian Regular, thin and widely spaced, whatever the
      // weight. Its measurements hold; its typography in screenshots does not show Safari's.
      name: "webkit-phone",
      testMatch: /(phone-layout|level5).spec.ts/,
      use: { ...devices["iPhone 12"] },
    },
  ],
});
