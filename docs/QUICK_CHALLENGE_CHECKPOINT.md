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

1. **400 ms feedback**: shorten the feedback after an answer to 400 ms. It is now 700 ms (correct and skipped) and 1,400 ms (wrong): `CHALLENGE_RULES.feedbackMs` in `quickChallenge.ts`.
2. **Home during a round**: ask for confirmation before leaving a round in progress, with the deadline still running while the question shows (no pause, no extra time). Now Home leaves at once and the round is lost.
3. **Final gameplay review** on real phones and desktops: tap accuracy on small countries (Slovenia, Albania, Belgium), feel and timing, both languages.

Also open, decided or deferred so far:

- The spare height under Skip on phones stays for now. A larger map needs either a start view zoomed in (cropping countries at the edges) or the data extended north.
- The relief reuses existing images: about 2.6 MB in total, loaded before Start. A dedicated whole-Europe overview would be about a tenth of that, but needs the relief generator run again.
- No keyboard or screen-reader way to answer on the map (only Skip). The lessons' Chrome and Firefox drag optimisation (the gesture copy) is not ported. Northern Britain and Ireland show flat, unshaded colours in feedback.
- Unit tests for the rules module, run with the rest of the suites.
