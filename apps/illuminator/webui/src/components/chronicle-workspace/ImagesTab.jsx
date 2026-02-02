import ChronicleImagePanel from '../ChronicleImagePanel';
import { useImageUrl } from '../../hooks/useImageUrl';

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
}) {
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
