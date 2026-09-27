import { en } from "./messages.en";
import { hy } from "./messages.hy";
import type { Locale, LocalizedText } from "./locales";

export type MessageKey = keyof typeof en;

/** Base keys that have `.one` and `.other` plural forms. */
export type PluralKey = {
  [K in MessageKey]: K extends `${infer Base}.one` ? Base : never;
}[MessageKey];

export type MessageParams = Readonly<Record<string, string | number>>;

const catalogs: Readonly<Record<Locale, Readonly<Record<MessageKey, string>>>> = { en, hy };

function interpolate(template: string, params?: MessageParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
  );
}

export function translate(locale: Locale, key: MessageKey, params?: MessageParams): string {
  return interpolate(catalogs[locale][key] ?? en[key], params);
}

export function translatePlural(
  locale: Locale,
  key: PluralKey,
  count: number,
  params?: MessageParams,
): string {
  const form = new Intl.PluralRules(locale).select(count) === "one" ? "one" : "other";
  return translate(locale, `${key}.${form}` as MessageKey, { count, ...params });
}

export function localize(text: LocalizedText, locale: Locale): string {
  return text[locale] ?? text.en;
}

export function messageKeys(locale: Locale): string[] {
  return Object.keys(catalogs[locale]);
}
