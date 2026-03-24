/**
 * ThumbnailStrip — Horizontal carousel of image thumbnails with Use/Active selection.
 *
 * Lazily loads image blobs: only fetches blobs for thumbnails that are visible
 * on screen via IntersectionObserver. Accepts imageIds (not pre-loaded URLs)
 * so parent components never need to batch-load blobs.
 *
 * Used by both CurationImageSheet (chronicle images) and EntityImageSheet (entity images).
 */

import React, { useState, useEffect, useRef } from "react";
import { useImageUrl } from "@the-canonry/image-store";
import "./ThumbnailStrip.css";

interface ThumbnailStripProps {
  imageIds: string[];
  selectedImageId?: string;
  onSelect: (imageId: string) => void;
  onViewFull: (info: { imageId: string; title: string }) => void;
}

export default function ThumbnailStrip({
  imageIds,
  selectedImageId,
  onSelect,
  onViewFull,
}: Readonly<ThumbnailStripProps>) {
  // Defer all loading until the strip container enters the viewport
  const stripRef = useRef<HTMLDivElement | null>(null);
  const [isStripVisible, setIsStripVisible] = useState(false);
  const hasImages = imageIds.length > 0;

  useEffect(() => {
    if (!hasImages) return; // Nothing to observe yet
    const node = stripRef.current;
    if (!node || isStripVisible) return;

    if (typeof IntersectionObserver === "undefined") {
      setIsStripVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsStripVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.01, rootMargin: "200px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [isStripVisible, hasImages]);

  // Always render the container so the ref is stable for the IO observer.
  // When imageIds transitions from empty → populated, the effect re-runs
  // (hasImages changed) and can now observe the already-mounted div.
  if (!hasImages) return <div ref={stripRef} />;

  const isActive = (id: string) => id === selectedImageId;

  return (
    <div ref={stripRef} className="cis-thumb-strip">
      {imageIds.map((imageId) => (
        <LazyThumb
          key={imageId}
          imageId={imageId}
          active={isActive(imageId)}
          visible={isStripVisible}
          onSelect={onSelect}
          onViewFull={onViewFull}
        />
      ))}
    </div>
  );
}

function LazyThumb({
  imageId,
  active,
  visible,
  onSelect,
  onViewFull,
}: Readonly<{
  imageId: string;
  active: boolean;
  visible: boolean;
  onSelect: (imageId: string) => void;
  onViewFull: (info: { imageId: string; title: string }) => void;
}>) {
  // Only pass imageId to useImageUrl when the strip is visible
  const { url, loading } = useImageUrl(visible ? imageId : null);

  return (
    <div className="cis-thumb-slot">
      {loading || !visible ? (
        <div className="cis-thumb-placeholder">...</div>
      ) : url ? (
        <img
          className={`cis-thumb${active ? " cis-thumb-selected" : ""}`}
          src={url}
          alt=""
          onClick={() => onViewFull({ imageId, title: "Image" })}
          title="View full size"
        />
      ) : (
        <div className="cis-thumb-placeholder">?</div>
      )}
      {active ? (
        <span className="cis-use-button-active">Active</span>
      ) : (
        <button className="cis-use-button" onClick={() => onSelect(imageId)}>
          Use
        </button>
      )}
    </div>
  );
}
