"use client";

import { countryHint, getCountry } from "@/core/content/countries";
import { startFindingAction } from "@/core/progress/appState";
import { useI18n } from "../i18n";
import { LandmarkCard, landmarkArtShape } from "../landmarks/LandmarkCard";
import type { PanelProps } from "../LessonScreen";
import styles from "../LessonScreen.module.css";

export function DiscoverPanel({ lesson, progress, act }: PanelProps) {
  const { t, l } = useI18n();
  const { selected, explored } = progress.discover;
  const country = selected ? getCountry(selected) : null;
  const total = lesson.countries.length;
  const allExplored = explored.length === total;

  return (
    <>
      <div className={styles.heading}>
        {/* One line either way, so the celebration at 5/5 never shifts the layout. */}
        <p className={styles.eyebrow} data-testid="discover-progress">
          {t("discover.title")} ·{" "}
          {allExplored ? (
            <span className={styles.celebrate} role="status">
              <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" fill="currentColor" />
              </svg>
              {t("discover.exploredAll", { total })}
            </span>
          ) : (
            t("discover.explored", { count: explored.length, total })
          )}
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
