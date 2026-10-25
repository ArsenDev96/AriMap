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

/**
 * The lesson map's palette (the website's RegionMap.module.css): its sea, land and borders, the countries' tones as
 * the game marks them (buildMapView's CountryTone), names, markers and the route.
 */
export const mapColors = {
  sea: "#b3e2de",
  land: "#d3efdc",
  landBorder: "#4a7c85",
  context: "#f0ebdf",
  contextBorder: "#dcd2bf",
  coast: "rgba(38, 124, 131, 0.3)",
  label: "#1f3a5f",
  labelHalo: "rgba(255, 255, 255, 0.78)",
  labelOnDark: "#ffffff",
  labelOnDarkHalo: "rgba(9, 74, 67, 0.55)",
  labelDestination: "#5c3900",
  labelDestinationHalo: "rgba(255, 236, 196, 0.8)",
  /** Selected (Discover), correct (Find) and visited (Travel). */
  teal: "#149486",
  /** The traveller's country, and the correct-answer outline. */
  tealDark: "#0d6f65",
  wrong: "#f6b3a6",
  amber: "#ffbb45",
  amberDark: "#c07d05",
  coral: "#e85b45",
  route: "#1f3a5f",
  hintFill: "rgba(255, 187, 69, 0.18)",
  /** A small-country ring (the Quick Challenge's): a light halo, and a faint inside. */
  ringHalo: "rgba(255, 255, 255, 0.9)",
  ringFill: "rgba(255, 255, 255, 0.22)",
  pinShadow: "rgba(31, 58, 95, 0.25)",
  markerRing: "rgba(31, 58, 95, 0.45)",
  control: "#fffaf3",
  controlBorder: "rgba(31, 58, 95, 0.16)",
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
