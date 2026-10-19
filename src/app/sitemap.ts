import type { MetadataRoute } from "next";
import { CANONICAL_URL } from "@/core/site";

// Only real, public pages: levels, lessons, languages and the leaderboard are screens of the one page, not URLs.
// No lastModified: there is no meaningful content-change date, and the build time would be a false one.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: CANONICAL_URL }];
}
