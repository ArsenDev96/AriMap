# Map data

The playable map is drawn from real country boundaries. No map image, hand-drawn polygons, or runtime map service is used.

## Source

| | |
|---|---|
| Dataset | Natural Earth — Admin 0 – Countries, 1:10m cultural vectors |
| Version | 5.1.1 (from `ne_10m_admin_0_countries.VERSION.txt`) |
| Download | https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_0_countries.zip (listed at https://www.naturalearthdata.com/downloads/10m-cultural-vectors/) |
| License | Public domain. Natural Earth's terms of use: https://www.naturalearthdata.com/about/terms-of-use/ (attribution not required, but appreciated: "Made with Natural Earth.") |
| Prepared file | `src/data/geo/europe-west.topo.json` (TopoJSON, ~260 KiB, ~88 KiB gzipped, 65 countries) |

### Why 1:10m and not 1:50m

At 1:50m, Luxembourg has only 46 vertices, which looks crude when zoomed or shown in the magnified inset. At 1:10m it has 197 vertices before simplification and 128 after.

## Preparation

The steps are reproducible with `scripts/prepare-geo.mjs`, which uses mapshaper:

```bash
# download + unzip the Natural Earth archive first
npm run prepare:geo -- path/to/ne_10m_admin_0_countries.shp
```

1. **Keep fields:** `ADM0_A3` (becomes the feature `id`) and `NAME_EN` (becomes `name`, for debugging only; the UI uses localized names from `src/core/content`). `ADM0_A3` is used instead of `ISO_A3` because Natural Earth has historically set `ISO_A3 = -99` for France and Norway.
2. **Clip to a regional box:** lon −27…36, lat 32…62, with sliver removal. This keeps surrounding countries as muted context. It also removes every overseas territory (French Guiana, Réunion, Saint Martin, Caribbean Netherlands, …), so they cannot stretch the viewport or add border shortcuts. For example, France and the Netherlands really do share a border on Saint Martin.
   The box is deliberately much larger than the lesson. Clipping cuts land along straight lon/lat lines, and in the map projection those lines appear as diagonal "coastlines" if they come into view. The previous box (lon −12…22, lat 38…59) was visible on wide desktop maps (e.g. 1920×1080) as a hard diagonal edge east of Germany. See *Coverage and view limits* below.
3. **Simplify:** `-simplify variable interval=… keep-shapes` (Visvalingam). About 400 m tolerance for the lesson countries and the neighbours visible when zoomed in (UK, Ireland, Spain, Andorra, Monaco, Italy, San Marino, Vatican, Switzerland, Liechtenstein, Austria, Czechia, Poland, Denmark); about 1.5 km for distant context that only appears at the edges of wide screens. The lesson countries have the same detail as before. `keep-shapes` prevents small countries (Luxembourg, Andorra, Liechtenstein, Monaco…) from being removed. TopoJSON stores each shared border as one arc, simplified once, so neighbouring countries keep identical borders with no gaps or overlaps.
4. **Export TopoJSON:** quantization 1e5, one object named `countries`, ids = `ADM0_A3`.

## Verification (automated: `src/geo/regionMap.test.ts`)

- Shared TopoJSON arcs (`topojson.neighbors`) give exactly the lesson border graph among the five active countries:
  France: Belgium, Luxembourg, Germany · Belgium: France, Netherlands, Luxembourg, Germany · Netherlands: Belgium, Germany · Luxembourg: France, Belgium, Germany · Germany: France, Belgium, Netherlands, Luxembourg.
  This matches the real land borders. The game graph deliberately leaves out borders with countries outside the practice region, such as France–Switzerland or Germany–Poland.
- The same for Level 2 (Around the Alps): France: Switzerland, Germany, Italy · Switzerland: France, Germany, Austria, Italy · Germany: France, Switzerland, Austria · Austria: Switzerland, Germany, Italy · Italy: France, Switzerland, Austria. Germany–Italy and France–Austria do not meet. Borders with Liechtenstein, Slovenia and others are left out. France → Austria takes two crossings, by three equally short routes (through Switzerland, Germany or Italy), and all three are accepted.
- Levels 3–5 are not playable yet, but their proposed groups are checked too: every country is in the data, and each group is connected by shared boundaries, with at least one pair two or more crossings apart. Central Europe is dense (Germany–Slovakia and Poland–Austria need two crossings). Along the Adriatic is a chain: Italy's only neighbour in the group is Slovenia, and Italy–Montenegro takes three. Towards Greece: Greece's only neighbour in the group is Bulgaria, and Hungary–Greece takes three.
- The Level 2 border arcs are at full detail (2.2–3.0 km per vertex, as for Level 1's borders), including those with neighbours drawn at 1.5 km elsewhere (Austria–Hungary, Austria–Slovenia, Italy–Slovenia).
- Every capital and landmark coordinate lies inside its country's polygon (`d3.geoContains`).
- France's projected bounds lie inside the regional focus area, so no overseas geometry remains.

## One projection for every level

Every level is drawn in the same projected "world" coordinates: `d3.geoAzimuthalEqualArea`, rotated to 8°E 50°N and fitted to Level 1's countries (`PROJECTION_FIT` in `src/geo/regionMap.ts`). The painted landscape is rendered in these coordinates (see TERRAIN.md), so it lines up with every level's map, and Level 1 looks exactly as before. A level only chooses which countries are the focus (the initial view and pan limits) and its coverage. Level 2 lies within about 12° of the projection's centre, so its shapes are barely distorted: Italy's heel turns by about 7°.

## Coverage and view limits

`src/geo/regionMap.ts` defines a projected **coverage rectangle** centred on each level's countries. For Level 1 it is ±1150 × ±900 world units (the default), with Level 1 fitted to 1000. Level 2's countries span 1221 × 1420 units (Lampedusa to the Baltic coast). The prepared data allows at most about ±1100 × ±845 around them, so its coverage is ±1090 × ±840 (`map.coverageHalf` in `src/core/lessons/alps.ts`). Every point of it lies inside the clip box, which `regionMap.test.ts` checks along its whole outline for every playable level. `MAP_DATA_CLIP` in the same file must match `BBOX` in the script. A test checks it against the data's extent.

`viewLimits()` derives the zoom/pan limits from it:

- **Initial view and "show the whole map"**: the level's countries fitted with padding, centred. If the map is so wide or tall that this would show beyond the coverage, it zooms in just enough to stay inside instead. For Level 1 that happens beyond about 1:1.9 to 2.2:1 (e.g. a phone in landscape). Level 2 still shows all five countries whole on maps from about 1:1.37 (tall) to 1.53:1 (wide). Measured with `viewLimits`' rule, that covers phones in portrait, tablets in landscape, and desktops up to 1920×1080 and 2560×1440, which get slightly less padding. A tablet in portrait (a 1.6:1 map) shows 96% of the height, so Lampedusa or the Baltic coast is just outside the view until the player pans. An ultra-wide 2.15:1 map shows 71%.
- **Minimum zoom** equals that initial view, so zooming out can never reveal the data edge.
- **Panning** (when zoomed in) is limited to the level's area plus 25% on each side, clamped to the coverage.

Tests check that the base view and pan limits stay inside the coverage for phone, tablet, desktop and ultra-wide sizes, and that typical phone and desktop maps (304×294 to 1464×1000) show every country of each level whole.

### Levels 3–5

They are not playable yet, and no data was prepared for them. Level 3 (Central Europe) lies inside the current clip box. Levels 4 and 5 reach the southern Balkans and Greece (to about 29.6°E with Rhodes and Kastellorizo). Their coverage would need the clip box extended east and south (Turkey, the Black Sea, Crete), which means rerunning `scripts/prepare-geo.mjs` with a larger `BBOX`. Greece is about 20° from the projection's centre, so Levels 4–5 may also want a projection centred on them, with their own relief.

## Rendering

- Projection: `d3.geoAzimuthalEqualArea`, rotated to 8°E 50°N and fitted to Level 1's five countries, for every level (`src/geo/regionMap.ts`, see *One projection for every level*).
- Shapes, labels, capital markers, landmark pins, the route line and the hint circle all use this same projection. They are placed with the same `d3-zoom` transform; the inset reuses the same projected paths with a fixed magnifying transform.
- **Small countries and the close-up are set per level** (`map.smallCountries`, `map.inset`). Level 1 names Luxembourg in a callout and has the close-up described below. Level 2 has neither: Switzerland and Austria are large enough to tap at the whole-map view, and it inherits no inset, caption or Luxembourg rule. (On a 320px map Switzerland's name gets the general "no room inside its country" callout, as Belgium's does in Level 1.)
- Luxembourg is never enlarged. It is made selectable through zoom (pinch, wheel or +/−) and through the magnified inset, which uses the true geometry, so taps resolve to the correct country. There are no invisible hit areas.
- The area shown in the inset is outlined (dashed) on the main map while the inset is open, and the inset's caption ("Close-up" / «Խոշորացում») carries the same dashed key. The caption never names a country. The inset's accessible label names Luxembourg only while its name is already visible on the map, so the Find answer and hidden Travel countries are never revealed.
- The inset is at least 112px wide (100px on maps narrower than 420px), and shrinks further when needed to fit on short maps. On wide maps (600×420px and up) it sits top-left and starts open. On smaller maps it sits bottom-left, opposite the zoom controls, and opens upwards over western France, which keeps the crowded Low Countries clear.
- Luxembourg's label is drawn in a callout with a leader line to its label point (inside the country, checked by tests). The callout must be **nearby**: at most 18px beyond the country's edge (leader length minus half the country's size). Candidate positions are tried nearest first, including positions level with the dot. Callouts never cover markers (capitals, landmarks, the traveller) or map controls, never cover another small country's leader dot, and prefer sea or faded neighbours over the middle of another lesson country. The first position whose overlapped or crossed country names can all move to a free spot inside their own countries wins.
- In Discover only: if no nearby, clear position exists at the whole-map view, the close-up opens by itself and Luxembourg's name is drawn inside it (kept off Luxembourg's own shape) instead of on the main map, never both. It stays open for the rest of Discover. Find answers and Travel moves never open it; there, and whenever the close-up is closed, the name takes the best clear spot on the main map or is left out rather than overprinted. The toggle works in every stage, and the player's open/closed choice holds for the stage in which it was made. Only names the view already shows count, so this never reveals a Find answer.
- When the Travel traveller stands in a country whose name is in a callout, and its pin would cover the callout's dot (Luxembourg), the leader starts at the pin's tip, at the real capital, and the dot is not drawn. During a move the dot stays until the pin lands (at once with reduced motion). When the traveller leaves, or Undo takes it away, the dot returns. This applies in the main map and the close-up alike.
- Country names: each sits at its label point, or moves to the nearest free spot inside its own country, clear of the controls, the inset, markers, small countries' leader dots and other names. The smallest countries are placed first, for inline names and callouts alike. When nothing near the label point is free (it may be hidden under the close-up or the controls, e.g. France zoomed in on a phone with the close-up open), the whole visible part of the country is searched, nearest first, and the whole name must lie inside the country. Only a name with no room anywhere inside its visible country (e.g. Belgium or the Netherlands beside their capitals on a 320px map) gets a nearby callout, preferably over the sea.
- Map chrome (the zoom controls, "About the map", and the close-up with its caption and toggle) is never covered by a name or callout, and no leader line crosses it, not even as a last resort. A callout never points at a dot hidden under that chrome; such a name is left out until the view changes. So is a name whose label point is off screen when nothing in its visible part fits and its label point would put it under chrome.
- In Discover, an explored country's name carries a check badge (a check mark in a circle, so it doesn't rely on colour). The badge is part of the name's box for every collision rule. Explored names also say "explored" to screen readers. Find and Travel never show badges.
- Capital and landmark names are placed after all country names, beside their marker on the first free side, clear of callouts and leader lines. If no side is free, country names in the way move if they can. If they can't, the capital name is left out rather than printed over another name (the marker stays, the country card names the capital, and zooming in brings it back). This happens only in cramped cases at 320px.
- The landscape (atlas surface and painted relief from elevation data) is the same in every stage and in the close-up. It lies on the country fills, under borders, the Find answer outline, routes, names and markers, and takes no pointer events. Forests are painted into the same landscape from ESA WorldCover tree cover. In Discover, a few wave marks are added at sea; they give way to every name and marker. Sources, credits and rules are in [TERRAIN.md](TERRAIN.md).
- "About the map" (a round "i" button in the map's top-right corner) lists the map's sources and the elevation credits. Names keep clear of its corner like the other map controls.
- On maps narrower than 420px, labels use a slightly smaller font (13px country names, 11.5px capitals). Once zooming makes Luxembourg wide enough, its name is drawn inside it.

## Travel route line

The Travel route is a schematic country journey, not a road route. Each move is drawn as two straight lines: from the current country's capital to a point on the border it shares with the next country, then on to that country's capital (`src/geo/route.ts`). There is no curve smoothing, so the line cannot bulge across other borders. The main map and the inset draw the same projected line. The line is derived from the journey's country sequence, so Undo and Restart remove the matching segments. Reversed moves reuse the same crossing.

Map feedback (`src/components/map/RegionMap.tsx`), played only for changes made while the map is on screen:
- **Travel move:** only the new segment (capital → border crossing → capital) draws itself along that same path. Then the traveller, a navy pin distinct from the round coral capital markers, lands on the current capital. Undo, Restart, a refresh or a language switch show the final state at once, with nothing replayed.
- **Arrival:** the whole route glows once.
- **Find:** a correct answer briefly outlines the country in teal and a wrong one in coral. The outline fades out over the unchanged border, and nothing moves or shakes.
- **Reduced motion:** every one of these shows its final state immediately. None of them delays input or advances the lesson.

The crossing for each border is stored in the level's definition (`map.routeCrossings` in `src/core/lessons/western-europe.ts` and `alps.ts`). Each is a vertex of the two countries' shared border in the prepared TopoJSON: the vertex nearest the middle of the longest shared border line (by length) from which straight lines to both capitals stay inside their own country.

| Border | Crossing (lon, lat) | Distance from border middle |
|---|---|---|
| Belgium–France | 4.1804, 50.1272 | 0.8 km |
| France–Luxembourg | 6.0634, 49.4486 | 0.3 km |
| Germany–France | 8.0906, 48.9791 | 0.6 km |
| Belgium–Netherlands | 5.2333, 51.2558 | 0.5 km |
| Belgium–Luxembourg | 5.7189, 49.8914 | 0.0 km |
| Belgium–Germany | 6.3319, 50.4470 | 4.8 km |
| Germany–Netherlands | 6.4791, 51.8531 | 1.1 km |
| Germany–Luxembourg | 6.4148, 49.8056 | 0.1 km |

The Belgium–Germany crossing sits 4.8 km from the middle of the border because the border is jagged there: from the exact middle, the line from Brussels would clip into Germany.

`src/geo/route.test.ts` checks, for all 16 directed moves:

- every lesson border has a crossing;
- each crossing lies on the real shared border (within 50 m);
- the line as drawn (straight in the map projection) stays inside the start country up to the crossing and inside the next country after it, apart from the last 3 km at the border itself;
- reversed moves retrace the same line;
- undoing a move leaves a prefix of the line;
- both shortest mission routes (France → Belgium → Netherlands and France → Germany → Netherlands) never enter another lesson country;
- France → Germany never passes through Belgium or Luxembourg.

If the map data or a capital changes, rerun the tests. If a crossing fails, pick another vertex of that shared border using the rule above.

### Level 2

In the Alps a straight line from a capital to a border often leaves its country. Rome to the French Alps runs along the Ligurian coast and out to sea. Berlin to the Inn cuts through Czechia. Vienna to the west crosses Germany's Berchtesgaden salient or the narrow Tyrol. So a leg may turn at points inside its country (`map.routeVia`, keyed "country@border", listed from the capital towards the crossing), still as straight lines with no smoothing. Level 2's crossings and turning points were chosen by the same rule, extended:

1. The vertex nearest the middle of the longest shared border line from which straight lines to both capitals stay inside their countries **and at least 10 km from any coast or other border**. The first 10 km around a capital and the 15 km around the crossing are exempt, because a line must reach the border there, and Rome surrounds the Vatican.
2. If none works, the vertex among the 30 nearest the middle that needs the fewest turning points. Turning points are chosen from a 12 km grid at least 10–20 km inside the country, taking the shortest leg.
3. In the narrow Alpine countries the clearance is 5 km where 10 km finds no route or needs more turning points (Switzerland–Italy, Austria–Italy, Switzerland–Austria, France–Italy).

France–Germany keeps Level 1's crossing (same capitals, and it passes the same checks).

| Border | Crossing (lon, lat) | From border middle | Turning points |
|---|---|---|---|
| France–Switzerland | 6.1104, 46.5209 | 7.0 km | none |
| France–Germany | 8.0906, 48.9791 | 0.6 km | none (Level 1's) |
| France–Italy | 6.6400, 45.0503 | 38 km | Italy: 10.13, 44.18 (Lunigiana, inland of La Spezia) |
| Switzerland–Germany | 8.1221, 47.5922 | 70 km | none |
| Switzerland–Austria | 9.8703, 46.9928 | 25 km | Austria: 12.92, 47.36 (Pinzgau, south of the Berchtesgaden salient) |
| Switzerland–Italy | 9.1632, 46.1723 | 23 km | none |
| Germany–Austria | 12.1820, 47.6921 | 0.1 km | Germany: 11.90, 50.51 (west of the Czech border); Austria: 12.92, 47.25 |
| Austria–Italy | 11.5962, 47.0003 | 51 km (near the Brenner Pass) | none |

`src/geo/route.test.ts` runs the same checks for Level 2's 16 directed moves, with every leg (capital → turning points → crossing → turning points → capital) inside its own country. It also checks that turning points exist only for the level's borders, and that all three shortest routes (France → Switzerland/Germany/Italy → Austria) never enter another country of the level. The drawn line is inside land throughout, so no journey crosses the sea: the Travel e2e test checks France → Italy is drawn with its turning point (four points).

## Content coordinates

Capital and landmark positions (WGS84, `src/core/content/countries.ts`) are city-centre or monument coordinates, rounded to about 4 decimals: Paris 48.8566, 2.3522 · Brussels 50.8503, 4.3517 · Amsterdam 52.3676, 4.9041 · Luxembourg City 49.6116, 6.1319 · Berlin 52.5200, 13.4050 · Bern 46.9481, 7.4475 · Vienna 48.2083, 16.3725 · Rome 41.8933, 12.4828. They match commonly published values (Wikipedia/GeoNames). Landmark positions and their sources are listed in [CONTENT.md](CONTENT.md). The tests above confirm each point falls inside its country.
