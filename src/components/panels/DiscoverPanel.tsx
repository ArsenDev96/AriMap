"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";
import { countryHint, getCountry } from "@/core/content/countries";
import { startFindingAction } from "@/core/progress/appState";
import { useI18n } from "../i18n";
import { LandmarkCard, landmarkArtShape } from "../landmarks/LandmarkCard";
import type { PanelProps } from "../LessonScreen";
import styles from "../LessonScreen.module.css";

export function DiscoverPanel({ lesson, progress, act }: PanelProps) {
  const { t, l, locale } = useI18n();
  const { selected, explored } = progress.discover;
  const country = selected ? getCountry(selected) : null;
  const total = lesson.countries.length;
  const allExplored = explored.length === total;
  const cardRef = useRef<HTMLElement>(null);
  useCardHeadLayout(cardRef, `${country?.id}:${locale}`);

  return (
    <>
      <div className={styles.heading}>
        {/* At 5/5 a celebration replaces the count; it wraps like the rest of the row if need be. */}
        <p className={styles.eyebrow} data-testid="discover-progress">
          <span className={styles.eyebrowText}>
            {t("discover.title")} ·{" "}
            {allExplored ? (
              <span className={styles.celebrate} role="status">
                <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" fill="currentColor" />
                </svg>
                {/* A word joiner: when the row wraps, the star stays with the first word. */}
                {"⁠"}
                {t("discover.exploredAll", { total })}
              </span>
            ) : (
              t("discover.explored", { count: explored.length, total })
            )}
          </span>
        </p>
        {/* On phones the instruction gives way to the country card once one is chosen
            (still read by screen readers); desktop keeps it. */}
        <h1 className={`${styles.title} ${country ? styles.titleCollapsed : ""}`}>{t("discover.prompt")}</h1>
      </div>

      {/* Keyed by country so details are replaced, not merged, on a new selection. */}
      <div aria-live="polite">
        {country ? (
          <article
            key={country.id}
            ref={cardRef}
            className={`${styles.card} ${styles.countryCard} ${landmarkArtShape(country.landmark) === "wide" ? styles.countryCardWide : ""}`}
            data-testid="country-card"
            data-country={country.id}
          >
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>{l(country.name)}</h2>
              <p className={styles.fact} data-testid="country-capital">
                {/* The map's capital marker: a light ring with a coral centre. */}
                <svg className={styles.capitalIcon} width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                  <circle cx="8" cy="8" r="6.5" fill="#fff" stroke="rgba(31, 58, 95, 0.55)" strokeWidth="1.5" />
                  <circle cx="8" cy="8" r="3" fill="var(--coral)" />
                </svg>
                <span className={styles.factLabel}>{t("discover.capital")}</span>
                <span className={styles.factValue}>{l(country.capital.name)}</span>
              </p>
            </div>
            {country.landmark && <LandmarkCard landmark={country.landmark} />}
            <p className={`${styles.muted} ${styles.countryHint}`}>{l(countryHint(lesson, country.id))}</p>
          </article>
        ) : (
          <p className={styles.placeholder}>{t("discover.empty")}</p>
        )}
      </div>

      <p className={styles.note}>{t("discover.region")}</p>

      <div className={`${styles.footer} ${styles.footerSticky}`} data-testid="sticky-actions">
        <button type="button" className="btn btn-primary btn-block" onClick={() => act(startFindingAction(lesson))}>
          {t("discover.startFinding")}
        </button>
      </div>
    </>
  );
}

/**
 * How the country card's name and capital sit with a square illustration on phones (the card's
 * grid, LessonScreen.module.css), written to the card's data-head attribute (the CSS follows it):
 * - "beside": both beside the art, the usual layout, whenever they fit there;
 * - "title": the name's longest word is wider than the column beside the art, so the name takes
 *   the card's width above, and the capital sits beside the art beneath it;
 * - "stacked": the capital's longest word doesn't fit beside the art either (enlarged text), so
 *   both take the card's width, and the art goes below them.
 * Read from the actual layout: the card is laid out side by side and the name's and capital's
 * narrowest widths (their longest words, in the loaded font) are compared with the column beside
 * the art, with the other layouts switched off (data-measuring). Decided before the browser paints,
 * like the header's layout (Header.tsx), so no frame shows a word broken that then jumps. Checked
 * again for a new country or language, when the card changes size (screen width, text size) and
 * when fonts finish loading. Wide art, text-only cards and desktop keep their own layouts.
 */
function useCardHeadLayout(card: RefObject<HTMLElement | null>, key: string) {
  useLayoutEffect(() => {
    const el = card.current;
    if (!el) return;
    const head = el.querySelector<HTMLElement>(`.${styles.cardHead}`)!;
    const title = head.querySelector<HTMLElement>(`.${styles.cardTitle}`)!;
    const capital = head.querySelector<HTMLElement>(`.${styles.fact}`)!;
    const measure = () => {
      el.setAttribute("data-measuring", "");
      const sideBySide = getComputedStyle(el).display === "grid" && el.querySelector('[data-shape="ordinary"]') !== null;
      let layout = "beside";
      if (sideBySide) {
        const column = head.getBoundingClientRect().width;
        if (capital.getBoundingClientRect().width > column + 0.01) layout = "stacked";
        else if (title.getBoundingClientRect().width > column + 0.01) layout = "title";
      }
      el.removeAttribute("data-measuring");
      el.setAttribute("data-head", layout);
    };
    measure();
    const observer = new ResizeObserver(measure);
    for (const target of [el, title, capital]) observer.observe(target);
    document.fonts.addEventListener("loadingdone", measure);
    return () => {
      observer.disconnect();
      document.fonts.removeEventListener("loadingdone", measure);
    };
  }, [card, key]);
}
