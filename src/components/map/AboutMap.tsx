"use client";

import { useRef } from "react";
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

/** "About the map": a small button in the map's top-right corner opening the map's sources and credits. */
export function AboutMap() {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        className={styles.aboutButton}
        onClick={() => dialogRef.current?.showModal()}
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
          <h2 id="map-about-title">{t("map.about")}</h2>
          <p>{t("map.aboutBorders")}</p>
          <p>{t("map.aboutTerrain")}</p>
          <p>{t("map.aboutForests")}</p>
          <p>{t("map.aboutCredits")}</p>
          <ul lang="en">
            {CREDITS.map((c) => (
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
