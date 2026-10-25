# AriMap for Android (and later iOS)

The native app lives in `apps/mobile`: React Native with Expo (SDK 58, React Native 0.88), Expo Router and TypeScript.
It is drawn natively (react-native-svg for maps), with no WebView, no login and no backend. Phase 1 is its foundation:
navigation, safe areas, theme, language selection, saved progress, and the Home and Europe level-selection screens
with the real levels. Phase 2A made Level 1 (France and its neighbours) playable from Discover to Results with the
website's own game rules, and Phase 2B all twelve European levels ("Playing a level", below). Phase 3 adds the Quick
Challenge, as practice rounds on the phone ("Quick Challenge", below).

## Run it

Requires Node.js 22.13+ (React Native 0.88's minimum; the website needs only 20.9+), and for Android: Android Studio's SDK (platform 36 or later), an
emulator or a device with USB debugging, and JDK 17 (`JAVA_HOME`).

```bash
cd apps/mobile
npm install
npm run android      # builds the debug app, installs it on the emulator/device, starts Metro
```

`npm run android` (`expo run:android`) generates the native project in `apps/mobile/android/` (not committed: it is
regenerated from `app.json`, Continuous Native Generation) and builds it with Gradle; the first build downloads
Gradle and any missing SDK parts and takes several minutes. After that, only JavaScript changes need nothing but
Metro: `npm start`, then open the installed app (press `a` to open it on Android).

The app is meant to run as a development build, built with the native modules it uses as the Play release will be.
For a quick look without a native build, every module it uses so far is also in Expo Go: `npx expo start --go
--android` installs the matching Expo Go on the emulator and opens the app there. Expo Go is only a preview: its
window and insets at the bottom of the screen can differ from the app's own (it once reported no bottom inset while
the navigation bar covered the main action).

**Windows: native builds need long paths.** React Native's C++ build writes object files whose paths pass Windows'
260-character limit (one is 331 characters here, from `react-native-gesture-handler`, which Expo Router uses), and
the build fails with `ninja: error: Stat(...): Filename longer than 260 characters`. A shorter checkout path doesn't
save enough. The fix is long paths turned on in Windows (`LongPathsEnabled` = 1 under
`HKLM\SYSTEM\CurrentControlSet\Control\FileSystem`, administrator, then sign in again), and probably also a newer
CMake from Android Studio's SDK Manager: the default 3.22.1 bundles ninja 1.10.2, which predates ninja's long-path
support (not yet tried here). Building on macOS, Linux or WSL avoids it, and so does EAS Build (below), which builds
in the cloud on Linux.

## EAS Build (cloud builds)

The app is the EAS project `@arsmanukyan/arimap` (`app.json`: `owner`, `extra.eas.projectId`), built with the profiles in
`apps/mobile/eas.json`. Run EAS CLI from `apps/mobile`, signed in to an Expo account with access to the project
(`npx eas-cli@latest login`):

| Profile | Artifact | Use |
| --- | --- | --- |
| `development` | APK, debuggable, with the dev client (`expo-dev-client`) | Install once; then `npx expo start --dev-client` and the app loads JavaScript from Metro. Needed for native debugging, and for reading the app's data (`adb shell run-as world.arimap.app`) |
| `preview` | APK, release, the JavaScript bundled in | Install and run on its own, no Metro or Expo Go: what testers get |
| `production` | AAB (Android App Bundle) for Google Play | Configured for later; nothing has been built or submitted with it |

```bash
cd apps/mobile
npm run build:android:preview        # or build:android:development: checks the archive first, then builds
adb install -r <downloaded .apk>
```

Start builds with these scripts rather than `eas build` directly: they stop before anything is uploaded if the
archive check fails (below).

- **Install.** EAS runs `npm ci` in `apps/mobile` only (never at the root), on Node 22.22 (`eas.json`), then Metro
  bundles `src/core`, `src/geo` and `src/data` from the uploaded repository through `metro.config.js`, as locally.
- **Signing.** The Android keystore is EAS-managed (`credentialsSource: remote`), created by EAS on the first build and
  kept on Expo's servers (`npx eas-cli@latest credentials`). Development and preview builds are signed with it, so one
  installs over the other with the app's data kept. The same key would sign a production build: it would become the
  Play upload key (Play App Signing keeps the app signing key itself).
- **Size.** The preview APK is about 130 MB (19 MB of it the landmark pictures, 2 MB the Quick Challenge's card template): one APK for all four CPU types (arm64-v8a, armeabi-v7a, x86, x86_64). The
  production AAB lets Google Play deliver each device only its own.

### What EAS uploads

Every cloud build uploads a project archive to Expo. Two rules decide what is in it, read from EAS CLI 25.3's own code
(`makeShallowCopyAsync`), which differs from Expo's archive page:

1. **Only committed files** (`apps/mobile/eas.json`: `cli.requireCommit`). EAS CLI refuses to build while `git
   status` shows any change, untracked files included, then makes the archive from `git clone --depth 1` of the
   commit. The working tree is never copied, so ignored or excluded local files (env files, Next.js build folders and
   caches, keystores) can't be included.
2. **Only what the app builds from** (`.easignore`, at the repository root, where EAS CLI reads it). From the clone it
   deletes every file matching its rules: an allowlist keeping `apps/mobile` and `src/core`, `src/geo` and `src/data`
   only, the landmark pictures (`src/assets/landmarks/*.webp`, the forty the levels show; not their thumbnails) and the
   Quick Challenge's share card template (`public/images/share/quick-challenge-postcard-template-v2.png`, that one file of
   `public/`), then a deny
   list (Git data, env files, credentials and keys, installed packages, generated native projects,
   build output and caches, logs, temporary files, the shared code's tests). It also removes the clone's `.git`, so no
   history is uploaded. With `requireCommit` off, `.easignore` would replace every `.gitignore` for the working-tree
   copy, which is why its deny list repeats them.

The website (`public/`, `e2e/`, `supabase/`, `scripts/`, `docs/`, its configs) never leaves the machine with a build.
Measured with `eas build:inspect` (2026-10-24): 92 files, 2.9 MB, against 1,647 files and 314 MB (153 MB of it `.git`)
before. A clean `npm ci` and an Android bundle made inside that archive alone bundle the same 1,471 modules as a cloud
build; the website's folders remain only as empty directories. With every level's landmark pictures (2026-10-25): 151
files, 21.6 MB, 18.6 MB of it the pictures. With the Quick Challenge (2026-10-25): the card template (2.2 MB) and the
challenge's map data are in as well.

**Check before every build.** `npm run check:archive` (`apps/mobile/scripts/check-eas-archive.mjs`) runs `eas
build:inspect --stage archive`, which makes the archive exactly as a build does (the same code) in a local folder and
uploads nothing, then fails if:

- a file is outside `apps/mobile`, `src/core`, `src/geo` or `src/data`, other than the landmark pictures the app
  bundles (read from `apps/mobile/src/components/landmarkImages.ts`, each of which must be there: a picture added to
  the website and not to the app fails the check until it is listed there), and the share card template it requires
  (read from `apps/mobile/src/challenge/ShareCard.tsx`);
- a file is forbidden anywhere (Git data, env files, credentials, keys and certificates, website build output or
  caches, installed packages, the generated `android/` or `ios/`, Expo or Metro caches, logs, temporary files, tests);
- a file the build needs is missing (`package.json`, the lockfile, `app.json`, `eas.json`, the Metro config, the
  entry, and the shared code's storage, translations, levels, projection and all four map datasets);
- a text file holds a secret-shaped string (a Supabase secret key, a private key block, a JSON Web Token, an AWS key,
  an assignment to a `…SECRET…`, `…SERVICE_ROLE…`, `…PRIVATE_KEY…`, `…PASSWORD…` or `…TOKEN…` name);
- any value (12+ characters) from a local `.env` file (repository root or `apps/mobile`, not `.env.example`) appears
  in any file, binary ones included.

It reports only rule names, variable names and paths, never a value. `npm run build:android:preview` and
`build:android:development` run it first. To look at an archive yourself:

```bash
cd apps/mobile        # commit first
npx eas-cli@latest build:inspect --platform android --profile preview --stage archive --output <empty folder>
node scripts/check-eas-archive.mjs --dir <that folder>
```

**Why (2026-10-23).** The first cloud build ran without `requireCommit`. EAS CLI then copies the working tree,
honouring `.gitignore` files but not `.git/info/exclude`, where the local Next.js build folders (`.next-preview`,
`.next-l11`, `.next-l12`) were excluded. They were uploaded, and `.next-preview`'s Turbopack cache held the values of
`.env.local`, including `SUPABASE_SECRET_KEY` and `VERCEL_AUTOMATION_BYPASS_SECRET`. The build was cancelled and
deleted, and both credentials have since been rotated and the old values revoked. The root `.gitignore` now ignores every `.next-*` folder too.

**The app holds no secret.** It has no backend, no Supabase client and no environment variables (`process.env`,
`EXPO_PUBLIC_…`): the bundle contains only the app's code and the shared game code, and the release APK's bundle was
checked for every local env value and for secret-shaped strings (none). A Supabase secret key (`sb_secret_…`, or the
legacy `service_role` key) must never be given to the app in any form: anything in an app can be read out of it. When
the app talks to the backend (Quick Challenge, later), it uses the publishable key and the player's own session, as the
website does.

## Checks

```bash
cd apps/mobile
npm run typecheck    # TypeScript, including the shared src/core, src/geo and src/data it imports
npm run lint         # ESLint (eslint-config-expo)
npm test             # Vitest: the map's camera, gestures, picking and labels, the level cards, and every level
                     # played through the shared rules on its real map at phone sizes; the Quick Challenge's
                     # rounds, clock and results on clocks the tests move (src/**/*.test.ts; the repository's
                     # Vitest, vitest.config.mts)
npm run doctor       # expo-doctor: SDK version alignment and config
```

The website's own checks (`npm run typecheck`, `npm run lint`, `npm test`, `npm run build` at the repository root)
don't include `apps/` (root `tsconfig.json` excludes it; `eslint.config.mjs` ignores it).

## Structure

```
apps/mobile/                 a project of its own: package.json, package-lock.json, node_modules
  app.json                   name, ids (world.arimap.app), icons, plugins; the source of the native projects
  metro.config.js            shares ../../src with the bundler (see "Shared code")
  src/app/                   Expo Router routes (every file is a screen)
    _layout.tsx              the stack, providers, status bar, reduced motion
    index.tsx                Home: the Quick Challenge, the continents, world map, Europe's progress and stars,
                             Continue / Explore Europe
    challenge.tsx            the Quick Challenge: ready screen, round, Results, review on the map
    continent/[id].tsx       a continent's level selection (Europe's twelve levels), with the website's card actions
    level/[id].tsx           a level, played from Discover to Results (LessonScreen)
  src/lesson/                a level in play: LessonScreen (map + panel), DiscoverPanel, FindPanel, TravelPanel,
                             ResultsPanel, Panel (scrolling content, pinned main action), StepsBar and Stars (parts),
                             confirmRestart (Start over / Play again asks first)
  src/challenge/             the Quick Challenge: clock.ts (its timer), session.ts (a round saved as it plays),
                             useChallenge (the round on screen), ChallengeMap, results.ts (Results' colours, names and
                             lesson links), ShareCard and ShareResult (the result card, and Android's share sheet)
  src/game/GameProvider.tsx  the game's state: src/core's appReducer, loaded and saved through the native store
  src/game/levelActions.ts   a level card's actions (the website's rules: Continue, View results, Start over, Play again)
  src/game/pressGuard.ts     ignores a second gameplay press within 400 ms
  src/storage/nativeStorage.ts  the native KeyValueStorage (SQLite)
  src/i18n/i18n.tsx          useI18n over src/core/i18n, and the app's own few words (practice rounds), both languages
  src/map/                   react-native-svg maps: WorldMap (home), and LessonMap (a level in play) with useRegionMap
                             (its map data), camera.ts (zoom and pan limits), gesture.ts (tap or drag), pick.ts (the
                             country under a tap, small-country rings), labels.ts (where names go), and what both
                             maps share: useMapGesture (touches to pan, pinch or tap) and MapControls (the zoom buttons)
  src/theme/                 tokens (the website's palette, and its map's), useReducedMotion, textWidth (will a word fit)
  src/components/            Screen (safe areas), ScreenHeader, LanguageSwitch, Button, StarTotal, landmarkImages
```

### Shared code

The app imports the website's framework-independent code where it lives, with the same imports the website uses:
`@/core/...` (game rules, levels, content, translations, progress and its save format), `@/geo/...` (projection,
shapes, fit transforms) and `@/data/...` (prepared map data). Nothing is copied or moved:

- `metro.config.js` watches `../../src` and resolves `@/` there. Packages the shared code imports (`d3-geo`,
  `topojson-client`) resolve from the app's own `node_modules`, so the app bundles the versions in its own
  `package.json` and never depends on the website's install. It also watches `../../public/images/share`, for the
  Quick Challenge's card template (required as `@/../public/…`).
- `tsconfig.json` maps the same paths for type checking (Expo's own tsconfig-paths resolution is turned off in
  `app.json` so that Metro follows `metro.config.js` alone).

The repository root is not an npm workspace on purpose: the website and the app pin different React versions (React
Native's own), and keeping their installs apart leaves the website's `package.json`, lockfile and build untouched.
Shared code must therefore stay framework-independent (no React, DOM, Next.js or React Native), as `src/core` already
is. Code for the website's UI (`src/components`, `src/web`, `src/app`) is never imported by the app.

### Saved progress

The same save as the website's (README, "Saved progress"): key `arimap:state`, version 2, read, validated and
migrated by `src/core/progress/storage.ts`, here in a SQLite key-value store (`expo-sqlite/kv-store`, file
`arimap-progress.db` in the app's data). Its synchronous calls match `KeyValueStorage`, so the save is read before the
first screen renders and every new state is saved as it is made. Progress on the website and in the app are separate
(no account or backend).

The saved screen and continent follow the screens (Home: `goHome`; a level selection: `openContinent`; a level:
`openLevel`, which opens it where it was left). The app always opens on Home; the system's Back goes back one screen.

### Navigation

Screens navigate with `useRouter()` from `expo-router`, never its global `router` (ESLint rejects importing it). A
system font size or display size change recreates Android's activity (they are not in its `configChanges`; rotation,
resizing and language are), and React mounts the app again: Expo Router binds its global `router` as the new tree
mounts, and the old tree's unmount then resets it, so every later `router.push` threw ("The imperative router is
unavailable before the first render has finished") and closed the app. `useRouter()` is bound to its own tree. Such a
change still reopens the app on Home (the navigation stack is the activity's); the save is unaffected.

### Language

English and Eastern Armenian, from `src/core/i18n`. A first launch takes the device's language when it is one of
these (otherwise English); after that it is the player's choice in the header, saved with the game. Text is drawn in
the system font (Android has Armenian in Noto Sans Armenian); the website's Nunito is not bundled yet.

### Accessibility

- Text follows the system font size: no text has scaling turned off, and layouts wrap and grow rather than clip. With large text the header puts the language switch on a row of its own
  rather than break a word, and the lesson's map takes less of the height. Map names grow a little (to 1.35×). Travel's
  cards go one a row, and buttons sharing a row wrap, where a word wouldn't fit (Armenian at 200% on a 360dp phone).
- Reduced motion (Android "Remove animations") turns off screen transitions (`useReducedMotion`) and the fade of
  Find's answer outline; anything animated later must check it too.
- Touch targets are at least 48dp; buttons named by their visible label first ("Start: Around the Alps").
- The home map is decorative for screen readers: what it shows is in text beside it. The lesson map's countries are
  targets of their own ("Playing a level").
- Edge to edge (required from Android 15): the header stays below the status bar and the action area above the
  navigation bar (`Screen`).

## Playing a level

Every European level is played as on the website, by the website's own rules: nothing about answers, scoring, stars,
unlocking or saving is written again for the app, and nothing in the app is particular to one level: what differs
between levels is in their definitions (`src/core/lessons`), read by the same screens.

- **Shared, used as they are.** The lesson reducer (`src/core/lesson/progress.ts`: Discover, Find, Travel, Results)
  through `appReducer`'s `lesson` action; Find's questions, hints and answers (`src/core/game/find.ts`); Travel's
  moves, crossings, Undo, Restart and dead ends (`src/core/game/travel.ts`, `graph.ts`); the star rating and its "next
  star" (`src/core/lesson/rating.ts`); what the map shows at each moment (`buildMapView`, `src/core/lesson/mapView.ts`:
  tones, names, markers, the route, Find's hint circle, the latest answer); level status, unlocks, Continue and Next
  level (`src/core/progress/appState.ts`); the save (`storage.ts`); the text (`src/core/i18n`, both languages); the
  geometry (`src/geo/regionMap.ts`, `route.ts`), and the point-in-country test (`src/geo/hitTest.ts`, moved there from
  the website's `src/components/map/insideShape.ts`, which keeps only its canvas fallback for curves).
- **Native.** The screens (`src/lesson/`), the map in play (`src/map/LessonMap.tsx`) and what only a phone needs: how
  a touch becomes a tap, a drag or a pinch, which country a tap is on, where names go, and the press guard.
- **Welcome** is the level selection, as on the website (its WelcomeScreen): each card's title, description,
  countries, status and steps, and its actions by the website's rules (`levelActions.ts`): Start; Continue with Start
  over (or Play again, once completed) beside it; View results with Play again. Start over and Play again ask first
  (Android's dialog, keeping being the default; Back keeps too) and then clear only that level's place.
- **Find** is one round of five questions, as the website plays it now (its earlier two-round Find survives only as a
  save format it migrates). Travel's moves are the neighbour cards, as on the website: the map shows the route and
  never takes a move.
- **Taps and gestures.** A tap answers only when it is one (`gesture.ts`, the website's rule: one finger, down and up
  within 10 px and 700 ms), on the country under the finger where the press began and ended (`pick.ts`: the level's
  countries first, as they are drawn over the faded ones; a tap on the sea within 8 px of a coast takes that country, as
  a browser moves a touch to a nearby target).
- **Countries too small to tap.** In Discover and Find, Luxembourg and Andorra get the Quick Challenge's small-country
  rings (`src/core/challenge/smallCountries.ts`, its `RING_COUNTRIES`) while drawn smaller than one: a 24 px dashed
  ring at the country, answered by a press anywhere in it, shown whatever is asked so it never points to an answer. The
  ring's area test uses the shared `outlineArea` (`src/geo/hitTest.ts`). Zoomed in, the country is tapped as any other.
- **What differs between levels**, all from their definitions: travel-only neighbours offered as moves and drawn in
  Travel (Levels 4, 8, 10 and 11); a non-neighbour shown among the cards, which moves nothing and says so (Level 7's
  France, Level 12's Finland); fixed links crossed as borders (Level 10's Øresund, Level 11's Channel Tunnel); Iceland,
  learned but never reached (Level 10); Travel's own note; map data of their own (Levels 10–12, handed to the shared
  code by `useRegionMap`'s inline requires, since Metro's development server can't serve their `import()` from outside
  `apps/mobile`); Russia framed by its western part (Level 12); the routes' turning points and bridges; and Level 6's
  and Level 4's earlier version and journey, kept by an attempt made on them. Dragging and pinching move the map within the website's limits
  (`camera.ts`: from the start view to 8× it, panned within `viewLimits`, d3-zoom's constraint); +, − and "Show the
  whole map" do the same with buttons. While a finger is on the map nothing else takes the gesture. Each stage starts
  at the whole map.
- **Repeated presses.** The rules ignore a repeated action (a second Next, a second move into the same country, an
  answer after the question is answered); a second gameplay press within 400 ms is ignored too (`pressGuard.ts`), so a
  double tap can't land on the button that has just replaced the first (Next on Hint, a new neighbour card).
- **Leaving and coming back.** Every action is saved as it is made. The header's "Back to levels" (and Results') leads
  to the level's continent at any point, also for a level continued from Home; Android's Back goes to the previous
  screen. Continue resumes the same question or route, also after the app is closed or Android
  recreates it (which reopens it on Home, see "Navigation"). Nothing is completed or rated before the journey arrives.
  If the save can't be read as the app starts, the game is played in memory and never saved over it.
- **Screen readers.** Each of the level's countries is a target where its name is drawn, named as the website names it
  (unnamed in Find, "Country on the map", where the name would give the answer away), and activated to answer; the
  panels announce answers and moves (live regions). The zoom buttons are named.

### Differences from the website

- The map has no painted relief, forests or scenery, and no magnified close-up (Levels 1, 7, 10 and 11 have one on the
  website): it is the flat palette, with Luxembourg and Andorra named in a callout beside them, ringed while too small
  to tap. Pinch to zoom in.
- Names are placed more simply: at each country's label point, else the nearest clear place (a line or two up or down,
  or a little sideways) clear of markers, other names and the zoom buttons; a name that finds none on its own country
  goes in a callout with a leader to it, as a small country's always does. The website's full layout (leader placement
  around obstacles, two-line callouts such as Level 9's North Macedonia, capital and landmark names on the map) is not
  ported: capitals and landmarks are marked on the map and named in the panel.
- The route line appears at once (no drawing along, no landing pin or arrival glow); Find's answer outline fades out
  (held, then gone, with reduced motion); Results' star doesn't pop.
- Start over and Play again ask in Android's own dialog, not the website's styled one.

### Travel states with a single choice

Audited over every state each level's journey can reach by its cards (`apps/mobile/src/game/levels.test.ts` checks
it): in the current journeys a single card appears only where the route has already left every shortest route, with
one crossing left and the destination out of reach, so that card, like any, runs the crossings out:

| Level | Route so far | The one card |
| --- | --- | --- |
| 4 | Montenegro → Croatia → Bosnia and Herzegovina; Montenegro → Serbia → Bosnia and Herzegovina | Serbia; Croatia |
| 5 | Hungary → Romania → Serbia; Hungary → Serbia → Romania | Bulgaria |
| 6 | Poland → Belarus → Lithuania; Poland → Lithuania → Belarus | Latvia |
| 7 | Portugal → Spain → Andorra | France |

There the meaningful choices are Undo and Restart, which the panel offers below the card. No state on a shortest route
has a single choice. Two older versions do: an attempt saved on Level 4's earlier journey (Italy → Montenegro) starts
with Slovenia alone, and one on Level 6's first version (Germany → Estonia) has one card at every step; new attempts
and Play again never use them. Changing this is the website's rules' call, not the app's: ways that keep the rules
honest would be ending such a journey as soon as the destination can no longer be reached (a rule change, for every
level), or a travel-only real neighbour (`travelOnly`, as Level 10's Germany) where one adds a choice without a shorter
route. Invented neighbours, or cards narrowed to winning moves, are not.

## Quick Challenge

The website's Quick Challenge (`src/core/challenge`, `src/components/challenge`): find 15 countries on an unlabelled
map of Europe against one timer, one answer each, then Results, a review on the map and a shared result card.

**Rules: the website's, as they are.** `CHALLENGE_RULES` and `CHALLENGE_POOL` (`src/core/challenge`): 15 countries,
**60 seconds**, 400 ms of feedback after each answer, drawn from a pool of **40** (Europe's 44 M49 countries and
Kosovo, less Malta, Liechtenstein, San Marino, Monaco and Vatican City). The Phase 3 brief asked for 45 seconds and a
pool of 30: those were the challenge's first rules (12 October 2026), changed on 13 October 2026 to 60 seconds and 40
countries, as recorded in `docs/QUICK_CHALLENGE_CHECKPOINT.md`, `docs/DATA.md` and `docs/QUICK-CHALLENGE-SHARING.md`
and enforced by the website's server. The owner chose the current rules for the app (2026-10-25), so its rounds,
Results and cards match the website's and no rule is duplicated.

**Practice rounds, on the phone alone (the owner's decision, 2026-10-25).** On the website the server runs every
round: an anonymous Supabase session; one free attempt a day (and bonus attempts for all 36 stars); questions drawn
by the server; answers received and scored on the database's clock, with a 1-second allowance and the 400 ms rhythm
enforced; results confirmed, then ranked on the leaderboard under a saved name; and no practice rounds (docs/PLAYER-
BACKEND.md, "Rounds"). The server is there to prevent manipulation of ranked results and to ration attempts, not to
play the round: the device already plays it by the same shared rules for its immediate feedback. The app's rounds
are practice: drawn on the phone (`createChallenge`), played and scored by the same shared code, unlimited (Play
again), offline, never sent anywhere and never ranked; the screens say so. The app has no session, no key and no
network code for it. Ranked rounds would reuse the website's `/api/challenge` routes with the publishable key and an
anonymous session, as the website does: a later phase.

**The timer** (`src/challenge/clock.ts`). The shared rules take any clock that never runs backwards; the round starts
at 0 on the app's, so its deadline is the duration. Each reading adds the larger of two clocks' advances since the
last: `performance.now` (monotonic: changing the phone's date, time or zone doesn't move it) and `Date.now` (which
runs on while the phone sleeps). So the background, sleep, and setting the clock back (alone or in turn) gain no time;
setting it forward only costs the player.

- **Nothing runs before Start**, and Start is enabled only once the map is drawn.
- **Saved as it plays** (`session.ts`: `arimap:practice` in the app's SQLite store, apart from the lessons' save):
  the round, and its clock's time with the wall clock's then. Leaving the screen (asked first), Home, the app going
  to the background, Android recreating it (a font size change) or closing it: the round carries on against the same
  deadline, and opens where it was, or on its Results if its time ran out meanwhile. A round opened after the app was
  closed adds the wall clock's advance since (never less than nothing).
- **Ends once**: the 15th answer or the deadline (`tick`, as often as every 100 ms, and at once when the app comes to
  the foreground); a later tick changes nothing. Answers after the deadline, a second tap while the feedback shows (a
  double tap), and a tap on a country outside the pool are no answers (`answer`). The countdown shown is the round's
  own time left, redrawn when its second changes.
- Nothing is submitted anywhere, so there is no duplicate submission to prevent; an ended round's Results are made
  from its saved answers each time, never counted twice.

**Screens** (`src/app/challenge.tsx`): Home's card (the website's: the rules and Play). The ready screen: the
challenge, its rules, the practice note and Start, under the map. The round: the question, score and seconds left
(kept in view), the country to find, the last answer's feedback in words with an icon (Correct, Incorrect, Skipped:
✓ ✗ ↷), and Skip. Results: time's up or complete, the score of 15, the time used (a completed round), the counts,
Share result, Play again, Review on the map, Explore Europe lessons, then the countries to practise, each with what was
chosen (or skipped, or not reached) and a link to the first level that teaches it (every country the challenge asks
has one), and Back to home. The review: each of the round's countries, found or missed, zoomed to and outlined on the
map. Back during a round asks first ("Keep playing", the default, or "Leave"); leaving an ended round clears it.

**The map** (`src/challenge/ChallengeMap.tsx`): the website's challenge map (`src/geo/challengeMap.ts`, its data
file handed over by an inline require, as Levels 10–12's) and its start view (`challengeCamera.ts`: Europe with
every small-country ring whole) to six times it. The lesson map's gestures and buttons (`useMapGesture`,
`MapControls`), picking (`pick.ts`, pool countries only) and the shared small-country rings (Luxembourg, Andorra).
At the start view Belgium lies mostly inside Luxembourg's ring, as on the website, so a press there answers
Luxembourg: zoom in to tap Belgium (the website's own phone review notes Belgium, Slovenia and Albania are about 12 px
across there). Results and the review name the round's countries (the missed first), each only where it overlaps no
other name, ring or button, as the website's map does.

**Sharing** (`src/challenge/ShareCard.tsx`, `ShareResult.tsx`): the website's card, the same template, places and
sizes (`src/core/challenge/shareCardLayout.ts`, moved there from the website's `shareCard.ts` for both to read), the
same words (`share.ts`) and QR code (`qrCode.ts`, moved to `src/core/challenge` from the website's components), drawn
as an SVG. Share image captures it at 1080 × 1350 (`react-native-view-shot`) and opens Android's share sheet with the
PNG (`expo-sharing`); Share as text sends the website's share message (React Native's Share). Only the score, the
round's size and its time are on it: practice rounds have no name. Closing the share sheet shows nothing; Android
doesn't say whether anything was shared, so nothing claims it was.

**Accessibility.** For screen readers the map is one image, named as the website names it ("Map of Europe without
country names"): answering needs the map, as on the website, and naming the countries would give the answers away.
Skip, the feedback (a live region), the seconds left (a timer), Results, the review's chips (each "found" or "missed")
and the card's description are all words. Colour is never the only cue (icons and words beside every tone). Large text:
the round's status stays in view, the counts and buttons wrap rather than clip. Reduced motion: nothing moves but
the map under the player's own fingers.

## Maps

`src/geo/regionMap.ts` produces each country as an SVG path string in the levels' shared projected coordinates, with
the level's focus and coverage. The lesson map (`LessonMap`) starts at the website's start view (`viewLimits`) and draws the countries in one transformed group with
non-scaling strokes, so moving the map changes only that group's transform. Names, markers, the route and the hint
circle are drawn on screen over it, at fixed sizes. Levels 10–12 are drawn from datasets of their own, which the app
hands to the shared code when such a level opens (`useRegionMap`).

## Google Play

SDK 58 targets Android API 36 (`targetSdk` 36, `compileSdk` 37, `minSdk` 24), which meets Google Play's current
target API requirement. The app id is `world.arimap.app` (`app.json`). Development and preview APKs are built with
EAS (above); no production build has been made and nothing has been uploaded to Google Play.

## Dependency audit

Since 2026-10-25 a fifth high-severity finding: [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)
in `zod` before 4.6.6 (memory exhaustion validating oversized constrained collections), from `@expo/cli` and
`eslint-plugin-react-hooks`: development tools only, never in the app, and no input of the player's reaches them.
The Quick Challenge's two new packages (`expo-sharing`, `react-native-view-shot`) bring no finding.

`npm audit` in `apps/mobile` reports 4 high-severity findings (checked 2026-10-23). They are one advisory,
[GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv) in `node-forge` (RSA PKCS#1 v1.5 signature
verification accepts forged signatures with crafted DigestAlgorithm bytes and low-exponent keys; all versions up to
1.4.0, the latest, with no patched release), counted again for each package that leads to it: `node-forge` ←
`@expo/code-signing-certificates` ← `@expo/cli` ← `expo`.

- **Where it runs.** Only in Expo's command-line tools on the developer's machine (`@expo/cli`: signing development
  update manifests, and reading iOS signing certificates for `expo run:ios`). It is never bundled into the app: the
  APK's JavaScript is the app's own code and its runtime packages.
- **Exploitability for AriMap.** Low: it would take someone feeding a forged signature to the local CLI's
  verification. The app doesn't use EAS Update code signing, where the CLI checks such signatures.
- **No safe upgrade exists.** npm's suggested fix (`expo@44.0.6`) is a downgrade of 14 SDK versions; don't run
  `npm audit fix --force`. When `node-forge` publishes a fixed version, an Expo patch release (`npx expo install
  --fix`), or an `overrides` entry for `node-forge` in `apps/mobile/package.json`, picks it up.

The website's own `npm audit` is unaffected (its packages are separate).
