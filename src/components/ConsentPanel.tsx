"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { analyticsConsent, setAnalyticsConsent, subscribeConsent, type AnalyticsConsent } from "@/web/analytics";
import { useI18n } from "./i18n";
import styles from "./ConsentPanel.module.css";

/** The player's analytics choice (src/web/analytics.ts): null until they make one. */
export function useAnalyticsConsent(): AnalyticsConsent | null {
  return useSyncExternalStore(subscribeConsent, analyticsConsent, () => null);
}

/**
 * Privacy & analytics, at the foot of the home screen: a short request, what Google Analytics would receive under
 * "Learn more" (collapsed), and Reject and Accept, alike in look and place. Shown until the player chooses (nothing
 * is sent before), and again from the home screen's "Privacy & analytics" link, with the choice in force. Below the page's content, never over it,
 * in the same scrolling: it never shrinks the content's room. The game works the same whatever is chosen.
 */
export function ConsentPanel({ reopened, onClose }: { reopened: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const consent = useAnalyticsConsent();
  // Opened from the link: to its title, so a screen reader starts there. Never on its own: the page keeps focus.
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (reopened) titleRef.current?.focus();
  }, [reopened]);
  if (consent !== null && !reopened) return null;

  const choose = (choice: AnalyticsConsent) => {
    setAnalyticsConsent(choice);
    onClose();
  };
  return (
    <section className={styles.panel} aria-labelledby="consent-title" data-testid="consent">
      <div className={styles.inner}>
        <h2 id="consent-title" className={styles.title} ref={titleRef} tabIndex={-1}>
          {t("consent.heading")}
        </h2>
        <p className={styles.text}>{t("consent.summary")}</p>
        {/* The full explanation, one tap away (and open to read before choosing). */}
        <details className={styles.details} data-testid="consent-details">
          <summary className={styles.more}>{t("consent.more")}</summary>
          <p className={styles.text}>
            {t("consent.text")} {t("consent.change")}
          </p>
        </details>
        {consent && (
          <p className={styles.current} data-testid="consent-current">
            {t(consent === "granted" ? "consent.granted" : "consent.denied")}
          </p>
        )}
        <div className={styles.actions}>
          <button type="button" className="btn btn-secondary" onClick={() => choose("denied")} data-testid="consent-reject">
            {t("consent.reject")}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => choose("granted")} data-testid="consent-accept">
            {t("consent.accept")}
          </button>
        </div>
        {reopened && (
          <button type="button" className={`btn btn-ghost ${styles.close}`} onClick={onClose} data-testid="consent-close">
            {t("consent.close")}
          </button>
        )}
      </div>
    </section>
  );
}
