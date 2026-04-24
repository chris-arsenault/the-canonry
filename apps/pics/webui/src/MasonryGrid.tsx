/**
 * MasonryGrid — CSS-columns masonry layout with lazy loading.
 *
 * Performance:
 * - Thumbnails only (full images loaded only in lightbox)
 * - Native lazy loading + async decoding
 * - IntersectionObserver infinite scroll (40 at a time)
 * - aspect-ratio containers prevent layout shift (CLS)
 * - width/height attributes for browser layout hints
 * - Fade-in animation on image load
 * - fetchpriority="high" on first visible batch
 */

import { useState, useCallback, useRef, useEffect } from "react";
import type { CatalogImage } from "./types";
import "./MasonryGrid.css";

interface MasonryGridProps {
  images: CatalogImage[];
  baseUrl: string;
  comparePicking: boolean;
  compareSelected: CatalogImage[];
  onImageClick: (index: number) => void;
}

const BATCH_SIZE = 40;
const EAGER_COUNT = 8;

function ShareButton({ imageId }: Readonly<{ imageId: string }>) {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const url = `${window.location.origin}/img/${imageId}`;
      void navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
    },
    [imageId],
  );

  return (
    <button
      className={`masonry-share ${copied ? "masonry-share--copied" : ""}`}
      onClick={handleShare}
      title="Copy link"
    >
      {copied ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      )}
    </button>
  );
}

function GridImage({
  img,
  index,
  resolveUrl,
}: Readonly<{
  img: CatalogImage;
  index: number;
  resolveUrl: (path: string) => string;
}>) {
  const [loaded, setLoaded] = useState(false);
  const isEager = index < EAGER_COUNT;

  return (
    <div
      className="masonry-ratio"
      // eslint-disable-next-line local/no-inline-styles -- per-image aspect ratio requires runtime value
      style={{ aspectRatio: `${img.width} / ${img.height}` }}
    >
      <img
        src={resolveUrl(img.thumbPath)}
        alt={img.title}
        width={img.width}
        height={img.height}
        loading={isEager ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={isEager ? "high" : "auto"}
        className={`masonry-img ${loaded ? "masonry-img-loaded" : ""}`}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}

export default function MasonryGrid({
  images,
  baseUrl,
  comparePicking,
  compareSelected,
  onImageClick,
}: Readonly<MasonryGridProps>) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const prevImagesRef = useRef(images);

  // Reset visible count when images array identity changes (filter/sort)
  // Using ref comparison during render (React-approved getDerivedStateFromProps pattern)
  // eslint-disable-next-line react-hooks/refs -- intentional ref read during render to detect prop changes without an effect
  if (prevImagesRef.current !== images) { prevImagesRef.current = images; setVisibleCount(BATCH_SIZE); }

  const selectedIds = new Set(compareSelected.map((img) => img.imageId));

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < images.length) {
          setVisibleCount((c) => Math.min(c + BATCH_SIZE, images.length));
        }
      },
      { rootMargin: "400px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [visibleCount, images.length]);

  const resolveUrl = useCallback(
    (path: string) => {
      if (baseUrl) return `${baseUrl}/${path}`;
      return `/${path}`;
    },
    [baseUrl],
  );

  const visible = images.slice(0, visibleCount);

  return (
    <div className={`masonry ${comparePicking ? "masonry--picking" : ""}`}>
      {visible.map((img, idx) => {
        const isSelected = selectedIds.has(img.imageId);
        return (
          <div
            key={img.imageId}
            className={`masonry-item ${isSelected ? "masonry-item--selected" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => onImageClick(idx)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onImageClick(idx); } }}
          >
            <GridImage img={img} index={idx} resolveUrl={resolveUrl} />
            {comparePicking && isSelected && (
              <div className="masonry-check">1</div>
            )}
            <div className="masonry-caption">
              <div className="masonry-caption-text">
                <span className="masonry-title">{img.title}</span>
                {img.imageType === "entity" && (
                  <span className="masonry-entity">{img.entityName}</span>
                )}
              </div>
              <ShareButton imageId={img.imageId} />
            </div>
          </div>
        );
      })}
      {visibleCount < images.length && (
        <div ref={sentinelRef} className="masonry-sentinel" />
      )}
    </div>
  );
}
