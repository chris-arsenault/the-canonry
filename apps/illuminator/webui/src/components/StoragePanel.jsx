/**
 * StoragePanel - Image storage management
 *
 * Allows users to browse, delete, and download stored images.
 * Shows storage statistics and supports bulk operations.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import PropTypes from "prop-types";
import {
  getAllImages,
  getStorageStats,
  loadImage,
  deleteImage,
  deleteImages,
  getImageBlob,
  formatBytes,
} from "../lib/db/imageRepository";
import { downloadImagePromptExport } from "../lib/db/imageRepository";
import ImageModal from "./ImageModal";
import "./StoragePanel.css";

const DEFAULT_PAGE_SIZE = 24;
const PAGE_SIZE_OPTIONS = [24, 48, 96];

export default function StoragePanel({ projectId: _projectId }) {
  const [images, setImages] = useState([]);
  const [stats, setStats] = useState({ totalCount: 0, totalSize: 0, byProject: {} });
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [filterProject, setFilterProject] = useState("all");
  const [imageModal, setImageModal] = useState({ open: false, imageId: "", title: "" });
  const [thumbnailUrls, setThumbnailUrls] = useState({});
  const [downloadingIds, setDownloadingIds] = useState(new Set());
  const [exportingPrompts, setExportingPrompts] = useState(false);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [pageIndex, setPageIndex] = useState(0);
  const thumbnailUrlsRef = useRef({});

  // Load images and stats
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [allImages, storageStats] = await Promise.all([getAllImages(), getStorageStats()]);
      setImages(allImages);
      setStats(storageStats);
    } catch (err) {
      console.error("Failed to load storage data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    thumbnailUrlsRef.current = thumbnailUrls;
  }, [thumbnailUrls]);

  useEffect(() => {
    return () => {
      for (const url of Object.values(thumbnailUrlsRef.current)) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  useEffect(() => {
    setPageIndex(0);
  }, [filterProject]);

  // Filter images by project
  const filteredImages = useMemo(() => {
    if (filterProject === "all") return images;
    return images.filter((img) => img.projectId === filterProject);
  }, [images, filterProject]);

  // Get unique project IDs
  const projectIds = useMemo(() => {
    const ids = new Set();
    for (const img of images) {
      if (img.projectId) ids.add(img.projectId);
    }
    return Array.from(ids).sort();
  }, [images]);

  const totalPages = Math.max(1, Math.ceil(filteredImages.length / pageSize));
  const currentPage = Math.min(pageIndex, totalPages - 1);
  const pageStart = currentPage * pageSize;
  const pageEnd = pageStart + pageSize;
  const visibleImages = useMemo(
    () => filteredImages.slice(pageStart, pageEnd),
    [filteredImages, pageStart, pageEnd]
  );

  useEffect(() => {
    setPageIndex((prev) => Math.min(prev, Math.max(0, totalPages - 1)));
  }, [totalPages]);

  useEffect(() => {
    const visibleIds = new Set(visibleImages.map((img) => img.imageId));
    setThumbnailUrls((prev) => {
      let changed = false;
      const next = {};
      for (const [imageId, url] of Object.entries(prev)) {
        if (visibleIds.has(imageId)) {
          next[imageId] = url;
        } else {
          URL.revokeObjectURL(url);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [visibleImages]);

  // Load thumbnail URLs for visible images only
  useEffect(() => {
    let active = true;
    const loadThumbnails = async () => {
      const newUrls = {};
      for (const img of visibleImages) {
        if (!thumbnailUrls[img.imageId]) {
          try {
            const result = await loadImage(img.imageId);
            if (result?.url) {
              newUrls[img.imageId] = result.url;
            }
          } catch {
            // Ignore errors
          }
        }
      }

      if (active && Object.keys(newUrls).length > 0) {
        setThumbnailUrls((prev) => ({ ...prev, ...newUrls }));
      }
    };

    if (visibleImages.length > 0) {
      loadThumbnails();
    }

    return () => {
      active = false;
    };
  }, [visibleImages, thumbnailUrls]);

  // Toggle selection
  const toggleSelect = useCallback((imageId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(imageId)) {
        next.delete(imageId);
      } else {
        next.add(imageId);
      }
      return next;
    });
  }, []);

  // Select all filtered
  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filteredImages.map((img) => img.imageId)));
  }, [filteredImages]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handlePageSizeChange = useCallback((event) => {
    setPageSize(Number(event.target.value));
    setPageIndex(0);
  }, []);

  const handlePrevPage = useCallback(() => {
    setPageIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleNextPage = useCallback(() => {
    setPageIndex((prev) => Math.min(prev + 1, totalPages - 1));
  }, [totalPages]);

  // Delete single image
  const handleDelete = useCallback(
    async (imageId) => {
      if (!window.confirm("Delete this image? This cannot be undone.")) return;

      try {
        // Revoke thumbnail URL
        if (thumbnailUrls[imageId]) {
          URL.revokeObjectURL(thumbnailUrls[imageId]);
          setThumbnailUrls((prev) => {
            const next = { ...prev };
            delete next[imageId];
            return next;
          });
        }

        await deleteImage(imageId);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(imageId);
          return next;
        });
        await loadData();
      } catch (err) {
        console.error("Failed to delete image:", err);
        alert("Failed to delete image");
      }
    },
    [loadData, thumbnailUrls]
  );

  // Delete selected images
  const handleDeleteSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedIds.size} selected images? This cannot be undone.`))
      return;

    try {
      // Revoke thumbnail URLs
      for (const id of selectedIds) {
        if (thumbnailUrls[id]) {
          URL.revokeObjectURL(thumbnailUrls[id]);
        }
      }
      setThumbnailUrls((prev) => {
        const next = { ...prev };
        for (const id of selectedIds) {
          delete next[id];
        }
        return next;
      });

      await deleteImages(Array.from(selectedIds));
      setSelectedIds(new Set());
      await loadData();
    } catch (err) {
      console.error("Failed to delete images:", err);
      alert("Failed to delete images");
    }
  }, [selectedIds, loadData, thumbnailUrls]);

  // Download single image
  const handleDownload = useCallback(async (imageId, entityName) => {
    setDownloadingIds((prev) => new Set(prev).add(imageId));
    try {
      const blob = await getImageBlob(imageId);
      if (!blob) {
        alert("Image not found");
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${entityName || imageId}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download image:", err);
      alert("Failed to download image");
    } finally {
      setDownloadingIds((prev) => {
        const next = new Set(prev);
        next.delete(imageId);
        return next;
      });
    }
  }, []);

  // Download selected images as zip
  const handleDownloadSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;

    // Check if JSZip is available
    let JSZip;
    try {
      JSZip = (await import("jszip")).default;
    } catch {
      alert("Bulk download requires JSZip library. Please install it: npm install jszip");
      return;
    }

    setDownloadingIds(new Set(selectedIds));
    try {
      const zip = new JSZip();

      for (const imageId of selectedIds) {
        const blob = await getImageBlob(imageId);
        if (blob) {
          const img = images.find((i) => i.imageId === imageId);
          const filename = img?.entityName
            ? `${img.entityName.replace(/[^a-z0-9]/gi, "_")}.png`
            : `${imageId}.png`;
          zip.file(filename, blob);
        }
      }

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = "images.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download images:", err);
      alert("Failed to download images");
    } finally {
      setDownloadingIds(new Set());
    }
  }, [selectedIds, images]);

  // Export prompt data for analysis
  const handleExportPrompts = useCallback(async () => {
    setExportingPrompts(true);
    try {
      await downloadImagePromptExport();
    } catch (err) {
      console.error("Failed to export prompts:", err);
      alert("Failed to export prompt data");
    } finally {
      setExportingPrompts(false);
    }
  }, []);

  // Format date
  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    return new Date(timestamp).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const showingFrom = filteredImages.length === 0 ? 0 : pageStart + 1;
  const showingTo = pageStart + visibleImages.length;

  if (loading) {
    return (
      <div className="illuminator-card">
        <div className="ilu-empty storage-panel-loading">Loading storage data...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Storage Stats */}
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Image Storage</h2>
          <div className="storage-panel-header-actions">
            <button
              onClick={() => void handleExportPrompts()}
              className="illuminator-button illuminator-button-secondary storage-panel-compact-btn"
              disabled={exportingPrompts || stats.totalCount === 0}
              title="Export all image prompt data (original, refined, revised) as JSON for analysis"
            >
              {exportingPrompts ? "Exporting..." : "Export Prompt Data"}
            </button>
            <button
              onClick={() => void loadData()}
              className="illuminator-button illuminator-button-secondary storage-panel-compact-btn"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="ilu-stats-grid storage-panel-stats-grid">
          <div className="ilu-stat-card storage-panel-stat-card">
            <div className="ilu-stat-value storage-panel-stat-value">{stats.totalCount}</div>
            <div className="ilu-stat-label storage-panel-stat-label">Total Images</div>
          </div>
          <div className="ilu-stat-card storage-panel-stat-card">
            <div className="ilu-stat-value storage-panel-stat-value">{formatBytes(stats.totalSize)}</div>
            <div className="ilu-stat-label storage-panel-stat-label">Total Size</div>
          </div>
          <div className="ilu-stat-card storage-panel-stat-card">
            <div className="ilu-stat-value storage-panel-stat-value">{Object.keys(stats.byProject).length}</div>
            <div className="ilu-stat-label storage-panel-stat-label">Projects</div>
          </div>
        </div>

        {/* Per-project breakdown */}
        {Object.keys(stats.byProject).length > 0 && (
          <div className="storage-panel-project-breakdown">
            <div className="storage-panel-project-breakdown-title">Storage by Project</div>
            <div className="storage-panel-project-list">
              {Object.entries(stats.byProject).map(([pid, data]) => (
                <div key={pid} className="storage-panel-project-item">
                  <span className="storage-panel-project-name">{pid.slice(0, 8)}...</span>
                  <span className="storage-panel-project-stats">
                    {data.count} ({formatBytes(data.size)})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Image Browser */}
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Browse Images</h2>
          <span className="storage-panel-browse-count">
            {filteredImages.length === 0
              ? "0 images"
              : `Showing ${showingFrom}-${showingTo} of ${filteredImages.length} images`}
          </span>
        </div>

        {/* Filters */}
        <div className="storage-panel-filters-row">
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="illuminator-select storage-panel-filter-select"
          >
            <option value="all">All Projects</option>
            {projectIds.map((pid) => (
              <option key={pid} value={pid}>
                {pid.slice(0, 12)}...
              </option>
            ))}
          </select>

          <div className="storage-panel-page-size-group">
            <span className="storage-panel-page-size-label">Page size</span>
            <select
              value={pageSize}
              onChange={handlePageSizeChange}
              className="illuminator-select storage-panel-page-size-select"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>

          {selectedIds.size > 0 && (
            <div className="storage-panel-selection-actions">
              <span className="storage-panel-selected-count">{selectedIds.size} selected</span>
              <button
                onClick={() => void handleDownloadSelected()}
                className="illuminator-button illuminator-button-secondary storage-panel-compact-btn"
                disabled={downloadingIds.size > 0}
              >
                {downloadingIds.size > 0 ? "Downloading..." : "Download"}
              </button>
              <button
                onClick={() => void handleDeleteSelected()}
                className="illuminator-button storage-panel-delete-selected-btn"
              >
                Delete
              </button>
              <button
                onClick={clearSelection}
                className="illuminator-button-link storage-panel-clear-btn"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Select all row */}
        {filteredImages.length > 0 && (
          <div className="storage-panel-select-all-row">
            <input
              type="checkbox"
              checked={selectedIds.size === filteredImages.length && filteredImages.length > 0}
              onChange={(e) => (e.target.checked ? selectAll() : clearSelection())}
              className="storage-panel-checkbox"
            />
            <span className="storage-panel-select-all-label">Select all</span>
          </div>
        )}

        {totalPages > 1 && (
          <div className="storage-panel-pagination">
            <span className="storage-panel-page-info">
              Page {currentPage + 1} of {totalPages}
            </span>
            <div className="storage-panel-page-btns">
              <button
                onClick={handlePrevPage}
                className="illuminator-button illuminator-button-secondary storage-panel-compact-btn"
                disabled={currentPage === 0}
              >
                Prev
              </button>
              <button
                onClick={handleNextPage}
                className="illuminator-button illuminator-button-secondary storage-panel-compact-btn"
                disabled={currentPage + 1 >= totalPages}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Image grid */}
        {filteredImages.length === 0 ? (
          <div className="ilu-empty storage-panel-empty">
            No images stored yet. Generate images in the Entities tab.
          </div>
        ) : (
          <div className="storage-panel-image-grid">
            {visibleImages.map((img) => (
              <div
                key={img.imageId}
                className="storage-panel-image-card"
                data-selected={selectedIds.has(img.imageId)}
              >
                {/* Checkbox */}
                <div className="storage-panel-card-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(img.imageId)}
                    onChange={() => toggleSelect(img.imageId)}
                    className="storage-panel-checkbox"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>

                {/* Thumbnail */}
                <div
                  className="storage-panel-thumbnail-container"
                  onClick={() =>
                    setImageModal({
                      open: true,
                      imageId: img.imageId,
                      title: img.entityName || img.imageId,
                    })
                  }
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
                >
                  {thumbnailUrls[img.imageId] ? (
                    <img
                      src={thumbnailUrls[img.imageId]}
                      alt={img.entityName || img.imageId}
                      className="ilu-thumb-cover"
                    />
                  ) : (
                    <div className="ilu-thumb-placeholder">Loading...</div>
                  )}
                </div>

                {/* Info */}
                <div className="storage-panel-card-info">
                  <div className="storage-panel-card-name" title={img.entityName}>
                    {img.entityName || "Unknown"}
                  </div>
                  <div className="storage-panel-card-meta">
                    {img.entityKind} &middot; {formatBytes(img.size || 0)}
                  </div>
                  <div className="storage-panel-card-meta">{formatDate(img.generatedAt)}</div>

                  {/* Actions */}
                  <div className="storage-panel-card-actions">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDownload(img.imageId, img.entityName);
                      }}
                      className="illuminator-button illuminator-button-secondary storage-panel-download-btn"
                      disabled={downloadingIds.has(img.imageId)}
                    >
                      {downloadingIds.has(img.imageId) ? "..." : "Download"}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(img.imageId);
                      }}
                      className="storage-panel-delete-btn"
                    >
                      &times;
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Image Modal */}
      <ImageModal
        isOpen={imageModal.open}
        imageId={imageModal.imageId}
        title={imageModal.title}
        onClose={() => setImageModal({ open: false, imageId: "", title: "" })}
      />
    </div>
  );
}

StoragePanel.propTypes = {
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};
