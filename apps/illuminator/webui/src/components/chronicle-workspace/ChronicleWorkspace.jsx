/**
 * PROP CHAIN: ChroniclePanel → ChronicleReviewPanel → ChronicleWorkspace (this file)
 * Props originate in ChroniclePanel and pass through ChronicleReviewPanel.
 * When adding props, update all three files.
 */
import { useMemo, useState, useCallback, useEffect } from "react";
import ImageModal from "../ImageModal";
import QuickCheckModal from "../QuickCheckModal";
import WorkspaceHeader from "./WorkspaceHeader";
import WorkspaceTabBar from "./WorkspaceTabBar";
import PipelineTab from "./PipelineTab";
import VersionsTab from "./VersionsTab";
import ImagesTab from "./ImagesTab";
import ReferenceTab from "./ReferenceTab";
import ContentTab from "./ContentTab";
import HistorianTab from "./HistorianTab";
import EnrichmentTab from "./EnrichmentTab";
import { findEntityMentions } from "../../lib/wikiLinkService";
import { useChronicleStore } from "../../lib/db/chronicleStore";
import { getEntitiesForRun, createEntity } from "../../lib/db/entityRepository";
import CreateEntityModal from "../CreateEntityModal";
import "./ChronicleWorkspace.css";

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
  onQuickCheck,
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
  onSetAssignedTone,
  onDetectTone,
  isHistorianActive,
  onUpdateHistorianNote,
  onGeneratePrep,

  // State
  isGenerating,
  refinements,

  // Data
  simulationRunId,
  worldSchema,
  entities,
  styleLibrary,
  cultures,
  cultureIdentities,
  worldContext,
  eras,
  events,
  onNavigateToTab,
}) {
  const isComplete = item.status === "complete";

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
      const labels = {
        generate: "initial",
        regenerate: "regenerate",
        creative: "creative",
        combine: "combine",
        copy_edit: "copy-edit",
      };
      return labels[step] || step;
    };

    const sorted = [...(item.generationHistory || [])].sort(
      (a, b) => a.generatedAt - b.generatedAt
    );
    const seen = new Set();
    const unique = [];
    for (const version of sorted) {
      if (seen.has(version.versionId)) continue;
      seen.add(version.versionId);
      unique.push(version);
    }
    return unique.map((version, index) => {
      const samplingLabel = version.sampling ?? "unspecified";
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
  const [compareToVersionId, setCompareToVersionId] = useState("");

  useEffect(() => {
    setSelectedVersionId(activeVersionId);
    setCompareToVersionId("");
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
        setCompareToVersionId("");
      }
    }
  }, [versions, selectedVersionId, compareToVersionId, activeVersionId]);

  const selectedVersion = useMemo(
    () => versions.find((v) => v.id === selectedVersionId) || versions[versions.length - 1],
    [versions, selectedVersionId]
  );

  const compareToVersion = useMemo(
    () => (compareToVersionId ? versions.find((v) => v.id === compareToVersionId) : null),
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

  const getVersionLabel = (versionId) => versionLabelMap.get(versionId) || "Unknown";

  const formatTargetIndicator = (targetVersionId) => {
    if (!targetVersionId) return null;
    const targetLabel = getVersionLabel(targetVersionId);
    const activeLabel = getVersionLabel(activeVersionId);
    if (targetVersionId === activeVersionId) return null;
    return `Targets ${targetLabel} \u2022 Active ${activeLabel}`;
  };

  const summaryIndicator = formatTargetIndicator(item.summaryTargetVersionId);
  const imageRefsIndicator = formatTargetIndicator(item.imageRefsTargetVersionId);
  const imageRefsTargetContent =
    versionContentMap.get(item.imageRefsTargetVersionId || activeVersionId) ||
    item.assembledContent;

  const compareRunning = refinements?.compare?.running || false;
  const combineRunning = refinements?.combine?.running || false;
  const copyEditRunning = refinements?.copyEdit?.running || false;
  const temporalCheckRunning = refinements?.temporalCheck?.running || false;
  const quickCheckRunning = refinements?.quickCheck?.running || false;

  // ---------------------------------------------------------------------------
  // Tertiary cast — manual detect + persisted on ChronicleRecord
  // ---------------------------------------------------------------------------
  const detectTertiaryCast = useCallback(async () => {
    if (!simulationRunId) return;
    const content = isComplete
      ? item.finalContent
      : selectedVersion?.content || item.assembledContent;
    if (!content) return;

    // Read fresh entities from Dexie so newly added/edited entities are included
    const freshEntities = await getEntitiesForRun(simulationRunId);
    const freshEntityMap = new Map(freshEntities.map((e) => [e.id, e]));

    // Build name/alias dictionary for Aho-Corasick (exclude eras — too generic)
    const wikiEntities = [];
    for (const entity of freshEntities) {
      if (entity.kind === "era") continue;
      wikiEntities.push({ id: entity.id, name: entity.name });
      const aliases = entity.enrichment?.text?.aliases;
      if (Array.isArray(aliases)) {
        for (const alias of aliases) {
          if (typeof alias === "string" && alias.length >= 3) {
            wikiEntities.push({ id: entity.id, name: alias });
          }
        }
      }
    }

    const mentions = findEntityMentions(content, wikiEntities);

    const declaredIds = new Set(item.selectedEntityIds || []);

    // Preserve existing accepted/rejected decisions for entities still detected
    const prevDecisions = new Map((item.tertiaryCast || []).map((e) => [e.entityId, e.accepted]));

    const seen = new Set();
    const entries = [];
    for (const m of mentions) {
      if (declaredIds.has(m.entityId) || seen.has(m.entityId)) continue;
      seen.add(m.entityId);
      const entity = freshEntityMap.get(m.entityId);
      if (entity) {
        entries.push({
          entityId: entity.id,
          name: entity.name,
          kind: entity.kind,
          matchedAs: content.slice(m.start, m.end),
          matchStart: m.start,
          matchEnd: m.end,
          accepted: prevDecisions.get(entity.id) ?? true,
        });
      }
    }

    const { updateChronicleTertiaryCast } = await import("../../lib/db/chronicleRepository");
    await updateChronicleTertiaryCast(item.chronicleId, entries);
    await useChronicleStore.getState().refreshChronicle(item.chronicleId);
  }, [
    simulationRunId,
    isComplete,
    item.finalContent,
    item.assembledContent,
    item.selectedEntityIds,
    item.chronicleId,
    item.tertiaryCast,
    selectedVersion,
  ]);

  const toggleTertiaryCast = useCallback(
    async (entityId) => {
      const current = item.tertiaryCast || [];
      const updated = current.map((e) =>
        e.entityId === entityId ? { ...e, accepted: !e.accepted } : e
      );
      const { updateChronicleTertiaryCast } = await import("../../lib/db/chronicleRepository");
      await updateChronicleTertiaryCast(item.chronicleId, updated);
      await useChronicleStore.getState().refreshChronicle(item.chronicleId);
    },
    [item.chronicleId, item.tertiaryCast]
  );

  // ---------------------------------------------------------------------------
  // Seed data
  // ---------------------------------------------------------------------------
  const seedData = useMemo(
    () => ({
      narrativeStyleId: item.narrativeStyleId || "",
      narrativeStyleName:
        item.narrativeStyle?.name ||
        styleLibrary?.narrativeStyles?.find((s) => s.id === item.narrativeStyleId)?.name,
      entrypointId: item.entrypointId,
      entrypointName: item.entrypointId
        ? entities?.find((e) => e.id === item.entrypointId)?.name
        : undefined,
      narrativeDirection: item.narrativeDirection,
      roleAssignments: item.roleAssignments || [],
      selectedEventIds: item.selectedEventIds || [],
      selectedRelationshipIds: item.selectedRelationshipIds || [],
    }),
    [
      item.narrativeStyleId,
      item.narrativeStyle?.name,
      item.entrypointId,
      item.narrativeDirection,
      item.roleAssignments,
      item.selectedEventIds,
      item.selectedRelationshipIds,
      entities,
      styleLibrary?.narrativeStyles,
    ]
  );

  // ---------------------------------------------------------------------------
  // Title modal
  // ---------------------------------------------------------------------------
  const [showTitleAcceptModal, setShowTitleAcceptModal] = useState(false);
  const [customTitle, setCustomTitle] = useState("");

  useEffect(() => {
    if (showTitleAcceptModal) {
      setCustomTitle("");
    }
  }, [showTitleAcceptModal, item?.pendingTitle]);

  const handleGenerateTitleWithModal = useCallback(() => {
    if (!onGenerateTitle) return;
    setShowTitleAcceptModal(true);
    onGenerateTitle();
  }, [onGenerateTitle]);

  const handleAcceptTitle = useCallback(
    async (chosenTitle) => {
      const normalized = typeof chosenTitle === "string" ? chosenTitle.trim() : undefined;
      if (onAcceptPendingTitle) await onAcceptPendingTitle(normalized || undefined);
      setShowTitleAcceptModal(false);
    },
    [onAcceptPendingTitle]
  );

  const handleRejectTitle = useCallback(async () => {
    if (onRejectPendingTitle) await onRejectPendingTitle();
    setShowTitleAcceptModal(false);
  }, [onRejectPendingTitle]);

  // ---------------------------------------------------------------------------
  // Image modal
  // ---------------------------------------------------------------------------
  const [showQuickCheckModal, setShowQuickCheckModal] = useState(false);
  const [createEntityDefaults, setCreateEntityDefaults] = useState(null);
  const [imageModal, setImageModal] = useState({ open: false, imageId: "", title: "" });
  const handleImageClick = useCallback((imageId, title) => {
    setImageModal({ open: true, imageId, title });
  }, []);

  // Quick Check → Create Entity flow
  const openCreateFromQuickCheck = useCallback(
    (phrase) => {
      setCreateEntityDefaults({
        name: phrase,
        kind: "npc",
        subtype: "merchant",
        eraId: item.temporalContext?.focalEra?.id,
        startTick: item.temporalContext?.chronicleTickRange?.[0],
        endTick: item.temporalContext?.chronicleTickRange?.[1],
      });
    },
    [item.temporalContext]
  );

  const handleCreateEntityFromQuickCheck = useCallback(
    async (entityData) => {
      if (!simulationRunId) return;
      await createEntity(simulationRunId, entityData);
      setCreateEntityDefaults(null);
    },
    [simulationRunId]
  );

  // ---------------------------------------------------------------------------
  // Tab state
  // ---------------------------------------------------------------------------
  const defaultTab = isComplete ? "historian" : "pipeline";
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    setActiveTab(isComplete ? "historian" : "pipeline");
  }, [item.chronicleId, isComplete]);

  const tabs = useMemo(() => {
    if (isComplete) {
      return [
        { id: "historian", label: "Historian" },
        { id: "enrichment", label: "Enrichment" },
        { id: "images", label: "Images" },
        { id: "reference", label: "Reference" },
        { id: "content", label: "Content", align: "right" },
      ];
    }
    const t = [
      { id: "pipeline", label: "Pipeline" },
      {
        id: "versions",
        label: "Versions",
        indicator: versions.length > 1 ? `(${versions.length})` : undefined,
      },
      { id: "images", label: "Images" },
      { id: "reference", label: "Reference" },
      { id: "content", label: "Content", align: "right" },
    ];
    return t;
  }, [isComplete, versions.length]);

  // If active tab no longer exists (e.g., versions tab disappeared), reset
  useEffect(() => {
    if (!tabs.find((t) => t.id === activeTab)) {
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
    ? item.finalContent || imageRefsTargetContent || item.assembledContent
    : imageRefsTargetContent || item.assembledContent;

  // ---------------------------------------------------------------------------
  // Version selection handlers
  // ---------------------------------------------------------------------------
  const handleSelectVersion = useCallback(
    (id) => {
      setSelectedVersionId(id);
      if (id === compareToVersionId) setCompareToVersionId("");
    },
    [compareToVersionId]
  );

  const handleDeleteVersion = useCallback(
    (versionId) => {
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
        setCompareToVersionId("");
      }

      onDeleteVersion?.(versionId);
    },
    [versions, selectedVersionId, activeVersionId, compareToVersionId, onDeleteVersion]
  );

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

      <WorkspaceTabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="workspace-tab-content">
        {activeTab === "pipeline" && (
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

        {activeTab === "versions" && (
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

        {activeTab === "images" && (
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

        {activeTab === "reference" && (
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

        {activeTab === "content" && (
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
            onQuickCheck={onQuickCheck}
            quickCheckRunning={quickCheckRunning}
            onShowQuickCheck={() => setShowQuickCheckModal(true)}
            onFindReplace={
              isComplete && onNavigateToTab ? () => onNavigateToTab("finaledit") : undefined
            }
            onDetectTertiaryCast={detectTertiaryCast}
            onToggleTertiaryCast={toggleTertiaryCast}
          />
        )}

        {activeTab === "historian" && (
          <HistorianTab
            item={item}
            isGenerating={isGenerating}
            isHistorianActive={isHistorianActive}
            onHistorianReview={onHistorianReview}
            onSetAssignedTone={onSetAssignedTone}
            onDetectTone={onDetectTone}
            onUpdateHistorianNote={onUpdateHistorianNote}
            onBackportLore={onBackportLore}
            onGeneratePrep={onGeneratePrep}
          />
        )}

        {activeTab === "enrichment" && (
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
        onClose={() => setImageModal({ open: false, imageId: "", title: "" })}
      />

      {showQuickCheckModal && item.quickCheckReport && (
        <QuickCheckModal
          report={item.quickCheckReport}
          entities={entities}
          onCreateEntity={worldSchema ? openCreateFromQuickCheck : undefined}
          onClose={() => setShowQuickCheckModal(false)}
        />
      )}

      {createEntityDefaults && worldSchema && (
        <CreateEntityModal
          worldSchema={worldSchema}
          eras={eras}
          defaults={createEntityDefaults}
          onSubmit={handleCreateEntityFromQuickCheck}
          onClose={() => setCreateEntityDefaults(null)}
        />
      )}

      {showTitleAcceptModal &&
        (() => {
          const hasPending = !!item?.pendingTitle;
          return (
            <div
              className="cw-title-overlay"
              onClick={() => {
                if (hasPending) handleRejectTitle();
              }}
            >
              <div
                className="cw-title-dialog"
                onClick={(e) => e.stopPropagation()}
              >
                {!hasPending ? (
                  <>
                    <h3 className="cw-title-heading">Generating Title...</h3>
                    <div className="cw-generating-current">
                      <div className="cw-generating-current-label">
                        Current
                      </div>
                      <div className="cw-generating-current-value">{item.title}</div>
                    </div>
                    <div className="cw-generating-spinner-row">
                      <span className="cw-spinner" />
                      Generating title candidates...
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="cw-title-heading">Choose Title</h3>
                    {item.pendingTitleFragments?.length > 0 && (
                      <div className="cw-fragments-box">
                        <div className="cw-fragments-label">
                          Extracted Fragments
                        </div>
                        <div className="cw-fragments-list">
                          {item.pendingTitleFragments.map((f, i) => (
                            <span key={i}>
                              {f}
                              {i < item.pendingTitleFragments.length - 1 ? (
                                <span className="cw-fragment-separator">
                                  &middot;
                                </span>
                              ) : (
                                ""
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="cw-candidates-list">
                      <button
                        onClick={() => handleAcceptTitle(item.pendingTitle)}
                        className="cw-candidate-primary"
                      >
                        <span className="cw-candidate-primary-icon">
                          &#x2726;
                        </span>
                        {item.pendingTitle}
                      </button>
                      {item.pendingTitleCandidates
                        ?.filter((c) => c !== item.pendingTitle)
                        .map((candidate, i) => (
                          <button
                            key={i}
                            onClick={() => handleAcceptTitle(candidate)}
                            className="cw-candidate-alt"
                          >
                            <span className="cw-candidate-alt-icon">
                              &#x25C7;
                            </span>
                            {candidate}
                          </button>
                        ))}
                    </div>
                    <div className="cw-custom-title-section">
                      <div className="cw-custom-title-label">
                        Custom title
                      </div>
                      <div className="cw-custom-title-row">
                        <input
                          className="illuminator-input cw-custom-title-input"
                          value={customTitle}
                          onChange={(e) => setCustomTitle(e.target.value)}
                          placeholder="Enter a custom title..."
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
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
                          className={`cw-custom-title-use-btn ${customTitle.trim() ? "cw-custom-title-use-btn--active" : "cw-custom-title-use-btn--disabled"}`}
                        >
                          Use
                        </button>
                      </div>
                    </div>
                    <div className="cw-title-footer">
                      <button
                        onClick={handleRejectTitle}
                        className="cw-keep-current-btn"
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
