# Lesson content: sources and artwork

Country and landmark content lives in `src/core/content/countries.ts`. English and Eastern Armenian text is stored side by side there. UI strings are in `src/core/i18n/`.

## Landmark facts and locations

Each landmark has a localized name, a localized in-sentence name (used in Find hints), one short fact, and, where it is a single place, a map location. Capital coordinates are stored separately from landmark coordinates. Tests (`src/geo/regionMap.test.ts`) check that every capital and landmark location lies inside its country in the map data.

| Country | Landmark | Fact (English) | Location (lat, lon) | Sources |
|---|---|---|---|---|
| France | Eiffel Tower | Built as the centrepiece of the 1889 World's Fair in Paris. | 48.8584, 2.2945 | [Wikipedia: Eiffel Tower](https://en.wikipedia.org/wiki/Eiffel_Tower) ("constructed as the centrepiece of the 1889 World's Fair"; coordinates 48.858222 N, 2.2945 E) |
| Belgium | Atomium | Built for the 1958 World's Fair in Brussels; shows an iron crystal magnified 165 billion times. | 50.8947, 4.3411 | [Wikipedia: Atomium](https://en.wikipedia.org/wiki/Atomium) ("centrepiece of the 1958 Brussels World's Fair (Expo 58)"; "nine iron atoms … an α-iron (ferrite) crystal, magnified 165 billion times"; 50.89472 N, 4.34111 E) |
| Netherlands | Amsterdam canal houses | They line Amsterdam's 17th-century canal ring, a UNESCO World Heritage Site since 2010. | none (see below) | [UNESCO World Heritage Centre: Seventeenth-Century Canal Ring Area of Amsterdam inside the Singelgracht](https://whc.unesco.org/en/list/1349/) (inscribed 2010); [Wikipedia: Canals of Amsterdam](https://en.wikipedia.org/wiki/Canals_of_Amsterdam) ("dug in the 17th century"; listed "as UNESCO World Heritage Site in 2010") |
| Luxembourg | Adolphe Bridge | Opened in 1903; its 85-metre stone arch spans the Pétrusse valley in Luxembourg City. | 49.6083, 6.1270 | [Wikipedia: Adolphe Bridge](https://en.wikipedia.org/wiki/Adolphe_Bridge) (opened 24 July 1903; crosses the Pétrusse; central arches 84.65 m; 49.6083 N, 6.1270 E) |
| Germany | Brandenburg Gate | Completed in 1791 in Berlin; crowned by the Quadriga, a bronze chariot drawn by four horses. | 52.5163, 13.3777 | [Wikipedia: Brandenburg Gate](https://en.wikipedia.org/wiki/Brandenburg_Gate) (built 1788–1791; bronze quadriga by Johann Gottfried Schadow; 52.5163 N, 13.3777 E) |

Notes:

- **Amsterdam canal houses** are a group of buildings along several canals, not one monument, so no single coordinate is invented for them. The landmark has no `coordinates` and no map pin. Its capital marker (Amsterdam) still shows in Discover.
- **Adolphe Bridge**: the arch is 84.65 m, rounded to "85-metre" in the fact. Sources also say it was intended to be the largest stone arch of its time; that superlative is left out because the source phrasing is hedged ("was to be").
- The Eiffel Tower coordinate (48.8584, 2.2945) was already in the project and is within 20 m of the Wikipedia value.
- Facts were checked on 2026-09-27. Armenian facts are translations of the English facts.

## Landmark illustrations

The five illustrations are **AI-generated stylised illustrations** supplied for this prototype. They are not photographs and should not be presented as such. They are drawn in a consistent cartoon style, not as exact architectural records. Provenance is recorded here only; the player interface shows no provenance notice. Each image has localized alt text ("Illustration of …" / «Նկարազարդում՝ …»).

| Country | Supplied original (kept unchanged) | Display copy | Artwork area in original |
|---|---|---|---|
| France | `public/images/landmarks/eiffel-tower.png` | `src/assets/landmarks/eiffel-tower.webp` (550×720) | 957×1252 at (148, 0) |
| Belgium | `public/images/landmarks/atomium.png` | `src/assets/landmarks/atomium.webp` (668×720) | 1144×1233 at (53, 4) |
| Netherlands | `public/images/landmarks/amsterdam-canal-houses.png` | `src/assets/landmarks/amsterdam-canal-houses.webp` (720×619) | 1248×1073 at (6, 119) |
| Luxembourg | `public/images/landmarks/adolphe-bridge.png` | `src/assets/landmarks/adolphe-bridge.webp` (720×421) | 1254×733 at (0, 277) |
| Germany | `public/images/landmarks/brandenburg-gate.png` | `src/assets/landmarks/brandenburg-gate.webp` (720×664) | 1242×1146 at (6, 61) |

### Originals

All five are 1254×1254 PNG, 8-bit RGBA, 0.9–1.7 MB. Their transparency is essentially binary: pixels are fully transparent or fully opaque, plus a thin 1–2% fringe of very faint pixels (alpha 1–32) left by background removal. The fringe is invisible on the card background at display size. The artwork fills very different parts of the square frame: the bridge uses about 55% of the height, the tower about 97%.

### Display copies

`scripts/prepare-landmarks.mjs` (run with `node scripts/prepare-landmarks.mjs`) creates the display copies:

1. Trim each original to its visible artwork (pixels with alpha > 32) plus a 2% transparent margin. No part of the artwork is cut: tower tips, bridge ends and the Quadriga stay whole.
2. Downsize to at most 720 px on the longer side, about 3× the largest on-screen size.
3. Save as lossless WebP, so the only lossy step is next/image's own encoding. Total 1.8 MB, versus 6.5 MB for the originals.

The app imports the display copies statically. `next/image` serves each device a resized, cached WebP, and the static import supplies intrinsic dimensions to prevent layout shift. Every card uses the same fixed illustration box with `object-fit: contain`. Because the copies are trimmed, tall and wide landmarks get similar visual weight.

To replace an illustration, overwrite the original in `public/images/landmarks/` and rerun the script.
