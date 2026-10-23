# AriMap for Android (and later iOS)

The native app lives in `apps/mobile`: React Native with Expo (SDK 58, React Native 0.88), Expo Router and TypeScript.
It is drawn natively (react-native-svg for maps), with no WebView, no login and no backend. Phase 1 is its foundation:
navigation, safe areas, theme, language selection, saved progress, and the Home and Europe level-selection screens
with the real levels. Levels are not playable in the app yet: a level opens a preview of its map and countries.

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
npx eas-cli@latest build --platform android --profile preview      # or development
adb install -r <downloaded .apk>
```

- **Only committed code is built.** `eas.json` sets `requireCommit`: EAS uploads a clone of the current commit, so
  commit first. Without it, EAS copies the working tree, skipping what `.gitignore` files ignore but not what
  `.git/info/exclude` does: on 2026-10-23 that sent local Next.js build folders (`.next-preview`, `.next-l11`,
  `.next-l12`), whose Turbopack cache held `.env.local` values, with a build. The upload is the whole repository,
  history included (about 300 MB), since the app needs `src/` from the root; `.easignore` can't trim it while
  `requireCommit` is on.
- **Install.** EAS runs `npm ci` in `apps/mobile` only (never at the root), on Node 22.22 (`eas.json`), then Metro
  bundles `src/core`, `src/geo` and `src/data` from the uploaded repository through `metro.config.js`, as locally.
- **Signing.** The Android keystore is EAS-managed (`credentialsSource: remote`), created by EAS on the first build and
  kept on Expo's servers (`npx eas-cli@latest credentials`). Development and preview builds are signed with it, so one
  installs over the other with the app's data kept. The same key would sign a production build: it would become the
  Play upload key (Play App Signing keeps the app signing key itself).
- **Size.** The preview APK is about 100 MB: one APK for all four CPU types (arm64-v8a, armeabi-v7a, x86, x86_64). The
  production AAB lets Google Play deliver each device only its own.

## Checks

```bash
cd apps/mobile
npm run typecheck    # TypeScript, including the shared src/core, src/geo and src/data it imports
npm run lint         # ESLint (eslint-config-expo)
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
    index.tsx                Home: the continents, world map, Europe's progress and stars, Continue / Explore Europe
    continent/[id].tsx       a continent's level selection (Europe's twelve levels)
    level/[id].tsx           a level: for now its map and countries (the lesson comes next)
  src/game/GameProvider.tsx  the game's state: src/core's appReducer, loaded and saved through the native store
  src/storage/nativeStorage.ts  the native KeyValueStorage (SQLite)
  src/i18n/i18n.tsx          useI18n over src/core/i18n (plus the app's own few strings, in both languages)
  src/map/                   react-native-svg maps: WorldMap (home), RegionMapView + useRegionMap (a level)
  src/theme/                 tokens (the website's palette), useReducedMotion
  src/components/            Screen (safe areas), ScreenHeader, LanguageSwitch, Button, StarTotal
```

### Shared code

The app imports the website's framework-independent code where it lives, with the same imports the website uses:
`@/core/...` (game rules, levels, content, translations, progress and its save format), `@/geo/...` (projection,
shapes, fit transforms) and `@/data/...` (prepared map data). Nothing is copied or moved:

- `metro.config.js` watches `../../src` and resolves `@/` there. Packages the shared code imports (`d3-geo`,
  `topojson-client`) resolve from the app's own `node_modules`, so the app bundles the versions in its own
  `package.json` and never depends on the website's install.
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

The saved screen and continent follow the screens (Home: `goHome`; a level selection: `openContinent`). The app
always opens on Home; the system's Back goes back one screen. Opening a level's preview starts nothing and changes no
progress.

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

- Text follows the system font size: no text has scaling turned off, and layouts wrap and grow rather than clip.
- Reduced motion (Android "Remove animations") turns off screen transitions (`useReducedMotion`); anything animated
  later must check it too.
- Touch targets are at least 48dp; buttons named by their visible label first ("Start: Around the Alps").
- Maps are decorative for screen readers: what they show is in text beside them.
- Edge to edge (required from Android 15): the header stays below the status bar and the action area above the
  navigation bar (`Screen`).

## Maps

`src/geo/regionMap.ts` already produces each country as an SVG path string in the levels' shared projected
coordinates, with the level's focus and coverage, and `fitTransform` fits them to a box. `RegionMapView` draws those
paths with react-native-svg inside one transformed group (strokes divided by the scale so they keep their width).
Levels 10–12 load their own dataset first (`loadMapData`), as on the website. The lesson map (labels, markers,
route, taps, pan and zoom, the painted relief) builds on this in the next phase.

## Google Play

SDK 58 targets Android API 36 (`targetSdk` 36, `compileSdk` 37, `minSdk` 24), which meets Google Play's current
target API requirement. The app id is `world.arimap.app` (`app.json`). Development and preview APKs are built with
EAS (above); no production build has been made and nothing has been uploaded to Google Play.

## Dependency audit

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
