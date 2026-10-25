import { useMemo } from "react";
import { getCountry } from "@/core/content/countries";
import { countryName } from "@/core/content/names";
import type { CountryId } from "@/core/content/types";
import type { Locale, LocalizedText } from "@/core/i18n/locales";
import { localize, translate, translatePlural, type MessageKey, type MessageParams, type PluralKey } from "@/core/i18n/translate";
import { useGame } from "../game/GameProvider";

/**
 * The text helpers of the website's useI18n (src/components/i18n.tsx), in the language of the saved game: all the
 * app's words are the website's catalogs (src/core/i18n), shared as they are.
 */
export function useI18n() {
  const locale: Locale = useGame().state.locale;
  return useMemo(
    () => ({
      locale,
      t: (key: MessageKey, params?: MessageParams) => translate(locale, key, params),
      tp: (key: PluralKey, count: number, params?: MessageParams) => translatePlural(locale, key, count, params),
      l: (text: LocalizedText) => localize(text, locale),
      /** Base country name. */
      name: (id: CountryId) => localize(countryName(id), locale),
      /** Params for messages mentioning a country: {country} in-sentence form, {name} base form. */
      countryParams: (id: CountryId) => ({
        country: localize(getCountry(id).nameInText, locale),
        name: localize(getCountry(id).name, locale),
      }),
    }),
    [locale],
  );
}
