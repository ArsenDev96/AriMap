import { useMemo } from "react";
import { getCountry } from "@/core/content/countries";
import { countryName } from "@/core/content/names";
import type { CountryId } from "@/core/content/types";
import type { Locale, LocalizedText } from "@/core/i18n/locales";
import { localize, translate, translatePlural, type MessageKey, type MessageParams, type PluralKey } from "@/core/i18n/translate";
import { useGame } from "../game/GameProvider";

/**
 * The app's own text, for what the website has no words for, in both languages: the Quick Challenge's practice rounds,
 * which the website doesn't have (docs/MOBILE.md, "Quick Challenge"). Everything else is the website's catalogs
 * (src/core/i18n), shared as they are. The Armenian follows the website's terms for the same things.
 */
const APP_TEXT = {
  // The challenge's ready screen and Results: what a practice round is.
  practiceNote: {
    en: "Practice round: play as often as you like. Your results stay on this phone and don't go on the leaderboard.",
    hy: "Մարզական խաղ․ խաղա որքան ուզես։ Արդյունքներդ մնում են այս հեռախոսում և չեն հայտնվում առաջատարների ցուցակում։",
  },
  // Leaving during a round: the website's challengeLeave.text, without its spent attempt (a practice round spends none).
  leaveText: {
    en: "The timer keeps running. Come back before it runs out to carry on: the answers you've given still count.",
    hy: "Ժամաչափը շարունակում է աշխատել։ Վերադարձիր մինչև ժամանակի ավարտը, որ շարունակես․ տված պատասխաններդ կհաշվվեն։",
  },
  // Share result: the share message alone, without the image.
  shareMessage: {
    en: "Share as text",
    hy: "Կիսվել տեքստով",
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
