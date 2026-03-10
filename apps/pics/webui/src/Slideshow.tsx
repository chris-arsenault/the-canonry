/**
 * Slideshow — Auto-advancing full-screen image display.
 *
 * Controls: close, pause/play, speed toggle, prev/next arrows, touch swipe.
 * Receives filtered image list from parent — respects active filters.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { CatalogImage } from "./types";
import "./Slideshow.css";

interface SlideshowProps {
  images: CatalogImage[];
  baseUrl: string;
  onClose: () => void;
}

const SPEEDS = [4000, 7000, 12000] as const;
const SPEED_LABELS = ["4s", "7s", "12s"] as const;

function resolveUrl(baseUrl: string, path: string): string {
  return baseUrl ? `${baseUrl}/${path}` : `/${path}`;
}

export default function Slideshow({ images, baseUrl, onClose }: Readonly<SlideshowProps>) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(0);
  const [fullLoaded, setFullLoaded] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<number>(0);
  const progressRef = useRef<number>(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const interval = SPEEDS[speedIdx];
  const img = images[index];
  if (!img) return null;

  const fullUrl = resolveUrl(baseUrl, img.fullPath);

  // Reset loaded state on slide change
  useEffect(() => {
    setFullLoaded(false);
  }, [index]);

  // Prefetch next slide after current loads
  useEffect(() => {
    if (!fullLoaded) return;
    const nextImg = images[(index + 1) % images.length];
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.as = "image";
    link.href = resolveUrl(baseUrl, nextImg.fullPath);
    document.head.appendChild(link);
    return () => link.remove();
  }, [fullLoaded, index, images, baseUrl]);

  const goNext = useCallback(() => {
    setIndex((i) => (i + 1) % images.length);
    setProgress(0);
  }, [images.length]);

  const goPrev = useCallback(() => {
    setIndex((i) => (i - 1 + images.length) % images.length);
    setProgress(0);
  }, [images.length]);

  // Auto-advance timer
  useEffect(() => {
    if (paused) {
      setProgress(0);
      return;
    }
    const start = Date.now();
    progressRef.current = window.requestAnimationFrame(function tick() {
      const elapsed = Date.now() - start;
      setProgress(Math.min(elapsed / interval, 1));
      if (elapsed >= interval) {
        goNext();
      } else {
        progressRef.current = window.requestAnimationFrame(tick);
      }
    });
    return () => {
      if (progressRef.current) cancelAnimationFrame(progressRef.current);
    };
  }, [paused, interval, goNext, index]);

  const cycleSpeed = useCallback(() => {
    setSpeedIdx((i) => (i + 1) % SPEEDS.length);
    setProgress(0);
  }, []);

  // Keyboard
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case " ":
          e.preventDefault();
          setPaused((p) => !p);
          break;
        case "ArrowRight":
        case "ArrowDown":
          goNext();
          break;
        case "ArrowLeft":
        case "ArrowUp":
          goPrev();
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, goNext, goPrev]);

  // Touch swipe
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartRef.current) return;
      const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
      if (Math.abs(dx) > 60) {
        if (dx < 0) goNext();
        else goPrev();
      }
      touchStartRef.current = null;
    },
    [goNext, goPrev],
  );

  return (
    <div
      className="ss-overlay"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Progress bar */}
      {!paused && (
        <div className="ss-progress">
          <div className="ss-progress-bar" style={{ width: `${progress * 100}%` }} />
        </div>
      )}

      {/* Top toolbar */}
      <div className="ss-toolbar">
        <span className="ss-counter">
          {index + 1} / {images.length}
        </span>
        <div className="ss-toolbar-actions">
          <button className="ss-btn" onClick={cycleSpeed} title={`Speed: ${SPEED_LABELS[speedIdx]}`}>
            {SPEED_LABELS[speedIdx]}
          </button>
          <button className="ss-btn" onClick={() => setPaused((p) => !p)} title={paused ? "Play (Space)" : "Pause (Space)"}>
            {paused ? "\u25B6" : "\u23F8"}
          </button>
          <button className="ss-btn ss-btn-close" onClick={onClose} title="Close (Esc)">
            &times;
          </button>
        </div>
      </div>

      {/* Nav arrows */}
      <button className="ss-nav ss-nav-prev" onClick={goPrev} aria-label="Previous">
        &lsaquo;
      </button>
      <button className="ss-nav ss-nav-next" onClick={goNext} aria-label="Next">
        &rsaquo;
      </button>

      {/* Image */}
      <div className="ss-image-container">
        <img
          src={fullUrl}
          alt={img.title}
          className={`ss-image ${fullLoaded ? "ss-image-loaded" : ""}`}
          draggable={false}
          onLoad={() => setFullLoaded(true)}
        />
      </div>

      {/* Caption */}
      <div className="ss-caption">
        <span className="ss-title">{img.title}</span>
        {img.entityName && <span className="ss-entity">{img.entityName}</span>}
      </div>
    </div>
  );
}
