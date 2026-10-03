# Map data

The playable map is drawn from real country boundaries. No map image, hand-drawn polygons, or runtime map service is used.

## Source

| | |
|---|---|
| Dataset | Natural Earth — Admin 0 – Countries, 1:10m cultural vectors |
| Version | 5.1.1 (from `ne_10m_admin_0_countries.VERSION.txt`) |
| Download | https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_0_countries.zip (listed at https://www.naturalearthdata.com/downloads/10m-cultural-vectors/) |
| License | Public domain. Natural Earth's terms of use: https://www.naturalearthdata.com/about/terms-of-use/ (attribution not required, but appreciated: "Made with Natural Earth.") |
| Prepared file | `src/data/geo/europe-west.topo.json` (TopoJSON, ~374 KiB, ~122 KiB gzipped, 74 countries; before Level 6: ~349 KiB, ~114 KiB gzipped; before Level 5: ~276 KiB, ~91 KiB gzipped, 65 countries) |

### Why 1:10m and not 1:50m

At 1:50m, Luxembourg has only 46 vertices, which looks crude when zoomed or shown in the magnified inset. At 1:10m it has 197 vertices before simplification and 128 after.

## Preparation

The steps are reproducible with `scripts/prepare-geo.mjs`, which uses mapshaper:

```bash
# download + unzip the Natural Earth archive first
npm run prepare:geo -- path/to/ne_10m_admin_0_countries.shp
```

1. **Keep fields:** `ADM0_A3` (becomes the feature `id`) and `NAME_EN` (becomes `name`, for debugging only; the UI uses localized names from `src/core/content`). `ADM0_A3` is used instead of `ISO_A3` because Natural Earth has historically set `ISO_A3 = -99` for France and Norway.
2. **Clip to a regional box:** lon −27…48, lat 29.5…62 (lon −27…36, lat 32…62 until Level 5; see "Level 5" below), with sliver removal. This keeps surrounding countries as muted context. It also removes every overseas territory (French Guiana, Réunion, Saint Martin, Caribbean Netherlands, …), so they cannot stretch the viewport or add border shortcuts. For example, France and the Netherlands really do share a border on Saint Martin.
   The box is deliberately much larger than the lesson. Clipping cuts land along straight lon/lat lines, and in the map projection those lines appear as diagonal "coastlines" if they come into view. The previous box (lon −12…22, lat 38…59) was visible on wide desktop maps (e.g. 1920×1080) as a hard diagonal edge east of Germany. See *Coverage and view limits* below.
3. **Simplify:** `-simplify variable interval=… keep-shapes` (Visvalingam). About 400 m tolerance for the lesson countries and the neighbours visible when zoomed in (UK, Ireland, Spain, Andorra, Monaco, Italy, San Marino, Vatican, Switzerland, Liechtenstein, Austria, Czechia, Poland, Denmark, Slovakia); about 1.5 km for distant context that only appears at the edges of wide screens. The lesson countries have the same detail as before. `keep-shapes` prevents small countries (Luxembourg, Andorra, Liechtenstein, Monaco…) from being removed. TopoJSON stores each shared border as one arc, simplified once, so neighbouring countries keep identical borders with no gaps or overlaps.
   **Level 6 added Lithuania, Latvia and Estonia to the 400 m list, with Belarus, Russia and Finland, the neighbours seen beside them when zoomed in** (Russia's Kaliningrad lies between Poland and Lithuania and shares the Curonian Spit with Lithuania; its Pskov and Leningrad regions border Latvia and Estonia; Finland's south coast is 60–80 km across the Gulf of Finland from Tallinn). Rerunning the script on the same Natural Earth 5.1.1 download first reproduced the committed file byte for byte. Points: Estonia 289 → 798 (its islands), Lithuania 225 → 454, Latvia 204 → 444, Finland 281 → 1,174, Belarus 647 → 958, Russia 1,523 → 2,905, and, through their borders with Russia, Georgia 268 → 340, Azerbaijan 233 → 273 and Kazakhstan 51 → 94. Sweden was left at 1.5 km: it lies 150 km or more across the Baltic from the level's countries, as it does in Levels 1–3. The clip box and the quantization grid are unchanged. See "Level 6" below for what this changed in earlier levels.
   **Level 5 added Hungary, Romania, Bulgaria and Greece to the 400 m list (Serbia already was), with North Macedonia, Moldova, Turkey and Ukraine, the neighbours seen beside them when zoomed in** (Turkey's Aegean coast lies a few kilometres from Lesbos, Chios, Samos, Kos and Rhodes; Ukraine's coast and Moldova meet Romania at the Danube delta). Points: Greece 1,602 → 4,503 (its islands), Romania 482 → 930, Bulgaria 342 → 641, Hungary 525 → 630, Turkey 716 → 2,808, Ukraine 826 → 2,172, Moldova 211 → 546, North Macedonia 186 → 257, and, through their borders with Ukraine, Belarus 474 → 648 and Russia (also clipped further east) 606 → 1,524. See "Level 5" for what else changed and what did not.
   **Level 4 added Slovenia, Croatia, Bosnia and Herzegovina and Montenegro to the 400 m list, with Serbia, Kosovo and Albania, the neighbours seen beside Montenegro when zoomed in.** At 1.5 km Croatia had 566 points for its long, island-strewn coast and the Neum corridor; now 1,705. The script first reproduced the committed file byte for byte from the Natural Earth 5.1.1 download. With the seven added, only south-eastern countries changed: Croatia 566 → 1,705 points, Bosnia and Herzegovina 182 → 470, Montenegro 111 → 269, Slovenia 226 → 348, Serbia 285 → 722, Albania 162 → 403, Kosovo 86 → 205, and, through the borders they share with those, Hungary 416 → 525, Romania 384 → 482, Bulgaria 265 → 342, North Macedonia 108 → 186 and Greece 1,549 → 1,602. No country of Levels 1–3 changed (Hungary is only context there, at the edge of Level 3's view, and its changed borders are those with Slovenia, Croatia and Serbia). The file grew by 15.6 KiB (4.6 KiB gzipped), which every level downloads: the data is part of the app's code.
   **Slovakia was added to the 400 m list with Level 3.** At 1.5 km its borders with Hungary and Ukraine had one vertex per 7.2 km and 5.7 km, against 2.2–3.2 km for every other border of a playable country; now 3.2 km and 2.6 km. Rerunning the script with the Natural Earth 5.1.1 download first reproduced the committed file byte for byte; with Slovakia added, only Slovakia, Hungary and Ukraine changed (those two border arcs), so no Level 1 or 2 shape moved. The file grew by 0.7 KiB (0.3 KiB gzipped).
4. **Export TopoJSON:** one object named `countries`, ids = `ADM0_A3`, quantized on a **fixed grid**: the transform mapshaper's `quantization=1e5` computed for the data of Levels 1–4 (lon −25.859…36, lat 32…62; `scale` 0.000619° × 0.0003°, about 50 × 33 m). The script exports unquantized coordinates and rounds them on that grid itself (as mapshaper does: `x * mx + bx`, rounded), whatever the clip box; points beyond the old box simply get larger or negative integers. Letting mapshaper fit the grid to a larger box would have moved every vertex by up to about 25 m, Levels 1–4's included. Run with the old box and list, the script reproduces the earlier file byte for byte; a test checks the transform stays the same.

## Verification (automated: `src/geo/regionMap.test.ts`)

- Shared TopoJSON arcs (`topojson.neighbors`) give exactly the lesson border graph among the five active countries:
  France: Belgium, Luxembourg, Germany · Belgium: France, Netherlands, Luxembourg, Germany · Netherlands: Belgium, Germany · Luxembourg: France, Belgium, Germany · Germany: France, Belgium, Netherlands, Luxembourg.
  This matches the real land borders. The game graph deliberately leaves out borders with countries outside the practice region, such as France–Switzerland or Germany–Poland.
- The same for Level 2 (Around the Alps): France: Switzerland, Germany, Italy · Switzerland: France, Germany, Austria, Italy · Germany: France, Switzerland, Austria · Austria: Switzerland, Germany, Italy · Italy: France, Switzerland, Austria. Germany–Italy and France–Austria do not meet. Borders with Liechtenstein, Slovenia and others are left out. France → Austria takes two crossings, by three equally short routes (through Switzerland, Germany or Italy), and all three are accepted.
- The same for Level 3 (Central Europe): Germany: Poland, Czechia, Austria · Poland: Germany, Czechia, Slovakia · Czechia: Germany, Poland, Slovakia, Austria · Slovakia: Poland, Czechia, Austria · Austria: Germany, Czechia, Slovakia. Germany–Slovakia and Poland–Austria do not meet. Borders with Denmark, Lithuania, Russia, Belarus, Ukraine, Hungary and others are left out. It is the densest level: Czechia borders all four others.
- **Level 3's journey, Poland → Austria, takes two crossings by three equally short routes, not two:** through Czechia, through Slovakia, and through Germany (which borders both Poland and Austria). Breadth-first search over the graph from the data finds exactly these three, and all three are accepted (the game accepts any route within the budget). All pairwise distances are 1 or 2 crossings; the pairs two apart are Germany–Slovakia and Poland–Austria.
- The same for Level 4 (Along the Adriatic): Italy: Slovenia · Slovenia: Italy, Croatia · Croatia: Slovenia, Bosnia and Herzegovina, Montenegro · Bosnia and Herzegovina: Croatia, Montenegro · Montenegro: Croatia, Bosnia and Herzegovina. Every one is a real land border (CIA World Factbook, last edition: Italy–Slovenia 218 km, Slovenia–Croatia 600 km, Croatia–Bosnia and Herzegovina 956 km, Croatia–Montenegro 19 km, Bosnia and Herzegovina–Montenegro 242 km), and the Factbook lists no others among the five: Italy has no land border with Croatia, Bosnia and Herzegovina or Montenegro, and Slovenia none with Bosnia and Herzegovina or Montenegro. Borders with Austria, Hungary, Serbia, Kosovo, Albania, San Marino and the Vatican are left out; no sea connection is added.
- **Level 4's journey, Italy → Montenegro, takes three crossings by exactly one shortest route: Slovenia, then Croatia.** Breadth-first search over the graph from the data finds only Italy → Slovenia → Croatia → Montenegro; through Bosnia and Herzegovina takes four (Italy → Slovenia → Croatia → Bosnia and Herzegovina → Montenegro), so a player who goes that way runs out of crossings in Bosnia and Herzegovina. The level is a chain from Italy: Italy–Slovenia is 1, Italy–Croatia 2, and Italy–Bosnia and Herzegovina and Italy–Montenegro 3.
- The same for Level 5 (Towards Greece): Hungary: Romania, Serbia · Romania: Hungary, Serbia, Bulgaria · Serbia: Hungary, Romania, Bulgaria · Bulgaria: Romania, Serbia, Greece · Greece: Bulgaria. Every one is a real land border (CIA World Factbook, last edition: Hungary–Romania 424 km, Hungary–Serbia 164 km, Romania–Serbia 531 km, Romania–Bulgaria 605 km, Serbia–Bulgaria 344 km, Bulgaria–Greece 472 km), and the Factbook lists no others among the five: Hungary has no land border with Bulgaria or Greece, and Romania and Serbia none with Greece (North Macedonia lies between Serbia and Greece). The data's shared arcs give exactly these six. Borders with Ukraine, Moldova, Slovakia, Austria, Slovenia, Croatia, Bosnia and Herzegovina, Montenegro, Kosovo, North Macedonia, Albania and Turkey are left out; no sea connection is added.
- **Level 5's journey, Hungary → Greece, takes three crossings by exactly two shortest routes: Hungary → Romania → Bulgaria → Greece and Hungary → Serbia → Bulgaria → Greece.** Breadth-first search over the graph from the data finds exactly these two, and both are accepted. Bulgaria is Greece's only neighbour here, so every route ends through it. Pairwise distances: Hungary–Bulgaria 2, Hungary–Greece 3, Romania–Greece and Serbia–Greece 2, all others 1. A player who crosses between Romania and Serbia on the way uses a crossing too many and runs out in Bulgaria.
- The same for Level 6 (Baltic Journey): Germany: Poland · Poland: Germany, Lithuania · Lithuania: Poland, Latvia · Latvia: Lithuania, Estonia · Estonia: Latvia. Every one is a real land border (CIA World Factbook, last edition; lengths in "Level 6" below), and the Factbook lists no others among the five: Germany meets none of the Baltic states, Poland meets neither Latvia nor Estonia, and Lithuania and Estonia do not meet (Latvia lies between). The data's shared arcs give exactly these four: the five form a chain. Borders with Denmark, Czechia, Austria, Switzerland, France, Luxembourg, Belgium, the Netherlands, Slovakia, Ukraine, Belarus and Russia (Kaliningrad, and east of Latvia and Estonia) are left out; no sea connection is added (no ferry across the Baltic, none from Germany's or Poland's coast to the Baltic states, none to Estonia's islands).
- **Level 6's journey, Germany → Estonia, takes four crossings by exactly one shortest route: Germany → Poland → Lithuania → Latvia → Estonia.** Breadth-first search over the graph from the data finds only this one; on a chain there is no other. Pairwise distances: neighbours 1, Germany–Lithuania and Poland–Latvia and Lithuania–Estonia 2, Germany–Latvia and Poland–Estonia 3, Germany–Estonia 4. A player who steps back (into Germany from Poland, say) uses a crossing too many and runs out before Estonia.
- The Level 2 border arcs are at full detail (2.2–3.0 km per vertex, as for Level 1's borders), including those with neighbours drawn at 1.5 km elsewhere (Austria–Hungary, Austria–Slovenia, Italy–Slovenia).
- Level 3's borders are at full detail too: 2.3–3.2 km per vertex between its countries, and 2.5–3.2 km for Poland's and Slovakia's outer borders (after Slovakia was added to the detail list, above). The one exception is Poland–Russia (Kaliningrad), 13 segments over 206 km, because the real border there is almost straight.
- Every capital and landmark coordinate lies inside its country's polygon (`d3.geoContains`), with one documented exception: the City Walls of Dubrovnik (see "Level 4" below).
- France's projected bounds lie inside the regional focus area, so no overseas geometry remains.

## One projection for every level

Every level is drawn in the same projected "world" coordinates: `d3.geoAzimuthalEqualArea`, rotated to 8°E 50°N and fitted to Level 1's countries (`PROJECTION_FIT` in `src/geo/regionMap.ts`). The painted landscape is rendered in these coordinates (see TERRAIN.md), so it lines up with every level's map, and Level 1 looks exactly as before. A level only chooses which countries are the focus (the initial view and pan limits) and its coverage. Level 2 lies within about 12° of the projection's centre, so its shapes are barely distorted: Italy's heel turns by about 7°. Level 3 reaches about 11° from it (Poland's eastern border), so it keeps the shared projection and the shared landscape grid. Level 4 reaches about 15° from it (Lampedusa) and about 13° (Montenegro's south-east): the same distances as Level 2's Sicily, so it keeps the shared projection too, and its landscape lines up with the existing grid (see TERRAIN.md: no existing tile changed). **Level 5 reaches about 20° from it** (Rhodes 20.1°, Crete 19.3°, Athens 16.4°, the Danube delta 15.3°). The equal-area azimuthal projection there scales distances by at most ±1.5% and turns angles by at most 1.8°, so shapes stay true; what shows is orientation: north points 8–13° to the left of straight up across Level 5 (8° in Hungary, 10.5° at Athens, 13° at Bucharest), as in the EU's standard map of Europe (ETRS89-LAEA, centred at 10°E 52°N), which tilts the Balkans the same way. A projection of its own would have needed a separate landscape for Level 5 and made Hungary and Serbia look different from Levels 3 and 4, so it keeps the shared one. **Level 6 reaches about 15° from it** (Narva 14.9°, Tallinn 13.4°, Vilnius 11.5°, Estonia's westernmost islands 11.6°): within Level 5's range, so shapes stay true; north points 4° to the left of straight up at Berlin, 10° at Warsaw, 13–14° at Vilnius, Riga and Tallinn and 17° at Narva, the same tilt as the EU's standard ETRS89-LAEA map, which is centred further east. It keeps the shared projection, so Germany and Poland look exactly as in Levels 1–3, and the landscape grid stays anchored (TERRAIN.md).

## Coverage and view limits

`src/geo/regionMap.ts` defines a projected **coverage rectangle** centred on each level's countries. For Level 1 it is ±1150 × ±900 world units (the default), with Level 1 fitted to 1000. Level 2's countries span 1221 × 1420 units (Lampedusa to the Baltic coast). The prepared data allows at most about ±1100 × ±845 around them, so its coverage is ±1090 × ±840 (`map.coverageHalf` in `src/core/lessons/alps.ts`). Level 3's countries span 840 × 636 units (smaller than Level 1), but lie in the north-east of the data: the clip box's east edge (36°E, beyond Ukraine) and north edge (62°N) allow at most about ±718 × ±760 around them, so its coverage is ±715 × ±760 (`src/core/lessons/central-europe.ts`). Level 4's countries span 732 × 843 units (Lampedusa to the Alps, Italy's west to Montenegro's east); here the clip box's south edge (32°N, about 3.5° below Lampedusa) sets the limit, allowing at most about ±1000 × ±510 around them, so its coverage is ±1000 × ±505 (`src/core/lessons/adriatic.ts`). No new data was needed: the existing box already reaches far enough south and east. Every point of it lies inside the clip box, which `regionMap.test.ts` checks along its whole outline for every playable level. `MAP_DATA_CLIP` in the same file must match `BBOX` in the script. A test checks it against the data's extent.

`viewLimits()` derives the zoom/pan limits from it:

- **Initial view and "show the whole map"**: the level's countries fitted with padding, centred. If the map is so wide or tall that this would show beyond the coverage, it zooms in just enough to stay inside instead. For Level 1 that happens beyond about 1:1.9 to 2.2:1 (e.g. a phone in landscape). Level 2 still shows all five countries whole on maps from about 1:1.37 (tall) to 1.53:1 (wide). Measured with `viewLimits`' rule, that covers phones in portrait, tablets in landscape, and desktops up to 1920×1080 and 2560×1440, which get slightly less padding. A tablet in portrait (a 1.6:1 map) shows 96% of the height, so Lampedusa or the Baltic coast is just outside the view until the player pans. An ultra-wide 2.15:1 map shows 71%. Level 3 shows all five countries whole on maps from about 1:1.8 (tall) to 2.2:1 (wide), less the padding; beyond, it zooms in slightly (measured sizes below).
- **Markers whole in the initial view.** Markers have a fixed size on screen, so the fit above (which uses the countries' outlines) does not include them; the traveller's pin stands 23 px above its capital. Where the initial view shows the countries whole, `viewLimits` is also given the markers on the map (`marks`) and keeps each one whole, 2 px (`MARK_EDGE_CLEARANCE`) inside the map's edge: first by moving the view or zooming out a little with the countries still whole, giving up some padding if it must; and where the coverage leaves no room for that, by zooming in just enough (at most 15%, `MARK_ZOOM_LIMIT`), so the countries' far side is cut instead. A marker's tip stays on its real coordinate: the marker is never moved, shrunk or hidden for this. A view that already shows every marker whole is unchanged, and maps whose initial view crops the countries already (short landscape maps, see each level) keep that view. So far this changes one case: the traveller in Tallinn on 320 px phones (Level 6, below). When the markers change the initial view (the traveller arrives in Tallinn, or leaves it), the map eases to the new one only if it is still at the old one; it never moves while the player drags or pinches, nor away from a view they chose. "Show the whole map" and a refresh give the new view.
- **Minimum zoom** equals that initial view, so zooming out can never reveal the data edge (or the countries' own initial view, when keeping a marker whole zoomed it in, so the whole region stays reachable).
- **Panning** (when zoomed in) is limited to the level's area plus 25% on each side, clamped to the coverage.

Tests check that the base view and pan limits stay inside the coverage for phone, tablet, desktop and ultra-wide sizes, and that typical phone and desktop maps (304×294 to 1464×1000) show every country of each level whole.

Level 3, measured in the built app (`e2e/level3.spec.ts`, which also checks that the painted overview, and so the coverage, fills the whole map at every size, and that "Show the whole map" returns to the start view). The margin is the smallest gap between a country and the map's edge:

| Screen | Map | Smallest margin |
|---|---|---|
| 320×568 | 304×231 | 10 px |
| 390×844 | 374×380 | 15 px |
| 412×915 (Pixel 7) | 396×413 | 16 px |
| 1366×800 | 932×712 | 29 px |
| 1920×1080 | 1456×992 | 40 px |
| 2560×1080 | 2096×992 (2.1:1) | 30 px |
| 740×360, phone in landscape | 724×192 (3.8:1) | −65 px: zoomed in; the tips of Germany and Poland (north) and Austria (south) are cut until the player pans |
| 844×390, phone in landscape | 828×192 (4.3:1) | −88 px, likewise |

Phones in landscape get a 192 px map in every level: Levels 1 and 2 are cropped there too (beyond 2.2:1 and 1.53:1). Showing Level 3 whole on such a map would need data beyond 36°E, which means a larger clip box and a new dataset for every level. That is out of this change's scope.

Level 4, measured in the built app (`e2e/level4.spec.ts`, which also checks that the painted overview fills the map at every size, also panned as far as it goes, and that "Show the whole map" returns to the start view):

| Screen | Map | Smallest margin |
|---|---|---|
| 320×568 | 304×231 | 10 px |
| 390×844 | 374×380 | 15 px |
| 412×915 (Pixel 7) | 396×413 | 16 px |
| 1366×800 | 932×712 | 29 px |
| 1920×1080 | 1456×992 | 40 px |
| 2560×1080 | 2096×992 (2.1:1) | 40 px |
| 740×360, phone in landscape | 724×192 (3.8:1) | −57 px: zoomed in; Slovenia and northern Croatia (north) and Italy's toe, Sicily and Lampedusa (south) are cut until the player pans |
| 844×390, phone in landscape | 828×192 (4.3:1) | −79 px, likewise |

Its focus is a little taller than wide (0.87:1); every measured map from 320×568 to 2560×1080 shows it whole. On phones in landscape (192 px tall) it is cropped north and south, as every level is there.

### Level 5

**Why the data changed.** Level 5's countries span 780 × 994 world units (Hungary's north to Gavdos south of Crete, Hungary's west to the Danube delta), about 1,190 × 1,510 km. Inside the old clip box (lon −27…36, lat 32…62) the coverage around them could be at most about ±545 × ±600: the east edge at 36°E (beyond the Black Sea, tilted north-east in this projection) and the south edge at 32°N set the limit, and a desktop map would have been cropped well inside the five countries. Its coverage is **±1100 × ±600** (`map.coverageHalf` in `src/core/lessons/towards-greece.ts`): from about 1.3°E to 46.2°E and 29.8°N to 51.2°N. So the clip box became lon −27…48, lat 29.5…62. The south edge is 29.5°N, not 29°N: at 29°N the box takes in the north tip of the Canary Islands (Lanzarote and its islets, 29.2–29.4°N), which would have added a clipped piece of Spain, a context country of Levels 1 and 2. `regionMap.test.ts` checks the coverage lies inside the box along its whole outline.

**What changed, and what did not.** The script reran on the same Natural Earth 5.1.1 download, which first reproduced the committed file byte for byte with the old box and list. Then, with the fixed quantization grid (step 4 above):
- **46 of the 65 countries are bit-for-bit unchanged**, including all fifteen of Levels 1–4 (France, Belgium, the Netherlands, Luxembourg, Germany, Switzerland, Austria, Italy, Poland, Czechia, Slovakia, Slovenia, Croatia, Bosnia and Herzegovina, Montenegro) and Spain, Serbia, Kosovo and Albania. So no Level 1–4 shape, border crossing, label anchor or pin moved, and the shared projection (fitted to Level 1's countries) is identical: the landscape of Levels 1–4 did not need repainting (TERRAIN.md).
- **More detail** (the 400 m list, step 3): Hungary, Romania, Bulgaria, Greece, North Macedonia, Moldova, Turkey and Ukraine, and Belarus's and Russia's borders with Ukraine. Hungary is context in Levels 3 and 4: its borders with Romania and Ukraine (east of their views) gained points; its borders with Austria, Slovakia, Slovenia, Croatia and Serbia, the ones those levels show, are unchanged.
- **Clipped further out**: Russia, Ukraine, Turkey, Syria, Lebanon, Israel, Palestine, Jordan and North Africa's coasts (Morocco, Algeria, Tunisia, Libya). New, all at the box's edges and only as distant context: Egypt, Saudi Arabia, Kuwait, Iraq, Iran, Georgia, Armenia, Azerbaijan and Kazakhstan (74 countries in all). None of this lies inside any level's coverage except Level 5's; the box's own straight edges stay outside every coverage.
- **Size**: the file grew from 276 KiB (91 KiB gzipped) to 349 KiB (113 KiB gzipped): +22.3 KiB gzipped, which every level downloads as part of the app's code. The box alone accounts for 8 KiB of that, Level 5's detail for 14.

**Greece's islands.** Every island Natural Earth's 1:10m data has for Greece is kept, as part of Greece: 73 parts, from Corfu (19.6°E) to Rhodes (28.2°E) and Gavdos (34.8°N, south of Crete). The one part the source has and the map lacks is an uninhabited islet of about 1 km² (Falkonera, between Milos and Cape Malea), which simplification removes (`keep-shapes` keeps every country, not every islet of it). **Kastellorizo** (Megisti, 29.6°E, 2 km off Turkey) is not in Natural Earth's 1:10m Admin 0 data at all, for Greece or any country, so it is not drawn; that is a limitation of the source, not of the clipping. No Greek island lies near the box's edges (Rhodes is 20° of longitude from the east edge), and `regionMap.test.ts` checks that eight island towns, Gavdos included, lie in Greece and not in Turkey.

**The start view includes Crete and Rhodes.** The level's focus is its five countries whole, Greece's islands included. That costs little: Rhodes and the Dodecanese lie within the longitude Romania already reaches (the Danube delta, 29.7°E), so only Crete and Gavdos extend the frame, by about 1.6° south of the Peloponnese (14% of the focus's height). The mainland is not shrunk to fit distant islands, and since every island lies inside the focus, every one also lies inside the pan limits (25% beyond the focus): zooming in on any of them with the normal controls never runs into a limit first. (`e2e/level5.spec.ts` zooms in and drags towards Rhodes and Crete, and checks Greece's south-eastern edge comes into view with the landscape still covering the map.)

Measured in the built app (`e2e/level5.spec.ts`, which also checks that the painted overview fills the whole map at every size, also panned as far as it goes, and that "Show the whole map" returns to the start view). The margin is the smallest gap between a country and the map's edge; Greece's size includes Crete and Rhodes:

| Screen | Map | Smallest margin | Greece drawn |
|---|---|---|---|
| 320×568 | 304×231 | 10 px | 112×111 px |
| 390×844 | 374×380 | 15 px | 187×184 px |
| 412×915 (Pixel 7) | 396×413 | 16 px | 203×200 px |
| 1366×800 | 932×712 | 29 px | 350×344 px |
| 1920×1080 | 1456×992 | 40 px | 487×479 px |
| 2560×1080 | 2096×992 (2.1:1) | 22 px | 505×498 px |
| 740×360, phone in landscape | 724×192 (3.8:1) | −68 px: zoomed in; the north of Hungary and Romania and Greece's south (the Peloponnese's tip, Crete) are cut until the player pans | 175×172 px |
| 844×390, phone in landscape | 828×192 (4.3:1) | −91 px, likewise | 200×197 px |

Its focus is taller than wide (0.78:1); every measured map from 320×568 to 2560×1080 shows it whole. By `viewLimits`' rule it stays whole on maps from about 1:1.45 (a tablet in portrait) to 2.1:1; on phones in landscape (192 px tall) it is cropped north and south, as every level is there.

**Disputed boundaries.** The map follows Natural Earth's Admin 0 countries, which draw boundaries as they are on the ground ("de facto"), as for every level. Here this matters once: **Kosovo** is a separate shape (`KOS`), not part of Serbia; Serbia's shape, area and label are those of Serbia without Kosovo, and Kosovo is shown faded, like every country outside the level, with the same accessible label as the others ("Nearby country outside this region"). Kosovo declared independence in 2008; Serbia does not recognise it, and many other states do (the CIA World Factbook lists a 366 km Serbia–Kosovo border; Serbia's constitution counts Kosovo as a province). This treatment was already in the data for Level 4 (whose Montenegro borders Kosovo) and is unchanged; Level 5's game graph does not depend on it (neither Serbia–Kosovo nor any other border with Kosovo is in the level), and no text in the game names Kosovo or calls Serbia's boundary there anything. The borders among the five countries themselves are undisputed. Cyprus and Northern Cyprus (`CYN`) are in the data too, as before, but lie outside Level 5's coverage.

### Level 6

**Coverage.** Level 6's countries span 908 × 993 world units (Germany's Alps to Estonia's north coast, Germany's west to Narva), about 1,000 × 1,090 km, with Estonia's islands (Saaremaa, Hiiumaa, Muhu, Vormsi, Kihnu, Ruhnu, Naissaar) inside that box: they lie west of Estonia's mainland but east of Germany and Poland, so they do not widen the frame. The clip box needed no change. Its north edge (62°N, across Norway, Sweden, Finland and Russia) sets the limit: in this projection that parallel comes closest to the view around 8°E, above Norway, and allows at most about ±575 vertically around the five countries, whatever the width. The coverage is **±1100 × ±570** (`map.coverageHalf` in `src/core/lessons/baltic-journey.ts`): its corners lie at 12.9°W 60.4°N, 46.1°E 56.5°N, 6.6°W 45.3°N and 35.7°E 42.6°N, and its top edge reaches 61.6°N above Sweden, 2° north of Estonia's coast. `regionMap.test.ts` checks it lies inside the box along its whole outline. Zoomed in, the pan limits reach 25% beyond the five countries, clamped to the coverage: to the Gulf of Finland and Finland's south coast in the north, so Estonia's coast is never at the edge of what can be shown.

**Changes to the shared data, and what they mean for Levels 1–5.** The detail list grew (step 3 above); nothing else changed. Measured by vertex, against the previous file:
- **No country of Levels 1–5 changed** (all 20 playable countries are bit-for-bit the same), so no shape, label anchor, capital or landmark pin, border crossing or route of an earlier level moved, and the shared projection (fitted to Level 1's countries) is identical.
- **Faded neighbours that earlier levels can show gained detail**: Lithuania, Latvia and Belarus (beside Poland in Level 3, and at the east edge of Levels 1 and 2 on wide screens), Estonia (Level 3's coverage and Level 1's, never their pan areas), Russia (Kaliningrad in Levels 1–3; the Black Sea coast and Caucasus at the east edge of Level 5's coverage), Finland (the top edge of Level 3's coverage) and Georgia (the east edge of Level 5's coverage, through its border with Russia). Their borders with the playable countries are unchanged: Poland was already detailed, so its borders with Russia, Lithuania and Belarus kept their vertices. Azerbaijan and Kazakhstan changed too, outside every earlier level's coverage.
- **Size**: the file grew from 349 KiB (114 KiB gzipped) to 374 KiB (122 KiB gzipped): +7.7 KiB gzipped, which every level downloads as part of the app's code.

**Estonia's islands.** Every part Natural Earth's 1:10m data has for Estonia is kept, as part of Estonia: 8 parts (the mainland, Saaremaa 2,756 km² in the data, Hiiumaa, Muhu, Vormsi, Kihnu, Naissaar and Ruhnu). Ruhnu, in the middle of the Gulf of Riga and nearer Latvia's coast, is Estonian in the data, as it is. Smaller islets (Abruka, Vilsandi, Prangli and most of Estonia's 1,500 islands) are not in the source at this scale. `regionMap.test.ts` checks a point on each of the seven islands is in Estonia and not in Latvia, Finland, Russia or Sweden, and that all of Estonia lies inside the level's focus, so every island is in the start view and within the pan limits. `e2e/level6.spec.ts` zooms in, brings Estonia to the middle of a phone and a desktop map (wholly in view, the landscape still covering the map) and taps Saaremaa or Hiiumaa: it selects Estonia.

**The Curonian Spit and Kaliningrad.** The spit is split between Lithuania (Nida) and Russia (Rybachy) in the data, as on the ground. Kaliningrad is a faded neighbour like every country outside the level; the Poland–Lithuania crossing (below) keeps 11–15 km from it and from Belarus.

Measured in the built app (`e2e/level6.spec.ts`, which also checks that the painted overview fills the whole map at every size, also panned as far as it goes north and north-east, and that "Show the whole map" returns to the start view). The margin is the smallest gap between a country and the map's edge; Estonia's size includes its islands:

| Screen | Map | Smallest margin | Estonia drawn |
|---|---|---|---|
| 320×568 | 304×231 | 10 px | 50×35 px |
| 390×844 | 374×380 | 15 px | 83×58 px |
| 412×915 (Pixel 7) | 396×413 | 16 px | 90×63 px |
| 1366×800 | 932×712 | 29 px | 155×109 px |
| 1920×1080 | 1456×992 | 40 px | 216×151 px |
| 2560×1080 | 2096×992 (2.1:1) | 23 px | 223×157 px |
| 740×360, phone in landscape | 724×192 (3.8:1) | −67 px: zoomed in. **Estonia is wholly outside the start view** (its south edge 13 px above the top edge), Latvia's north is cut by 26 px and Germany's south by 67 px, until the player pans | 77×54 px (off view) |
| 844×390, phone in landscape | 828×192 (4.3:1) | −91 px: likewise; Estonia 29 px above the top edge, Latvia cut by 43 px, Germany by 91 px | 88×62 px (off view) |

The margins and sizes are measured in Discover with nothing selected. Two kinds of view, then:
- **Whole-region views**: every measured map from 320×568 to 2560×1080 in portrait or desktop shape (the first six rows) shows all five countries whole, Estonia's islands included, with a margin. By `viewLimits`' rule that holds on maps from about 1:1.2 to 2.1:1. On taller maps the view zooms in just enough to stay inside the coverage, which crops west and east, not north and south: a 752×1100 tablet map in portrait shows Germany's west and Estonia's east (Narva) about 60 px beyond its edges until the player pans.
- **Short landscape views** (phones in landscape, whose map is 192 px tall, 3.8:1 and wider): the coverage's height allows no smaller zoom than one that crops the five countries north and south, as in every level. Here that crop takes all of Estonia and the north of Latvia: the start view shows Germany, Poland, Lithuania and part of Latvia, and the player pans north (or zooms) to reach Estonia, and in Travel and Results the traveller's pin when it stands in Riga or Tallinn. Showing Estonia whole there would need data and a painted landscape beyond 62°N (a new clip box and dataset), outside this level's scope.

The mainland is not made smaller for the islands: they add nothing to the frame.

**The traveller's pin in Tallinn.** Tallinn is on the coast, 34 world units below the top of the five countries, and the pin stands 23 px above it, so at the countries' own start view its head would be cut on small phones (by 5 px on a 320×568 phone, whose map is 304×231). The coverage's top edge, set by the data's north edge, lies just above: at that zoom Tallinn can be at most 22.8 px below it. So in Travel and Results, while the traveller is in Tallinn, the start view is adjusted to keep the pin whole (see "Markers whole in the initial view" above):

| Screen | Map | Start view with the traveller in Tallinn |
|---|---|---|
| 320×568 | 304×231 | Zoomed in by 9.7% (the least that fits the pin below the coverage's top edge), the view's top at that edge: the pin 2.2 px inside the edge, Estonia 55×38 px; **Germany's south (its southernmost 85 km or so: the Alps and the south of Bavaria) is cut by 18 px** until the player pans or zooms out. Zooming out still reaches the countries' own start view, with the pin cut |
| 320×640 | 304×261 | Zoomed out by 2.8% and moved down: the pin 2.2 px inside the edge and all five countries whole with 10 px of margin |
| 390×844 and larger | | Unchanged: the pin is already whole (4 px inside the edge at 390×844, 28 px on a 1366×800 desktop) |
| 320×568 at 200% text | 304×156 | Unchanged (the countries' own start view, the pin's head cut): keeping the pin whole would need the view zoomed in 1.7 times, losing most of Germany and Poland and the route's start |

The view zooms in by at most 15% for this (`MARK_ZOOM_LIMIT`), so the countries keep their size and the route stays in view; on 320 px phones that covers screens from about 545 px high. Shorter maps (shorter phones, or enlarged text, which shortens the map) keep the countries' own start view, with the pin's head cut until the player zooms in. The pin keeps its size and its tip stays on Tallinn. On the 320×568 phone the map eases to that view as the traveller lands (unless the player has moved the map), and a refresh or "Show the whole map" in Results gives it at once. In Discover and Find, and in Travel before Tallinn, the start view is the countries' own. `regionMap.test.ts` checks that every capital of every level, at phone to desktop sizes, changes the start view only for Tallinn on 320 px phones; `e2e/level6.spec.ts` checks the pin whole on arrival, in Results, after a refresh and after "Show the whole map", in both languages, and that the map doesn't move on its own when the traveller arrives during a drag.

## Rendering

- Projection: `d3.geoAzimuthalEqualArea`, rotated to 8°E 50°N and fitted to Level 1's five countries, for every level (`src/geo/regionMap.ts`, see *One projection for every level*).
- Shapes, labels, capital markers, landmark pins, the route line and the hint circle all use this same projection. They are placed with the same `d3-zoom` transform; the inset reuses the same projected paths with a fixed magnifying transform.
- **Small countries and the close-up are set per level** (`map.smallCountries`, `map.inset`). Level 1 names Luxembourg in a callout and has the close-up described below. Levels 2–5 have neither: their smallest countries (Switzerland; Slovakia; Montenegro and Slovenia; Serbia, about 51 × 56 px at the whole-map view on a 320 px phone, and Hungary, 66 × 48 px) are large enough to tap at the whole-map view, and they inherit no inset, caption or Luxembourg rule. (On a 320px map Switzerland's name gets the general "no room inside its country" callout, as Belgium's does in Level 1.)
- Luxembourg is never enlarged. It is made selectable through zoom (pinch, wheel or +/−) and through the magnified inset, which uses the true geometry, so taps resolve to the correct country. There are no invisible hit areas.
- The area shown in the inset is outlined (dashed) on the main map while the inset is open, and the inset's caption ("Close-up" / «Խոշորացում») carries the same dashed key. The caption never names a country. The inset's accessible label names Luxembourg only while its name is already visible on the map, so the Find answer and hidden Travel countries are never revealed.
- The inset is at least 112px wide (100px on maps narrower than 420px), and shrinks further when needed to fit on short maps. On wide maps (600×420px and up) it sits top-left and starts open. On smaller maps it sits bottom-left, opposite the zoom controls, and opens upwards over western France, which keeps the crowded Low Countries clear.
- Luxembourg's label is drawn in a callout with a leader line to its label point (inside the country, checked by tests). The callout must be **nearby**: at most 18px beyond the country's edge (leader length minus half the country's size). Candidate positions are tried nearest first, including positions level with the dot. Callouts never cover markers (capitals, landmarks, the traveller) or map controls, never cover another small country's leader dot, and prefer sea or faded neighbours over the middle of another lesson country. The first position whose overlapped or crossed country names can all move to a free spot inside their own countries wins.
- In Discover only: if no nearby, clear position exists at the whole-map view, the close-up opens by itself and Luxembourg's name is drawn inside it (kept off Luxembourg's own shape) instead of on the main map, never both. It stays open for the rest of Discover. Find answers and Travel moves never open it; there, and whenever the close-up is closed, the name takes the best clear spot on the main map or is left out rather than overprinted. The toggle works in every stage, and the player's open/closed choice holds for the stage in which it was made. Only names the view already shows count, so this never reveals a Find answer.
- When the Travel traveller stands in a country whose name is in a callout, and its pin would cover the callout's dot (Luxembourg), the leader starts at the pin's tip, at the real capital, and the dot is not drawn. During a move the dot stays until the pin lands (at once with reduced motion). When the traveller leaves, or Undo takes it away, the dot returns. This applies in the main map and the close-up alike.
- Country names: each sits at its label point, or moves to the nearest free spot inside its own country, clear of the controls, the inset, markers, small countries' leader dots and other names. The smallest countries are placed first, for inline names and callouts alike. When nothing near the label point is free (it may be hidden under the close-up or the controls, e.g. France zoomed in on a phone with the close-up open), the whole visible part of the country is searched, nearest first, and the whole name must lie inside the country. Only a name with no room anywhere inside its visible country (e.g. Belgium or the Netherlands beside their capitals on a 320px map) gets a nearby callout, preferably over the sea.
- **Two neighbouring callouts** (first in Level 4: on a 320px map, Bosnia and Herzegovina's and Montenegro's names both need one, beside the zoom controls): a callout never covers another, not even as the last resort for tiny views. When no position is clear as it is, the same positions are tried slid sideways or up and down into the view, under the same rules, before that last resort; layouts that already found a clear position are unchanged. And when a callout moves a country name aside, capital and landmark names placed afterwards keep clear of the name where it now is (before, they kept clear of its old spot; on Level 4's 320×640 map that let "Podgorica" print over Bosnia and Herzegovina's moved name).
- **A marker just beside the dot** (first in Level 6: on a 320px map Estonia's name has no room inside Estonia when it is selected, and its dot is 2 px from Tallinn's marker): every position level with the dot sends the leader through that marker, and the nearby positions below the dot overlap Latvia's and Lithuania's names, which have nowhere to move. Before, the name then went to the first distant position, over the sea off Lithuania with a 73 px leader (57 px in Armenian), reading as Lithuania's. Now, for a dot within half a name's height of a marker, when no usual nearby position leaves every name clear, nearby positions between the level and the diagonal ones are tried before any distant one: west and east of the dot, the leader leaving at 30° or 45° below or above it, d away (the usual distances), under the same rules (clear of markers, chrome, other callouts and leader dots; names they cover or cross must move inside their own countries), and only if every capital and landmark name still has a free side beside its marker afterwards. Estonia's name now sits west of Estonia over the Baltic, its leader 35 px long at 45°, passing below Tallinn's name, in both languages (Latvia's and Lithuania's names shift slightly inside their countries). Layouts that found a usual nearby position are unchanged, and so are small countries' names (Luxembourg's), whose fallback is the close-up and whose rules above stay as they were: across all six levels at 320×568, in both languages, with nothing and each country selected in Discover, only Level 6's Estonia changed. It only ever moves names the stage already shows, so it never reveals a Find answer or a hidden Travel country. `e2e/level6.spec.ts` checks Estonia's name inside Estonia where it fits (390 px and desktop) and otherwise nearby (leader at most 18 px beyond half its size), clear of other names, markers and controls, also after other selections and zoomed in and moved, in both languages.
- Map chrome (the zoom controls, "About the map", and the close-up with its caption and toggle) is never covered by a name or callout, and no leader line crosses it, not even as a last resort. A callout never points at a dot hidden under that chrome; such a name is left out until the view changes. So is a name whose label point is off screen when nothing in its visible part fits and its label point would put it under chrome.
- In Discover, an explored country's name carries a check badge (a check mark in a circle, so it doesn't rely on colour). The badge is part of the name's box for every collision rule. Explored names also say "explored" to screen readers. Find and Travel never show badges.
- Capital and landmark names are placed after all country names, beside their marker on the first free side, clear of callouts and leader lines. If no side is free, country names in the way move if they can. If they can't, the capital name is left out rather than printed over another name (the marker stays, the country card names the capital, and zooming in brings it back). This happens only in cramped cases at 320px. **When a capital and a landmark marker are close** (under 60 px apart on screen, as Belgrade and Golubac Fortress, 98 km apart, are on a phone in Level 5), each name tries the sides facing away from the other marker first, so neither name sits beside the wrong marker (before, "Golubac Fortress" ended right by Belgrade's dot and "Belgrade" began right after Golubac's pin). Markers further apart keep the usual order; a landmark within 16 px of its capital is not drawn at all, as before. `e2e/level5.spec.ts` checks every name lies nearer its own marker.
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

### Level 3

Level 3's crossings were computed by a script with Level 2's rule 1: the vertex nearest the middle of the longest shared border line from which straight lines (in the map projection) to both capitals stay inside their countries and at least 10 km from any coast or other border, the first 10 km around a capital and 15 km around the crossing exempt. It found one for seven of the eight borders, with no turning points. Bratislava lies within 10 km of both Austria and Hungary, which the capital exemption covers.

Germany–Austria has none (the same finding as in Level 2: Berlin to the Inn cuts through Czechia, Vienna to the west through the Berchtesgaden salient), and the capitals are the same, so it reuses Level 2's crossing and both turning points. `central-europe.ts` reads them from `alps.ts`, so the two levels can't drift apart, and a test checks the drawn line is the same in both.

| Border | Crossing (lon, lat) | Where | From border middle | Clearance (km, each side) | Turning points |
|---|---|---|---|---|---|
| Germany–Poland | 14.6063, 52.2758 | on the Oder, south of Frankfurt (Oder) | 2.1 km | 11.9 / 10.0 | none |
| Germany–Czechia | 13.0697, 50.4911 | Ore Mountains, at Bärenstein / Vejprty | 64 km | 11.1 / 10.0 | none |
| Germany–Austria | 12.1820, 47.6921 | on the Inn (Level 2's) | 0.1 km | (Level 2) | Germany: 11.90, 50.51; Austria: 12.92, 47.25 (Level 2's) |
| Czechia–Poland | 16.3712, 50.3183 | Sudetes, west of Kłodzko | 44 km | 10.5 / 10.6 | none |
| Poland–Slovakia | 20.8678, 49.3115 | Beskids, in the Poprad valley | 34 km | 12.7 / 10.1 | none |
| Czechia–Slovakia | 17.2601, 48.8579 | on the Morava, between Hodonín and Skalica | 51 km | 10.5 / 11.9 | none |
| Austria–Czechia | 14.8674, 48.7757 | west of Gmünd / České Velenice | 28 km | 10.1 / 10.7 | none |
| Austria–Slovakia | 16.9508, 48.2765 | on the Morava (March), at Marchegg | 2.4 km | 13.0 / exempt | none |

(The Slovak side of Austria–Slovakia lies wholly within the exempt 15 km of the crossing and 10 km of Bratislava. The drawn line still stays inside Slovakia, which the test below checks.)

`src/geo/route.test.ts` runs the same checks for Level 3's 16 directed moves: every border has its crossing, each lies on the real shared border (within 50 m), every leg stays inside its own country, reversed moves retrace the same line, and undoing a move leaves a prefix. All three shortest routes (Poland → Czechia, Slovakia or Germany → Austria) are drawn through their own countries only: none enters another country of the level. Poland → Germany → Austria passes west of Czechia at Germany's turning point. Every leg is inland, so no route crosses the Baltic.

### Level 4

Level 4's crossings were computed by a script with Level 2's rule 1: the vertex nearest the middle of the longest shared border line from which straight lines (in the map projection) to both capitals stay inside their countries and at least 10 km from any coast or other border, the first 10 km around a capital and 15 km around the crossing exempt. It found one for three of the five borders, with no turning points. For the other two, rule 2 (the vertex among the 30 nearest the middle that needs the fewest turning points), with lower clearances where the coast and borders leave no more room:

| Border | Crossing (lon, lat) | Where | From border middle | Turning points |
|---|---|---|---|---|
| Italy–Slovenia | 13.6085, 45.9266 | between Gorizia and Nova Gorica | 17 km | Italy: 11.78, 45.76 (the Veneto, near Bassano del Grappa) |
| Croatia–Slovenia | 15.6635, 45.8762 | Bregana, west of Zagreb | 39 km | none |
| Bosnia and Herzegovina–Croatia | 16.3817, 45.1076 | on the Una, near Dvor | 42 km (of the 711 km main line; the 83 km line around Croatia's far south is the other) | none |
| Croatia–Montenegro | 18.4441, 42.4778 | Debeli Brijeg / Karasovići | 0.3 km | Croatia: 9, including the Pelješac Bridge (below); Montenegro: 18.78, 42.54 (Krivošije, north of the Bay of Kotor) |
| Bosnia and Herzegovina–Montenegro | 18.6643, 43.2332 | in the mountains between Gacko and Plužine | 0.7 km | none |

**Why the turning points.**
- Rome to Gorizia in a straight line would cross the Adriatic (south of Rimini) and Venice's lagoon. One turning point inland in the Veneto keeps it on land, at least 21 km from any coast or border to there (well clear of San Marino too).
- Podgorica to the Croatian border in a straight line would cross the Bay of Kotor. One turning point in the hills north of the bay keeps it inland, with the 5 km clearance used for the narrow Alpine countries.
- **Zagreb to the Montenegrin border cannot be drawn on Croatian land at all.** Croatia's far south (the Pelješac peninsula, Dubrovnik and the 19 km border with Montenegro) is cut off from the rest of the country by Bosnia and Herzegovina's 20 km coast at Neum: in the map data, Croatia is a main body and a separate southern part (plus islands). A straight or turning line through Neum would enter Bosnia and Herzegovina; a line round it by sea would leave land.

**The smallest honest extension: the Pelješac Bridge.** Since 2022, Croatia's own road from the north to Dubrovnik bypasses Neum by the Pelješac Bridge (2,404 m, opened 26 July 2022; [Croatian Ministry of Physical Planning, Construction and State Assets](https://mpgi.gov.hr/vijesti-8/danas-se-otvara-peljeski-most-kojim-se-spaja-jug-hrvatske-s-ostatkom-drzave/14747); [Copernicus](https://www.copernicus.eu/en/media/image-day-gallery/inauguration-peljesac-bridge-croatia): it "avoids having to cross the border of the small coastal area that provides Bosnia-Herzegovina with an access to the Mediterranean Sea"). The route now draws Croatia's leg over it. A level may list **fixed links** (`map.routeLinks`): named segments of a leg's turning points that may cross water inside their own country. The Pelješac Bridge is the only one. `src/geo/route.test.ts` checks that each link joins two parts of its own country's land, is under 5 km, never enters another country (the bridge passes 1.3 km from Bosnia and Herzegovina's land at the tip of the Klek peninsula, and never touches it), and is used by a leg of that country; every other segment of every leg must still stay on its own country's land. Nothing else changed in how routes are drawn.

The link is drawn along the bridge's axis between the points where that line meets Croatian land **in the data**: 17.5554, 42.9547 on the mainland and 17.5238, 42.9187 on Pelješac, 4.75 km apart. The real ends ([OpenStreetMap](https://www.openstreetmap.org/way/1025189044): Komarna 42.9410, 17.5434; Brijesta 42.9229, 17.5275) both lie just off the data's coast, which Natural Earth's 1:10m data draws up to about 1.2 km off here; so the link is longer than the bridge by the data's coastal error, and follows its line.

Croatia's whole leg to Montenegro: Zagreb → Lika (15.43, 44.43) → the Neretva delta (17.58, 43.02) → the bridge → Ston (17.735, 42.83) → Slano (17.89, 42.802) → Dubrovnik (18.111, 42.663) → (18.165, 42.638) → (18.235, 42.615) → the crossing. Clearances: at least 3 km from the coast and from Bosnia and Herzegovina down to the Neretva delta (the strip between Makarska and Ploče is narrow); from the bridge to the border, Croatia's land is a strip 2–4 km wide between the sea and Bosnia and Herzegovina, narrowing to about 1.5 km near Župa and to the Ston isthmus, so the line keeps about 0.8 km from both, with turning points along its middle. This is a geometry limitation of the country itself, not of the data: the drawn line hugs the coast here because Croatia does.

The dataset's coastline is also coarser than the old town of Dubrovnik: the City Walls' map pin (the Minčeta Tower) lies about 0.5 km beyond the data's coast. The pin keeps its verified coordinate (CONTENT.md); `regionMap.test.ts` allows this one landmark to be up to 0.6 km from its country's land, and every other capital and landmark must lie inside.

`src/geo/route.test.ts` runs the same checks for Level 4's 10 directed moves: every border has its crossing, each lies on the real shared border (within 50 m), every leg stays inside its own country except the declared bridge, reversed moves retrace the same line, and undoing a move leaves a prefix. The one shortest route, Italy → Slovenia → Croatia → Montenegro, is drawn through its own countries only: it never enters Bosnia and Herzegovina. The e2e test checks the whole journey is drawn with all its points (18).

### Level 5

Level 5's crossings were computed by a script with Level 2's rule 1: the vertex nearest the middle of the longest shared border line from which straight lines (in the map projection) to both capitals stay inside their countries and at least 10 km from any coast or other border, the first 10 km around a capital and 15 km around the crossing exempt. It found one for five of the six borders, with no turning points, and every leg keeps at least 10 km from its country's edge:

| Border | Crossing (lon, lat) | Where | From border middle | Clearance (km, each side) | Turning points |
|---|---|---|---|---|---|
| Hungary–Romania | 21.5878, 46.8821 | near Geszt (Békés), west of Salonta | 0.5 km | 14.6 / 13.9 | none |
| Hungary–Serbia | 19.4877, 46.1342 | south of Csikéria, west of Subotica | 0.9 km | 13.7 / 12.0 | none |
| Romania–Serbia | 21.4592, 45.1739 | in the Banat, east of Vršac | 61 km | 12.7 / 11.9 | none |
| Bulgaria–Romania | 25.4263, 43.6544 | on the Danube, near Svishtov and Zimnicea | 9.4 km | 10.6 / 11.0 | none |
| Bulgaria–Serbia | 22.8968, 43.0628 | near Dimitrovgrad (Serbia) | 24 km | 13.8 / 10.1 | none |
| Bulgaria–Greece | 24.5676, 41.4680 | in the Rhodopes, north of Paranesti (Drama) | 26 km | 13.9 (Bulgaria) / 11.0 (Greece) | Bulgaria: 24.76, 41.59 (Smolyan); Greece: 23.74, 38.21 (Acharnes, north of Athens) · 22.40, 38.74 (west of Lamia) · 22.37, 40.56 (Alexandreia, Imathia) |

**Why the turning points.** Sofia to any vertex near the middle of the Bulgarian–Greek border runs within 10 km of that border for tens of kilometres; one turning point near Smolyan keeps it 17 km clear. Athens to the border in a straight line would cross the Euboean Gulf and the Thermaic Gulf. Rule 2 (the fewest turning points among the 30 vertices nearest the middle) found two, but the line it drew went west to Ioannina in Epirus and then back north-east, about 750 km where a straight line would be 394 km. Instead, the Greek leg was found as the shortest line through a 18 km grid of points at least 10 km inside Greece, with a cost of 25 km per turn: it runs up Greece's mainland corridor, north out of Attica, between the Gulf of Corinth and the Malian Gulf west of Lamia, up through Thessaly past Larissa and west of Mount Olympus, then across Macedonia north of Thessaloniki to the Rhodopes. It is 568 km with three turning points, at least 11 km from any coast or border throughout (legs: 13.2, 11.4, 11.0 and 12.3 km). The Bulgarian–Greek crossing is the one rule 2 found.

`src/geo/route.test.ts` runs the same checks for Level 5's 12 directed moves: every border has its crossing, each lies on the real shared border (within 50 m), every leg stays inside its own country (no fixed links: Level 5 needs no bridge), reversed moves retrace the same line, and undoing a move leaves a prefix. Both shortest routes (through Romania and through Serbia) are drawn through their own countries only, and a separate test checks every point of the Sofia–Athens line is on Bulgarian or Greek land, never at sea and never in North Macedonia, Albania or Turkey. The e2e test checks Hungary → Romania → Bulgaria → Greece is drawn with all its points (11), and Hungary → Serbia with 3.

### Level 6

Level 6's crossings were computed by a script with Level 2's rule 1: the vertex nearest the middle of the longest shared border line from which straight lines (in the map projection) to both capitals stay inside their countries and at least 10 km from any coast or other border, the first 10 km around a capital and 15 km around the crossing exempt. Rule 1 found one for every border, with no turning points, and every leg keeps at least 10 km from its country's edge. The same script, run on Germany–Poland, found Level 3's crossing again (same capitals, same border data), so Level 6 reads it from `central-europe.ts`, as Level 3 reads Level 2's.

| Border | Crossing (lon, lat) | Where | From border middle | Clearance (km, each side) | Turning points |
|---|---|---|---|---|---|
| Germany–Poland | 14.6063, 52.2758 | on the Oder, south of Frankfurt (Oder) (Level 3's) | 2.1 km | 11.9 / 10.0 | none |
| Lithuania–Poland | 23.2352, 54.2543 | near Puńsk, between Suwałki and Lazdijai | 0.9 km | 11.6 (Lithuania) / 15.2 (Poland) | none |
| Latvia–Lithuania | 24.0752, 56.2712 | between Joniškis and Bauska | 5.6 km | 12.6 (Lithuania) / 12.1 (Latvia) | none |
| Estonia–Latvia | 26.0028, 57.8459 | north-west of Valga / Valka | 15 km | 11.2 (Estonia) / 10.2 (Latvia) | none |

**Why these, and what they avoid.** Poland and Lithuania meet only on a short border (104 km in the Factbook) between Russia's Kaliningrad and Belarus, the Suwałki gap. Warsaw → Puńsk and Puńsk → Vilnius are straight lines that stay inside Poland and Lithuania with 11–15 km to spare, so the route never enters Kaliningrad or Belarus. Nearer the middle of the Estonian–Latvian border (Valga / Valka itself, a town divided by the border), the line from Tallinn leaves Estonia for a moment, or the Latvian leg passes within 8 km of the border; the first vertex where both legs keep 10 km is 15 km from the middle. No leg crosses the sea: Riga and Tallinn are on the coast, but their legs run inland, south and south-east; the Gulf of Riga and Estonia's islands are not on any line.

`src/geo/route.test.ts` runs the same checks for Level 6's 8 directed moves: every border has its crossing, each lies on the real shared border (within 50 m), every leg stays inside its own country (no fixed links: Level 6 needs no bridge), reversed moves retrace the same line, and undoing a move leaves a prefix. The one shortest route is drawn through its own countries only. The e2e test checks Germany → Poland → Lithuania → Latvia → Estonia is drawn with all its points (9), and Germany → Poland with 3.


## Content coordinates

Capital and landmark positions (WGS84, `src/core/content/countries.ts`) are city-centre or monument coordinates, rounded to about 4 decimals: Paris 48.8566, 2.3522 · Brussels 50.8503, 4.3517 · Amsterdam 52.3676, 4.9041 · Luxembourg City 49.6116, 6.1319 · Berlin 52.5200, 13.4050 · Bern 46.9481, 7.4475 · Vienna 48.2083, 16.3725 · Rome 41.8933, 12.4828 · Warsaw 52.2300, 21.0111 · Prague 50.0875, 14.4214 · Bratislava 48.1439, 17.1097 · Ljubljana 46.0514, 14.5061 · Zagreb 45.8131, 15.9775 · Sarajevo 43.8564, 18.4131 · Podgorica 42.4414, 19.2628 · Vilnius 54.6872, 25.2800 · Riga 56.9489, 24.1064 · Tallinn 59.4370, 24.7535 (GeoNames; see CONTENT.md, "Level 6"). They match commonly published values (Wikipedia/GeoNames). Landmark positions and their sources are listed in [CONTENT.md](CONTENT.md). The tests above confirm each point falls inside its country.
