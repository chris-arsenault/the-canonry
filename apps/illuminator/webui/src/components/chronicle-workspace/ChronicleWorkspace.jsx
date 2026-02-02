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
  onRegenerateWithTemperature,
  onCompareVersions,
  onCombineVersions,
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

  // Data
  entities,
  styleLibrary,
  cultures,
  cultureIdentities,
  worldContext,
  eras,
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

    const currentTempLabel = typeof item.generationTemperature === 'number'
      ? item.generationTemperature.toFixed(2)
      : 'default';

    history.push({
      id: currentVersionId,
      content: item.assembledContent,
      wordCount: wordCount(item.assembledContent),
      shortLabel: 'Current',
      label: `Current \u2022 ${new Date(item.assembledAt ?? item.createdAt).toLocaleString()} \u2022 temp ${currentTempLabel}`,
    });

    return history;
  }, [
    item.generationHistory,
    item.assembledContent,
    item.assembledAt,
    item.createdAt,
    item.generationTemperature,
    currentVersionId,
  ]);

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

  const hasMultipleVersions = versions.length >= 2;
  const compareRunning = refinements?.compare?.running || false;
  const combineRunning = refinements?.combine?.running || false;

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

  const handleGenerateTitleWithModal = useCallback(() => {
    if (!onGenerateTitle) return;
    setShowTitleAcceptModal(true);
    onGenerateTitle();
  }, [onGenerateTitle]);

  const handleAcceptTitle = useCallback(async (chosenTitle) => {
    if (onAcceptPendingTitle) await onAcceptPendingTitle(chosenTitle);
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
    ];
    if (hasMultipleVersions) {
      t.push({ id: 'versions', label: 'Versions', indicator: `(${versions.length})` });
    }
    t.push(
      { id: 'images', label: 'Images' },
      { id: 'reference', label: 'Reference' },
      { id: 'content', label: 'Content', align: 'right' },
    );
    return t;
  }, [isComplete, hasMultipleVersions, versions.length]);

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
            onRegenerateWithTemperature={onRegenerateWithTemperature}
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
            onSetActiveVersion={onUpdateChronicleActiveVersion}
            onCompareVersions={onCompareVersions}
            onCombineVersions={onCombineVersions}
            onUpdateCombineInstructions={onUpdateCombineInstructions}
            compareRunning={compareRunning}
            combineRunning={combineRunning}
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
          />
        )}

        {activeTab === 'reference' && (
          <ReferenceTab
            item={item}
            eras={eras}
            isGenerating={isGenerating}
            onUpdateTemporalContext={onUpdateChronicleTemporalContext}
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
            onSetActiveVersion={onUpdateChronicleActiveVersion}
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
                    Two-pass title synthesis in progress...
                  </div>
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </>
              ) : (
                <>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>
                    Choose Title
                  </h3>
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
