# Quick Challenge: checkpoint (12 October 2026)

Where the Quick Challenge stands, for picking the work up on another computer.

## Implemented

- **Home card** (`src/components/QuickChallenge.tsx`): an illustrated Europe with faint country borders (`src/data/geo/europe-borders.ts`, made by `scripts/prepare-challenge-borders.mjs`), the rules (15 countries, 45 seconds) and Play, which opens the challenge. The lessons' heading under it reads "Explore the world".
- **Rules, framework-independent** (`src/core/challenge/quickChallenge.ts`): 15 different countries drawn from a pool of 30, one answer each (1 point if correct, 0 if wrong or skipped), one 45-second timer for the round, a finish after the 15th answer or at the deadline, answers after the deadline rejected, a double tap never answering two questions, and results (score, counts, missed countries with the player's wrong choices). The caller passes in time and randomness; state holds country ids only. No React, DOM, storage or timers, ready to reuse in a React Native app.
- **Screen** (`src/components/challenge/QuickChallengeScreen.tsx`): Start once the map and its relief are ready, the question with the timer and Skip, brief feedback, then results (Time's up or Challenge complete), an untimed review on the map, Play again, Back to home, and Explore Europe lessons. The round lives in memory only (`Game.tsx`): lesson progress, stars and unlocks never change. The timer keeps running through language changes, and time in the background is never given back.
- **Map** (`src/components/challenge/ChallengeMap.tsx`): the lesson map's illustrated style (its CSS classes, textures, coasts, borders, and relief from five levels' existing overviews, partitioned so none is painted twice: `Relief.tsx`). Countries outside the pool are paler all round. The view never shows past the data's edges. The zoom toolbar sits under the map on phones and over its corner on wide screens.
- **Pool and data gaps**: see "Quick Challenge countries" in `docs/DATA.md`. The UK, Ireland, Denmark and Albania were given English and Armenian names only (`src/core/content/names.ts`); Norway, Sweden, Finland and Iceland are left out (the data stops at 62°N).

## Checks run

- `npm run typecheck` and `npm run lint` (full): both clean at this commit.
- During development, on an isolated production preview: one scripted pass through the main flow on a phone-sized browser (start, correct, wrong, double tap, skip, language change mid-round, time-up and completed results, review, play again, lessons), and the rules module driven with fixed times and seeds (scratch scripts, not in the repo). Screenshots were reviewed at 390×844 and 1366×800 in both languages.
- The repository's test suites (Vitest, Playwright) were **not** run, and the rules module has no unit tests yet.

## Pending

1. ~~400 ms feedback~~ and ~~Home during a round~~: done in the commit after 9e865b4. Feedback is 400 ms for every outcome (`CHALLENGE_RULES.feedbackMs`), and the next question shows when it ends rather than at the next 100 ms tick. Home during a round opens a confirmation (`LeaveDialog` in `QuickChallengeScreen.tsx`, the level selection's dialog style): Keep playing (the default, also Escape or a tap outside) keeps the original deadline, Leave goes home, and when the time runs out (or the last answer's feedback ends) the confirmation closes and the results show. Typecheck and lint clean; checked by a scratch script on an isolated production preview (timings, double taps, the map inert behind the confirmation, time-up while it is open, both languages, 390×844 and 1366×800).
   Then, from the gameplay review (same commit): the feedback reads just Correct, Incorrect or Skipped (Ճիշտ է, Սխալ է, Բաց թողնվեց), the detail staying in Results; the confirmation shows the seconds left, live; Results put Play again, Review on the map and Explore Europe lessons under the counts, before the list (Back to home stays last); and the review centres and zooms the map on the selected country (its whole shape in about two thirds of the map, at most the map's ×6 zoom, at once with reduced motion), back to the start view when the review ends, never during a timed round (`ChallengeMap`'s `focus`). Taps by a border now answer with the country whose shape is at the press's own position (`countryAtPoint` in `ChallengeMap.tsx`, through `useCountryTap`; the lessons' maps unchanged): before, Chrome's touch adjustment could send a touch up to about 2 px inside a country to its neighbour, and a mouse press on a country's 1.4 px outline went to that country although half the outline lies over the next. Play again starts every new round at the start view (`ChallengeMap`'s `viewKey`, the round's question list); before, a desktop kept a zoom made during the last round (a phone reset only because the results hide the map). Zoom still carries between a round's questions. Remaining from that review: small countries are hard to tap on a phone without zooming (Belgium, Slovenia and Albania about 12 px across at the start view), and pinching on one can push its neighbours off screen.
2. **Final gameplay review** on real phones and desktops: tap accuracy on small countries (Slovenia, Albania, Belgium), feel and timing, both languages.

Also open, decided or deferred so far:

- The spare height under Skip on phones stays for now. A larger map needs either a start view zoomed in (cropping countries at the edges) or the data extended north.
- The relief reuses existing images: about 2.6 MB in total, loaded before Start. A dedicated whole-Europe overview would be about a tenth of that, but needs the relief generator run again.
- No keyboard or screen-reader way to answer on the map (only Skip). The lessons' Chrome and Firefox drag optimisation (the gesture copy) is not ported. Northern Britain and Ireland show flat, unshaded colours in feedback.
- Unit tests for the rules module, run with the rest of the suites.
