# AriMap · ԱրիՄապ

*Discover the world.* · *Բացահայտիր աշխարհը*

A mobile-first geography learning game in English and Eastern Armenian, with five levels of five countries each:

| # | Level | Countries | State |
|---|---|---|---|
| 1 | France and its neighbours | France, Belgium, Netherlands, Luxembourg, Germany | Playable |
| 2 | Around the Alps | France, Switzerland, Germany, Austria, Italy | Playable, unlocked by completing Level 1 |
| 3 | Central Europe | Germany, Poland, Czechia, Slovakia, Austria | Playable, unlocked by completing Level 2 |
| 4 | Along the Adriatic | Italy, Slovenia, Croatia, Bosnia and Herzegovina, Montenegro | Playable, unlocked by completing Level 3 (Slovenia, Croatia, Bosnia and Herzegovina and Montenegro's landmark illustrations not supplied yet: shown as text; prompts in docs/CONTENT.md) |
| 5 | Towards Greece | Hungary, Romania, Serbia, Bulgaria, Greece | Coming soon (metadata only) |

**Flow:** Level selection → Discover → Find (five questions, one per country) → Travel → Results. Each level card shows its number, name, countries and status in words (Ready to play, In progress: *step*, Completed, Locked, Coming soon) as well as colour and an icon. Locked and coming-soon cards have no buttons. A playable card offers Start, or Continue and Start over (Play again once completed). Start and Continue open the level at once; Start over, and Play again whenever it would clear a saved place (the last Results or a replay under way), ask first, naming the level. Cancelling changes nothing, and confirming changes only that level's place, never its completion, the levels it unlocked or any other level. The main action at the bottom continues the most recently active unfinished level, or starts the next level not yet started. Home (in the level header) returns to the level selection with progress kept. The level header keeps Home, the three steps and the language switch on one row while the steps have room; on a 320 px phone in Armenian, whose "Home" is longer, Home drops its icon (keeping its name) to stay on one row; with less room the steps move to a row of their own.

**Travel's neighbour cards** show each name beside its arrow, with a 10 px gap that the name never crosses. They sit in two columns only when every card fits half the row with its name on one line. The panel measures this in a hidden copy of the cards, in the loaded font and language at the current text size, and measures again when any of those or the width changes. Otherwise they sit in one column. Names are never shortened, clipped or shrunk: they wrap between words, and a word breaks only if it is wider than the whole row (possible only with very large text).

**Returning players** (any level started): the introduction gives way to the levels. AriMap, the tagline and the language switch share one row in a header above the scrolling list, so they stay in view however far it scrolls; the main action has its own area below it. On a screen short for its text (under 32 lines of it, such as a 568 px-high phone at 150% text) that header drops the mark and tagline and keeps the name and the language switch, on one row where they fit (at 200% on a 320 px phone the Armenian name and the switch take two), so it takes no more of the list than it must. Only the list scrolls: the page itself never does, even when a script or the browser brings a card into view. The artwork is a slim ribbon at the top of the list, left out on screens under 700 px high. The card the main action opens is ringed and marked "Up next". Its number, name and status are in view on arrival: when completed levels above it would push its status under the action area (a 320×568 phone with Levels 1 and 2 completed), only the list starts scrolled, just enough to show it (with very large text, at least its whole title), set before the first paint. The page never scrolls and the focus doesn't move; a position the player scrolls to is kept across language changes. Completed levels are one line (number, status, name) that opens to show their details, Continue and Play again. A card's title sits beside its number badge while every word of it (and of a completed card's status) fits there; when one doesn't (enlarged text on a phone), the badge and number (and a completed card's chevron, then its status) go above the title, which takes the card's whole width. This is measured in the title as laid out, in its language and loaded font, and again when the width, text size, language or fonts change, so the usual layout stays wherever it fits. Titles wrap between words; a word breaks only if it is wider than the whole card (at 200% on a 320 px phone, some Armenian words are). The five levels stay in numerical order. With enlarged text, the main action shows only the level's number, so the levels keep room to scroll.

## Run it

Requires Node.js 20.9+ (developed on Node 22).

```bash
npm install
npm run dev          # http://localhost:3000
```

Production build:

```bash
npm run build
npm start
```

## Checks

```bash
npm run typecheck    # TypeScript
npm run lint         # ESLint (next/core-web-vitals + typescript)
npm test             # Vitest: game rules, persistence, translations, map data
npm run build        # stop any running `next start` first
npx playwright install chromium   # once
npm run test:e2e     # Playwright: full flow on Pixel 7, 320px phone and desktop
```

`test:e2e` builds the current source into a separate `.next-e2e/` folder and serves it on port 3100 (`NEXT_DIST_DIR`, see `playwright.config.ts`). Tests therefore always run against the current code, and they never rebuild the `.next/` folder that your own `npm run start` is serving. Port 3100 must be free; an existing server there is not reused. Screenshots of every screen in both languages are written to `screenshots/`.

`npm run start` serves the build that existed when it started. After changing code or pulling changes, stop it (Ctrl+C) and run `npm run build` and then `npm run start` again. `npm run dev` picks up changes by itself.

To open the dev server from another device (e.g. `http://192.168.x.x:3000` on a phone), add that address to `allowedDevOrigins` in `next.config.ts`. Next.js 16 blocks cross-origin access to development resources by default, and the app then stays on its loading screen. `npm run start` has no such restriction.

## Structure

Lesson content, translations, game rules and progress logic are plain TypeScript with no React or DOM dependency, so a future native app can reuse them.

```
src/core/                  framework-independent
  i18n/                    locales, EN + HY message catalogs, translate()
  content/                 country data (names, in-sentence forms, capitals, hints, landmarks);
                           names.ts: names only, for the countries of levels not playable yet
  lessons/                 levels.ts (the five levels: ids, names, countries, unlocks) and each playable
                           level's definition (border graph, mission, map settings: coverage, close-up, route)
  game/graph.ts            border graph validation + BFS shortest paths
  game/find.ts             Find rules: question order, guesses, hints, assisted vs independent
  game/travel.ts           Travel rules: BFS budget, moves, undo, restart, hint
  lesson/progress.ts       lesson state machine (reducer) and achievements
  lesson/mapView.ts        what the map may show per stage (tones, labels, markers, route)
  progress/appState.ts     app reducer (language, screen, levels), level status, unlocks, main action
  progress/storage.ts      versioned save format, defensive parsing, storage adapter
src/geo/regionMap.ts       d3-geo projection, projected shapes, fit transforms, view limits
src/geo/route.ts           Travel route line through shared-border crossings
src/data/geo/              prepared Natural Earth TopoJSON (see docs/DATA.md)
src/components/            React UI (screens, panels, SVG map, zoom, inset)
scripts/prepare-geo.mjs    reproducible map-data preparation
scripts/prepare-landmarks.mjs  landmark display copies (trimmed, resized)
scripts/generate-relief.mjs    map relief and forests from elevation and land-cover data (see docs/TERRAIN.md)
public/relief/             zoomed landscape tiles, loaded only when needed
src/assets/landmarks/      landmark display copies (see docs/CONTENT.md)
e2e/                       Playwright end-to-end tests
```

To make a coming-soon level playable: add its countries' content to `src/core/content/countries.ts` (and remove them from `names.ts`), write a `LessonDefinition` (see `src/core/lessons/alps.ts`) and set it as the level's `lesson` in `src/core/lessons/levels.ts`. Then add the level to `LEVEL_AREAS` in `scripts/generate-relief.mjs` and rerun it. The tests check the new level's border graph against the map data, its route crossings, its coverage against the prepared data, and that the relief covers it; the level stays "Coming soon" until `lesson` is set. Level 5 will also need a larger map-data clip box (it reaches Greece and the Black Sea), and possibly a projection of their own (see docs/DATA.md, "Level 5"). Level 4 needed neither; its route over the Pelješac Bridge (a fixed link inside Croatia, past Bosnia and Herzegovina's coast at Neum) is described in docs/DATA.md, "Level 4".

## Saved progress

Progress is saved in `localStorage` under `arimap:state`, version 2:

- the language;
- the screen, and the level being played or last played (`levelId`, kept by Home);
- `recent`: the levels in the order they were last active, which chooses what the main Continue opens;
- `levels`: each level's own progress, by its stable id. This is the Discover selection and explored countries, the Find session with hints and attempts, the journey with its assistance flags, the last result, and completion records.

On load everything is validated, level by level: budgets, statuses and "independent" flags are recomputed from game rules rather than trusted, and malformed parts are dropped without touching other levels. A level opens only if it is playable and unlocked. Level 2 unlocks once Level 1's journey has been finished (`records.travelDone`), Level 3 once Level 2's has, and Level 4 once Level 3's has; records are never cleared, so starting over or replaying never locks them again. The unlock is derived from those records when a save is read, so a save from before Level 3 (or Level 4) was playable, with the level before it completed, opens it with no migration: the save format is unchanged.

"Start over" (or "Play again" for a completed level) discards that level's current place (Discover selection, Find session, journey) but keeps its completion records. It asks first and changes no other level. "Replay journey" changes only that level's Travel.

### Saves from before there were levels (version 1)

A version 1 save held one level: `lessonId` and `lessons["western-europe-1"]`. It is read as Level 1's progress, which it always was. Level 1 keeps the id `western-europe-1`. The player resumes at the same place and stage, in the same language. A completed old save shows Level 1 as completed and Level 2 unlocked. Before the first save in the new format replaces it, the old save is copied to `arimap:state:backup`. A save from an unknown (newer) version keeps only the language, and is also copied there, so it is never silently lost.

### Saves from the two-round Find

Find used to ask each country twice, in two rounds with a summary after each. It now asks five questions, each country once. The save format keeps version 1 (the parser tells the two Find formats apart by their fields), and saves from the two-round Find are converted on load (`migrateLegacyFind` in `src/core/progress/storage.ts`). Only their first round is kept:

| Where the old save was | Where it resumes |
| --- | --- |
| First round, mid-question | The same question, with its wrong taps and hints, and the answers so far |
| First round's summary | The fifth answer, with "Continue to Travel" |
| Second round, or its summary | The first round, all five answered, as the completed Find: its fifth answer, with "Continue to Travel". Second-round answers are dropped. |
| Travel or Results after both rounds | Unchanged, with the Find scored from the first round |

Old Find scores were out of ten. A score is now always out of the lesson's five countries: an old score is replaced by one computed from the saved first round when the old Find had been finished (the player had moved on to Travel), and otherwise dropped (the Find step stays done; finishing the converted Find sets a new score). An inconsistent old session is dropped like any other malformed data, and the lesson resumes at Discover.

## Data and artwork

- Map: Natural Earth 1:10m Admin 0 Countries v5.1.1 (public domain). See [docs/DATA.md](docs/DATA.md).
- Relief: Terrain Tiles by Mapzen, from the Registry of Open Data on AWS. SRTM and GMTED2010 terrain data courtesy of the U.S. Geological Survey. Global ETOPO1 terrain data U.S. National Oceanic and Atmospheric Administration. These credits are also shown in the app ("About the map"). See [docs/TERRAIN.md](docs/TERRAIN.md).
- Forests: © ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium (CC BY 4.0; Zanaga et al., 2022, ESA WorldCover 10 m 2021 v200, doi:10.5281/zenodo.7254221). Also shown in "About the map".
- Landmark illustrations: eleven **AI-generated stylised illustrations** (not photographs), one per landmark of Levels 1–3 (Italy's Colosseum is reused in Level 4; Level 4's four new landmarks have none yet). The originals are in `public/images/landmarks/`; trimmed display copies made by `scripts/prepare-landmarks.mjs` are in `src/assets/landmarks/`. Provenance, image mapping, and sources for landmark facts and locations are in [docs/CONTENT.md](docs/CONTENT.md). The player interface shows no provenance notice.
- Fonts: Nunito (Latin) and Noto Sans Armenian, self-hosted at build time via `next/font` (both SIL Open Font License). The font stack is set in `globals.css` (`--font`): Nunito, a Latin-only stand-in with Nunito's proportions while it loads, then Noto Sans Armenian and its own stand-in. Not next/font's `--font-latin`, whose stand-in (local Arial) has Armenian letters on Windows and so took Armenian text before Noto Sans Armenian could; `e2e/phone-layout.spec.ts` checks which font each script is drawn in.
