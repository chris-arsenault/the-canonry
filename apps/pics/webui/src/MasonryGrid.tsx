/**
 * MasonryGrid — CSS-columns masonry layout with lazy loading.
 *
 * Since image dimensions are known from catalog.json, we can set
 * aspect-ratio on containers for correct layout before images load.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import type { CatalogImage } from "./types";
import "./MasonryGrid.css";

interface MasonryGridProps {
  images: CatalogImage[];
  baseUrl: string;
  onImageClick: (index: number) => void;
}

const BATCH_SIZE = 40;

export default function MasonryGrid({ images, baseUrl, onImageClick }: Readonly<MasonryGridProps>) {
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset visible count when images change (filter/sort)
  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
  }, [images]);

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
    <div className="masonry">
      {visible.map((img, idx) => (
        <div
          key={img.imageId}
          className="masonry-item"
          onClick={() => onImageClick(idx)}
        >
          <div
            className="masonry-ratio"
            style={{ aspectRatio: `${img.width} / ${img.height}` }}
          >
            <img
              src={resolveUrl(img.thumbPath)}
              alt={img.title}
              loading="lazy"
              decoding="async"
              className="masonry-img"
            />
          </div>
          <div className="masonry-caption">
            <span className="masonry-title">{img.title}</span>
            {img.entityName && (
              <span className="masonry-entity">{img.entityName}</span>
            )}
          </div>
        </div>
      ))}
      {visibleCount < images.length && (
        <div ref={sentinelRef} className="masonry-sentinel" />
      )}
    </div>
  );
}
