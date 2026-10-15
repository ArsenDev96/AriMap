# Level 11 (Across the Channel): checkpoint

Written 2026-10-15, at the end of the implementation pass; updated the same day for commit. The unit tests and e2e specs written or updated for it have not been run (by request: "don't run suites or specs in this implementation pass").

## Approval

Reviewed by the owner on the local preview (`.next-l11/`, port 3300) on 2026-10-15: **the gameplay, the illustrations and the amber Travel note are approved.** No gameplay, label or framing change was made after that review.

## Changes after the implementation pass

Both requested after the first review, both style only:
- **The Travel note on a soft pale amber** (`#FFF3CD`), so a journey's explanation stands out from the blue panel: a `travelNote` class on Travel's note (`TravelPanel.tsx`) and a `.screen .travelNote` rule after `.screen .note` (`LessonScreen.module.css`). It is Travel's one shared note, so it applies to every level (Levels 10 and 11's own notes, and the usual one). Its text, colour, spacing, type and layout are unchanged; Discover's note and Results' keep the blue tint.
- **Levels 9, 10 and 11's card colours** on the levels page (`WelcomeScreen.module.css`): the per-level `--tone` stopped at Level 8, so those three cards had no colour band, a default outline, no shadow (a box-shadow using an undefined variable is dropped whole) and an untinted number and picture tile. Added: Level 9 `#e0883a`, Level 10 `#5b7fe0`, Level 11 `#b0679f`. Levels 9 and 10's gap predates this pass.

One rebuild of the preview showed the note still blue: port 3300 was serving the `.next-l11/` build made before the change (a rebuild into `.next/` doesn't reach a running `next start` of another folder). Rebuilt and restarted; no code change was needed.

## Decisions (as given for this pass)

**Content**
- Stable id `across-the-channel`, unlocked by `nordic-countries` (Level 10). Title "Across the Channel" / «Լա Մանշի այն կողմ»; description "Explore north-western Europe, from Germany to Ireland." / «Ուսումնասիրիր Հյուսիսարևմտյան Եվրոպան՝ Գերմանիայից մինչև Իռլանդիա։»
- Countries: United Kingdom, Ireland, France, Belgium, Germany. New landmarks Big Ben and the Cliffs of Moher; France's, Belgium's and Germany's artwork and content reused. Card picture: Big Ben.
- The United Kingdom's hint says it "includes Great Britain and Northern Ireland"; Ireland's explains the shared island. Belgium has a level-specific hint (the Netherlands is not in the level). The Quick Challenge's existing names and label points for the UK and Ireland were moved into the shared content unchanged.

**Travel**
- Berlin → London, one shortest route Germany → France → United Kingdom, two crossings. Luxembourg is Travel only, so the wrong turns offer a second way on; the winning route is unchanged.
- The Channel Tunnel is an explicit named fixed link (`map.borderLinks`, as Level 10's Øresund), never called a land border. Its frontier and alignment follow the sources below. The visible Travel note is one sentence; the Northern Ireland explanation is in the hints.
- Ireland is in Discover and Find; the journey ends on reaching the United Kingdom. The UK–Ireland border is in the data and the graph as the real land border it is; no rule forbids journeys from or through Northern Ireland.

**Map and assets**
- A separate, dynamically loaded `channel` dataset in the shared projection; Northern Ireland, Shetland, Orkney and Corsica kept; the Crown Dependencies faded context. Earlier datasets and every tile unchanged.
- The close-up mechanism reused for Belgium and the Strait of Dover, measured on small phones; the short-map toolbar and the traveller's clearance reused as they are.
- Display WebPs and Big Ben's thumbnail from the existing script; only Level 11's relief overview generated; deep-zoom tiles deferred.

## The proposal and its sources

The reviewed proposal this pass was to follow was not available to it (no file in the repository or conversation it could read held it). Its "sourced facts" for the two landmarks and the Channel Tunnel were therefore re-established from primary sources on 2026-10-15 (docs/CONTENT.md, "Level 11"; docs/DATA.md, "Level 11", "Travel route line"), and two assumptions changed on the way:
- **The tunnel's frontier is the 1982 continental-shelf line**, not the 1988 territorial-sea line: the Treaty of Canterbury, Article 3, names the agreement of 24 June 1982. The 1988 agreement reuses the same points (8–11) in the Strait of Dover, so the line the tunnel crosses is the same.
- **The Cliffs of Moher's length is left out**: sources disagree (about 14 km, Wikipedia; 8 km as the crow flies, Tourism Ireland; none on the official site).

Please compare these with the proposal; if it differs, say how.

## What changed

**Data and scripts**
- `scripts/prepare-channel-geo.mjs` (new) → `src/data/geo/europe-channel.topo.json` (new): 242.2 KiB raw, 84.8 KB gzipped, 58 countries; the levels' quantization grid; France, Belgium, Germany, Luxembourg, the Netherlands, the UK and Ireland vertex for vertex the levels' shapes. Deterministic (two runs, identical bytes).
- `scripts/generate-relief.mjs`: Level 11's `LEVEL_AREAS` entry (`dataset: "channel"`, `overviewPx: 0.5`) and the Channel data; `--overview across-the-channel` made the only new relief files.
- `scripts/prepare-landmarks.mjs`: `big-ben` thumbnail.

**Code**
- `src/core/lessons/across-the-channel.ts` (new): borders, mission `deu-to-gbr`, the note, Belgium's hint, coverage `[2390, 880]`, the close-up, Luxembourg's callout, the crossings (Level 1's six and the tunnel's frontier), the tunnel link.
- `src/core/lessons/levels.ts`: Level 11 after Level 10. `types.ts`: `dataset` may be `"channel"`; new `inset.autoOpen` (below).
- `src/core/content/countries.ts`: GBR and IRL; `names.ts` and `ChallengeMap.tsx`: their challenge-only names and label points removed (the same values now come from the shared content).
- `src/geo/regionMap.ts`: datasets of their own generalised (`setMapData`, one dynamic import per file; `setNorthData` kept).
- `src/components/map/RegionMap.tsx`: `inset.autoOpen: false` keeps the close-up from opening by itself in Discover (Level 11 only; below). `Relief.tsx`, `LandmarkCard.tsx`, `WelcomeScreen.tsx`: the new overview, artwork and thumbnail registered.

**A fix found in the browser.** At 200% text on a 320×568 phone, selecting France, Belgium or the United Kingdom in Discover made the close-up open by itself (the shared rule for a name with no clear spot), though those names are not shown in it; open, it covered Ireland (tap circle 10 → 0–4 px) and, in Armenian, left no names on the map. Level 11 now sets `inset.autoOpen: false` (the toggle still opens it), and `calloutDotsClearControls: true` as Level 10 does, so the countries under the controls' row are named when selected (France at 568×320 with 200% text, for one). No other level sets either new value differently.

**Assets** (originals unchanged; every other file in `src/assets`, `src/data` and `public`, 1,364 files, byte-identical before and after by SHA-256; `relief.json` gained only Level 11's overview entry, version `a45fb07217` unchanged)

| Asset | Details |
|---|---|
| Originals | `public/images/landmarks/big-ben.png` 1254×1254, 1,263,169 B; `cliffs-of-moher.png` 1586×992, 2,364,830 B; RGBA, transparent, silhouettes complete |
| Display WebPs | `big-ben.webp` 512×720, 319,330 B (312 KiB); `cliffs-of-moher.webp` 720×381, 369,734 B (361 KiB) |
| Thumbnail | `thumbnails/big-ben.webp` 111×156, 12,340 B (12.1 KiB) |
| Relief overview | `across-the-channel-land.webp` 2391×881, 356,460 B; `-tone.webp` 576×725, 86,968 B |
| Map data | `europe-channel.topo.json` 247,962 B (242.2 KiB), 84,828 B gzipped |

**Tests written or updated (not run)**: `levels.test.ts` (eleven levels; a Level 11 block: unlock from a Level 10 save, progress apart, the graph and tunnel, the route, wrong turns, Undo, Restart, refresh, replay, Find, all eleven completed; Level 10 now has a Next level; 33 stars), `rating.test.ts` (33), `content.test.ts` (Level 11's content), `regionMap.test.ts` (the Channel data; short maps; the traveller's pin; the close-up's settings), `route.test.ts` (the tunnel, the crossings, the routes), `relief.test.ts` (the overview and its geography); `e2e/level11.spec.ts` (new), and `level6`–`level10`, `continents`, `levels`, `results-next`, `stars` and `phone-layout` for eleven levels and 33 stars. The new unit tests' numeric claims were checked with scratch scripts against the real modules (all held).

## Checks run

- `npm run typecheck`: clean. Lint: clean for the sources (`npx eslint --ignore-pattern ".next-preview/**" --ignore-pattern ".next-l11/**"`); `npm run lint` alone also reports about 3,500 problems in the ignored preview build output (`.next-preview/`, from an earlier session; `.next-l11/`, this pass's), as before.
- Browser: see "Browser checks" below.
- After the two style changes: typecheck and lint (as above) clean after each, and again at commit preparation. In the browser, one element each (Chromium, scratch scripts, on the rebuilt preview): Level 11's Travel note has classes `note travelNote` and a computed background of `rgb(255, 243, 205)` (`#FFF3CD`), from the `.screen .travelNote` rule; on the levels page at 390×844 with all eleven completed, cards 1–11 each have their own `--tone`, edge band and outline (1–8 unchanged). Not rechecked: other levels' Travel notes, other sizes, WebKit, Armenian.
- Commit preparation (2026-10-15): the diff reviewed file by file. Four debug captures a scratch script had written to the repository root (`belgium-{100,200}-{en,hy}.png`, not part of the work) were moved out of the repository. Build output (`.next/`, `.next-e2e/`, `.next-l11/`, `.next-preview/`), `next-env.d.ts`, `tsconfig.tsbuildinfo`, `screenshots/` and `test-results/` are ignored (`.next-l11/` by a local `.git/info/exclude` entry only); `tsconfig.json`, `next-env.d.ts`, `package.json`, `package-lock.json`, `.gitignore`, `AGENTS.md` and `CLAUDE.md` are unchanged; `git diff --check` is clean.

## Browser checks

On an isolated production build (`.next-l11/`, port 3300; `tsconfig.json` reverted after each build), with scratch Playwright scripts, not the e2e specs. **Chromium and WebKit, English and Armenian, at 320×568, 390×844, 1366×800 and 320×568 with 200% text**, each run through:
- **Unlock** from a completed Level 10 save (Levels 1–10 completed, mixed saved best ratings): Level 11 "Ready to play" and up next, its countries and description, Big Ben's thumbnail (hidden by design at 320×568, as every card's), the main action "Start Level 11", Europe's stars 30/33; earlier levels' saves unchanged by playing.
- **Discover**, all five: card name, capital, hint (the UK's, Ireland's and Belgium's level hint checked in English), landmark card with its own art (alt text, loaded, uncropped and unstretched), the selected country named on the map; no horizontal overflow. Belgium through the close-up where its tap circle is under 20 px (320×568).
- **Find**, each of the five asked: no names, tones or art on the map, the close-up unnamed; answered by a tap (Belgium through the close-up on phones).
- **Travel**: the note; Germany offers France, Belgium, Luxembourg; Belgium → Luxembourg out of crossings (route 5 points); Undo; Belgium → France out of crossings; a reload keeps it; Retry; Luxembourg offers France or Belgium; Restart; France offers the United Kingdom, Belgium, Luxembourg (route 3 points); the United Kingdom: Results, the route through the tunnel (22 points), no Next level, 2 stars with Undo used; Replay journey without help (the badge); back to the levels: all eleven completed ("You've completed all 11 levels!" / «Ավարտել ես բոլոր 11 մակարդակները։ …»), stars 32/33. **The traveller's pin** whole and clear of the zoom controls, "About the map" and the close-up in every state; the zoom controls on the map, or below it at 200% text (map 304×150 / 304×112, 304×156 in Results), 44 px, reachable; the United Kingdom 100% in view. The traveller's country (Luxembourg included) named on the map.
- No page errors.

Results: **every check passed in both engines, both languages, at all four sizes**, but for the names at 200% text below (limitation 2). Along the way: in WebKit, three runs first stopped on 8 s step timeouts at different steps (none reproduced alone; all passed with 20 s), and one tap point the scripts chose for the United Kingdom lay on Morecambe Bay's coastline (the middle of the UK's shape is that bay), where WebKit sends a click to the shallow-water band rather than the land: 36 of 36 inland points tapped the United Kingdom, and the scripts and `e2e/level11.spec.ts` now choose an inland point.

Also measured (Chromium; WebKit the same): the close-up's placement and tap room at 320×568, 390×844, 740×360, 1366×800 and with 200% text (docs/DATA.md, "Level 11"); every Discover selection at six sizes, before and after the close-up fix; the Quick Challenge played through in both languages (15 questions, 60 s, the United Kingdom and Ireland asked under their usual names, no page errors; its pool of 40 is unchanged code).

**Not checked in the browser:** landscape phones beyond the close-up's placement (740×360) and the Discover names survey (568×320); the e2e specs' own assertions (not run); a real iPhone (WebKit here is Playwright's Windows build).

## Remaining limitations

1. **No suite or spec has been run** for this pass: the unit tests and e2e specs above are written, typechecked and linted only. Their numeric claims were checked with scratch scripts against the real modules. Run them before merging (the full e2e run took about 50 minutes at Level 10). The style changes after the review touch nothing the specs assert (they check the Travel note's text, and its place in view, not its colour).
2. **Names at 200% text on a 320×568 phone in Armenian (304×112 map)**: with Germany or Belgium selected in Discover, its name is not drawn on the map (its only part clear of the controls' row is too short for it); the card names it, as for Level 10's Denmark. With nothing selected, that map names the United Kingdom, Ireland and France only. Opening the close-up by its toggle on these maps hides the main map's names, as in every level.
3. **The close-up at 200% text**, opened by its toggle, covers Ireland on the 304×112 map (as Level 10's covers Iceland); it is closed by default and never opens by itself there.
4. **Armenian wording needs native review**: «Մոհերի ժայռեր», «Օ'Բրայենի աշտարակ», «Լա Մանշի թունել», the two facts, the hints, the Travel note, the title «Լա Մանշի այն կողմ» and the region «Հյուսիսարևմտյան Եվրոպա» (docs/CONTENT.md, "Level 11").
5. **The tunnel's frontier point is derived** (datum shift, OpenStreetMap's mapping of the tunnels, rounding: tens of metres), adequate for a schematic route at about 1.5 km per world unit, not a survey. The tunnel's line is one line for its three bores, simplified within 75 m.
6. **Deep-zoom relief deferred**: zoomed in furthest, Level 11 shows level-2 tiles (the Quick Challenge's, the levels' where they exist).
7. **The original proposal was not available** to this pass; its facts were re-sourced (above). Two assumptions changed (the 1982 line; the cliffs' length left out); please compare.
8. **The briefs and generation prompts of the two new illustrations** are not recorded (as for Level 10's).
9. **A spec assertion inherited from Level 10**: `e2e/level10.spec.ts` (written earlier, never run) checks that the close-up's caption names Denmark, but the caption is always "Close-up"; the country is in the close-up's accessible name. Level 11's spec checks the accessible name instead; Level 10's was left as it was, so it is expected to fail when run.
10. **`relief.json` is written with LF line endings** by `scripts/generate-relief.mjs` (as before this pass); Git warns it will be converted on checkout. It is stored as LF either way.
