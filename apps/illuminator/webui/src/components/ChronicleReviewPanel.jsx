/**
 * ChronicleReviewPanel - Shared review/refinement UI for chronicles
 *
 * assembly_ready and complete statuses delegate to ChronicleWorkspace (tabbed UI).
 * validation_ready keeps its own inline layout since it's a different workflow.
 */

import { useMemo, useState, useEffect, useCallback } from 'react';
import { diffWords } from 'diff';
import CohesionReportViewer from './CohesionReportViewer';
import ImageModal from './ImageModal';
import ChronicleWorkspace from './chronicle-workspace/ChronicleWorkspace';
import ChronicleVersionSelector from './chronicle-workspace/ChronicleVersionSelector';

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
  onRegenerateWithSampling,
  onRegenerateFull,
  onRegenerateCreative,
  onCompareVersions,
  onCombineVersions,
  onCopyEdit,
  onTemporalCheck,
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
  onDeleteVersion,
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

  // Image ref selections (version migration)
  onApplyImageRefSelections,

  // Select existing image for a ref
  onSelectExistingImage,

  // Select existing image for cover
  onSelectExistingCoverImage,

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
  events,
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
        onRegenerateWithSampling={onRegenerateWithSampling}
        onRegenerateFull={onRegenerateFull}
        onRegenerateCreative={onRegenerateCreative}
        onCompareVersions={onCompareVersions}
        onCombineVersions={onCombineVersions}
        onCopyEdit={onCopyEdit}
        onTemporalCheck={onTemporalCheck}
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
        onDeleteVersion={onDeleteVersion}
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
        onApplyImageRefSelections={onApplyImageRefSelections}
        onSelectExistingImage={onSelectExistingImage}
        onSelectExistingCoverImage={onSelectExistingCoverImage}
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
        events={events}
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
        onRegenerateWithSampling={onRegenerateWithSampling}
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
        onDeleteVersion={onDeleteVersion}
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
  onRegenerateWithSampling,
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
  onDeleteVersion,
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

  const versions = useMemo(() => {
    const sorted = [...(item.generationHistory || [])].sort((a, b) => a.generatedAt - b.generatedAt);
    const seen = new Set();
    const unique = [];
    for (const version of sorted) {
      if (seen.has(version.versionId)) continue;
      seen.add(version.versionId);
      unique.push(version);
    }
    return unique.map((version, index) => {
      const samplingLabel = version.sampling ?? 'unspecified';
      return {
        id: version.versionId,
        content: version.content,
        wordCount: version.wordCount,
        shortLabel: `V${index + 1}`,
        label: `Version ${index + 1} \u2022 ${new Date(version.generatedAt).toLocaleString()} \u2022 sampling ${samplingLabel}`,
      };
    });
  }, [item.generationHistory]);

  const activeVersionId = item.activeVersionId || versions[versions.length - 1]?.id;

  const [selectedVersionId, setSelectedVersionId] = useState(activeVersionId);
  const [compareToVersionId, setCompareToVersionId] = useState('');

  useEffect(() => {
    setSelectedVersionId(activeVersionId);
    setCompareToVersionId('');
  }, [activeVersionId, item.chronicleId]);

  useEffect(() => {
    if (versions.length === 0) return;

    const hasSelected = versions.some((v) => v.id === selectedVersionId);
    let nextSelected = selectedVersionId;
    if (!hasSelected) {
      const hasActive = versions.some((v) => v.id === activeVersionId);
      nextSelected = hasActive ? activeVersionId : versions[versions.length - 1].id;
      setSelectedVersionId(nextSelected);
    }

    if (compareToVersionId) {
      const hasCompare = versions.some((v) => v.id === compareToVersionId);
      if (!hasCompare || compareToVersionId === nextSelected) {
        setCompareToVersionId('');
      }
    }
  }, [versions, selectedVersionId, compareToVersionId, activeVersionId]);

  const selectedVersion = useMemo(
    () => versions.find((v) => v.id === selectedVersionId) || versions[versions.length - 1],
    [versions, selectedVersionId]
  );
  const compareToVersion = useMemo(
    () => compareToVersionId ? versions.find((v) => v.id === compareToVersionId) : null,
    [versions, compareToVersionId]
  );

  const handleDeleteVersion = useCallback((versionId) => {
    if (!versionId || versions.length === 0) return;

    const index = versions.findIndex((v) => v.id === versionId);
    let nextSelected = selectedVersionId;
    if (index !== -1) {
      nextSelected = versions[index + 1]?.id || versions[index - 1]?.id || selectedVersionId;
    }
    if (nextSelected === versionId) {
      const hasActive = versions.some((v) => v.id === activeVersionId);
      nextSelected = hasActive ? activeVersionId : versions[versions.length - 1].id;
    }

    if (nextSelected && nextSelected !== selectedVersionId) {
      setSelectedVersionId(nextSelected);
    }
    if (compareToVersionId === versionId || compareToVersionId === nextSelected) {
      setCompareToVersionId('');
    }

    onDeleteVersion?.(versionId);
  }, [versions, selectedVersionId, activeVersionId, compareToVersionId, onDeleteVersion]);

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
              onDeleteVersion={handleDeleteVersion}
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
