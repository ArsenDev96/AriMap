"use client";

import Image, { type StaticImageData } from "next/image";
import type { CSSProperties } from "react";
import type { Landmark } from "@/core/content/types";
import adolpheBridge from "@/assets/landmarks/adolphe-bridge.webp";
import amsterdamCanalHouses from "@/assets/landmarks/amsterdam-canal-houses.webp";
import atomium from "@/assets/landmarks/atomium.webp";
import bledCastle from "@/assets/landmarks/bled-castle.webp";
import brandenburgGate from "@/assets/landmarks/brandenburg-gate.webp";
import branCastle from "@/assets/landmarks/bran-castle.webp";
import bratislavaCastle from "@/assets/landmarks/bratislava-castle.webp";
import chapelBridge from "@/assets/landmarks/chapel-bridge.webp";
import charlesBridge from "@/assets/landmarks/charles-bridge.webp";
import colosseum from "@/assets/landmarks/colosseum.webp";
import dubrovnikCityWalls from "@/assets/landmarks/dubrovnik-city-walls.webp";
import eiffelTower from "@/assets/landmarks/eiffel-tower.webp";
import esztergomBasilica from "@/assets/landmarks/esztergom-basilica.webp";
import golubacFortress from "@/assets/landmarks/golubac-fortress.webp";
import meteora from "@/assets/landmarks/meteora.webp";
import ostrogMonastery from "@/assets/landmarks/ostrog-monastery.webp";
import rilaMonastery from "@/assets/landmarks/rila-monastery.webp";
import schonbrunnPalace from "@/assets/landmarks/schonbrunn-palace.webp";
import stariMost from "@/assets/landmarks/stari-most.webp";
import wawelCastle from "@/assets/landmarks/wawel-castle.webp";
import { useI18n } from "../i18n";
import styles from "./LandmarkCard.module.css";

// AI-generated stylised illustrations, trimmed to their artwork by
// scripts/prepare-landmarks.mjs (originals in public/images/landmarks/).
// Provenance is documented in docs/CONTENT.md, not shown to players.
export const LANDMARK_IMAGES: Readonly<Record<string, StaticImageData>> = {
  "eiffel-tower": eiffelTower,
  atomium,
  "amsterdam-canal-houses": amsterdamCanalHouses,
  "adolphe-bridge": adolpheBridge,
  "brandenburg-gate": brandenburgGate,
  "chapel-bridge": chapelBridge,
  "schonbrunn-palace": schonbrunnPalace,
  colosseum,
  "wawel-castle": wawelCastle,
  "charles-bridge": charlesBridge,
  "bratislava-castle": bratislavaCastle,
  "bled-castle": bledCastle,
  "dubrovnik-city-walls": dubrovnikCityWalls,
  "stari-most": stariMost,
  "ostrog-monastery": ostrogMonastery,
  "esztergom-basilica": esztergomBasilica,
  "bran-castle": branCastle,
  "golubac-fortress": golubacFortress,
  "rila-monastery": rilaMonastery,
  meteora,
};

/**
 * Illustrations at least this much wider than tall (width ÷ height of the display copy) are
 * laid out wide on phones: the country's name and capital above, the art across the card in a
 * shallow tile below. In the square tile beside the name, art of aspect a is drawn at 1/a of the
 * tile's height; in the shallow tile (about 262×62px at 320×568) it is drawn no larger than in
 * the square one until about 2:1 (Adolphe Bridge, 1.71: 100×58px square, about 106×62px wide),
 * but well beyond it (Schönbrunn Palace, 3.26: 100×30px square, about 200×62px wide). The current
 * copies are 0.76–1.71 or 3.26, so 2 sits in the gap (Level 3's castles and bridge are about 1.5, Level 4's four 0.96–1.20, Level 5's five 0.90–1.24). Desktop is unaffected.
 */
export const WIDE_ART_ASPECT = 2;

/** The illustration's shape, known from the static import before it loads (so nothing moves when it does). */
export function landmarkArtShape(landmark: Landmark | undefined): "wide" | "ordinary" | null {
  const image = landmark?.illustration ? LANDMARK_IMAGES[landmark.illustration] : undefined;
  if (!image) return null;
  return image.width / image.height >= WIDE_ART_ASPECT ? "wide" : "ordinary";
}

/** Landmark illustration, name and fact. The same component serves every country.
 *  On phones its parts are laid out by the country card's grid (display: contents).
 *  A landmark without an illustration yet is shown as text: the map's landmark
 *  mark beside its name and fact, across the card (no empty picture frame). */
export function LandmarkCard({ landmark }: { landmark: Landmark }) {
  const { t, l } = useI18n();
  const image = landmark.illustration ? LANDMARK_IMAGES[landmark.illustration] : undefined;
  const wide = landmarkArtShape(landmark) === "wide";
  return (
    <figure
      className={`${styles.landmark} ${image ? "" : styles.textOnly} ${wide ? styles.wide : ""}`}
      data-testid="landmark-card"
      data-landmark={landmark.id}
      data-art={image ? "illustration" : "none"}
      data-shape={landmarkArtShape(landmark) ?? undefined}
      // The art's own proportions, for the wide tile on phones (LandmarkCard.module.css).
      style={image ? ({ "--art-aspect": `${image.width} / ${image.height}` } as CSSProperties) : undefined}
    >
      {!image && (
        // The amber diamond of the map's landmark pin.
        <svg className={styles.mark} width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
          <rect x="8" y="8" width="14" height="14" rx="2.5" transform="rotate(45 15 15)" fill="var(--amber)" stroke="var(--ink)" strokeWidth="2" />
        </svg>
      )}
      {image && (
        <div className={styles.stage}>
          <div className={styles.frame}>
            <Image
              src={image}
              alt={t("discover.landmarkAlt", { landmark: l(landmark.nameInText) })}
              className={styles.image}
              fill
              // The card's illustration is usually the largest thing on screen when it appears.
              loading="eager"
              // Desktop: the panel's width (≈ 380px). Phones: a tile of at most 132px beside the country
              // name, or (wide art) the card's width.
              sizes={wide ? "(min-width: 900px) 380px, 100vw" : "(min-width: 900px) 380px, 132px"}
              data-testid="landmark-image"
            />
          </div>
        </div>
      )}
      <figcaption className={styles.text}>
        <span className={styles.label}>{t("discover.landmark")}</span>
        <span className={styles.name}>{l(landmark.name)}</span>
        <span className={styles.fact}>{l(landmark.fact)}</span>
      </figcaption>
    </figure>
  );
}
