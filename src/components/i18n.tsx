"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { getCountry } from "@/core/content/countries";
import type { CountryId } from "@/core/content/types";
import type { Locale, LocalizedText } from "@/core/i18n/locales";
import { localize, translate, translatePlural, type MessageKey, type MessageParams, type PluralKey } from "@/core/i18n/translate";

const LocaleContext = createContext<Locale>("en");

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useI18n() {
  const locale = useContext(LocaleContext);
  return useMemo(
    () => ({
      locale,
      t: (key: MessageKey, params?: MessageParams) => translate(locale, key, params),
      tp: (key: PluralKey, count: number, params?: MessageParams) => translatePlural(locale, key, count, params),
      l: (text: LocalizedText) => localize(text, locale),
      /** Base country name. */
      name: (id: CountryId) => localize(getCountry(id).name, locale),
      /** Params for messages mentioning a country: {country} in-sentence form, {name} base form. */
      countryParams: (id: CountryId) => ({
        country: localize(getCountry(id).nameInText, locale),
        name: localize(getCountry(id).name, locale),
      }),
    }),
    [locale],
  );
}
