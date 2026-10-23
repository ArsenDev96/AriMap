import { useMemo } from "react";
import { getCountry } from "@/core/content/countries";
import { countryName } from "@/core/content/names";
import type { CountryId } from "@/core/content/types";
import type { Locale, LocalizedText } from "@/core/i18n/locales";
import { localize, translate, translatePlural, type MessageKey, type MessageParams, type PluralKey } from "@/core/i18n/translate";
import { useGame } from "../game/GameProvider";

/**
 * The app's own text, for what the website has no words for (yet), in both languages. Everything else is the
 * website's catalogs (src/core/i18n), shared as they are.
 */
const APP_TEXT = {
  // Until the levels are playable in the app (the next phase): the level's map and countries are shown instead.
  levelPreviewNote: {
    en: "Playing this level in the app is coming soon. Here are its map and countries.",
    hy: "Այս մակարդակը հավելվածում խաղալու հնարավորությունը շուտով կավելանա։ Ահա նրա քարտեզն ու երկրները։",
  },
} as const satisfies Record<string, LocalizedText>;

export type AppTextKey = keyof typeof APP_TEXT;

/** The text helpers of the website's useI18n (src/components/i18n.tsx), in the language of the saved game. */
export function useI18n() {
  const locale: Locale = useGame().state.locale;
  return useMemo(
    () => ({
      locale,
      t: (key: MessageKey, params?: MessageParams) => translate(locale, key, params),
      tp: (key: PluralKey, count: number, params?: MessageParams) => translatePlural(locale, key, count, params),
      l: (text: LocalizedText) => localize(text, locale),
      app: (key: AppTextKey) => localize(APP_TEXT[key], locale),
      /** Base country name (also for countries of levels not playable yet). */
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
