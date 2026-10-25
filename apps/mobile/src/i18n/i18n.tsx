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
  // The neighbours round (src/core/challenge/neighbours.ts): the challenge without the map, for screen readers. The
  // Armenian awaits a native speaker's review (docs/MOBILE.md, "Armenian").
  neighboursLabel: {
    en: "Neighbours round",
    hy: "Հարևանների խաղ",
  },
  neighboursStart: {
    en: "Neighbours round (no map)",
    hy: "Հարևանների խաղ (առանց քարտեզի)",
  },
  neighboursIntro: {
    en: "Made for screen readers: no map to see. For each country, choose which of four countries borders it. 15 countries, 10 minutes.",
    hy: "Ստեղծված է էկրանի ընթերցիչի համար․ քարտեզ տեսնել պետք չէ։ Յուրաքանչյուր երկրի համար ընտրիր չորս երկրներից այն մեկը, որը սահմանակից է նրան։ 15 երկիր, 10 րոպե։",
  },
  screenReaderNote: {
    en: "A screen reader is on. The map round needs sight: its map can't be read aloud without giving the answers away. The neighbours round, below, asks about the same countries without the map.",
    hy: "Էկրանի ընթերցիչը միացված է։ Քարտեզով խաղը տեսողություն է պահանջում․ քարտեզը հնարավոր չէ բարձրաձայն կարդալ՝ առանց պատասխանները բացահայտելու։ Ներքևի Հարևանների խաղը հարցնում է նույն երկրների մասին՝ առանց քարտեզի։",
  },
  neighboursQuestion: {
    en: "Which of these borders {name}?",
    hy: "{name}․ այս երկրներից ո՞րն է նրա հարևանը։",
  },
  neighbourYes: {
    en: "{option} borders it.",
    hy: "{option}՝ հարևան է։",
  },
  neighbourNo: {
    en: "{option} doesn't border it.",
    hy: "{option}՝ հարևան չէ։",
  },
  neighboursChose: {
    en: "You chose {option}, which doesn't border it.",
    hy: "Քո ընտրությունը՝ {option}, որը հարևան չէ։",
  },
  neighboursList: {
    en: "Its neighbours in this challenge: {list}.",
    hy: "Նրա հարևաններն այս խաղում՝ {list}։",
  },
  neighboursShare: {
    en: "{score}/{total} in AriMap's neighbours round, without the map. Can you beat my score? {url}",
    hy: "{score}/{total}՝ ԱրիՄապի Հարևանների խաղում, առանց քարտեզի։ Կարո՞ղ ես գերազանցել իմ արդյունքը։ {url}",
  },
  neighboursShareNote: {
    en: "A neighbours round is shared as text: the result card shows map rounds.",
    hy: "Հարևանների խաղով կիսվում ես տեքստով․ արդյունքի քարտը քարտեզով խաղերի համար է։",
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
      /** One of the app's own texts, its {placeholders} filled from `params`. */
      app: (key: AppTextKey, params?: Record<string, string | number>) =>
        localize(APP_TEXT[key], locale).replace(/\{(\w+)\}/g, (all, name: string) => (params && name in params ? String(params[name]) : all)),
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
