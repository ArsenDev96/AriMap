# Level 10 (Nordic Countries): work-in-progress checkpoint

Written 2026-10-14 when work moved to another computer. Level 10 is **implemented and playable, but not finished**:
- Unit tests are only partly updated.
- E2E specs and the docs are not updated.
- No test suite has been run (by request).

Don't merge this branch yet.

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

## Known issues
1. **200% text, 320×568 (304×112 map):** the selected country's name is sometimes left out: Denmark in both languages, Sweden and Norway in Armenian. Denmark's tap room there is 0–4 px; the close-up works for it. This needs label-placement work, as Level 9's North Macedonia did.
2. **Close-up on small phones:** once opened, it covers part of Iceland. It is closed by default and can be closed again.
3. **Landscape 724×192:** the start view crops about 13 px top and bottom, like the other levels' landscape views.
4. **Level 10's pan area** reaches 13 units (open sea west of Iceland) beyond the challenge's tile grid; the overview shows there.
5. **Stale expectations already in HEAD**, apparently from earlier levels:
   - `levels.test.ts` line ~292: an unlock chain of 8 entries;
   - lines ~1348/1365: `Array(7)` patterns with 8 entries;
   - `rating.test.ts` ~199: `total: 8`.
   Check them when running the suites.
6. **Armenian wording needs native review:** hints, facts, the Travel note, Հալթգրիմսկիրկյա, Օլավինլինա ամրոց, and Էրեսունդ vs Էրեսուն.

## Remaining tasks
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
5. **Browser checks still to do:** EN/HY at 390×844 and 1366×800, WebKit, a "Ready to play" level card with the Olavinlinna thumbnail, and Quick Challenge (pool 40, 15 questions, 60 s; unchanged in code). Then an isolated preview build. Ask the user whether they prefer localhost review or screenshots before taking any.
6. **Then:** typecheck, lint, and run the suites only if the user asks (the full e2e run takes about 50 minutes).

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
