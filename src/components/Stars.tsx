import { MAX_STARS } from "@/core/lesson/rating";
import styles from "./Stars.module.css";

/**
 * A star rating's three stars: the earned ones filled in warm gold with an ink outline, the others
 * only a dashed outline, so filled and empty differ in shape as well as colour. They scale with the
 * text. Decorative: whoever shows them gives the group its one accessible description ("2 of 3 stars").
 */
export function Stars({ count, celebrate = false }: { count: number; celebrate?: boolean }) {
  return (
    <span className={styles.stars} aria-hidden="true" data-celebrate={celebrate || undefined}>
      {Array.from({ length: MAX_STARS }, (_, i) => (
        <svg key={i} className={styles.star} viewBox="0 0 24 24" data-earned={i < count || undefined}>
          <path d="M12 2.6l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z" />
        </svg>
      ))}
    </span>
  );
}
