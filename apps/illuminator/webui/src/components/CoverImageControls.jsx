/**
 * CoverImageControls — Shared cover image preview + generation controls.
 *
 * Used by both chronicle PipelineTab and EraNarrativeViewer.
 */

import { useImageUrl } from "@the-canonry/image-store";
import PropTypes from "prop-types";
import { ErrorMessage } from "@the-canonry/shared-components";
import "./CoverImageControls.css";
import React from "react";
export function CoverImagePreview({
  imageId,
  onImageClick
}) {
  const {
    url,
    loading,
    error
  } = useImageUrl(imageId);
  if (!imageId) return null;
  if (loading) {
    return <div className="cic-loading">Loading image...</div>;
  }
  if (error || !url) {
    const errorSuffix = error ? `: ${error}` : "";
    return <ErrorMessage message={`Failed to load image${errorSuffix}`} className="cic-error" />;
  }
  return <div className="cic-preview-wrapper">
      <button type="button" className={`cic-preview-btn${onImageClick ? " cic-preview-btn-clickable" : ""}`} onClick={onImageClick ? () => onImageClick(imageId, "Cover Image") : undefined} tabIndex={0} onKeyDown={e => {
      if (e.key === "Enter" || e.key === " ") e.currentTarget.click();
    }}>
        <img src={url} alt="Cover" className="cic-preview-img" />
      </button>
    </div>;
}
export function CoverImageControls({
  item,
  onGenerateCoverImageScene,
  onGenerateCoverImage,
  onImageClick,
  isGenerating,
  labelWeight = 500
}) {
  return <div className="cic-layout">
      <div className="cic-info">
        <div className="cic-label" style={{
        "--cic-label-weight": labelWeight
      }}>
          Cover Image
        </div>
        <div className="cic-description">
          Generate a montage-style cover image for this chronicle.
        </div>
        {!item.coverImage && <div className="cic-status cic-status-empty">Not run yet</div>}
        {item.coverImage && item.coverImage.status === "pending" && <div className="cic-status cic-status-pending">
            Scene ready - click Generate Image to create
          </div>}
        {item.coverImage && item.coverImage.status === "generating" && <div className="cic-status cic-status-generating">Generating image...</div>}
        {item.coverImage && item.coverImage.status === "complete" && <div className="cic-status cic-status-complete">Complete</div>}
        {item.coverImage && item.coverImage.status === "failed" && (
          <ErrorMessage
            message={`Failed${item.coverImage.error ? `: ${item.coverImage.error}` : ""}`}
            className="cic-status"
          />
        )}
        {item.coverImage?.sceneDescription && <div className="cic-scene-description">{item.coverImage.sceneDescription}</div>}
        <CoverImagePreview imageId={item.coverImage?.generatedImageId} onImageClick={onImageClick} />
      </div>
      <div className="cic-actions">
        <div className="cic-button-row">
          {onGenerateCoverImageScene && <button onClick={onGenerateCoverImageScene} disabled={isGenerating} className="ilu-action-btn cic-action-btn">
              {item.coverImage ? "Regen Scene" : "Gen Scene"}
            </button>}
          {onGenerateCoverImage && item.coverImage && (item.coverImage.status === "pending" || item.coverImage.status === "complete" || item.coverImage.status === "failed") && <button onClick={onGenerateCoverImage} disabled={isGenerating} className="ilu-action-btn cic-action-btn">
                {item.coverImage.status === "complete" ? "Regen Image" : "Gen Image"}
              </button>}
        </div>
      </div>
    </div>;
}
CoverImagePreview.propTypes = {
  imageId: PropTypes.string,
  onImageClick: PropTypes.func
};
CoverImageControls.propTypes = {
  item: PropTypes.object.isRequired,
  onGenerateCoverImageScene: PropTypes.func,
  onGenerateCoverImage: PropTypes.func,
  onImageClick: PropTypes.func,
  isGenerating: PropTypes.bool,
  labelWeight: PropTypes.number
};
