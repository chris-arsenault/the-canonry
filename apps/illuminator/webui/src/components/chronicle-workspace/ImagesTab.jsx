import React, { useState, useMemo, useCallback } from "react";
import PropTypes from "prop-types";
import ChronicleImagePanel from "../ChronicleImagePanel";
import ChronicleImagePicker from "../ChronicleImagePicker";
import { useImageUrl } from "@the-canonry/image-store";
import { analyzeImageRefCompatibility, createDefaultSelections } from "../../lib/imageRefCompatibility";
import "./ImagesTab.css";

// ============================================================================
// Image Ref Version Mismatch Warning
// ============================================================================

function ImageRefVersionWarning({
  item,
  versions,
  activeVersionId,
  chronicleText: _chronicleText,
  onAnalyzeCompatibility,
  isAnalyzing
}) {
  const imageRefsTargetVersionId = item.imageRefsTargetVersionId;
  if (!imageRefsTargetVersionId || imageRefsTargetVersionId === activeVersionId) {
    return null;
  }

  // Find version labels
  const getVersionLabel = versionId => {
    const idx = versions?.findIndex(v => v.id === versionId);
    if (idx >= 0) return `Version ${idx + 1}`;
    return "Unknown version";
  };
  const sourceLabel = getVersionLabel(imageRefsTargetVersionId);
  const targetLabel = getVersionLabel(activeVersionId);
  return <div className="itab-version-warning">
      <div className="itab-version-warning-title">⚠ Image refs generated for different version</div>
      <div className="itab-version-warning-desc">
        Image refs were generated for <strong>{sourceLabel}</strong>, but the active version is{" "}
        <strong>{targetLabel}</strong>. Some anchor texts may no longer match.
      </div>
      <button onClick={onAnalyzeCompatibility} disabled={isAnalyzing} className={`itab-analyze-btn ${isAnalyzing ? "itab-analyze-btn-disabled" : "itab-analyze-btn-enabled"}`}>
        {isAnalyzing ? "Analyzing..." : "Analyze Compatibility"}
      </button>
    </div>;
}

// ============================================================================
// Image Ref Compatibility Results
// ============================================================================

function ImageRefCompatibilityResults({
  analysis,
  imageRefs,
  entityMap,
  onSelectionChange,
  selections,
  onApply,
  isApplying
}) {
  if (!analysis) return null;
  const getRefLabel = refId => {
    const ref = imageRefs.refs.find(r => r.refId === refId);
    if (!ref) return refId;
    if (ref.type === "entity_ref") {
      const entity = entityMap?.get(ref.entityId);
      return entity?.name || ref.entityId;
    }
    return ref.anchorText?.slice(0, 30) + "..." || refId;
  };
  const getRecommendationStyle = recommendation => {
    switch (recommendation) {
      case "reuse":
        return {
          color: "#10b981",
          badge: "✓ Reusable"
        };
      case "regenerate":
        return {
          color: "#ef4444",
          badge: "↻ Regenerate"
        };
      case "manual_review":
        return {
          color: "#f59e0b",
          badge: "? Review"
        };
      default:
        return {
          color: "var(--text-muted)",
          badge: "?"
        };
    }
  };
  return <div className="itab-compat-panel">
      <div className="itab-compat-heading">
        Compatibility Analysis
        <span className="itab-compat-summary">
          {analysis.summary.reusable} reusable, {analysis.summary.needsRegeneration} need regen,{" "}
          {analysis.summary.needsReview} review
        </span>
      </div>

      <div className="itab-compat-list">
        {analysis.refs.map(refAnalysis => {
        const recStyle = getRecommendationStyle(refAnalysis.recommendation);
        const selection = selections.find(s => s.refId === refAnalysis.refId);
        const currentAction = selection?.action || "reuse";
        return <div key={refAnalysis.refId} className="itab-compat-row">
              <div className="itab-compat-ref-info">
                <div className="itab-compat-ref-label">{getRefLabel(refAnalysis.refId)}</div>
                <div className="itab-compat-ref-reason">{refAnalysis.reason}</div>
              </div>
              <span className="itab-compat-badge"
          // eslint-disable-next-line local/no-inline-styles -- dynamic color from recommendation map
          style={{
            "--itab-badge-bg": `${recStyle.color}20`,
            "--itab-badge-color": recStyle.color
          }}>
                {recStyle.badge}
              </span>
              <select value={currentAction} onChange={e => onSelectionChange(refAnalysis.refId, e.target.value)} className="itab-compat-select">
                <option value="reuse">Keep</option>
                <option value="regenerate">Regenerate</option>
                <option value="skip">Skip</option>
              </select>
            </div>;
      })}
      </div>

      <div className="itab-compat-footer">
        <div className="itab-compat-help">
          &quot;Keep&quot; preserves the ref. &quot;Regenerate&quot; resets for new image. &quot;Skip&quot; removes.
        </div>
        {onApply && <button onClick={onApply} disabled={isApplying} className={`itab-apply-btn ${isApplying ? "itab-apply-btn-disabled" : "itab-apply-btn-enabled"}`}>
            {isApplying ? "Applying..." : "Apply Selections"}
          </button>}
      </div>
    </div>;
}

// ============================================================================
// Cover Image Preview (local)
// ============================================================================

function CoverImagePreview({
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
    return <div className="itab-cover-loading">Loading image...</div>;
  }
  if (error || !url) {
    return <div className="itab-cover-error">Failed to load image{error ? `: ${error}` : ""}</div>;
  }
  return <div className="itab-cover-preview">
      <img src={url} alt="Cover" onClick={onImageClick ? () => onImageClick(imageId, "Cover Image") : undefined} className={`itab-cover-img ${onImageClick ? "itab-cover-img-clickable" : ""}`} role="button" tabIndex={0} onKeyDown={e => {
      if (e.key === "Enter" || e.key === " ") e.currentTarget.click();
    }} />
    </div>;
}

// ============================================================================
// Images Tab
// ============================================================================

export default function ImagesTab({
  item,
  isGenerating,
  entityMap,
  onGenerateCoverImageScene,
  onGenerateCoverImage,
  onImageClick,
  onGenerateChronicleImage,
  onResetChronicleImage,
  onRegenerateDescription,
  onUpdateChronicleAnchorText,
  onUpdateChronicleImageSize,
  onUpdateChronicleImageJustification,
  styleLibrary,
  styleSelection,
  cultures,
  cultureIdentities,
  worldContext,
  imageSize,
  imageQuality,
  imageModel,
  imageGenSettings,
  onOpenImageSettings,
  chronicleText,
  versions,
  activeVersionId,
  onApplyImageRefSelections,
  onSelectExistingImage,
  onSelectExistingCoverImage
}) {
  // Compatibility analysis state
  const [compatibilityAnalysis, setCompatibilityAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [imageRefSelections, setImageRefSelections] = useState([]);

  // Cover image picker state
  const [showCoverImagePicker, setShowCoverImagePicker] = useState(false);

  // Check if image refs are for a different version
  const hasVersionMismatch = useMemo(() => {
    if (!item.imageRefs || !item.imageRefsTargetVersionId || !activeVersionId) return false;
    return item.imageRefsTargetVersionId !== activeVersionId;
  }, [item.imageRefs, item.imageRefsTargetVersionId, activeVersionId]);

  // Handle analyze compatibility
  const handleAnalyzeCompatibility = useCallback(() => {
    if (!item.imageRefs || !versions || !activeVersionId || !item.imageRefsTargetVersionId) return;
    setIsAnalyzing(true);

    // Find the content for source and target versions
    const sourceVersion = versions.find(v => v.id === item.imageRefsTargetVersionId);
    const targetVersion = versions.find(v => v.id === activeVersionId);
    const sourceContent = sourceVersion?.content || "";
    const targetContent = targetVersion?.content || chronicleText || "";
    if (!sourceContent || !targetContent) {
      console.warn("[ImagesTab] Missing content for compatibility analysis");
      setIsAnalyzing(false);
      return;
    }
    try {
      const analysis = analyzeImageRefCompatibility(item.imageRefs, sourceContent, targetContent, item.imageRefsTargetVersionId, activeVersionId);
      setCompatibilityAnalysis(analysis);
      setImageRefSelections(createDefaultSelections(analysis));
    } catch (err) {
      console.error("[ImagesTab] Compatibility analysis failed:", err);
    }
    setIsAnalyzing(false);
  }, [item.imageRefs, item.imageRefsTargetVersionId, versions, activeVersionId, chronicleText]);

  // Handle selection change
  const handleSelectionChange = useCallback((refId, action) => {
    setImageRefSelections(prev => prev.map(s => s.refId === refId ? {
      ...s,
      action
    } : s));
  }, []);

  // Handle apply selections
  const handleApplySelections = useCallback(async () => {
    if (!onApplyImageRefSelections || !activeVersionId || imageRefSelections.length === 0) return;
    setIsApplying(true);
    try {
      await onApplyImageRefSelections(imageRefSelections, activeVersionId);
      // Clear analysis state after successful apply
      setCompatibilityAnalysis(null);
      setImageRefSelections([]);
    } catch (err) {
      console.error("[ImagesTab] Failed to apply selections:", err);
    }
    setIsApplying(false);
  }, [onApplyImageRefSelections, activeVersionId, imageRefSelections]);
  return <div>
      {/* Cover Image */}
      {(onGenerateCoverImageScene || onGenerateCoverImage) && <div className="ilu-section itab-cover-section">
          <div className="itab-cover-heading">Cover Image</div>
          <div className="itab-cover-layout">
            <div className="itab-cover-info">
              <div className="itab-cover-desc">
                Generate a montage-style cover image for this chronicle.
              </div>
              {!item.coverImage && <div className="itab-cover-status itab-cover-status-default">Not run yet</div>}
              {item.coverImage && item.coverImage.status === "pending" && <div className="itab-cover-status itab-cover-status-pending">
                  Scene ready - click Generate Image to create
                </div>}
              {item.coverImage && item.coverImage.status === "generating" && <div className="itab-cover-status itab-cover-status-generating">
                  Generating image...
                </div>}
              {item.coverImage && item.coverImage.status === "complete" && <div className="itab-cover-status itab-cover-status-complete">Complete</div>}
              {item.coverImage && item.coverImage.status === "failed" && <div className="itab-cover-status itab-cover-status-failed">
                  Failed{item.coverImage.error ? `: ${item.coverImage.error}` : ""}
                </div>}
              {item.coverImage?.sceneDescription && <div className="itab-scene-desc">{item.coverImage.sceneDescription}</div>}
              <CoverImagePreview imageId={item.coverImage?.generatedImageId} onImageClick={onImageClick} />
            </div>
            <div className="itab-cover-actions">
              <div className="itab-cover-btn-row">
                {onGenerateCoverImageScene && <button onClick={onGenerateCoverImageScene} disabled={isGenerating} className={`ilu-action-btn itab-cover-btn ${isGenerating ? "itab-cover-btn-disabled" : "itab-cover-btn-enabled"}`}>
                    {item.coverImage ? "Regen Scene" : "Gen Scene"}
                  </button>}
                {onGenerateCoverImage && item.coverImage && (item.coverImage.status === "pending" || item.coverImage.status === "complete" || item.coverImage.status === "failed") && <button onClick={onGenerateCoverImage} disabled={isGenerating} className={`ilu-action-btn itab-cover-btn ${isGenerating ? "itab-cover-btn-disabled" : "itab-cover-btn-enabled"}`}>
                      {item.coverImage.status === "complete" ? "Regen Image" : "Gen Image"}
                    </button>}
                {onSelectExistingCoverImage && item.coverImage && !isGenerating && <button onClick={() => setShowCoverImagePicker(true)} className="ilu-action-btn itab-cover-btn itab-cover-btn-enabled">
                    Select Existing
                  </button>}
              </div>
            </div>
          </div>
        </div>}

      {/* Cover Image Picker */}
      {item.projectId && <ChronicleImagePicker isOpen={showCoverImagePicker} onClose={() => setShowCoverImagePicker(false)} onSelect={imageId => {
      if (onSelectExistingCoverImage) {
        onSelectExistingCoverImage(imageId);
      }
      setShowCoverImagePicker(false);
    }} projectId={item.projectId} chronicleId={item.chronicleId} currentImageId={item.coverImage?.generatedImageId} />}

      {/* Version Mismatch Warning */}
      {hasVersionMismatch && item.imageRefs && <ImageRefVersionWarning item={item} versions={versions} activeVersionId={activeVersionId} chronicleText={chronicleText} onAnalyzeCompatibility={handleAnalyzeCompatibility} isAnalyzing={isAnalyzing} />}

      {/* Compatibility Analysis Results */}
      {compatibilityAnalysis && item.imageRefs && <ImageRefCompatibilityResults analysis={compatibilityAnalysis} imageRefs={item.imageRefs} entityMap={entityMap} onSelectionChange={handleSelectionChange} selections={imageRefSelections} onApply={handleApplySelections} isApplying={isApplying} />}

      {/* Image Anchors */}
      {item.imageRefs && entityMap && <div>
          <div className="itab-anchors-heading">
            Image Anchors
            <span className="itab-anchors-count">({item.imageRefs.refs?.length || 0} placed)</span>
          </div>
          <ChronicleImagePanel imageRefs={item.imageRefs} entities={entityMap} onGenerateImage={onGenerateChronicleImage} onResetImage={onResetChronicleImage} onRegenerateDescription={onRegenerateDescription} onUpdateAnchorText={onUpdateChronicleAnchorText} onUpdateSize={onUpdateChronicleImageSize} onUpdateJustification={onUpdateChronicleImageJustification} onSelectExistingImage={onSelectExistingImage} projectId={item.projectId} chronicleId={item.chronicleId} chronicleText={chronicleText} isGenerating={isGenerating} styleLibrary={styleLibrary} styleSelection={styleSelection} cultures={cultures} cultureIdentities={cultureIdentities} worldContext={worldContext} chronicleTitle={item.title || item.name} imageSize={imageSize} imageQuality={imageQuality} imageModel={imageModel} imageGenSettings={imageGenSettings} onOpenImageSettings={onOpenImageSettings} />
        </div>}

      {!item.imageRefs && !(onGenerateCoverImageScene || onGenerateCoverImage) && <div className="ilu-empty itab-empty">
          No images generated yet. Use the Pipeline tab to generate image refs and cover images.
        </div>}
    </div>;
}
ImageRefVersionWarning.propTypes = {
  item: PropTypes.object.isRequired,
  versions: PropTypes.array,
  activeVersionId: PropTypes.string,
  chronicleText: PropTypes.string,
  onAnalyzeCompatibility: PropTypes.func.isRequired,
  isAnalyzing: PropTypes.bool
};
ImageRefCompatibilityResults.propTypes = {
  analysis: PropTypes.object,
  imageRefs: PropTypes.object,
  entityMap: PropTypes.object,
  onSelectionChange: PropTypes.func.isRequired,
  selections: PropTypes.array,
  onApply: PropTypes.func,
  isApplying: PropTypes.bool
};
CoverImagePreview.propTypes = {
  imageId: PropTypes.string,
  onImageClick: PropTypes.func
};
ImagesTab.propTypes = {
  item: PropTypes.object.isRequired,
  isGenerating: PropTypes.bool,
  entityMap: PropTypes.object,
  onGenerateCoverImageScene: PropTypes.func,
  onGenerateCoverImage: PropTypes.func,
  onImageClick: PropTypes.func,
  onGenerateChronicleImage: PropTypes.func,
  onResetChronicleImage: PropTypes.func,
  onRegenerateDescription: PropTypes.func,
  onUpdateChronicleAnchorText: PropTypes.func,
  onUpdateChronicleImageSize: PropTypes.func,
  onUpdateChronicleImageJustification: PropTypes.func,
  styleLibrary: PropTypes.object,
  styleSelection: PropTypes.object,
  cultures: PropTypes.array,
  cultureIdentities: PropTypes.object,
  worldContext: PropTypes.object,
  imageSize: PropTypes.string,
  imageQuality: PropTypes.string,
  imageModel: PropTypes.string,
  imageGenSettings: PropTypes.object,
  onOpenImageSettings: PropTypes.func,
  chronicleText: PropTypes.string,
  versions: PropTypes.array,
  activeVersionId: PropTypes.string,
  onApplyImageRefSelections: PropTypes.func,
  onSelectExistingImage: PropTypes.func,
  onSelectExistingCoverImage: PropTypes.func
};
