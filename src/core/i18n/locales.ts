export const LOCALES = ["en", "hy"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Text that exists in every supported locale. */
export type LocalizedText = Readonly<Record<Locale, string>>;

/** Language switcher labels. Each language is named in itself; no flags. */
export const LOCALE_META: Readonly<Record<Locale, { short: string; name: string; htmlLang: string }>> = {
  en: { short: "EN", name: "English", htmlLang: "en" },
  hy: { short: "ՀՅ", name: "Հայերեն", htmlLang: "hy" },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
