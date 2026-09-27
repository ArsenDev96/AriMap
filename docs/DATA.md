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
- Every capital and landmark coordinate lies inside its country's polygon (`d3.geoContains`).
- France's projected bounds lie inside the regional focus area, so no overseas geometry remains.

## Coverage and view limits

`src/geo/regionMap.ts` defines a projected **coverage rectangle** centred on the lesson countries (±1150 × ±900 world units, with the lesson fitted to 1000). Every point of it lies inside the clip box, which `regionMap.test.ts` checks along its whole outline. `MAP_DATA_CLIP` in the same file must match `BBOX` in the script. A test checks it against the data's extent.

`viewLimits()` derives the zoom/pan limits from it:

- **Initial view and "show the whole map"**: the lesson countries fitted with padding, centred. If the map is so wide or tall that this would show beyond the coverage (aspect ratio outside about 1:1.9…2.2:1, e.g. a phone in landscape), it zooms in just enough to stay inside instead.
- **Minimum zoom** equals that initial view, so zooming out can never reveal the data edge.
- **Panning** (when zoomed in) is limited to the lesson area plus 25% on each side, clamped to the coverage.

Tests check that the base view and pan limits stay inside the coverage for phone, tablet, desktop and ultra-wide sizes.

## Rendering

- Projection: `d3.geoAzimuthalEqualArea`, rotated to 8°E 50°N and fitted to the five active countries (`src/geo/regionMap.ts`).
- Shapes, labels, capital markers, landmark pins, the route line and the hint circle all use this same projection. They are placed with the same `d3-zoom` transform; the inset reuses the same projected paths with a fixed magnifying transform.
- Luxembourg is never enlarged. It is made selectable through zoom (pinch, wheel or +/−) and through the magnified inset, which uses the true geometry, so taps resolve to the correct country. There are no invisible hit areas.
- The area shown in the inset is outlined (dashed) on the main map while the inset is open, and the inset's caption ("Close-up" / «Խոշորացում») carries the same dashed key. The caption never names a country. The inset's accessible label names Luxembourg only while its name is already visible on the map, so the Find answer and hidden Travel countries are never revealed.
- The inset is at least 112px wide (100px on maps narrower than 420px), and shrinks further when needed to fit on short maps. On wide maps (600×420px and up) it sits top-left and starts open. On smaller maps it sits bottom-left, opposite the zoom controls, and opens upwards over western France, which keeps the crowded Low Countries clear.
- Luxembourg's label is drawn in a callout with a leader line to its label point (inside the country, checked by tests). The callout must be **nearby**: at most 18px beyond the country's edge (leader length minus half the country's size). Candidate positions are tried nearest first, including positions level with the dot. Callouts never cover markers (capitals, landmarks, the traveller) or map controls, never cover another small country's leader dot, and prefer sea or faded neighbours over the middle of another lesson country. The first position whose overlapped or crossed country names can all move to a free spot inside their own countries wins.
- In Discover only: if no nearby, clear position exists at the whole-map view, the close-up opens by itself and Luxembourg's name is drawn inside it (kept off Luxembourg's own shape) instead of on the main map, never both. It stays open for the rest of Discover. Find answers and Travel moves never open it; there, and whenever the close-up is closed, the name takes the best clear spot on the main map or is left out rather than overprinted. The toggle works in every stage, and the player's open/closed choice holds for the stage in which it was made. Only names the view already shows count, so this never reveals a Find answer.
- When the Travel traveller stands in a country whose name is in a callout, and its pin would cover the callout's dot (Luxembourg), the leader starts at the pin's tip, at the real capital, and the dot is not drawn. During a move the dot stays until the pin lands (at once with reduced motion). When the traveller leaves, or Undo takes it away, the dot returns. This applies in the main map and the close-up alike.
- Country names: each sits at its label point, or moves to the nearest free spot inside its own country, clear of the controls, the inset, markers, small countries' leader dots and other names. The smallest countries are placed first, for inline names and callouts alike. When nothing near the label point is free (it may be hidden under the close-up or the controls, e.g. France zoomed in on a phone with the close-up open), the whole visible part of the country is searched, nearest first, and the whole name must lie inside the country. Only a name with no room anywhere inside its visible country (e.g. Belgium or the Netherlands beside their capitals on a 320px map) gets a nearby callout, preferably over the sea.
- Map chrome (the zoom controls, and the close-up with its caption and toggle) is never covered by a name or callout, and no leader line crosses it, not even as a last resort. A callout never points at a dot hidden under that chrome; such a name is left out until the view changes.
- In Discover, an explored country's name carries a check badge (a check mark in a circle, so it doesn't rely on colour). The badge is part of the name's box for every collision rule. Explored names also say "explored" to screen readers. Find and Travel never show badges.
- Capital and landmark names are placed after all country names, beside their marker on the first free side, clear of callouts and leader lines. If no side is free, country names in the way move if they can. If they can't, the capital name is left out rather than printed over another name (the marker stays, the country card names the capital, and zooming in brings it back). This happens only in cramped cases at 320px.
- Discover only: illustrated scenery (painted Alpine relief from elevation data, forests, mountain groups, hills, waves) is drawn between the country fills and the borders. Symbols give way to every name and marker; the relief is a surface under them. Sources and rules are in [TERRAIN.md](TERRAIN.md).
- On maps narrower than 420px, labels use a slightly smaller font (13px country names, 11.5px capitals). Once zooming makes Luxembourg wide enough, its name is drawn inside it.

## Travel route line

The Travel route is a schematic country journey, not a road route. Each move is drawn as two straight lines: from the current country's capital to a point on the border it shares with the next country, then on to that country's capital (`src/geo/route.ts`). There is no curve smoothing, so the line cannot bulge across other borders. The main map and the inset draw the same projected line. The line is derived from the journey's country sequence, so Undo and Restart remove the matching segments. Reversed moves reuse the same crossing.

Map feedback (`src/components/map/RegionMap.tsx`), played only for changes made while the map is on screen:
- **Travel move:** only the new segment (capital → border crossing → capital) draws itself along that same path. Then the traveller, a navy pin distinct from the round coral capital markers, lands on the current capital. Undo, Restart, a refresh or a language switch show the final state at once, with nothing replayed.
- **Arrival:** the whole route glows once.
- **Find:** a correct answer briefly outlines the country in teal and a wrong one in coral. The outline fades out over the unchanged border, and nothing moves or shakes.
- **Reduced motion:** every one of these shows its final state immediately. None of them delays input or advances the lesson.

The crossing for each lesson border is stored in the lesson definition (`map.routeCrossings` in `src/core/lessons/western-europe.ts`). Each is a vertex of the two countries' shared border in the prepared TopoJSON: the vertex nearest the middle of the longest shared border line (by length) from which straight lines to both capitals stay inside their own country.

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

## Content coordinates

Capital and landmark positions (WGS84, `src/core/content/countries.ts`) are city-centre or monument coordinates, rounded to about 4 decimals: Paris 48.8566, 2.3522 · Brussels 50.8503, 4.3517 · Amsterdam 52.3676, 4.9041 · Luxembourg City 49.6116, 6.1319 · Berlin 52.5200, 13.4050. They match commonly published values (Wikipedia/GeoNames). Landmark positions and their sources are listed in [CONTENT.md](CONTENT.md). The tests above confirm each point falls inside its country.
