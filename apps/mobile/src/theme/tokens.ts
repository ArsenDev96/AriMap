/**
 * The website's "colourful travel notebook" palette (src/app/globals.css), with the same names and values, so both
 * apps look like one. The website has no dark theme, so neither does the app (app.json: userInterfaceStyle "light").
 */
export const colors = {
  bg: "#fffaf0",
  surface: "#fffdf8",
  surfaceWarm: "#fff1e2",
  ink: "#1f3a5f",
  inkSoft: "#52627f",
  line: "#efe2cb",
  peach: "#ffe4d1",
  skySoft: "#e3f2fc",
  mintSoft: "#e0f4ea",

  discover: "#149486",
  discoverInk: "#0d6f65",
  discoverSoft: "#daf3ed",
  find: "#f2b233",
  findInk: "#7a4f00",
  findSoft: "#fff0c8",
  travel: "#3592d2",
  travelInk: "#15609a",
  travelSoft: "#e0f0fc",

  coral: "#e85b45",
  coralSoft: "#ffe1da",
  /** Button fill: white text on it meets WCAG AA (4.97:1) at body sizes. */
  coralStrong: "#c93f2a",
  coralStrongPressed: "#ad3420",

  sea: "#8fd8d6",
  land: "#c4ecd2",
  landBorder: "#2d5a66",
  context: "#ece6d7",
  contextBorder: "#c6bba3",
  teal: "#149486",
  tealDark: "#0d6f65",
  amber: "#ffbb45",
  amberDark: "#c07d05",
  white: "#ffffff",
} as const;

/** The home map's colours, by WORLD_REGIONS key (the website's ContinentScreen.module.css). */
export const worldColors = {
  water: "#2cbbe9",
  europe: "#44c95b",
  europeInk: "#17643a",
  asia: "#f8a965",
  africa: "#f5cd47",
  "north-america": "#68a5f3",
  "south-america": "#f27aa5",
  oceania: "#c7b8f2",
  antarctica: "#f3f8fc",
} as const;

/** Spacing steps in density-independent pixels. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 12, md: 18, pill: 999 } as const;

/** The smallest touch target (the website's --tap; Android's guideline is 48dp too). */
export const TAP = 48;

/**
 * Type sizes. Text follows the system font size setting (allowFontScaling is never turned off), so these are the
 * sizes at the default setting; layouts give text room to grow rather than fixed heights.
 */
export const type = {
  title: { fontSize: 26, lineHeight: 32, fontWeight: "800" },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: "800" },
  body: { fontSize: 16, lineHeight: 22, fontWeight: "400" },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: "700" },
  small: { fontSize: 14, lineHeight: 19, fontWeight: "400" },
} as const;
