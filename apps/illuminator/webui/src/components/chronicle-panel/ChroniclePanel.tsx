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
import { getEraNarrativesForSimulation } from "../../lib/db/eraNarrativeRepository";
import { useIlluminatorModals } from "../../lib/db/modalStore";
import { buildEraNarrativeNavItem } from "../../lib/db/eraNarrativeNav";
import ChronologyModal from "../ChronologyModal";
import EraNarrativeModal from "../EraNarrativeModal";

import { ChronicleFilterBar } from "./ChronicleFilterBar";
import { ChronicleNavList } from "./ChronicleNavList";
import { ChronicleDetailPanel } from "./ChronicleDetailPanel";
import { RestartModal } from "./ChroniclePanelModals";
import { useChronicleImageCallbacks } from "./useChronicleImageCallbacks";
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
  refreshTrigger,
  imageModel,
  onOpenImageSettings,
  onHistorianReview,
  isHistorianActive,
  historianConfigured,
  historianConfig,
  onUpdateHistorianNote,
  onNavigateToTab,
}: Readonly<ChroniclePanelProps>) {
  const navEntities = useEntityNavList();
  const entityNavMap = useEntityNavItems();
  const [fullEntities, setFullEntities] = useState<PersistedEntity[]>([]);
  const fullEntityMapRef = useRef<Map<string, PersistedEntity>>(new Map());
  const relationships = useRelationships();
  const narrativeEvents = useNarrativeEvents();
  const [showChronologyModal, setShowChronologyModal] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardSeed, setWizardSeed] = useState<Record<string, unknown> | null>(null);
  const [nameBank, setNameBank] = useState<Record<string, string[]>>({});

  const eraNarrativeModal = useIlluminatorModals((s) => s.eraNarrativeModal);
  const [eraNarrativeNavItems, setEraNarrativeNavItems] = useState<Array<Record<string, unknown>>>([]);

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
    worldContext, chronicleImageSize, chronicleImageQuality, imageModel,
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
      <ChronologyModal isOpen={showChronologyModal} onClose={() => setShowChronologyModal(false)} chronicleItems={chronicleItems} wizardEras={nav.wizardEras} wizardEvents={nav.wizardEvents} projectId={projectId} simulationRunId={simulationRunId} historianConfig={historianConfig} onEnqueue={onEnqueue} onApplied={() => { void useChronicleStore.getState().refreshAll(); setShowChronologyModal(false); }} />
      <EraNarrativeModal isOpen={eraNarrativeModal !== null} resumeNarrativeId={eraNarrativeModal?.narrativeId} onClose={() => { useIlluminatorModals.getState().closeEraNarrative(); refreshEraNarratives(); }} chronicleItems={chronicleItems} wizardEras={nav.wizardEras} projectId={projectId} simulationRunId={simulationRunId} historianConfig={historianConfig} onEnqueue={onEnqueue} styleLibrary={styleLibrary} />
      <ChronicleWizard isOpen={showWizard} onClose={() => { setShowWizard(false); setWizardSeed(null); }} onGenerate={(cfg: Record<string, unknown>) => void gen.handleWizardGenerate(cfg)} narrativeStyles={styleLibrary?.narrativeStyles || []} entities={nav.wizardEntities} relationships={nav.wizardRelationships} events={nav.wizardEvents} entityKinds={worldData?.schema?.entityKinds || []} eras={nav.wizardEras} initialSeed={wizardSeed} simulationRunId={simulationRunId} />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default ChroniclePanel;
