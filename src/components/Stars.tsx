import { MAX_STARS } from "@/core/lesson/rating";
import { useI18n } from "./i18n";
import styles from "./Stars.module.css";

const STAR = "M12 2.6l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z";
/** The star's right side, from its centre: the warm amber shading that gives it depth. */
const SHADE = "M12 12.3l2.8-3.9 6.3.9-4.6 4.4 1.1 6.3L12 17z";
/** A small cream highlight on its upper left. */
const GLINT = "M7.9 10.4l2.3-.35 1.05-2.2";

/**
 * One reward star, the same wherever stars are shown (level cards, Results, continent totals): earned,
 * a rich golden yellow with warm amber shading, a small cream highlight and a crisp warm outline; not
 * earned, a pale interior and a dashed outline, so the two differ in shape as well as colour. Sized by
 * whoever shows it; static (only a New best pops in, once). Decorative: never read on its own.
 */
function RewardStar({ earned, className }: { earned: boolean; className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" data-earned={earned || undefined} aria-hidden="true" focusable="false">
      {earned ? (
        <>
          <path className={styles.body} d={STAR} />
          <path className={styles.shade} d={SHADE} />
          <path className={styles.glint} d={GLINT} />
          <path className={styles.outline} d={STAR} />
        </>
      ) : (
        <path className={styles.empty} d={STAR} />
      )}
    </svg>
  );
}

/**
 * A star rating's three reward stars, earned ones first. They scale with the text; each place sizes
 * them for its use (the level cards' row, Results' attempt and best). Decorative: whoever shows them
 * gives the group its one accessible description ("2 of 3 stars").
 */
export function Stars({ count, celebrate = false }: { count: number; celebrate?: boolean }) {
  return (
    <span className={styles.stars} aria-hidden="true" data-celebrate={celebrate || undefined}>
      {Array.from({ length: MAX_STARS }, (_, i) => (
        <RewardStar key={i} earned={i < count} className={styles.star} />
      ))}
    </span>
  );
}

/**
 * A continent's stars (continentStars): a small reward badge, one gold star and the count ("★ 17/24"),
 * kept together on one line. Read as one sentence ("17 of 24 stars earned in Europe"); the star and the
 * count are for the eye only. `continentOf` is the continent's name as the sentence needs it
 * (ContinentInfo.nameOf).
 */
export function StarTotal({ earned, max, continentOf, id }: { earned: number; max: number; continentOf: string; id?: string }) {
  const { t } = useI18n();
  return (
    <p className={styles.total} data-testid="continent-stars" data-earned={earned} data-max={max}>
      <span className={styles.totalCount} aria-hidden="true">
        <RewardStar earned className={styles.totalStar} />
        <span>{`${earned}/${max}`}</span>
      </span>
      <span id={id} className="visually-hidden">
        {t("continents.stars", { earned, max, continent: continentOf })}
      </span>
    </p>
  );
}
