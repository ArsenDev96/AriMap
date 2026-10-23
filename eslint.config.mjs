import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    // Separate build folder used by the end-to-end tests (playwright.config.ts).
    ".next-e2e/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The native app (Expo) has its own ESLint config and runs it itself (apps/mobile, `npm run lint`).
    "apps/**",
  ]),
]);

export default eslintConfig;
