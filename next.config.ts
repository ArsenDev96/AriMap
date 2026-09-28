import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // End-to-end tests build into their own folder (NEXT_DIST_DIR, see
  // playwright.config.ts), so a test run never rebuilds the .next folder that a
  // running `npm run start` serves. Only set when requested: in Next 16 even an
  // explicit distDir of ".next" breaks `next dev` routing (every page 404s).
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  // Zoomed relief tiles (public/relief/<content hash>/…) never change at a
  // given path: scripts/generate-relief.mjs writes a new folder when they do.
  async headers() {
    return [{ source: "/relief/:version/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] }];
  },
};

export default nextConfig;
