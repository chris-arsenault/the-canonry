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

interface TouchStart {
  x: number;
  y: number;
  dist: number | null;
}

function resolveUrl(baseUrl: string, path: string): string {
  return baseUrl ? `${baseUrl}/${path}` : `/${path}`;
}

/* ── Navigation + share logic ────────────────────────────────────────── */

function useLightboxNav(
  images: readonly CatalogImage[],
  currentIndex: number,
  onClose: () => void,
  onNavigate: (index: number) => void,
) {
  const [showInfo, setShowInfo] = useState(false);
  const [scale, setScale] = useState(1);
  const [shareToast, setShareToast] = useState(false);

  const goNext = useCallback(() => {
    if (currentIndex < images.length - 1) { onNavigate(currentIndex + 1); setScale(1); }
  }, [currentIndex, images.length, onNavigate]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) { onNavigate(currentIndex - 1); setScale(1); }
  }, [currentIndex, onNavigate]);

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    const title = images[currentIndex]?.title ?? "";
    if (navigator.share) {
      try { await navigator.share({ title, url }); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2000);
    }
  }, [images, currentIndex]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" || e.key === "ArrowDown") goNext();
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") goPrev();
      else if (e.key === "i") setShowInfo((s) => !s);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, goNext, goPrev]);

  const toggleInfo = useCallback(() => { setShowInfo((s) => !s); }, []);

  return { showInfo, scale, setScale, shareToast, goNext, goPrev, handleShare, toggleInfo };
}

/* ── Touch handling (swipe + pinch) ───────────────────────────────────── */

function useLightboxTouch(goNext: () => void, goPrev: () => void, setScale: (fn: (s: number) => number) => void) {
  const touchStartRef = useRef<TouchStart | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, dist: null };
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchStartRef.current = { x: 0, y: 0, dist: Math.hypot(dx, dy) };
    }
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    if (touchStartRef.current.dist !== null) { touchStartRef.current = null; return; }
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    if (Math.abs(dx) > 60) { if (dx < 0) goNext(); else goPrev(); }
    touchStartRef.current = null;
  }, [goNext, goPrev]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartRef.current?.dist) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const newDist = Math.hypot(dx, dy);
      const ratio = newDist / touchStartRef.current.dist;
      setScale((s) => Math.max(0.5, Math.min(4, s * ratio)));
      touchStartRef.current.dist = newDist;
    }
  }, [setScale]);

  return { onTouchStart, onTouchEnd, onTouchMove };
}

/* ── Image loading + prefetch ─────────────────────────────────────────── */

function useLightboxImage(images: readonly CatalogImage[], currentIndex: number, baseUrl: string) {
  const [loadedIndex, setLoadedIndex] = useState(-1);
  const loaded = loadedIndex === currentIndex;
  const img = images[currentIndex];
  const fullUrl = img ? resolveUrl(baseUrl, img.hqPath ?? img.fullPath) : "";

  // Prefetch adjacent after current loads
  useEffect(() => {
    if (!loaded) return;
    const links: HTMLLinkElement[] = [];
    for (const offset of [1, -1]) {
      const adj = images[currentIndex + offset];
      if (!adj) continue;
      const link = document.createElement("link");
      link.rel = "prefetch";
      link.as = "image";
      link.href = resolveUrl(baseUrl, adj.hqPath ?? adj.fullPath);
      document.head.appendChild(link);
      links.push(link);
    }
    return () => links.forEach((l) => l.remove());
  }, [loaded, currentIndex, images, baseUrl]);

  const handleLoad = useCallback(() => { setLoadedIndex(currentIndex); }, [currentIndex]);

  return { img, fullUrl, loaded, handleLoad };
}

/* ── Info panel ───────────────────────────────────────────────────────── */

function LightboxInfo({ img }: Readonly<{ img: CatalogImage }>) {
  return (
    <div className="lb-info">
      <h3 className="lb-info-title">{img.title}</h3>
      {img.imageType === "entity" && <div className="lb-info-entity">{img.entityName}</div>}
      <div className="lb-info-meta">
        <span>{img.imageType}</span>
        <span>{img.width}&times;{img.height}</span>
        <span>{img.model}</span>
      </div>
      {img.tags.length > 0 && (
        <div className="lb-info-tags">
          {img.tags.map((t) => <span key={t} className="lb-tag">{t}</span>)}
        </div>
      )}
    </div>
  );
}

/* ── Lightbox component ───────────────────────────────────────────────── */

export default function Lightbox({
  images, currentIndex, baseUrl, onClose, onNavigate,
}: Readonly<LightboxProps>) {
  const { img, fullUrl, loaded, handleLoad } = useLightboxImage(images, currentIndex, baseUrl);
  const { showInfo, scale, setScale, shareToast, goNext, goPrev, handleShare, toggleInfo } =
    useLightboxNav(images, currentIndex, onClose, onNavigate);
  const { onTouchStart, onTouchEnd, onTouchMove } = useLightboxTouch(goNext, goPrev, setScale);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  const handleShareClick = useCallback(() => { void handleShare(); }, [handleShare]);

  if (!img) return null;

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- dialog overlay dismissal via click; keyboard handled by Escape key in useLightboxNav
    <div
      className="lb-overlay"
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={img.title}
      onClick={handleOverlayClick}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchMove={onTouchMove}
    >
      <div className="lb-toolbar">
        <span className="lb-counter">{currentIndex + 1} / {images.length}</span>
        <div className="lb-actions">
          <button className="lb-btn" onClick={handleShareClick} title="Share link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
          </button>
          <button className="lb-btn" onClick={toggleInfo} title="Toggle info (i)">i</button>
          <button className="lb-btn" onClick={onClose} title="Close (Esc)">&times;</button>
        </div>
      </div>

      {shareToast && <div className="lb-toast">Link copied</div>}

      <button className="lb-nav lb-nav-prev" onClick={goPrev} disabled={currentIndex === 0} aria-label="Previous">
        &lsaquo;
      </button>

      <div className="lb-image-container">
        <img
          src={fullUrl}
          alt={img.title}
          className={`lb-image ${loaded ? "lb-image-loaded" : ""}`}
          // eslint-disable-next-line local/no-inline-styles -- dynamic pinch-zoom scale requires runtime value
          style={{ transform: `scale(${scale})` }}
          draggable={false}
          onLoad={handleLoad}
        />
      </div>

      <button className="lb-nav lb-nav-next" onClick={goNext} disabled={currentIndex === images.length - 1} aria-label="Next">
        &rsaquo;
      </button>

      {showInfo && <LightboxInfo img={img} />}
    </div>
  );
}
