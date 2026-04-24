/**
 * PROP CHAIN: ChroniclePanel -> ChronicleReviewPanel -> ChronicleWorkspace (this file)
 * Props originate in ChroniclePanel and pass through ChronicleReviewPanel.
 * When adding props, update all three files.
 */
import React, { useMemo, useState, useCallback } from "react";
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
import { createEntity } from "../../lib/db/entityRepository";
import CreateEntityModal from "../CreateEntityModal";
import TitleAcceptModal from "./TitleAcceptModal";
import { useVersionState, buildFormatTargetIndicator } from "./useVersionState";
import { useTabs } from "./useTabs";
import { useTertiaryCast } from "./useTertiaryCast";
import type { ChronicleRecord } from "../../lib/chronicleTypes";
import type { PersistedEntity } from "../../lib/db/illuminatorDb";
import type { PersistedNarrativeEvent } from "../../lib/db/illuminatorDb";
import type { ImageGenSettings } from "../../hooks/useImageGenSettings";
import type { WorldEntity, StyleLibrary, StyleSelection } from "@canonry/world-schema";
import type { WorldContext, CultureIdentities } from "../../lib/promptBuilders";
import type { Culture } from "../chronicle-panel/chroniclePanelTypes";
import type { EntityNavItem } from "../../lib/db/entityNav";
import "./ChronicleWorkspace.css";

// ---------------------------------------------------------------------------
// Local type definitions (workspace-specific)
// ---------------------------------------------------------------------------

interface WorldSchema {
  entityKinds: Array<{ id: string; name: string }>;
  [key: string]: unknown;
}

interface RefinementState {
  running: boolean;
}

interface Refinements {
  compare?: RefinementState;
  combine?: RefinementState;
  copyEdit?: RefinementState;
  temporalCheck?: RefinementState;
  quickCheck?: RefinementState;
}

interface Era {
  id: string;
  name: string;
  description?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Prop group interfaces (for max-jsx-props compliance)
// ---------------------------------------------------------------------------

export interface ImageConfig {
  styleLibrary?: StyleLibrary;
  styleSelection?: StyleSelection;
  cultures?: Culture[];
  cultureIdentities?: CultureIdentities;
  worldContext?: WorldContext;
  imageSize?: string;
  imageQuality?: string;
  imageModel?: string;
  imageGenSettings?: ImageGenSettings;
  onOpenImageSettings?: () => void;
}

export interface ImageRefCallbacks {
  onGenerateChronicleImage?: (refId: string) => void;
  onResetChronicleImage?: (refId: string) => void;
  onRegenerateDescription?: (refId: string) => void;
  onUpdateChronicleAnchorText?: (refId: string, text: string) => void;
  onUpdateChronicleImageSize?: (refId: string, size: string) => void;
  onUpdateChronicleImageJustification?: (refId: string, justification: string) => void;
  onSelectExistingImage?: (refId: string) => void;
  onSelectExistingCoverImage?: () => void;
}

// ---------------------------------------------------------------------------
// Component props
// ---------------------------------------------------------------------------

interface ChronicleWorkspaceProps {
  item: ChronicleRecord;

  // Actions
  onAccept?: () => void;
  onRegenerate?: () => void;
  onRegenerateWithSampling?: (sampling: string) => void;
  onRegenerateFull?: () => void;
  onRegenerateCreative?: () => void;
  onCompareVersions?: (a: string, b: string) => void;
  onCombineVersions?: (a: string, b: string, instructions?: string) => void;
  onCopyEdit?: (versionId: string) => void;
  onTemporalCheck?: () => void;
  onQuickCheck?: () => void;
  onValidate?: () => void;
  onGenerateSummary?: () => void;
  onGenerateTitle?: () => void;
  onAcceptPendingTitle?: (title?: string) => Promise<void>;
  onRejectPendingTitle?: () => Promise<void>;
  onGenerateImageRefs?: () => void;
  onGenerateChronicleImage?: (refId: string) => void;
  onResetChronicleImage?: (refId: string) => void;
  onRegenerateDescription?: (refId: string) => void;
  onUpdateChronicleAnchorText?: (refId: string, text: string) => void;
  onUpdateChronicleTemporalContext?: (ctx: unknown) => void;
  onUpdateChronicleActiveVersion?: (versionId: string) => void;
  onDeleteVersion?: (versionId: string) => void;
  onUpdateCombineInstructions?: (instructions: string) => void;
  onUnpublish?: () => void;

  // Cover image
  onGenerateCoverImageScene?: () => void;
  onGenerateCoverImage?: () => void;
  onResetCoverImage?: () => void;
  styleSelection?: StyleSelection;
  imageSize?: string;
  imageQuality?: string;
  imageModel?: string;
  imageGenSettings?: ImageGenSettings;
  onOpenImageSettings?: () => void;

  // Image layout edits
  onUpdateChronicleImageSize?: (refId: string, size: string) => void;
  onUpdateChronicleImageJustification?: (refId: string, justification: string) => void;

  // Image ref selections (version migration)
  onApplyImageRefSelections?: (selections: unknown[]) => void;

  // Select existing image for a ref
  onSelectExistingImage?: (refId: string) => void;

  // Select existing image for cover
  onSelectExistingCoverImage?: () => void;

  // Export
  onExport?: () => void;

  // Lore backport
  onBackportLore?: () => void;

  // Historian review
  onHistorianReview?: () => void;
  onSetAssignedTone?: (tone: string) => void;
  onDetectTone?: () => void;
  isHistorianActive?: boolean;
  onUpdateHistorianNote?: (noteId: string, text: string) => void;
  onGeneratePrep?: () => void;

  // State
  isGenerating?: boolean;
  refinements?: Refinements;

  // Data
  simulationRunId?: string;
  worldSchema?: WorldSchema;
  entities?: PersistedEntity[];
  styleLibrary?: StyleLibrary;
  cultures?: Culture[];
  cultureIdentities?: CultureIdentities;
  worldContext?: WorldContext;
  eras?: Era[];
  events?: PersistedNarrativeEvent[];
  fullEntityNavMap?: Map<string, EntityNavItem>;
  onNavigateToTab?: (tab: string) => void;

  // Tab state (lifted to survive unmount/remount cycles)
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const wordCount = (content?: string): number =>
  content?.split(/\s+/).filter(Boolean).length || 0;

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ChronicleWorkspace({
  item,
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
  onGenerateCoverImageScene,
  onGenerateCoverImage,
  onResetCoverImage,
  styleSelection,
  imageSize,
  imageQuality,
  imageModel,
  imageGenSettings,
  onOpenImageSettings,
  onUpdateChronicleImageSize,
  onUpdateChronicleImageJustification,
  onApplyImageRefSelections,
  onSelectExistingImage,
  onSelectExistingCoverImage,
  onExport,
  onBackportLore,
  onHistorianReview,
  onSetAssignedTone,
  onDetectTone,
  isHistorianActive,
  onUpdateHistorianNote,
  onGeneratePrep,
  isGenerating,
  refinements,
  simulationRunId,
  worldSchema,
  entities,
  styleLibrary,
  cultures,
  cultureIdentities,
  worldContext,
  eras,
  events,
  fullEntityNavMap,
  onNavigateToTab,
  activeTab,
  setActiveTab,
}: Readonly<ChronicleWorkspaceProps>) {
  const isComplete = item.status === "complete";

  // Entity map
  const entityMap = useMemo(() => {
    if (!entities) return new Map<string, PersistedEntity>();
    return new Map(entities.map((e) => [e.id, e]));
  }, [entities]);

  // Image config + ref callbacks (prop containers for ImagesTab)
  const imageConfig: ImageConfig = useMemo(() => ({
    styleLibrary, styleSelection, cultures, cultureIdentities, worldContext,
    imageSize, imageQuality, imageModel, imageGenSettings, onOpenImageSettings,
  }), [styleLibrary, styleSelection, cultures, cultureIdentities, worldContext,
    imageSize, imageQuality, imageModel, imageGenSettings, onOpenImageSettings]);

  const imageRefCallbacks: ImageRefCallbacks = useMemo(() => ({
    onGenerateChronicleImage, onResetChronicleImage, onRegenerateDescription,
    onUpdateChronicleAnchorText, onUpdateChronicleImageSize, onUpdateChronicleImageJustification,
    onSelectExistingImage, onSelectExistingCoverImage,
  }), [onGenerateChronicleImage, onResetChronicleImage, onRegenerateDescription,
    onUpdateChronicleAnchorText, onUpdateChronicleImageSize, onUpdateChronicleImageJustification,
    onSelectExistingImage, onSelectExistingCoverImage]);

  // Version state
  const versionState = useVersionState(
    item.generationHistory, item.activeVersionId, item.chronicleId, onDeleteVersion
  );

  // Derived refinement flags
  const compareRunning = refinements?.compare?.running || false;
  const combineRunning = refinements?.combine?.running || false;
  const copyEditRunning = refinements?.copyEdit?.running || false;
  const temporalCheckRunning = refinements?.temporalCheck?.running || false;
  const quickCheckRunning = refinements?.quickCheck?.running || false;

  // Indicators
  const summaryIndicator = buildFormatTargetIndicator(
    item.summaryTargetVersionId,
    versionState.activeVersionId,
    versionState.versionLabelMap
  );
  const imageRefsIndicator = buildFormatTargetIndicator(
    item.imageRefsTargetVersionId,
    versionState.activeVersionId,
    versionState.versionLabelMap
  );
  const imageRefsTargetContent =
    versionState.versionContentMap.get(item.imageRefsTargetVersionId || versionState.activeVersionId || "") ||
    item.assembledContent;

  // Tertiary cast
  const { detectTertiaryCast, toggleTertiaryCast } = useTertiaryCast(
    item,
    simulationRunId,
    isComplete,
    versionState.selectedVersion
  );

  // Seed data
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

  // Title modal
  const [showTitleAcceptModal, setShowTitleAcceptModal] = useState(false);

  const handleGenerateTitleWithModal = useCallback(() => {
    if (!onGenerateTitle) return;
    setShowTitleAcceptModal(true);
    onGenerateTitle();
  }, [onGenerateTitle]);

  const handleAcceptTitle = useCallback(
    async (chosenTitle: string) => {
      const normalized = chosenTitle.trim() || undefined;
      if (onAcceptPendingTitle) await onAcceptPendingTitle(normalized);
      setShowTitleAcceptModal(false);
    },
    [onAcceptPendingTitle]
  );

  const handleRejectTitle = useCallback(async () => {
    if (onRejectPendingTitle) await onRejectPendingTitle();
    setShowTitleAcceptModal(false);
  }, [onRejectPendingTitle]);

  // Image modal
  const [showQuickCheckModal, setShowQuickCheckModal] = useState(false);
  const [createEntityDefaults, setCreateEntityDefaults] = useState<Record<
    string,
    string | number | undefined
  > | null>(null);
  const [imageModal, setImageModal] = useState({ open: false, imageId: "", title: "" });

  const handleImageClick = useCallback((imageId: string, title: string) => {
    setImageModal({ open: true, imageId, title });
  }, []);

  const handleCloseImageModal = useCallback(() => {
    setImageModal({ open: false, imageId: "", title: "" });
  }, []);

  // Quick Check -> Create Entity flow
  const openCreateFromQuickCheck = useCallback(
    (phrase: string) => {
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
    async (entityData: Omit<WorldEntity, "id" | "createdAt" | "updatedAt">) => {
      if (!simulationRunId) return;
      await createEntity(simulationRunId, entityData);
      setCreateEntityDefaults(null);
    },
    [simulationRunId]
  );

  const handleCloseCreateEntity = useCallback(() => setCreateEntityDefaults(null), []);

  const handleShowQuickCheck = useCallback(() => setShowQuickCheckModal(true), []);
  const handleCloseQuickCheck = useCallback(() => setShowQuickCheckModal(false), []);

  // Tab state
  const { tabs } = useTabs(
    isComplete,
    versionState.versions.length,
    activeTab,
    setActiveTab,
  );

  // Current word count for header
  const currentWordCount = isComplete
    ? wordCount(item.finalContent)
    : (versionState.selectedVersion?.wordCount ?? wordCount(item.assembledContent));

  // Chronicle text for image refs
  const chronicleText = isComplete
    ? item.finalContent || imageRefsTargetContent || item.assembledContent
    : imageRefsTargetContent || item.assembledContent;

  // Version selection handler (clears compare if selecting the compared version)
  const handleSelectVersion = useCallback(
    (id: string) => {
      versionState.setSelectedVersionId(id);
      if (id === versionState.compareToVersionId) versionState.setCompareToVersionId("");
    },
    [versionState]
  );

  // Find/replace nav handler
  const handleFindReplace = useMemo(
    () =>
      isComplete && onNavigateToTab ? () => onNavigateToTab("finaledit") : undefined,
    [isComplete, onNavigateToTab]
  );

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
            summaryIndicator={summaryIndicator}
            imageRefsIndicator={imageRefsIndicator}
          />
        )}

        {activeTab === "versions" && (
          <VersionsTab
            item={item}
            versionState={versionState}
            isGenerating={isGenerating}
            onSelectVersion={handleSelectVersion}
            onSelectCompareVersion={versionState.setCompareToVersionId}
            onSetActiveVersion={isComplete ? undefined : onUpdateChronicleActiveVersion}
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
            versionState={versionState}
            imageConfig={imageConfig}
            imageRefCallbacks={imageRefCallbacks}
            onGenerateCoverImageScene={onGenerateCoverImageScene}
            onGenerateCoverImage={onGenerateCoverImage}
            onResetCoverImage={onResetCoverImage}
            onImageClick={handleImageClick}
            chronicleText={chronicleText}
            onApplyImageRefSelections={onApplyImageRefSelections}
            fullEntityNavMap={fullEntityNavMap}
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
            versionState={versionState}
            onSelectVersion={handleSelectVersion}
            onSelectCompareVersion={versionState.setCompareToVersionId}
            onSetActiveVersion={isComplete ? undefined : onUpdateChronicleActiveVersion}
            isGenerating={isGenerating}
            onQuickCheck={onQuickCheck}
            quickCheckRunning={quickCheckRunning}
            onShowQuickCheck={handleShowQuickCheck}
            onFindReplace={handleFindReplace}
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
            onGenerateImageRefs={onGenerateImageRefs}
          />
        )}
      </div>

      {/* Modals */}
      <ImageModal
        isOpen={imageModal.open}
        imageId={imageModal.imageId}
        title={imageModal.title}
        onClose={handleCloseImageModal}
      />

      {showQuickCheckModal && item.quickCheckReport && (
        <QuickCheckModal
          report={item.quickCheckReport}
          entities={entities}
          onCreateEntity={worldSchema ? openCreateFromQuickCheck : undefined}
          onClose={handleCloseQuickCheck}
        />
      )}

      {createEntityDefaults && worldSchema && (
        <CreateEntityModal
          worldSchema={worldSchema}
          eras={eras}
          defaults={createEntityDefaults}
          onSubmit={(...args: [Omit<WorldEntity, "id" | "createdAt" | "updatedAt">]) => void handleCreateEntityFromQuickCheck(...args)}
          onClose={handleCloseCreateEntity}
        />
      )}

      {showTitleAcceptModal && (
        <TitleAcceptModal
          item={item}
          onAcceptTitle={(title) => void handleAcceptTitle(title)}
          onRejectTitle={() => void handleRejectTitle()}
        />
      )}
    </div>
  );
}
