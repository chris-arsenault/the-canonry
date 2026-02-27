/**
 * ImageRefPicker - Modal for inserting image references
 *
 * Uses paginated search to handle large image libraries efficiently.
 * Loads image thumbnails on-demand as they become visible.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import { ModalShell } from "@penguin-tales/shared-components";
import { searchImages, getImageDataUrl } from "../lib/db/imageRepository";

const PAGE_SIZE = 12;

export default function ImageRefPicker({ projectId, onSelect, onClose }) {
  const [images, setImages] = useState([]);
  const [imageUrls, setImageUrls] = useState({}); // imageId -> dataUrl cache
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [caption, setCaption] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const searchTimeoutRef = useRef(null);

  // Debounce search input
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [search]);

  // Load images when search changes
  useEffect(() => {
    let cancelled = false;

    async function loadImages() {
      setLoading(true);
      try {
        const result = await searchImages({
          projectId,
          search: debouncedSearch || undefined,
          limit: PAGE_SIZE,
          offset: 0,
        });

        if (cancelled) return;

        setImages(result.items);
        setHasMore(result.hasMore);
        setTotal(result.total);
        setSelectedImage(null);
        setCaption("");
      } catch (err) {
        console.error("Failed to search images:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadImages();

    return () => {
      cancelled = true;
    };
  }, [projectId, debouncedSearch]);

  // Load more images (pagination)
  const handleLoadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    try {
      const result = await searchImages({
        projectId,
        search: debouncedSearch || undefined,
        limit: PAGE_SIZE,
        offset: images.length,
      });

      setImages((prev) => [...prev, ...result.items]);
      setHasMore(result.hasMore);
    } catch (err) {
      console.error("Failed to load more images:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId, debouncedSearch, images.length, loading, hasMore]);

  // Lazy load image thumbnail when it comes into view
  const loadImageUrl = useCallback(
    async (imageId) => {
      if (imageUrls[imageId]) return; // Already loaded

      try {
        const dataUrl = await getImageDataUrl(imageId);
        if (dataUrl) {
          setImageUrls((prev) => ({ ...prev, [imageId]: dataUrl }));
        }
      } catch (err) {
        console.warn(`Failed to load image ${imageId}:`, err);
      }
    },
    [imageUrls]
  );

  const handleInsert = () => {
    if (!selectedImage) return;
    const imageRef = caption
      ? `![${caption}](image:${selectedImage.imageId})`
      : `![](image:${selectedImage.imageId})`;
    onSelect(imageRef);
    onClose();
  };

  return (
    <ModalShell onClose={onClose} title="Insert Image" className="image-picker-modal">
      <div className="image-picker-toolbar">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by entity name..."
          className="static-page-search-input"
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
        />
        {total > 0 && <span className="image-picker-count">{total} images</span>}
      </div>

      {loading && images.length === 0 && (
        <div className="image-picker-loading">Searching images...</div>
      )}
      {!(loading && images.length === 0) && images.length === 0 && (
        <div className="image-picker-empty">
          {search ? "No images match your search" : "No images available"}
        </div>
      )}
      {images.length > 0 && (
        <>
          <div className="image-picker-grid">
            {images.map((img) => (
              <ImageThumbnail
                key={img.imageId}
                image={img}
                dataUrl={imageUrls[img.imageId]}
                isSelected={selectedImage?.imageId === img.imageId}
                onSelect={() => setSelectedImage(img)}
                onVisible={() => loadImageUrl(img.imageId)}
              />
            ))}
          </div>

          {hasMore && (
            <button
              className="static-page-button image-picker-load-more"
              onClick={() => void handleLoadMore()}
              disabled={loading}
            >
              {loading ? "Loading..." : `Load more (${images.length} of ${total})`}
            </button>
          )}
        </>
      )}

      {selectedImage && (
        <div className="image-picker-caption-section">
          <label className="image-picker-caption-label">
            Caption (optional):
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Enter image caption..."
              className="static-page-search-input"
            />
          </label>
          <button className="static-page-button primary" onClick={handleInsert}>
            Insert Image
          </button>
        </div>
      )}
    </ModalShell>
  );
}

ImageRefPicker.propTypes = {
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onSelect: PropTypes.func,
  onClose: PropTypes.func,
};

/**
 * Single image thumbnail with lazy loading via IntersectionObserver
 */
function ImageThumbnail({ image, dataUrl, isSelected, onSelect, onVisible }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || dataUrl) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onVisible();
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(ref.current);

    return () => observer.disconnect();
  }, [dataUrl, onVisible]);

  return (
    <button
      ref={ref}
      className={`image-picker-item ${isSelected ? "selected" : ""}`}
      onClick={onSelect}
    >
      {dataUrl ? (
        <img src={dataUrl} alt={image.entityName || "Image"} className="image-picker-thumb" />
      ) : (
        <div className="image-picker-thumb image-picker-placeholder">Loading...</div>
      )}
      <span className="image-picker-label">{image.entityName || "Untitled"}</span>
    </button>
  );
}

ImageThumbnail.propTypes = {
  image: PropTypes.object,
  dataUrl: PropTypes.string,
  isSelected: PropTypes.bool,
  onSelect: PropTypes.func,
  onVisible: PropTypes.func,
};
