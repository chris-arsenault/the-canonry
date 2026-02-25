/**
 * ChronicleImagePicker - Browse and select chronicle images with scoped filters
 *
 * Filters:
 * - "This ref only" - show images generated for this specific imageRefId
 * - "This chronicle only" - show images generated for this chronicle
 * Both filters default to ON to show most relevant images first.
 * Uses pagination to avoid loading entire library.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { searchChronicleImages, loadImage } from "../lib/db/imageRepository";

const PAGE_SIZE = 12;

/**
 * Lazy-loading thumbnail that only loads the blob when visible.
 */
function LazyThumbnail({ imageId, alt, style }) {
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
    <div ref={ref} style={style}>
      {url ? (
        <img
          src={url}
          alt={alt}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-muted)",
            fontSize: "11px",
          }}
        >
          Loading...
        </div>
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
  const [loading, setLoading] = useState(false);
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

    async function loadData() {
      setLoading(true);
      try {
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
      } catch (err) {
        console.error("Failed to load chronicle images:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [isOpen, projectId, chronicleId, imageRefId, filterByRef, filterByChronicle]);

  // Load more handler
  const handleLoadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    try {
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
    } catch (err) {
      console.error("Failed to load more images:", err);
    } finally {
      setLoading(false);
    }
  }, [
    loading,
    hasMore,
    projectId,
    chronicleId,
    imageRefId,
    filterByRef,
    filterByChronicle,
    images.length,
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
    >
      <div className="illuminator-modal" style={{ maxWidth: "800px", maxHeight: "85vh" }}>
        <div className="illuminator-modal-header">
          <h3>Select Existing Image</h3>
          <button onClick={handleClose} className="illuminator-modal-close">
            &times;
          </button>
        </div>

        <div className="illuminator-modal-body" style={{ padding: "0" }}>
          {/* Filters */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "20px",
              padding: "12px 16px",
              borderBottom: "1px solid var(--border-color)",
              background: "var(--bg-tertiary)",
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={filterByRef}
                onChange={(e) => setFilterByRef(e.target.checked)}
              />
              This ref only
            </label>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={filterByChronicle}
                onChange={(e) => setFilterByChronicle(e.target.checked)}
              />
              This chronicle only
            </label>

            <span style={{ marginLeft: "auto", fontSize: "12px", color: "var(--text-muted)" }}>
              {total} image{total !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Image grid */}
          <div style={{ padding: "16px", maxHeight: "450px", overflowY: "auto" }}>
            {loading && images.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                Loading images...
              </div>
            ) : images.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                No images found. Try unchecking filters to see more.
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                    gap: "12px",
                  }}
                >
                  {images.map((img) => {
                    const isSelected = selectedImageId === img.imageId;
                    const isCurrent = currentImageId === img.imageId;

                    return (
                      <div
                        key={img.imageId}
                        onClick={() => setSelectedImageId(img.imageId)}
                        style={{
                          position: "relative",
                          aspectRatio: "1",
                          borderRadius: "8px",
                          overflow: "hidden",
                          cursor: "pointer",
                          border: isSelected
                            ? "3px solid #3b82f6"
                            : isCurrent
                              ? "3px solid #10b981"
                              : "1px solid var(--border-color)",
                          background: "var(--bg-tertiary)",
                        }}
                      >
                        <LazyThumbnail
                          imageId={img.imageId}
                          alt={img.sceneDescription || "Chronicle image"}
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: "100%",
                          }}
                        />

                        {/* Current indicator */}
                        {isCurrent && (
                          <div
                            style={{
                              position: "absolute",
                              top: "4px",
                              left: "4px",
                              padding: "2px 6px",
                              background: "#10b981",
                              color: "white",
                              fontSize: "9px",
                              fontWeight: 600,
                              borderRadius: "4px",
                            }}
                          >
                            Current
                          </div>
                        )}

                        {/* Date overlay */}
                        <div
                          style={{
                            position: "absolute",
                            bottom: 0,
                            left: 0,
                            right: 0,
                            padding: "4px 6px",
                            background: "linear-gradient(transparent, rgba(0,0,0,0.7))",
                            fontSize: "10px",
                            color: "white",
                          }}
                        >
                          {formatDate(img.generatedAt)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Load more button */}
                {hasMore && (
                  <div style={{ textAlign: "center", marginTop: "16px" }}>
                    <button
                      onClick={handleLoadMore}
                      disabled={loading}
                      style={{
                        padding: "8px 20px",
                        background: "var(--bg-tertiary)",
                        border: "1px solid var(--border-color)",
                        borderRadius: "6px",
                        color: "var(--text-secondary)",
                        cursor: loading ? "not-allowed" : "pointer",
                        opacity: loading ? 0.6 : 1,
                        fontSize: "12px",
                      }}
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
        <div
          className="illuminator-modal-footer"
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
            padding: "12px 16px",
            borderTop: "1px solid var(--border-color)",
          }}
        >
          <button
            onClick={handleClose}
            style={{
              padding: "8px 16px",
              background: "var(--bg-tertiary)",
              border: "1px solid var(--border-color)",
              borderRadius: "6px",
              color: "var(--text-secondary)",
              cursor: "pointer",
              fontSize: "12px",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSelect}
            disabled={!selectedImageId}
            style={{
              padding: "8px 16px",
              background: selectedImageId ? "#3b82f6" : "var(--bg-tertiary)",
              border: "none",
              borderRadius: "6px",
              color: selectedImageId ? "white" : "var(--text-muted)",
              cursor: selectedImageId ? "pointer" : "not-allowed",
              fontSize: "12px",
              fontWeight: 500,
            }}
          >
            Select Image
          </button>
        </div>
      </div>
    </div>
  );
}
