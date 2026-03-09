/**
 * Slideshow — Auto-advancing full-screen image display.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { CatalogImage } from "./types";
import "./Slideshow.css";

interface SlideshowProps {
  images: CatalogImage[];
  baseUrl: string;
  onClose: () => void;
}

const INTERVAL_MS = 6000;

export default function Slideshow({ images, baseUrl, onClose }: Readonly<SlideshowProps>) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<number>();

  const img = images[index];
  if (!img) return null;

  const fullUrl = baseUrl ? `${baseUrl}/${img.fullPath}` : `/${img.fullPath}`;

  const advance = useCallback(() => {
    setIndex((i) => (i + 1) % images.length);
  }, [images.length]);

  useEffect(() => {
    if (paused) return;
    timerRef.current = window.setInterval(advance, INTERVAL_MS);
    return () => clearInterval(timerRef.current);
  }, [paused, advance]);

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
          advance();
          break;
        case "ArrowLeft":
          setIndex((i) => (i - 1 + images.length) % images.length);
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, advance, images.length]);

  return (
    <div className="ss-overlay" onClick={onClose}>
      <img
        src={fullUrl}
        alt={img.title}
        className="ss-image"
        draggable={false}
        onClick={(e) => e.stopPropagation()}
      />
      <div className="ss-caption" onClick={(e) => e.stopPropagation()}>
        <span className="ss-title">{img.title}</span>
        <span className="ss-controls">
          <button className="ss-btn" onClick={() => setPaused((p) => !p)}>
            {paused ? "\u25B6" : "\u23F8"}
          </button>
          <span className="ss-counter">
            {index + 1}/{images.length}
          </span>
        </span>
      </div>
    </div>
  );
}
