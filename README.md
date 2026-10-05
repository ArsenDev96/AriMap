# AriMap · ԱրիՄապ

*Discover the world.* · *Բացահայտիր աշխարհը*

A mobile-first geography learning game in English and Eastern Armenian. Players choose a continent first: Europe has eight levels of five countries each; Asia, Africa, North America and South America are coming soon.

| # | Level | Countries | State |
|---|---|---|---|
| 1 | France and its neighbours | France, Belgium, Netherlands, Luxembourg, Germany | Playable |
| 2 | Around the Alps | France, Switzerland, Germany, Austria, Italy | Playable, unlocked by completing Level 1 |
| 3 | Central Europe | Germany, Poland, Czechia, Slovakia, Austria | Playable, unlocked by completing Level 2 |
| 4 | Along the Adriatic | Italy, Slovenia, Croatia, Bosnia and Herzegovina, Montenegro | Playable, unlocked by completing Level 3 |
| 5 | Towards Greece | Hungary, Romania, Serbia, Bulgaria, Greece | Playable, unlocked by completing Level 4 |
| 6 | Baltic Journey | Germany, Poland, Lithuania, Latvia, Estonia | Playable, unlocked by completing Level 5 |
| 7 | Iberian Journey | Portugal, Spain, Andorra, France, Italy | Playable, unlocked by completing Level 6 |
| 8 | Eastern Europe | Poland, Belarus, Ukraine, Moldova, Romania | Playable, unlocked by completing Level 7 |

Once all eight are completed, the level selection says so in a short message where the main action was (“You've completed all 8 levels! Play any of them again whenever you like.”), and every level stays open to Continue or Play again. Nothing is reset, and no further level is offered. (A level without content would still show as Coming soon; none is left.)

**Continents** (the home screen): a world map, whole on every screen and never stretched or cropped: very pale turquoise water, each continent in its own light, warm colour (mint Europe, peach Asia, yellow Africa, powder-blue North America, rose South America), fine navy coastlines and a faint grid (Natural Earth projection from Natural Earth 1:110m data; see docs/DATA.md, "World map (home screen)"). Five categories, in this order: Europe, Asia, Africa, North America and South America (Եվրոպա, Ասիա, Աֆրիկա, Հյուսիսային Ամերիկա, Հարավային Ամերիկա). Oceania and Antarctica are drawn as pale context, with no name and no action. The continents are geographic, not whole countries: European Russia, Kazakhstan west of the Ural River and Turkey's Thrace are Europe, the rest of those countries Asia; Sinai is Asia; all of New Guinea, and Hawaii, are Oceania. Europe, open, is outlined in teal, and its land turns a stronger mint on hover and focus. Its land and its name (a white button with its name and an arrow, nothing else: the one keyboard stop for Europe, with a clear focus ring that lights its land too) open its eight levels. How many are completed ("Completed: 2/8" / «Ավարտված՝ 2/8», the count kept on one line, with a bar; read in full as "2 of 8 Europe levels completed") is never on the map: on wide screens it is a compact strip under the map ("Europe ★ Completed: 2/8", named because Europe's button is on the map); on a phone held upright it is grouped with Europe's button in the list under the map (beside it where it fits whole, otherwise under it); on a short landscape screen it is directly beneath Europe's button in the side panel, so the map keeps its full size. It is counted from the permanent completion records, so playing a level again or starting it over never lowers it. The other four have no outline of their own, and their names say "Coming soon" (with an hourglass), so availability never rests on colour alone; their land and names do nothing, and nothing on them can be pressed or focused. The names sit on the map where it has room for them (a map at least 52rem wide: desktop). Otherwise they move beside it (a phone held sideways, or enlarged text on a laptop) or under it (a phone held upright), two to a row at the default text size and one with enlarged text, each edged in its land's colour. The map needs no download: it is SVG path data in the page's code (about 40 KiB, 16 KiB gzipped), with no images, tiles or terrain, and no zoom or pan. The action area below the content holds one button. When a level is started and not yet completed, it is Continue, which resumes the most recently active attempt under way (a replay of a completed level included; never a finished attempt at its Results) directly, at exactly its stage and question or journey; it names the continent and level ("Europe · Level 3 · Central Europe", the title left out with enlarged text on a phone) and always all three in its accessible name. Otherwise it is Explore Europe. The header (AriMap, the tagline, the language switch) stays in view and only the content scrolls; there is no artwork or introduction on this page. Each level names its continent (`continent` in `src/core/lessons/levels.ts`; the continents are in `continents.ts`), and a continent's levels and unlocking come from that: its first level is open from the start, so no continent will wait for another.

**Flow:** Continents → Europe's level selection → Discover → Find (five questions, one per country) → Travel → Results. Results' main action, pinned at the bottom, is Next level («Հաջորդ մակարդակը») when another playable level follows in the continent, naming its number and title ("Level 4 · Along the Adriatic"; the title in its accessible name only, with enlarged text on a phone): it opens that level at Discover if never started, or exactly where it was left (never resetting it). After the last playable level it is Back to levels («Վերադառնալ ցանկին»), never coming-soon content. Above it, in the page, are Replay journey («Նորից ճամփորդել») and Play again (the whole level, asking first); each one, scrolled to, shows whole between the map and the pinned action, even on a short phone with enlarged text. The Armenian labels are short enough that each word fits a 320 px phone at 200% text; each action's accessible name starts with its label and adds what it acts on ("Replay journey: France and its neighbours"). With enlarged text the buttons keep the full text size and grow taller, wrapping between words (their side padding gives way, 20px down to 8px); only a word wider than all the room inside would break. A country's name and its result, or a route stop and its role, sit side by side, or the result goes under the name when both don't fit. Nothing advances by itself, and finishing clears nothing. Each level card shows its number, name, countries and status in words (Ready to play, In progress: *step*, Completed, Locked, Coming soon) as well as colour and an icon. Locked and coming-soon cards have no buttons. A playable card offers Start; Continue only for an attempt under way (started and not at the Results of a finished attempt: an unfinished level, or a completed level being played again after Play again or Replay journey), with Start over beside it (Play again once completed); and for a finished attempt, at its Results, View results («Դիտել արդյունքը»: reopens the saved Results as they are, asking nothing and resetting nothing) and Play again, never Continue. A completed level whose save holds only its completion record (an older save) has no Results to view: it offers Play again, and no Results are made up. Start and Continue open the level at once; Start over, and Play again whenever it would clear a saved place (the last Results or a replay under way), ask first, naming the level (one confirmation, `RestartDialog`, shared with Results). Cancelling changes nothing, and confirming changes only that level's place, never its completion, the levels it unlocked or any other level. On the level selection, Back to continents takes the header's place of AriMap and its tagline (which are on the continents), beside the language switch, so it stays in view however the list is scrolled (on a screen short and narrow for its text, such as a phone held upright with enlarged text, it shows only its arrow, keeping its words as its accessible name), and the list is titled with the continent's name ("Europe"), where "Choose a level" was; the header is no taller than before. The main action at the bottom continues the most recently active attempt under way (a replay included), or starts the next level not yet started. Home (in the level header) returns to the continents with progress kept; from there Continue resumes the level, or Europe (its land, its name or, with nothing to continue, Explore Europe) opens the level selection. The screens are not browser history entries (as before continents, the screen is kept in the save): the browser's Back leaves the app, and a refresh opens the saved screen, with no other screen shown first. The level header keeps Home, the three steps and the language switch on one row while the steps have room; on a 320 px phone in Armenian, whose "Home" is longer, Home drops its icon (keeping its name) to stay on one row; with less room the steps move to a row of their own.

**Travel's neighbour cards** show each name beside its arrow, with a 10 px gap that the name never crosses. They sit in two columns only when every card fits half the row with its name on one line. The panel measures this in a hidden copy of the cards, in the loaded font and language at the current text size, and measures again when any of those or the width changes. Otherwise they sit in one column. Names are never shortened, clipped or shrunk: they wrap between words, and a word breaks only if it is wider than the whole row (possible only with very large text).

**Returning players** (any level started): the continents are the same world map for every player. On the continents AriMap, the tagline and the language switch (on the level selection, Back to continents and the language switch) share one row in a header above the scrolling list, so they stay in view however far it scrolls; the main action has its own area below it. On a screen short for its text (under 32 lines of it, such as a 568 px-high phone at 150% text) that header drops the mark and tagline and keeps the name and the language switch, on one row where they fit (at 200% on a 320 px phone the Armenian name and the switch take two), so it takes no more of the list than it must. Only the list scrolls: the page itself never does, even when a script or the browser brings a card into view. The artwork is a slim ribbon at the top of the list, left out on screens under 700 px high. The card the main action opens is ringed and marked "Up next". Its number, name and status are in view on arrival: when completed levels above it would push its status under the action area (a 320×568 phone with Levels 1 and 2 completed), only the list starts scrolled, just enough to show it (with very large text, at least its whole title), set before the first paint. The page never scrolls and the focus doesn't move; a position the player scrolls to is kept across language changes. Completed levels are one line (number, status, name) that opens to show their details, Continue and Play again. A card's title sits beside its number badge while every word of it (and of a completed card's status) fits there; when one doesn't (enlarged text on a phone), the badge and number (and a completed card's chevron, then its status) go above the title, which takes the card's whole width. This is measured in the title as laid out, in its language and loaded font, and again when the width, text size, language or fonts change, so the usual layout stays wherever it fits. Titles wrap between words; a word breaks only if it is wider than the whole card (at 200% on a 320 px phone, some Armenian words are). The eight levels stay in numerical order. With enlarged text, the main action shows only the level's number, so the levels keep room to scroll.

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
  lessons/                 levels.ts (the eight levels: ids, names, countries, unlocks) and each playable
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
src/data/geo/              prepared Natural Earth TopoJSON, and the home screen's world map as SVG paths (see docs/DATA.md)
src/components/            React UI (screens, panels, SVG map, zoom, inset)
scripts/prepare-geo.mjs    reproducible map-data preparation
scripts/prepare-world-map.mjs  the home screen's world map (geographic continents, projected)
scripts/prepare-landmarks.mjs  landmark display copies (trimmed, resized)
scripts/generate-relief.mjs    map relief and forests from elevation and land-cover data (see docs/TERRAIN.md)
public/relief/             zoomed landscape tiles, loaded only when needed
src/assets/landmarks/      landmark display copies (see docs/CONTENT.md)
e2e/                       Playwright end-to-end tests
```

To make a coming-soon level playable: add its countries' content to `src/core/content/countries.ts` (and remove them from `names.ts`), write a `LessonDefinition` (see `src/core/lessons/alps.ts`) and set it as the level's `lesson` in `src/core/lessons/levels.ts`. Then add the level to `LEVEL_AREAS` in `scripts/generate-relief.mjs` and rerun it. The tests check the new level's border graph against the map data, its route crossings, its coverage against the prepared data, and that the relief covers it; the level stays "Coming soon" until `lesson` is set. Level 5 needed a larger map-data clip box (it reaches Greece and the Black Sea), made without moving any earlier level's coordinates, and kept the shared projection (see docs/DATA.md, "Level 5"). Level 6 kept the clip box and the projection but added the Baltic states and their neighbours to the detailed list (see docs/DATA.md, "Level 6"). Level 7 kept them too; it added Portugal (and Morocco and Gibraltar beside Spain) to the detailed list, left Portugal's Atlantic islands (Madeira, and the two Azores islands the clip box reached) out of the data, as the Canary Islands already were, and is the second level with a small country and a close-up (Andorra, as Luxembourg in Level 1; see docs/DATA.md, "Level 7"). Level 8 kept the clip box, the projection and the detailed list (its countries and neighbours were already detailed), and drew Crimea as part of Ukraine, its internationally recognised country, where Natural Earth's default file follows military control (see docs/DATA.md, "Level 8"); its three new landmarks have no artwork yet and show text-only cards. Level 4 needed neither; its route over the Pelješac Bridge (a fixed link inside Croatia, past Bosnia and Herzegovina's coast at Neum) is described in docs/DATA.md, "Level 4".

## Saved progress

Progress is saved in `localStorage` under `arimap:state`, version 2:

- the language;
- the screen (`continents`, `levels` or `lesson`), the continent whose levels were last shown (`continent`), and the level being played or last played (`levelId`, kept by Home). A save from before continents says `welcome` for the level selection, which then held Europe's levels only: it opens Europe's level selection, with no migration. Builds from before continents read the new screens as their level selection and ignore `continent`;
- `recent`: the levels in the order they were last active, which chooses what the main Continue opens;
- `levels`: each level's own progress, by its stable id. This is the Discover selection and explored countries, the Find session with hints and attempts, the journey with its assistance flags, the last result, whether the journey under way or just finished is a journey replay (`journeyReplay`), and completion records, including the best star rating (`records.bestRating`: 1, 2 or 3, absent or null until earned).

On load everything is validated, level by level: budgets, statuses and "independent" flags are recomputed from game rules rather than trusted, and malformed parts are dropped without touching other levels. A level opens only if it is playable and unlocked. Level 2 unlocks once Level 1's journey has been finished (`records.travelDone`), Level 3 once Level 2's has, Level 4 once Level 3's has, Level 5 once Level 4's has, Level 6 once Level 5's has, Level 7 once Level 6's has, and Level 8 once Level 7's has; records are never cleared, so starting over or replaying never locks them again. The unlock is derived from those records when a save is read, so a save from before Level 3 (or Level 4, 5, 6, 7 or 8) was playable, with the level before it completed, opens it with no migration: the save format is unchanged.

"Start over" (or "Play again" for a completed level) discards that level's current place (Discover selection, Find session, journey) but keeps its completion records. It asks first and changes no other level. "Replay journey" changes only that level's Travel.

### Star ratings

One rule for all eight levels (`src/core/lesson/rating.ts`), given only when a full-level attempt (from Discover, through Find, to the end of the journey) completes: **1 star** for completing the level; **2 stars** with at least 4 of the 5 Find answers on the first try without hints; **3 stars** with all 5 so, and the journey completed "Without help" (no Hint, no Undo). These are Find's and Travel's own measures: no time limits, speed bonuses or other penalties, and unlocking is unchanged. Each level keeps its best (`records.bestRating`), which is never lowered: playing again, starting over or a worse attempt keeps it. A journey replay (Replay journey) rates nothing, so an earlier Find never combines with a new route to raise the rating; only a full attempt (Play again) can.

Results show this attempt's stars under the completion banner ("This attempt ★★☆ 2 of 3 stars"), the best separately when it differs, "New best!" when this attempt has just beaten an earlier best (not for a first rating, and only until the next action: never after a refresh, a language change or View results; the earned stars pop in once, not with reduced motion), and, for 1 or 2 stars, what earns the next. After a journey replay they show the best, saying a replay doesn't change it. Completed level cards show the best stars, compact and opened; a level never rated shows none. Earned stars are warm gold with an ink outline; the others are empty with a dashed outline, so they differ in shape, not colour alone. On Results the count is also in words; on a card the group has one accessible description ("Best: 2 of 3 stars" / «Լավագույնը՝ 2 աստղ 3-ից»), and the stars themselves are hidden from screen readers.

Saves: both fields are optional. A stored rating that is not 1, 2 or 3, or belongs to a level not completed, is ignored. A save from before ratings is rated from its own Results when it keeps them whole (a full Find and its journey); a completion record alone stays "Completed" with no stars. A journey under way in a completed level in such a save may have been a replay, so it is taken as one and rated nothing.

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
- World map (home screen): Natural Earth 1:110m Admin 0 Countries v5.1.1 (public domain), regrouped into geographic continents. See [docs/DATA.md](docs/DATA.md), "World map (home screen)".
- Relief: Terrain Tiles by Mapzen, from the Registry of Open Data on AWS. SRTM and GMTED2010 terrain data courtesy of the U.S. Geological Survey. Global ETOPO1 terrain data U.S. National Oceanic and Atmospheric Administration. These credits are also shown in the app ("About the map"). See [docs/TERRAIN.md](docs/TERRAIN.md).
- Forests: © ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium (CC BY 4.0; Zanaga et al., 2022, ESA WorldCover 10 m 2021 v200, doi:10.5281/zenodo.7254221). Also shown in "About the map".
- Landmark illustrations: twenty-six **AI-generated stylised illustrations** (not photographs), one per landmark of Levels 1–7 (Italy's Colosseum is shared by Levels 2, 4 and 7, France's Eiffel Tower by Levels 1, 2 and 7, Level 6 reuses Germany's and Poland's, and Level 8 Poland's and Romania's; Level 5's five were added on 2026-10-02, Level 6's Trakai Island Castle, House of the Black Heads and Tallinn Town Hall on 2026-10-03, and Level 7's Belém Tower, Sagrada Família and Casa de la Vall on 2026-10-04). Their generation prompts are kept in docs/CONTENT.md, with what each drawing simplifies. A landmark without artwork shows a text-only card (the map's landmark mark beside its name and fact, no empty frame): Level 8's Mir Castle, Saint Sophia Cathedral and Soroca Fortress do, until their artwork is supplied (briefs and prompts in docs/CONTENT.md, "Level 8: Eastern Europe"). The originals are in `public/images/landmarks/`; trimmed display copies made by `scripts/prepare-landmarks.mjs` are in `src/assets/landmarks/`. Provenance, image mapping, and sources for landmark facts and locations are in [docs/CONTENT.md](docs/CONTENT.md). The player interface shows no provenance notice.
- Fonts: Nunito (Latin) and Noto Sans Armenian, self-hosted at build time via `next/font` (both SIL Open Font License). The font stack is set in `globals.css` (`--font`): Nunito, a Latin-only stand-in with Nunito's proportions while it loads, then Noto Sans Armenian and its own stand-in. Not next/font's `--font-latin`, whose stand-in (local Arial) has Armenian letters on Windows and so took Armenian text before Noto Sans Armenian could; `e2e/phone-layout.spec.ts` checks which font each script is drawn in.
