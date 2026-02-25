/**
 * ImagePickerModal - Browse and select an image from the library
 *
 * Used to assign existing images to entities instead of generating new ones.
 * Shows all images in the library with filtering by entity kind and culture.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import {
  searchImagesWithFilters as searchImages,
  getImageFilterOptions,
  loadImage,
  formatBytes,
} from "../lib/db/imageRepository";
import "./ImagePickerModal.css";

/**
 * Lazy-loading thumbnail that only loads the blob when visible via IntersectionObserver.
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
        <img src={url} alt={alt} className="ipm-thumbnail-img" />
      ) : (
        <div className="ipm-thumbnail-placeholder">Loading...</div>
      )}
    </div>
  );
}

/**
 * Format a timestamp to a readable date string
 */
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

export default function ImagePickerModal({
  isOpen,
  onClose,
  onSelect,
  entityKind,
  entityCulture,
  currentImageId,
}) {
  const [images, setImages] = useState([]);
  const mouseDownOnOverlay = useRef(false);

  const handleOverlayMouseDown = (e) => {
    mouseDownOnOverlay.current = e.target === e.currentTarget;
  };

  const handleOverlayClick = (e) => {
    if (mouseDownOnOverlay.current && e.target === e.currentTarget) {
      handleClose();
    }
  };
  const [loading, setLoading] = useState(true);
  const [selectedImageId, setSelectedImageId] = useState(null);
  const [filterKind, setFilterKind] = useState("all");
  const [filterCulture, setFilterCulture] = useState("all");
  const [filterModel, setFilterModel] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [expandedPrompt, setExpandedPrompt] = useState(null);
  const [filterOptions, setFilterOptions] = useState({ kinds: [], cultures: [], models: [] });

  // Load filter options when modal opens
  useEffect(() => {
    if (!isOpen) return;

    async function loadFilterOptions() {
      try {
        const [kinds, cultures, models] = await Promise.all([
          getImageFilterOptions("entity-kind"),
          getImageFilterOptions("entityCulture"),
          getImageFilterOptions("model"),
        ]);
        setFilterOptions({ kinds, cultures, models });
      } catch (err) {
        console.error("Failed to load filter options:", err);
      }
    }

    loadFilterOptions();
    // Reset filters on open
    setFilterKind("all");
    setFilterCulture("all");
    setFilterModel("all");
    setSearchText("");
  }, [isOpen]);

  // Load images when filters change
  useEffect(() => {
    if (!isOpen) return;

    async function loadData() {
      setLoading(true);
      try {
        const filters = {};
        if (filterKind !== "all") filters.entityKind = filterKind;
        if (filterCulture !== "all") filters.entityCulture = filterCulture;
        if (filterModel !== "all") filters.model = filterModel;
        if (searchText.trim()) filters.searchText = searchText.trim();

        const results = await searchImages(filters);
        setImages(results);
      } catch (err) {
        console.error("Failed to load images:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [isOpen, filterKind, filterCulture, filterModel, searchText]);

  // Handle selection
  const handleSelect = useCallback(() => {
    if (selectedImageId && onSelect) {
      // Find the selected image to get its metadata
      const selectedImage = images.find((img) => img.imageId === selectedImageId);
      onSelect(selectedImageId, selectedImage);
    }
    onClose();
  }, [selectedImageId, images, onSelect, onClose]);

  // Handle close
  const handleClose = useCallback(() => {
    setSelectedImageId(null);
    setExpandedPrompt(null);
    onClose();
  }, [onClose]);

  // Close on escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        handleClose();
      }
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
      <div className="illuminator-modal ipm-modal">
        <div className="illuminator-modal-header">
          <h3>Select Image from Library</h3>
          <button onClick={handleClose} className="illuminator-modal-close">
            &times;
          </button>
        </div>

        <div className="illuminator-modal-body ipm-body">
          {/* Filters */}
          <div className="ipm-filters">
            <div>
              <label className="ipm-filter-label">Search</label>
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Name or prompt..."
                className="illuminator-input ipm-search-input"
              />
            </div>

            <div>
              <label className="ipm-filter-label">Entity Kind</label>
              <select
                value={filterKind}
                onChange={(e) => setFilterKind(e.target.value)}
                className="illuminator-select ipm-filter-select"
              >
                <option value="all">All Kinds</option>
                {filterOptions.kinds.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="ipm-filter-label">Culture</label>
              <select
                value={filterCulture}
                onChange={(e) => setFilterCulture(e.target.value)}
                className="illuminator-select ipm-filter-select"
              >
                <option value="all">All Cultures</option>
                {filterOptions.cultures.map((culture) => (
                  <option key={culture} value={culture}>
                    {culture}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="ipm-filter-label">Model</label>
              <select
                value={filterModel}
                onChange={(e) => setFilterModel(e.target.value)}
                className="illuminator-select ipm-filter-select"
              >
                <option value="all">All Models</option>
                {filterOptions.models.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>

            <div className="ipm-filter-count-wrapper">
              <span className="ipm-filter-count">{images.length} images</span>
            </div>
          </div>

          {/* Image grid */}
          <div className="ipm-grid-container">
            {loading ? (
              <div className="ipm-loading">Loading images...</div>
            ) : images.length === 0 ? (
              <div className="ipm-empty">
                No images found. Try adjusting the filters or generate some images first.
              </div>
            ) : (
              <div className="ipm-grid">
                {images.map((img) => {
                  const isSelected = selectedImageId === img.imageId;
                  const isCurrent = currentImageId === img.imageId;

                  return (
                    <div
                      key={img.imageId}
                      onClick={() => setSelectedImageId(img.imageId)}
                      className={`ipm-card ${isSelected ? "ipm-card-selected" : ""} ${isCurrent ? "ipm-card-current" : ""}`}
                    >
                      {/* Current badge */}
                      {isCurrent && <div className="ipm-current-badge">CURRENT</div>}

                      {/* Thumbnail — lazy-loaded via IntersectionObserver */}
                      <LazyThumbnail
                        imageId={img.imageId}
                        alt={img.entityName || img.imageId}
                        className="ipm-thumbnail-wrapper"
                      />

                      {/* Info */}
                      <div className="ipm-card-info">
                        <div className="ipm-card-name" title={img.entityName}>
                          {img.entityName || "Unknown"}
                        </div>
                        <div className="ipm-card-meta">
                          {img.entityKind}
                          {img.entityCulture && ` · ${img.entityCulture}`}
                        </div>
                        <div className="ipm-card-meta">
                          {formatDate(img.generatedAt)} · {formatBytes(img.size || 0)}
                        </div>

                        {/* Prompt preview */}
                        {(img.finalPrompt || img.originalPrompt) && (
                          <div
                            className={`ipm-card-prompt ${expandedPrompt === img.imageId ? "ipm-card-prompt-expanded" : "ipm-card-prompt-collapsed"}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedPrompt(
                                expandedPrompt === img.imageId ? null : img.imageId
                              );
                            }}
                            title="Click to expand/collapse prompt"
                          >
                            {img.finalPrompt || img.originalPrompt}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="illuminator-modal-footer ipm-footer">
          <button onClick={handleClose} className="illuminator-btn">
            Cancel
          </button>
          <button
            onClick={handleSelect}
            disabled={!selectedImageId || selectedImageId === currentImageId}
            className="illuminator-btn illuminator-btn-primary"
          >
            {selectedImageId === currentImageId ? "Already Assigned" : "Assign Image"}
          </button>
        </div>
      </div>
    </div>
  );
}

ImagePickerModal.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
  onSelect: PropTypes.func,
  entityKind: PropTypes.string,
  entityCulture: PropTypes.string,
  currentImageId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};
