import React, { useEffect, useCallback, useRef } from "react";
import type { MouseEvent } from "react";
import type { Optional } from "@the-canonry/shared-components";

interface ImageLightboxProps {
  isOpen: boolean;
  imageUrl: string | null;
  title: string;
  summary: Optional<string>;
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
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- dialog role is interactive per WAI-ARIA
    <div
      className="overlay"
      onMouseDown={handleOverlayMouseDown}
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      tabIndex={-1}
      aria-modal="true"
      aria-label={title || "Image viewer"}
    >
      <button onClick={onClose} className="close-button">
        Close
      </button>
      <div className="lb-content">
        <img src={imageUrl} alt={title || "Expanded view"} className="image" />
        <div className="caption">
          {title && <div className="lb-title">{title}</div>}
          {summary && <div className="lb-summary">{summary}</div>}
        </div>
      </div>
    </div>
  );
}
