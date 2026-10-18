import { eventParams, screenPath, type AnalyticsEvent, type ScreenView } from "@/core/analytics/events";
import type { Locale } from "@/core/i18n/locales";
import { SITE_URL } from "@/core/site";

/**
 * Google Analytics 4 in the browser, with the player's consent (src/core/analytics/events.ts says what is sent;
 * docs/ANALYTICS.md). Basic consent: until the player accepts, Google's script is not loaded and nothing is sent,
 * and nothing done before is kept to send later. Only on the production site: localhost and Vercel Previews never
 * send. Advertising features, Google Signals and User-ID stay off. If the script is blocked or fails to load, or
 * anything here throws, the game goes on as it was.
 */

const MEASUREMENT_ID = "G-ZNRVQKQXKJ";
/**
 * The only host that sends: the canonical site, exactly (src/core/site.ts). Not localhost, Vercel Previews, the
 * earlier ari-map.vercel.app or a www. form.
 */
const PRODUCTION_HOST = new URL(SITE_URL).hostname;

export type AnalyticsConsent = "granted" | "denied";

const CONSENT_KEY = "arimap:analytics-consent";
/** Keys of round events already handled on this device (sent, or not sendable then): each round's once. */
const ONCE_KEY = "arimap:analytics-once";
const ONCE_KEPT = 40;

type Gtag = (...args: unknown[]) => void;
/** The page's window, with what Google's tag keeps on it: its data layer, `gtag`, and its own off switch. */
type GtagWindow = { dataLayer?: unknown[]; gtag?: Gtag } & Record<string, unknown>;
const tagWindow = () => window as unknown as GtagWindow;

// --- Consent: the player's choice, kept on the device; null until they make one.

let consent: AnalyticsConsent | null | undefined;
const listeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readStoredConsent(): AnalyticsConsent | null {
  try {
    const value = storage()?.getItem(CONSENT_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

/**
 * The choice in force. Read once, then kept up to date, whatever the page shows: a choice made in another tab
 * applies here at once (on any screen, whether or not the panel is showing).
 */
export function analyticsConsent(): AnalyticsConsent | null {
  if (consent === undefined) {
    consent = readStoredConsent();
    window.addEventListener("storage", onStorage);
  }
  return consent;
}

/** For useSyncExternalStore: the choice, made here or in another tab. */
export function subscribeConsent(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Another tab's choice (or its storage cleared). */
function onStorage(e: StorageEvent) {
  if (e.key === CONSENT_KEY || e.key === null) applyConsent(readStoredConsent());
}

export function setAnalyticsConsent(choice: AnalyticsConsent): void {
  try {
    storage()?.setItem(CONSENT_KEY, choice);
  } catch {
    // Kept for this visit only.
  }
  applyConsent(choice);
}

function applyConsent(choice: AnalyticsConsent | null) {
  consent = choice;
  if (choice === "granted") start();
  else stop();
  listeners.forEach((listener) => listener());
}

// --- Sending: only with consent, on the production site.

let loaded = false;

function sending(): boolean {
  return analyticsConsent() === "granted" && window.location.hostname === PRODUCTION_HOST;
}

function gtag(...args: unknown[]) {
  try {
    tagWindow().gtag?.(...args);
  } catch {
    // Analytics never stops the game.
  }
}

/** Loads Google's tag, once a visit, when the first event is sent (with consent, on the production site). */
function load() {
  const w = tagWindow();
  w[`ga-disable-${MEASUREMENT_ID}`] = false;
  if (loaded) return gtag("consent", "update", { analytics_storage: "granted" });
  loaded = true;
  try {
    w.dataLayer = w.dataLayer ?? [];
    // gtag.js reads each call's own `arguments` object from the data layer: an array is not read.
    w.gtag = function () {
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer!.push(arguments);
    };
    gtag("consent", "default", { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "granted" });
    gtag("js", new Date());
    // Page views are sent by the app, one per screen (trackScreen): none automatic.
    gtag("config", MEASUREMENT_ID, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false });
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
    document.head.append(script);
  } catch {
    // Blocked or failed: nothing is sent, and the game goes on.
  }
}

/** Consent given: the screen showing now is sent (the tag loads with it). Never a screen or action from before. */
function start() {
  if (screen && sending()) sendScreen(screen.view, screen.locale);
}

/** Stops sending at once, and removes Google Analytics' cookies from this site. */
function stop() {
  const w = tagWindow();
  if (loaded) {
    gtag("consent", "update", { analytics_storage: "denied" });
    w[`ga-disable-${MEASUREMENT_ID}`] = true;
  }
  sentScreen = null;
  try {
    for (const name of document.cookie.split(";").map((c) => c.split("=")[0].trim())) {
      if (name !== "_ga" && !name.startsWith("_ga_")) continue;
      for (const domain of ["", `; domain=${window.location.hostname}`, `; domain=.${window.location.hostname}`]) {
        document.cookie = `${name}=; max-age=0; path=/${domain}`;
      }
    }
  } catch {
    // No cookies to remove.
  }
}

/** Sends one event, now, or nothing (no consent, not the production site): never kept to send later. */
export function track(event: AnalyticsEvent, locale: Locale): void {
  if (!sending()) return;
  if (!loaded || tagWindow()[`ga-disable-${MEASUREMENT_ID}`]) load();
  const { name, params } = eventParams(event, locale);
  gtag("event", name, event.name === "page_view" ? { ...params, page_location: `${window.location.origin}${screenPath(event.view)}` } : params);
}

/**
 * A round's event, once on this device: the round's id is the key (kept here, never sent). Handled even when it
 * can't be sent, so a result restored later, after consent, is not counted again as new.
 */
export function trackOnce(key: string, event: AnalyticsEvent, locale: Locale): void {
  try {
    const store = storage();
    const done: string[] = JSON.parse(store?.getItem(ONCE_KEY) ?? "[]");
    if (!Array.isArray(done) || done.includes(key)) return;
    store?.setItem(ONCE_KEY, JSON.stringify([...done, key].slice(-ONCE_KEPT)));
  } catch {
    // Without storage: sent as it happens.
  }
  track(event, locale);
}

// --- Screens: one page view as each opens (the app changes screens without changing its address).

/** The screen showing now (only the latest: never a list), and the last one sent. */
let screen: { view: ScreenView; locale: Locale } | null = null;
let sentScreen: string | null = null;

export function trackScreen(view: ScreenView, locale: Locale): void {
  screen = { view, locale };
  if (sending()) sendScreen(view, locale);
}

function sendScreen(view: ScreenView, locale: Locale) {
  const key = screenPath(view);
  if (key === sentScreen) return;
  sentScreen = key;
  track({ name: "page_view", view }, locale);
}
