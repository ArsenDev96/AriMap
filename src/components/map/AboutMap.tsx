"use client";

import { useEffect, useRef } from "react";
import { useI18n } from "../i18n";
import styles from "./RegionMap.module.css";

/** Size of the button plus its margin from the map edges (px); labels keep clear of this corner. */
export const ABOUT_BUTTON_EXTENT = 44;

/**
 * Attribution required by the data sources, verbatim (see docs/TERRAIN.md).
 * Elevation: checked against every elevation tile the relief was made from
 * (only SRTM, GMTED2010 and ETOPO1 contributed). Forests: the attribution text
 * the ESA WorldCover product user manual (v2.0, section 5.2) asks maps to include.
 */
const CREDITS = [
  "Terrain Tiles by Mapzen, from the Registry of Open Data on AWS.",
  "SRTM and GMTED2010 terrain data courtesy of the U.S. Geological Survey.",
  "Global ETOPO1 terrain data U.S. National Oceanic and Atmospheric Administration.",
  "© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium (CC BY 4.0).",
];

/**
 * "About the map": a small button in the map's top-right corner opening the map's sources and credits. A map with
 * data of its own (the Quick Challenge's) adds its notes, after the borders', and its credits, after these.
 *
 * `openAtTop` (the Quick Challenge's): the dialog opens scrolled to its top, with focus on its heading (reachable
 * by script only, not by Tab), so a phone shows the title first and a screen reader starts there; Tab then reaches
 * Close. Without it (the levels' maps), the browser focuses Close as it opens, which scrolls a dialog taller than
 * the screen to its end. Either way Esc, Close and a click outside close it, and focus returns to the button.
 *
 * `closeKey` (the Quick Challenge's): a new value closes the dialog if it is open, as when the round's time runs
 * out with it open. On a phone the results then hide the map, and the dialog with it: still open, it would leave the
 * rest of the page inert behind an invisible dialog.
 */
export function AboutMap({
  notes = [],
  credits = [],
  openAtTop = false,
  closeKey,
}: { notes?: readonly string[]; credits?: readonly string[]; openAtTop?: boolean; closeKey?: unknown } = {}) {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
  }, [closeKey]);
  const open = () => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    if (!openAtTop) return;
    // In the same task as showModal's own focusing (which scrolled to Close), so no frame is painted scrolled.
    headingRef.current?.focus({ preventScroll: true });
    dialog.scrollTop = 0;
  };
  return (
    <>
      <button
        type="button"
        className={styles.aboutButton}
        onClick={open}
        aria-label={t("map.about")}
        title={t("map.about")}
        aria-haspopup="dialog"
        data-testid="map-about"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="7" r="1.6" fill="currentColor" />
          <path d="M12 11v7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </button>
      <dialog
        ref={dialogRef}
        className={styles.aboutDialog}
        aria-labelledby="map-about-title"
        data-testid="map-about-dialog"
        // A click on the backdrop (outside the dialog box) closes it.
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
      >
        <div className={styles.aboutBody}>
          <h2 id="map-about-title" ref={headingRef} tabIndex={openAtTop ? -1 : undefined} className={openAtTop ? styles.aboutHeading : undefined}>
            {t("map.about")}
          </h2>
          <p>{t("map.aboutBorders")}</p>
          {notes.map((note) => (
            <p key={note}>{note}</p>
          ))}
          <p>{t("map.aboutTerrain")}</p>
          <p>{t("map.aboutForests")}</p>
          <p>{t("map.aboutCredits")}</p>
          <ul lang="en">
            {[...CREDITS, ...credits].map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <form method="dialog">
            <button type="submit" className={styles.aboutClose} autoFocus>
              {t("map.aboutClose")}
            </button>
          </form>
        </div>
      </dialog>
    </>
  );
}
