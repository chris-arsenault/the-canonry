/**
 * EntityBrowser helper components
 *
 * Sub-components extracted from EntityBrowser to reduce complexity:
 * - HighlightMatch: search result highlighting
 * - ImageThumbnail: lazy-loaded entity image thumbnails
 * - EnrichmentStatusBadge: status indicator badges
 * - EntityRow: single entity row in the browser list
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useImageUrl } from "@the-canonry/image-store";
import { prominenceLabelFromScale } from "@canonry/world-schema";
import { formatCost } from "../lib/costEstimation";
import type { EntityNavItem } from "../lib/db/entityNav";
import type {
  EnrichmentStatus,
  EnrichmentType,
  EntityRowProps,
  SearchMatch,
} from "./EntityBrowserTypes";

// ─── HighlightMatch ────────────────────────────────────────────────────────

interface HighlightMatchProps {
  text: string | undefined;
  query: string | undefined;
  truncate?: number;
  matchIndex?: number;
}

/**
 * Highlight matching substring within text for search results.
 * Extracted to its own function to reduce cyclomatic complexity.
 */
function computeHighlightParts(
  text: string,
  query: string,
  truncate: number,
  matchIndex?: number
): { before: string; match: string; after: string } | null {
  const idx = matchIndex != null ? matchIndex : text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return null;

  let displayText = text;
  let displayIdx = idx;

  if (truncate > 0 && text.length > truncate) {
    const contextRadius = Math.floor(truncate / 2);
    const winStart = Math.max(0, idx - contextRadius);
    const winEnd = Math.min(text.length, idx + query.length + contextRadius);
    displayText =
      (winStart > 0 ? "\u2026" : "") +
      text.slice(winStart, winEnd) +
      (winEnd < text.length ? "\u2026" : "");
    displayIdx = idx - winStart + (winStart > 0 ? 1 : 0);
  }

  return {
    before: displayText.slice(0, displayIdx),
    match: displayText.slice(displayIdx, displayIdx + query.length),
    after: displayText.slice(displayIdx + query.length),
  };
}

export function HighlightMatch({
  text,
  query,
  truncate = 0,
  matchIndex,
}: Readonly<HighlightMatchProps>) {
  if (!query || !text) return <>{text}</>;

  const parts = computeHighlightParts(text, query, truncate, matchIndex);
  if (!parts) {
    const display =
      truncate > 0 && text.length > truncate ? text.slice(0, truncate) + "\u2026" : text;
    return <>{display}</>;
  }

  return (
    <>
      {parts.before}
      <span className="eb-highlight">{parts.match}</span>
      {parts.after}
    </>
  );
}

// ─── ImageThumbnail ────────────────────────────────────────────────────────

interface ImageThumbnailProps {
  imageId: string;
  alt: string;
  onClick: (imageId: string, title: string) => void;
}

export function ImageThumbnail({ imageId, alt, onClick }: Readonly<ImageThumbnailProps>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const { url, loading, error } = useImageUrl(visible ? imageId : null);

  const handleClick = useCallback(() => {
    onClick(imageId, alt);
  }, [onClick, imageId, alt]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") handleClick();
    },
    [handleClick]
  );

  if (!visible || loading) {
    return (
      <div ref={containerRef} className="eb-thumb" title="Loading...">
        Loading...
      </div>
    );
  }

  if (error || !url) {
    return (
      <div ref={containerRef} className="eb-thumb" title={error || "Image not found"}>
        No image
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="eb-thumb-clickable"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <img src={url} alt={alt} className="eb-thumb-img" />
    </div>
  );
}

// ─── EnrichmentStatusBadge ─────────────────────────────────────────────────

interface EnrichmentStatusBadgeProps {
  status: EnrichmentStatus;
  label: string;
  cost?: string;
}

const BADGE_ICONS: Record<EnrichmentStatus, string> = {
  missing: "\u25CB",
  queued: "\u25F7",
  running: "\u25D0",
  complete: "\u2713",
  error: "\u2717",
  disabled: "\u2500",
};

export function EnrichmentStatusBadge({
  status,
  label,
  cost,
}: Readonly<EnrichmentStatusBadgeProps>) {
  return (
    <span className={`eb-badge eb-badge--${status}`}>
      <span>{BADGE_ICONS[status]}</span>
      <span>{label}</span>
      {cost !== undefined && <span className="eb-badge-cost">{cost}</span>}
    </span>
  );
}

// ─── Shared helpers ────────────────────────────────────────────────────────

export function getNavItemCostDisplay(
  navItem: EntityNavItem,
  type: EnrichmentType,
  status: EnrichmentStatus
): string | undefined {
  if (status !== "complete") return undefined;
  if (type === "description" && navItem.descriptionCost) {
    return formatCost(navItem.descriptionCost);
  }
  if (type === "image" && navItem.imageCost) {
    return formatCost(navItem.imageCost);
  }
  return undefined;
}

// ─── EntityRow ─────────────────────────────────────────────────────────────

/** Description action buttons extracted to reduce EntityRow complexity. */
function DescriptionActions({
  descStatus,
  onQueueDesc,
  onCancelDesc,
  descCost,
}: Readonly<{
  descStatus: EnrichmentStatus;
  onQueueDesc: () => void;
  onCancelDesc: () => void;
  descCost?: string;
}>) {
  return (
    <div className="eb-row-action-group">
      <EnrichmentStatusBadge status={descStatus} label="Desc" cost={descCost} />
      {descStatus === "missing" && (
        <button
          onClick={onQueueDesc}
          className="illuminator-button illuminator-button-secondary eb-row-action-btn"
        >
          Queue
        </button>
      )}
      {(descStatus === "queued" || descStatus === "running") && (
        <button
          onClick={onCancelDesc}
          className="illuminator-button illuminator-button-secondary eb-row-action-btn"
        >
          Cancel
        </button>
      )}
      {descStatus === "error" && (
        <button
          onClick={onQueueDesc}
          className="illuminator-button illuminator-button-secondary eb-row-action-btn"
        >
          Retry
        </button>
      )}
      {descStatus === "complete" && (
        <button
          onClick={onQueueDesc}
          className="illuminator-button illuminator-button-secondary eb-row-action-btn"
          title="Regenerate description"
        >
          Regen
        </button>
      )}
    </div>
  );
}

/** Visual thesis action buttons extracted to reduce EntityRow complexity. */
function ThesisActions({
  thesisStatus,
  onQueueThesis,
  onCancelThesis,
}: Readonly<{
  thesisStatus: EnrichmentStatus;
  onQueueThesis: () => void;
  onCancelThesis: () => void;
}>) {
  return (
    <div className="eb-row-action-group">
      <EnrichmentStatusBadge status={thesisStatus} label="Thesis" />
      {(thesisStatus === "missing" || thesisStatus === "complete") && (
        <button
          onClick={onQueueThesis}
          className="illuminator-button illuminator-button-secondary eb-row-action-btn"
          title={
            thesisStatus === "complete"
              ? "Regenerate visual thesis & traits"
              : "Generate visual thesis & traits"
          }
        >
          {thesisStatus === "complete" ? "Regen" : "Queue"}
        </button>
      )}
      {(thesisStatus === "queued" || thesisStatus === "running") && (
        <button
          onClick={onCancelThesis}
          className="illuminator-button illuminator-button-secondary eb-row-action-btn"
        >
          Cancel
        </button>
      )}
      {thesisStatus === "error" && (
        <button
          onClick={onQueueThesis}
          className="illuminator-button illuminator-button-secondary eb-row-action-btn"
        >
          Retry
        </button>
      )}
    </div>
  );
}

/** Image action buttons extracted to reduce EntityRow complexity. */
function ImageActions({
  imgStatus,
  canQueueImage,
  needsDescription,
  onQueueImg,
  onCancelImg,
  onAssignImage,
  imgCost,
}: Readonly<{
  imgStatus: EnrichmentStatus;
  canQueueImage: boolean;
  needsDescription: boolean;
  onQueueImg: () => void;
  onCancelImg: () => void;
  onAssignImage: () => void;
  imgCost?: string;
}>) {
  const badgeStatus = canQueueImage ? imgStatus : "disabled";
  const badgeCost = canQueueImage ? imgCost : undefined;

  return (
    <div className="eb-row-action-group eb-row-action-group-wrap">
      <EnrichmentStatusBadge status={badgeStatus} label="Image" cost={badgeCost} />
      {needsDescription && <span className="eb-row-needs-desc">Needs desc first</span>}
      {canQueueImage && imgStatus === "missing" && (
        <>
          <button
            onClick={onQueueImg}
            className="illuminator-button illuminator-button-secondary eb-row-action-btn"
          >
            Queue
          </button>
          <button
            onClick={onAssignImage}
            className="illuminator-button illuminator-button-secondary eb-row-action-btn"
            title="Assign existing image from library"
          >
            Assign
          </button>
        </>
      )}
      {canQueueImage && (imgStatus === "queued" || imgStatus === "running") && (
        <button
          onClick={onCancelImg}
          className="illuminator-button illuminator-button-secondary eb-row-action-btn"
        >
          Cancel
        </button>
      )}
      {canQueueImage && imgStatus === "error" && (
        <>
          <button
            onClick={onQueueImg}
            className="illuminator-button illuminator-button-secondary eb-row-action-btn"
          >
            Retry
          </button>
          <button
            onClick={onAssignImage}
            className="illuminator-button illuminator-button-secondary eb-row-action-btn"
            title="Assign existing image from library"
          >
            Assign
          </button>
        </>
      )}
      {canQueueImage && imgStatus === "complete" && (
        <>
          <button
            onClick={onQueueImg}
            className="illuminator-button illuminator-button-secondary eb-row-action-btn"
            title="Regenerate image"
          >
            Regen
          </button>
          <button
            onClick={onAssignImage}
            className="illuminator-button illuminator-button-secondary eb-row-action-btn"
            title="Assign different image from library"
          >
            Assign
          </button>
        </>
      )}
    </div>
  );
}

export function EntityRow({
  entity,
  descStatus,
  imgStatus,
  thesisStatus,
  selected,
  onToggleSelect,
  onQueueDesc,
  onQueueThesis,
  onQueueImg,
  onCancelDesc,
  onCancelThesis,
  onCancelImg,
  onAssignImage,
  canQueueImage,
  needsDescription,
  onImageClick,
  onEntityClick,
  onEditEntity,
  onDeleteEntity,
  descCost,
  imgCost,
  prominenceScale,
}: Readonly<EntityRowProps>) {
  const handleEntityKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") onEntityClick();
    },
    [onEntityClick]
  );

  const handleEditClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onEditEntity) onEditEntity(entity);
    },
    [onEditEntity, entity]
  );

  const handleDeleteClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onDeleteEntity) onDeleteEntity(entity);
    },
    [onDeleteEntity, entity]
  );

  return (
    <div className="eb-row">
      {/* Checkbox */}
      <div className="eb-row-checkbox">
        <input type="checkbox" checked={selected} onChange={onToggleSelect} />
      </div>

      {/* Entity info */}
      <div>
        <div
          className="eb-row-name"
          onClick={onEntityClick}
          title="Click to view entity details"
          role="button"
          tabIndex={0}
          onKeyDown={handleEntityKeyDown}
        >
          {entity.name}
        </div>
        <div className="eb-row-meta">
          <span>
            {entity.kind}/{entity.subtype} ·{" "}
            {prominenceLabelFromScale(entity.prominence, prominenceScale)}
            {entity.culture && ` · ${entity.culture}`}
          </span>
          {entity.historianEditionCount > 0 && (
            <span
              title={`${entity.historianEditionCount} historian edition${entity.historianEditionCount !== 1 ? "s" : ""}`}
              className={
                entity.historianEditionCount >= 2
                  ? "eb-row-edition-count eb-row-edition-count-many"
                  : "eb-row-edition-count eb-row-edition-count-few"
              }
            >
              {"\u270E"}
              {entity.historianEditionCount}
            </span>
          )}
          {onEditEntity && entity.isManual && (
            <button
              onClick={handleEditClick}
              className="illuminator-button illuminator-button-secondary eb-row-btn-sm"
              title="Edit entity attributes"
            >
              Edit
            </button>
          )}
          {onDeleteEntity && entity.isManual && (
            <button
              onClick={handleDeleteClick}
              className="illuminator-button illuminator-button-secondary eb-row-btn-sm eb-row-btn-sm-danger"
              title="Delete this manually-created entity"
            >
              Delete
            </button>
          )}
        </div>

        {/* Content row: description and image side by side */}
        <div className="eb-row-content">
          {entity.summary && (
            <div
              className="eb-row-summary"
              onClick={onEntityClick}
              title="Click to view entity details"
              role="button"
              tabIndex={0}
              onKeyDown={handleEntityKeyDown}
            >
              {entity.summary}
            </div>
          )}
          {entity.imageId && (
            <ImageThumbnail imageId={entity.imageId} alt={entity.name} onClick={onImageClick} />
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="eb-row-actions">
        <DescriptionActions
          descStatus={descStatus}
          onQueueDesc={onQueueDesc}
          onCancelDesc={onCancelDesc}
          descCost={descCost}
        />
        {descStatus === "complete" && (
          <ThesisActions
            thesisStatus={thesisStatus}
            onQueueThesis={onQueueThesis}
            onCancelThesis={onCancelThesis}
          />
        )}
        <ImageActions
          imgStatus={imgStatus}
          canQueueImage={canQueueImage}
          needsDescription={needsDescription}
          onQueueImg={onQueueImg}
          onCancelImg={onCancelImg}
          onAssignImage={onAssignImage}
          imgCost={imgCost}
        />
      </div>
    </div>
  );
}
