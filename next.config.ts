import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // End-to-end tests build into their own folder (NEXT_DIST_DIR, see
  // playwright.config.ts), so a test run never rebuilds the .next folder that a
  // running `npm run start` serves. Only set when requested: in Next 16 even an
  // explicit distDir of ".next" breaks `next dev` routing (every page 404s).
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
};

export default nextConfig;
