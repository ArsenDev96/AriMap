import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests of the app's own framework-independent code (its map's camera, gestures, picking and labels, the level cards'
// actions, and the lesson played through the shared game rules). Run with the repository's Vitest (`npm test` here):
// the app never bundles it, and EAS never uploads tests (/.easignore).
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("../../src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
