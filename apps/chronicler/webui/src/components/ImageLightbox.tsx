import React, { useEffect, useCallback, useRef } from "react";
import type { MouseEvent } from "react";
import styles from "./ImageLightbox.module.css";

interface ImageLightboxProps {
  isOpen: boolean;
  imageUrl: string | null;
  title: string;
  summary?: string;
  onClose: () => void;
}

export default function ImageLightbox({
  isOpen,
  imageUrl,
  title,
  summary,
  onClose,
}: Readonly<ImageLightboxProps>) {
  const mouseDownOnOverlay = useRef(false);

  const handleOverlayMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    mouseDownOnOverlay.current = e.target === e.currentTarget;
  };

  const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if (mouseDownOnOverlay.current && e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return undefined;
    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !imageUrl) return null;

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex -- dialog overlay needs interaction handlers
    <div
      className={styles.overlay}
      onMouseDown={handleOverlayMouseDown}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label={title || "Image viewer"}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleOverlayClick(e); }}
    >
      <button onClick={onClose} className={styles.closeButton}>
        Close
      </button>
      <div className={styles.content}>
        <img src={imageUrl} alt={title || "Expanded view"} className={styles.image} />
        <div className={styles.caption}>
          {title && <div className={styles.title}>{title}</div>}
          {summary && <div className={styles.summary}>{summary}</div>}
        </div>
      </div>
    </div>
  );
}
