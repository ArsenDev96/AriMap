// The app's entry point: what the shared code needs from the JavaScript engine, then Expo Router.
//
// Hermes has no Intl.PluralRules, which src/core/i18n/translate.ts uses to choose "1 level" / "2 levels" (and the
// Armenian forms). FormatJS's polyfill is forced (its detection is slow on Android), with the rules of the two
// languages AriMap speaks; Intl.getCanonicalLocales and Intl.Locale, which it needs, only where they are missing.
import "@formatjs/intl-getcanonicallocales/polyfill.js";
import "@formatjs/intl-locale/polyfill.js";
import "@formatjs/intl-pluralrules/polyfill-force.js";
import "@formatjs/intl-pluralrules/locale-data/en.js";
import "@formatjs/intl-pluralrules/locale-data/hy.js";

import "expo-router/entry";
