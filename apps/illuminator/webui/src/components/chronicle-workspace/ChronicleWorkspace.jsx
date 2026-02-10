import { useMemo, useState, useCallback, useEffect } from 'react';
import ImageModal from '../ImageModal';
import WorkspaceHeader from './WorkspaceHeader';
import WorkspaceTabBar from './WorkspaceTabBar';
import PipelineTab from './PipelineTab';
import VersionsTab from './VersionsTab';
import ImagesTab from './ImagesTab';
import ReferenceTab from './ReferenceTab';
import ContentTab from './ContentTab';
import HistorianTab from './HistorianTab';
import EnrichmentTab from './EnrichmentTab';

const wordCount = (content) => content?.split(/\s+/).filter(Boolean).length || 0;

export default function ChronicleWorkspace({
  item,

  // Actions
  onAccept,
  onRegenerate,
  onRegenerateWithSampling,
  onRegenerateFull,
  onRegenerateCreative,
  onCompareVersions,
  onCombineVersions,
  onCopyEdit,
  onTemporalCheck,
  onValidate,
  onGenerateSummary,
  onGenerateTitle,
  onAcceptPendingTitle,
  onRejectPendingTitle,
  onGenerateImageRefs,
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

  // Data
  entities,
  styleLibrary,
  cultures,
  cultureIdentities,
  worldContext,
  eras,
  events,
}) {
  const isComplete = item.status === 'complete';

  // ---------------------------------------------------------------------------
  // Entity map
  // ---------------------------------------------------------------------------
  const entityMap = useMemo(() => {
    if (!entities) return new Map();
    return new Map(entities.map((e) => [e.id, e]));
  }, [entities]);

  // ---------------------------------------------------------------------------
  // Version state & memos
  // ---------------------------------------------------------------------------
  const versions = useMemo(() => {
    const stepLabel = (step) => {
      if (!step) return null;
      const labels = { generate: 'initial', regenerate: 'regenerate', creative: 'creative', combine: 'combine', copy_edit: 'copy-edit' };
      return labels[step] || step;
    };

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
        const step = stepLabel(version.step);
        return {
          id: version.versionId,
          content: version.content,
          wordCount: version.wordCount,
          shortLabel: `V${index + 1}`,
          label: `Version ${index + 1} \u2022 ${new Date(version.generatedAt).toLocaleString()} \u2022 ${step ? step : `sampling ${samplingLabel}`}`,
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

  const versionLabelMap = useMemo(() => {
    const map = new Map();
    for (const v of versions) map.set(v.id, v.shortLabel);
    return map;
  }, [versions]);

  const versionContentMap = useMemo(() => {
    const map = new Map();
    for (const v of versions) map.set(v.id, v.content);
    return map;
  }, [versions]);

  const getVersionLabel = (versionId) => versionLabelMap.get(versionId) || 'Unknown';

  const formatTargetIndicator = (targetVersionId) => {
    if (!targetVersionId) return null;
    const targetLabel = getVersionLabel(targetVersionId);
    const activeLabel = getVersionLabel(activeVersionId);
    if (targetVersionId === activeVersionId) return null;
    return `Targets ${targetLabel} \u2022 Active ${activeLabel}`;
  };

  const summaryIndicator = formatTargetIndicator(item.summaryTargetVersionId);
  const imageRefsIndicator = formatTargetIndicator(item.imageRefsTargetVersionId);
  const imageRefsTargetContent = versionContentMap.get(item.imageRefsTargetVersionId || activeVersionId) || item.assembledContent;

  const compareRunning = refinements?.compare?.running || false;
  const combineRunning = refinements?.combine?.running || false;
  const copyEditRunning = refinements?.copyEdit?.running || false;
  const temporalCheckRunning = refinements?.temporalCheck?.running || false;

  // ---------------------------------------------------------------------------
  // Seed data
  // ---------------------------------------------------------------------------
  const seedData = useMemo(() => ({
    narrativeStyleId: item.narrativeStyleId || '',
    narrativeStyleName: item.narrativeStyle?.name || styleLibrary?.narrativeStyles?.find(s => s.id === item.narrativeStyleId)?.name,
    entrypointId: item.entrypointId,
    entrypointName: item.entrypointId
      ? entities?.find(e => e.id === item.entrypointId)?.name
      : undefined,
    roleAssignments: item.roleAssignments || [],
    selectedEventIds: item.selectedEventIds || [],
    selectedRelationshipIds: item.selectedRelationshipIds || [],
  }), [item.narrativeStyleId, item.narrativeStyle?.name, item.entrypointId, item.roleAssignments, item.selectedEventIds, item.selectedRelationshipIds, entities, styleLibrary?.narrativeStyles]);

  // ---------------------------------------------------------------------------
  // Title modal
  // ---------------------------------------------------------------------------
  const [showTitleAcceptModal, setShowTitleAcceptModal] = useState(false);
  const [customTitle, setCustomTitle] = useState('');

  useEffect(() => {
    if (showTitleAcceptModal) {
      setCustomTitle('');
    }
  }, [showTitleAcceptModal, item?.pendingTitle]);

  const handleGenerateTitleWithModal = useCallback(() => {
    if (!onGenerateTitle) return;
    setShowTitleAcceptModal(true);
    onGenerateTitle();
  }, [onGenerateTitle]);

  const handleAcceptTitle = useCallback(async (chosenTitle) => {
    const normalized = typeof chosenTitle === 'string' ? chosenTitle.trim() : undefined;
    if (onAcceptPendingTitle) await onAcceptPendingTitle(normalized || undefined);
    setShowTitleAcceptModal(false);
  }, [onAcceptPendingTitle]);

  const handleRejectTitle = useCallback(async () => {
    if (onRejectPendingTitle) await onRejectPendingTitle();
    setShowTitleAcceptModal(false);
  }, [onRejectPendingTitle]);

  // ---------------------------------------------------------------------------
  // Image modal
  // ---------------------------------------------------------------------------
  const [imageModal, setImageModal] = useState({ open: false, imageId: '', title: '' });
  const handleImageClick = useCallback((imageId, title) => {
    setImageModal({ open: true, imageId, title });
  }, []);

  // ---------------------------------------------------------------------------
  // Tab state
  // ---------------------------------------------------------------------------
  const defaultTab = isComplete ? 'historian' : 'pipeline';
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    setActiveTab(isComplete ? 'historian' : 'pipeline');
  }, [item.chronicleId, isComplete]);

  const tabs = useMemo(() => {
    if (isComplete) {
      return [
        { id: 'historian', label: 'Historian' },
        { id: 'enrichment', label: 'Enrichment' },
        { id: 'images', label: 'Images' },
        { id: 'reference', label: 'Reference' },
        { id: 'content', label: 'Content', align: 'right' },
      ];
    }
    const t = [
      { id: 'pipeline', label: 'Pipeline' },
      { id: 'versions', label: 'Versions', indicator: versions.length > 1 ? `(${versions.length})` : undefined },
      { id: 'images', label: 'Images' },
      { id: 'reference', label: 'Reference' },
      { id: 'content', label: 'Content', align: 'right' },
    ];
    return t;
  }, [isComplete, versions.length]);

  // If active tab no longer exists (e.g., versions tab disappeared), reset
  useEffect(() => {
    if (!tabs.find(t => t.id === activeTab)) {
      setActiveTab(tabs[0].id);
    }
  }, [tabs, activeTab]);

  // ---------------------------------------------------------------------------
  // Current word count for header
  // ---------------------------------------------------------------------------
  const currentWordCount = isComplete
    ? wordCount(item.finalContent)
    : (selectedVersion?.wordCount ?? wordCount(item.assembledContent));

  // ---------------------------------------------------------------------------
  // Chronicle text for image refs
  // ---------------------------------------------------------------------------
  const chronicleText = isComplete
    ? (item.finalContent || imageRefsTargetContent || item.assembledContent)
    : (imageRefsTargetContent || item.assembledContent);

  // ---------------------------------------------------------------------------
  // Version selection handlers
  // ---------------------------------------------------------------------------
  const handleSelectVersion = useCallback((id) => {
    setSelectedVersionId(id);
    if (id === compareToVersionId) setCompareToVersionId('');
  }, [compareToVersionId]);

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

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="chronicle-workspace">
      <WorkspaceHeader
        item={item}
        wordCount={currentWordCount}
        isGenerating={isGenerating}
        isComplete={isComplete}
        onAccept={onAccept}
        onRegenerate={onRegenerate}
        onExport={onExport}
        onUnpublish={onUnpublish}
      />

      <WorkspaceTabBar
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <div className="workspace-tab-content">
        {activeTab === 'pipeline' && (
          <PipelineTab
            item={item}
            isGenerating={isGenerating}
            refinements={refinements}
            onValidate={onValidate}
            onGenerateSummary={onGenerateSummary}
            onGenerateTitle={handleGenerateTitleWithModal}
            onGenerateImageRefs={onGenerateImageRefs}
            onGenerateCoverImageScene={onGenerateCoverImageScene}
            onGenerateCoverImage={onGenerateCoverImage}
            onImageClick={handleImageClick}
            onRegenerateWithSampling={onRegenerateWithSampling}
            entityMap={entityMap}
            styleLibrary={styleLibrary}
            styleSelection={styleSelection}
            cultures={cultures}
            cultureIdentities={cultureIdentities}
            worldContext={worldContext}
            summaryIndicator={summaryIndicator}
            imageRefsIndicator={imageRefsIndicator}
            imageRefsTargetContent={imageRefsTargetContent}
            imageSize={imageSize}
            imageQuality={imageQuality}
            imageModel={imageModel}
            imageGenSettings={imageGenSettings}
            onOpenImageSettings={onOpenImageSettings}
            onGenerateChronicleImage={onGenerateChronicleImage}
            onResetChronicleImage={onResetChronicleImage}
            onRegenerateDescription={onRegenerateDescription}
            onUpdateChronicleAnchorText={onUpdateChronicleAnchorText}
            onUpdateChronicleImageSize={onUpdateChronicleImageSize}
            onUpdateChronicleImageJustification={onUpdateChronicleImageJustification}
          />
        )}

        {activeTab === 'versions' && (
          <VersionsTab
            item={item}
            versions={versions}
            selectedVersionId={selectedVersionId}
            compareToVersionId={compareToVersionId}
            activeVersionId={activeVersionId}
            isGenerating={isGenerating}
            onSelectVersion={handleSelectVersion}
            onSelectCompareVersion={setCompareToVersionId}
            onSetActiveVersion={isComplete ? undefined : onUpdateChronicleActiveVersion}
            onDeleteVersion={isComplete ? undefined : handleDeleteVersion}
            onCompareVersions={onCompareVersions}
            onCombineVersions={onCombineVersions}
            onRegenerateFull={onRegenerateFull}
            onRegenerateCreative={onRegenerateCreative}
            onRegenerateWithSampling={onRegenerateWithSampling}
            onUpdateCombineInstructions={onUpdateCombineInstructions}
            onCopyEdit={onCopyEdit}
            compareRunning={compareRunning}
            combineRunning={combineRunning}
            copyEditRunning={copyEditRunning}
          />
        )}

        {activeTab === 'images' && (
          <ImagesTab
            item={item}
            isGenerating={isGenerating}
            entityMap={entityMap}
            onGenerateCoverImageScene={onGenerateCoverImageScene}
            onGenerateCoverImage={onGenerateCoverImage}
            onImageClick={handleImageClick}
            onGenerateChronicleImage={onGenerateChronicleImage}
            onResetChronicleImage={onResetChronicleImage}
            onRegenerateDescription={onRegenerateDescription}
            onUpdateChronicleAnchorText={onUpdateChronicleAnchorText}
            onUpdateChronicleImageSize={onUpdateChronicleImageSize}
            onUpdateChronicleImageJustification={onUpdateChronicleImageJustification}
            styleLibrary={styleLibrary}
            styleSelection={styleSelection}
            cultures={cultures}
            cultureIdentities={cultureIdentities}
            worldContext={worldContext}
            imageSize={imageSize}
            imageQuality={imageQuality}
            imageModel={imageModel}
            imageGenSettings={imageGenSettings}
            onOpenImageSettings={onOpenImageSettings}
            chronicleText={chronicleText}
            versions={versions}
            activeVersionId={activeVersionId}
            onApplyImageRefSelections={onApplyImageRefSelections}
            onSelectExistingImage={onSelectExistingImage}
            onSelectExistingCoverImage={onSelectExistingCoverImage}
          />
        )}

        {activeTab === 'reference' && (
          <ReferenceTab
            item={item}
            eras={eras}
            events={events}
            entities={entities}
            isGenerating={isGenerating}
            onUpdateTemporalContext={onUpdateChronicleTemporalContext}
            onTemporalCheck={onTemporalCheck}
            temporalCheckRunning={temporalCheckRunning}
            seedData={seedData}
          />
        )}

        {activeTab === 'content' && (
          <ContentTab
            item={item}
            isComplete={isComplete}
            versions={versions}
            selectedVersion={selectedVersion}
            compareToVersion={compareToVersion}
            selectedVersionId={selectedVersionId}
            compareToVersionId={compareToVersionId}
            activeVersionId={activeVersionId}
            onSelectVersion={handleSelectVersion}
            onSelectCompareVersion={setCompareToVersionId}
            onSetActiveVersion={isComplete ? undefined : onUpdateChronicleActiveVersion}
            onDeleteVersion={isComplete ? undefined : handleDeleteVersion}
            isGenerating={isGenerating}
          />
        )}

        {activeTab === 'historian' && (
          <HistorianTab
            item={item}
            isGenerating={isGenerating}
            isHistorianActive={isHistorianActive}
            onHistorianReview={onHistorianReview}
            onUpdateHistorianNote={onUpdateHistorianNote}
            onBackportLore={onBackportLore}
          />
        )}

        {activeTab === 'enrichment' && (
          <EnrichmentTab
            item={item}
            isGenerating={isGenerating}
            refinements={refinements}
            onGenerateTitle={handleGenerateTitleWithModal}
            onGenerateSummary={onGenerateSummary}
          />
        )}
      </div>

      {/* Modals */}
      <ImageModal
        isOpen={imageModal.open}
        imageId={imageModal.imageId}
        title={imageModal.title}
        onClose={() => setImageModal({ open: false, imageId: '', title: '' })}
      />

      {showTitleAcceptModal && (() => {
        const hasPending = !!item?.pendingTitle;
        return (
          <div
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0, 0, 0, 0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}
            onClick={() => { if (hasPending) handleRejectTitle(); }}
          >
            <div
              style={{
                background: 'var(--bg-primary)',
                borderRadius: '12px',
                padding: '24px',
                maxWidth: '480px',
                width: '90%',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {!hasPending ? (
                <>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>
                    Generating Title...
                  </h3>
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>Current</div>
                    <div style={{ fontSize: '15px', fontWeight: 500 }}>{item.title}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '13px' }}>
                    <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid var(--text-muted)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    Generating title candidates...
                  </div>
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </>
              ) : (
                <>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>
                    Choose Title
                  </h3>
                  {item.pendingTitleFragments?.length > 0 && (
                    <div style={{ marginBottom: '14px', padding: '10px 12px', background: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Extracted Fragments
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6, fontStyle: 'italic' }}>
                        {item.pendingTitleFragments.map((f, i) => (
                          <span key={i}>
                            {f}{i < item.pendingTitleFragments.length - 1 ? <span style={{ color: 'var(--text-muted)', margin: '0 6px' }}>&middot;</span> : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                    <button
                      onClick={() => handleAcceptTitle(item.pendingTitle)}
                      style={{
                        display: 'flex', alignItems: 'baseline', gap: '8px',
                        padding: '10px 12px', fontSize: '14px', fontWeight: 600,
                        background: 'var(--bg-secondary)', border: '2px solid #2563eb',
                        borderRadius: '8px', cursor: 'pointer', color: 'var(--text-primary)',
                        textAlign: 'left', width: '100%',
                      }}
                    >
                      <span style={{ color: '#2563eb', fontSize: '12px', flexShrink: 0 }}>&#x2726;</span>
                      {item.pendingTitle}
                    </button>
                    {item.pendingTitleCandidates?.filter(c => c !== item.pendingTitle).map((candidate, i) => (
                      <button
                        key={i}
                        onClick={() => handleAcceptTitle(candidate)}
                        style={{
                          display: 'flex', alignItems: 'baseline', gap: '8px',
                          padding: '8px 12px', fontSize: '13px',
                          background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                          borderRadius: '6px', cursor: 'pointer', color: 'var(--text-secondary)',
                          textAlign: 'left', width: '100%',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--text-muted)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                      >
                        <span style={{ opacity: 0.4, fontSize: '11px', flexShrink: 0 }}>&#x25C7;</span>
                        {candidate}
                      </button>
                    ))}
                  </div>
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginBottom: '16px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Custom title</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        className="illuminator-input"
                        value={customTitle}
                        onChange={(e) => setCustomTitle(e.target.value)}
                        placeholder="Enter a custom title..."
                        style={{ flex: 1, fontSize: '13px', padding: '8px 10px' }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const trimmed = e.currentTarget.value.trim();
                            if (trimmed) handleAcceptTitle(trimmed);
                          }
                        }}
                      />
                      <button
                        onClick={() => {
                          const trimmed = customTitle.trim();
                          if (trimmed) handleAcceptTitle(trimmed);
                        }}
                        disabled={!customTitle.trim()}
                        style={{
                          padding: '8px 12px',
                          fontSize: '12px',
                          background: customTitle.trim() ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '6px',
                          cursor: customTitle.trim() ? 'pointer' : 'not-allowed',
                          color: customTitle.trim() ? 'white' : 'var(--text-muted)',
                        }}
                      >
                        Use
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={handleRejectTitle}
                      style={{
                        padding: '8px 16px', fontSize: '13px',
                        background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
                        borderRadius: '6px', cursor: 'pointer', color: 'var(--text-secondary)',
                      }}
                    >
                      Keep Current
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
