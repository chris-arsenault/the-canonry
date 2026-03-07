/**
 * WikiPagePreview - Entity hover preview card
 *
 * Shows a floating card with thumbnail, badges, and summary
 * when hovering over entity links in wiki content.
 */

import React from "react";
import type { Optional } from "@the-canonry/shared-components";
import { ImageDisplay } from "@the-canonry/shared-components";
import type { HardState } from "../types/world.ts";
import { prominenceLabelFromScale, type ProminenceScale } from "@canonry/world-schema";

export interface EntityPreviewCardProps {
  entity: HardState;
  summary: Optional<string>;
  position: { x: number; y: number };
  imageId: Optional<string | null>;
  prominenceScale: ProminenceScale;
}

export function EntityPreviewCard({
  entity,
  summary,
  position,
  imageId,
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
      className="preview-card"
      style={{ "--preview-left": `${left}px`, "--preview-top": `${top}px` } as React.CSSProperties}
    >
      <div className="preview-header">
        <ImageDisplay
          imageId={imageId}
          alt=""
          className="preview-thumbnail"
          enableVersionCycling
          errorContent={<div className="preview-thumbnail-placeholder">{initial}</div>}
        />
        <div className="preview-title">{entity.name}</div>
      </div>
      <div className="preview-body">
        <div className="preview-badges">
          <span className="preview-badge-kind">{entity.kind}</span>
          {entity.subtype && <span className="preview-badge">{entity.subtype}</span>}
          <span className="preview-badge-status">{entity.status}</span>
          <span className="preview-badge">
            {prominenceLabelFromScale(entity.prominence, prominenceScale)}
          </span>
          {entity.culture && <span className="preview-badge">{entity.culture}</span>}
        </div>
        {summary && (
          <div className="preview-summary">
            {summary.length > 250 ? `${summary.slice(0, 250)}...` : summary}
          </div>
        )}
      </div>
    </div>
  );
}
