/**
 * ImageRefPicker - Modal for inserting image references
 *
 * Uses paginated search to handle large image libraries efficiently.
 * Loads image thumbnails on-demand as they become visible.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { searchImages, getImageDataUrl } from '../lib/db/imageRepository';

const PAGE_SIZE = 12;

export default function ImageRefPicker({ projectId, onSelect, onClose }) {
  const [images, setImages] = useState([]);
  const [imageUrls, setImageUrls] = useState({}); // imageId -> dataUrl cache
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [caption, setCaption] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const searchTimeoutRef = useRef(null);
  const mouseDownOnOverlay = useRef(false);

  const handleOverlayMouseDown = (e) => {
    mouseDownOnOverlay.current = e.target === e.currentTarget;
  };

  const handleOverlayClick = (e) => {
    if (mouseDownOnOverlay.current && e.target === e.currentTarget) {
      onClose();
    }
  };

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
        setCaption('');
      } catch (err) {
        console.error('Failed to search images:', err);
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
      console.error('Failed to load more images:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, debouncedSearch, images.length, loading, hasMore]);

  // Lazy load image thumbnail when it comes into view
  const loadImageUrl = useCallback(async (imageId) => {
    if (imageUrls[imageId]) return; // Already loaded

    try {
      const dataUrl = await getImageDataUrl(imageId);
      if (dataUrl) {
        setImageUrls((prev) => ({ ...prev, [imageId]: dataUrl }));
      }
    } catch (err) {
      console.warn(`Failed to load image ${imageId}:`, err);
    }
  }, [imageUrls]);

  const handleInsert = () => {
    if (!selectedImage) return;
    const imageRef = caption
      ? `![${caption}](image:${selectedImage.imageId})`
      : `![](image:${selectedImage.imageId})`;
    onSelect(imageRef);
    onClose();
  };

  return (
    <div className="static-page-modal-overlay" onMouseDown={handleOverlayMouseDown} onClick={handleOverlayClick}>
      <div className="static-page-modal image-picker-modal">
        <div className="static-page-modal-header">
          <h3>Insert Image</h3>
          <span className="image-picker-count">
            {total > 0 && `${total} images`}
          </span>
          <button className="static-page-modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="static-page-modal-body">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by entity name..."
            className="static-page-search-input"
            autoFocus
          />

          {loading && images.length === 0 ? (
            <div className="image-picker-loading">Searching images...</div>
          ) : images.length === 0 ? (
            <div className="image-picker-empty">
              {search ? 'No images match your search' : 'No images available'}
            </div>
          ) : (
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
                  onClick={handleLoadMore}
                  disabled={loading}
                >
                  {loading ? 'Loading...' : `Load more (${images.length} of ${total})`}
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
        </div>
      </div>
    </div>
  );
}

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
      className={`image-picker-item ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      {dataUrl ? (
        <img
          src={dataUrl}
          alt={image.entityName || 'Image'}
          className="image-picker-thumb"
        />
      ) : (
        <div className="image-picker-thumb image-picker-placeholder">
          Loading...
        </div>
      )}
      <span className="image-picker-label">{image.entityName || 'Untitled'}</span>
    </button>
  );
}
