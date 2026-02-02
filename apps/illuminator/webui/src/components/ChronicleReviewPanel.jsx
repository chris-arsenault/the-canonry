/**
 * ChronicleReviewPanel - Shared review/refinement UI for chronicles
 *
 * assembly_ready and complete statuses delegate to ChronicleWorkspace (tabbed UI).
 * validation_ready keeps its own inline layout since it's a different workflow.
 */

import { useMemo, useState, useEffect } from 'react';
import { diffWords } from 'diff';
import CohesionReportViewer from './CohesionReportViewer';
import ImageModal from './ImageModal';
import ChronicleWorkspace from './chronicle-workspace/ChronicleWorkspace';

// ============================================================================
// Perspective Synthesis Viewer (kept for validation_ready)
// ============================================================================

function PerspectiveSynthesisViewer({ synthesis }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('output');

  if (!synthesis) return null;

  const formatCost = (cost) => `$${cost.toFixed(4)}`;
  const formatTimestamp = (ts) => new Date(ts).toLocaleString();

  const hasInputData = synthesis.coreTone || synthesis.inputFacts || synthesis.inputCulturalIdentities || synthesis.constellation;

  return (
    <div
      style={{
        marginBottom: '16px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          background: 'var(--bg-tertiary)',
          borderBottom: isExpanded ? '1px solid var(--border-color)' : 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          cursor: 'pointer',
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {isExpanded ? '\u25BC' : '\u25B6'}
        </span>
        <span style={{ fontSize: '13px', fontWeight: 500 }}>
          Perspective Synthesis
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {synthesis.facets?.length || 0} facets &bull; {synthesis.entityDirectives?.length || 0} directives &bull; {synthesis.suggestedMotifs?.length || 0} motifs &bull; {formatCost(synthesis.actualCost)}
        </span>
      </div>

      {isExpanded && (
        <div style={{ padding: '16px' }}>
          {hasInputData && (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button
                onClick={() => setActiveTab('output')}
                style={{
                  padding: '6px 14px', fontSize: '12px',
                  fontWeight: activeTab === 'output' ? 600 : 400,
                  background: activeTab === 'output' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                  color: activeTab === 'output' ? 'white' : 'var(--text-secondary)',
                  border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer',
                }}
              >
                LLM Output
              </button>
              <button
                onClick={() => setActiveTab('input')}
                style={{
                  padding: '6px 14px', fontSize: '12px',
                  fontWeight: activeTab === 'input' ? 600 : 400,
                  background: activeTab === 'input' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                  color: activeTab === 'input' ? 'white' : 'var(--text-secondary)',
                  border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer',
                }}
              >
                LLM Input
              </button>
            </div>
          )}
          {activeTab === 'output' && (
            <>
              {synthesis.constellationSummary && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '4px' }}>CONSTELLATION SUMMARY</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{synthesis.constellationSummary}</div>
                </div>
              )}
              {synthesis.brief && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '4px' }}>PERSPECTIVE BRIEF</div>
                  <div style={{ fontSize: '12px', lineHeight: 1.6, color: 'var(--text-primary)', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '6px', whiteSpace: 'pre-wrap' }}>{synthesis.brief}</div>
                </div>
              )}
            </>
          )}
          {activeTab === 'input' && synthesis.coreTone && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '4px' }}>CORE TONE</div>
              <div style={{ fontSize: '12px', lineHeight: 1.6, color: 'var(--text-primary)', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '6px', whiteSpace: 'pre-wrap' }}>{synthesis.coreTone}</div>
            </div>
          )}
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '16px', flexWrap: 'wrap', borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '8px' }}>
            <span>Model: {synthesis.model}</span>
            <span>Tokens: {synthesis.inputTokens} in / {synthesis.outputTokens} out</span>
            <span>Generated: {formatTimestamp(synthesis.generatedAt)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Temperature Regeneration Control (kept for validation_ready)
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
    <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '13px', fontWeight: 500 }}>
          Temperature Regeneration <span style={{ marginLeft: '8px', color: 'var(--text-muted)', fontSize: '12px' }}>(0&ndash;1)</span>
        </div>
        <button onClick={() => onRegenerateWithTemperature?.(temperature)} disabled={disabled} style={{ padding: '8px 14px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-secondary)', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1, fontSize: '12px' }}>
          Regenerate with temperature
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px', flexWrap: 'wrap' }}>
        <input type="range" min="0" max="1" step="0.05" value={temperature} onChange={(e) => handleChange(parseFloat(e.target.value))} disabled={disabled} style={{ flex: 1, minWidth: '160px' }} />
        <input type="number" min="0" max="1" step="0.01" value={temperature} onChange={(e) => handleChange(parseFloat(e.target.value || '0'))} disabled={disabled} style={{ width: '72px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '12px' }} />
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Current: {temperature.toFixed(2)}</span>
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
// Version Selector (kept for validation_ready)
// ============================================================================

function ChronicleVersionSelector({ versions, selectedVersionId, activeVersionId, compareToVersionId, onSelectVersion, onSelectCompareVersion, onSetActiveVersion, disabled }) {
  const isActive = selectedVersionId === activeVersionId;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      <select value={selectedVersionId} onChange={(e) => onSelectVersion(e.target.value)} disabled={disabled} className="illuminator-select" style={{ width: 'auto', minWidth: '240px', fontSize: '12px', padding: '4px 6px' }}>
        {versions.map((version) => (<option key={version.id} value={version.id}>{version.label}</option>))}
      </select>
      <select value={compareToVersionId} onChange={(e) => onSelectCompareVersion(e.target.value)} disabled={disabled} className="illuminator-select" style={{ width: 'auto', minWidth: '160px', fontSize: '12px', padding: '4px 6px' }} title="Select a version to diff against">
        <option value="">Compare to...</option>
        {versions.filter(v => v.id !== selectedVersionId).map((version) => (<option key={version.id} value={version.id}>{version.shortLabel || version.label}</option>))}
      </select>
      {isActive ? (
        <span style={{ fontSize: '11px', padding: '2px 8px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', borderRadius: '999px', fontWeight: 500 }}>Active</span>
      ) : (
        <button onClick={() => onSetActiveVersion?.(selectedVersionId)} disabled={disabled || !onSetActiveVersion} style={{ padding: '6px 12px', fontSize: '11px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-secondary)', cursor: disabled || !onSetActiveVersion ? 'not-allowed' : 'pointer', opacity: disabled || !onSetActiveVersion ? 0.6 : 1 }}>
          Make Active
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Assembled Content Viewer (kept for validation_ready)
// ============================================================================

function AssembledContentViewer({ content, wordCount, onCopy, compareContent, compareLabel }) {
  const diffParts = useMemo(() => {
    if (!compareContent) return null;
    return diffWords(compareContent, content);
  }, [content, compareContent]);

  return (
    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {wordCount.toLocaleString()} words
          {diffParts && (
            <span style={{ marginLeft: '8px' }}>
              &mdash; diff vs {compareLabel}
              <span style={{ marginLeft: '6px', color: 'rgba(34, 197, 94, 0.8)' }}>+{diffParts.filter(p => p.added).reduce((n, p) => n + p.value.split(/\s+/).filter(Boolean).length, 0)}</span>
              <span style={{ marginLeft: '4px', color: 'rgba(239, 68, 68, 0.8)' }}>-{diffParts.filter(p => p.removed).reduce((n, p) => n + p.value.split(/\s+/).filter(Boolean).length, 0)}</span>
            </span>
          )}
        </span>
        <button onClick={onCopy} style={{ padding: '4px 12px', fontSize: '11px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-secondary)' }}>Copy</button>
      </div>
      <div style={{ padding: '20px', maxHeight: '500px', overflowY: 'auto', fontSize: '14px', lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>
        {diffParts ? (
          diffParts.map((part, i) => {
            if (part.added) return <span key={i} style={{ background: 'rgba(34, 197, 94, 0.2)', borderRadius: '2px', padding: '0 1px' }}>{part.value}</span>;
            if (part.removed) return <span key={i} style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--text-secondary)', borderRadius: '2px', padding: '0 1px', textDecoration: 'line-through' }}>{part.value}</span>;
            return <span key={i}>{part.value}</span>;
          })
        ) : content}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function ChronicleReviewPanel({
  item,

  // Actions
  onContinueToValidation,
  onValidate,
  onAddImages,
  onAccept,
  onRegenerate,
  onRegenerateWithTemperature,
  onCompareVersions,
  onCombineVersions,
  onCorrectSuggestions,
  onGenerateSummary,
  onGenerateTitle,
  onAcceptPendingTitle,
  onRejectPendingTitle,
  onGenerateImageRefs,
  onRevalidate,
  onGenerateChronicleImage,
  onResetChronicleImage,
  onRegenerateDescription,
  onUpdateChronicleAnchorText,
  onUpdateChronicleTemporalContext,
  onUpdateChronicleActiveVersion,
  onUpdateCombineInstructions,
  onUnpublish,

  // Cover image
  onGenerateCoverImageScene,
  onGenerateCoverImage,
  styleSelection,
  imageSize,
  imageQuality,
  imageModel,
  imageGenSettings,
  onOpenImageSettings,

  // Image layout edits
  onUpdateChronicleImageSize,
  onUpdateChronicleImageJustification,

  // Export
  onExport,

  // Lore backport
  onBackportLore,

  // Historian review
  onHistorianReview,
  isHistorianActive,
  onUpdateHistorianNote,

  // State
  isGenerating,
  refinements,

  // Data for refinements
  entities,
  styleLibrary,
  cultures,
  entityGuidance,
  cultureIdentities,
  worldContext,
  eras,
}) {
  if (!item) return null;

  // ---------------------------------------------------------------------------
  // Assembly Ready & Complete → Tabbed Workspace
  // ---------------------------------------------------------------------------
  if (
    (item.status === 'assembly_ready' && item.assembledContent) ||
    (item.status === 'complete' && item.finalContent)
  ) {
    return (
      <ChronicleWorkspace
        item={item}
        onAccept={onAccept}
        onRegenerate={onRegenerate}
        onRegenerateWithTemperature={onRegenerateWithTemperature}
        onCompareVersions={onCompareVersions}
        onCombineVersions={onCombineVersions}
        onValidate={onValidate}
        onGenerateSummary={onGenerateSummary}
        onGenerateTitle={onGenerateTitle}
        onAcceptPendingTitle={onAcceptPendingTitle}
        onRejectPendingTitle={onRejectPendingTitle}
        onGenerateImageRefs={onGenerateImageRefs}
        onGenerateChronicleImage={onGenerateChronicleImage}
        onResetChronicleImage={onResetChronicleImage}
        onRegenerateDescription={onRegenerateDescription}
        onUpdateChronicleAnchorText={onUpdateChronicleAnchorText}
        onUpdateChronicleTemporalContext={onUpdateChronicleTemporalContext}
        onUpdateChronicleActiveVersion={onUpdateChronicleActiveVersion}
        onUpdateCombineInstructions={onUpdateCombineInstructions}
        onUnpublish={onUnpublish}
        onGenerateCoverImageScene={onGenerateCoverImageScene}
        onGenerateCoverImage={onGenerateCoverImage}
        styleSelection={styleSelection}
        imageSize={imageSize}
        imageQuality={imageQuality}
        imageModel={imageModel}
        imageGenSettings={imageGenSettings}
        onOpenImageSettings={onOpenImageSettings}
        onUpdateChronicleImageSize={onUpdateChronicleImageSize}
        onUpdateChronicleImageJustification={onUpdateChronicleImageJustification}
        onExport={onExport}
        onBackportLore={onBackportLore}
        onHistorianReview={onHistorianReview}
        isHistorianActive={isHistorianActive}
        onUpdateHistorianNote={onUpdateHistorianNote}
        isGenerating={isGenerating}
        refinements={refinements}
        entities={entities}
        styleLibrary={styleLibrary}
        cultures={cultures}
        cultureIdentities={cultureIdentities}
        worldContext={worldContext}
        eras={eras}
      />
    );
  }

  // ---------------------------------------------------------------------------
  // Validation Ready → Inline layout (not tabbed)
  // ---------------------------------------------------------------------------
  if (item.status === 'validation_ready') {
    return (
      <ValidationReadyView
        item={item}
        onExport={onExport}
        onRegenerateWithTemperature={onRegenerateWithTemperature}
        onAccept={onAccept}
        onRegenerate={onRegenerate}
        onCorrectSuggestions={onCorrectSuggestions}
        onGenerateSummary={onGenerateSummary}
        onGenerateImageRefs={onGenerateImageRefs}
        onRevalidate={onRevalidate}
        onGenerateChronicleImage={onGenerateChronicleImage}
        onResetChronicleImage={onResetChronicleImage}
        onUpdateChronicleAnchorText={onUpdateChronicleAnchorText}
        onUpdateChronicleImageSize={onUpdateChronicleImageSize}
        onUpdateChronicleImageJustification={onUpdateChronicleImageJustification}
        onUpdateChronicleActiveVersion={onUpdateChronicleActiveVersion}
        isGenerating={isGenerating}
        refinements={refinements}
        entities={entities}
        styleLibrary={styleLibrary}
        cultures={cultures}
        cultureIdentities={cultureIdentities}
        worldContext={worldContext}
      />
    );
  }

  return null;
}

// ============================================================================
// Validation Ready View (self-contained)
// ============================================================================

function ValidationReadyView({
  item,
  onExport,
  onRegenerateWithTemperature,
  onAccept,
  onRegenerate,
  onCorrectSuggestions,
  onGenerateSummary,
  onGenerateImageRefs,
  onRevalidate,
  onGenerateChronicleImage,
  onResetChronicleImage,
  onUpdateChronicleAnchorText,
  onUpdateChronicleImageSize,
  onUpdateChronicleImageJustification,
  onUpdateChronicleActiveVersion,
  isGenerating,
  refinements,
  entities,
  styleLibrary,
  cultures,
  cultureIdentities,
  worldContext,
}) {
  const entityMap = useMemo(() => {
    if (!entities) return new Map();
    return new Map(entities.map((e) => [e.id, e]));
  }, [entities]);

  const [imageModal, setImageModal] = useState({ open: false, imageId: '', title: '' });

  const wordCountFn = (content) => content?.split(/\s+/).filter(Boolean).length || 0;
  const copyToClipboard = (content) => navigator.clipboard.writeText(content);

  const currentVersionId = `current_${item.assembledAt ?? item.createdAt}`;
  const activeVersionId = item.activeVersionId || currentVersionId;

  const versions = useMemo(() => {
    const history = (item.generationHistory || []).map((version, index) => {
      const tempLabel = typeof version.temperature === 'number' ? version.temperature.toFixed(2) : 'default';
      return {
        id: version.versionId,
        content: version.content,
        wordCount: version.wordCount,
        shortLabel: `V${index + 1}`,
        label: `Version ${index + 1} \u2022 ${new Date(version.generatedAt).toLocaleString()} \u2022 temp ${tempLabel}`,
      };
    });
    const currentTempLabel = typeof item.generationTemperature === 'number' ? item.generationTemperature.toFixed(2) : 'default';
    history.push({
      id: currentVersionId,
      content: item.assembledContent,
      wordCount: wordCountFn(item.assembledContent),
      shortLabel: 'Current',
      label: `Current \u2022 ${new Date(item.assembledAt ?? item.createdAt).toLocaleString()} \u2022 temp ${currentTempLabel}`,
    });
    return history;
  }, [item.generationHistory, item.assembledContent, item.assembledAt, item.createdAt, item.generationTemperature, currentVersionId]);

  const [selectedVersionId, setSelectedVersionId] = useState(activeVersionId);
  const [compareToVersionId, setCompareToVersionId] = useState('');

  useEffect(() => {
    setSelectedVersionId(activeVersionId);
    setCompareToVersionId('');
  }, [activeVersionId, item.chronicleId]);

  const selectedVersion = useMemo(
    () => versions.find((v) => v.id === selectedVersionId) || versions[versions.length - 1],
    [versions, selectedVersionId]
  );
  const compareToVersion = useMemo(
    () => compareToVersionId ? versions.find((v) => v.id === compareToVersionId) : null,
    [versions, compareToVersionId]
  );

  const versionContentMap = useMemo(() => {
    const map = new Map();
    for (const v of versions) map.set(v.id, v.content);
    return map;
  }, [versions]);

  const versionLabelMap = useMemo(() => {
    const map = new Map();
    for (const v of versions) map.set(v.id, v.shortLabel);
    return map;
  }, [versions]);

  const getVersionLabel = (versionId) => versionLabelMap.get(versionId) || 'Unknown';
  const formatTargetIndicator = (targetVersionId) => {
    if (!targetVersionId) return null;
    if (targetVersionId === activeVersionId) return null;
    return `Targets ${getVersionLabel(targetVersionId)} \u2022 Active ${getVersionLabel(activeVersionId)}`;
  };

  const summaryIndicator = formatTargetIndicator(item.summaryTargetVersionId);
  const imageRefsIndicator = formatTargetIndicator(item.imageRefsTargetVersionId);
  const imageRefsTargetContent = versionContentMap.get(item.imageRefsTargetVersionId || activeVersionId) || item.assembledContent;

  const seedData = {
    narrativeStyleId: item.narrativeStyleId || '',
    narrativeStyleName: item.narrativeStyle?.name || styleLibrary?.narrativeStyles?.find(s => s.id === item.narrativeStyleId)?.name,
    entrypointId: item.entrypointId,
    entrypointName: item.entrypointId ? entities?.find(e => e.id === item.entrypointId)?.name : undefined,
    roleAssignments: item.roleAssignments || [],
    selectedEventIds: item.selectedEventIds || [],
    selectedRelationshipIds: item.selectedRelationshipIds || [],
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
        {onExport && (
          <button
            onClick={onExport}
            style={{ padding: '8px 16px', fontSize: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-secondary)' }}
            title="Export chronicle with full generation context as JSON"
          >
            Export
          </button>
        )}
      </div>
      <TemperatureRegenerationControl
        item={item}
        onRegenerateWithTemperature={onRegenerateWithTemperature}
        isGenerating={isGenerating}
      />
      {item.perspectiveSynthesis && (
        <PerspectiveSynthesisViewer synthesis={item.perspectiveSynthesis} />
      )}
      {item.cohesionReport && (
        <CohesionReportViewer
          report={item.cohesionReport}
          seedData={seedData}
          onAccept={onAccept}
          onRegenerate={onRegenerate}
          onCorrectSuggestions={onCorrectSuggestions}
          onGenerateSummary={onGenerateSummary}
          onGenerateImageRefs={onGenerateImageRefs}
          onRevalidate={onRevalidate}
          refinements={refinements}
          isValidationStale={Boolean(item.validationStale)}
          editVersion={item.editVersion}
          isGenerating={isGenerating}
          imageRefs={item.imageRefs}
          entityMap={entityMap}
          onGenerateChronicleImage={onGenerateChronicleImage}
          onResetChronicleImage={onResetChronicleImage}
          onUpdateChronicleAnchorText={onUpdateChronicleAnchorText}
          onUpdateChronicleImageSize={onUpdateChronicleImageSize}
          onUpdateChronicleImageJustification={onUpdateChronicleImageJustification}
          chronicleText={imageRefsTargetContent}
          summaryIndicator={summaryIndicator}
          imageRefsIndicator={imageRefsIndicator}
          styleLibrary={styleLibrary}
          cultures={cultures}
          cultureIdentities={cultureIdentities}
          worldContext={worldContext}
          chronicleTitle={item.title || item.name}
        />
      )}
      {item.assembledContent && (
        <div style={{ marginTop: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: '16px' }}>Preview</h3>
            <ChronicleVersionSelector
              versions={versions}
              selectedVersionId={selectedVersionId}
              activeVersionId={activeVersionId}
              compareToVersionId={compareToVersionId}
              onSelectVersion={(id) => {
                setSelectedVersionId(id);
                if (id === compareToVersionId) setCompareToVersionId('');
              }}
              onSelectCompareVersion={setCompareToVersionId}
              onSetActiveVersion={onUpdateChronicleActiveVersion}
              disabled={isGenerating}
            />
          </div>
          <AssembledContentViewer
            content={selectedVersion?.content || item.assembledContent}
            wordCount={selectedVersion?.wordCount ?? wordCountFn(item.assembledContent)}
            onCopy={() => copyToClipboard(selectedVersion?.content || item.assembledContent)}
            compareContent={compareToVersion?.content}
            compareLabel={compareToVersion?.shortLabel}
          />
        </div>
      )}
      <ImageModal
        isOpen={imageModal.open}
        imageId={imageModal.imageId}
        title={imageModal.title}
        onClose={() => setImageModal({ open: false, imageId: '', title: '' })}
      />
    </div>
  );
}
