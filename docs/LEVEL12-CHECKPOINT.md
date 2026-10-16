# Level 12 (Russia and its western neighbours): checkpoint

Written 2026-10-16, at the end of the implementation pass, for the owner's localhost review. Nothing is committed. The unit tests and e2e specs written or updated for it have **not been run** (by request); the brief is `docs/LEVEL12-BRIEF.md`.

## What changed

**Data and scripts**
- `scripts/prepare-east-geo.mjs` (new) → `src/data/geo/europe-east.topo.json` (new): **265,851 B (259.6 KiB) raw, 89,358 B gzipped**, 35 countries, deterministic. The levels' projection and quantization grid; Estonia, Latvia and Belarus the levels' shapes vertex for vertex (the script checks it). Clipped 40 units beyond the coverage, so its cut edges are never in view. Crimea's step kept (outside this data); Åland merged into Finland.
- `scripts/generate-relief.mjs`: Level 12's `LEVEL_AREAS` entry (`dataset: "east"`, half a pixel per unit, Russia's frame box); the frame as the app takes it; the tone over every lesson country's whole shape. `--overview russia-and-western-neighbours` made the only new relief files.
- `scripts/prepare-landmarks.mjs`: the `saint-basils-cathedral` thumbnail.

**Code** (content, graph and geography React- and DOM-free)
- `src/core/lessons/russia-and-western-neighbours.ts` (new), `levels.ts` (Level 12 after Level 11), `types.ts` (dataset `"east"`, `map.frameWithin`, `map.labels`).
- `src/core/content/countries.ts`: Russia (name and label point moved unchanged from `names.ts` and `ChallengeMap.tsx`'s Quick Challenge lists).
- `src/geo/regionMap.ts`: the eastern dataset; `frameBounds` (Russia counts in the frame only within 26–39°E, 54–70°N); per-level label points. `challengeMap.ts`: an empty label table. `RegionMap.tsx`: a level's own label point where it has one.
- `Relief.tsx`, `LandmarkCard.tsx`, `WelcomeScreen.tsx`: the overview, artwork and thumbnail registered. `WelcomeScreen.module.css`: Level 12's card colour (`#5f87a8`), found missing in the review, as Levels 9–11's were.

**Assets** (original unchanged; every other file in `src/assets`, `src/data` and `public` byte-identical by SHA-256; `relief.json` gained only the overview entry, tiles and version `a45fb07217` unchanged)

| Asset | Details |
|---|---|
| Original | `public/images/landmarks/saint-basils-cathedral.png` 1254×1254 RGBA, 1,869,325 B |
| Display WebP | `saint-basils-cathedral.webp` 662×720, 481,794 B (470.5 KiB) |
| Thumbnail | `thumbnails/saint-basils-cathedral.webp` 143×156, 17,014 B |
| Relief overview | land 2271×841, 361,088 B; tone 1287×886, 185,066 B |
| Map data | 265,851 B raw, 89,358 B gzipped |

**Tests and specs written or updated (not run):** `levels.test.ts` (twelve levels, 36 stars, lock lists, a Level 12 block: unlock, progress apart, graph, both routes, Finland's option, wrong turns, Undo, Restart, refresh, replay, Find, all twelve; Level 11's Next level; forced states and budgets), `rating.test.ts`, `content.test.ts` (Russia, the hints; capitals east to Moscow), `regionMap.test.ts` (the eastern data, frame, Kaliningrad, coverage, label point, short maps, the traveller), `route.test.ts` (crossings, both routes, wrong turns, never near Kaliningrad), `relief.test.ts`; `e2e/level12.spec.ts` (new) and the specs for twelve levels and 36 stars (`level6`–`level11`, `continents`, `levels`, `phone-layout`, `results-next`, `stars`).

## Decisions taken in implementation

- **Crossings:** rule 1 of Levels 6, 8 and 9 for Latvia– and Belarus–Russia (it also reproduces Levels 6 and 8's Estonia–Latvia and Belarus–Latvia points in the new data, which are reused). Estonia–Russia's is an approximate crossing near Koidula, about 5 km from the Koidula–Kunichina Gora checkpoint (follow-up below). **Finland–Russia** has no rule-1 vertex: Helsinki is on the coast, so its legs pass 5.7–7 km from it just beyond the exempt 10 km. As Level 10 did for Helsinki, its legs only stay on their own land: the border's middle vertex, straight legs (6.2 km clear in Finland, 9.4 km in Russia). Drawn only on the wrong turn into Finland.
- **Russia's frame** is computed with a planar point-in-polygon test: d3's spherical test misread Russia's clipped source shape.
- **Relief tone** covers all of Russia the data holds (not only the frame), since Russia takes a state colour wherever it is drawn.

## Checks run

- `npx tsc --noEmit`: clean. `npx eslint .` (ignoring the preview build folders `.next-preview/`, `.next-l11/`, `.next-l12/`): clean.
- **Focused Chromium review** (scratch Playwright scripts on the production build, not the e2e specs), **390×844 and 1366×800, English and Armenian**:
  - unlock from a Levels 1–11 save (33/36 stars, Level 12 up next, its thumbnail, earlier saves unchanged by playing);
  - Discover of all five (name, capital, hint, art loaded and uncropped, named on the map; Russia named at the whole-map view);
  - Find of all five, nothing given away, and a tap inside Kaliningrad answering Russia;
  - Travel: the amber note and its text; Finland's feedback with no move, crossing or route; both winning routes; the wrong turns Latvia → Russia and Russia → Finland; Undo, Restart and a reload restoring the route; 3 and 5 route points; the traveller's pin whole and clear of the controls in every state;
  - Results (2 stars with Undo, no Next level), Replay journey (badge), all twelve completed;
  - no horizontal overflow, no page errors.
  - Found and fixed: Level 12's card colour. Every other check passed (two failures in the first run were the script's own: an Armenian expected string and a tap on Kaliningrad's edge).
- Start-view margins measured (px from the map's edge): 390×844 Finland 21, Estonia 115, Latvia 93, Belarus 15; 1366×800 Finland 41, Estonia 241, Latvia 175, Belarus 29. Discover tap room (largest circle): Estonia 28 px and Latvia 32 px at 390×844; Kaliningrad about 10 px there (Russia is tapped anywhere).

## Not checked (deferred)

WebKit; 200% text; phones in landscape; 320×568; the unit tests and e2e specs themselves (`e2e/level12.spec.ts` copies some layout values from Level 11's that were not measured for Level 12, and its Estonia tap-room floor is an estimate); a broad cross-level audit.

## Known limitations

1. **No suite or spec has been run.** Containment tests on Russia's shape use d3's spherical test (as every other level's do) on the processed data; that is expected to hold there, but is unverified.
2. **Armenian wording needs native review:** the title, description, region, Russia's hint, the four level hints, the fact and the Travel note.
3. **Kaliningrad is small** on phones (about 10 px across at 390×844); it answers Russia, but Russia is meant to be found by its mainland.
4. **Lakes are not in the map data**, so they are drawn as land. Estonia–Russia's crossing no longer lies in one (follow-up below); the other legs were not checked against lakes.
5. **Deep zoom** draws the Quick Challenge's tiles; no new tiles.
6. **The illustration's brief and generation prompt** are not recorded.
7. **`e2e/level10.spec.ts`** still checks the close-up's caption for "Denmark" (see `docs/LEVEL11-CHECKPOINT.md`), expected to fail when run.

## Preview

Built into `.next-l12/` (locally excluded from git; `tsconfig.json` reverted after each build) and served from that same folder on **http://localhost:3400**. Rebuild with `NEXT_DIST_DIR=.next-l12 npx next build`, then restart `next start -p 3400` with the same `NEXT_DIST_DIR`: a running server keeps serving the build it started with. The Level 11 preview (`.next-l11/`, port 3300) is still running, untouched.

## Follow-up (2026-10-16): Estonia–Russia's crossing off Lake Peipus

The Estonia–Russia crossing was rule 1's vertex in the middle of Lake Peipus (27.4986, 58.5347), so Tallinn → Russia crossed the lake as land. It is now **27.5536, 57.7949**, an **approximate crossing near Koidula**, on land south of Lake Pskov, about 5 km south-west of the real Koidula–Kunichina Gora checkpoint (road 63 Karisilla–Pechory and the Tartu–Pechory railway, just north-west of Pechory; the road meets the border at about 57.833, 27.598, from OpenStreetMap). It is the vertex of the data's simplified border nearest that road crossing whose straight legs keep rule 1's clearances (10.9 km in Estonia, 10.0 km in Russia), not the checkpoint itself. The real crossing is on land: no bridge or link, no turning points; a move is still 3 points and a two-move route 5. Mission, both winning routes, wrong turns and graph unchanged; no other crossing, level, data or relief file touched.

- Changed: `src/core/lessons/russia-and-western-neighbours.ts` (the point and its comment), `src/geo/route.test.ts` (the expected point; new assertions: within 6 km of the checkpoint's road crossing, south of 57.83°N, and Moscow's leg south of 57.8°N west of 28.6°E), `docs/DATA.md` ("Level 12" under "Travel route line").
- Chosen by a scratch selection script (the vertex and its clearances, on the eastern data in the shared projection), not a test. **No unit test or e2e spec was run.**
- Checks: `npx tsc --noEmit` and `npx eslint .` (ignoring `.next-*/`): clean. One focused Chromium run (a scratch Playwright script, not the specs) of Estonia → Russia → Belarus on the rebuilt preview, 390×844 and 1366×800, English: 3 then 5 route points, the traveller in Moscow, Journey complete!; the drawn crossing 0.00 px from the new point (the old one would be 13.9 px away on the phone, 26.0 px on desktop), with only Estonia and Russia within 3 px of it; no page errors, no horizontal overflow. Nothing else was checked (Latvia's route, wrong turns, Armenian, other levels).
- Preview: rebuilt into `.next-l12/` (build `f_qFbm7FHb4FP6iSlES5D`; `tsconfig.json` reverted after the build) and served from it on http://localhost:3400, its page carrying that build id.

## Owner's review (2026-10-16)

The owner reviewed the preview on http://localhost:3400 (build `f_qFbm7FHb4FP6iSlES5D`) and **approved visually** Level 12's route, with Estonia–Russia's approximate crossing near Koidula, and Saint Basil's Cathedral's illustration. This is a visual approval; the tests and specs listed above have still not been run.
