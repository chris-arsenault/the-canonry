/**
 * WikiPageInfobox - Wikipedia-style infobox for entity pages
 *
 * Renders in two variants:
 * - 'inline': Full-width card above content (mobile/tablet)
 * - 'float': Floated right sidebar (desktop)
 */

import React, { useCallback } from "react";
import type { Optional } from "@the-canonry/shared-components";
import type { WikiPage } from "../types/world.ts";
import type { ImageAspect } from "../types/world.ts";
import { getInfoboxImageClass } from "./WikiPageLayout.ts";
import { FrostEdge } from "./Ornaments.tsx";
import styles from "./WikiPage.module.css";

interface WikiPageInfoboxProps {
  page: WikiPage;
  variant: "inline" | "float";
  isMobile: boolean;
  imageUrl: Optional<string>;
  effectiveAspect: Optional<ImageAspect>;
  onImageLoad: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  onImageClick: () => Promise<void>;
  onNavigateToEntity: (entityId: string) => void;
}

export function WikiPageInfobox({
  page,
  variant,
  isMobile,
  imageUrl,
  effectiveAspect,
  onImageLoad,
  onImageClick,
  onNavigateToEntity,
}: Readonly<WikiPageInfoboxProps>) {
  const infobox = page.content.infobox;

  const handleImageKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") void onImageClick();
  }, [onImageClick]);

  const handleImageError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    (e.target as HTMLImageElement).style.display = "none";
  }, []);

  if (!infobox) return null;

  const containerClass = variant === "inline" ? styles.infoboxInline : styles.infobox;

  return (
    <div className={containerClass}>
      <FrostEdge className={styles.frostEdge} />
      <div className={styles.infoboxHeader}>{page.title}</div>
      {imageUrl && (
        <button
          type="button"
          className={styles.infoboxImageBtn}
          onClick={() => void onImageClick()}
          tabIndex={0}
          onKeyDown={handleImageKeyDown}
        >
          <img
            src={imageUrl}
            alt={page.title}
            className={getInfoboxImageClass(effectiveAspect, isMobile)}
            onLoad={onImageLoad}
            onError={handleImageError}
          />
        </button>
      )}
      <div className={styles.infoboxBody}>
        {infobox.fields.map((field, i) => (
          <InfoboxField
            key={i}
            label={field.label}
            value={field.value}
            linkedEntity={field.linkedEntity}
            onNavigateToEntity={onNavigateToEntity}
          />
        ))}
      </div>
    </div>
  );
}

function InfoboxField({ label, value, linkedEntity, onNavigateToEntity }: Readonly<{
  label: string;
  value: string | string[];
  linkedEntity: Optional<string>;
  onNavigateToEntity: (entityId: string) => void;
}>) {
  const displayValue = Array.isArray(value) ? value.join(", ") : value;

  const handleClick = useCallback(() => {
    if (linkedEntity) onNavigateToEntity(linkedEntity);
  }, [linkedEntity, onNavigateToEntity]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === " ") && linkedEntity) onNavigateToEntity(linkedEntity);
  }, [linkedEntity, onNavigateToEntity]);

  return (
    <div className={styles.infoboxRow}>
      <div className={styles.infoboxLabel}>{label}</div>
      <div className={styles.infoboxValue}>
        {linkedEntity ? (
          <span
            className={styles.entityLink}
            onClick={handleClick}
            role="button"
            tabIndex={0}
            onKeyDown={handleKeyDown}
          >
            {displayValue}
          </span>
        ) : (
          <>{displayValue}</>
        )}
      </div>
    </div>
  );
}
