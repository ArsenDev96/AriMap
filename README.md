# AriMap · ԱրիՄապ

*Discover the world.* · *Բացահայտիր աշխարհը*

A mobile-first geography learning game. This is the first playable prototype: one lesson (France, Belgium, the Netherlands, Luxembourg and Germany) in English and Eastern Armenian.

**Flow:** Welcome → Discover → Find (2 rounds) → Travel → Results

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
  content/                 country data (names, in-sentence forms, capitals, hints, landmarks)
  lessons/                 lesson definitions (countries, border graph, rounds, mission, inset)
  game/graph.ts            border graph validation + BFS shortest paths
  game/find.ts             Find rules: round orders, guesses, hints, assisted vs independent
  game/travel.ts           Travel rules: BFS budget, moves, undo, restart, hint
  lesson/progress.ts       lesson state machine (reducer) and achievements
  lesson/mapView.ts        what the map may show per stage (tones, labels, markers, route)
  progress/appState.ts     app reducer (language, screen, lessons)
  progress/storage.ts      versioned save format, defensive parsing, storage adapter
src/geo/regionMap.ts       d3-geo projection, projected shapes, fit transforms, view limits
src/geo/route.ts           Travel route line through shared-border crossings
src/data/geo/              prepared Natural Earth TopoJSON (see docs/DATA.md)
src/components/            React UI (screens, panels, SVG map, zoom, inset)
scripts/prepare-geo.mjs    reproducible map-data preparation
scripts/prepare-landmarks.mjs  landmark display copies (trimmed, resized)
src/assets/landmarks/      landmark display copies (see docs/CONTENT.md)
e2e/                       Playwright end-to-end test
```

To add a lesson, add country entries to `src/core/content/countries.ts` and a `LessonDefinition` in `src/core/lessons/`, then register it in `src/core/lessons/index.ts`. The test in `src/geo/regionMap.test.ts` checks every lesson's border graph against the map data.

## Saved progress

Progress is saved in `localStorage` under `arimap:state` (version 1). The saved state includes the language, the current screen and activity, the Find session with hint and attempt state, the in-progress journey with its assistance flags, and completion records. On load, the data is validated. Budgets, statuses and "independent" flags are recomputed from game rules rather than trusted. Malformed parts are dropped, and an unknown version keeps only the language.

## Data and artwork

- Map: Natural Earth 1:10m Admin 0 Countries v5.1.1 (public domain). See [docs/DATA.md](docs/DATA.md).
- Alpine relief (Discover): terrain tiles by Mapzen. Europe terrain data produced using Copernicus data and information funded by the European Union - EU-DEM layers; Austria terrain data © offene Daten Österreichs – Digitales Geländemodell (DGM) Österreich; SRTM and GMTED2010 terrain data courtesy of the U.S. Geological Survey. Range extent from Natural Earth (public domain). See [docs/TERRAIN.md](docs/TERRAIN.md).
- Landmark illustrations: five **AI-generated stylised illustrations** (not photographs). The originals are in `public/images/landmarks/`; trimmed display copies made by `scripts/prepare-landmarks.mjs` are in `src/assets/landmarks/`. Provenance, image mapping, and sources for landmark facts and locations are in [docs/CONTENT.md](docs/CONTENT.md). The player interface shows no provenance notice.
- Fonts: Nunito (Latin) and Noto Sans Armenian, self-hosted at build time via `next/font` (both SIL Open Font License).
