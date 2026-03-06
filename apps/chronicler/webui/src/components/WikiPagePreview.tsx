/**
 * WikiPagePreview - Entity hover preview card
 *
 * Shows a floating card with thumbnail, badges, and summary
 * when hovering over entity links in wiki content.
 */

import React from "react";
import type { Optional } from "@the-canonry/shared-components";
import type { HardState } from "../types/world.ts";
import { prominenceLabelFromScale, type ProminenceScale } from "@canonry/world-schema";
import styles from "./WikiPage.module.css";

export interface EntityPreviewCardProps {
  entity: HardState;
  summary: Optional<string>;
  position: { x: number; y: number };
  imageUrl: Optional<string | null>;
  prominenceScale: ProminenceScale;
}

export function EntityPreviewCard({
  entity,
  summary,
  position,
  imageUrl,
  prominenceScale,
}: Readonly<EntityPreviewCardProps>) {
  // Position the card to the right of cursor, adjusting if it would go off-screen
  const cardWidth = 260;
  const cardHeight = 180;

  let left = position.x + 16;
  let top = position.y - 20;

  // Check if card would go off right edge
  if (left + cardWidth > window.innerWidth - 20) {
    left = position.x - cardWidth - 16;
  }

  // Check if card would go off bottom edge
  if (top + cardHeight > window.innerHeight - 20) {
    top = window.innerHeight - cardHeight - 20;
  }

  // Keep within top boundary
  if (top < 20) {
    top = 20;
  }

  // Get first letter for placeholder
  const initial = entity.name.charAt(0).toUpperCase();

  return (
    <div
      className={styles.previewCard}
      style={{ "--preview-left": `${left}px`, "--preview-top": `${top}px` } as React.CSSProperties}
    >
      <div className={styles.previewHeader}>
        {imageUrl ? (
          <img src={imageUrl} alt="" className={styles.previewThumbnail} />
        ) : (
          <div className={styles.previewThumbnailPlaceholder}>{initial}</div>
        )}
        <div className={styles.previewTitle}>{entity.name}</div>
      </div>
      <div className={styles.previewBody}>
        <div className={styles.previewBadges}>
          <span className={styles.previewBadgeKind}>{entity.kind}</span>
          {entity.subtype && <span className={styles.previewBadge}>{entity.subtype}</span>}
          <span className={styles.previewBadgeStatus}>{entity.status}</span>
          <span className={styles.previewBadge}>
            {prominenceLabelFromScale(entity.prominence, prominenceScale)}
          </span>
          {entity.culture && <span className={styles.previewBadge}>{entity.culture}</span>}
        </div>
        {summary && (
          <div className={styles.previewSummary}>
            {summary.length > 250 ? `${summary.slice(0, 250)}...` : summary}
          </div>
        )}
      </div>
    </div>
  );
}
