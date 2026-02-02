import { useState, useEffect } from 'react';
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
// Cover Image Controls (local)
// ============================================================================

function CoverImageControls({
  item,
  onGenerateCoverImageScene,
  onGenerateCoverImage,
  onImageClick,
  isGenerating,
  labelWeight = 500,
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', fontWeight: labelWeight }}>Cover Image</div>
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
  );
}

// ============================================================================
// Temperature Regeneration Control (local)
// ============================================================================

function TemperatureRegenerationControl({ item, onRegenerateWithTemperature, isGenerating }) {
  const baseTemperature = typeof item.generationTemperature === 'number'
    ? item.generationTemperature
    : (item.narrativeStyle?.temperature ?? 0.7);
  const [temperature, setTemperature] = useState(baseTemperature);

  useEffect(() => {
    setTemperature(baseTemperature);
  }, [baseTemperature, item.chronicleId]);

  const hasPrompts = Boolean(item.generationSystemPrompt && item.generationUserPrompt);
  const disabled = isGenerating || !hasPrompts || !onRegenerateWithTemperature;

  const clamp = (value) => Math.min(1, Math.max(0, value));
  const handleChange = (value) => setTemperature(clamp(value));

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '13px', fontWeight: 500 }}>
          Temperature Regeneration
          <span style={{ marginLeft: '8px', color: 'var(--text-muted)', fontSize: '12px' }}>
            (0&ndash;1)
          </span>
        </div>
        <button
          onClick={() => onRegenerateWithTemperature?.(temperature)}
          disabled={disabled}
          style={{
            padding: '8px 14px',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            color: 'var(--text-secondary)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.6 : 1,
            fontSize: '12px',
          }}
        >
          Regenerate with temperature
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px', flexWrap: 'wrap' }}>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={temperature}
          onChange={(e) => handleChange(parseFloat(e.target.value))}
          disabled={disabled}
          style={{ flex: 1, minWidth: '160px' }}
        />
        <input
          type="number"
          min="0"
          max="1"
          step="0.01"
          value={temperature}
          onChange={(e) => handleChange(parseFloat(e.target.value || '0'))}
          disabled={disabled}
          style={{
            width: '72px',
            padding: '6px 8px',
            borderRadius: '6px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            fontSize: '12px',
          }}
        />
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Current: {temperature.toFixed(2)}
        </span>
      </div>

      {!hasPrompts && (
        <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
          Stored prompts unavailable for this chronicle (legacy generation). Temperature regen is disabled.
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Refinement Checklist Row
// ============================================================================

function RefinementRow({ label, description, state, indicator, onAction, actionLabel, isGenerating }) {
  const running = state?.running;
  const done = state?.generatedAt;
  const formatTimestamp = (ts) => new Date(ts).toLocaleString();

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', fontWeight: 500 }}>
          <span style={{ marginRight: '8px', color: done ? '#10b981' : 'var(--text-muted)' }}>
            {done ? '\u2611' : '\u2610'}
          </span>
          {label}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '24px' }}>
          {description}
        </div>
        {done && (
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', marginLeft: '24px' }}>
            Done - {formatTimestamp(done)}
            {state.model ? ` - ${state.model}` : ''}
          </div>
        )}
        {indicator && done && (
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', marginLeft: '24px' }}>
            {indicator}
          </div>
        )}
        {!done && !running && (
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', marginLeft: '24px' }}>
            Not run yet
          </div>
        )}
        {running && (
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', marginLeft: '24px' }}>
            Running...
          </div>
        )}
      </div>
      {onAction && (
        <button
          onClick={onAction}
          disabled={isGenerating || running}
          style={{
            padding: '8px 14px',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            color: 'var(--text-secondary)',
            cursor: isGenerating || running ? 'not-allowed' : 'pointer',
            opacity: isGenerating || running ? 0.6 : 1,
            fontSize: '12px',
            height: '32px',
            alignSelf: 'center',
          }}
        >
          {actionLabel || (done ? 'Regenerate' : 'Generate')}
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Pipeline Tab
// ============================================================================

export default function PipelineTab({
  item,
  isGenerating,
  refinements,
  onValidate,
  onGenerateSummary,
  onGenerateTitle,
  onGenerateImageRefs,
  onGenerateCoverImageScene,
  onGenerateCoverImage,
  onImageClick,
  onRegenerateWithTemperature,
  entityMap,
  styleLibrary,
  styleSelection,
  cultures,
  cultureIdentities,
  worldContext,
  summaryIndicator,
  imageRefsIndicator,
  imageRefsTargetContent,
  imageSize,
  imageQuality,
  imageModel,
  imageGenSettings,
  onOpenImageSettings,
  onGenerateChronicleImage,
  onResetChronicleImage,
  onRegenerateDescription,
  onUpdateChronicleAnchorText,
  onUpdateChronicleImageSize,
  onUpdateChronicleImageJustification,
}) {
  const summaryState = refinements?.summary || {};
  const titleState = refinements?.title || {};
  const imageRefsState = refinements?.imageRefs || {};

  const completedCount = [
    summaryState.generatedAt,
    titleState.generatedAt,
    item.coverImage?.status === 'complete',
    imageRefsState.generatedAt,
    item.cohesionReport,
  ].filter(Boolean).length;

  return (
    <div>
      {/* Refinement Checklist */}
      <div
        style={{
          marginBottom: '24px',
          padding: '16px',
          background: 'var(--bg-secondary)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
        }}
      >
        <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
          <span>Refinements</span>
          <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-muted)' }}>{completedCount}/5 complete</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <RefinementRow
            label="Summary"
            description="Generate a short summary for chronicle listings."
            state={summaryState}
            indicator={summaryIndicator}
            onAction={onGenerateSummary}
            isGenerating={isGenerating}
          />

          {/* Title - with candidates display */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 500 }}>
                <span style={{ marginRight: '8px', color: titleState.generatedAt ? '#10b981' : 'var(--text-muted)' }}>
                  {titleState.generatedAt ? '\u2611' : '\u2610'}
                </span>
                Title
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '24px' }}>
                Generate an evocative title using two-pass synthesis.
              </div>
              {titleState.generatedAt && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', marginLeft: '24px' }}>
                  Done - {new Date(titleState.generatedAt).toLocaleString()}
                  {titleState.model ? ` - ${titleState.model}` : ''}
                </div>
              )}
              {item.titleCandidates?.length > 0 && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.5, marginLeft: '24px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    &#x25C6; {item.title}
                  </span>
                  <br />
                  {item.titleCandidates.map((c, i) => (
                    <span key={i}>
                      <span style={{ opacity: 0.6 }}>&#x25C7;</span> {c}
                      {i < item.titleCandidates.length - 1 ? <br /> : null}
                    </span>
                  ))}
                </div>
              )}
              {!titleState.generatedAt && !titleState.running && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', marginLeft: '24px' }}>
                  Not run yet
                </div>
              )}
              {titleState.running && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', marginLeft: '24px' }}>
                  Running...
                </div>
              )}
            </div>
            {onGenerateTitle && (
              <button
                onClick={onGenerateTitle}
                disabled={isGenerating || titleState.running}
                style={{
                  padding: '8px 14px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  color: 'var(--text-secondary)',
                  cursor: isGenerating || titleState.running ? 'not-allowed' : 'pointer',
                  opacity: isGenerating || titleState.running ? 0.6 : 1,
                  fontSize: '12px',
                  height: '32px',
                  alignSelf: 'center',
                }}
              >
                {titleState.generatedAt ? 'Regenerate' : 'Generate'}
              </button>
            )}
          </div>

          <CoverImageControls
            item={item}
            onGenerateCoverImageScene={onGenerateCoverImageScene}
            onGenerateCoverImage={onGenerateCoverImage}
            isGenerating={isGenerating}
            onImageClick={onImageClick}
          />

          <RefinementRow
            label="Image Refs"
            description="Generate image placement suggestions for this chronicle."
            state={imageRefsState}
            indicator={imageRefsIndicator}
            onAction={onGenerateImageRefs}
            isGenerating={isGenerating}
          />

          {onValidate && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 500 }}>
                  <span style={{ marginRight: '8px', color: item.cohesionReport ? '#10b981' : 'var(--text-muted)' }}>
                    {item.cohesionReport ? '\u2611' : '\u2610'}
                  </span>
                  Validate
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '24px' }}>
                  Run quality validation to check narrative coherence.
                </div>
                {item.cohesionReport && (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', marginLeft: '24px' }}>
                    Done - Score: {item.cohesionReport.overallScore}/100
                  </div>
                )}
              </div>
              <button
                onClick={onValidate}
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
                  alignSelf: 'center',
                }}
              >
                {item.cohesionReport ? 'Revalidate' : 'Validate'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Temperature Regeneration */}
      <TemperatureRegenerationControl
        item={item}
        onRegenerateWithTemperature={onRegenerateWithTemperature}
        isGenerating={isGenerating}
      />
    </div>
  );
}
