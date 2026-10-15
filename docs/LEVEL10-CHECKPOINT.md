# Level 10 (Nordic Countries): checkpoint

Written 2026-10-14 when work moved to another computer, updated when it was resumed the same day, and brought up to date on 2026-10-15 for the commit that adds the Travel follow-ups below ("Final state").

## Final state (2026-10-15)

Level 10 is complete in code, content, assets and docs; the remaining tasks of 2026-10-14 (below) are done. Since that commit (`b4012a6`), Travel changed across levels:

- **Travel-only neighbours** (`travelOnly` in a level's definition, `travelCountries` in `src/core/lessons/index.ts`): real neighbours outside a level's five that Travel can enter where the five alone forced a single move: Hungary and Serbia in Level 4, Latvia in Level 8, Germany, Poland and the Netherlands in Level 10. They are drawn, named and selectable in Travel and Results, never in Discover, Find, completion or stars; none lies on a shortest route, so crossings and completing routes are unchanged. Saved routes may now contain them (`parseRoute`).
- **Level 4's reach north** (`map.travelReachNorth: 160`, `travelCoverage`): in Travel and Results the map may be panned north far enough for the traveller's pin in Budapest. Only Level 4's relief overview was regenerated (`along-the-adriatic-land.webp` and its `relief.json` entry); the shared tiles and every other asset are byte-identical.
- **Level 7's non-neighbour option** (`travel.nonNeighbourOptions`; `choose` and `nonNeighbourChoices` in `src/core/game/travel.ts`; `travelNotice` in `src/core/lesson/progress.ts`): at the start in Portugal, France is offered beside Spain, styled the same. Choosing it moves nothing, uses no crossing, records no help and changes no rating; Travel says the two share no border (`travel.notNeighbour`, English and Armenian) and France is outlined and named on the map. The notice is never read back from a save.
- **The traveller's pin** (`ScreenMark.keep` and `ScreenMark.clearOf` in `src/geo/regionMap.ts`): kept whole in a Travel-only country, and kept clear of the zoom controls and "About the map", the start view moving as little as it can.
- **The zoom controls off a very short map** (`controlsPlacement` in `RegionMap.tsx`; `mapControlsSlot`, `--map-controls-below` and `--map-room-below` in `LessonScreen`): in Travel and Results, on a map 190 px tall or less (200% text on a phone), the controls go below the map when the panel is below it (the map keeps its height; their room comes from the panel), or to a sticky slot at the top of the panel when it is beside the map (landscape). The camera then keeps clear of "About the map" only, so it no longer zooms in for them (Warsaw had been ×3.3 at 320×568 and ×1.9 at 568×320). The choice follows the map's size and the page layout, not the language or a text-size setting. Discover, Find and taller maps keep the controls on the map.

Docs: README; `docs/DATA.md` (Travel-only neighbours per level, "Level 4: Travel's reach north", "The traveller clear of the map controls", Level 7's start); `docs/CONTENT.md` (the new strings); `docs/TERRAIN.md` (Level 4's taller overview).

**Validation (2026-10-15).** `npm run typecheck` and `npm run lint` clean (ESLint already ignores `.next/**`, where the temporary preview builds went, and `.next-e2e/**`).

**Validation of `b49a961` (2026-10-15, later).** Run, by request: `travel.test.ts`, `levels.test.ts`, `regionMap.test.ts`, `route.test.ts` and `relief.test.ts` (570 tests, all passing), and the save tests in `lesson.test.ts` and `rating.test.ts` (17, all passing). Their first run had 10 failures, fixed in the tests only (uncommitted):
- 8 in `levels.test.ts`, failing before this work: seven level-status lists still of 8 levels, and Level 6's countries before its second version (Belarus for Germany).
- 1 in `route.test.ts`, failing before this work: Level 10's route line, sampled against every other country, takes about 7 s (11 s with the Travel-only neighbours), over the 5 s default; it now has 30 s.
- 1 in `regionMap.test.ts`, a new test's condition: at 304×150 (200% text, English) the start view cuts Ljubljana's and Zagreb's pins without the reach too; the view without the reach zooms in (×1.09, ×1.02), Travel's moves north at the start zoom instead. The test now compares the views where the pin fits the start view or the view is left as it was, and elsewhere asserts the pin whole and no more zoom.
The full unit suite and the e2e specs have not been run.

**Tests written or updated (the e2e specs not run):**
- `src/core/game/travel.test.ts`: non-neighbour options (a synthetic graph).
- `src/core/progress/levels.test.ts`: Travel-only neighbours per level (no forced move left but the documented ones; budgets and completing routes unchanged; saves with them), Level 7's France (unchanged attempt, notice, map tones, refresh, Spain, Undo, stars), the options' validity.
- `src/geo/regionMap.test.ts`: Level 4's reach (Discover and Find limits unchanged; Budapest's pin whole); the pin clear of the controls (every level, every country the traveller can stand in; no zoom-in with the controls off the map, Helsinki in view).
- `src/geo/route.test.ts`, `src/geo/relief.test.ts`: the new crossings; Level 4's overview covering Travel's reach.
- `e2e/level4.spec.ts`, `e2e/level7.spec.ts`, `e2e/level8.spec.ts`, `e2e/level10.spec.ts` (Travel-only moves; France; Budapest's and Level 10's pins; where the controls are, their reach, the panel scrolled, turning upright and back); `e2e/continents.spec.ts` (a stale "Completed: 2/9", now 2/10).

**Browser checks done** (Chromium on a dev server, English and Armenian; scratch scripts, not the suites):
- Travel-only neighbours selectable in Levels 4, 8 and 10 and kept out of Discover and Find; Level 7's France chosen three times in a row leaves the route, crossings and traveller unchanged, and Spain then moves.
- Budapest's pin whole at 390×844, 320×568, 844×390, 568×320 (100% and 200% text) and 1366×800.
- Level 10's pin whole and uncovered, restored and entered in Germany, Poland and the Netherlands, after Undo and Restart, and in Results, at 320×568 (100% and 200%), 390×844, 844×390, 568×320 and 1366×800 (132 states); Levels 1–9's traveller in every country it can stand in, at six sizes (336 states), never under the controls.
- The controls below the map at 320×568 with 200% text, and in the panel at 568×320 with 200% text: map sizes unchanged, 44 px buttons, zoom, reset, focus ring, the panel scrolled (controls kept at its top, reachable, nothing showing above them), turning upright and back (the same view as before and after a reload), no resize loops, camera jumps or console errors.
- Screenshot reviews (not in the repository; `/screenshots` is ignored): `level10-pin-framing-review.zip`, `level10-toolbar-review.zip`, `level10-landscape-final-review.zip`.
- Saves (a probe on the real modules): a save from the previous commit loads with every level's completion, Results and best rating (3,2,1,3,2,3,1,2,3,3 kept), Level 6 on its second version, and journeys under way restored; a Level 7 France choice is not saved. Quick Challenge unchanged: pool 40, 15 questions, 60 s.
- WebKit 26.6 (2026-10-15, scratch script on a dev server, English and Armenian; 636 checks): Level 4 into Hungary, Undo and restored there (390×844, 320×568 at 200%); Level 7's France three times (no move, crossing, saved help or notice; the notice shown) then Spain; Level 10's wrong turns through Germany (Poland, the Netherlands, Undo, Restart) then Denmark → Sweden → Finland and Results (390×844, 1366×800, 320×568 and 568×320 at 200%); the short maps at 200% (Copenhagen, Warsaw restored, Helsinki in Results, Budapest): the controls below the map or in the panel, 44 px, reachable (the panel scrolled too), zoom and reset, no camera move after load, the pin whole and clear, Finland 100% in view, Warsaw ×0.94–1.00 of the start zoom. The only failures: Zagreb's pin cut at the top at 320×568 with 200% text in Armenian (limitation 4, as in Chromium).

**Remaining limitations:**
1. The full unit suite and the e2e specs have not been run (the five targeted unit-test files and the save tests have: above). `level10.spec.ts` carries many new assertions. Run them before merging; the full e2e run takes about 50 minutes.
2. Armenian wording needs native review: Level 10's hints, facts, Travel note and names (Known issue 6), and the new `travel.regionNeighbours` and `travel.notNeighbour` («… և … ընդհանուր սահման չունեն։ Ընտրիր հարևան երկիր։»).
3. Labels are unchanged by this work: at 200% text Denmark stays unnamed on the main map in Discover (Known issue 1), and Poland is not named in Armenian in some Travel views (Warsaw at 320×568, normal and 200% text). Where the controls are off the map, names no longer avoid them.
4. On short maps (200% text), a traveller in a level's own country may still be cut at the map's edge (Levels 1–9: 16 such states, as before; among them Zagreb and Ljubljana at 320×568 with 200% text in Armenian, in WebKit too): the clearance moves the view only for a pin under the controls or "About the map", or in a Travel-only country.
5. Two moves in quick succession (before the camera reaches the first move's view) leave the camera at the first move's view, the pin whole there; unchanged from before.
6. Results' map is 6 px taller than Travel's (its header is shorter), at 200% text too: expected.

## Resumed (2026-10-14)
Remaining tasks 1–5 below are done, apart from screenshots; no test suite has been run (by request).
- **Unit tests:** `levels.test.ts` (ten levels, the Level 10 block, and the stale 8-entry expectations of issue 5; seven more, and Level 6's countries, were found when the file was run on 2026-10-15), `rating.test.ts` (10 levels, 30 stars) and `content.test.ts` (Level 10's content; capitals' bounds now reach Reykjavík and Helsinki; Bryggen's two-sentence fact is allowed 125 characters, the others 110). The new claims were checked with a scratch script against the real modules.
- **E2E:** new `e2e/level10.spec.ts`; `level6`–`level9`, `continents`, `levels`, `results-next`, `stars` and `phone-layout` updated for ten levels and 30 stars (Level 9 now has a Next level). `webkit-phone`'s `testMatch` was left as it was (Level 10's spec doesn't run there, like Level 8's and 9's).
- **Docs:** README, `CONTENT.md`, `DATA.md` ("Level 10"), `TERRAIN.md`.
- **Known issue 1 (200% text):** `map.calloutDotsClearControls`: a highlighted country whose label point is under the map controls takes its dot from the nearest point of it clear of them. Sweden and Norway are now named when selected or travelled through, in both languages. Denmark lies wholly under the controls there (its land at x ≈ 160–180 px, the controls' area from x 158), so it stays unnamed on the main map; the close-up names and shows it. Such a dot never opens the close-up. Levels 1–9 are unaffected (the option is off).
- **Known issue 2 (close-up over Iceland):** `inset.smallMapBeside`: on smaller maps the close-up opens beside its toggle. Iceland's tap circle with it open: 28 px at 320×568 (was 0), 32 at 390×844, 36 at 740×360 (was 10); the others keep at least 26 px. At 200% text the map is shorter than the panel's minimum, so opened it still covers Iceland; it is closed by default there, Iceland is tapped with it closed and Denmark through it.
- **Browser checks** (dev server, Chromium and WebKit): see `docs/DATA.md`, "Level 10", "Not verified". Quick Challenge unchanged.
- Typecheck and lint clean.


## Approved decisions (from the planning rounds)

**Content**
- Title "Nordic Countries" / «Հյուսիսային երկրներ». Region "the Nordic countries" / «Հյուսիսային երկրներ».
- Description: "Explore the Nordic countries, from Denmark to Iceland." / «Ուսումնասիրիր Հյուսիսային երկրները՝ Դանիայից մինչև Իսլանդիա։»
- Countries: Denmark, Sweden, Norway, Finland, Iceland.
- Landmarks: Kronborg Castle, Visby City Wall, Bryggen, Olavinlinna, Hallgrímskirkja.
- Card picture: Olavinlinna (Finland is the destination).
- Bryggen's fact keeps the trading history (Hanseatic office about 1350–1754) apart from today's houses (rebuilt the old way after the 1702 fire).

**Travel**
- Journey Denmark → Sweden → Finland, 2 crossings, one shortest route. The wrong turn is Sweden → Norway.
- Øresund is a named cross-border fixed link (bridge + Drogden tunnel), not a land border. The route changes colour at the statutory boundary on the bridge: **12.80898 E, 55.57926 N**.
  - Source: SFS 2017:1272 annex 1, TP 55–56, in SWEREF 99, intersected with OpenStreetMap's bridge deck. It is consistent with Denmark's BEK 1662/2020 and the 1932 declaration (Limits in the Seas No. 26).
  - The point is on the western approach bridge, about 2.3 km east of Peberholm and 5.5 km from Lernacken.
- Crossings: Sweden–Finland at Haparanda–Tornio; Sweden–Norway (the wrong turn) at the border vertex nearest Morokulien.
- Norway–Finland is a real border, but no journey reaches it within the budget, so it has no route leg.
- Iceland has no connections. It is learned in Discover and Find; a per-level Travel note explains this.

**Map**
- A separate northern dataset at 400 m, loaded only for Level 10. Existing datasets, tiles, URLs and versions are unchanged.
- Svalbard is excluded. Jan Mayen is kept as Norway (it doesn't widen the frame). Åland is merged into Finland.
- Faroes and Greenland are faded context. Peberholm is left undrawn (not in Natural Earth 1:10m).
- Denmark close-up covers Jutland to Malmö; Bornholm stays on the main map.
- Relief reuses the Quick Challenge's tiles; the optional deep-zoom (l3) folder is deferred.
- The whole region fits at 200% text.
- Border lengths stay out of player-facing text.

## Done

**Data and scripts**
- `scripts/prepare-north-geo.mjs` (new) generates `src/data/geo/europe-north.topo.json`. In that file:
  - the five countries plus DEU, RUS, EST, FRO at 400 m, others at 2.5 km;
  - cut to Level 10's coverage plus 40 units; Svalbard erased; Åland merged into Finland;
  - Crimea's parts in the data merged into Ukraine;
  - **285.0 KiB raw, 92.6 KB gzip** (measured).
- `scripts/generate-relief.mjs`:
  - A Level 10 entry with `dataset: "north"` and `overviewPx: 0.5`.
  - Level 10 is excluded from the shared tile grid. The `--overview` mode skips the grid check for it.
- `scripts/prepare-landmarks.mjs`: Olavinlinna thumbnail added.

**Code**
- `src/geo/regionMap.ts`: `MapDataset`, `loadMapData`, `isMapDataLoaded` and `setNorthData`. `getRegionMap` takes a dataset. Same shared projection.
- `src/core/lessons/types.ts`:
  - `map.dataset`, `map.borderLinks` (named cross-border links) and `travel.note`;
  - `inset.wideMapCorner`, because the close-up's usual top-left corner on wide maps is over Iceland.
- `src/core/lessons/nordic-countries.ts` (new): borders, mission `dnk-to-fin`, the note, coverage `[2095, 990]`, the close-up, crossings, turning points, the Copenhagen harbour link and the Øresund link.
- `src/core/lessons/levels.ts`: Level 10 registered after Level 9, `unlockedBy` Level 9.
- `src/core/content/countries.ts`: DNK, SWE, NOR, FIN and ISL content.
- `names.ts` and `ChallengeMap.tsx`: their challenge-only names and labels removed. The label points are unchanged, so the Quick Challenge's map is unchanged.
- `src/components/map/RegionMap.tsx`:
  - waits for the lesson's dataset (empty frame meanwhile);
  - passes the `own` relief to Relief;
  - honours `wideMapCorner`.
- `src/components/map/Relief.tsx`: `loadLevelRelief` combines Level 10's overview with the challenge's tiles (the manifest is imported dynamically). Level 10's overview images are registered.
- `TravelPanel.tsx` shows the level's note. `LandmarkCard.tsx` and `WelcomeScreen.tsx` register the art and the thumbnail.

**Assets** (originals unchanged; all earlier assets checked byte-identical by SHA-256 before and after generation)

| Asset | Details |
|---|---|
| Artwork originals | `public/images/landmarks/{kronborg,visby-city-wall,bryggen,olavinlinna,hallgrimskirkja}.png`, each 1254×1254 RGBA with transparency, silhouettes complete. Checked visually against the briefs; only deviation: Kronborg shows the whole castle on its ramparts, not one bastion. |
| Display WebPs (`src/assets/landmarks/`) | kronborg 720×719, 533 KiB; visby 720×650, 573 KiB; bryggen 720×392, 379 KiB; olavinlinna 720×598, 505 KiB; hallgrimskirkja 677×720, 249 KiB |
| Thumbnail | `thumbnails/olavinlinna.webp` 156×130, 14.2 KiB |
| Relief overview | `src/assets/map/relief/nordic-countries-land.webp` 2096×991, 299,890 B; `-tone.webp` 873×637, 69,958 B |
| `relief.json` | Gained only the new overview entry; version a45fb07217 unchanged. Elevation sources unchanged (srtm, gmted, etopo1), so no new credit. |

**Tests updated (not run)**
- `src/geo/regionMap.test.ts`:
  - dataset-aware;
  - the border test accepts an edge without a shared boundary only through a declared `borderLink`;
  - Kronborg coast margin 0.3 km (it is 0.20 km beyond the data's coast);
  - a northern-data test;
  - a 304×112 and 304×150 fit test.
- `src/geo/route.test.ts`:
  - dataset-aware;
  - a crossing for every reachable border;
  - Level 10 has no crossing for unreachable Norway–Finland;
  - link checks; journey `DNK→SWE→FIN`.
- `src/geo/relief.test.ts`: half-pixel sampler, challenge-grid coverage for Level 10, Level 10 relief tests.
- The numeric claims were checked with scratch scripts against the real modules. Examples: Level 10 pins never change the start view; Levels 1–9 keep their crossings.

## Checks run
- `npm run typecheck` and `npm run lint`: clean (re-run for this checkpoint).
- Browser, Chromium, isolated production build, at 320×568 (English and Armenian) and at 320×568 with 200% text.
  - **Passed:**
    - five whole on the map, Level 10 overview under it;
    - names clear at normal text size; all five landmark cards with alt text;
    - Find spoiler-free; Denmark answered through the close-up;
    - Travel note shown; Denmark's only move is Sweden; Sweden offers Finland and Norway;
    - route `DNK,SWE` 16 points, `DNK,SWE,FIN` 27, `DNK,SWE,NOR` 18;
    - out of crossings in Norway; Undo and Restart; hint labels neighbours;
    - resume after reload; results and replay badge; Europe stars total 30;
    - no page errors.
  - **Not done:** 390×844 and 1366×800 (the probe stopped at the English 320×568 level-list step; see below), WebKit, Quick Challenge in the browser.

## Known issues (as of 2026-10-14; see "Final state" for what changed since)
1. **200% text, 320×568 (304×112 map):** the selected country's name is sometimes left out: Denmark in both languages, Sweden and Norway in Armenian. Denmark's tap room there is 0–4 px; the close-up works for it. This needs label-placement work, as Level 9's North Macedonia did.
2. **Close-up on small phones:** once opened, it covers part of Iceland. It is closed by default and can be closed again.
3. **Landscape 724×192:** the start view crops about 13 px top and bottom, like the other levels' landscape views.
4. **Level 10's pan area** reaches 13 units (open sea west of Iceland) beyond the challenge's tile grid; the overview shows there.
5. **Stale expectations** from earlier levels (an unlock chain of 8 entries, `Array(7)` patterns with 8, `total: 8`): fixed on 2026-10-14; the last one, `continents.spec.ts`'s "Completed: 2/9", on 2026-10-15.
6. **Armenian wording needs native review:** hints, facts, the Travel note, Հալթգրիմսկիրկյա, Օլավինլինա ամրոց, and Էրեսունդ vs Էրեսուն.

## Remaining tasks (2026-10-14; all done but running the suites)
1. **`src/core/progress/levels.test.ts`:**
   - ten levels; the Level 10 entry; locked count; continent totals 10;
   - Level 9's Next level is now Level 10; "all nine completed" becomes ten;
   - a `describe("Level 10")` covering: unlock from a Level 9 save; borders; Iceland unreachable (`shortestDistance` null); wrong turn; Undo/Restart; hint; saves; stars.
2. **`src/core/content/content.test.ts`:** Level 10 content; challenge names no longer list the five.
3. **E2E:**
   - new `e2e/level10.spec.ts`, modelled on `level9.spec.ts`;
   - update `level9.spec.ts`: Results now has Next level; "all nine completed" no longer holds;
   - update `continents.spec.ts`, `levels.spec.ts`, `results-next.spec.ts`, `stars.spec.ts` and `phone-layout.spec.ts` for ten levels and 30 stars.
4. **Docs:**
   - `docs/CONTENT.md`: sources for the facts, capitals and Armenian names;
   - `docs/DATA.md`: northern dataset, exclusions, Peberholm, Øresund boundary source, crossings, harbour link, unreachable Norway–Finland, measured sizes, verification limits;
   - `docs/TERRAIN.md`: overview at 0.5 px per unit, challenge tiles, no new credit;
   - `README`.
5. **Browser checks:** done on 2026-10-14 (English and Armenian at 390×844 and 1366×800, WebKit at 390×664 and at 320×568 with 200% text, the Quick Challenge played through: `docs/DATA.md`, "Level 10", "Not verified"), and for the Travel follow-ups on 2026-10-15 ("Final state").
6. **Still to do:** run the suites, when asked (the full e2e run takes about 50 minutes).

## Resume
```
git fetch origin
git switch checkpoint/level10-nordic
npm ci
npm run typecheck && npm run lint
```
To regenerate the data (only if needed):
- **Northern data:** download Natural Earth 1:10m Admin 0 Countries v5.1.1, then run `node scripts/prepare-north-geo.mjs <ne_10m_admin_0_countries.shp>`.
- **Level 10 overview:** `node scripts/generate-relief.mjs --overview nordic-countries`. This needs network access, or the terrain and WorldCover caches in `node_modules/.cache/`.
