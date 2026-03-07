/**
 * ImageDisplay - Shared image component with version cycling.
 *
 * Resolves an imageId to a displayable URL via the image store,
 * handles loading/error states, and optionally shows a version
 * cycling indicator when alternate generations exist at the same
 * logical slot (entity portrait, chronicle cover, scene ref).
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useImageUrl, useImageAlternates } from '@the-canonry/image-store';
import type { ImageSize } from '@the-canonry/image-store';

export interface ImageDisplayProps {
  /** Image ID to display */
  readonly imageId: string | null | undefined;
  /** Alt text for the image */
  readonly alt?: string;
  /** Image size variant */
  readonly size?: ImageSize;
  /** CSS class applied to the <img> element */
  readonly className?: string;
  /** CSS class applied to the outer container */
  readonly containerClassName?: string;
  /** Called when the image is clicked. Receives the imageId and resolved URL. */
  readonly onClick?: (imageId: string, url: string) => void;
  /** Use loading="lazy" on the img element */
  readonly lazyLoad?: boolean;
  /** Show version cycling indicator when alternates exist */
  readonly enableVersionCycling?: boolean;
  /** Content to show while loading. Defaults to a shimmer placeholder. */
  readonly loadingContent?: React.ReactNode;
  /** Content to show on error/missing. undefined/null = render nothing (default). */
  readonly errorContent?: React.ReactNode;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function ImageDisplay({
  imageId,
  alt = '',
  size = 'thumb',
  className = '',
  containerClassName = '',
  onClick,
  lazyLoad = false,
  enableVersionCycling = false,
  loadingContent,
  errorContent,
}: ImageDisplayProps) {
  const { url, loading, error } = useImageUrl(imageId, size);
  const { group, hasAlternates, count } = useImageAlternates(
    enableVersionCycling ? imageId : null,
  );

  const [altIndex, setAltIndex] = useState<number | null>(null);
  const [imgError, setImgError] = useState(false);

  const handleImgError = useCallback(() => setImgError(true), []);

  // Reset when imageId changes
  const prevIdRef = useRef(imageId);
  useEffect(() => {
    if (prevIdRef.current !== imageId) {
      prevIdRef.current = imageId;
      setAltIndex(null);
      setImgError(false);
    }
  }, [imageId]);

  // Index of the active (selected) version in the group
  const activeIndex = useMemo(() => {
    if (!group) return 0;
    const idx = group.versions.findIndex((v) => v.imageId === group.activeId);
    return idx >= 0 ? idx : 0;
  }, [group]);

  const currentIndex = altIndex ?? activeIndex;
  const currentVersion = group?.versions[currentIndex];
  const isShowingAlternate = altIndex !== null && altIndex !== activeIndex;
  const displayUrl = isShowingAlternate && currentVersion ? currentVersion.url : url;

  const handleCycleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (!group || count < 2) return;
      const next = ((altIndex ?? activeIndex) + 1) % count;
      setAltIndex(next);
      setImgError(false);
    },
    [group, count, altIndex, activeIndex],
  );

  const handleCycleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.stopPropagation();
        e.preventDefault();
        if (!group || count < 2) return;
        const next = ((altIndex ?? activeIndex) + 1) % count;
        setAltIndex(next);
        setImgError(false);
      }
    },
    [group, count, altIndex, activeIndex],
  );

  const handleClick = useCallback(() => {
    const id = currentVersion?.imageId ?? imageId;
    const u = displayUrl;
    if (id && u && onClick) onClick(id, u);
  }, [onClick, currentVersion, imageId, displayUrl]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') handleClick();
    },
    [handleClick],
  );

  // Loading
  if (loading) {
    return (
      <div className={`image-display ${containerClassName}`.trim()}>
        {loadingContent ?? <div className="image-display-loading" />}
      </div>
    );
  }

  // Error / missing
  if (imgError || error || !displayUrl) {
    if (errorContent == null) return null;
    return (
      <div className={`image-display ${containerClassName}`.trim()}>
        {errorContent}
      </div>
    );
  }

  const imgElement = (
    <img
      src={displayUrl}
      alt={alt}
      className={`image-display-img ${className}`.trim()}
      onError={handleImgError}
      loading={lazyLoad ? 'lazy' : undefined}
    />
  );

  const versionIndicator = hasAlternates && enableVersionCycling && (
    <button
      type="button"
      className="image-display-versions"
      onClick={handleCycleClick}
      onKeyDown={handleCycleKeyDown}
      tabIndex={0}
      title={`Version ${currentIndex + 1} of ${count} \u2014 click to cycle`}
    >
      {currentIndex + 1}/{count}
    </button>
  );

  const altLabel = isShowingAlternate && currentVersion && (
    <div className="image-display-alt-label">
      {formatDate(currentVersion.generatedAt)}
    </div>
  );

  return (
    <div className={`image-display ${containerClassName}`.trim()}>
      {onClick ? (
        <button
          type="button"
          className="image-display-btn"
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          tabIndex={0}
        >
          {imgElement}
        </button>
      ) : (
        imgElement
      )}
      {versionIndicator}
      {altLabel}
    </div>
  );
}
