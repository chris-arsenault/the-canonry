/**
 * Lightbox — Full-screen image viewer with keyboard/swipe navigation.
 *
 * Loads one image: the full-size WebP. No thumbnail placeholder,
 * no eager preloading. Adjacent images preload only after current loads.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { CatalogImage } from "./types";
import "./Lightbox.css";

interface LightboxProps {
  images: CatalogImage[];
  currentIndex: number;
  baseUrl: string;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

function resolveUrl(baseUrl: string, path: string): string {
  return baseUrl ? `${baseUrl}/${path}` : `/${path}`;
}

export default function Lightbox({
  images,
  currentIndex,
  baseUrl,
  onClose,
  onNavigate,
}: Readonly<LightboxProps>) {
  const [showInfo, setShowInfo] = useState(false);
  const [scale, setScale] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [shareToast, setShareToast] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number; dist?: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const img = images[currentIndex];
  if (!img) return null;

  const fullUrl = resolveUrl(baseUrl, img.fullPath);

  // Reset loaded state when navigating
  useEffect(() => {
    setLoaded(false);
  }, [currentIndex]);

  // Preload adjacent images after current loads (link prefetch, no JS Image objects)
  useEffect(() => {
    if (!loaded) return;
    const links: HTMLLinkElement[] = [];
    for (const offset of [1, -1]) {
      const adj = images[currentIndex + offset];
      if (!adj) continue;
      const link = document.createElement("link");
      link.rel = "prefetch";
      link.as = "image";
      link.href = resolveUrl(baseUrl, adj.fullPath);
      document.head.appendChild(link);
      links.push(link);
    }
    return () => links.forEach((l) => l.remove());
  }, [loaded, currentIndex, images, baseUrl]);

  const goNext = useCallback(() => {
    if (currentIndex < images.length - 1) {
      onNavigate(currentIndex + 1);
      setScale(1);
    }
  }, [currentIndex, images.length, onNavigate]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      onNavigate(currentIndex - 1);
      setScale(1);
    }
  }, [currentIndex, onNavigate]);

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: img.title, url });
      } catch {
        // User cancelled share — ignore
      }
    } else {
      await navigator.clipboard.writeText(url);
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2000);
    }
  }, [img.title]);

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowRight":
        case "ArrowDown":
          goNext();
          break;
        case "ArrowLeft":
        case "ArrowUp":
          goPrev();
          break;
        case "i":
          setShowInfo((s) => !s);
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, goNext, goPrev]);

  // Touch swipe and pinch
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchStartRef.current = { x: 0, y: 0, dist: Math.hypot(dx, dy) };
    }
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartRef.current) return;
      if (touchStartRef.current.dist !== undefined) {
        touchStartRef.current = null;
        return;
      }
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStartRef.current.x;
      const threshold = 60;
      if (Math.abs(dx) > threshold) {
        if (dx < 0) goNext();
        else goPrev();
      }
      touchStartRef.current = null;
    },
    [goNext, goPrev],
  );

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartRef.current?.dist) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / touchStartRef.current.dist;
      setScale((s) => Math.max(0.5, Math.min(4, s * ratio)));
      touchStartRef.current.dist = dist;
    }
  }, []);

  return (
    <div
      className="lb-overlay"
      ref={containerRef}
      onClick={(e) => {
        if (e.target === containerRef.current) onClose();
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchMove={onTouchMove}
    >
      <div className="lb-toolbar">
        <span className="lb-counter">
          {currentIndex + 1} / {images.length}
        </span>
        <div className="lb-actions">
          <button className="lb-btn" onClick={handleShare} title="Share link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
          </button>
          <button className="lb-btn" onClick={() => setShowInfo((s) => !s)} title="Toggle info (i)">
            i
          </button>
          <button className="lb-btn" onClick={onClose} title="Close (Esc)">
            &times;
          </button>
        </div>
      </div>

      {shareToast && <div className="lb-toast">Link copied</div>}

      <button
        className="lb-nav lb-nav-prev"
        onClick={goPrev}
        disabled={currentIndex === 0}
        aria-label="Previous"
      >
        &lsaquo;
      </button>

      <div className="lb-image-container">
        <img
          src={fullUrl}
          alt={img.title}
          className={`lb-image ${loaded ? "lb-image-loaded" : ""}`}
          style={{ transform: `scale(${scale})` }}
          draggable={false}
          onLoad={() => setLoaded(true)}
        />
      </div>

      <button
        className="lb-nav lb-nav-next"
        onClick={goNext}
        disabled={currentIndex === images.length - 1}
        aria-label="Next"
      >
        &rsaquo;
      </button>

      {showInfo && (
        <div className="lb-info">
          <h3 className="lb-info-title">{img.title}</h3>
          {img.entityName && <div className="lb-info-entity">{img.entityName}</div>}
          <div className="lb-info-meta">
            <span>{img.imageType}</span>
            <span>{img.width}&times;{img.height}</span>
            <span>{img.model}</span>
          </div>
          {img.tags.length > 0 && (
            <div className="lb-info-tags">
              {img.tags.map((t) => (
                <span key={t} className="lb-tag">{t}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
