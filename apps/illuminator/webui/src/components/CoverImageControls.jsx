/**
 * CoverImageControls — Shared cover image preview + generation controls.
 *
 * Used by both chronicle PipelineTab and EraNarrativeViewer.
 */

import { useImageUrl } from "../hooks/useImageUrl";
import PropTypes from "prop-types";
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
    return <div className="cic-error">Failed to load image{error ? `: ${error}` : ""}</div>;
  }
  return <div className="cic-preview-wrapper">
      <img src={url} alt="Cover" onClick={onImageClick ? () => onImageClick(imageId, "Cover Image") : undefined} className={`cic-preview-img${onImageClick ? " cic-preview-img-clickable" : ""}`} role="button" tabIndex={0} onKeyDown={e => {
      if (e.key === "Enter" || e.key === " ") e.currentTarget.click();
    }} />
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
        {item.coverImage && item.coverImage.status === "failed" && <div className="cic-status cic-status-failed">
            Failed{item.coverImage.error ? `: ${item.coverImage.error}` : ""}
          </div>}
        {item.coverImage?.sceneDescription && <div className="cic-scene-description">{item.coverImage.sceneDescription}</div>}
        <CoverImagePreview imageId={item.coverImage?.generatedImageId} onImageClick={onImageClick} />
      </div>
      <div className="cic-actions">
        <div className="cic-button-row">
          {onGenerateCoverImageScene && <button onClick={onGenerateCoverImageScene} disabled={isGenerating} className="cic-action-btn">
              {item.coverImage ? "Regen Scene" : "Gen Scene"}
            </button>}
          {onGenerateCoverImage && item.coverImage && (item.coverImage.status === "pending" || item.coverImage.status === "complete" || item.coverImage.status === "failed") && <button onClick={onGenerateCoverImage} disabled={isGenerating} className="cic-action-btn">
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
