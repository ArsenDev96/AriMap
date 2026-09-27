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
  ],
});
