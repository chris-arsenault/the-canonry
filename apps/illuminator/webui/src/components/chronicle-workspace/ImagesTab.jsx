import { useState, useMemo, useCallback } from 'react';
import ChronicleImagePanel from '../ChronicleImagePanel';
import { useImageUrl } from '../../hooks/useImageUrl';
import {
  analyzeImageRefCompatibility,
  createDefaultSelections,
} from '../../lib/imageRefCompatibility';

// ============================================================================
// Image Ref Version Mismatch Warning
// ============================================================================

function ImageRefVersionWarning({
  item,
  versions,
  activeVersionId,
  chronicleText,
  onAnalyzeCompatibility,
  isAnalyzing,
}) {
  const imageRefsTargetVersionId = item.imageRefsTargetVersionId;
  if (!imageRefsTargetVersionId || imageRefsTargetVersionId === activeVersionId) {
    return null;
  }

  // Find version labels
  const getVersionLabel = (versionId) => {
    const idx = versions?.findIndex((v) => v.id === versionId);
    if (idx >= 0) return `Version ${idx + 1}`;
    return 'Unknown version';
  };

  const sourceLabel = getVersionLabel(imageRefsTargetVersionId);
  const targetLabel = getVersionLabel(activeVersionId);

  return (
    <div
      style={{
        marginBottom: '16px',
        padding: '12px 16px',
        background: 'rgba(245, 158, 11, 0.1)',
        border: '1px solid rgba(245, 158, 11, 0.3)',
        borderRadius: '8px',
      }}
    >
      <div style={{ fontSize: '13px', fontWeight: 500, color: '#f59e0b', marginBottom: '4px' }}>
        ⚠ Image refs generated for different version
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
        Image refs were generated for <strong>{sourceLabel}</strong>, but the active version is{' '}
        <strong>{targetLabel}</strong>. Some anchor texts may no longer match.
      </div>
      <button
        onClick={onAnalyzeCompatibility}
        disabled={isAnalyzing}
        style={{
          padding: '6px 12px',
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border-color)',
          borderRadius: '6px',
          color: 'var(--text-secondary)',
          cursor: isAnalyzing ? 'not-allowed' : 'pointer',
          opacity: isAnalyzing ? 0.6 : 1,
          fontSize: '12px',
        }}
      >
        {isAnalyzing ? 'Analyzing...' : 'Analyze Compatibility'}
      </button>
    </div>
  );
}

// ============================================================================
// Image Ref Compatibility Results
// ============================================================================

function ImageRefCompatibilityResults({ analysis, imageRefs, entityMap, onSelectionChange, selections, onApply, isApplying }) {
  if (!analysis) return null;

  const getRefLabel = (refId) => {
    const ref = imageRefs.refs.find((r) => r.refId === refId);
    if (!ref) return refId;
    if (ref.type === 'entity_ref') {
      const entity = entityMap?.get(ref.entityId);
      return entity?.name || ref.entityId;
    }
    return ref.anchorText?.slice(0, 30) + '...' || refId;
  };

  const getRecommendationStyle = (recommendation) => {
    switch (recommendation) {
      case 'reuse':
        return { color: '#10b981', badge: '✓ Reusable' };
      case 'regenerate':
        return { color: '#ef4444', badge: '↻ Regenerate' };
      case 'manual_review':
        return { color: '#f59e0b', badge: '? Review' };
      default:
        return { color: 'var(--text-muted)', badge: '?' };
    }
  };

  return (
    <div
      style={{
        marginBottom: '16px',
        padding: '12px 16px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
      }}
    >
      <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '8px' }}>
        Compatibility Analysis
        <span style={{ marginLeft: '8px', fontSize: '11px', fontWeight: 400, color: 'var(--text-muted)' }}>
          {analysis.summary.reusable} reusable, {analysis.summary.needsRegeneration} need regen,{' '}
          {analysis.summary.needsReview} review
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {analysis.refs.map((refAnalysis) => {
          const style = getRecommendationStyle(refAnalysis.recommendation);
          const selection = selections.find((s) => s.refId === refAnalysis.refId);
          const currentAction = selection?.action || 'reuse';

          return (
            <div
              key={refAnalysis.refId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '8px',
                background: 'var(--bg-tertiary)',
                borderRadius: '6px',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', fontWeight: 500 }}>{getRefLabel(refAnalysis.refId)}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{refAnalysis.reason}</div>
              </div>
              <span
                style={{
                  fontSize: '10px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: `${style.color}20`,
                  color: style.color,
                }}
              >
                {style.badge}
              </span>
              <select
                value={currentAction}
                onChange={(e) => onSelectionChange(refAnalysis.refId, e.target.value)}
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                }}
              >
                <option value="reuse">Keep</option>
                <option value="regenerate">Regenerate</option>
                <option value="skip">Skip</option>
              </select>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          "Keep" preserves the ref. "Regenerate" resets for new image. "Skip" removes.
        </div>
        {onApply && (
          <button
            onClick={onApply}
            disabled={isApplying}
            style={{
              padding: '6px 14px',
              background: '#3b82f6',
              border: 'none',
              borderRadius: '6px',
              color: 'white',
              cursor: isApplying ? 'not-allowed' : 'pointer',
              opacity: isApplying ? 0.6 : 1,
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            {isApplying ? 'Applying...' : 'Apply Selections'}
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Cover Image Preview (local)
// ============================================================================

function CoverImagePreview({ imageId, onImageClick }) {
  const { url, loading, error } = useImageUrl(imageId);

  if (!imageId) return null;

  if (loading) {
    return (
      <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
        Loading image...
      </div>
    );
  }

  if (error || !url) {
    return (
      <div style={{ marginTop: '8px', fontSize: '11px', color: '#ef4444' }}>
        Failed to load image{error ? `: ${error}` : ''}
      </div>
    );
  }

  return (
    <div style={{ marginTop: '10px' }}>
      <img
        src={url}
        alt="Cover image"
        onClick={onImageClick ? () => onImageClick(imageId, 'Cover Image') : undefined}
        style={{
          maxWidth: '100%',
          maxHeight: '300px',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          objectFit: 'contain',
          cursor: onImageClick ? 'pointer' : undefined,
        }}
      />
    </div>
  );
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
}) {
  // Compatibility analysis state
  const [compatibilityAnalysis, setCompatibilityAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [imageRefSelections, setImageRefSelections] = useState([]);

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
    const sourceVersion = versions.find((v) => v.id === item.imageRefsTargetVersionId);
    const targetVersion = versions.find((v) => v.id === activeVersionId);

    const sourceContent = sourceVersion?.content || '';
    const targetContent = targetVersion?.content || chronicleText || '';

    if (!sourceContent || !targetContent) {
      console.warn('[ImagesTab] Missing content for compatibility analysis');
      setIsAnalyzing(false);
      return;
    }

    try {
      const analysis = analyzeImageRefCompatibility(
        item.imageRefs,
        sourceContent,
        targetContent,
        item.imageRefsTargetVersionId,
        activeVersionId
      );

      setCompatibilityAnalysis(analysis);
      setImageRefSelections(createDefaultSelections(analysis));
    } catch (err) {
      console.error('[ImagesTab] Compatibility analysis failed:', err);
    }

    setIsAnalyzing(false);
  }, [item.imageRefs, item.imageRefsTargetVersionId, versions, activeVersionId, chronicleText]);

  // Handle selection change
  const handleSelectionChange = useCallback((refId, action) => {
    setImageRefSelections((prev) =>
      prev.map((s) => (s.refId === refId ? { ...s, action } : s))
    );
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
      console.error('[ImagesTab] Failed to apply selections:', err);
    }
    setIsApplying(false);
  }, [onApplyImageRefSelections, activeVersionId, imageRefSelections]);

  return (
    <div>
      {/* Cover Image */}
      {(onGenerateCoverImageScene || onGenerateCoverImage) && (
        <div
          style={{
            marginBottom: '20px',
            padding: '16px',
            background: 'var(--bg-secondary)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
          }}
        >
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Cover Image</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Generate a montage-style cover image for this chronicle.
              </div>
              {!item.coverImage && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Not run yet
                </div>
              )}
              {item.coverImage && item.coverImage.status === 'pending' && (
                <div style={{ fontSize: '11px', color: '#f59e0b', marginTop: '4px' }}>
                  Scene ready - click Generate Image to create
                </div>
              )}
              {item.coverImage && item.coverImage.status === 'generating' && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Generating image...
                </div>
              )}
              {item.coverImage && item.coverImage.status === 'complete' && (
                <div style={{ fontSize: '11px', color: '#10b981', marginTop: '4px' }}>
                  Complete
                </div>
              )}
              {item.coverImage && item.coverImage.status === 'failed' && (
                <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px' }}>
                  Failed{item.coverImage.error ? `: ${item.coverImage.error}` : ''}
                </div>
              )}
              {item.coverImage?.sceneDescription && (
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px', fontStyle: 'italic', lineHeight: 1.4, maxWidth: '500px' }}>
                  {item.coverImage.sceneDescription}
                </div>
              )}
              <CoverImagePreview imageId={item.coverImage?.generatedImageId} onImageClick={onImageClick} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignSelf: 'flex-start' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                {onGenerateCoverImageScene && (
                  <button
                    onClick={onGenerateCoverImageScene}
                    disabled={isGenerating}
                    style={{
                      padding: '8px 14px',
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      color: 'var(--text-secondary)',
                      cursor: isGenerating ? 'not-allowed' : 'pointer',
                      opacity: isGenerating ? 0.6 : 1,
                      fontSize: '12px',
                      height: '32px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.coverImage ? 'Regen Scene' : 'Gen Scene'}
                  </button>
                )}
                {onGenerateCoverImage && item.coverImage && (item.coverImage.status === 'pending' || item.coverImage.status === 'complete' || item.coverImage.status === 'failed') && (
                  <button
                    onClick={onGenerateCoverImage}
                    disabled={isGenerating}
                    style={{
                      padding: '8px 14px',
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      color: 'var(--text-secondary)',
                      cursor: isGenerating ? 'not-allowed' : 'pointer',
                      opacity: isGenerating ? 0.6 : 1,
                      fontSize: '12px',
                      height: '32px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.coverImage.status === 'complete' ? 'Regen Image' : 'Gen Image'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Version Mismatch Warning */}
      {hasVersionMismatch && item.imageRefs && (
        <ImageRefVersionWarning
          item={item}
          versions={versions}
          activeVersionId={activeVersionId}
          chronicleText={chronicleText}
          onAnalyzeCompatibility={handleAnalyzeCompatibility}
          isAnalyzing={isAnalyzing}
        />
      )}

      {/* Compatibility Analysis Results */}
      {compatibilityAnalysis && item.imageRefs && (
        <ImageRefCompatibilityResults
          analysis={compatibilityAnalysis}
          imageRefs={item.imageRefs}
          entityMap={entityMap}
          onSelectionChange={handleSelectionChange}
          selections={imageRefSelections}
          onApply={handleApplySelections}
          isApplying={isApplying}
        />
      )}

      {/* Image Anchors */}
      {item.imageRefs && entityMap && (
        <div>
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
            Image Anchors
            <span style={{ marginLeft: '8px', fontSize: '12px', fontWeight: 400, color: 'var(--text-muted)' }}>
              ({item.imageRefs.refs?.length || 0} placed)
            </span>
          </div>
          <ChronicleImagePanel
            imageRefs={item.imageRefs}
            entities={entityMap}
            onGenerateImage={onGenerateChronicleImage}
            onResetImage={onResetChronicleImage}
            onRegenerateDescription={onRegenerateDescription}
            onUpdateAnchorText={onUpdateChronicleAnchorText}
            onUpdateSize={onUpdateChronicleImageSize}
            onUpdateJustification={onUpdateChronicleImageJustification}
            onSelectExistingImage={onSelectExistingImage}
            projectId={item.projectId}
            chronicleId={item.chronicleId}
            chronicleText={chronicleText}
            isGenerating={isGenerating}
            styleLibrary={styleLibrary}
            styleSelection={styleSelection}
            cultures={cultures}
            cultureIdentities={cultureIdentities}
            worldContext={worldContext}
            chronicleTitle={item.title || item.name}
            imageSize={imageSize}
            imageQuality={imageQuality}
            imageModel={imageModel}
            imageGenSettings={imageGenSettings}
            onOpenImageSettings={onOpenImageSettings}
          />
        </div>
      )}

      {!item.imageRefs && !(onGenerateCoverImageScene || onGenerateCoverImage) && (
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '24px', textAlign: 'center' }}>
          No images generated yet. Use the Pipeline tab to generate image refs and cover images.
        </div>
      )}
    </div>
  );
}
