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

Country, capital and landmark names follow the Armenian Wikipedia article titles (checked 2026-09-30): Շվեյցարիա, Ավստրիա, Իտալիա, Բեռն, Վիեննա, Հռոմ, Կոլիզեում, and «Շյոնբրունի պալատ» (the lead of the article Շյոնբրուն). Level 5's country names (`src/core/content/names.ts`) come from the same source; Level 4's are in its own section below. Level 3's names are listed in its own section below. **Chapel Bridge has no Armenian article or standard name.** «Մատուռի կամուրջ» ("the chapel's bridge", a translation of *Kapellbrücke*) is our own rendering and should be checked by a native speaker.

## Level-specific hints

A country's hint describes it within its level's region. Where Level 1's hint would be wrong in Level 2, the level has its own (`hints` in `src/core/lessons/alps.ts`): Germany is "in the north of this region" in Level 2, not "in the east". France's hint (the largest country, coasts on the Atlantic and the Mediterranean) is true in both. Level 3 has its own hints for Germany ("in the west") and Austria ("in the south"); see its section below. Level 6 has its own for Poland ("the largest country of this region, in its south-west") and Belarus ("in the south-east of this region"); its first version, kept for attempts started on it, had its own for Germany ("in the south-west") and Poland ("in the south of this region, east of Germany"); see its section. Level 7 has its own for France ("north of the Pyrenees"), where "the largest country" would not tell it from Spain; see its section. Level 8 has its own for Poland ("the westernmost country of this region") and Romania ("the southernmost"), where their usual hints ("in the north-east", "the largest country") would be wrong; see its section.

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

## Level 3: Central Europe

Germany and Austria reuse their shared content and illustrations (the Brandenburg Gate, Schönbrunn Palace). Poland, Czechia and Slovakia are new. Their content was checked on 2026-09-30.

### Capitals and landmarks

| Country | Capital | Capital (lat, lon) | Landmark | Landmark (lat, lon) | Fact (English) | Sources |
|---|---|---|---|---|---|---|
| Poland (Լեհաստան) | Warsaw (Վարշավա) | 52.2300, 21.0111 | Wawel Castle, Kraków (Վավելի ամրոց) | 50.0539, 19.9347 | For centuries the home of Poland's kings, it stands on a hill above the Vistula River in Kraków. | [Wikipedia: Wawel Castle](https://en.wikipedia.org/wiki/Wawel_Castle) ("For centuries the residence of the kings of Poland"; "atop a limestone outcrop on the left bank of the Vistula River"; 50.05389 N, 19.93472 E); [UNESCO World Heritage Centre: Historic Centre of Kraków](https://whc.unesco.org/en/list/29/) ("Wawel Hill … is a former royal residence and necropolis"; "the relationship between the River Vistula and the local hills and rock outcrops, best illustrated by the Wawel Hill complex"); [Wikipedia: Warsaw](https://en.wikipedia.org/wiki/Warsaw) (52.23 N, 21.01111 E) |
| Czechia (Չեխիա) | Prague (Պրահա) | 50.0875, 14.4214 | Charles Bridge, Prague (Կառլի կամուրջ) | 50.0864, 14.4119 | Begun in 1357, this stone bridge was Prague's only way across the Vltava River until 1841. | [Britannica: Charles Bridge](https://www.britannica.com/topic/Charles-Bridge) ("stone arch bridge built between 1357 and 1402 over the Vltava River"; "The cornerstone for the new bridge was laid in 1357"; "It was the only bridge over the Vltava in Prague until 1841"); [Wikipedia: Charles Bridge](https://en.wikipedia.org/wiki/Charles_Bridge) ("Its construction started in 1357"; "the only means of crossing the river Vltava until 1841"; 50.08639 N, 14.41194 E); [UNESCO: Historic Centre of Prague](https://whc.unesco.org/en/list/616/) ("the Gothic Charles Bridge"); [Wikipedia: Prague](https://en.wikipedia.org/wiki/Prague) (50.0875 N, 14.42139 E) |
| Slovakia (Սլովակիա) | Bratislava (Բրատիսլավա) | 48.1439, 17.1097 | Bratislava Castle (Բրատիսլավայի ամրոց) | 48.1422, 17.1000 | This rectangular castle with four corner towers stands on a rocky hill above the Danube. | [Wikipedia: Bratislava Castle](https://en.wikipedia.org/wiki/Bratislava_Castle) ("The massive rectangular building with four corner towers stands on an isolated rocky hill of the Little Carpathians, directly above the Danube river"; 48.14222 N, 17.1 E); [Britannica: Bratislava](https://www.britannica.com/place/Bratislava) ("dominated by its enormous castle, which stands on a plateau 300 feet (100 meters) above the Danube"); [Wikipedia: Bratislava](https://en.wikipedia.org/wiki/Bratislava) (48.14389 N, 17.10972 E) |

Notes:

- **Wawel Castle is in Kraków, not the capital.** The fact names Kraków, and its map pin is in Kraków, 250 km from the Warsaw capital marker. The Find hint says "You'll also find Wawel Castle there", "there" being the country.
- **Charles Bridge**: "Begun in 1357" rather than "built in 1357": the foundation stone was laid in 1357 and the bridge was finished in the early 15th century (Britannica: 1402). Its 30 statues are left out because they are now all replicas. The pin is 700 m from Prague's capital marker, so at the whole-map view the map shows only the capital marker (the landmark pin is left out when it would sit on the capital marker, as for every level).
- **Bratislava Castle**: its four corner towers are its best-known feature and what the artwork brief shows. Britannica says it burned in 1811 and has since been largely restored; that is left out to keep one fact. It is 700 m from the capital marker, like Charles Bridge.
- Capital coordinates are the Wikipedia article coordinates, rounded to 4 decimals, like the other capitals.

### Names in Armenian

Every Level 3 name has an established form: each is the title of the Armenian Wikipedia article linked from the English one (checked 2026-09-30 through the MediaWiki API, `prop=langlinks`), and the article leads use the same forms:

| English | Eastern Armenian | Armenian Wikipedia article |
|---|---|---|
| Poland / Warsaw | Լեհաստան / Վարշավա | Լեհաստան, Վարշավա |
| Czechia / Prague | Չեխիա / Պրահա | Չեխիա, Պրահա |
| Slovakia / Bratislava | Սլովակիա / Բրատիսլավա | Սլովակիա, Բրատիսլավա |
| Wawel Castle | Վավելի ամրոց | Վավելի ամրոց (lead: «Վավելի թագավորական ամրոց») |
| Charles Bridge | Կառլի կամուրջ | Կառլի կամուրջ |
| Bratislava Castle | Բրատիսլավայի ամրոց | Բրատիսլավայի ամրոց |
| Kraków, Vistula, Vltava, Danube (in the facts) | Կրակով, Վիսլա, Վլտավա, Դանուբ | the articles of those titles |

Flagged for a native speaker's check (not presented as established usage):

- **Կառլի, not Կարլի.** The article title spells Charles IV's name «Կառլ» (as in Russian-derived usage). «Կարլի կամուրջ» also occurs in Armenian texts; we follow the article.
- **Վիսլա.** The Kraków article uses «Վիսլա», while the Wawel Castle article's lead says «Վիստուլա». The river's own article is «Վիսլա», which we use.
- The in-sentence forms add the definite article (Լեհաստանը, Չեխիան, Սլովակիան; Վավելի ամրոցը, Կառլի կամուրջը, Բրատիսլավայի ամրոցը), following the pattern of the earlier levels. The Armenian facts and hints are our translations of the English ones.

### Descriptions and Find hints

A country's description is its hint (`hint`): the card shows it under the landmark in Discover, and Find's second hint repeats it ("More help"). Find's first hint names the capital and the landmark. The hints describe each country within this level's region:

| Country | Hint (English) | Where it comes from |
|---|---|---|
| Germany | The large country in the west of this region, reaching both the North Sea and the Baltic Sea. | Level 3's own (`hints` in `src/core/lessons/central-europe.ts`): Level 1 says "east", Level 2 "north". |
| Poland | A large, mostly flat country in the north-east of this region, with a coast on the Baltic Sea. | The country's own. |
| Czechia | A country with no coast in the middle of this region, almost ringed by low mountains. | The country's own. |
| Slovakia | A small mountain country with no coast in the south-east of this region, just south of Poland. | The country's own. |
| Austria | A mountain country with no coast in the south of this region, south of Germany and Czechia. | Level 3's own: the shared hint ("in the east of this region, just south of Germany", used by Level 2) would be wrong here. |

Levels 1 and 2 keep their hints unchanged (`src/core/content/content.test.ts` checks both).

### Illustrations

Wawel Castle, Charles Bridge and Bratislava Castle were supplied on 2026-09-30 and prepared like the others (see "Landmark illustrations" below). Before that, their cards used the text-only layout (the map's amber landmark mark beside the landmark's name and fact, `data-art="none"`), which remains for any landmark without artwork. Find never shows artwork.

They were integrated with the steps kept here for later levels:

1. run `node scripts/prepare-landmarks.mjs` (it prepares every PNG in the folder, so `src/assets/landmarks/<key>.webp` appears; the existing copies came out byte-identical);
2. add `illustration: "<key>"` to the landmark in `src/core/content/countries.ts`;
3. import the display copy into `LANDMARK_IMAGES` in `src/components/landmarks/LandmarkCard.tsx`;
4. update the expectations in `src/core/content/content.test.ts` and `e2e/level3.spec.ts`.

Art at least 2:1 (width ÷ height after trimming) gets the wide phone layout automatically (see "Very wide art on phones"). These three are about 1.5:1, so they use the square tile beside the name, like the other ordinary art.

Alt text follows the existing pattern, with the in-sentence name: "Illustration of Wawel Castle" / «Նկարազարդում՝ Վավելի ամրոցը», "Illustration of the Charles Bridge" / «Նկարազարդում՝ Կառլի կամուրջը», "Illustration of Bratislava Castle" / «Նկարազարդում՝ Բրատիսլավայի ամրոցը».

The briefs they were requested with:

| Landmark | Save the original to | Key | Content |
|---|---|---|---|
| Wawel Castle, Kraków | `public/images/landmarks/wawel-castle.png` | `wawel-castle` | The castle and cathedral complex on its hill above the river: pale limestone and brick walls, red-tiled roofs, the cathedral's golden Sigismund Chapel dome and green-copper spires. Wide composition. |
| Charles Bridge, Prague | `public/images/landmarks/charles-bridge.png` | `charles-bridge` | The long medieval stone arch bridge across the river, with a dark Gothic bridge tower at one end and a few dark statues along its parapets. Wide composition. |
| Bratislava Castle | `public/images/landmarks/bratislava-castle.png` | `bratislava-castle` | The white, rectangular castle with a red roof and four corner towers, on a green hill above the river. Wide composition. |

#### Generation prompts

Each starts with the shared style paragraph (Level 2's, above), then describes its landmark. Check each result as for Level 2: transparent background, the landmark whole inside the frame, no text, people, frame or shadow on the background.

1. **`wawel-castle.png`**
   > [style paragraph] Subject: Wawel Royal Castle and Wawel Cathedral in Kraków, Poland, seen from across the Vistula. On a gentle green hill with a stone retaining wall, a cluster of pale cream limestone and red-brick buildings with steep red-tiled roofs. At the centre, the cathedral's gleaming golden dome (the Sigismund Chapel) and its towers topped with green copper spires and small golden details; the castle's long Renaissance wings with rows of windows beside it. A narrow strip of calm blue river water at the base. Wide, landscape-shaped artwork within the square.

2. **`charles-bridge.png`**
   > [style paragraph] Subject: the Charles Bridge in Prague, Czechia. A long medieval stone bridge in warm grey-brown sandstone crossing the river from left to right on a row of round arches, with pointed stone cutwaters in the water. At the right end, the Old Town Bridge Tower: a tall dark Gothic tower with a steep dark slate roof and a pointed archway over the bridge. Along the parapets, a few small dark bronze-coloured statues on pedestals. Calm blue water under the arches forms the base. Wide, landscape-shaped artwork within the square.

3. **`bratislava-castle.png`**
   > [style paragraph] Subject: Bratislava Castle in Slovakia. A massive, simple rectangular white castle with a red-orange tiled roof and four square corner towers, each with its own red roof, rows of regular windows, on top of a green hill with a few trees and a stone terrace wall. At the foot of the hill, a narrow strip of the calm blue Danube. Wide, landscape-shaped artwork within the square.

## Level 4: Along the Adriatic

Italy reuses its shared content and illustration (Rome, the Colosseum). Slovenia, Croatia, Bosnia and Herzegovina and Montenegro are new. Their content was checked on 2026-10-01.

### Capitals and landmarks

| Country | Capital | Capital (lat, lon) | Landmark | Landmark (lat, lon) | Fact (English) | Sources |
|---|---|---|---|---|---|---|
| Slovenia (Սլովենիա) | Ljubljana (Լյուբլյանա) | 46.0514, 14.5061 | Bled Castle, Bled (Բլեդի ամրոց) | 46.3697, 14.1005 | Perched on a 130-metre cliff above Lake Bled, it was first mentioned in writing in 1011. | [Bled Castle (official): home](https://www.blejski-grad.si/en/) ("Built on a 130-meter-high cliff"); [Bled Castle (official): history](https://www.blejski-grad.si/en/discover-bled-castle/history/) ("donation deed signed in 1011 by King Henry II, in which the castle is referred to as castellum Veldes"); [Wikipedia: Bled Castle](https://en.wikipedia.org/wiki/Bled_Castle) (46°22′11″N 14°06′02″E; OpenStreetMap "Blejski grad" 46.36970, 14.10052); [Wikipedia: Ljubljana](https://en.wikipedia.org/wiki/Ljubljana) (46.05139 N, 14.50611 E) |
| Croatia (Խորվաթիա) | Zagreb (Զագրեբ) | 45.8131, 15.9775 | City Walls of Dubrovnik (Դուբրովնիկի պարիսպներ) | 42.6430, 18.1084 (the Minčeta Tower) | Almost 2 kilometres long, with towers and fortresses, these walls ring Dubrovnik's old town. | [Dubrovnik City Walls (official)](https://citywallsdubrovnik.hr/the-city-walls/) ("The 1940m long walls consist of the main city wall, sixteen towers, three fortresses, six bastions…"); [UNESCO World Heritage Centre: Old City of Dubrovnik](https://whc.unesco.org/en/list/95/) (inscribed 1979, extended 1994); OpenStreetMap, Minčeta Tower (42.6430, 18.1084); [Wikipedia: Zagreb](https://en.wikipedia.org/wiki/Zagreb) (45°48′47″N 15°58′39″E) |
| Bosnia and Herzegovina (Բոսնիա և Հերցեգովինա) | Sarajevo (Սարաևո) | 43.8564, 18.4131 | Stari Most, Mostar (Մոստարի կամուրջ) | 43.3373, 17.8151 | Mostar's “Old Bridge”, a stone arch over the Neretva from 1566, was destroyed in 1993 and rebuilt in 2004. | [UNESCO World Heritage Centre: Old Bridge Area of the Old City of Mostar](https://whc.unesco.org/en/list/946/) (inscribed 2005); [Wikipedia: Stari Most](https://en.wikipedia.org/wiki/Stari_Most) (built 1557–1566 by Mimar Hayruddin; destroyed 9 November 1993; rebuilt and reopened 23 July 2004; 43°20′14″N 17°48′54″E; OpenStreetMap 43.33727, 17.81509); [Wikipedia: Sarajevo](https://en.wikipedia.org/wiki/Sarajevo) (43°51′23″N 18°24′47″E) |
| Montenegro (Չեռնոգորիա) | Podgorica (Պոդգորիցա) | 42.4414, 19.2628 | Ostrog Monastery (Օստրոգի վանք) | 42.6747, 19.0306 (the upper monastery) | Founded in the 17th century, it is built into an almost vertical cliff 900 metres above sea level. | [Montenegro Travel (national tourism organisation): top 10 attractions](https://www.montenegro.travel/en/inspiration-for-a-dream-trip/en167/top-10-attractions-of-montenegro) ("Carved in a stone cliff in the mountain massif of Ostroška Greda 900 m above sea level"); [Montenegro Travel: sacral objects](https://www.montenegro.travel/en/explore-montenegro/culture-and-tours/sacral-objects) (900 m; the Church of the Holy Cross carved into a cave in 1665 for the relics of St Basil of Ostrog); [Wikipedia: Ostrog Monastery](https://en.wikipedia.org/wiki/Ostrog_Monastery) ("founded by Vasilije, the Metropolitan Bishop of Herzegovina in the 17th century"; "placed against an almost vertical background"); OpenStreetMap, Upper Ostrog Monastery (42.67470, 19.03061); [Wikipedia: Podgorica](https://en.wikipedia.org/wiki/Podgorica) (42.4414 N, 19.2628 E) |

Notes:

- **No landmark is in its capital.** Bled is 50 km north-west of Ljubljana; Dubrovnik is in Croatia's far south, about 400 km from Zagreb (and cut off from the rest of Croatia by Bosnia and Herzegovina's coast at Neum, see DATA.md); Mostar is 70 km south-west of Sarajevo; Ostrog is 40 km north-west of Podgorica. Each pin is the monument's own coordinate, separate from the capital marker, and the facts never say otherwise.
- **Bled Castle**: the official site calls it "the oldest in Slovenia" on its home page but "among the oldest castles in Slovenia mentioned in written sources" on its history page, so the fact says only that it was first mentioned in writing in 1011. A 1004 deed gave Bled to the Bishop of Brixen without naming the castle; the Armenian Wikipedia article «Բլեդ» gives 1004 for the castle, mixing the two up.
- **City Walls of Dubrovnik**: 1,940 m, rounded to "almost 2 kilometres". The pin is the Minčeta Tower, the walls' highest point. **Natural Earth's 1:10m coastline at Dubrovnik is coarser than the old town**: the data's coast runs about 0.5 km north of it, so the pin sits that far off the drawn coast (at most about 4 px at the deepest zoom on desktop). The coordinate is kept as verified rather than moved inland onto the hillside; `src/geo/regionMap.test.ts` allows this landmark, and only this one, up to 0.6 km from Croatia's land in the data.
- **Stari Most**: built 1557–1566, so "from 1566" (its completion, the date UNESCO gives). Wikipedia gives its height above the river as 21 m in one place and "roughly 20 m" in another, so the fact leaves the height out. Its destruction in 1993 and reconstruction are the reason for its UNESCO listing; the fact states them plainly.
- **Ostrog Monastery**: "900 metres above sea level" (one tour site wrongly says 900 m above the valley floor). The pin is the upper monastery, built into the cliff.
- **Podgorica** is the capital (Constitution of Montenegro, Art. 5: "The capital of Montenegro shall be Podgorica, The Old Royal Capital of Montenegro shall be Cetinje"); the card says "Capital", as for the others.
- The CIA World Factbook (used for the border lengths in DATA.md) was retired on 4 February 2026; its last edition was read from the [factbook.json mirror](https://github.com/factbook/factbook.json). UNESCO's pages refused automated requests, so their inscription years were confirmed from their search listings and Wikipedia.
- Capital coordinates are the Wikipedia article coordinates, rounded to 4 decimals, like the other capitals.

### Names in Armenian

The country and capital names are the titles of their Armenian Wikipedia articles (checked 2026-10-01): Սլովենիա, Խորվաթիա, Բոսնիա և Հերցեգովինա, Չեռնոգորիա; Լյուբլյանա, Զագրեբ, Սարաևո, Պոդգորիցա. The in-sentence forms add the definite article: Սլովենիան, Խորվաթիան, Բոսնիա և Հերցեգովինան (on the last word), Չեռնոգորիան.

| English | Eastern Armenian | Status |
|---|---|---|
| Bled Castle | Բլեդի ամրոց | The Armenian article «Բլեդ» calls it this; there is no article of its own. |
| City Walls of Dubrovnik | Դուբրովնիկի պարիսպներ | **Our rendering**: no Armenian article; the «Դուբրովնիկ» article speaks of «պաշտպանիչ պարիսպներ» (defensive walls). |
| Stari Most | Մոստարի կամուրջ | The Armenian article's title (its lead: «Մոստարի կամուրջ կամ Հին կամուրջ»). The fact calls it «Հին կամուրջ» in quotes, as the article does. |
| Ostrog Monastery | Օստրոգի վանք | **Our rendering**: no Armenian article found. |
| Neretva, Neum, Lake Bled (in facts and hints) | Ներետվա, Նեում, Բլեդ լիճ | Transliterations; Ներետվա and Նեում have no Armenian articles. |

Flagged for a native speaker's check (not presented as established usage):

- **Դուբրովնիկի պարիսպներ** and **Օստրոգի վանք** (above).
- **Croatia's hint**: «…որը աղեղով շրջապատում է Բոսնիա և Հերցեգովինան» ("which curves around Bosnia and Herzegovina like an arc") is our wording of the English "curving around".
- **Bosnia and Herzegovina's hint** uses «ծովափ» for "coast" and «կմ» for "km", as the other hints use «ափ» and numbers; a reviewer may prefer «ափ» or the unabbreviated «կիլոմետր».
- **Italy's Level 4 hint**, «Ադրիատիկ ծովի արևմտյան կողմում» ("on the west side of the Adriatic Sea").
- **regionName** «Ադրիատիկյան երկրներ» (in the map's accessible label «Քարտեզ՝ Ադրիատիկյան երկրներ»), formed like Level 2's «Ալպյան երկրներ».

The Armenian facts and hints are our translations of the English ones.

### Descriptions and Find hints

As in Level 3, a country's description is its hint, shown in Discover and repeated by Find's second hint; Find's first hint names the capital and the landmark.

| Country | Hint (English) | Where it comes from |
|---|---|---|
| Italy | The long, boot-shaped peninsula on the west side of the Adriatic Sea. | Level 4's own (`hints` in `src/core/lessons/adriatic.ts`). Italy's shared hint ("…reaching into the Mediterranean Sea, south of the Alps", used by Level 2) stays unchanged. |
| Slovenia | A small country where the Alps meet the Adriatic, with a short coast just east of Italy. | The country's own. |
| Croatia | A crescent-shaped country with a long Adriatic coast and many islands, curving around Bosnia and Herzegovina. | The country's own. |
| Bosnia and Herzegovina | A mountainous country between Croatia and Montenegro, whose only coast, at Neum, is about 20 km long. | The country's own; 20 km is the Factbook's figure (some sources give 21–24.5 km). |
| Montenegro | A small mountainous country on the Adriatic in the south-east of this region, south of Bosnia and Herzegovina. | The country's own. |

### Illustrations

Bled Castle, the City Walls of Dubrovnik, Stari Most and Ostrog Monastery were supplied on 2026-10-01 and integrated with the four steps in Level 3's "Illustrations" section (`node scripts/prepare-landmarks.mjs`, which left the eleven existing copies byte-identical; `illustration: "<key>"` in `countries.ts`; the import into `LANDMARK_IMAGES`; the expectations in `content.test.ts` and `e2e/level4.spec.ts`). Until then their cards used the text-only layout (`data-art="none"`), which remains for any landmark without artwork. Italy keeps the Colosseum. Find never shows artwork.

Trimmed, they are 0.96–1.20:1 (Ostrog Monastery 690×720, the others 720×598 to 720×694), well below 2:1, so each uses the square tile beside the country's name on phones, like the other ordinary art. The briefs asked for wide compositions (and Ostrog for a tall or square one); the supplied art is nearly square instead, which suits the square tile. At 320×568 and 390×844 in both languages, and on desktop, the country's name (Bosnia and Herzegovina's included), its capital and the whole artwork show together above the pinned button without scrolling, uncropped and undistorted, and the card opens at its top (`e2e/level4.spec.ts`, "Level 4's landmark illustrations"). At 200% text on a 320×568 phone, choosing each country on the map opens its card at the top, the panel keeps its room to read (the map gives it height at enlarged text: `.mapArea` and `.panel` in `LessonScreen.module.css`), and the whole card, art included, is reached by scrolling.

**Names too long to sit beside the art (every level).** Beside the square tile, a country name's longest word sometimes does not fit the column left for it (134 px at 320 px wide). At the default text size this happens only in Armenian at 320 px: «Հերցեգովինա» (13 px too wide) and «Չեռնոգորիա» (0.6 px), as with Level 1's «Նիդեռլանդներ» (24 px) and «Լյուքսեմբուրգ» (14 px); at 390 px every name fits. With enlarged text it is common in both languages (17 of the 30 illustrated cards at 150% at 320 px, 25 at 200%), because the tile keeps its size while the name grows. Such a card puts the name across its full width instead, with the capital beside the art beneath it; if the capital doesn't fit beside the art either, it too goes across, with the art below (`useCardHeadLayout` in `DiscoverPanel.tsx`, measured from the loaded font and the card's width before the card is painted, and again after a resize, a change of text size or language, or fonts loading). Cards whose name fits keep the side-by-side layout, and desktop is unchanged. On short phones such a card has slightly tighter spacing (and 3 px instead of 6 px of tile around the art, which keeps its size), so at 320×568 the name, capital and whole art still sit above the pinned button. A word now breaks inside only if it is wider than the whole card.

Alt text follows the existing pattern, with the in-sentence name: "Illustration of Bled Castle" / «Նկարազարդում՝ Բլեդի ամրոցը», "Illustration of the city walls of Dubrovnik" / «Նկարազարդում՝ Դուբրովնիկի պարիսպները», "Illustration of Stari Most" / «Նկարազարդում՝ Մոստարի կամուրջը», "Illustration of Ostrog Monastery" / «Նկարազարդում՝ Օստրոգի վանքը».

The briefs they were requested with:

| Landmark | Save the original to | Key | Content |
|---|---|---|---|
| Bled Castle, Slovenia | `public/images/landmarks/bled-castle.png` | `bled-castle` | The medieval castle with red roofs and pale walls on top of a steep cliff, a strip of Lake Bled's turquoise water at the foot. Wide composition. |
| City Walls of Dubrovnik, Croatia | `public/images/landmarks/dubrovnik-city-walls.png` | `dubrovnik-city-walls` | A stretch of the massive pale stone walls with the round Minčeta Tower, terracotta roofs of the old town inside, and blue sea at the foot. Wide composition. |
| Stari Most, Mostar | `public/images/landmarks/stari-most.png` | `stari-most` | The single, high, pale stone arch over the green river, with a small stone tower at each end. Wide composition. |
| Ostrog Monastery, Montenegro | `public/images/landmarks/ostrog-monastery.png` | `ostrog-monastery` | The white monastery building set into a vertical grey cliff face, with a little green slope below. Tall or square composition. |

#### Generation prompts

Each starts with the shared style paragraph (Level 2's, above: clean dark navy outlines of even weight, soft cel shading, recognisable architecture, fully transparent background, no text or people), then describes its landmark. Check each result as for Level 2: transparent background, the landmark whole inside the frame, no text, people, frame or shadow on the background.

1. **`bled-castle.png`**
   > [style paragraph] Subject: Bled Castle in Slovenia, perched on the top of a steep grey limestone cliff above Lake Bled. A compact medieval castle with pale cream and white walls, a few towers and wings with red-brown tiled roofs, a stone terrace wall at the cliff's edge, and a few dark green pine trees on the slopes of the cliff. At the foot of the cliff, a narrow strip of calm turquoise lake water. Wide, landscape-shaped artwork within the square.

2. **`dubrovnik-city-walls.png`**
   > [style paragraph] Subject: the City Walls of Dubrovnik, Croatia. A stretch of massive, thick pale limestone walls with crenellations curving around the old town, with the tall round Minčeta Tower on the left and a smaller square fort on the right; inside the walls, a dense cluster of houses with terracotta-red tiled roofs and a single bell tower. At the foot of the walls, a narrow strip of deep blue Adriatic sea with a few soft ripples. Wide, landscape-shaped artwork within the square.

3. **`stari-most.png`**
   > [style paragraph] Subject: Stari Most (the Old Bridge) in Mostar, Bosnia and Herzegovina. A single slender, very high semicircular arch of pale grey-white limestone spanning a gorge, with a small square stone tower with a low tiled roof at each end and pale stone riverbanks. Under the arch, a narrow strip of the emerald-green Neretva river. Wide, landscape-shaped artwork within the square.

4. **`ostrog-monastery.png`**
   > [style paragraph] Subject: Ostrog Monastery in Montenegro. A gleaming white monastery building with small arched windows and a few red-tiled roof edges, built into the face of a tall, almost vertical light-grey rock cliff, so the cliff rises above and around it. Below it, a short green slope with a few small trees. Tall or square artwork within the frame.

## Level 5: Towards Greece

Hungary, Romania, Serbia, Bulgaria and Greece are all new. Their content was checked on 2026-10-02. Level 5 keeps the stable id its card had while it was coming soon (`towards-greece`), and its title, description and country order.

### Capitals and landmarks

| Country | Capital | Capital (lat, lon) | Landmark | Landmark (lat, lon) | Fact (English) | Sources |
|---|---|---|---|---|---|---|
| Hungary (Հունգարիա) | Budapest (Բուդապեշտ) | 47.4925, 19.0514 | Esztergom Basilica, Esztergom (Էստերգոմի բազիլիկ) | 47.7989, 18.7364 | Completed in 1869, Hungary's largest church rises 100 metres from its crypt to the top of its dome. | [Visit Esztergom (the town's official tourism site): Basilica of Esztergom](https://visitesztergom.hu/en/sights/basilica-of-esztergom/) ("In terms of dimensions, the Esztergom Basilica is the largest church building in Hungary"; "it is 100 meters high from the lower church to the sphere of the dome"; built 1822–1869, "The capstone was finally laid on November 1, 1869"); [Wikipedia: Esztergom Basilica](https://en.wikipedia.org/wiki/Esztergom_Basilica) (47.79889 N, 18.73639 E); [Wikipedia: Budapest](https://en.wikipedia.org/wiki/Budapest) (47.4925 N, 19.05139 E) |
| Romania (Ռումինիա) | Bucharest (Բուխարեստ) | 44.4325, 26.1039 | Bran Castle, near Brașov (Բրանի դղյակ) | 45.5150, 25.3672 | Begun in 1377 on a rock above a mountain pass, it guarded the road into Transylvania. | [Bran Castle (official): Bran Fortress](https://www.bran-castle.com/en/fortareata-bran/) (19 November 1377: Louis I of Anjou's privilege to the people of Brașov to build "a new fortress on Dietrich's rock"; its purpose "to intercept the road leading to Transylvania, including the pass"); [Wikipedia: Bran Castle](https://en.wikipedia.org/wiki/Bran_Castle) (completed 1388; 45.515 N, 25.36722 E); [Wikipedia: Bucharest](https://en.wikipedia.org/wiki/Bucharest) (44.4325 N, 26.10389 E) |
| Serbia (Սերբիա) | Belgrade (Բելգրադ) | 44.8178, 20.4569 | Golubac Fortress (Գոլուբաց ամրոց) | 44.6612, 21.6785 | First mentioned in 1335, it guards the Danube where the river enters the Iron Gates gorge. | [Golubac Fortress (official): history](https://tvrdjavagolubackigrad.rs/eng/history/) ("mentioned for the first time in 1335"; "built at the entrance of the Iron Gate gorge, a place where the Danube's widest stream flows into a pass of the Carpathian Mountains"); [Wikipedia: Golubac Fortress](https://en.wikipedia.org/wiki/Golubac_Fortress) (ten towers; 44.66119 N, 21.67848 E); [Wikipedia: Belgrade](https://en.wikipedia.org/wiki/Belgrade) (44.81778 N, 20.45694 E) |
| Bulgaria (Բուլղարիա) | Sofia (Սոֆիա) | 42.6975, 23.3242 | Rila Monastery (Ռիլայի վանք) | 42.1333, 23.3403 | Founded in the 10th century by the hermit John of Rila; after a fire it was rebuilt in 1834–1862. | [UNESCO World Heritage Centre: Rila Monastery](https://whc.unesco.org/en/list/216) ("founded in the 10th century by St John of Rila, a hermit canonized by the Orthodox Church"; "Destroyed by fire at the beginning of the 19th century, the complex was rebuilt between 1834 and 1862"; inscribed 1983); [Wikipedia: Rila Monastery](https://en.wikipedia.org/wiki/Rila_Monastery) (42.13333 N, 23.34028 E); Sofia: GeoNames 727011 (42.69751 N, 23.32415 E; the Wikipedia article gives only 42.7 N, 23.33 E) |
| Greece (Հունաստան) | Athens (Աթենք) | 37.9842, 23.7281 | Meteora (Մետեորա) | 39.7239, 21.6244 (the Monastery of Great Meteoron) | Monks settled on these sandstone pillars from the 11th century; 24 monasteries were built on them. | [UNESCO World Heritage Centre: Meteora](https://whc.unesco.org/en/list/455) ("In a region of almost inaccessible sandstone peaks, monks settled on these 'columns of the sky' from the 11th century onwards. Twenty-four of these monasteries were built…"; inscribed 1988); [Wikipedia: Monastery of Great Meteoron](https://en.wikipedia.org/wiki/Monastery_of_Great_Meteoron) (39.72389 N, 21.62444 E); [Wikipedia: Athens](https://en.wikipedia.org/wiki/Athens) (37.98417 N, 23.72806 E) |

Notes:

- **No landmark is in its capital.** Esztergom is 41 km north-west of Budapest; Bran is in the Carpathians near Brașov, 134 km north-west of Bucharest; Golubac is on the Danube 98 km east of Belgrade; Rila Monastery is in the Rila Mountains 63 km south of Sofia; Meteora is in Thessaly, 266 km north-west of Athens (straight-line distances). Each pin is the monument's own coordinate, separate from the capital marker, and each lies inside its country in the map data (`src/geo/regionMap.test.ts`): Esztergom Basilica 1.9 km and Golubac Fortress 2.8 km from the nearest vertex of the Danube border, the others far from any edge.
- **Esztergom Basilica**: "100 metres from its crypt to the top of its dome" is the official site's "from the lower church to the sphere of the dome". It was consecrated in 1856 and finished in 1869; the fact uses the completion.
- **Bran Castle**: begun after the privilege of 1377 and finished in 1388 (Wikipedia; the official page quotes the 1377 document). Its popular name "Dracula's Castle" is left out: the link with Bram Stoker's novel is a tourism tradition, not history, and the fact keeps to what the castle was built for.
- **Golubac Fortress**: the official site's history page says it was first mentioned in 1335, as a fortification with a Hungarian garrison; who built it first is uncertain, so the fact says "first mentioned", not "built". Its ten towers are left out of the fact (from Wikipedia, not the official page) but described in the artwork brief.
- **Rila Monastery**: today's buildings date from the rebuilding after the fire (1834–1862, UNESCO); the fact says so, so "founded in the 10th century" isn't read as the age of what stands.
- **Meteora** is a group of monasteries, not one building. Like Ostrog Monastery's upper monastery, its pin is one monument: the Great Meteoron, the largest, on its own rock. The fact counts the 24 monasteries built (UNESCO), not those still in use (six).
- **Sofia's coordinate** is GeoNames', because the Wikipedia article's is rounded to 0.01°; it is the city centre (by the St Nedelya church), 0.5 km from the Wikipedia value.
- UNESCO's pages refused automated requests (as for Level 4), so their wording was confirmed from their search listings; Bran Castle's official page was confirmed the same way.

### Names in Armenian

Country and capital names are the titles of their Armenian Wikipedia articles (checked 2026-10-02 through the MediaWiki API, `prop=langlinks`): Հունգարիա, Ռումինիա, Սերբիա, Բուլղարիա, Հունաստան; Բուդապեշտ, Բուխարեստ, Բելգրադ, Սոֆիա, Աթենք. The country names are unchanged from the level card (`src/core/content/names.ts` held them while the level was coming soon). The in-sentence forms add the definite article: Հունգարիան, Ռումինիան, Սերբիան, Բուլղարիան, Հունաստանը.

| English | Eastern Armenian | Status |
|---|---|---|
| Esztergom Basilica | Էստերգոմի բազիլիկ | **Our rendering**: no Armenian article. «Էստերգոմ» is the town's article title. |
| Bran Castle | Բրանի դղյակ | The Armenian article's title. |
| Golubac Fortress | Գոլուբաց ամրոց | The Armenian article's title. |
| Rila Monastery | Ռիլայի վանք | **Our rendering**, shortened: the article's title is «Ռիլայի վանական համալիր» ("Rila monastic complex"). «Ռիլայի վանք» matches the English, the Bulgarian «Рилски манастир» and Level 4's «Օստրոգի վանք». |
| Meteora | Մետեորա | The Armenian article's title; in a sentence «Մետեորան». |
| South-eastern Europe (the region's name) | Հարավարևելյան Եվրոպա | The Armenian article's title. |
| Danube, Iron Gates, Transylvania, Carpathians, Black Sea (facts and hints) | Դանուբ, Երկաթե դարպասներ, Տրանսիլվանիա, Կարպատներ, Սև ծով | Article titles. |
| John of Rila | Հովհաննես Ռիլայեցի | From the «Ռիլայի վանական համալիր» article («Հովհաննես Ռիլայեցու»); no article of his own. |

Flagged for a native speaker's check (not presented as established usage):

- **Էստերգոմի բազիլիկ** and **Ռիլայի վանք** (above).
- **Esztergom's fact**: «Ստորին եկեղեցուց մինչև գմբեթի գագաթը» ("from the lower church to the top of the dome") follows the official wording; "crypt" could also be «դամբարանադաշտ» or «ստորգետնյա եկեղեցի».
- **Golubac's fact**: «Երկաթե դարպասների կիրճը» ("the gorge of the Iron Gates"); the article «Երկաթե դարպասներ» names the gorge itself.
- **Meteora's fact**: «ավազաքարե ժայռասյուներ» for "sandstone pillars" is our wording.
- **Romania's hint**: «Կարպատների աղեղով» ("with the arc of the Carpathians").
- **Greece's hint**: «բազմաթիվ կղզիներով լեռնային թերակղզի» ("a mountainous peninsula with many islands").
- **The completion message** (all five levels done): «Ավարտել ես բոլոր 5 մակարդակները։ Կարող ես ցանկացածը նորից խաղալ։»
- **Travel's status line, shortened in every level** (`travel.current` and `travel.moved` in `messages.hy.ts`): «Դու հիմա այստեղ ես՝ {name}։» became «Դու այստեղ ես՝ {name}։» (as the map's traveller pin says, «Դու այստեղ ես»), and «Անցար սահմանը։ Այժմ՝ {name}։» became «Մտար {name}։» ("You entered …", the English is "You crossed into …"). With Level 5's longer names (Հունգարիա, Բուլղարիա) the old lines took two lines on a 320 px phone and, with the route's chips «Հունգարիա →» «Հունաստան» on two rows, pushed the first neighbour card 13 px below a 320×568 screen. Shorter wording keeps the text size and the layout; for Levels 1–4 it only shortens the line, and their own first-row test (`e2e/phone-layout.spec.ts`) was rerun.

The Armenian facts and hints are our translations of the English ones.

### Descriptions and Find hints

As in Levels 3 and 4, a country's description is its hint, shown in Discover and repeated by Find's second hint; Find's first hint names the capital and the landmark. Each is the country's own (none of these countries appears in another level):

| Country | Hint (English) |
|---|---|
| Hungary | A country with no coast in the north-west of this region, on wide plains crossed by the Danube. |
| Romania | The largest country in this region, with the arc of the Carpathians and a coast on the Black Sea. |
| Serbia | A country with no coast in the west of this region, just south of Hungary. |
| Bulgaria | A country on the Black Sea, between the Danube in the north and Greece in the south. |
| Greece | The southernmost country of this region: a mountainous peninsula with many islands. |

"Largest" is by area (Romania 238,000 km², Greece 132,000, Bulgaria 111,000, Hungary 93,000, Serbia 77,000 without Kosovo; CIA World Factbook). Serbia's hint doesn't mention Kosovo (see DATA.md, "Level 5", for the boundary treatment).

### Illustrations

Esztergom Basilica, Bran Castle, Golubac Fortress, Rila Monastery and Meteora were supplied on 2026-10-02 and integrated with the four steps in Level 3's "Illustrations" section (`node scripts/prepare-landmarks.mjs`, which left the fifteen existing copies byte-identical; `illustration: "<key>"` in `countries.ts`; the import into `LANDMARK_IMAGES`; the expectations in `content.test.ts` and `e2e/level5.spec.ts`). Until then their cards used the text-only layout (`data-art="none"`), which remains for any landmark without artwork. Find never shows artwork, not even after a hint names the landmark.

Trimmed, they are 0.90–1.24:1 (Meteora 648×720, Esztergom Basilica 720×720, Bran Castle 720×718, Golubac Fortress 720×612, Rila Monastery 720×580), well below 2:1, so each uses the square tile beside the country's name on phones, like Level 4's. The briefs asked for wide compositions for the basilica, Golubac and Rila; the supplied art is nearly square instead, which suits the square tile. At 320×568 and 390×844 (Chromium) and 320×568 and 390×664 (WebKit) in both languages, and on desktop, the country's name, its capital and the whole artwork show together above the pinned button without scrolling, uncropped and undistorted, no word of the name or capital broken that would fit across the card, and the card opens at its top (`e2e/level5.spec.ts`, "Level 5 at phone and desktop sizes"). At 150% and 200% text the text keeps its size, the art keeps its size and shape in its tile, and every part of the card is reached by scrolling; at 200% on a 320×568 phone, choosing each country on the map after the previous card was scrolled to its end opens the new card at its top, with room to read.

**Meteora at phone size.** It is the tallest of the five (0.90:1), so it is drawn 90×100 px at 320 px wide, 105×117 px at 390 px and 126×140 px on desktop; the monastery on the rock's top is about half the art's width and a fifth of its height (about 45×20 px on the smallest phone). On a 3× screen (WebKit's iPhone 12 emulation) its red roofs, dome, walls and the stair up the rock read clearly; on a 1× screen they are small but still read as buildings on the rock. It was not cropped: the rock is the subject as much as the monastery.

Alt text follows the existing pattern, with the in-sentence name: "Illustration of Esztergom Basilica" / «Նկարազարդում՝ Էստերգոմի բազիլիկը», "Illustration of Bran Castle" / «Նկարազարդում՝ Բրանի դղյակը», "Illustration of Golubac Fortress" / «Նկարազարդում՝ Գոլուբաց ամրոցը», "Illustration of Rila Monastery" / «Նկարազարդում՝ Ռիլայի վանքը», "Illustration of Meteora" / «Նկարազարդում՝ Մետեորան».

The briefs they were requested with:

| Landmark | Save the original to | Key | Content |
|---|---|---|---|
| Esztergom Basilica, Hungary | `public/images/landmarks/esztergom-basilica.png` | `esztergom-basilica` | The great domed neoclassical cathedral on its hill above the Danube: a tall green-copper dome on a colonnaded drum, a columned portico and two bell towers. Wide composition. |
| Bran Castle, Romania | `public/images/landmarks/bran-castle.png` | `bran-castle` | The white castle with steep red roofs and towers of different heights, on a rocky outcrop with fir trees. Tall or square composition. |
| Golubac Fortress, Serbia | `public/images/landmarks/golubac-fortress.png` | `golubac-fortress` | The stone fortress whose towers and walls climb a steep hill from the wide Danube. Wide composition. |
| Rila Monastery, Bulgaria | `public/images/landmarks/rila-monastery.png` | `rila-monastery` | The domed church with red-and-white striped arcades, the stone tower behind it, and the monastery's wooden-balconied wings, with forested mountains suggested behind. Wide composition. |
| Meteora, Greece | `public/images/landmarks/meteora.png` | `meteora` | A monastery with red-tiled roofs on the flat top of a towering sandstone rock pillar. Tall or square composition. |

#### Generation prompts

Each starts with the shared style paragraph (Level 2's, above: clean dark navy outlines of even weight, soft cel shading, warm bright colours, recognisable architecture, the landmark alone on a fully transparent background, no sky, cast shadow, frame, text, letters, signs, watermark or people, the whole landmark inside the square with a small margin, 1254×1254 px), then describes its landmark. Check each result as for Level 2: transparent background, the landmark whole inside the frame, no text, people, frame or shadow on the background. Save it under the filename in the table above.

1. **`esztergom-basilica.png`**
   > [style paragraph] Subject: Esztergom Basilica in Hungary, the country's largest church, standing on a green hill above the Danube. A massive neoclassical cathedral in pale cream and light grey stone. At its centre, a very tall dome with a weathered green-copper roof, raised on a high round drum ringed by columns, topped by a small lantern. In front, a broad portico of tall columns under a triangular pediment, flanked by two square bell towers with green-copper caps. Below, a short green slope with a stone terrace wall and a narrow strip of calm blue river water. Wide, landscape-shaped artwork within the square.

2. **`bran-castle.png`**
   > [style paragraph] Subject: Bran Castle in Romania, perched on a steep grey rocky outcrop. A compact medieval castle with whitewashed walls and dark timber details, steep red-brown tiled roofs, and several towers of different heights and shapes (one round, others square) with small windows. A few dark green fir trees at the foot of the rock and a little green ground at the base. Tall or square artwork within the frame.

3. **`golubac-fortress.png`**
   > [style paragraph] Subject: Golubac Fortress in Serbia, on the bank of the Danube at the entrance to the Iron Gates gorge. A medieval fortress of rough grey-beige stone: tall square towers joined by thick crenellated walls that climb a steep green hillside, with the highest tower at the top, its upper part rounded under a small pointed cap. At the foot, the lowest walls and towers stand at the edge of a strip of wide blue-green river water with a few soft ripples. Wide, landscape-shaped artwork within the square.

4. **`rila-monastery.png`**
   > [style paragraph] Subject: Rila Monastery in Bulgaria's Rila Mountains. In the centre, the Church of the Nativity: an Orthodox church with five small domes covered in dark grey lead, its long open galleries of arches painted in bold red, white and black stripes. Behind it, a tall square medieval stone tower with a small roof. Around and behind them, the monastery's multi-storey residential wings of white walls with dark wooden balconies and arcades. A suggestion of forested green mountain slopes behind, and a little paved courtyard at the base. Wide, landscape-shaped artwork within the square.

5. **`meteora.png`**
   > [style paragraph] Subject: a Meteora monastery in Greece. A towering, smooth, rounded pillar of grey and honey-beige sandstone with vertical streaks, and on its flat top a monastery: cream and ochre stone walls, small windows, red-tiled roofs and a small dome, built right to the cliff's edge. A second, lower rock pillar beside it, and a little green ground with a few dark cypress trees at the base. Tall or square artwork within the frame.

## Level 6: Baltic Journey

### Second version (since 2026-10-06)

Since 2026-10-06 Level 6 is Poland, Belarus, Lithuania, Latvia and Estonia (`balticJourneyLesson` in `src/core/lessons/baltic-journey.ts`, revision 2), with the journey Poland → Estonia by two shortest routes (through Lithuania or Belarus; docs/DATA.md, "Level 6"). Attempts started before keep the first version (Germany in place of Belarus, Germany → Estonia), whose content is described in the rest of this section; see the README, "Saved progress". The level's id, title and unlock are unchanged.

No country content is new. Belarus is shared with Level 8: its names, capital (Minsk), landmark (Mir Castle), fact and artwork are unchanged (see "Level 8: Eastern Europe"). Poland's, Lithuania's, Latvia's and Estonia's are the first version's. Every card is illustrated: Poland's Wawel Castle and Belarus's Mir Castle are shared with earlier levels, and the Baltic three keep their own.

| Text | English | Armenian |
|---|---|---|
| The level's description (its card) | From Warsaw north to Tallinn, by one of two different ways. | Վարշավայից դեպի հյուսիս՝ մինչև Տալլին, երկու տարբեր ճանապարհներից մեկով։ |
| The map's region name ("Map of …") | the Baltic states and their neighbours | Բալթյան երկրներ և նրանց հարևաններ |

The first version's description ("From Berlin along the Baltic Sea to Tallinn, through Poland, Lithuania and Latvia.") and region name ("the Baltic Sea countries") are kept for its attempts: the level's card shows the version an attempt is on, its countries and description (`LevelInfo.earlier` in `src/core/lessons/levels.ts`).

**Descriptions and Find hints (second version).** Poland's usual hint (Level 3's "in the north-east of this region") and Level 8's for Belarus ("in the north of this region") would be wrong here, where Poland is the largest country (312,685 km² against Belarus's 207,600) and lies in the south-west, and Belarus lies in the south-east. So Level 6 has its own for both; Lithuania's, Latvia's and Estonia's own hints are true here.

| Country | Hint (English) |
|---|---|
| Poland | The largest country of this region, in its south-west, with a coast on the Baltic Sea. (Level 6's own) |
| Belarus | A flat country with no coast in the south-east of this region, with many forests, lakes and marshes. (Level 6's own) |
| Lithuania | A country with a short coast on the Baltic Sea, between Poland and Latvia. |
| Latvia | A country on the Baltic Sea between Lithuania and Estonia, around the Gulf of Riga. |
| Estonia | The northernmost country of this region, on the Gulf of Finland, with many islands. |

Each is distinct within the level: only Belarus has no coast, Poland is the largest, Estonia the northernmost, and Lithuania's coast is the short one. Lithuania also borders Belarus here, but "between Poland and Latvia" stays true. Belarus's border lengths (CIA World Factbook, final edition, factbook.json mirror): Latvia 161 km, Lithuania 640 km, Poland 375 km.

Flagged for a native speaker's check (our renderings, not presented as established usage):

- **The description**: «Վարշավայից դեպի հյուսիս՝ մինչև Տալլին, երկու տարբեր ճանապարհներից մեկով։» ("from Warsaw north to Tallinn, by one of two different ways").
- **The region name**: «Բալթյան երկրներ և նրանց հարևաններ». «Բալթյան երկրներ» is the Armenian article's title for the Baltic states; «և նրանց հարևաններ» ("and their neighbours") is ours, for Poland and Belarus.
- **The new hints**: Poland's «Տարածաշրջանի ամենամեծ երկիրը՝ նրա հարավ-արևմուտքում, Բալթիկ ծովի ափով։» and Belarus's «Հարթ երկիր առանց ծովի՝ տարածաշրջանի հարավ-արևելքում, բազմաթիվ անտառներով, լճերով և ճահիճներով։» (Level 8's wording, with this level's direction).

### First version (until 2026-10-06)

Germany and Poland are shared with earlier levels: their names, capitals, landmarks, facts and artwork are unchanged. Only their descriptions are Level 6's own (below). Lithuania, Latvia and Estonia are new. Their content was checked on 2026-10-02. The level's stable id is `baltic-journey`.

### Capitals and landmarks

| Country | Capital | Capital (lat, lon) | Landmark | Landmark (lat, lon) | Fact (English) | Sources |
|---|---|---|---|---|---|---|
| Lithuania (Լիտվա) | Vilnius (Վիլնյուս) | 54.6872, 25.2800 | Trakai Island Castle, Trakai (Տրակայի կղզու դղյակ) | 54.6525, 24.9331 | Built in the 14th–15th centuries on an island in Lake Galvė, it was home to Lithuania's Grand Dukes. | [Trakai tourism information centre: Trakai Island Castle](https://www.trakai-visit.lt/en/traku-salos-pilis/) ("The Castle was built in the 14th and 15th centuries on one of many islands of Lake Galvė"; "served as a royal residence for the Grand Dukes of Lithuania"); [Trakai History Museum: Island Castle](https://trakaimuziejus.lt/en/apie-mus/salos_pilis/) ("construction of the Island Castle began in the second half of the 14th century on one of the larger islands in Lake Galvė"; "completed in the first half of the 15th century"; "became the residence of the Grand Duke of Lithuania"); [Wikipedia: Trakai Island Castle](https://en.wikipedia.org/wiki/Trakai_Island_Castle) (54.6525 N, 24.93306 E); [Wikipedia: Vilnius](https://en.wikipedia.org/wiki/Vilnius) (54.68722 N, 25.28 E) |
| Latvia (Լատվիա) | Riga (Ռիգա) | 56.9489, 24.1064 | House of the Black Heads, Riga (Սևագլուխների տուն) | 56.9472, 24.1069 | Named after a brotherhood of merchants, it was destroyed in the Second World War and rebuilt in 1999. | [House of the Black Heads (official): History](https://www.melngalvjunams.lv/en/exposition/history) ("the jovial and enterprising foreigners, comprised of mostly German merchants, who were known as the Brotherhood of Black Heads, became the sole residents of the building"; in the Second World War "the building burned down and was later blown up"; "The reconstructed House of the Black Heads was consecrated on December 9, 1999"); [Latvia Travel (the national tourism site): House of the Black Heads](https://www.latvia.travel/en/sight/house-black-heads) ("destroyed by bombs in the Second World War but was fully rebuilt in 1999"); [Wikipedia: House of the Blackheads (Riga)](https://en.wikipedia.org/wiki/House_of_the_Blackheads_(Riga)) (56.94722 N, 24.10694 E); [Wikipedia: Riga](https://en.wikipedia.org/wiki/Riga) (56.94889 N, 24.10639 E) |
| Estonia (Էստոնիա) | Tallinn (Տալլին) | 59.4370, 24.7535 | Tallinn Town Hall (Տալլինի ռատուշա) | 59.4371, 24.7455 | Built in its present form in 1402–1404, it is the only surviving Gothic town hall in Northern Europe. | [Tallinn Town Hall (official): The building](https://raekoda.tallinn.ee/en/the-building/) ("Tallinn Town Hall is the only surviving Gothic town hall in Northern Europe"; "The building history of the Town Hall goes back to the II half of 13th century, but it acquired its medieval appearance in 1402–04"); [Wikipedia: Tallinn Town Hall](https://en.wikipedia.org/wiki/Tallinn_Town_Hall) (59.43709 N, 24.74547 E); Tallinn: GeoNames 588409 (59.43696 N, 24.75353 E) |

Notes:

- **Capital and landmark coordinates are separate, as in every level.** Trakai is 22.6 km west of Vilnius. The House of the Black Heads is on Riga's Town Hall Square, 0.19 km from Riga's coordinate, and Tallinn Town Hall is on Tallinn's, 0.46 km from Tallinn's: both are their old towns' centres. Each keeps its own coordinate, but **the existing rule for nearby markers applies**: a landmark within 16 px of its capital on screen is not drawn, so at every zoom the game allows, these two pins are left out and the capital marker stands for the old town (at the deepest zoom, 8× the whole-map view, 0.2–0.5 km is still under 4 px). The card names the landmark as usual. Trakai's pin is drawn wherever it is at least 16 px from Vilnius: on a 1920 px desktop at the whole-map view, and on phones and a 1366 px desktop once zoomed in (about 14 px apart at the whole-map view there), as for Brandenburg Gate beside Berlin.
- **Tallinn's coordinate is GeoNames'**, the city's reference point, east of the old town near Viru Square: the Wikipedia article's (59.43722 N, 24.74528 E) is the Town Hall itself, 20 m from the landmark, which would make the capital and the landmark one point. Vilnius and Riga use their Wikipedia article coordinates (GeoNames' are 0.2 km and 0.3 km away).
- **Trakai Island Castle**: "home to Lithuania's Grand Dukes" is the official sites' "residence of the Grand Duke(s) of Lithuania". Its restoration (begun in the 1950s, the palace rebuilt by 1962; sources give 1951, 1953 or 1960 for the start) is left out, as is "never taken by enemies" (the museum's wording; Wikipedia describes heavy damage in 1377). The castle is on Lithuania's UNESCO tentative list (2003), not inscribed; the fact doesn't mention UNESCO.
- **House of the Black Heads**: the official history says it "was built in 1334"; Wikipedia says it was first mentioned in 1334, as the New House of the Great Guild. The fact leaves the year out and names what explains the name: the Brotherhood of Black Heads, "mostly German merchants" (official). Wikipedia's dates for its destruction (bombed 29 June 1941, ruins demolished 1948) are not on the official site, so the fact says "in the Second World War"; it was rebuilt from 1996 and consecrated on 9 December 1999 (official; Wikipedia gives 1996–2000), so the fact says 1999. "Unmarried" merchants (Wikipedia, Armenian Wikipedia) is not on the official site and is left out.
- **Tallinn Town Hall**: the town hall is first mentioned in 1322 and its history goes back to the 13th century; it "acquired its medieval appearance in 1402–04" (official), so the fact says "built in its present form", not "built". "The only surviving Gothic town hall in Northern Europe" is the official site's own claim, quoted as it stands; its home page calls it "the oldest surviving town hall in Northern Europe", which the fact doesn't use. The Old Thomas weathervane (1530; today's figure is a 1996 copy) is in the artwork brief, not the fact.
- **Ranges stay on one line**: the facts' "14th–15th", «14–15-րդ» and "1402–1404" carry a word joiner (U+2060) after the dash or hyphen, so a narrow card never breaks a range across lines (the Armenian Tallinn fact did, on desktop, without it).
- **Borders**: CIA World Factbook, final edition (January 2026). The Factbook was discontinued in February 2026 (cia.gov now says "The World Factbook, has sunset"), so its pages were read from the [factbook.json mirror](https://github.com/factbook/factbook.json) and checked against archived cia.gov pages: Germany–Poland 467 km (447 km in Germany's own entry, a discrepancy in the Factbook itself), Poland–Lithuania 100 km, Lithuania–Latvia 544 km, Latvia–Estonia 333 km, and no other land border among the five. Areas: Germany 357,022 km², Poland 312,685, Lithuania 65,300, Latvia 64,589, Estonia 45,228 (with "1,520 islands in the Baltic Sea").
- The automated requests to Riga's tourism site (liveriga.com) were refused, and Visit Tallinn's page keeps its text in scripts, so the official landmark sites above were used instead.

### Names in Armenian

Country and capital names are the titles of their Armenian Wikipedia articles (checked 2026-10-02 through the MediaWiki API, `prop=langlinks`, and against Wikidata): Լիտվա, Լատվիա, Էստոնիա; Վիլնյուս, Ռիգա, Տալլին (GeoNames gives the same Armenian names). The in-sentence forms add the definite article: Լիտվան, Լատվիան, Էստոնիան.

| English | Eastern Armenian | Status |
|---|---|---|
| Trakai Island Castle | Տրակայի կղզու դղյակ | **Our rendering**: no Armenian article. «Տրակայ» is the town's article title, and that article calls the castle a «դղյակ» (as for Bran Castle, «Բրանի դղյակ»). |
| House of the Black Heads | Սևագլուխների տուն | The Armenian article's title; in a sentence «Սևագլուխների տունը». |
| Tallinn Town Hall | Տալլինի ռատուշա | The Armenian article's title; in a sentence «Տալլինի ռատուշան». |
| Lake Galvė (fact) | Գալվե լիճ | **Our rendering**: no Armenian article; «Գալվե» appears only in the Տրակայ article. |
| Grand Dukes of Lithuania (fact) | Լիտվայի մեծ իշխաններ | From the articles «Լիտվայի մեծ իշխանություն» (Grand Duchy of Lithuania, lowercase մ) and Տրակայ («մեծ իշխանների … նստավայրը»). |
| Gulf of Finland, Gulf of Riga, Baltic Sea (hints) | Ֆիննական ծոց, Ռիգայի ծոց, Բալթիկ ծով | Article titles. |
| Baltic Journey (the level's title) | Բալթյան ճամփորդություն | **Our rendering.** |
| the Baltic Sea countries (the map's region name) | Բալթիկ ծովի երկրներ | **Our rendering**: the article «Բալթյան երկրներ» means the Baltic states (Lithuania, Latvia, Estonia) only, not Germany and Poland. |

Flagged for a native speaker's check (not presented as established usage):

- **Տրակայի կղզու դղյակ**, **Գալվե լիճ**, **Բալթյան ճամփորդություն** and **Բալթիկ ծովի երկրներ** (above).
- **The level's description**: «Բեռլինից Բալթիկ ծովի երկայնքով մինչև Տալլին՝ Լեհաստանով, Լիտվայով և Լատվիայով։» ("from Berlin along the Baltic Sea to Tallinn, through Poland, Lithuania and Latvia").
- **Trakai's fact**: «Գալվե լճի կղզիներից մեկի վրա» ("on one of the islands of Lake Galvė", as the tourism office says) and «եղել է … նստավայրը» for "was home to".
- **The House of the Black Heads' fact**: «Անվանվել է առևտրականների եղբայրության անունով» ("named after a brotherhood of merchants").
- **Tallinn Town Hall's fact**: «Ներկայիս տեսքը ստացել է 1402–1404 թվականներին» ("received its present appearance in 1402–1404"), close to the official wording, where the English says "built in its present form".
- **The new hints**: Lithuania's «Բալթիկ ծովի կարճ ափով» ("with a short Baltic Sea coast"); Latvia's «Ռիգայի ծոցի շուրջը» ("around the Gulf of Riga"); Estonia's «Ֆիննական ծոցի ափին, բազմաթիվ կղզիներով»; Germany's «Տարածաշրջանի հարավ-արևմտյան մասի» and Poland's «տարածաշրջանի հարավում՝ Գերմանիայից արևելք» for this level's own directions.
- **The completion message** (all six levels done) uses the existing wording with the new count: «Ավարտել ես բոլոր 6 մակարդակները։ Կարող ես ցանկացածը նորից խաղալ։»

The Armenian facts and hints are our translations of the English ones. No player-facing text uses "lesson" or «դաս» (`src/core/content/content.test.ts` checks).

### Descriptions and Find hints

As in Levels 3–5, a country's description is its hint, shown in Discover and repeated by Find's second hint; Find's first hint names the capital and the landmark. Germany's and Poland's usual hints would be wrong here (Germany is "in the east" of Level 1's region, Poland "in the north-east" of Level 3's), so Level 6 has its own for them (`hints` in `src/core/lessons/baltic-journey.ts`); the hints of Levels 1–5 are unchanged.

| Country | Hint (English) |
|---|---|
| Germany | The large country in the south-west of this region, reaching both the North Sea and the Baltic Sea. (Level 6's own) |
| Poland | A large, mostly flat country in the south of this region, east of Germany, with a coast on the Baltic Sea. (Level 6's own) |
| Lithuania | A country with a short coast on the Baltic Sea, between Poland and Latvia. |
| Latvia | A country on the Baltic Sea between Lithuania and Estonia, around the Gulf of Riga. |
| Estonia | The northernmost country of this region, on the Gulf of Finland, with many islands. |

Lithuania's coast is about 90 km, against Latvia's 500 km and Estonia's 3,800 km with its islands; "short" sets it apart from both. Lithuania also borders Russia's Kaliningrad and Belarus, which are outside the level; "between Poland and Latvia" describes it within the level's region.

### Illustrations

Trakai Island Castle, the House of the Black Heads and Tallinn Town Hall were supplied on 2026-10-03 as **AI-generated stylised illustrations** made from the briefs and prompts below (kept as the record of how they were made), and integrated with the four steps in Level 3's "Illustrations" section: `node scripts/prepare-landmarks.mjs` (which left the twenty existing display copies byte-identical, checked by SHA-256, and the originals unchanged); `illustration: "<key>"` on each landmark in `src/core/content/countries.ts`; the import into `LANDMARK_IMAGES` in `src/components/landmarks/LandmarkCard.tsx`; and the expectations in `src/core/content/content.test.ts` and `e2e/level6.spec.ts`. Germany's Brandenburg Gate and Poland's Wawel Castle keep their existing illustrations, so every Level 6 card is illustrated. Their alt text is the shared "Illustration of {landmark}" / «Նկարազարդում՝ {landmark}», with the landmark as named in a sentence: "Illustration of Trakai Island Castle", "Illustration of the House of the Black Heads", "Illustration of Tallinn Town Hall"; «Նկարազարդում՝ Տրակայի կղզու դղյակը», «Նկարազարդում՝ Սևագլուխների տունը», «Նկարազարդում՝ Տալլինի ռատուշան». The text-only layout (`data-art="none"`) remains for any landmark without artwork. Find never shows artwork, not even after a hint names the landmark. Facts, coordinates and gameplay are unchanged.

The three originals are 1254×1254 8-bit RGBA PNG (sRGB), 1.2–2.3 MB. Checked on arrival, by reading their alpha channels as for Levels 4 and 5:
- each shows its assigned landmark: Trakai's red-brick castle with its tall keep, conical-roofed towers and curtain walls on a green island, the wooden footbridge reaching it across blue water from a small islet; the House of the Black Heads' tall stepped and scrolled gable with its clock, statues in niches and gilded finials, beside the smaller gabled house, both façades whole; Tallinn Town Hall's pale limestone hall with its arcade of pointed arches, crenellated parapet and red-tiled roof (the brief asked for dark grey), and its slender tower with the green tiered spire, topped by **Old Thomas, a standing figure with a flag** (this is the corrected version, not the earlier one with a rooster). No text or people;
- transparent corners; no artwork pixel touches the frame (6–165 px of empty margin; the closest are Trakai's right and left sides, 6 and 8 px, both water, and the top of Tallinn's flag, 8 px, so the trimmed copies' 2% margin is cut short at the frame there, as for Levels 4 and 5, with no artwork lost);
- 39–65% of each image fully transparent (Tallinn the most: the spire is tall and narrow); a 1.0–2.4% fringe of faint pixels (alpha 1–32) and 0.4–1.0% of edge pixels (alpha 33–223) from background removal; the only colour in fully transparent pixels is near-black (every channel at most 10, 0.03–0.05% of pixels), which cannot show; the artwork itself at alpha 250–254 (0.01–0.04% at 255), like the approved originals.

Seen on black they show thin coloured fringes (yellow along Tallinn's tower and the Riga gables, red above Tallinn's roof, cyan and red along Trakai's water), left by background removal, like Level 2's and Level 4's; composited on the card's sky-to-mint tile, at full size and at phone size, they are not visible. The originals were not retouched.

Trimmed, they are 1.25:1 (Trakai Island Castle, 720×576, 490 KiB), 1.00:1 (House of the Black Heads, 720×717, 577 KiB) and 0.84:1 (Tallinn Town Hall, 607×720, 312 KiB), well below 2:1, so each uses the square tile beside the country's name on phones, like the other ordinary art. At 320×568 and 390×844 (Chromium), 320×568 and 390×664 (WebKit) in both languages, and on desktop, the country's name, its capital and the whole artwork show together above the pinned button without scrolling, uncropped and undistorted (Tallinn's spire, Trakai's bridge and both of Riga's façades whole), no word of the name or capital broken that would fit across the card, and the card opens at its top (`e2e/level6.spec.ts`, "Level 6 at phone and desktop sizes"). At 150% and 200% text the text keeps its size, the art keeps its size and shape in its tile, and every part of the card is reached by scrolling; at 200% on a 320×568 phone, choosing each of the three on the map after the previous card was scrolled to its end opens the new card at its top, with room to read.

**Tallinn at phone size.** Measured in the built app, the art is drawn 85×100 px on a 320×568 phone (84×100 in WebKit), 99×117 px at 390 px and 118×140 px on a 1366×800 desktop: the tile's height sets its size, so it is narrower than Trakai (100×80 px at 320 px) and Riga (100×99 px). The building reads clearly at 85×100 px: the tall tower and spire, the long red roof and the arcade. Old Thomas, with his flag, is about 5 px tall at that size, so he reads as the spire's finial rather than as a figure; he shows as a figure on desktop and when the card is larger. That is the nature of a tall, thin detail at this size, not a fault of the art; it was not cropped or redrawn.

The briefs they were made from:

| Landmark | Original | Key | Content |
|---|---|---|---|
| Trakai Island Castle, Lithuania | `public/images/landmarks/trakai-island-castle.png` | `trakai-island-castle` | The red-brick Gothic castle on its island in Lake Galvė: the tall square keep of the ducal palace, steep red-tiled roofs, round and square towers on the outer walls, and a wooden footbridge reaching it across calm blue water. Wide composition. |
| House of the Black Heads, Riga, Latvia | `public/images/landmarks/house-of-the-black-heads.png` | `house-of-the-black-heads` | The tall, richly decorated red-brick façade with white and gilded ornaments, a steep stepped and scrolled gable, statues in niches and a large clock, beside the smaller gabled house next to it. Tall or square composition. |
| Tallinn Town Hall, Estonia | `public/images/landmarks/tallinn-town-hall.png` | `tallinn-town-hall` | The grey limestone Gothic town hall with an arcade of pointed arches, a crenellated parapet and a steep roof, and its slender tower with a dark green tiered spire topped by the Old Thomas weathervane. Tall or square composition. |

#### Generation prompts

Each starts with the shared style paragraph (Level 2's, above: clean dark navy outlines of even weight, soft cel shading, warm bright colours, recognisable architecture, the landmark alone on a fully transparent background, no sky, cast shadow, frame, text, letters, signs, watermark or people, the whole landmark inside the square with a small margin, 1254×1254 px), then describes its landmark. Check each result as for Level 2: transparent background, the landmark whole inside the frame, no text (the clock face has no numerals that read as text), people, frame or shadow on the background. Save it under the filename in the table above.

1. **`trakai-island-castle.png`**
   > [style paragraph] Subject: Trakai Island Castle in Lithuania, a medieval red-brick castle standing on a small green island in a lake. In the centre, the ducal palace with a tall, square red-brick keep tower and steep red-tiled roofs, with small pointed Gothic windows and pale stone details. Around it, the outer curtain wall of red brick with round and square towers capped by red conical and pyramid roofs. In the foreground, a narrow wooden footbridge on posts leads to the castle gate across calm blue lake water with a few soft ripples and a hint of green reeds at the island's edge. Wide, landscape-shaped artwork within the square.

2. **`house-of-the-black-heads.png`**
   > [style paragraph] Subject: the House of the Black Heads in Riga, Latvia, seen from the front at a slight angle. A tall, narrow Northern Renaissance guild house in deep red brick, richly decorated with white and pale cream stone trim and touches of gold: a very tall, steep stepped and scrolled gable with ornamental finials and small spires, rows of tall windows, a large ornate clock in the upper façade, and a few small statues in niches between the windows. Beside it, attached on one side, a smaller, plainer house with its own pale stepped gable. A little grey cobbled square at the base. Tall or square artwork within the frame.

3. **`tallinn-town-hall.png`**
   > [style paragraph] Subject: Tallinn Town Hall in Estonia, a medieval Gothic town hall. A long two-storey building of pale grey limestone with a steep dark grey roof, a row of tall pointed Gothic windows on the upper floor, and an open arcade of pointed arches along the ground floor. A crenellated parapet runs along the top of the façade. At one end rises a slender octagonal tower with a tall, tiered dark green copper spire, topped by a small weathervane in the shape of a medieval warrior holding a flag (Old Thomas). A few small dragon-head waterspouts under the eaves. A little grey cobbled square at the base. Tall or square artwork within the frame.

## Level 7: Iberian Journey

France and Italy are shared with earlier levels: their names, capitals, landmarks, facts and artwork (the Eiffel Tower, the Colosseum) are unchanged. Only France's description is Level 7's own (below). Portugal, Spain and Andorra are new. Their content was checked on 2026-10-03. The level's stable id is `iberian-journey`.

### Capitals and landmarks

| Country | Capital | Capital (lat, lon) | Landmark | Landmark (lat, lon) | Fact (English) | Sources |
|---|---|---|---|---|---|---|
| Portugal (Պորտուգալիա) | Lisbon (Լիսաբոն) | 38.7253, −9.1500 | Belém Tower, Lisbon (Բելեմի աշտարակ) | 38.6917, −9.2161 | Built in 1514–1519 as a fortress on the Tagus, it defended the entrance to Lisbon's harbour. | [Museus e Monumentos de Portugal (the state agency that runs it): Torre de Belém](https://www.museusemonumentos.pt/pt/museus-e-monumentos/torre-de-belem) ("Edificada entre 1514 e 1519"; "a construção de uma fortaleza na margem norte do Tejo, para defender a barra"; on UNESCO's World Heritage List since 1983); [Wikipedia: Belém Tower](https://en.wikipedia.org/wiki/Bel%C3%A9m_Tower) (38.69167 N, 9.21611 W); [Wikipedia: Lisbon](https://en.wikipedia.org/wiki/Lisbon) (38.72528 N, 9.15 W); Lisbon: GeoNames 2267057 (38.72509 N, 9.14980 W) |
| Spain (Իսպանիա) | Madrid (Մադրիդ) | 40.4169, −3.7033 | Sagrada Família, Barcelona (Սագրադա Ֆամիլիա) | 41.4037, 2.1743 | Antoni Gaudí took over its design in 1883 and from 1914 worked on nothing else until his death in 1926. | [Basílica de la Sagrada Família (official): History of the Basílica](https://sagradafamilia.org/en/history-of-the-temple) (1883: "Antoni Gaudí takes over the project, while still working on other buildings"; 1914: "Antoni Gaudí begins working exclusively on the Temple, until his death"; 1926: "Gaudí dies"); [Wikipedia: Sagrada Família](https://en.wikipedia.org/wiki/Sagrada_Fam%C3%ADlia) (41.40369 N, 2.17433 E); [Wikipedia: Madrid](https://en.wikipedia.org/wiki/Madrid) (40.4169 N, 3.7033 W); Madrid: GeoNames 3117735 (40.4165 N, 3.7026 W) |
| Andorra (Անդորրա) | Andorra la Vella (Անդորրա լա Վելյա) | 42.5061, 1.5217 | Casa de la Vall, Andorra la Vella (Կասա դե լա Վալ) | 42.5067, 1.5206 | Built as a family manor house in the late 16th century, it housed Andorra's parliament from 1702 to 2011. | [Visit Andorra (the national tourism agency): Casa de la Vall](https://visitandorra.com/en/shopping/casa-de-la-vall/) ("built in the late 16th century as a manor house for the Busquets family"; "In 1702 … it was acquired by the Consell General, the Parliament of Andorra, and used as its headquarters until 2011"; "In 2011, the Consell General moved to a new building"); [Consell General (Andorra's parliament): exhibition "Casa de la Vall, domus concilii"](https://www.consellgeneral.ad/ca/noticies/inauguracio-exposicio-casa-de-la-vall-domus-concilii) ("El Consell General es muda a la Casa de la Vall l'any 1702"); [Wikipedia: Casa de la Vall](https://en.wikipedia.org/wiki/Casa_de_la_Vall) ("built in 1580 … by the Busquets family"; 42.50667 N, 1.52056 E); [Wikipedia: Andorra la Vella](https://en.wikipedia.org/wiki/Andorra_la_Vella) (42.50611 N, 1.52167 E); Andorra la Vella: GeoNames 3041563 (42.50779 N, 1.52109 E) |

Notes:

- **Capital and landmark coordinates are separate, and were checked separately**: each against its own Wikipedia article and, for the capitals, GeoNames (0.02–0.2 km apart). Belém Tower is 6 km west of Lisbon's coordinate; the Sagrada Família is in Barcelona, 505 km from Madrid; Casa de la Vall is in Andorra la Vella's old quarter, 0.1 km from the capital's coordinate. For Casa de la Vall **the existing rule for nearby markers applies**, as for Riga and Tallinn in Level 6: a landmark within 16 px of its capital on screen is not drawn, so its pin is left out at every zoom the game allows (0.1 km is under 1 px even at the deepest zoom) and the capital marker stands for the old quarter. The card names the landmark as usual.
- **Belém Tower stands at the river's edge**, just off the bank, where Natural Earth's 1:10m coastline is coarser than the monument: its coordinate lies 0.32 km off Portugal's land in the map data. It keeps its real coordinate; `src/geo/regionMap.test.ts` allows it up to 0.4 km from its country's land, as it allows Dubrovnik's City Walls 0.6 km (DATA.md, "Level 4" and "Level 7"). Every other capital and landmark lies inside its country.
- **Belém Tower**: "1514–1519" and "to defend the entrance" (the *barra*, the mouth of the Tagus that ships entered Lisbon's port by) are the official site's. "The entrance to Lisbon's harbour" renders *barra* for players; the UNESCO listing (1983, with the Jerónimos Monastery) and the architect (Francisco de Arruda) are left out.
- **Sagrada Família**: the fact is the official timeline's three dates, which are stable whatever happens to the building. "Still being built" (true today; the main tower was due in 2026) and its consecration as a basilica (2010) are left out because they will date. The fact names Gaudí but not "basilica", so it stays true whatever the church is called.
- **Casa de la Vall**: the official tourism site says "late 16th century"; the date 1580 on its façade is Wikipedia's ("built in 1580"), and Wikipedia also says "In 1702, it was acquired by the Consell de la Terra". The fact says "in the late 16th century" and "from 1702 to 2011", and "housed Andorra's parliament" (the Consell General). Its reopening after renovation (2025) is left out.
- **Ranges stay on one line**: "1514–1519" and the Armenian «1514–1519», «1702–2011» and «16-րդ» carry a word joiner (U+2060) after the dash or hyphen, as in Level 6.
- **Borders**: CIA World Factbook, final edition, read from the [factbook.json mirror](https://github.com/factbook/factbook.json) as for Level 6: Portugal–Spain 1,224 km, Spain–France 646 km, Spain–Andorra 63 km, France–Andorra 55 km, France–Italy 476 km, and no other land border among the five. Spain's other borders (Gibraltar 1.2 km, Morocco at Ceuta 8 km and Melilla 10.5 km) and France's and Italy's with countries outside the level are left out.

### Names in Armenian

Country and capital names are the titles of their Armenian Wikipedia articles (checked 2026-10-03 through the MediaWiki API, `prop=langlinks`): Պորտուգալիա, Իսպանիա, Անդորրա; Լիսաբոն, Մադրիդ, Անդորրա լա Վելյա. The in-sentence forms add the definite article: Պորտուգալիան, Իսպանիան, Անդորրան.

| English | Eastern Armenian | Status |
|---|---|---|
| Belém Tower | Բելեմի աշտարակ | **Our rendering.** The Armenian article's title is «Տորրի դի Բելեն», a transliteration of the Portuguese name; the game uses the translated form, like «Էյֆելյան աշտարակ», «Վավելի ամրոց» and «Տրակայի կղզու դղյակ», with the place name transliterated from its spelling (Բելեմ; the article's «Բելեն» follows the Portuguese pronunciation). In a sentence «Բելեմի աշտարակը». |
| Sagrada Família | Սագրադա Ֆամիլիա | The Armenian article's title; in a sentence «Սագրադա Ֆամիլիան». |
| Casa de la Vall | Կասա դե լա Վալ | **Our rendering**: no Armenian article; a transliteration of the Catalan name, as the article title does for Sagrada Família. In a sentence «Կասա դե լա Վալը». |
| Antoni Gaudí (fact) | Անտոնիո Գաուդի | The Armenian article's title (it uses the Spanish form of his first name); in the fact «Անտոնիո Գաուդին». |
| Tagus (fact) | Տախո | The Armenian article's title («Տախո (գետ)»), from the Spanish name Tajo. |
| Pyrenees, Iberian Peninsula (hints, title) | Պիրենեյներ, Պիրենեյան թերակղզի | Article titles. In Armenian the Iberian Peninsula is the Pyrenean Peninsula, so the level's title «Պիրենեյան ճամփորդություն» ("Pyrenean journey"), which was given, matches it. |
| South-western Europe (the map's region name) | Հարավարևմտյան Եվրոպա | Formed like Level 5's «Հարավարևելյան Եվրոպա». |

Flagged for a native speaker's check (not presented as established usage):

- **Բելեմի աշտարակ** (against the article's «Տորրի դի Բելեն») and **Կասա դե լա Վալ** (above).
- **Belém Tower's fact**: «Կառուցվել է 1514–1519 թվականներին Տախո գետի ափին՝ որպես Լիսաբոնի նավահանգստի մուտքը պաշտպանող ամրոց։» ("built … on the bank of the Tagus as a fortress defending the entrance to Lisbon's harbour"). «Տախո» is the Spanish name; Portuguese is Tejo.
- **The Sagrada Família's fact**: «ստանձնել է դրա նախագիծը» for "took over its design", and «աշխատել է միայն դրա վրա» for "worked on nothing else".
- **Casa de la Vall's fact**: «ընտանեկան կալվածատուն» for "family manor house", and «եղել է Անդորրայի խորհրդարանի նստավայրը» for "housed Andorra's parliament".
- **The new hints**: Portugal's «Տարածաշրջանի ամենաարևմտյան երկիրը», Spain's «զբաղեցնում է Պիրենեյան թերակղզու մեծ մասը», Andorra's «Պիրենեյան լեռներում» and France's «Պիրենեյներից հյուսիս ընկած մեծ երկիրը».
- **The level's description**: «Լիսաբոնից Իսպանիայով և Ֆրանսիայով մինչև Հռոմ՝ Պիրենեյներում գտնվող փոքրիկ Անդորրայի մոտով։» ("from Lisbon across Spain and France to Rome, past tiny Andorra in the Pyrenees").
- **The completion message** (all seven levels done) uses the existing wording with the new count: «Ավարտել ես բոլոր 7 մակարդակները։ Կարող ես ցանկացածը նորից խաղալ։»

The Armenian facts and hints are our translations of the English ones. No player-facing text uses "lesson" or «դաս» (`src/core/content/content.test.ts` checks).

### Descriptions and Find hints

As in Levels 3–6, a country's description is its hint, shown in Discover and repeated by Find's second hint; Find's first hint names the capital and the landmark. France's usual hint ("The largest country in this region, with coasts on the Atlantic and the Mediterranean") is true here (metropolitan France is about 551,000 km², Spain 506,000), but Spain has both coasts too and looks about the same size on the map, so the hint would not tell them apart; Level 7 has its own for France (`hints` in `src/core/lessons/iberian-journey.ts`). Italy's usual hint (the boot-shaped peninsula south of the Alps) fits here and is kept. The hints of Levels 1–6 are unchanged.

| Country | Hint (English) |
|---|---|
| Portugal | The westernmost country of this region, with a long coast on the Atlantic Ocean. |
| Spain | A large country covering most of the Iberian Peninsula, between Portugal and France. |
| Andorra | A tiny landlocked country high in the Pyrenees, between Spain and France. |
| France | The large country north of the Pyrenees, with coasts on the Atlantic and the Mediterranean. (Level 7's own) |
| Italy | A long, boot-shaped peninsula reaching into the Mediterranean Sea, south of the Alps. (shared) |

### Illustrations

Belém Tower, the Sagrada Família and Casa de la Vall were supplied on 2026-10-04 as **AI-generated stylised illustrations** made from the briefs and prompts below (kept as the record of how they were made; Belém Tower's is the corrected version, with room above its highest finial; Casa de la Vall's was replaced the same day by a revised version, below), and integrated with the four steps in Level 3's "Illustrations" section: `node scripts/prepare-landmarks.mjs` (which left the twenty-three existing display copies byte-identical and all twenty-six originals unchanged, both checked by SHA-256); `illustration: "<key>"` on each landmark in `src/core/content/countries.ts`; the import into `LANDMARK_IMAGES` in `src/components/landmarks/LandmarkCard.tsx`; and the expectations in `src/core/content/content.test.ts`, `e2e/level7.spec.ts` and `e2e/landscape.spec.ts`. Until then their cards used the text-only layout (`data-art="none"`), which remains for any landmark without artwork. France's Eiffel Tower and Italy's Colosseum keep their illustrations, so every Level 7 card is illustrated. Their alt text is the shared "Illustration of {landmark}" / «Նկարազարդում՝ {landmark}», with the landmark as named in a sentence: "Illustration of Belém Tower", "Illustration of the Sagrada Família", "Illustration of Casa de la Vall"; «Նկարազարդում՝ Բելեմի աշտարակը», «Նկարազարդում՝ Սագրադա Ֆամիլիան», «Նկարազարդում՝ Կասա դե լա Վալը». Find never shows artwork, not even after a hint names the landmark. Facts, coordinates, gameplay, map framing, labels and the landscape layout are unchanged.

The three originals are 1254×1254 8-bit RGBA PNG (sRGB), 1.9–2.4 MB. Checked on arrival, by reading their alpha channels as for Levels 4–6:
- each shows its assigned landmark (below, with what the drawing simplifies). No text, letters or people: the shields on Belém's merlons carry only crosses, the figures in the Sagrada Família's portals are carved statues, and Casa de la Vall's walls have no inscription or sign;
- transparent corners; no artwork pixel touches the frame (15–98 px of empty margin; the closest are the Sagrada Família's top finial, 15 px, and its base, 18 px, so the trimmed copy's 2% margin is cut short at the frame there, as for earlier levels, with no artwork lost; Belém Tower's highest finial has 50 px);
- 41–49% of each image fully transparent (Casa de la Vall the least: a broad building); a 1.1–2.4% fringe of faint pixels (alpha 1–32) and 0.39–0.69% of edge pixels (alpha 33–223) from background removal; the only colour in fully transparent pixels is near-black (every channel at most 15, 0.03–0.08% of pixels), which cannot show; the artwork itself at alpha 250–254 (0.02% at 255), like the approved originals.

Composited on the card's sky-to-mint tile, on dark navy and on magenta, at full size and at 2× zoom on the original pixels (Belém's turrets and water, the Sagrada Família's finials and base, Casa de la Vall's turret, eaves and paving), their edges are clean: no halo and no coloured fringe. The thin dark outline round each is the drawing's own, as the shared style asks. The originals were not retouched.

**What the drawings show and simplify.** These are stylised illustrations, compared with the briefs and with the landmarks' published descriptions, not with photographs or surveys; their architectural accuracy is not verified beyond that.
- **Belém Tower**: seen from the side, the square tower with its balconied windows and domed watchtowers at the corners of its terrace, the lower bastion running out in front of it (to the left) with domed corner turrets and merlons bearing shields with crosses, carved rope mouldings under the turrets, standing in a pool of river water. The bastion reads as a long block rather than as many-sided from this angle; armillary spheres are not distinguishable; the loggia of arches is not shown as such.
- **Sagrada Família**: intentionally the Nativity façade and its four bell towers, not the whole basilica (the brief asked for this view). The four pierced towers, the inner pair taller, with colourful finials; the green cypress over the central portal; three portals with sculpted figures. The lower Gothic-looking wings with pinnacles and rose windows either side are simplified; the towers' openings are drawn as straight rows.
- **Casa de la Vall**: **revised on 2026-10-04 using an official architectural photograph** of the building, replacing the first illustration from the prompt below (whose round turret rose above the roof in place of the brief's square tower). The revision is the first corrected version: the rubble-stone manor house under a gabled roof with deep wooden eaves, its arched doorway in the right-hand façade, shuttered and barred windows, and a corbelled turret projecting from the corner, on a little paved square with no background. It is still a stylised illustration, not an architectural record: details are simplified, the turret's roof among them, and the coats of arms at the door ([Wikipedia: Casa de la Vall](https://en.wikipedia.org/wiki/Casa_de_la_Vall)) are not shown. Only the original and its display copy were replaced; the key, the alt text and the card layout are unchanged.

Trimmed, they are 1.00:1 (Belém Tower, 718×720, 538 KiB), 0.93:1 (Sagrada Família, 667×720, 544 KiB) and 1.08:1 (Casa de la Vall, 720×664, 595 KiB), well below 2:1, so each uses the square tile beside the country's name on phones, like the other ordinary art. Measured as drawn (`object-fit: contain`, not the box) in the built app: Belém Tower 100×100 px, the Sagrada Família 93×100 and Casa de la Vall 100×92 on a 320×568 phone; 117×117, 108×117 and 117×107 at 390×844; 140×140, 130×140 and 152×140 on a 1366×800 desktop. Before Casa de la Vall's revision, Belém Tower and the Sagrada Família were also measured at the same sizes in WebKit (320×568, 390×664) and at 120×120 and 112×120 in the panel of a 740×360 phone in landscape; the revised Casa de la Vall was checked in Chromium at 320×568 and 390×844 and on desktop. At 100 px all three are whole and recognisable: Belém's tower, turrets and water; the Sagrada Família's four spires (their finials are a few pixels, colour rather than detail); Casa de la Vall as a gabled stone manor with its corner turret.

At 320×568 and 390×844 (Chromium), 320×568 and 390×664 (WebKit) in both languages, and on desktop, the country's name, its capital and the whole artwork show together above the pinned button without scrolling, uncropped and unstretched, clear of the name and capital; no word of the name or capital is broken that would fit across the card; and choosing each of the three on the map after the previous card was scrolled to its end opens the new card at its top (`e2e/level7.spec.ts`, "Level 7 at phone and desktop sizes"). At 150% and 200% text the text keeps its size, the art keeps its size and shape in its tile and is brought whole above the button by scrolling, and every part of the card is reached, with no horizontal overflow. In landscape at 740×360 (Chromium and WebKit), each card opens at its top beside the map and its whole artwork, then the whole card, are reached in the scrolling panel above the pinned action (`e2e/landscape.spec.ts`). The WebKit and landscape runs predate Casa de la Vall's revision; its revised card was checked again in Chromium at 320×568 and 390×844 (normal, 150% and 200% text) and on desktop, in both languages.

The briefs they were made from:

| Landmark | Original | Key | Content |
|---|---|---|---|
| Belém Tower, Lisbon, Portugal | `public/images/landmarks/belem-tower.png` | `belem-tower` | The pale limestone Manueline fortress tower at the edge of the Tagus: a square four-storey tower with a loggia of arches and a balcony, rope and armillary-sphere carvings, small domed watchtowers on the corners, crenellations decorated with shields, and the lower many-sided bastion in front, standing in a little blue river water. Tall or square composition. |
| Sagrada Família, Barcelona, Spain | `public/images/landmarks/sagrada-familia.png` | `sagrada-familia` | Gaudí's basilica from the Nativity façade side: a cluster of tall, slender, honeycomb-pierced spire towers with rounded tops crowned by colourful mosaic finials, over the richly sculpted, cave-like portal of the Nativity façade in warm sandstone. Tall composition. |
| Casa de la Vall, Andorra la Vella, Andorra | `public/images/landmarks/casa-de-la-vall.png` | `casa-de-la-vall` | The old stone manor house that was Andorra's parliament: a sturdy three-storey building of rough grey-brown granite with a dark slate roof, small deep-set windows, a round-arched doorway with a coat of arms above it, and a square defensive tower at one corner, on a little paved square with a hint of green mountain slope behind. Wide or square composition. |

#### Generation prompts

Each starts with the shared style paragraph (Level 2's, above: clean dark navy outlines of even weight, soft cel shading, warm bright colours, recognisable architecture, the landmark alone on a fully transparent background, no sky, cast shadow, frame, text, letters, signs, watermark or people, the whole landmark inside the square with a small margin, 1254×1254 px), then describes its landmark. Check each result as for Level 2: transparent background, the landmark whole inside the frame (Belém's bastion and water, every Sagrada Família spire tip, Casa de la Vall's tower), no text (the coat of arms with no lettering), people, frame or shadow on the background. Save it under the filename in the table above.

1. **`belem-tower.png`**
   > [style paragraph] Subject: Belém Tower (Torre de Belém) in Lisbon, Portugal, a 16th-century Manueline fortress at the edge of the river Tagus, seen at a slight angle. A tall, square four-storey tower of pale cream limestone with a loggia of slender arches and a small balcony on the river side, carved stone ropes and armillary spheres, little round domed watchtowers on its corners, and crenellations decorated with carved shields bearing simple crosses. In front of it, the lower, many-sided bastion with its own row of crenellations and small turrets. Calm blue river water with a few soft ripples around the base. Tall or square artwork within the frame.

2. **`sagrada-familia.png`**
   > [style paragraph] Subject: the Sagrada Família basilica in Barcelona, Spain, by Antoni Gaudí, seen from the Nativity façade. Four tall, slender, rounded spire towers of warm honey-coloured sandstone, pierced with rows of small openings, each crowned by a colourful mosaic finial in red, yellow, green and white; a few more spires rise behind them. Below, the richly carved Nativity portal with flowing, organic, cave-like stonework and a pointed central arch. A little paved ground at the base. Tall artwork within the frame.

3. **`casa-de-la-vall.png`**
   > [style paragraph] Subject: Casa de la Vall in Andorra la Vella, Andorra, an old Pyrenean stone manor house that was the country's parliament. A sturdy three-storey building of rough grey and warm brown granite blocks with a steep dark grey slate roof, a few small deep-set windows with wooden shutters, a round-arched stone doorway with a carved coat of arms above it (no lettering), and a square stone defensive tower rising at one corner. A small paved square at the base and a hint of green mountain slope behind the roof. Wide or square artwork within the frame.

## Level 8: Eastern Europe

Poland and Romania are shared with earlier levels: their names, capitals, landmarks, facts and artwork (Wawel Castle, Bran Castle) are unchanged. Only their descriptions are Level 8's own (below). Belarus, Ukraine and Moldova are new. Their content was checked on 2026-10-05. The level's stable id is `eastern-europe`.

### Capitals and landmarks

| Country | Capital | Capital (lat, lon) | Landmark | Landmark (lat, lon) | Fact (English) | Sources |
|---|---|---|---|---|---|---|
| Belarus (Բելառուս) | Minsk (Մինսկ) | 53.9006, 27.5586 | Mir Castle, Mir (Միրի ամրոց) | 53.4511, 26.4727 | Begun in Gothic style in the late 15th century, it was later rebuilt in Renaissance and Baroque styles. | [UNESCO World Heritage Centre: Mir Castle Complex](https://whc.unesco.org/en/list/625/) ("The construction of this castle began at the end of the 15th century, in Gothic style. It was subsequently extended and reconstructed, first in the Renaissance and then in the Baroque style."; inscribed 2000; N53 27 3.9 E26 28 21.8); [Wikipedia: Mir Castle Complex](https://en.wikipedia.org/wiki/Mir_Castle_Complex) (53.45124 N, 26.473 E); [Wikipedia: Minsk](https://en.wikipedia.org/wiki/Minsk) (53.90056 N, 27.55861 E); Minsk: GeoNames 625144 (53.90019 N, 27.56653 E) |
| Ukraine (Ուկրաինա) | Kyiv (Կիև) | 50.4500, 30.5233 | Saint Sophia Cathedral, Kyiv (Սուրբ Սոֆիայի տաճար) | 50.4528, 30.5144 | Built in the early 11th century to rival Hagia Sophia in Constantinople, it keeps mosaics from that time. | [UNESCO World Heritage Centre: Kyiv: Saint-Sophia Cathedral and Related Monastic Buildings, Kyiv-Pechersk Lavra](https://whc.unesco.org/en/list/527/) ("Designed to rival Hagia Sophia in Constantinople"; "one of the major monuments representing the architectural and the monumental art of the early 11th century"; "built … during the reign of the Great Prince of Kyiv, Yaroslav the Wise"; "The Cathedral has preserved its ancient interiors and the collection of mosaics and frescoes of the 11th century"; inscribed 1990); [Wikipedia: Saint Sophia Cathedral, Kyiv](https://en.wikipedia.org/wiki/Saint_Sophia_Cathedral,_Kyiv) (50.4528 N, 30.5144 E); [Wikipedia: Kyiv](https://en.wikipedia.org/wiki/Kyiv) (50.45 N, 30.52333 E); Kyiv: GeoNames 703448 (50.45466 N, 30.5238 E) |
| Moldova (Մոլդովա) | Chisinau (Քիշնև) | 47.0228, 28.8353 | Soroca Fortress, Soroca (Սորոկիի ամրոց) | 48.1612, 28.3055 | Rebuilt in stone in the 16th century, this round fortress with five towers stands on the Dniester River. | [Moldova's official tourism portal (turism.gov.md): Soroca Fortress](https://turism.gov.md/en/obiective_turistice/cetatea-soroca) ("located on the banks of the Dniester River in the town of Soroca. Originally built of wood by Stephen the Great in the 15th century and later rebuilt in stone by Petru Rareș in the 16th century, the fortress stands out for its perfectly circular design and five defensive towers."); [Wikipedia: Soroca Fort](https://en.wikipedia.org/wiki/Soroca_Fort) (48.16122 N, 28.30548 E; founded 1499, rebuilt in stone 1543–1546); [Wikipedia: Chișinău](https://en.wikipedia.org/wiki/Chi%C8%99in%C4%83u) (47.02278 N, 28.83528 E); Chisinau: GeoNames 618426 (47.00902 N, 28.85938 E) |

Notes:

- **Capital and landmark coordinates are separate, and were checked separately**: each against its own Wikipedia article and, for the capitals, GeoNames. Minsk and Kyiv agree within 0.5 km. For Chisinau, GeoNames's point is 2.3 km south-east of Wikipedia's city-centre coordinate, which is kept (it lies in the centre, by the Stephen the Great park). Mir Castle is 87 km south-west of Minsk, and Soroca Fortress 133 km north of Chisinau, so both have their own pins. **Saint Sophia Cathedral is 0.7 km from Kyiv's coordinate**, in the old upper town, so the existing rule for nearby markers applies, as for Riga, Tallinn and Andorra la Vella: a landmark within 16 px of its capital on screen is not drawn, and the capital marker stands for the old town. The card names the landmark as usual. Every capital and landmark lies inside its country in the map data (`src/geo/regionMap.test.ts`).
- **Mir Castle**: "late 15th century" and "Renaissance and Baroque" are UNESCO's ("at the end of the 15th century", "first in the Renaissance and then in the Baroque style"). Left out: its owners (the Ilyinichs, then the Radziwiłłs), its damage in the Napoleonic period and 19th-century restoration, and the UNESCO listing (2000).
- **Saint Sophia Cathedral**: "early 11th century" and "to rival Hagia Sophia in Constantinople" are UNESCO's. Its founding year is disputed (1011, 1017 and 1037 are all given), so the fact says the early 11th century. "Keeps mosaics from that time" stands for UNESCO's "has preserved … the collection of mosaics and frescoes of the 11th century"; the frescoes and the Kyiv-Pechersk Lavra (the other part of the World Heritage property) are left out for length. "Hagia Sophia" and "Constantinople" are the historical names of the church and city at the time.
- **Soroca Fortress**: "rebuilt in stone in the 16th century", "round" (the source's "perfectly circular"), "five towers" and "on the Dniester" are the official portal's. Left out: its first, wooden fort of the 15th century and the two princes' names (Stephen the Great, Petru Rareș), for length; Wikipedia's exact dates (1499; 1543–1546) are not used.
- **"Chisinau"** is written without the Romanian diacritics (Chișinău): the CIA World Factbook's and the UN's English spelling. The app's Latin font is loaded for the basic Latin set only (`subsets: ["latin"]` in `src/app/layout.tsx`), which has no ș or ă; with them, two letters of the capital would be drawn in a fallback font. Nothing else in Level 8's English text needs letters beyond that set (`src/core/content/content.test.ts` checks).
- **Ranges stay on one line**: the Armenian «15-րդ», «11-րդ» and «16-րդ» carry a word joiner (U+2060) after the hyphen, as in Levels 6 and 7.
- **Borders**: CIA World Factbook, final edition, read from the [factbook.json mirror](https://github.com/factbook/factbook.json) as for Levels 6 and 7 (and cross-checked against the archived cia.gov pages, last updated December 2025 – January 2026; the live site has said since 4 February 2026 that the Factbook is discontinued): Poland–Belarus 375 km, Poland–Ukraine 498 km, Belarus–Ukraine 1,111 km, Ukraine–Moldova 1,202 km, Ukraine–Romania 601 km, Moldova–Romania 683 km, and no other land border among the five. Poland's, Belarus's, Ukraine's and Romania's borders with countries outside the level are left out. The Factbook gives Ukraine's area as 603,550 km², Crimea included, with the note "Russia annexed Crimea in 2014"; the map draws Crimea as part of Ukraine (docs/DATA.md, "Level 8").

### Names in Armenian

Country and capital names are the titles of their Armenian Wikipedia articles (checked 2026-10-05 through the MediaWiki API, `prop=langlinks`): Բելառուս, Ուկրաինա, Մոլդովա; Մինսկ, Կիև, Քիշնև. The in-sentence forms add the definite article: Բելառուսը, Ուկրաինան, Մոլդովան. The level's title and region name, «Արևելյան Եվրոպա», is the title of the article Eastern Europe.

| English | Eastern Armenian | Status |
|---|---|---|
| Mir Castle | Միրի ամրոց | **Our rendering**: no Armenian article. Formed like «Վավելի ամրոց» (Wawel Castle): the place name in the genitive and «ամրոց». «Միրի դղյակ» (as «Բրանի դղյակ» for Bran Castle) would also fit: the complex is a castle and residence. In a sentence «Միրի ամրոցը». |
| Saint Sophia Cathedral | Սուրբ Սոֆիայի տաճար | The Kyiv cathedral's article is titled «Սոֆիայի տաճար (Կիև)»; the game adds «Սուրբ» ("Saint"), as the article on Hagia Sophia does («Սուրբ Սոֆիայի տաճար (Ստամբուլ)»), to match the English name. In a sentence «Սուրբ Սոֆիայի տաճարը». |
| Soroca Fortress | Սորոկիի ամրոց | **Our rendering**: no article on the fortress. The town's article is titled «Սորոկի» (from the Russian form, Soroki), and the game follows the article titles; the Romanian form would give «Սորոկայի ամրոց». In a sentence «Սորոկիի ամրոցը». |
| Hagia Sophia, Constantinople (fact) | Սուրբ Սոֆիայի տաճար, Կոստանդնուպոլիս | Article titles (genitive «Կոստանդնուպոլսի»). |
| Dniester (fact) | Դնեստր | The article's title. |
| Sea of Azov, Black Sea, Baltic Sea, Carpathians (hints, description) | Ազովի ծով, Սև ծով, Բալթիկ ծով, Կարպատներ | Article titles. |

Flagged for a native speaker's check (not presented as established usage):

- **Միրի ամրոց** and **Սորոկիի ամրոց** (above), and **Սուրբ Սոֆիայի տաճար** with «Սուրբ» added to the Kyiv article's title.
- **Mir Castle's fact**: «Կառուցումը սկսվել է 15-րդ դարի վերջին՝ գոթական ոճով, իսկ հետագայում ամրոցը վերակառուցվել է վերածննդի և բարոկկո ոճերով։» («վերածննդի … ոճ» for "Renaissance style").
- **Saint Sophia's fact**: «… Կոստանդնուպոլսի Սուրբ Սոֆիայի տաճարի հետ մրցելու համար» for "to rival Hagia Sophia in Constantinople", and «խճանկարներ» for "mosaics".
- **Soroca's fact**: «16-րդ դարում քարից վերակառուցված այս կլոր ամրոցը՝ հինգ աշտարակով, կանգնած է Դնեստր գետի ափին։»
- **The new hints**: Belarus's «բազմաթիվ անտառներով, լճերով և ճահիճներով», Ukraine's «Սև ծովի և Ազովի ծովի երկար ափով», Moldova's «Փոքր երկիր առանց ծովի», Poland's «Տարածաշրջանի ամենաարևմտյան երկիրը» and Romania's «Տարածաշրջանի ամենահարավային երկիրը».
- **The level's description**: «Վարշավայից Ուկրաինայով մինչև Քիշնև՝ Բալթիկ և Սև ծովերի միջև։» ("from Warsaw across Ukraine to Chisinau, between the Baltic and the Black Sea").
- **The completion message** (all eight levels done) uses the existing wording with the new count: «Ավարտել ես բոլոր 8 մակարդակները։ Կարող ես ցանկացածը նորից խաղալ։»

The Armenian facts and hints are our translations of the English ones. No player-facing text uses "lesson" or «դաս» (`src/core/content/content.test.ts` checks).

### Descriptions and Find hints

As in Levels 3–7, a country's description is its hint, shown in Discover and repeated by Find's second hint; Find's first hint names the capital and the landmark (in words only: Find never shows artwork). Poland's usual hint ("in the north-east of this region", written for Level 3) would be wrong here, where Poland is the westernmost of the five, and Romania's ("the largest country in this region", written for Level 5) would be wrong too: Ukraine is more than twice its size, and also has the Carpathians and a Black Sea coast. So Level 8 has its own hints for both (`hints` in `src/core/lessons/eastern-europe.ts`), each telling the country by where it lies. Ukraine's own hint ("the largest country in this region") is true here. The hints of Levels 1–7 are unchanged.

| Country | Hint (English) |
|---|---|
| Poland | The westernmost country of this region, with a coast on the Baltic Sea. (Level 8's own) |
| Belarus | A flat country with no coast in the north of this region, with many forests, lakes and marshes. |
| Ukraine | The largest country in this region, with a long coast on the Black Sea and the Sea of Azov. |
| Moldova | A small country with no coast, between Romania and Ukraine. |
| Romania | The southernmost country of this region, with the arc of the Carpathians and a coast on the Black Sea. (Level 8's own) |

Each is distinct within the level: only Poland has a Baltic coast, only Belarus and Moldova have no coast (one in the north, one small and between Romania and Ukraine), Ukraine is the largest, and Romania reaches furthest south (43.6°N; Crimea's southern tip is 44.4°N).

**Long Armenian words on narrow phones with enlarged text.** At 200% text on a 320×568 phone the card's line was 258 px (257 in WebKit), and Belarus's «տարածաշրջանի» is 259 px at the description's full size: it ran 1–2 px into the card's padding. The card's sides now ease from 14 px to 12 px between 150% and 200% text (`clamp` on `.countryCard`'s padding in `src/components/LessonScreen.module.css`), so the line is 262 px (261 in WebKit) and the word fits whole; at the normal size and at 150% nothing moved. The font size is unchanged. The description also wraps like the card's other text (`overflow-wrap: break-word`): a word breaks inside only when it is wider than the whole line. At 200% that happens to Poland's «ամենաարևմտյան» (277 px) and Romania's «ամենահարավային» (293 px), Level 8's own descriptions, which until then ran 19 and 35 px out of the card at 320×568 (Romania's 15 px at 740×360), and, as before, to «Կոստանդնուպոլսի» (288 px) in Saint Sophia's fact.

### Illustrations

Mir Castle, Saint Sophia Cathedral and Soroca Fortress were supplied on 2026-10-05 as **AI-generated stylised illustrations** made from the briefs and prompts below (kept as the record of how they were made), and integrated with the four steps in Level 3's "Illustrations" section: `node scripts/prepare-landmarks.mjs` (which left the twenty-six existing display copies byte-identical and all twenty-nine originals unchanged, both checked by SHA-256); `illustration: "<key>"` on each landmark in `src/core/content/countries.ts`; the import into `LANDMARK_IMAGES` in `src/components/landmarks/LandmarkCard.tsx`; and the expectations in `src/core/content/content.test.ts` and `e2e/level8.spec.ts`. Until then their cards used the text-only layout (`data-art="none"`), which remains for any landmark without artwork. Poland's Wawel Castle and Romania's Bran Castle keep their illustrations, so every Level 8 card is illustrated. Their alt text is the shared "Illustration of {landmark}" / «Նկարազարդում՝ {landmark}», with the landmark as named in a sentence: "Illustration of Mir Castle", "Illustration of Saint Sophia Cathedral", "Illustration of Soroca Fortress"; «Նկարազարդում՝ Միրի ամրոցը», «Նկարազարդում՝ Սուրբ Սոֆիայի տաճարը», «Նկարազարդում՝ Սորոկիի ամրոցը». Find never shows artwork, not even after a hint names the landmark. Facts, coordinates, gameplay, map framing, labels and the level selection's card (still Bran Castle) are unchanged.

The three originals are 1254×1254 8-bit RGBA PNG (sRGB), 1.7–2.0 MB (Mir Castle 1,808,171 bytes, Saint Sophia Cathedral 1,694,070, Soroca Fortress 2,033,867). Mir Castle's is the version supplied on 2026-10-05 (SHA-256 beginning `4fcedcaaf1ed6a51`); no earlier version was in the repository to compare it with. Checked on arrival, by reading their alpha channels as for Levels 4–7:
- each shows its assigned landmark (below, with what the drawing simplifies). No text, letters, inscriptions or people;
- transparent corners; no artwork pixel touches the frame (10–181 px of empty margin; the closest are Mir Castle's right and left sides, 10 and 11 px, and Saint Sophia's right and left, 19 and 22 px, so the trimmed copy's 2% margin is cut short at the frame there, as for earlier levels, with no artwork lost);
- 46–53% of each image fully transparent; a 1.2–1.9% fringe of faint pixels (alpha 1–32) and 0.49–0.69% of edge pixels (alpha 33–223) from background removal; the only colour in fully transparent pixels is near-black (every channel at most 12, 0.03–0.05% of pixels), which cannot show; the artwork itself at alpha 246–254 (0.02% at 255), like the approved originals.

Composited on the card's sky-to-mint tile, on dark navy and on magenta, at full size and at 2× zoom on the original pixels (Mir's spires, finials and bridge; Saint Sophia's crosses, golden dome and grassy base; Soroca's conical roofs and river), their edges are clean: no halo and no coloured fringe. The thin dark outline round each is the drawing's own, as the shared style asks. The originals were not retouched.

**What the drawings show and simplify.** These are stylised illustrations, compared with the briefs and with the landmarks' published descriptions, not with photographs or surveys; their architectural accuracy is not verified beyond that, and nothing below claims it.
- **Mir Castle**: seen from a corner above, the square courtyard castle of red brick with white niches, arched windows and bands of blind arcading on stone bases; five towers (four at the corners and the tall gate tower in front, with its arched gateway and a stone bridge); the white palace wings with decorative gables and red-tiled roofs inside the walls, round a cobbled courtyard; a green bank at the base. Simplified against the brief: every tower has the same steep red tiled roof with dormers and a small finial, where the brief asked for some bell-shaped Baroque caps in grey-green; there is no pond water (the bridge crosses grass); and the rear corner tower is drawn as a lower, white-plastered block, unlike the other four. These were noted, not checked against the castle, and not corrected: the drawing is used as supplied.
- **Saint Sophia Cathedral**: white walls with arched windows and cornices, many green pear-shaped domes in tiers with golden crosses, and the large central dome, all gold, highest. Simplified against the brief: the pilasters and window frames are white rather than pale turquoise-green; the smaller domes carry gilded bands under their crosses rather than full golden cupolas; the base is grass and shrubs, not paving; it is seen from a corner, with rounded, apse-like bays in front (two showing patches of bare brick and stone), rather than square-on from the west front; the optional bell tower is not shown.
- **Soroca Fortress**: seen from above, the round ring of pale stone walls with a crenellated wall-walk and arrow slits, four round towers under conical shingled roofs and the square entrance tower with an arched gate and steps under a pyramidal roof, the grassy courtyard inside, and the river along one side. Simplified: the walls are warm beige rather than grey, the merlons plain blocks, and the proportions and spacing of the towers are the drawing's, not measured.

Trimmed, they are 1.27:1 (Mir Castle, 720×565, 447 KiB), 1.05:1 (Saint Sophia Cathedral, 720×683, 428 KiB) and 1.08:1 (Soroca Fortress, 720×667, 505 KiB), well below 2:1, so each uses the square tile beside the country's name on phones, like the other ordinary art. Measured as drawn (`object-fit: contain`, not the box) in the built app, Chromium and WebKit alike: Mir Castle 100×78 px, Saint Sophia 100×95 and Soroca 100×92 on a 320×568 phone; 117×91, 117×110 and 117×108 at 390×844; 120×94, 120×114 and 120×111 in the panel of a 740×360 phone in landscape; 178×140, 148×140 and 151×140 on a 1366×800 desktop (Chromium). At 100 px all three are whole and recognisable: Mir's red towers round the white palace, Saint Sophia's green domes round the golden one, Soroca's ring of round towers by the water.

Checked in an isolated production build (Chromium; WebKit at the phone sizes), in both languages: at 320×568, 390×844 and 740×360 at the normal text size, and on a 1366×800 desktop, the country's name, its capital and the whole artwork show together above the pinned button without scrolling, uncropped and unstretched, the art in its square tile clear of the name and capital. At 150% and 200% text (phones, landscape included) the text keeps its size, the art keeps its size and shape and is brought whole above the button by scrolling, every part of the card is reached, and there is no horizontal overflow. Choosing each of the three on the map after the previous card was scrolled to its end opens the new card at its top, at every size. In Find, before and after each hint (the first names the landmark), no artwork is shown. `e2e/level8.spec.ts` repeats these checks; it was updated for the artwork but not run with it.

The briefs they were made from:

| Landmark | Original | Key | Content |
|---|---|---|---|
| Mir Castle, Mir, Belarus | `public/images/landmarks/mir-castle.png` | `mir-castle` | The castle on its low rise beside a pond: a square enclosure of red brick walls with white plastered details and five tall corner and gate towers of four or five storeys, decorated with white niches, arched windows and blind arcading, each tower crowned by a steep roof (some pointed spires, some bell-shaped Baroque caps) in dark red or grey-green; the palace wing with its red-tiled roof rising inside the walls; a little green bank and blue pond water at the base. Wide or square composition. |
| Saint Sophia Cathedral, Kyiv, Ukraine | `public/images/landmarks/saint-sophia-cathedral.png` | `saint-sophia-cathedral` | The cathedral seen from its west front, as it looks today (check the colours against a current photograph when generating): brilliant white walls with pale turquoise-green pilasters and window frames in the Ukrainian Baroque style, several tiers of green pear-shaped domes crowned by golden cupolas and small golden crosses, the large central dome highest; a little paved ground at the base. Optionally the tall white-and-blue bell tower beside it, smaller. Tall or square composition. |
| Soroca Fortress, Soroca, Moldova | `public/images/landmarks/soroca-fortress.png` | `soroca-fortress` | The round stone fortress on the bank of the Dniester: a perfect circle of thick grey limestone walls, about 30 m across, with five evenly spaced towers (four round outer towers and the main entrance tower with its gateway), arrow slits, a wall-walk and conical roofs on the towers; a little green riverbank and calm blue river water along its base. Wide or square composition. |

#### Generation prompts

Each starts with the shared style paragraph (Level 2's, above: clean dark navy outlines of even weight, soft cel shading, warm bright colours, recognisable architecture, the landmark alone on a fully transparent background, no sky, cast shadow, frame, text, letters, signs, watermark or people, the whole landmark inside the square with a small margin, 1254×1254 px), then describes its landmark. Check each result as for Level 7: transparent background, the landmark whole inside the frame (every tower and spire tip of Mir Castle; every dome and cross of Saint Sophia; the whole ring of Soroca's walls and its water), no text, letters or religious inscriptions, no people, frame or shadow on the background. Save it under the filename in the table above.

1. **`mir-castle.png`**
   > [style paragraph] Subject: Mir Castle in the village of Mir, Belarus, a castle of the late 15th and 16th centuries, seen at a slight angle from across its pond. A square courtyard castle with walls of warm red brick and white plastered decoration, and five tall towers at its corners and gate, four to five storeys high, each patterned with white recessed niches, small arched windows and bands of blind arcading. The towers have steep roofs: some tall pointed spires in dark red, some bell-shaped Baroque caps in grey-green, with small finials. Behind the walls, the long palace wing with a red tiled roof. A little green grassy bank at the base and a small strip of calm blue pond water with soft reflections. Wide or square artwork within the frame.

2. **`saint-sophia-cathedral.png`**
   > [style paragraph] Subject: Saint Sophia Cathedral in Kyiv, Ukraine, founded in the 11th century and rebuilt outside in the Ukrainian Baroque style, seen from the west at a slight angle. Bright white walls with pale turquoise-green pilasters, cornices and window surrounds, and rows of arched windows. Above, many green pear-shaped (onion-like) domes in tiers, each topped by a small golden cupola and a simple golden cross, the large central dome highest and the smaller domes stepping down around it. A little pale paving at the base. Optionally, at one side and smaller, the tall white bell tower with turquoise details and a golden dome. No icons, writing or inscriptions on the walls. Tall or square artwork within the frame.

3. **`soroca-fortress.png`**
   > [style paragraph] Subject: Soroca Fortress in Soroca, Moldova, a 16th-century round stone fortress on the bank of the river Dniester, seen at a slight angle from a little above so its circular plan reads. A perfectly round ring of thick grey and warm beige limestone walls with a crenellated wall-walk, and five evenly spaced towers built into the ring: four round towers with narrow arrow slits, and the entrance tower with an arched gateway, each tower under a conical roof of dark brown wooden shingles. A little green grassy riverbank at the base and calm blue river water along one side with a few soft ripples. Wide or square artwork within the frame.

## Landmark illustrations

The twenty-nine illustrations (Level 1's five; Level 2's Chapel Bridge, Schönbrunn Palace and Colosseum; Level 3's Wawel Castle, Charles Bridge and Bratislava Castle, added 2026-09-30; Level 4's Bled Castle, City Walls of Dubrovnik, Stari Most and Ostrog Monastery, added 2026-10-01; Level 5's Esztergom Basilica, Bran Castle, Golubac Fortress, Rila Monastery and Meteora, added 2026-10-02; Level 6's Trakai Island Castle, House of the Black Heads and Tallinn Town Hall, added 2026-10-03; Level 7's Belém Tower, Sagrada Família and Casa de la Vall, added 2026-10-04; and Level 8's Mir Castle, Saint Sophia Cathedral and Soroca Fortress, added 2026-10-05) are **AI-generated stylised illustrations** supplied for this prototype. Level 7 also reuses France's and Italy's (briefs, prompts and what each drawing simplifies in "Level 7: Iberian Journey"). Level 8 also reuses Poland's and Romania's (briefs, prompts and what each drawing simplifies in "Level 8: Eastern Europe"). They are not photographs and should not be presented as such. They are drawn in a consistent cartoon style, not as exact architectural records. Provenance is recorded here only; the player interface shows no provenance notice. Each image has localized alt text ("Illustration of …" / «Նկարազարդում՝ …»).

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
| Poland | `public/images/landmarks/wawel-castle.png` | `src/assets/landmarks/wawel-castle.webp` (720×481) | 1527×1021 at (9, 0) (with the 2% margin; the artwork itself is 1479×962 at (39, 29)) |
| Czechia | `public/images/landmarks/charles-bridge.png` | `src/assets/landmarks/charles-bridge.webp` (720×480) | 1536×1024 at (0, 0) (with the 2% margin; the artwork itself is 1503×986 at (19, 20)) |
| Slovakia | `public/images/landmarks/bratislava-castle.png` | `src/assets/landmarks/bratislava-castle.webp` (720×489) | 1495×1015 at (23, 0) (with the 2% margin; the artwork itself is 1437×974 at (52, 12)) |
| Slovenia | `public/images/landmarks/bled-castle.png` | `src/assets/landmarks/bled-castle.webp` (720×665) | 1254×1159 at (0, 69) (with the 2% margin; the artwork itself is 1209×1111 at (21, 93)) |
| Croatia | `public/images/landmarks/dubrovnik-city-walls.png` | `src/assets/landmarks/dubrovnik-city-walls.webp` (720×694) | 1254×1209 at (0, 20) (with the 2% margin; the artwork itself is 1240×1159 at (8, 45)) |
| Bosnia and Herzegovina | `public/images/landmarks/stari-most.png` | `src/assets/landmarks/stari-most.webp` (720×598) | 1254×1041 at (0, 134) (with the 2% margin; the artwork itself is 1232×991 at (9, 159)) |
| Montenegro | `public/images/landmarks/ostrog-monastery.png` | `src/assets/landmarks/ostrog-monastery.webp` (690×720) | 1202×1254 at (26, 0) (with the 2% margin; the artwork itself is 1152×1232 at (51, 12)) |
| Hungary | `public/images/landmarks/esztergom-basilica.png` | `src/assets/landmarks/esztergom-basilica.webp` (720×720) | 1254×1254 at (0, 0) (with the 2% margin; the artwork itself is 1220×1220 at (17, 16)) |
| Romania | `public/images/landmarks/bran-castle.png` | `src/assets/landmarks/bran-castle.webp` (720×718) | 1239×1236 at (14, 12) (with the 2% margin; the artwork itself is 1191×1188 at (38, 36)) |
| Serbia | `public/images/landmarks/golubac-fortress.png` | `src/assets/landmarks/golubac-fortress.webp` (720×612) | 1254×1066 at (0, 107) (with the 2% margin; the artwork itself is 1229×1016 at (14, 132)) |
| Bulgaria | `public/images/landmarks/rila-monastery.png` | `src/assets/landmarks/rila-monastery.webp` (720×580) | 1251×1007 at (3, 125) (with the 2% margin; the artwork itself is 1204×959 at (27, 149)) |
| Greece | `public/images/landmarks/meteora.png` | `src/assets/landmarks/meteora.webp` (648×720) | 1090×1211 at (83, 34) (with the 2% margin; the artwork itself is 1044×1165 at (106, 57)) |
| Lithuania | `public/images/landmarks/trakai-island-castle.png` | `src/assets/landmarks/trakai-island-castle.webp` (720×576) | 1254×1003 at (0, 129) (with the 2% margin; the artwork itself is 1240×953 at (8, 154)) |
| Latvia | `public/images/landmarks/house-of-the-black-heads.png` | `src/assets/landmarks/house-of-the-black-heads.webp` (720×717) | 1249×1243 at (3, 10) (with the 2% margin; the artwork itself is 1201×1195 at (27, 34)) |
| Estonia | `public/images/landmarks/tallinn-town-hall.png` | `src/assets/landmarks/tallinn-town-hall.webp` (607×720) | 1058×1254 at (140, 0) (with the 2% margin; the artwork itself is 1008×1232 at (165, 8)) |
| Portugal | `public/images/landmarks/belem-tower.png` | `src/assets/landmarks/belem-tower.webp` (718×720) | 1208×1211 at (23, 27) (with the 2% margin; the artwork itself is 1162×1165 at (46, 50)) |
| Spain | `public/images/landmarks/sagrada-familia.png` | `src/assets/landmarks/sagrada-familia.webp` (667×720) | 1161×1254 at (54, 0) (with the 2% margin; the artwork itself is 1113×1221 at (78, 15)) |
| Andorra | `public/images/landmarks/casa-de-la-vall.png` | `src/assets/landmarks/casa-de-la-vall.webp` (720×664) | 1237×1141 at (8, 74) (with the 2% margin; the artwork itself is 1189×1093 at (32, 98)) |
| Belarus | `public/images/landmarks/mir-castle.png` | `src/assets/landmarks/mir-castle.webp` (720×565) | 1254×984 at (0, 114) (with the 2% margin; the artwork itself is 1233×934 at (11, 139)) |
| Ukraine | `public/images/landmarks/saint-sophia-cathedral.png` | `src/assets/landmarks/saint-sophia-cathedral.webp` (720×683) | 1254×1190 at (0, 20) (with the 2% margin; the artwork itself is 1213×1142 at (22, 44)) |
| Moldova | `public/images/landmarks/soroca-fortress.png` | `src/assets/landmarks/soroca-fortress.webp` (720×667) | 1228×1137 at (17, 52) (with the 2% margin; the artwork itself is 1180×1089 at (41, 76)) |

### Originals

Level 1's five are 1254×1254 PNG, 8-bit RGBA, 0.9–1.7 MB. Their transparency is essentially binary: pixels are fully transparent or fully opaque, plus a thin 1–2% fringe of very faint pixels (alpha 1–32) left by background removal. The fringe is invisible on the card background at display size. The artwork fills very different parts of the square frame: the bridge uses about 55% of the height, the tower about 97%.

Level 2's three are 8-bit RGBA PNG, 1.8–2.3 MB: the Chapel Bridge and the Colosseum 1254×1254, Schönbrunn Palace 2172×724 (not square; the script handles any size). Checked on arrival: transparent corners, no artwork touching the frame's edge, no text or people, and edges as crisp as Level 1's (0.5–1.3% of pixels semi-transparent, against 0.5–0.9%). Seen on black they show thin coloured fringes (orange at the bridge's roof, cyan at its water, yellow on the Colosseum) and Schönbrunn a faint whitish smear under its gravel, all left by background removal; composited on the card's sky-to-mint tile these are not visible. They are more painterly than Level 1's, with lighter outlines. Schönbrunn is very wide (about 3.3:1): on phones it uses the wide layout below.

Level 3's three are 1536×1024 (3:2) 8-bit RGBA PNG, 2.4–2.8 MB. Checked on arrival (2026-09-30), by reading their alpha channels:
- transparent corners; no artwork pixel touches the frame (12–52 px of empty margin on every side); no text or people;
- 43–52% of each image fully transparent; a 1.3–2.8% fringe of faint pixels (alpha 1–32) and 0.5–1.4% of edge pixels (alpha 33–223) from background removal, like the earlier art;
- the artwork itself at alpha 251–253, that is 98–99% opaque, not 255. **The approved originals are the same**: measured the same way, the Eiffel Tower, the Brandenburg Gate and the Colosseum are 251–253 too (at most 0.1% of their pixels are 255). So "fully opaque" above means this in practice: on the card's tile at most about 2/255 of the background shows through, which cannot be seen.

Composited on the card's tile colour and on black (to show fringes), their edges are clean: no halo on the tile, and no coloured fringe visible at display size on black. Like Level 2's, they are more painterly than Level 1's. The castles stand on their hills with only a hint of the river, rather than the river strip the briefs asked for. The trimmed art is about 1.5:1, so each uses the square tile beside the country's name on phones. At the four phone sizes (320×568, 320×640, 390×664, 390×844) the name, the capital and the whole artwork show together above the pinned button, uncropped and undistorted (`e2e/level3.spec.ts`).

Level 4's four are 1254×1254 8-bit RGBA PNG, 2.3–2.7 MB. Checked on arrival (2026-10-01), by reading their alpha channels as for Level 3's:
- each shows its assigned landmark: Bled Castle on its cliff above the lake; Dubrovnik's walls with the round Minčeta Tower, the old town's roofs and a bell tower above the sea; Stari Most's single arch over the Neretva between its two towers; Ostrog Monastery's white building set into the cliff, with stairs and cypresses below. No text or people;
- transparent corners; no artwork pixel touches the frame (6–159 px of empty margin; the closest are Dubrovnik's right side, 6 px, and Ostrog's bottom, 10 px, so the trimmed copies' 2% margin is cut short at the frame there, with no artwork lost);
- 34–44% of each image fully transparent; a 0.8–1.8% fringe of faint pixels (alpha 1–32) and 0.3–0.6% of edge pixels (alpha 33–223) from background removal; no colour hidden in the fully transparent pixels; the artwork itself at alpha 251–253 (0.01–0.03% at 255), like the approved originals.

Seen on black they show thin coloured fringes (red, green and cyan along Stari Most's deck, railing and towers; cyan along Bled's water), left by background removal, like Level 2's; composited on the card's sky-to-mint tile, at full size and at 2× zoom on the original pixels, these are not visible, and the edges match the Colosseum's. Stari Most's railing is drawn light and partly see-through, as part of the artwork. Ostrog has a dark outline around the whole cliff, its own drawn style. They are as painterly as Level 2's and 3's. The originals were not retouched.

Level 5's five are 1254×1254 8-bit RGBA PNG (sRGB), 2.0–2.3 MB. Checked on arrival (2026-10-02), by reading their alpha channels as for Level 4's:
- each shows its assigned landmark: Esztergom Basilica's green-copper dome on its colonnaded drum, the columned portico and the two domed bell towers, on its wooded hill (without the brief's strip of river); Bran Castle's white walls, red roofs and towers of different heights on its rock, with fir trees; Golubac Fortress's towers and crenellated walls climbing a rocky hill from the blue-green Danube; Rila Monastery's church with its black-and-white striped arcades, red-and-white striped walls and five domes, the stone tower behind and a balconied residential wing; Meteora's monastery with red-tiled roofs and a small dome on the flat top of a tall sandstone pillar, a lower pillar beside it and cypresses at the base. No text, letters, people, frame or cast shadow;
- transparent corners; no artwork pixel touches the frame (11–149 px of empty margin; the closest are Golubac's right side, 11 px, and its left, 14 px, so the trimmed copies' 2% margin is cut short at the frame there, as for Level 4, with no artwork lost);
- 41–47% of each image fully transparent; a 1.2–1.7% fringe of faint pixels (alpha 1–32) and 0.4–0.9% of edge pixels (alpha 33–223) from background removal; the only colour in fully transparent pixels is near-black (every channel below 32, 0.02–0.05% of pixels), which cannot show; the artwork itself at alpha 250–253 (0.01–0.04% at 255), like the approved originals.

Composited on the card's sky-to-mint tile and on black, at full size and at 2× zoom on the original pixels, their edges are clean: no halo on the tile and no coloured fringe on black. Golubac's river ends in a soft scalloped edge and Rila's residential wing in a plain end wall; both are drawn that way, well inside the frame (the water 106 px above its bottom edge, the wall 27 px from its left), not cut by it. Meteora has a dark outline around its rocks, like Ostrog's cliff. They are as painterly as Level 4's. The originals were not retouched.

### Display copies

`scripts/prepare-landmarks.mjs` (run with `node scripts/prepare-landmarks.mjs`) creates the display copies:

1. Trim each original to its visible artwork (pixels with alpha > 32) plus a 2% transparent margin. No part of the artwork is cut: tower tips, bridge ends and the Quadriga stay whole.
2. Downsize to at most 720 px on the longer side, about 3× the largest on-screen size.
3. Save as lossless WebP, so the only lossy step is next/image's own encoding. Total 14.3 MB for all twenty-nine (Level 3's three add 1.06 MB; Level 4's four 2.69 MB: Bled Castle 682 KiB, City Walls of Dubrovnik 682 KiB, Stari Most 603 KiB, Ostrog Monastery 658 KiB; Level 5's five 2.83 MB: Esztergom Basilica 517 KiB, Bran Castle 581 KiB, Golubac Fortress 529 KiB, Rila Monastery 569 KiB, Meteora 565 KiB; Level 6's three 1.38 MB: Trakai Island Castle 490 KiB, House of the Black Heads 577 KiB, Tallinn Town Hall 312 KiB; Level 7's three 1.72 MB: Belém Tower 538 KiB, Sagrada Família 544 KiB, Casa de la Vall 595 KiB; Level 8's three 1.41 MB: Mir Castle 447 KiB, Saint Sophia Cathedral 428 KiB, Soroca Fortress 505 KiB), versus 58.7 MB for the originals. The player downloads only the resized WebP that `next/image` serves for the card's size, not these copies.

The app imports the display copies statically. `next/image` serves each device a resized, cached WebP, and the static import supplies intrinsic dimensions to prevent layout shift. Every card uses the same fixed illustration box with `object-fit: contain`. Because the copies are trimmed, tall and wide landmarks get similar visual weight.

**Very wide art on phones.** An illustration whose display copy is at least **2:1** (width ÷ height, `WIDE_ART_ASPECT` in `src/components/landmarks/LandmarkCard.tsx`) gets a different phone layout: the country's name and capital as a compact heading, the art in a shallow tile across the card below them (the same colours and corners), then the landmark's name and fact and the country's description. The tile's height follows the art's own proportions, up to `max(56px, 11svh)` so that the name, capital and whole artwork fit above the pinned button on a 320×568 screen. Since the ratio comes from the static import, the layout is decided before the image loads, and nothing moves when it does. Everything else keeps the square tile beside the name, and desktop is unchanged.

Why 2:1: in the square tile, art of aspect *a* uses 1/*a* of the tile's height. In the shallow tile (about 262×62 px at 320×568), art below about 2:1 would be drawn no larger. The Adolphe Bridge (1.71) would go from 100×58 px to about 106×62 px, so it keeps the side-by-side layout. The current copies are 0.76–1.71 or 3.26 (Level 3's are 1.47–1.50; Level 4's 0.96–1.20; Level 5's 0.90–1.24; Level 6's 0.84–1.25; Level 7's 0.93–1.08; Level 8's 1.05–1.27), so 2 sits in the gap. Today only **Schönbrunn Palace (3.26)** uses the wide layout. It is drawn at 204×62 px at 320×568 (100×30 px before), 229×70 at 320×640, 238×73 at 390×664 (117×35 before) and 302×93 at 390×844.

**Level card thumbnails.** The same script also makes a thumbnail of each level card's picture (`THUMBNAILS` in the script, matching `LEVEL_ART_COUNTRY` in `src/components/WelcomeScreen.tsx`) in `src/assets/landmarks/thumbnails/`:
- **Same trim:** the same trim as the display copy, resized once from the original. Proportions and the whole artwork are kept.
- **Size:** 156 px on the longer side. The card's 64 px tile draws the art at most 52 CSS px, and 156 px covers that at up to 3× pixel density.
- **Encoding:** near-lossless WebP (quality 40). Transparent and opaque pixels stay so, and soft edges and colours move by at most a few levels. At the drawn size this is at least 44 dB against a lossless thumbnail, at 1×, 2× and 3×. Lossy WebP of the same size blurred the outlines at 3×.
- **Sizes:** Eiffel Tower 119×156, 9.8 KiB; Chapel Bridge 156×156, 15.3 KiB; Charles Bridge 156×104, 10.4 KiB; City Walls of Dubrovnik 156×150, 20.3 KiB; Meteora 140×156, 17.2 KiB; Trakai Island Castle 156×125, 14.8 KiB; Sagrada Família 144×156, 21.4 KiB; Bran Castle 156×156, 18.5 KiB. Together 128 KiB, against 3.8 MiB for their display copies.
- **Served as is:** the level cards load them unoptimised, as static files, not through `/_next/image`. Only the level cards use them; the landmark cards keep the display copies through `next/image`.

Adding a thumbnail left all twenty-nine display copies byte-identical and all twenty-nine originals unchanged, both checked by SHA-256; a rerun reproduces the thumbnails byte for byte.

To replace an illustration, overwrite the original in `public/images/landmarks/` and rerun the script.
