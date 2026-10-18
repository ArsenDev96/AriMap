/**
 * AriMap's canonical website (the owner's, 2026-10-18; before it, https://ari-map.vercel.app): the address that is
 * shared (links, the result card and its QR code), the canonical URL every deployment declares (src/app/layout.tsx),
 * and the one host analytics may send from (src/web/analytics.ts).
 *
 * Framework-independent: no React, DOM, storage or network.
 */
export const SITE_URL = "https://arimap.world";

/** The address as printed: no scheme, no trailing slash. */
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");

/** The home page's canonical URL. */
export const CANONICAL_URL = `${SITE_URL}/`;
