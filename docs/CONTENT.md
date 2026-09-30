# Level content: sources and artwork

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

| Switzerland | Chapel Bridge (Lucerne) | A covered wooden bridge from the 1300s in Lucerne, rebuilt in just eight months after a fire in 1993. | 47.0517, 8.3075 | [Lucerne Tourism: The Chapel Bridge](https://www.luzern.com/en/the-city/sights/top-sights/lucernes-landmarks-the-chapel-bridge-and-its-water-tower) ("A major part of the Chapel Bridge caught fire in the night of 18 August 1993 … rebuilt in a record eight months … reopened on 14 April 1994"); [kapellbruecke.com](https://www.kapellbruecke.com/en/chapel-bridge/) ("only mentioned for the first time in 1367 … built no earlier than 1356"); [Wikipedia: Kapellbrücke](https://en.wikipedia.org/wiki/Kapellbr%C3%BCcke) (47.05167 N, 8.3075 E) |
| Austria | Schönbrunn Palace (Vienna) | The Habsburg emperors' summer palace in Vienna. Its zoo, opened in 1752, is the oldest still open. | 48.1845, 16.3119 | [UNESCO World Heritage Centre: Palace and Gardens of Schönbrunn](https://whc.unesco.org/en/list/786) ("residence of the Habsburg emperors … Imperial summer residence"; zoo of 1752; inscribed 1996); [Wikipedia: Schönbrunn Zoo](https://en.wikipedia.org/wiki/Tiergarten_Sch%C3%B6nbrunn) ("Established in 1752, it is the world's oldest zoo still in operation"); [Wikipedia: Schönbrunn Palace](https://en.wikipedia.org/wiki/Sch%C3%B6nbrunn_Palace) (48.184516 N, 16.311865 E) |
| Italy | Colosseum (Rome) | Opened in AD 80, this Roman amphitheatre could hold about 50,000 spectators. | 41.8903, 12.4922 | [Britannica: Colosseum](https://www.britannica.com/topic/Colosseum) ("dedicated in 80 ce by Titus"; "could hold as many as 50,000 spectators"); [Wikipedia: Colosseum](https://en.wikipedia.org/wiki/Colosseum) (41.8903 N, 12.4922 E) |

Notes:

- **Chapel Bridge**: the build date is disputed (sources give 1333, "no earlier than 1356", first mentioned 1367), so the fact says "from the 1300s". The claim "Europe's oldest covered wooden bridge" is left out: Britannica puts it in the past tense (before the 1993 fire), Wikipedia in the present.
- **Colosseum**: "opened" (dedicated), not "completed": Domitian added the top storey in 82. Capacity estimates range from 50,000 to 80,000; the fact uses the conservative "about 50,000".
- **Schönbrunn**: UNESCO calls its 1752 zoo "the world's first zoo", which is arguable (earlier menageries existed); the fact says "the oldest still open" instead.
- Level 2 facts were checked on 2026-09-30.
- **Amsterdam canal houses** are a group of buildings along several canals, not one monument, so no single coordinate is invented for them. The landmark has no `coordinates` and no map pin. Its capital marker (Amsterdam) still shows in Discover.
- **Adolphe Bridge**: the arch is 84.65 m, rounded to "85-metre" in the fact. Sources also say it was intended to be the largest stone arch of its time; that superlative is left out because the source phrasing is hedged ("was to be").
- The Eiffel Tower coordinate (48.8584, 2.2945) was already in the project and is within 20 m of the Wikipedia value.
- Level 1 facts were checked on 2026-09-27. Armenian facts are translations of the English facts.

## Capitals (Level 2)

| Country | Capital | Location (lat, lon) | Source |
|---|---|---|---|
| Switzerland | Bern (Բեռն) | 46.9481, 7.4475 | [Wikipedia: Bern](https://en.wikipedia.org/wiki/Bern) (46.94806 N, 7.4475 E) |
| Austria | Vienna (Վիեննա) | 48.2083, 16.3725 | [Wikipedia: Vienna](https://en.wikipedia.org/wiki/Vienna) |
| Italy | Rome (Հռոմ) | 41.8933, 12.4828 | [Wikipedia: Rome](https://en.wikipedia.org/wiki/Rome) (41.89333 N, 12.48278 E) |

France and Germany reuse Level 1's capitals and landmarks. Capital and landmark coordinates are stored separately, as in Level 1.

**Bern** has no de jure status as capital. The Swiss government ([FDFA, About Switzerland: Political system](https://www.aboutswitzerland.eda.admin.ch/en/political-system)) says: "Bern is the de facto capital city of Switzerland, though officially it is referred to only as the ‹federal city›." The card labels it "Capital", as atlases do. The Armenian Wikipedia article says the same («փաստացի մայրաքաղաքը … «դաշնային քաղաք»»).

## Names in Armenian

Country, capital and landmark names follow the Armenian Wikipedia article titles (checked 2026-09-30): Շվեյցարիա, Ավստրիա, Իտալիա, Բեռն, Վիեննա, Հռոմ, Կոլիզեում, and «Շյոնբրունի պալատ» (the lead of the article Շյոնբրուն). The Levels 3–5 country names (`src/core/content/names.ts`) come from the same source. **Chapel Bridge has no Armenian article or standard name.** «Մատուռի կամուրջ» ("the chapel's bridge", a translation of *Kapellbrücke*) is our own rendering and should be checked by a native speaker.

## Level-specific hints

A country's hint describes it within its level's region. Where Level 1's hint would be wrong in Level 2, the level has its own (`hints` in `src/core/lessons/alps.ts`): Germany is "in the north of this region" in Level 2, not "in the east". France's hint (the largest country, coasts on the Atlantic and the Mediterranean) is true in both.

## Level 2 illustrations

The Chapel Bridge, Schönbrunn Palace and Colosseum were supplied on 2026-09-30 and prepared like Level 1's (see "Landmark illustrations" below). Until then their cards showed the landmark as text (`data-art="none"`); every Level 2 card now shows its own illustration.

The briefs and prompts they were requested with, kept for replacing them or illustrating later levels:

- **Style:** stylised cartoon illustration in the same hand as `public/images/landmarks/*.png`. Warm, friendly and slightly chunky, with clean dark outlines, soft shading and no text. A little ground or water at the base, like the Eiffel Tower's lawn or the canal houses' water. Not photographic and not an exact architectural record.
- **Format:** 1254×1254 PNG, 8-bit RGBA, transparent background (binary alpha), the artwork whole within the frame.

| Landmark | Save the original to | Content |
|---|---|---|
| Chapel Bridge, Lucerne | `public/images/landmarks/chapel-bridge.png` | The covered wooden footbridge crossing the river Reuss diagonally, with its shingled roof and the flower boxes along its sides, and the octagonal stone Water Tower (Wasserturm) standing in the river beside it. Calm blue-green water beneath. Wide composition. |
| Schönbrunn Palace, Vienna | `public/images/landmarks/schonbrunn-palace.png` | The long Baroque garden façade in "Schönbrunn yellow" with white trim and a central balcony, a strip of formal garden in front, and optionally the Gloriette arcade small on a hill behind. Wide composition. |
| Colosseum, Rome | `public/images/landmarks/colosseum.png` | The oval amphitheatre in warm travertine: the taller intact outer wall with three tiers of arches, and the lower, broken side showing the inner arches. A little grass or paving at its base. Wide composition. |

### Generation prompts

Ready to paste into an image generator. Each one starts with the same style paragraph, then describes its landmark. After generating, check the result: the background must be transparent (remove it if the tool cannot export alpha), the landmark must be whole inside the frame with nothing cropped, and there must be no text, people, frame or shadow on the background. Save it under the filename in the table above.

Style paragraph (shared):

> Stylised cartoon illustration for a children's geography game, in the style of a friendly travel-atlas sticker. Seen from a slightly raised three-quarter view. Clean, confident dark navy outlines of even weight; flat colour fills with soft cel shading and gentle highlights; warm, bright but soft colours; slightly chunky, simplified proportions with recognisable architectural detail. The landmark alone on a fully transparent background (PNG with alpha channel): no sky, no scenery behind it, no cast shadow on the background, no border or frame, no text, letters, signs or watermark, no people. The whole landmark fits inside the square with a small empty margin, nothing cropped. Square image, 1254×1254 px.

1. **`chapel-bridge.png`**
   > [style paragraph] Subject: the Chapel Bridge (Kapellbrücke) in Lucerne, Switzerland. A long covered wooden footbridge crossing the river diagonally from the left foreground towards the right, with a dark reddish-brown shingled roof on wooden posts, warm brown timber sides, and red and pink flowers in boxes along its outer railings. Beside it, standing in the river, the octagonal stone Water Tower (Wasserturm) in weathered beige sandstone with a steep, dark brown tiled pointed roof. Calm turquoise-blue water under the bridge forms a small base with a few soft ripples. Wide, landscape-shaped artwork within the square.

2. **`schonbrunn-palace.png`**
   > [style paragraph] Subject: Schönbrunn Palace in Vienna, Austria, garden side. The long, symmetrical Baroque façade in warm golden "Schönbrunn yellow", with crisp white window frames and pilasters and a grey-green roof. The slightly projecting centre has a wide balcony above a double outdoor staircase. In front, a narrow strip of formal garden forms a small base: trimmed green lawns, low hedges and pale gravel paths. Optionally, the Gloriette arcade small and pale on a green hill just above the roofline at the centre. Wide, landscape-shaped artwork within the square.

3. **`colosseum.png`**
   > [style paragraph] Subject: the Colosseum in Rome, Italy, from outside at a slight angle. The oval Roman amphitheatre in warm cream and honey-coloured travertine. On the left, the taller intact outer wall: three tiers of round arches framed by half-columns, topped by a solid storey with small rectangular windows. Towards the right, the lower, broken side reveals the inner rings of arches. A little stone paving and a few tufts of grass at its base. Wide, landscape-shaped artwork within the square.

## Landmark illustrations

The eight illustrations (Level 1's five, and Level 2's Chapel Bridge, Schönbrunn Palace and Colosseum, added 2026-09-30) are **AI-generated stylised illustrations** supplied for this prototype. They are not photographs and should not be presented as such. They are drawn in a consistent cartoon style, not as exact architectural records. Provenance is recorded here only; the player interface shows no provenance notice. Each image has localized alt text ("Illustration of …" / «Նկարազարդում՝ …»).

| Country | Supplied original (kept unchanged) | Display copy | Artwork area in original |
|---|---|---|---|
| France | `public/images/landmarks/eiffel-tower.png` | `src/assets/landmarks/eiffel-tower.webp` (550×720) | 957×1252 at (148, 0) |
| Belgium | `public/images/landmarks/atomium.png` | `src/assets/landmarks/atomium.webp` (668×720) | 1144×1233 at (53, 4) |
| Netherlands | `public/images/landmarks/amsterdam-canal-houses.png` | `src/assets/landmarks/amsterdam-canal-houses.webp` (720×619) | 1248×1073 at (6, 119) |
| Luxembourg | `public/images/landmarks/adolphe-bridge.png` | `src/assets/landmarks/adolphe-bridge.webp` (720×421) | 1254×733 at (0, 277) |
| Germany | `public/images/landmarks/brandenburg-gate.png` | `src/assets/landmarks/brandenburg-gate.webp` (720×664) | 1242×1146 at (6, 61) |
| Switzerland | `public/images/landmarks/chapel-bridge.png` | `src/assets/landmarks/chapel-bridge.webp` (720×720) | 1254×1254 at (0, 0) (the artwork reaches to within 2% of every edge) |
| Austria | `public/images/landmarks/schonbrunn-palace.png` | `src/assets/landmarks/schonbrunn-palace.webp` (720×221) | 2172×668 at (0, 44) |
| Italy | `public/images/landmarks/colosseum.png` | `src/assets/landmarks/colosseum.webp` (720×598) | 1254×1042 at (0, 144) |

### Originals

Level 1's five are 1254×1254 PNG, 8-bit RGBA, 0.9–1.7 MB. Their transparency is essentially binary: pixels are fully transparent or fully opaque, plus a thin 1–2% fringe of very faint pixels (alpha 1–32) left by background removal. The fringe is invisible on the card background at display size. The artwork fills very different parts of the square frame: the bridge uses about 55% of the height, the tower about 97%.

Level 2's three are 8-bit RGBA PNG, 1.8–2.3 MB: the Chapel Bridge and the Colosseum 1254×1254, Schönbrunn Palace 2172×724 (not square; the script handles any size). Checked on arrival: transparent corners, no artwork touching the frame's edge, no text or people, and edges as crisp as Level 1's (0.5–1.3% of pixels semi-transparent, against 0.5–0.9%). Seen on black they show thin coloured fringes (orange at the bridge's roof, cyan at its water, yellow on the Colosseum) and Schönbrunn a faint whitish smear under its gravel, all left by background removal; composited on the card's sky-to-mint tile these are not visible. They are more painterly than Level 1's, with lighter outlines. Schönbrunn is very wide (about 3.3:1): on phones it uses the wide layout below.

### Display copies

`scripts/prepare-landmarks.mjs` (run with `node scripts/prepare-landmarks.mjs`) creates the display copies:

1. Trim each original to its visible artwork (pixels with alpha > 32) plus a 2% transparent margin. No part of the artwork is cut: tower tips, bridge ends and the Quadriga stay whole.
2. Downsize to at most 720 px on the longer side, about 3× the largest on-screen size.
3. Save as lossless WebP, so the only lossy step is next/image's own encoding. Total 3.1 MB, versus 12.7 MB for the originals.

The app imports the display copies statically. `next/image` serves each device a resized, cached WebP, and the static import supplies intrinsic dimensions to prevent layout shift. Every card uses the same fixed illustration box with `object-fit: contain`. Because the copies are trimmed, tall and wide landmarks get similar visual weight.

**Very wide art on phones.** An illustration whose display copy is at least **2:1** (width ÷ height, `WIDE_ART_ASPECT` in `src/components/landmarks/LandmarkCard.tsx`) gets a different phone layout: the country's name and capital as a compact heading, the art in a shallow tile across the card below them (the same colours and corners), then the landmark's name and fact and the country's description. The tile's height follows the art's own proportions, up to `max(56px, 11svh)` so that the name, capital and whole artwork fit above the pinned button on a 320×568 screen. Since the ratio comes from the static import, the layout is decided before the image loads, and nothing moves when it does. Everything else keeps the square tile beside the name, and desktop is unchanged.

Why 2:1: in the square tile, art of aspect *a* uses 1/*a* of the tile's height. In the shallow tile (about 262×62 px at 320×568), art below about 2:1 would be drawn no larger. The Adolphe Bridge (1.71) would go from 100×58 px to about 106×62 px, so it keeps the side-by-side layout. The current copies are 0.76–1.71 or 3.26, so 2 sits in the gap. Today only **Schönbrunn Palace (3.26)** uses the wide layout. It is drawn at 204×62 px at 320×568 (100×30 px before), 229×70 at 320×640, 238×73 at 390×664 (117×35 before) and 302×93 at 390×844.

To replace an illustration, overwrite the original in `public/images/landmarks/` and rerun the script.
