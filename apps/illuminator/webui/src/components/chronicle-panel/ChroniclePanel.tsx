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
import { useRelationships } from "../../lib/db/relationshipSelectors";
import { useNarrativeEvents } from "../../lib/db/narrativeEventSelectors";
import { ChronicleWizard } from "../ChronicleWizard";
import { buildChronicleContext, buildEventHeadline } from "../../lib/chronicleContextBuilder";
import { generateNameBank, extractCultureIds } from "../../lib/chronicle/nameBank";
import { deriveStatus } from "../../hooks/useChronicleGeneration";
import { useChronicleStore } from "../../lib/db/chronicleStore";
import { useChronicleNavItems, useSelectedChronicle } from "../../lib/db/chronicleSelectors";
import { useChronicleActions } from "../../hooks/useChronicleActions";
import {
  updateChronicleTemporalContext,
  updateChronicleActiveVersion,
  updateChronicleCombineInstructions,
  unpublishChronicle,
  generateChronicleId,
  deriveTitleFromRoles,
  createChronicleShell,
  deleteChronicleVersion,
  getChronicle,
  updateChronicleAssignedTone,
  getChroniclesForSimulation,
  updateChronicleHistorianPrep,
} from "../../lib/db/chronicleRepository";
import { downloadChronicleExport, downloadBulkToneReviewExport, downloadBulkAnnotationReviewExport } from "../../lib/chronicleExport";
import { getCallConfig } from "../../lib/llmModelSettings";
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
import { computeTemporalContext } from "../../lib/chronicle/selectionWizard";
import { buildTemporalDescription, REFINEMENT_STEPS, NAV_PAGE_SIZE } from "./chroniclePanelConstants";
import { ChronicleFilterBar } from "./ChronicleFilterBar";
import { ChronicleNavList } from "./ChronicleNavList";
import { ChronicleDetailPanel } from "./ChronicleDetailPanel";
import { ChronicleBulkActions } from "./ChronicleBulkActions";
import { RestartModal, ResetBackportModal } from "./ChroniclePanelModals";
import {
  EraSummaryRefreshToast,
  TemporalCheckToast,
  BulkSummaryToast,
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
}: ChroniclePanelProps) {
  const navEntities = useEntityNavList();
  const entityNavMap = useEntityNavItems();
  const [fullEntities, setFullEntities] = useState<Array<Record<string, unknown>>>([]);
  const fullEntityMapRef = useRef<Map<string, Record<string, unknown>>>(new Map());
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

  // Image settings derived from global
  const chronicleImageSize = imageGenSettings.imageSize;
  const chronicleImageQuality = imageGenSettings.imageQuality;
  const chronicleStyleSelection = useMemo(() => ({
    artisticStyleId: imageGenSettings.artisticStyleId,
    compositionStyleId: imageGenSettings.compositionStyleId,
    colorPaletteId: imageGenSettings.colorPaletteId,
  }), [imageGenSettings.artisticStyleId, imageGenSettings.compositionStyleId, imageGenSettings.colorPaletteId]);

  const stylesLoading = !styleLibrary;

  // Load full entities
  useEffect(() => {
    if (!simulationRunId) return;
    let cancelled = false;
    getEntitiesForRun(simulationRunId).then((ents) => {
      if (cancelled) return;
      setFullEntities(ents);
      fullEntityMapRef.current = new Map(ents.map((e: Record<string, unknown>) => [e.id as string, e]));
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
    if (simulationRunId) useChronicleStore.getState().initialize(simulationRunId);
  }, [simulationRunId]);

  const { generateV2, generateSummary, generateTitle, regenerateWithSampling, regenerateFull, regenerateCreative, compareVersions, combineVersions, copyEdit, temporalCheck, quickCheck } = useChronicleActions();
  const acceptChronicle = useChronicleStore((s) => s.acceptChronicle);
  const cancelChronicle = useChronicleStore((s) => s.cancelChronicle);
  const restartChronicle = useChronicleStore((s) => s.restartChronicle);

  const refresh = useCallback(() => useChronicleStore.getState().refreshAll(), []);
  const refreshChronicle = useCallback((id: string) => useChronicleStore.getState().refreshChronicle(id), []);

  useEffect(() => { if (refreshTrigger > 0) refresh(); }, [refreshTrigger, refresh]);

  // Navigation hook
  const nav = useChronicleNavigation({
    queue, chronicleWorldData, styleLibrary, eraNarrativeNavItems,
    simulationRunId, navEntities, entityNavMap, fullEntities,
    narrativeEvents, relationships, fullEntityMapRef,
  });

  // Effective status with queue awareness
  const getEffectiveStatus = nav.getEffectiveStatus;
  const chronicleItems = useChronicleNavItems(getEffectiveStatus);

  // Selected chronicle
  const isEraNarrativeSelected = nav.selectedItemId?.startsWith("eranarr:") ?? false;
  const selectedEraNarrativeId = isEraNarrativeSelected ? nav.selectedItemId!.slice("eranarr:".length) : null;
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
  });

  // Era narratives
  const refreshEraNarratives = useCallback(() => {
    if (!simulationRunId) return;
    getEraNarrativesForSimulation(simulationRunId).then((records) => {
      const eraOrderMap = new Map(nav.wizardEras.map((e) => [e.id, e.order]));
      const navItems = records.map((r: Record<string, unknown>) => buildEraNarrativeNavItem(r, eraOrderMap.get(r.eraId as string)));
      setEraNarrativeNavItems(navItems);
    });
  }, [simulationRunId, nav.wizardEras]);

  useEffect(() => { refreshEraNarratives(); }, [refreshEraNarratives]);

  // Name bank
  useEffect(() => {
    if (!selectedItem?.roleAssignments || !navEntities?.length || !worldData?.schema?.cultures) return;
    const entityIds = selectedItem.roleAssignments.map((r: { entityId: string }) => r.entityId);
    const selectedEntities = navEntities.filter((e: { id: string }) => entityIds.includes(e.id));
    const cultureIds = extractCultureIds(selectedEntities);
    if (cultureIds.length === 0) { setNameBank({}); return; }
    generateNameBank(worldData.schema.cultures, cultureIds).then((bank) => setNameBank(bank)).catch(() => setNameBank({}));
  }, [selectedItem?.roleAssignments, navEntities, worldData?.schema?.cultures]);

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
  }, [nav.selectedItemId, chronicleItems, eraNarrativeNavItems, nav.setSelectedItemId]);

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

  // Build review panel props
  const reviewPanelProps = gen.buildReviewPanelProps(selectedItem, img, isGenerating, nav, historianConfigured, isHistorianActive, onHistorianReview, onBackportLore, onUpdateHistorianNote, onOpenImageSettings, imageModel, onNavigateToTab);

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
        chronicleItems={chronicleItems}
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
        onPrepareAssignment={prepareAssignment}
        onDownloadToneReview={() => downloadBulkToneReviewExport(simulationRunId)}
        onStartBulkBackport={onStartBulkBackport}
        isBulkBackportActive={isBulkBackportActive}
        onReconcileBackports={() => void bulk.handleReconcileBackports()}
        onOpenResetBackportModal={bulk.handleOpenResetBackportModal}
        historianConfigured={historianConfigured}
        historianConfig={historianConfig}
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
        onDownloadAnnotationReview={() => downloadBulkAnnotationReviewExport(simulationRunId)}
        onAmendBriefs={handleAmendBriefs}
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
          onCancel={(chronicleId) => cancelChronicle(chronicleId)}
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
      {bulk.resetBackportResult && <ResetBackportToast result={bulk.resetBackportResult} onDismiss={() => bulk.setResetBackportResult(null)} />}
      {bulk.reconcileBackportResult && <ReconcileBackportToast result={bulk.reconcileBackportResult} onDismiss={() => bulk.setReconcileBackportResult(null)} />}

      <BulkFactCoverageModal progress={factCoverageProgress} onConfirm={confirmFactCoverage} onCancel={cancelFactCoverage} onClose={closeFactCoverage} />
      <ChronologyModal isOpen={showChronologyModal} onClose={() => setShowChronologyModal(false)} chronicleItems={chronicleItems} wizardEras={nav.wizardEras} wizardEvents={nav.wizardEvents} projectId={projectId} simulationRunId={simulationRunId} historianConfig={historianConfig} onEnqueue={onEnqueue} onApplied={() => { useChronicleStore.getState().refreshAll(); setShowChronologyModal(false); }} />
      <EraNarrativeModal isOpen={eraNarrativeModal !== null} resumeNarrativeId={eraNarrativeModal?.narrativeId} onClose={() => { useIlluminatorModals.getState().closeEraNarrative(); refreshEraNarratives(); }} chronicleItems={chronicleItems} wizardEras={nav.wizardEras} projectId={projectId} simulationRunId={simulationRunId} historianConfig={historianConfig} onEnqueue={onEnqueue} styleLibrary={styleLibrary} />
      <BulkEraNarrativeModal isOpen={showBulkEraNarrative || bulkEraNarrativeProgress.status === "running"} onClose={() => { setShowBulkEraNarrative(false); refreshEraNarratives(); }} chronicleItems={chronicleItems} wizardEras={nav.wizardEras} eraTemporalInfo={nav.wizardEras} projectId={projectId} simulationRunId={simulationRunId} styleLibrary={styleLibrary} />
      <ChronicleWizard isOpen={showWizard} onClose={() => { setShowWizard(false); setWizardSeed(null); }} onGenerate={gen.handleWizardGenerate} narrativeStyles={styleLibrary?.narrativeStyles || []} entities={nav.wizardEntities} relationships={nav.wizardRelationships} events={nav.wizardEvents} entityKinds={worldData?.schema?.entityKinds || []} eras={nav.wizardEras} initialSeed={wizardSeed} simulationRunId={simulationRunId} />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default ChroniclePanel;
