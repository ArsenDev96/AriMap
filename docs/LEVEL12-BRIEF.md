# Level 12 (Russia and its western neighbours): brief

Approved 2026-10-15, from the reviewed proposal and the owner's final decisions. This is the reference for the implementation; its facts were researched for the proposal and are not repeated.

## Content

- Stable id `russia-and-western-neighbours`, Level 12, unlocked by `across-the-channel` (Level 11).
- Title: "Russia and its western neighbours" / «Ռուսաստանը և նրա արևմտյան հարևանները».
- Description: "Explore European Russia and its neighbours, from Finland to Belarus." / «Ուսումնասիրիր Ռուսաստանի եվրոպական մասը և նրա հարևաններին՝ Ֆինլանդիայից մինչև Բելառուս։»
- Region name: "north-eastern Europe" / «Հյուսիսարևելյան Եվրոպա».
- Learning countries: Russia, Finland, Estonia, Latvia, Belarus. The four taught before keep their names, capitals, landmarks and illustrations (Olavinlinna, Tallinn Town Hall, the House of the Black Heads, Mir Castle).

**Russia** (new shared content; the Quick Challenge's existing name and label point, 44° E 57° N, are kept unchanged)

| | English | Eastern Armenian |
|---|---|---|
| Name | Russia | Ռուսաստան |
| Name in text | Russia | Ռուսաստանը |
| Capital | Moscow (37.6173° E, 55.7558° N) | Մոսկվա |
| Hint (Discover; Kaliningrad is explained here, not in the Travel note) | The world's largest country, reaching across Asia to the Pacific. Only its western part fits on this map. Kaliningrad, on the Baltic Sea between Lithuania and Poland, is a separate part of Russia. | Աշխարհի ամենամեծ երկիրը, որը ձգվում է Ասիայով մինչև Խաղաղ օվկիանոս։ Այս քարտեզին տեղավորվում է միայն նրա արևմտյան մասը։ Կալինինգրադը՝ Բալթիկ ծովի ափին, Լիտվայի և Լեհաստանի միջև, Ռուսաստանի առանձին մասն է։ |
| Landmark | Saint Basil's Cathedral (Red Square, 37.6231° E, 55.7525° N) | Վասիլի Երանելու տաճար (in text: Վասիլի Երանելու տաճարը) |
| Fact | Saint Basil's Cathedral was built in Moscow between 1555 and 1561. | Վասիլի Երանելու տաճարը կառուցվել է Մոսկվայում՝ 1555–1561 թվականներին։ |

Artwork: `public/images/landmarks/saint-basils-cathedral.png` (supplied); display WebP and card thumbnail from `scripts/prepare-landmarks.mjs`; the original kept unchanged.

**Level-specific hints** (the shared ones say "northernmost" or "in the north of this region", wrong once Russia is in the region)

| | English | Eastern Armenian |
|---|---|---|
| Finland | A land of forests and lakes north of Estonia, across the Gulf of Finland. | Անտառների և լճերի երկիր Էստոնիայից հյուսիս՝ Ֆիննական ծոցի մյուս կողմում։ |
| Estonia | The smallest country of this region, on the Gulf of Finland, with many islands. | Տարածաշրջանի ամենափոքր երկիրը՝ Ֆիննական ծոցի ափին, բազմաթիվ կղզիներով։ |
| Latvia | On the Baltic Sea around the Gulf of Riga, between Estonia and Belarus. | Բալթիկ ծովի ափին՝ Ռիգայի ծոցի շուրջը, Էստոնիայի և Բելառուսի միջև։ |
| Belarus | A flat country with no coast, south of Latvia, with many forests, lakes and marshes. | Հարթ երկիր առանց ծովի՝ Լատվիայից հարավ, բազմաթիվ անտառներով, լճերով և ճահիճներով։ |

New Armenian wording needs native review.

## Travel

- Mission `est-to-blr`: Tallinn → Minsk, **two crossings**, both shortest routes accepted: **Estonia → Latvia → Belarus** and **Estonia → (mainland) Russia → Belarus**.
- Graph, real land borders between mainland territories only, no Travel-only countries: Estonia: Latvia, Russia · Latvia: Estonia, Russia, Belarus · Belarus: Latvia, Russia · Russia: Finland, Estonia, Latvia, Belarus · Finland: Russia. Estonia and Finland have no land border.
- Choices: in Estonia, Latvia or Russia (both right) and **Finland as a non-neighbour option** (Level 7's mechanism: feedback only, no move, no crossing, no rating penalty); in Latvia, Russia or Belarus; in Russia, Finland, Latvia or Belarus. Wrong turns (each uses the second crossing, out of crossings): Latvia → Russia, Russia → Latvia, Russia → Finland. No forced single-option state, no dead end. Wrong turns, Undo, Restart, replay and restored saves follow the existing rules.
- Crossing points: Estonia–Latvia and Belarus–Latvia reuse Levels 6 and 8's; Estonia–Russia, Latvia–Russia, Belarus–Russia and Finland–Russia new vertices of the shared borders (docs/DATA.md rule). Every Russian leg stays on the mainland (waypoints where a straight leg would not).
- **Kaliningrad** is part of Russia's shape (highlighted with it, a correct answer in Find), but borders only Lithuania and Poland, neither in the graph: no move, crossing or leg can enter it or jump between it and the mainland. The traveller's pin in Russia is Moscow.
- Travel note (the existing amber note), a map exercise along land borders, not guidance on present-day access: "This journey is a map exercise along land borders, not a guide to crossing them today." / «Այս ճանապարհորդությունը քարտեզային վարժություն է՝ ցամաքային սահմաններով, և ոչ թե այսօր դրանք հատելու ուղեցույց։»

## Map and assets

- **Frame**: Finland, Estonia, Latvia, Belarus and Russia only within a lon/lat box of about 26–40° E, 50–70° N (Saint Petersburg, Moscow with margin, Karelia), through a small React-free per-country frame option. All of Russia is never fitted.
- **A separate dynamically loaded dataset** (`east`) in the shared projection and quantization grid, holding only the geometry the coverage (sized from the shortest map, as Levels 10–11) needs, clipped beyond it with a margin; Estonia, Latvia and Belarus identical to the levels' data. Raw and gzipped sizes reported.
- **Cropped edges** lie outside every view; never drawn as coastlines or borders. No new "continues" component.
- **Border policy** unchanged: Crimea part of Ukraine (Russia's shape excludes it); no shared geometry changed; no text about control or annexation; Russia–Ukraine and Belarus–Ukraine not in the graph. Earlier datasets unchanged.
- **Russia's label**: a per-level label point (about 34° E, 58° N) inside the frame; the shared one stays the Quick Challenge's.
- **Relief**: only Level 12's overview (half resolution, as Levels 10–11); deep zoom reuses the existing tiles; no new tiles.
- Existing camera, pin clearance, responsive toolbar and label placement reused, not redesigned.

## Progression

Twelve levels, 36 stars; Level 11's Results gain "Next level". Older saves and best ratings preserved. Quick Challenge unchanged (40 countries, 15 questions, 60 s). Content, graph and geography stay React- and DOM-free.

## Validation for this pass

Tests, specs and docs updated for Level 12 and the new counts; typecheck and lint run; no unit tests, e2e specs or scratch tests. One focused Chromium review at 390×844 and 1366×800, English and Armenian: unlock, Discover/Find, both winning routes, one wrong turn, Finland's feedback, Undo/Restart, Results, artwork. WebKit, 200% text and cross-level audits deferred. A preview built and served from one named build folder.

## Sources (from the proposal)

- [State Historical Museum: Pokrovsky Cathedral, history](https://shm.ru/kollektsii-i-muzeynyy-kompleks/museum_history/pokrovskiy-sobor/history/): built 1555–1561; the builders' inscription found in 1957 dates its completion to 12 July 1561 (1560 before).
- [State Historical Museum: St Basil's (Pokrovsky Cathedral)](https://shm.ru/museum/hvb/)
- [Wikipedia: Saint Basil's Cathedral](https://en.wikipedia.org/wiki/Saint_Basil%27s_Cathedral)
- [Britannica (print article)](https://www.britannica.com/print/article/516839) (1554–60, the pre-1957 dating; not fetched directly)
- [Armenian Wikipedia: Վասիլի Երանելու տաճար](https://hy.wikipedia.org/wiki/Վասիլի_Երանելու_տաճար) (the Armenian name)
