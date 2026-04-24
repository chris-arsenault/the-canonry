/**
 * WikiPageInfobox - Wikipedia-style infobox for entity pages
 *
 * Renders in two variants:
 * - 'inline': Full-width card above content (mobile/tablet)
 * - 'float': Floated right sidebar (desktop)
 */

import React, { useCallback } from "react";
import type { Optional } from "@the-canonry/shared-components";
import { ImageDisplay } from "@the-canonry/shared-components";
import type { WikiPage } from "../types/world.ts";
import type { ImageAspect } from "../types/world.ts";
import { getInfoboxImageClass } from "./WikiPageLayout.ts";
import { FrostEdge } from "./Ornaments.tsx";

interface WikiPageInfoboxProps {
  page: WikiPage;
  variant: "inline" | "float";
  isMobile: boolean;
  imageId: Optional<string>;
  effectiveAspect: Optional<ImageAspect>;
  onImageClick: () => Promise<void>;
  onNavigateToEntity: (entityId: string) => void;
}

export function WikiPageInfobox({
  page,
  variant,
  isMobile,
  imageId,
  effectiveAspect,
  onImageClick,
  onNavigateToEntity,
}: Readonly<WikiPageInfoboxProps>) {
  const infobox = page.content.infobox;

  const handleClick = useCallback(
    () => { void onImageClick(); },
    [onImageClick],
  );

  if (!infobox) return null;

  const containerClass = variant === "inline" ? "infobox-inline" : "infobox";

  return (
    <div className={containerClass}>
      <FrostEdge className="frost-edge" />
      <div className="infobox-header">{page.title}</div>
      <ImageDisplay
        imageId={imageId}
        alt={page.title}
        className={getInfoboxImageClass(effectiveAspect, isMobile)}
        containerClassName="infobox-image-btn"
        onClick={() => handleClick()}
        enableVersionCycling
      />
      <div className="infobox-body">
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
    <div className="infobox-row">
      <div className="infobox-label">{label}</div>
      <div className="infobox-value">
        {linkedEntity ? (
          <span
            className="entity-link"
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
