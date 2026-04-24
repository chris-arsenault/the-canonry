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

/* ── Keyboard + touch hooks ────────────────────────────────────────────── */

function useSlideshowKeys(onClose: () => void, goNext: () => void, goPrev: () => void, setPaused: (fn: (p: boolean) => boolean) => void) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      switch (e.key) {
        case "Escape": onClose(); break;
        case " ": e.preventDefault(); setPaused((p) => !p); break;
        case "ArrowRight": case "ArrowDown": goNext(); break;
        case "ArrowLeft": case "ArrowUp": goPrev(); break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, goNext, goPrev, setPaused]);
}

function useSlideshowTouch(goNext: () => void, goPrev: () => void) {
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);
  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    if (Math.abs(dx) > 60) { if (dx < 0) goNext(); else goPrev(); }
    touchStartRef.current = null;
  }, [goNext, goPrev]);
  return { onTouchStart, onTouchEnd };
}

/* ── Timer and state logic ────────────────────────────────────────────── */

function useSlideshowControls(images: readonly CatalogImage[], baseUrl: string, onClose: () => void) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(0);
  const [loadedIndex, setLoadedIndex] = useState(-1);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef<number>(0);

  const interval = SPEEDS[speedIdx];
  const img = images[index];
  const fullUrl = img ? resolveUrl(baseUrl, img.hqPath ?? img.fullPath) : "";
  const fullLoaded = loadedIndex === index;

  useEffect(() => {
    if (!fullLoaded) return;
    const nextImg = images[(index + 1) % images.length];
    const link = document.createElement("link");
    link.rel = "prefetch"; link.as = "image";
    link.href = resolveUrl(baseUrl, nextImg.hqPath ?? nextImg.fullPath);
    document.head.appendChild(link);
    return () => link.remove();
  }, [fullLoaded, index, images, baseUrl]);

  const goNext = useCallback(() => { setIndex((i) => (i + 1) % images.length); setProgress(0); }, [images.length]);
  const goPrev = useCallback(() => { setIndex((i) => (i - 1 + images.length) % images.length); setProgress(0); }, [images.length]);

  useEffect(() => {
    if (paused) { setProgress(0); return; }
    const start = Date.now();
    progressRef.current = window.requestAnimationFrame(function tick() {
      const elapsed = Date.now() - start;
      setProgress(Math.min(elapsed / interval, 1));
      if (elapsed >= interval) goNext(); else progressRef.current = window.requestAnimationFrame(tick);
    });
    return () => { if (progressRef.current) cancelAnimationFrame(progressRef.current); };
  }, [paused, interval, goNext, index]);

  const cycleSpeed = useCallback(() => { setSpeedIdx((i) => (i + 1) % SPEEDS.length); setProgress(0); }, []);
  const togglePause = useCallback(() => { setPaused((p) => !p); }, []);
  const handleLoad = useCallback(() => { setLoadedIndex(index); }, [index]);

  useSlideshowKeys(onClose, goNext, goPrev, setPaused);
  const { onTouchStart, onTouchEnd } = useSlideshowTouch(goNext, goPrev);

  return { img, fullUrl, index, paused, speedIdx, fullLoaded, progress, goNext, goPrev, cycleSpeed, togglePause, handleLoad, onTouchStart, onTouchEnd };
}

/* ── Slideshow component ──────────────────────────────────────────────── */

export default function Slideshow({ images, baseUrl, onClose }: Readonly<SlideshowProps>) {
  const {
    img, fullUrl, index, paused, speedIdx, fullLoaded, progress,
    goNext, goPrev, cycleSpeed, togglePause, handleLoad,
    onTouchStart, onTouchEnd,
  } = useSlideshowControls(images, baseUrl, onClose);

  if (!img) return null;

  return (
    <div className="ss-overlay" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {!paused && (
        <div className="ss-progress">
          {/* eslint-disable-next-line local/no-inline-styles -- animated progress width requires runtime value */}
          <div className="ss-progress-bar" style={{ width: `${progress * 100}%` }} />
        </div>
      )}

      <div className="ss-toolbar">
        <span className="ss-counter">{index + 1} / {images.length}</span>
        <div className="ss-toolbar-actions">
          <button className="ss-btn" onClick={cycleSpeed} title={`Speed: ${SPEED_LABELS[speedIdx]}`}>
            {SPEED_LABELS[speedIdx]}
          </button>
          <button className="ss-btn" onClick={togglePause} title={paused ? "Play (Space)" : "Pause (Space)"}>
            {paused ? "\u25B6" : "\u23F8"}
          </button>
          <button className="ss-btn ss-btn-close" onClick={onClose} title="Close (Esc)">&times;</button>
        </div>
      </div>

      <button className="ss-nav ss-nav-prev" onClick={goPrev} aria-label="Previous">&lsaquo;</button>
      <button className="ss-nav ss-nav-next" onClick={goNext} aria-label="Next">&rsaquo;</button>

      <div className="ss-image-container">
        <img
          src={fullUrl}
          alt={img.title}
          className={`ss-image ${fullLoaded ? "ss-image-loaded" : ""}`}
          draggable={false}
          onLoad={handleLoad}
        />
      </div>

      <div className="ss-caption">
        <span className="ss-title">{img.title}</span>
        {img.imageType === "entity" && <span className="ss-entity">{img.entityName}</span>}
      </div>
    </div>
  );
}
