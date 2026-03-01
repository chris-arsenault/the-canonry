/**
 * ImageModal - Full-size image viewer with metadata sidebar
 *
 * Opens when clicking on an image thumbnail to show the full image.
 * Loads images from local IndexedDB storage by imageId.
 * Displays metadata in a collapsible sidebar with expandable prompt sections.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import { useImageUrl } from "@the-canonry/image-store";
import { ErrorMessage } from "@the-canonry/shared-components";
import "./ImageModal.css";

/**
 * Format a date timestamp for display
 */
function formatDate(timestamp) {
  if (!timestamp) return "Unknown";
  return new Date(timestamp).toLocaleString();
}

/**
 * Format file size for display
 */
function formatSize(bytes) {
  if (!bytes) return "Unknown";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Metadata row component
 */
function MetadataRow({ label, value }) {
  if (!value) return null;

  return (
    <div className="imod-meta-row">
      <div className="imod-meta-label">{label}</div>
      <div className="imod-meta-value">{value}</div>
    </div>
  );
}

/**
 * Collapsible prompt section
 */
function PromptSection({ title, content, defaultExpanded = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (!content) return null;

  return (
    <div className="imod-prompt-section">
      <button onClick={() => setExpanded(!expanded)} className="imod-prompt-toggle">
        <span
          className={`imod-prompt-arrow ${expanded ? "imod-prompt-arrow-expanded" : "imod-prompt-arrow-collapsed"}`}
        >
          ▶
        </span>
        <span className="imod-prompt-title">{title}</span>
        <span className="imod-prompt-chars">{content.length} chars</span>
      </button>
      {expanded && <div className="imod-prompt-content">{content}</div>}
    </div>
  );
}

/**
 * Metadata sidebar component
 */
function MetadataSidebar({ metadata, isOpen, onToggle }) {
  if (!metadata) return null;

  // Check if Claude refinement was used (original and final prompts differ)
  const wasRefined =
    metadata.originalPrompt &&
    metadata.finalPrompt &&
    metadata.originalPrompt !== metadata.finalPrompt;

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={onToggle}
        className={`imod-sidebar-toggle ${isOpen ? "imod-sidebar-toggle-open" : "imod-sidebar-toggle-closed"}`}
        title={isOpen ? "Hide metadata" : "Show metadata"}
      >
        {isOpen ? ">" : "<"}
      </button>

      {/* Sidebar */}
      <div
        className={`imod-sidebar ${isOpen ? "imod-sidebar-open" : "imod-sidebar-closed"}`}
        onClick={(e) => e.stopPropagation()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
      >
        <div className="imod-sidebar-inner">
          <h4 className="imod-sidebar-heading">Image Metadata</h4>

          {/* Basic info */}
          <MetadataRow label="Entity" value={metadata.entityName} />
          <MetadataRow label="Kind" value={metadata.entityKind} />
          <MetadataRow label="Culture" value={metadata.entityCulture} />
          <MetadataRow label="Model" value={metadata.model} />
          <MetadataRow label="Generated" value={formatDate(metadata.generatedAt)} />
          <MetadataRow label="File Size" value={formatSize(metadata.size)} />

          {/* Prompts section */}
          {(metadata.originalPrompt || metadata.finalPrompt || metadata.revisedPrompt) && (
            <>
              <div className="imod-sidebar-divider" />
              <div className="imod-sidebar-section-label">Prompts</div>

              {wasRefined ? (
                <>
                  <PromptSection
                    title="Original Prompt (Template)"
                    content={metadata.originalPrompt}
                    defaultExpanded={false}
                  />
                  <PromptSection
                    title="Refined Prompt (Claude)"
                    content={metadata.finalPrompt}
                    defaultExpanded={true}
                  />
                </>
              ) : (
                <PromptSection
                  title="Prompt (Sent to Model)"
                  content={metadata.finalPrompt || metadata.originalPrompt}
                  defaultExpanded={true}
                />
              )}

              {metadata.revisedPrompt && (
                <PromptSection
                  title="Revised Prompt (DALL-E)"
                  content={metadata.revisedPrompt}
                  defaultExpanded={false}
                />
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default function ImageModal({ isOpen, imageId, title, onClose }) {
  const { url: imageUrl, loading, error, metadata } = useImageUrl(isOpen ? imageId : null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const mouseDownOnOverlay = useRef(false);

  const handleOverlayMouseDown = (e) => {
    mouseDownOnOverlay.current = e.target === e.currentTarget;
  };

  const handleOverlayClick = (e) => {
    if (mouseDownOnOverlay.current && e.target === e.currentTarget) {
      onClose();
    }
  };

  // Close on escape key
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const hasSidebar = sidebarOpen && metadata;

  return (
    <div className="imod-overlay" onMouseDown={handleOverlayMouseDown} onClick={handleOverlayClick} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleOverlayClick(e); }} >
      {/* Header with title and close button */}
      <div
        className={`imod-header ${hasSidebar ? "imod-header-sidebar-open" : "imod-header-sidebar-closed"}`}
        onClick={(e) => e.stopPropagation()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
      >
        <h3 className="imod-title">{title}</h3>
        <button onClick={onClose} className="imod-close-btn">
          Close (Esc)
        </button>
      </div>

      {/* Image container - adjusted for sidebar */}
      <div
        className={`imod-image-container ${hasSidebar ? "imod-image-container-sidebar-open" : "imod-image-container-sidebar-closed"}`}
      >
        {loading && (
          <div className="imod-loading">Loading image...</div>
        )}
        {!loading && (error || !imageUrl) && (
          <ErrorMessage title="Image not available" message={error || "Image not found in storage"} className="imod-error" />
        )}
        {!loading && !error && imageUrl && (
          <img
            src={imageUrl}
            alt={title}
            className="imod-full-image"
            onClick={(e) => e.stopPropagation()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
          />
        )}
      </div>

      {/* Metadata sidebar */}
      <MetadataSidebar
        metadata={metadata}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Hint at bottom */}
      <div
        className={`imod-hint ${hasSidebar ? "imod-hint-sidebar-open" : "imod-hint-sidebar-closed"}`}
      >
        Click anywhere or press Escape to close
      </div>
    </div>
  );
}

MetadataRow.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string,
};

PromptSection.propTypes = {
  title: PropTypes.string.isRequired,
  content: PropTypes.string,
  defaultExpanded: PropTypes.bool,
};

MetadataSidebar.propTypes = {
  metadata: PropTypes.object,
  isOpen: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
};

ImageModal.propTypes = {
  isOpen: PropTypes.bool,
  imageId: PropTypes.string,
  title: PropTypes.string,
  onClose: PropTypes.func.isRequired,
};
