"use client";

import Image, { type StaticImageData } from "next/image";
import type { Landmark } from "@/core/content/types";
import adolpheBridge from "@/assets/landmarks/adolphe-bridge.webp";
import amsterdamCanalHouses from "@/assets/landmarks/amsterdam-canal-houses.webp";
import atomium from "@/assets/landmarks/atomium.webp";
import brandenburgGate from "@/assets/landmarks/brandenburg-gate.webp";
import eiffelTower from "@/assets/landmarks/eiffel-tower.webp";
import { useI18n } from "../i18n";
import styles from "./LandmarkCard.module.css";

// AI-generated stylised illustrations, trimmed to their artwork by
// scripts/prepare-landmarks.mjs (originals in public/images/landmarks/).
// Provenance is documented in docs/CONTENT.md, not shown to players.
const IMAGES: Readonly<Record<string, StaticImageData>> = {
  "eiffel-tower": eiffelTower,
  atomium,
  "amsterdam-canal-houses": amsterdamCanalHouses,
  "adolphe-bridge": adolpheBridge,
  "brandenburg-gate": brandenburgGate,
};

/** Landmark illustration, name and fact. The same component serves every country.
 *  On phones its parts are laid out by the country card's grid (display: contents). */
export function LandmarkCard({ landmark }: { landmark: Landmark }) {
  const { t, l } = useI18n();
  const image = landmark.illustration ? IMAGES[landmark.illustration] : undefined;
  return (
    <figure className={styles.landmark} data-testid="landmark-card" data-landmark={landmark.id}>
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
              // Desktop: the panel's width (≈ 380px). Phones: a tile of at most 132px beside the country name.
              sizes="(min-width: 900px) 380px, 132px"
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
