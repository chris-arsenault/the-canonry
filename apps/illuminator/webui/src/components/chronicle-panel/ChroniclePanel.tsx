/**
 * ChroniclePanel - Narrative generation interface
 *
 * Provides UI for generating long-form narrative content via single-shot LLM generation.
 * Includes wizard for entity/event selection and style configuration.
 *
 * PROP CHAIN: ChroniclePanel -> ChronicleReviewPanel -> ChronicleWorkspace
 * When adding/changing props, all three files must be updated in concert.
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import "../ChroniclePanel.css";
import { useEntityNavList, useEntityNavItems } from "../../lib/db/entitySelectors";
import { getEntitiesForRun } from "../../lib/db/entityRepository";
import type { PersistedEntity } from "../../lib/db/illuminatorDb";
import { useRelationships } from "../../lib/db/relationshipSelectors";
import { useNarrativeEvents } from "../../lib/db/narrativeEventSelectors";
import { ChronicleWizard } from "../ChronicleWizard";

import { generateNameBank, extractCultureIds } from "../../lib/chronicle/nameBank";
import { deriveStatus } from "../../hooks/useChronicleGeneration";
import { useChronicleStore } from "../../lib/db/chronicleStore";
import { useChronicleNavItems, useSelectedChronicle } from "../../lib/db/chronicleSelectors";
import { useChronicleActions } from "../../hooks/useChronicleActions";
import {
  getChroniclesForSimulation,
  updateChronicleHistorianPrep,
} from "../../lib/db/chronicleRepository";
import { downloadBulkToneReviewExport, downloadBulkAnnotationReviewExport } from "../../lib/chronicleExport";
import { useFactCoverage } from "../../hooks/useFactCoverage";
import BulkFactCoverageModal from "../BulkFactCoverageModal";
import { useToneRanking } from "../../hooks/useToneRanking";
import { useBulkChronicleAnnotationStore } from "../../lib/db/bulkChronicleAnnotationStore";
import { useInterleavedAnnotationStore } from "../../lib/db/interleavedAnnotationStore";
import { useEntityStore } from "../../lib/db/entityStore";
import { annotateEntityNames } from "../../lib/annotateEntityNames";
import { getEraNarrativesForSimulation } from "../../lib/db/eraNarrativeRepository";
import { useIlluminatorModals } from "../../lib/db/modalStore";
import { buildEraNarrativeNavItem } from "../../lib/db/eraNarrativeNav";
import ChronologyModal from "../ChronologyModal";
import EraNarrativeModal from "../EraNarrativeModal";
import BulkEraNarrativeModal from "../BulkEraNarrativeModal";
import { useBulkEraNarrativeStore } from "../../lib/db/bulkEraNarrativeStore";
import { useBulkTagImageRefsStore } from "../../lib/db/bulkTagImageRefsStore";
import { useBulkTagCoverImagesStore } from "../../lib/db/bulkTagCoverImagesStore";
import BulkTagImageRefsModal from "../BulkTagImageRefsModal";
import BulkTagCoverImagesModal from "../BulkTagCoverImagesModal";

import { ChronicleFilterBar } from "./ChronicleFilterBar";
import { ChronicleNavList } from "./ChronicleNavList";
import { ChronicleDetailPanel } from "./ChronicleDetailPanel";
import { ChronicleBulkActions } from "./ChronicleBulkActions";
import { RestartModal, ResetBackportModal } from "./ChroniclePanelModals";
import {
  EraSummaryRefreshToast,
  TemporalCheckToast,
  BulkSummaryToast,
  BulkImageRefToast,
  BulkClearImageRefToast,
  AssignImageStyleToast,
  BulkGenerateSceneToast,
  BulkClearSceneImageToast,
  BulkGenerateCoverSceneToast,
  AssignCoverImageStyleToast,
  BulkGenerateCoverImageToast,
  BulkClearCoverImageToast,
  ResetBackportToast,
  ReconcileBackportToast,
} from "./ChroniclePanelToasts";
import { useChronicleImageCallbacks } from "./useChronicleImageCallbacks";
import { useChronicleBulkOperations } from "./useChronicleBulkOperations";
import { useChronicleNavigation } from "./useChronicleNavigation";
import { useChronicleGenerationCallbacks } from "./useChronicleGenerationCallbacks";
import type { ChroniclePanelProps } from "./chroniclePanelTypes";

export function ChroniclePanel({
  worldData,
  queue,
  onEnqueue,
  worldContext,
  projectId,
  simulationRunId,
  styleLibrary,
  imageGenSettings,
  entityGuidance,
  cultureIdentities,
  onBackportLore,
  onStartBulkBackport,
  isBulkBackportActive,
  refreshTrigger,
  imageModel,
  onOpenImageSettings,
  onHistorianReview,
  isHistorianActive,
  historianConfigured,
  historianConfig,
  onUpdateHistorianNote,
  onRefreshEraSummaries,
  onNavigateToTab,
}: Readonly<ChroniclePanelProps>) {
  const navEntities = useEntityNavList();
  const entityNavMap = useEntityNavItems();
  const [fullEntities, setFullEntities] = useState<PersistedEntity[]>([]);
  const fullEntityMapRef = useRef<Map<string, PersistedEntity>>(new Map());
  const relationships = useRelationships();
  const narrativeEvents = useNarrativeEvents();
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showChronologyModal, setShowChronologyModal] = useState(false);
  const [showBulkEraNarrative, setShowBulkEraNarrative] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardSeed, setWizardSeed] = useState<Record<string, unknown> | null>(null);
  const [skipCompletedPrep, setSkipCompletedPrep] = useState(true);
  const [nameBank, setNameBank] = useState<Record<string, string[]>>({});

  const eraNarrativeModal = useIlluminatorModals((s) => s.eraNarrativeModal);
  const bulkEraNarrativeProgress = useBulkEraNarrativeStore((s) => s.progress);
  const [eraNarrativeNavItems, setEraNarrativeNavItems] = useState<Array<Record<string, unknown>>>([]);

  // Fact coverage
  const { progress: factCoverageProgress, isActive: isFactCoverageActive, prepareFactCoverage, confirmFactCoverage, cancelFactCoverage, closeFactCoverage } = useFactCoverage();

  // Tone ranking
  const { progress: toneRankingProgress, isActive: isToneRankingActive, prepareToneRanking, prepareAssignment } = useToneRanking();

  // Bulk annotations
  const bulkAnnotationProgress = useBulkChronicleAnnotationStore((s) => s.progress);
  const prepareBulkAnnotation = useBulkChronicleAnnotationStore((s) => s.prepareAnnotation);
  const isBulkAnnotationActive = bulkAnnotationProgress.status === "running" || bulkAnnotationProgress.status === "confirming";
  const prepareInterleaved = useInterleavedAnnotationStore((s) => s.prepareInterleaved);
  const interleavedProgress = useInterleavedAnnotationStore((s) => s.progress);
  const isInterleavedActive = interleavedProgress.status === "running" || interleavedProgress.status === "confirming";
  const entityNavItems = useEntityStore((s) => s.navItems);

  // Bulk tag image refs (sequential)
  const bulkTagProgress = useBulkTagImageRefsStore((s) => s.progress);
  const prepareBulkTag = useBulkTagImageRefsStore((s) => s.prepareTag);
  const confirmBulkTag = useBulkTagImageRefsStore((s) => s.confirmTag);
  const cancelBulkTag = useBulkTagImageRefsStore((s) => s.cancelTag);
  const closeBulkTag = useBulkTagImageRefsStore((s) => s.closeTag);
  const isBulkTagActive = bulkTagProgress.status === "running" || bulkTagProgress.status === "confirming";

  // Bulk tag cover images (sequential)
  const bulkTagCoverProgress = useBulkTagCoverImagesStore((s) => s.progress);
  const prepareBulkTagCover = useBulkTagCoverImagesStore((s) => s.prepareTag);
  const confirmBulkTagCover = useBulkTagCoverImagesStore((s) => s.confirmTag);
  const cancelBulkTagCover = useBulkTagCoverImagesStore((s) => s.cancelTag);
  const closeBulkTagCover = useBulkTagCoverImagesStore((s) => s.closeTag);

  // Image settings derived from global
  const chronicleImageSize = imageGenSettings.imageSize;
  const chronicleImageQuality = imageGenSettings.imageQuality;
  const chronicleStyleSelection = useMemo(() => ({
    artisticStyleId: imageGenSettings.artisticStyleId,
    compositionStyleId: imageGenSettings.compositionStyleId,
    colorPaletteId: imageGenSettings.colorPaletteId,
  }), [imageGenSettings.artisticStyleId, imageGenSettings.compositionStyleId, imageGenSettings.colorPaletteId]);

  // Load full entities
  useEffect(() => {
    if (!simulationRunId) return;
    let cancelled = false;
    void getEntitiesForRun(simulationRunId).then((ents) => {
      if (cancelled) return;
      setFullEntities(ents);
      fullEntityMapRef.current = new Map(ents.map((e) => [e.id, e]));
    });
    return () => { cancelled = true; };
  }, [simulationRunId]);

  const chronicleWorldData = useMemo(() => ({
    entities: fullEntities,
    relationships: relationships || [],
    narrativeHistory: narrativeEvents || [],
  }), [fullEntities, relationships, narrativeEvents]);

  // Initialize store
  useEffect(() => {
    if (simulationRunId) void useChronicleStore.getState().initialize(simulationRunId);
  }, [simulationRunId]);

  const { generateV2, generateSummary, generateTitle, regenerateWithSampling, regenerateFull, regenerateCreative, compareVersions, combineVersions, copyEdit, temporalCheck, quickCheck } = useChronicleActions();
  const acceptChronicle = useChronicleStore((s) => s.acceptChronicle);
  const cancelChronicle = useChronicleStore((s) => s.cancelChronicle);
  const restartChronicle = useChronicleStore((s) => s.restartChronicle);

  const refresh = useCallback(() => useChronicleStore.getState().refreshAll(), []);
  const refreshChronicle = useCallback((id: string) => useChronicleStore.getState().refreshChronicle(id), []);

  // Tab state lives here so it survives ChronicleWorkspace unmount/remount
  // when switching to a chronicle that hasn't been cached yet.
  const [workspaceActiveTab, setWorkspaceActiveTab] = useState("historian");

  useEffect(() => { if (refreshTrigger > 0) void refresh(); }, [refreshTrigger, refresh]);

  // Navigation hook
  const nav = useChronicleNavigation({
    queue, chronicleWorldData, styleLibrary, eraNarrativeNavItems,
    simulationRunId, navEntities, entityNavMap, fullEntities,
    narrativeEvents, relationships, fullEntityMapRef,
  });

  // Effective status with queue awareness
  const getEffectiveStatus = nav.getEffectiveStatus;
  const chronicleItems = useChronicleNavItems(getEffectiveStatus);

  // Feed chronicle items into the navigation filter
  useEffect(() => {
    nav.setChronicleItemsForFilter(chronicleItems);
  }, [chronicleItems, nav.setChronicleItemsForFilter]);

  // Selected chronicle
  const isEraNarrativeSelected = nav.selectedItemId?.startsWith("eranarr:") ?? false;
  const selectedEraNarrativeId = isEraNarrativeSelected ? nav.selectedItemId.slice("eranarr:".length) : null;
  const selectedChronicle = useSelectedChronicle(isEraNarrativeSelected ? null : nav.selectedItemId);

  const selectedItem = useMemo(() => {
    if (!selectedChronicle) return undefined;
    const record = selectedChronicle;
    const displayName = record.title || (record.roleAssignments?.length > 0 ? record.roleAssignments.filter((r: { isPrimary: boolean }) => r.isPrimary).map((r: { entityName: string }) => r.entityName).join(" & ") || record.roleAssignments[0]?.entityName : "") || "Untitled Chronicle";
    return {
      ...record,
      id: record.chronicleId,
      type: "chronicles" as const,
      name: displayName,
      status: getEffectiveStatus(record.chronicleId, deriveStatus(record)),
      primaryCount: record.roleAssignments?.filter((r: { isPrimary: boolean }) => r.isPrimary).length || 0,
      supportingCount: (record.roleAssignments?.length || 0) - (record.roleAssignments?.filter((r: { isPrimary: boolean }) => r.isPrimary).length || 0),
      editVersion: record.editVersion ?? 0,
    };
  }, [selectedChronicle, getEffectiveStatus]);

  const isGenerating = Boolean(nav.selectedItemId) && queue.some((item) => item.type === "entityChronicle" && item.chronicleId === nav.selectedItemId && (item.status === "queued" || item.status === "running"));

  // Generation callbacks
  const gen = useChronicleGenerationCallbacks({
    selectedItem, worldContext, styleLibrary, chronicleWorldData,
    navEntities, worldData, cultureIdentities, entityGuidance,
    generateSummary, generateTitle, regenerateWithSampling, regenerateFull,
    regenerateCreative, compareVersions, combineVersions, copyEdit,
    temporalCheck, quickCheck, acceptChronicle, cancelChronicle,
    restartChronicle, refreshChronicle, onEnqueue, generateV2,
    simulationRunId, refresh, nameBank,
    setWizardSeed, setShowWizard, nav,
    fullEntityMapRef,
  });

  // Image callbacks
  const img = useChronicleImageCallbacks({
    selectedItem, generationContext: gen.generationContext, fullEntityMapRef,
    onEnqueue, refreshChronicle, chronicleStyleSelection, styleLibrary,
    worldContext, chronicleImageSize, chronicleImageQuality,
  });

  // Bulk operations
  const bulk = useChronicleBulkOperations({
    simulationRunId, chronicleItems, onEnqueue, refresh,
    historianConfigured, historianConfig, skipCompletedPrep,
    fullEntityMapRef, styleLibrary, worldContext,
    imageModel, chronicleImageQuality: imageGenSettings.imageQuality,
  });

  // Era narratives
  const refreshEraNarratives = useCallback(() => {
    if (!simulationRunId) return;
    void getEraNarrativesForSimulation(simulationRunId).then((records) => {
      const eraOrderMap = new Map(nav.wizardEras.map((e) => [e.id, e.order]));
      const navItems = records.map((r: Record<string, unknown>) => buildEraNarrativeNavItem(r, eraOrderMap.get(r.eraId as string)));
      setEraNarrativeNavItems(navItems);
    });
  }, [simulationRunId, nav.wizardEras]);

  useEffect(() => { refreshEraNarratives(); }, [refreshEraNarratives]);

  // Name bank
  const roleAssignments = selectedItem?.roleAssignments;
  const nameBankCultureIds = useMemo(() => {
    if (!roleAssignments || !navEntities?.length) return [];
    const entityIds = roleAssignments.map((r: { entityId: string }) => r.entityId);
    const selectedEntities = navEntities.filter((e: { id: string }) => entityIds.includes(e.id));
    return extractCultureIds(selectedEntities);
  }, [roleAssignments, navEntities]);

  useEffect(() => {
    if (!worldData?.schema?.cultures || nameBankCultureIds.length === 0) return;
    generateNameBank(worldData.schema.cultures, nameBankCultureIds).then((bank) => setNameBank(bank)).catch(() => setNameBank({}));
  }, [nameBankCultureIds, worldData?.schema?.cultures]);

  // Clear stale selection
  useEffect(() => {
    if (nav.selectedItemId && chronicleItems.length > 0) {
      if (nav.selectedItemId.startsWith("eranarr:")) {
        const existsInEraNarr = eraNarrativeNavItems.some((item: Record<string, unknown>) => item.id === nav.selectedItemId);
        if (eraNarrativeNavItems.length > 0 && !existsInEraNarr) nav.setSelectedItemId(null);
      } else {
        const existsInNav = chronicleItems.some((item) => item.chronicleId === nav.selectedItemId);
        if (!existsInNav) nav.setSelectedItemId(null);
      }
    }
  }, [nav, chronicleItems, eraNarrativeNavItems]);

  // Persist selection
  useEffect(() => {
    if (nav.selectedItemId) localStorage.setItem("illuminator:chronicle:selectedItemId", nav.selectedItemId);
    else localStorage.removeItem("illuminator:chronicle:selectedItemId");
  }, [nav.selectedItemId]);

  // Stats
  const stats = useMemo(() => {
    const byStatus: Record<string, number> = { not_started: 0, complete: 0 };
    for (const item of chronicleItems) byStatus[item.status] = (byStatus[item.status] || 0) + 1;
    return byStatus;
  }, [chronicleItems]);

  // Amend briefs handler
  const handleAmendBriefs = useCallback(() => {
    void (async () => {
      if (!simulationRunId || entityNavItems.size === 0) return;
      const chronicles = await getChroniclesForSimulation(simulationRunId);
      let amended = 0;
      for (const record of chronicles) {
        if (!record.historianPrep) continue;
        const annotated = annotateEntityNames(record.historianPrep, entityNavItems);
        if (annotated !== record.historianPrep) {
          await updateChronicleHistorianPrep(record.chronicleId, annotated);
          amended++;
        }
      }
      console.log(`[Amend Briefs] Annotated ${amended}/${chronicles.filter((c: Record<string, unknown>) => c.historianPrep).length} briefs`);
    })();
  }, [simulationRunId, entityNavItems]);

  // Build review panel props — merge in data props that buildReviewPanelProps
  // leaves as placeholders (styleSelection, imageGenSettings, entities, etc.)
  const rawReviewPanelProps = gen.buildReviewPanelProps(selectedItem, img, isGenerating, nav, historianConfigured, isHistorianActive, onHistorianReview, onBackportLore, onUpdateHistorianNote, onOpenImageSettings, imageModel, onNavigateToTab);
  const reviewPanelProps = rawReviewPanelProps ? {
    ...rawReviewPanelProps,
    styleSelection: chronicleStyleSelection,
    imageSize: chronicleImageSize,
    imageQuality: chronicleImageQuality,
    imageGenSettings,
    styleLibrary,
    cultures: worldData?.schema?.cultures,
    cultureIdentities,
    worldContext,
    simulationRunId,
    worldSchema: worldData?.schema ?? { entityKinds: [], cultures: [] },
    entities: fullEntities,
    fullEntityNavMap: entityNavMap,
    activeTab: workspaceActiveTab,
    setActiveTab: setWorkspaceActiveTab,
  } : null;

  return (
    <div className="chron-root">
      {/* Header */}
      <div className="chron-header">
        <div className="chron-header-row">
          <div>
            <h2 className="chron-header-title">Chronicles</h2>
            <p className="chron-header-subtitle">Generate long-form narrative content</p>
          </div>
          <div className="chron-header-actions">
            <span className="chron-header-count">{stats.complete || 0} / {chronicleItems.length} complete</span>
            <button onClick={() => setShowWizard(true)} disabled={!styleLibrary || !navEntities?.length} className="illuminator-button illuminator-button-primary chron-header-new-btn">
              <span className="chron-header-new-icon">&#10024;</span> New Chronicle
            </button>
          </div>
        </div>
      </div>

      <ChronicleFilterBar {...nav.filterBarProps} />

      <ChronicleBulkActions
        showBulkActions={showBulkActions}
        onToggleBulkActions={() => setShowBulkActions(!showBulkActions)}
        onBulkTemporalCheck={bulk.handleBulkTemporalCheck}
        onBulkDetectTertiary={() => void bulk.handleBulkDetectTertiary()}
        tertiaryDetectRunning={bulk.tertiaryDetectResult?.running ?? false}
        onRefreshEraSummaries={onRefreshEraSummaries}
        onEraSummaryRefreshResult={bulk.setEraSummaryRefreshResult}
        onBulkSummary={bulk.handleBulkSummary}
        onPrepareFactCoverage={() => prepareFactCoverage(chronicleItems)}
        isFactCoverageActive={isFactCoverageActive}
        onPrepareToneRanking={() => prepareToneRanking(chronicleItems)}
        isToneRankingActive={isToneRankingActive}
        toneRankingProgress={toneRankingProgress}
        onPrepareAssignment={() => void prepareAssignment()}
        onDownloadToneReview={() => void downloadBulkToneReviewExport(simulationRunId)}
        onStartBulkBackport={onStartBulkBackport}
        isBulkBackportActive={isBulkBackportActive}
        onReconcileBackports={() => void bulk.handleReconcileBackports()}
        onOpenResetBackportModal={bulk.handleOpenResetBackportModal}
        historianConfigured={historianConfigured}
        skipCompletedPrep={skipCompletedPrep}
        onSetSkipCompletedPrep={setSkipCompletedPrep}
        onOpenChronologyModal={() => setShowChronologyModal(true)}
        onBulkHistorianPrep={bulk.handleBulkHistorianPrep}
        onOpenEraNarrativeModal={() => useIlluminatorModals.getState().openEraNarrative()}
        onOpenBulkEraNarrativeModal={() => setShowBulkEraNarrative(true)}
        bulkEraNarrativeRunning={bulkEraNarrativeProgress.status === "running"}
        onPrepareBulkAnnotation={(op) => prepareBulkAnnotation(op, chronicleItems)}
        isBulkAnnotationActive={isBulkAnnotationActive}
        bulkAnnotationProgress={bulkAnnotationProgress}
        onPrepareInterleaved={() => prepareInterleaved(chronicleItems, entityNavItems)}
        isInterleavedActive={isInterleavedActive}
        onDownloadAnnotationReview={() => void downloadBulkAnnotationReviewExport(simulationRunId)}
        onAmendBriefs={handleAmendBriefs}
        onBulkRegenerateImageRefs={bulk.handleBulkRegenerateImageRefs}
        onBulkTagImageRefs={() => styleLibrary && prepareBulkTag(chronicleItems, styleLibrary, simulationRunId, projectId)}
        onAssignImageStyles={bulk.handleAssignImageStyles}
        onBulkGenerateSceneImages={bulk.handleBulkGenerateSceneImages}
        onBulkClearImageRefs={bulk.handleBulkClearImageRefs}
        onBulkClearSceneImages={bulk.handleBulkClearSceneImages}
        onBulkGenerateCoverScenes={bulk.handleBulkGenerateCoverScenes}
        onAssignCoverImageStyles={() => void bulk.handleAssignCoverImageStyles()}
        onBulkGenerateCoverImages={bulk.handleBulkGenerateCoverImages}
        onBulkClearCoverImages={bulk.handleBulkClearCoverImages}
        onBulkTagCoverImages={() => styleLibrary && prepareBulkTagCover(chronicleItems, styleLibrary, simulationRunId, projectId)}
      />

      <div className="chron-main">
        <ChronicleNavList
          filteredItems={nav.filteredItems}
          visibleItems={nav.visibleItems}
          groupByType={nav.groupByType}
          groupedItems={nav.groupedItems}
          selectedItemId={nav.selectedItemId}
          onSelectItem={nav.setSelectedItemId}
          navListRef={nav.navListRef}
          navLoadMoreRef={nav.navLoadMoreRef}
          hasMore={nav.hasMore}
        />

        <ChronicleDetailPanel
          isEraNarrativeSelected={isEraNarrativeSelected}
          selectedEraNarrativeId={selectedEraNarrativeId}
          eraNarrativeViewerProps={isEraNarrativeSelected && selectedEraNarrativeId ? {
            narrativeId: selectedEraNarrativeId,
            onEnqueue, styleLibrary, styleSelection: chronicleStyleSelection,
            imageSize: chronicleImageSize, imageQuality: chronicleImageQuality,
            imageModel, imageGenSettings, onOpenImageSettings,
            cultures: worldData?.schema?.cultures, cultureIdentities, worldContext,
          } : null}
          selectedItem={selectedItem}
          onRegenerate={gen.handleRegenerate}
          onCancel={(chronicleId) => void cancelChronicle(chronicleId)}
          reviewPanelProps={reviewPanelProps}
        />
      </div>

      {/* Modals */}
      {gen.showRestartModal && <RestartModal onConfirm={() => void gen.handleRestartConfirm()} onCancel={gen.handleRestartCancel} />}
      {bulk.showResetBackportModal && <ResetBackportModal onConfirm={() => void bulk.handleResetBackportConfirm()} onCancel={bulk.handleResetBackportCancel} />}

      {/* Toasts */}
      {bulk.eraSummaryRefreshResult && <EraSummaryRefreshToast result={bulk.eraSummaryRefreshResult} onDismiss={() => bulk.setEraSummaryRefreshResult(null)} />}
      {bulk.temporalCheckResult && <TemporalCheckToast result={bulk.temporalCheckResult} onDismiss={() => bulk.setTemporalCheckResult(null)} />}
      {bulk.bulkSummaryResult && <BulkSummaryToast result={bulk.bulkSummaryResult} onDismiss={() => bulk.setBulkSummaryResult(null)} />}
      {bulk.bulkImageRefResult && <BulkImageRefToast result={bulk.bulkImageRefResult} onDismiss={() => bulk.setBulkImageRefResult(null)} />}
      {bulk.bulkClearImageRefResult && <BulkClearImageRefToast result={bulk.bulkClearImageRefResult} onDismiss={() => bulk.setBulkClearImageRefResult(null)} />}
      {bulk.assignImageStyleResult && <AssignImageStyleToast result={bulk.assignImageStyleResult} onDismiss={() => bulk.setAssignImageStyleResult(null)} />}
      {bulk.bulkGenerateSceneResult && <BulkGenerateSceneToast result={bulk.bulkGenerateSceneResult} onDismiss={() => bulk.setBulkGenerateSceneResult(null)} />}
      {bulk.bulkClearSceneImageResult && <BulkClearSceneImageToast result={bulk.bulkClearSceneImageResult} onDismiss={() => bulk.setBulkClearSceneImageResult(null)} />}
      {bulk.bulkGenerateCoverSceneResult && <BulkGenerateCoverSceneToast result={bulk.bulkGenerateCoverSceneResult} onDismiss={() => bulk.setBulkGenerateCoverSceneResult(null)} />}
      {bulk.assignCoverImageStyleResult && <AssignCoverImageStyleToast result={bulk.assignCoverImageStyleResult} onDismiss={() => bulk.setAssignCoverImageStyleResult(null)} />}
      {bulk.bulkGenerateCoverImageResult && <BulkGenerateCoverImageToast result={bulk.bulkGenerateCoverImageResult} onDismiss={() => bulk.setBulkGenerateCoverImageResult(null)} />}
      {bulk.bulkClearCoverImageResult && <BulkClearCoverImageToast result={bulk.bulkClearCoverImageResult} onDismiss={() => bulk.setBulkClearCoverImageResult(null)} />}
      {bulk.resetBackportResult && <ResetBackportToast result={bulk.resetBackportResult} onDismiss={() => bulk.setResetBackportResult(null)} />}
      {bulk.reconcileBackportResult && <ReconcileBackportToast result={bulk.reconcileBackportResult} onDismiss={() => bulk.setReconcileBackportResult(null)} />}

      <BulkTagImageRefsModal progress={bulkTagProgress} onConfirm={confirmBulkTag} onCancel={cancelBulkTag} onClose={closeBulkTag} />
      <BulkTagCoverImagesModal progress={bulkTagCoverProgress} onConfirm={confirmBulkTagCover} onCancel={cancelBulkTagCover} onClose={closeBulkTagCover} />
      <BulkFactCoverageModal progress={factCoverageProgress} onConfirm={confirmFactCoverage} onCancel={cancelFactCoverage} onClose={closeFactCoverage} />
      <ChronologyModal isOpen={showChronologyModal} onClose={() => setShowChronologyModal(false)} chronicleItems={chronicleItems} wizardEras={nav.wizardEras} wizardEvents={nav.wizardEvents} projectId={projectId} simulationRunId={simulationRunId} historianConfig={historianConfig} onEnqueue={onEnqueue} onApplied={() => { void useChronicleStore.getState().refreshAll(); setShowChronologyModal(false); }} />
      <EraNarrativeModal isOpen={eraNarrativeModal !== null} resumeNarrativeId={eraNarrativeModal?.narrativeId} onClose={() => { useIlluminatorModals.getState().closeEraNarrative(); refreshEraNarratives(); }} chronicleItems={chronicleItems} wizardEras={nav.wizardEras} projectId={projectId} simulationRunId={simulationRunId} historianConfig={historianConfig} onEnqueue={onEnqueue} styleLibrary={styleLibrary} />
      <BulkEraNarrativeModal isOpen={showBulkEraNarrative || bulkEraNarrativeProgress.status === "running"} onClose={() => { setShowBulkEraNarrative(false); refreshEraNarratives(); }} chronicleItems={chronicleItems} wizardEras={nav.wizardEras} eraTemporalInfo={nav.wizardEras} projectId={projectId} simulationRunId={simulationRunId} styleLibrary={styleLibrary} />
      <ChronicleWizard isOpen={showWizard} onClose={() => { setShowWizard(false); setWizardSeed(null); }} onGenerate={(cfg: Record<string, unknown>) => void gen.handleWizardGenerate(cfg)} narrativeStyles={styleLibrary?.narrativeStyles || []} entities={nav.wizardEntities} relationships={nav.wizardRelationships} events={nav.wizardEvents} entityKinds={worldData?.schema?.entityKinds || []} eras={nav.wizardEras} initialSeed={wizardSeed} simulationRunId={simulationRunId} />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default ChroniclePanel;
