/**
 * ChronicleImagePicker - Browse and select chronicle images with scoped filters
 *
 * Filters:
 * - "This ref only" - show images generated for this specific imageRefId
 * - "This chronicle only" - show images generated for this chronicle
 * Both filters default to ON to show most relevant images first.
 * Uses pagination to avoid loading entire library.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import { searchChronicleImages, loadImage } from "../lib/db/imageRepository";
import { useAsyncAction } from "../hooks/useAsyncAction";
import "./ChronicleImagePicker.css";

const PAGE_SIZE = 12;

/**
 * Lazy-loading thumbnail that only loads the blob when visible.
 */
function LazyThumbnail({ imageId, alt, className }) {
  const ref = useRef(null);
  const [url, setUrl] = useState(null);
  const urlRef = useRef(null);

  useEffect(() => {
    if (!ref.current || !imageId) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          observer.disconnect();
          loadImage(imageId).then((result) => {
            if (result?.url) {
              setUrl(result.url);
              urlRef.current = result.url;
            }
          });
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, [imageId]);

  return (
    <div ref={ref} className={className}>
      {url ? (
        <img src={url} alt={alt} className="ilu-thumb-cover" />
      ) : (
        <div className="ilu-thumb-placeholder">Loading...</div>
      )}
    </div>
  );
}

function formatDate(timestamp) {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

LazyThumbnail.propTypes = {
  imageId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  alt: PropTypes.string,
  className: PropTypes.string,
};

export default function ChronicleImagePicker({
  isOpen,
  onClose,
  onSelect,
  projectId,
  chronicleId,
  imageRefId,
  currentImageId,
}) {
  const [images, setImages] = useState([]);
  const { busy: loading, run } = useAsyncAction();
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [selectedImageId, setSelectedImageId] = useState(null);

  // Filter state - both default ON
  const [filterByRef, setFilterByRef] = useState(true);
  const [filterByChronicle, setFilterByChronicle] = useState(true);

  const mouseDownOnOverlay = useRef(false);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setImages([]);
      setSelectedImageId(null);
      setFilterByRef(true);
      setFilterByChronicle(true);
      setHasMore(false);
      setTotal(0);
    }
  }, [isOpen]);

  // Load images when filters change
  useEffect(() => {
    if (!isOpen || !projectId) return;

    void run("load", async () => {
      const filters = {
        projectId,
        limit: PAGE_SIZE,
        offset: 0,
      };

      // Apply filters based on checkbox state
      // If filterByRef is ON, filter by imageRefId (most specific)
      // If filterByRef is OFF but filterByChronicle is ON, filter by chronicleId
      // If both OFF, show all chronicle images for project
      if (filterByRef && imageRefId) {
        filters.imageRefId = imageRefId;
        // When filtering by ref, also filter by chronicle for efficiency
        if (chronicleId) filters.chronicleId = chronicleId;
      } else if (filterByChronicle && chronicleId) {
        filters.chronicleId = chronicleId;
      }

      const result = await searchChronicleImages(filters);
      setImages(result.items);
      setHasMore(result.hasMore);
      setTotal(result.total);
    });
  }, [isOpen, projectId, chronicleId, imageRefId, filterByRef, filterByChronicle, run]);

  // Load more handler
  const handleLoadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    await run("load-more", async () => {
      const filters = {
        projectId,
        limit: PAGE_SIZE,
        offset: images.length,
      };

      if (filterByRef && imageRefId) {
        filters.imageRefId = imageRefId;
        if (chronicleId) filters.chronicleId = chronicleId;
      } else if (filterByChronicle && chronicleId) {
        filters.chronicleId = chronicleId;
      }

      const result = await searchChronicleImages(filters);
      setImages((prev) => [...prev, ...result.items]);
      setHasMore(result.hasMore);
    });
  }, [
    loading,
    hasMore,
    projectId,
    chronicleId,
    imageRefId,
    filterByRef,
    filterByChronicle,
    images.length,
    run,
  ]);

  // Handle selection
  const handleSelect = useCallback(() => {
    if (selectedImageId && onSelect) {
      const selectedImage = images.find((img) => img.imageId === selectedImageId);
      onSelect(selectedImageId, selectedImage);
    }
    onClose();
  }, [selectedImageId, images, onSelect, onClose]);

  // Handle close
  const handleClose = useCallback(() => {
    setSelectedImageId(null);
    onClose();
  }, [onClose]);

  // Overlay click handling
  const handleOverlayMouseDown = (e) => {
    mouseDownOnOverlay.current = e.target === e.currentTarget;
  };

  const handleOverlayClick = (e) => {
    if (mouseDownOnOverlay.current && e.target === e.currentTarget) {
      handleClose();
    }
  };

  // Close on escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") handleClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  return (
    <div
      className="illuminator-modal-overlay"
      onMouseDown={handleOverlayMouseDown}
      onClick={handleOverlayClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleOverlayClick(e); }}
    >
      <div className="illuminator-modal cip-modal">
        <div className="illuminator-modal-header">
          <h3>Select Existing Image</h3>
          <button onClick={handleClose} className="illuminator-modal-close">
            &times;
          </button>
        </div>

        <div className="illuminator-modal-body cip-body">
          {/* Filters */}
          <div className="cip-filters">
            <label className="cip-filter-label">
              <input
                type="checkbox"
                checked={filterByRef}
                onChange={(e) => setFilterByRef(e.target.checked)}
              />
              This ref only
            </label>

            <label className="cip-filter-label">
              <input
                type="checkbox"
                checked={filterByChronicle}
                onChange={(e) => setFilterByChronicle(e.target.checked)}
              />
              This chronicle only
            </label>

            <span className="cip-filter-count">
              {total} image{total !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Image grid */}
          <div className="cip-grid-area">
            {loading && images.length === 0 && (
              <div className="ilu-empty cip-empty-state">Loading images...</div>
            )}
            {!loading && images.length === 0 && (
              <div className="ilu-empty cip-empty-state">
                No images found. Try unchecking filters to see more.
              </div>
            )}
            {images.length > 0 && (
              <>
                <div className="cip-grid">
                  {images.map((img) => {
                    const isSelected = selectedImageId === img.imageId;
                    const isCurrent = currentImageId === img.imageId;

                    return (
                      <div
                        key={img.imageId}
                        onClick={() => setSelectedImageId(img.imageId)}
                        className={(() => {
                          if (isSelected) return "cip-image-card cip-image-card-selected";
                          if (isCurrent) return "cip-image-card cip-image-card-current";
                          return "cip-image-card";
                        })()}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
                      >
                        <LazyThumbnail
                          imageId={img.imageId}
                          alt={img.sceneDescription || "Chronicle image"}
                          className="cip-thumb-container"
                        />

                        {/* Current indicator */}
                        {isCurrent && <div className="cip-current-badge">Current</div>}

                        {/* Date overlay */}
                        <div className="cip-date-overlay">{formatDate(img.generatedAt)}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Load more button */}
                {hasMore && (
                  <div className="cip-load-more-wrapper">
                    <button
                      onClick={() => void handleLoadMore()}
                      disabled={loading}
                      className="cip-load-more-btn"
                    >
                      {loading ? "Loading..." : `Load More (${total - images.length} remaining)`}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="illuminator-modal-footer cip-footer">
          <button onClick={handleClose} className="cip-cancel-btn">
            Cancel
          </button>
          <button
            onClick={handleSelect}
            disabled={!selectedImageId}
            className={`cip-select-btn ${selectedImageId ? "cip-select-btn-active" : "cip-select-btn-disabled"}`}
          >
            Select Image
          </button>
        </div>
      </div>
    </div>
  );
}

ChronicleImagePicker.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
  onSelect: PropTypes.func,
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  chronicleId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  imageRefId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  currentImageId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};
