/**
 * useChronicleGenerationCallbacks - Generation, regeneration, and lifecycle
 * callbacks for the selected chronicle.
 */

import { useState, useMemo, useCallback } from "react";
import { buildChronicleContext } from "../../lib/chronicleContextBuilder";
import { generateNameBank, extractCultureIds } from "../../lib/chronicle/nameBank";
import { getCallConfig } from "../../lib/llmModelSettings";
import {
  generateChronicleId,
  deriveTitleFromRoles,
  createChronicleShell,
  updateChronicleTemporalContext,
  updateChronicleActiveVersion,
  updateChronicleCombineInstructions,
  unpublishChronicle,
  deleteChronicleVersion,
  getChronicle,
  updateChronicleAssignedTone,
} from "../../lib/db/chronicleRepository";
import { useChronicleStore } from "../../lib/db/chronicleStore";
import { downloadChronicleExport } from "../../lib/chronicleExport";
import { computeTemporalContext } from "../../lib/chronicle/selectionWizard";
import { buildTemporalDescription } from "./chroniclePanelConstants";
import type {
  SelectedChronicleItem,
  WorldContext,
  WorldData,
  CultureIdentities,
  StyleSelection,
  RefinementState,
  WizardEra,
  WizardEvent,
} from "./chroniclePanelTypes";
import type { StyleLibrary } from "@canonry/world-schema";

interface Params {
  selectedItem: SelectedChronicleItem | undefined;
  worldContext: WorldContext;
  styleLibrary: StyleLibrary | null;
  chronicleWorldData: Record<string, unknown>;
  navEntities: Array<Record<string, unknown>> | null;
  worldData: WorldData;
  cultureIdentities: CultureIdentities;
  entityGuidance: Record<string, Record<string, unknown>>;
  generateSummary: (id: string, ctx: Record<string, unknown>) => void;
  generateTitle: (id: string) => void;
  regenerateWithSampling: (id: string) => void;
  regenerateFull: (id: string, ctx: Record<string, unknown>) => void;
  regenerateCreative: (id: string, ctx: Record<string, unknown>) => void;
  compareVersions: (id: string) => void;
  combineVersions: (id: string) => void;
  copyEdit: (id: string) => void;
  temporalCheck: (id: string) => void;
  quickCheck: (id: string) => void;
  acceptChronicle: (id: string) => Promise<unknown>;
  cancelChronicle: (id: string) => void;
  restartChronicle: (id: string) => Promise<void>;
  refreshChronicle: (id: string) => Promise<void>;
  onEnqueue: (items: Array<Record<string, unknown>>) => void;
  generateV2: (id: string, ctx: Record<string, unknown>, meta: Record<string, unknown>) => void;
  simulationRunId: string;
  refresh: () => Promise<void>;
  nameBank: Record<string, string[]>;
  setWizardSeed: (seed: Record<string, unknown> | null) => void;
  setShowWizard: (show: boolean) => void;
  nav: {
    selectedItemId: string | null;
    setSelectedItemId: (id: string | null) => void;
    wizardEras: WizardEra[];
    wizardEvents: WizardEvent[];
  };
  fullEntityMapRef: React.RefObject<Map<string, Record<string, unknown>>>;
}

export function useChronicleGenerationCallbacks(params: Params) {
  const {
    selectedItem, worldContext, styleLibrary, chronicleWorldData,
    navEntities, worldData, cultureIdentities, entityGuidance,
    generateSummary: genSummary, generateTitle: genTitle,
    regenerateWithSampling: regenSampling, regenerateFull: regenFull,
    regenerateCreative: regenCreative, compareVersions: compare,
    combineVersions: combine, copyEdit: editCopy,
    temporalCheck: tempCheck, quickCheck: qCheck,
    acceptChronicle, restartChronicle, refreshChronicle,
    onEnqueue, generateV2, simulationRunId, refresh, nameBank,
    setWizardSeed, setShowWizard, nav, fullEntityMapRef,
  } = params;

  const [showRestartModal, setShowRestartModal] = useState(false);
  const [pendingRestartId, setPendingRestartId] = useState<string | null>(null);

  const selectedNarrativeStyle = useMemo(() => {
    if (selectedItem?.narrativeStyle) return selectedItem.narrativeStyle;
    if (!selectedItem?.narrativeStyleId || !styleLibrary?.narrativeStyles) return null;
    return styleLibrary.narrativeStyles.find((s: { id: string }) => s.id === selectedItem.narrativeStyleId);
  }, [selectedItem?.narrativeStyle, selectedItem?.narrativeStyleId, styleLibrary]);

  const generationContext = useMemo(() => {
    if (!selectedItem || !selectedNarrativeStyle) return null;
    if (!worldContext?.toneFragments || !worldContext?.canonFactsWithMetadata) return null;
    try {
      const wc = {
        name: worldContext.name || "The World",
        description: worldContext.description || "",
        toneFragments: worldContext.toneFragments,
        canonFactsWithMetadata: worldContext.canonFactsWithMetadata,
        factSelection: worldContext.factSelection,
        worldDynamics: worldContext.worldDynamics,
      };
      const proseHints: Record<string, string> = {};
      for (const [kind, guidance] of Object.entries(entityGuidance || {})) {
        if (guidance?.proseHint) proseHints[kind] = guidance.proseHint as string;
      }
      if (selectedItem.type === "chronicles") {
        return buildChronicleContext(
          {
            roleAssignments: selectedItem.roleAssignments || [],
            selectedEventIds: selectedItem.selectedEventIds || [],
            selectedRelationshipIds: selectedItem.selectedRelationshipIds || [],
            entrypointId: selectedItem.entrypointId,
          },
          chronicleWorldData,
          wc,
          selectedNarrativeStyle,
          nameBank,
          proseHints,
          cultureIdentities?.descriptive,
        );
      }
    } catch (e) {
      console.error("Failed to build generation context:", e);
    }
    return null;
  }, [selectedItem, chronicleWorldData, worldContext, nameBank, entityGuidance, cultureIdentities, selectedNarrativeStyle]);

  const refinementState = useMemo((): RefinementState | null => {
    if (!selectedItem) return null;
    const isRunning = (step: string) =>
      params.nav.selectedItemId === selectedItem.chronicleId; // placeholder — real queue check is done in parent
    // We actually need the queue, but this is simplified
    return null; // Will be built in the parent
  }, [selectedItem]);

  const handleAcceptChronicle = useCallback(async () => {
    if (!selectedItem) return;
    await acceptChronicle(selectedItem.chronicleId);
  }, [selectedItem, acceptChronicle]);

  const handleGenerateSummary = useCallback(() => {
    if (!selectedItem || !generationContext) return;
    genSummary(selectedItem.chronicleId, generationContext);
  }, [selectedItem, generationContext, genSummary]);

  const handleGenerateTitle = useCallback(() => {
    if (!selectedItem) return;
    genTitle(selectedItem.chronicleId);
  }, [selectedItem, genTitle]);

  const handleAcceptPendingTitle = useCallback(async (chosenTitle: string) => {
    if (!selectedItem) return;
    const { acceptPendingTitle } = await import("../../lib/db/chronicleRepository");
    await acceptPendingTitle(selectedItem.chronicleId, chosenTitle || undefined);
    await refreshChronicle(selectedItem.chronicleId);
  }, [selectedItem, refreshChronicle]);

  const handleRejectPendingTitle = useCallback(async () => {
    if (!selectedItem) return;
    const { rejectPendingTitle } = await import("../../lib/db/chronicleRepository");
    await rejectPendingTitle(selectedItem.chronicleId);
    await refreshChronicle(selectedItem.chronicleId);
  }, [selectedItem, refreshChronicle]);

  const handleRegenerateWithSampling = useCallback(() => {
    if (!selectedItem) return;
    regenSampling(selectedItem.chronicleId);
  }, [selectedItem, regenSampling]);

  const buildRegenContext = useCallback(async () => {
    if (!selectedItem || !worldContext) return null;
    const liveStyle = styleLibrary?.narrativeStyles?.find((s: { id: string }) => s.id === selectedItem.narrativeStyleId);
    const narrativeStyle = liveStyle || selectedItem.narrativeStyle;
    if (!narrativeStyle || !worldContext?.toneFragments || !worldContext?.canonFactsWithMetadata) return null;

    const selections = {
      roleAssignments: selectedItem.roleAssignments || [],
      lens: selectedItem.lens,
      selectedEventIds: selectedItem.selectedEventIds || [],
      selectedRelationshipIds: selectedItem.selectedRelationshipIds || [],
      entrypointId: selectedItem.entrypointId,
    };
    const wc = {
      name: worldContext.name || "The World",
      description: worldContext.description || "",
      toneFragments: worldContext.toneFragments,
      canonFactsWithMetadata: worldContext.canonFactsWithMetadata,
      factSelection: worldContext.factSelection,
      worldDynamics: worldContext.worldDynamics,
    };
    const entityIds = (selectedItem.roleAssignments || []).map((r: { entityId: string }) => r.entityId);
    const selectedNavEntities = navEntities?.filter((e: { id: string }) => entityIds.includes(e.id)) || [];
    const cultureIds = extractCultureIds(selectedNavEntities);
    let regenNameBank: Record<string, string[]> = {};
    if (cultureIds.length > 0 && worldData?.schema?.cultures) {
      try { regenNameBank = await generateNameBank(worldData.schema.cultures, cultureIds); } catch { /* ignore */ }
    }
    return buildChronicleContext(selections, chronicleWorldData, wc, narrativeStyle, regenNameBank, worldContext?.proseHints, cultureIdentities?.descriptive, selectedItem.temporalContext);
  }, [selectedItem, chronicleWorldData, worldContext, styleLibrary, navEntities, worldData, cultureIdentities]);

  const handleRegenerateFull = useCallback(async () => {
    const context = await buildRegenContext();
    if (!context || !selectedItem) return;
    regenFull(selectedItem.chronicleId, context);
  }, [selectedItem, buildRegenContext, regenFull]);

  const handleRegenerateCreative = useCallback(async () => {
    const context = await buildRegenContext();
    if (!context || !selectedItem) return;
    regenCreative(selectedItem.chronicleId, context);
  }, [selectedItem, buildRegenContext, regenCreative]);

  const handleCompareVersions = useCallback(() => { if (selectedItem) compare(selectedItem.chronicleId); }, [selectedItem, compare]);
  const handleCombineVersions = useCallback(() => { if (selectedItem) combine(selectedItem.chronicleId); }, [selectedItem, combine]);
  const handleCopyEdit = useCallback(() => { if (selectedItem) editCopy(selectedItem.chronicleId); }, [selectedItem, editCopy]);
  const handleTemporalCheck = useCallback(() => { if (selectedItem) tempCheck(selectedItem.chronicleId); }, [selectedItem, tempCheck]);
  const handleQuickCheck = useCallback(() => { if (selectedItem) qCheck(selectedItem.chronicleId); }, [selectedItem, qCheck]);

  const handleRegenerate = useCallback(() => {
    if (!selectedItem) return;
    setPendingRestartId(selectedItem.chronicleId);
    setShowRestartModal(true);
  }, [selectedItem]);

  const handleRestartConfirm = useCallback(async () => {
    if (pendingRestartId) {
      const chronicle = await useChronicleStore.getState().loadChronicle(pendingRestartId);
      if (chronicle) {
        const liveStyle = styleLibrary?.narrativeStyles?.find((s: { id: string }) => s.id === chronicle.narrativeStyleId);
        setWizardSeed({
          narrativeStyleId: chronicle.narrativeStyleId,
          narrativeStyle: liveStyle || chronicle.narrativeStyle,
          entrypointId: chronicle.entrypointId,
          roleAssignments: chronicle.roleAssignments || [],
          lens: chronicle.lens,
          selectedEventIds: chronicle.selectedEventIds || [],
          selectedRelationshipIds: chronicle.selectedRelationshipIds || [],
        });
      }
      await restartChronicle(pendingRestartId);
      setShowWizard(true);
    }
    setShowRestartModal(false);
    setPendingRestartId(null);
  }, [pendingRestartId, restartChronicle, styleLibrary, setWizardSeed, setShowWizard]);

  const handleRestartCancel = useCallback(() => {
    setShowRestartModal(false);
    setPendingRestartId(null);
  }, []);

  const handleSetAssignedTone = useCallback(async (chronicleId: string, tone: string) => {
    await updateChronicleAssignedTone(chronicleId, tone);
    refreshChronicle(chronicleId);
  }, [refreshChronicle]);

  const handleDetectTone = useCallback(async (chronicleId: string, title: string) => {
    const record = await getChronicle(chronicleId);
    if (!record?.summary) return;
    onEnqueue([{
      entity: { id: chronicleId, name: title || "Chronicle", kind: "chronicle", subtype: "", prominence: "recognized", culture: "", status: "active", description: "", tags: {} },
      type: "toneRanking",
      prompt: JSON.stringify({ chronicleId, summary: record.summary, format: record.format || "story", narrativeStyleName: record.narrativeStyle?.name, brief: record.perspectiveSynthesis?.brief }),
      chronicleId,
    }]);
  }, [onEnqueue]);

  const handleUpdateTemporalContext = useCallback((focalEraId: string) => {
    if (!selectedItem?.chronicleId || !focalEraId) return;
    const availableEras = nav.wizardEras.length > 0 ? nav.wizardEras : selectedItem.temporalContext?.allEras || [];
    if (availableEras.length === 0) return;
    const focalEra = availableEras.find((era) => era.id === focalEraId);
    if (!focalEra) return;
    const selectedEventIdSet = new Set(selectedItem.selectedEventIds || []);
    const selectedEvents = nav.wizardEvents.filter((event) => selectedEventIdSet.has(event.id));
    const entrypointEntity = selectedItem.entrypointId ? fullEntityMapRef.current.get(selectedItem.entrypointId) : undefined;
    const entryPoint = entrypointEntity ? { createdAt: (entrypointEntity.createdAt as number) ?? 0 } : undefined;
    let nextContext = availableEras.length > 0 ? computeTemporalContext(selectedEvents, availableEras, entryPoint) : selectedItem.temporalContext;
    if (!nextContext) {
      nextContext = { focalEra, allEras: availableEras, chronicleTickRange: [0, 0] as [number, number], temporalScope: "moment", isMultiEra: false, touchedEraIds: [], temporalDescription: buildTemporalDescription(focalEra, [0, 0], "moment", false, 1) };
    }
    nextContext = { ...nextContext, focalEra, allEras: availableEras, temporalDescription: buildTemporalDescription(focalEra, nextContext.chronicleTickRange, nextContext.temporalScope, nextContext.isMultiEra, nextContext.touchedEraIds?.length || 0) };
    updateChronicleTemporalContext(selectedItem.chronicleId, nextContext).then(() => refreshChronicle(selectedItem.chronicleId));
  }, [selectedItem, nav.wizardEras, nav.wizardEvents, refreshChronicle, fullEntityMapRef]);

  const handleUpdateActiveVersion = useCallback((versionId: string) => {
    if (!selectedItem?.chronicleId || !versionId) return;
    updateChronicleActiveVersion(selectedItem.chronicleId, versionId).then(() => refreshChronicle(selectedItem.chronicleId));
  }, [selectedItem, refreshChronicle]);

  const handleDeleteVersion = useCallback((versionId: string) => {
    if (!selectedItem?.chronicleId || !versionId) return;
    deleteChronicleVersion(selectedItem.chronicleId, versionId).then(() => refreshChronicle(selectedItem.chronicleId));
  }, [selectedItem, refreshChronicle]);

  const handleUpdateCombineInstructions = useCallback((instructions: string) => {
    if (!selectedItem?.chronicleId) return;
    updateChronicleCombineInstructions(selectedItem.chronicleId, instructions || undefined).then(() => refreshChronicle(selectedItem.chronicleId));
  }, [selectedItem, refreshChronicle]);

  const handleUnpublish = useCallback(() => {
    if (!selectedItem?.chronicleId) return;
    unpublishChronicle(selectedItem.chronicleId).then(() => refreshChronicle(selectedItem.chronicleId));
  }, [selectedItem, refreshChronicle]);

  const handleExport = useCallback(() => {
    if (!selectedItem) return;
    useChronicleStore.getState().loadChronicle(selectedItem.chronicleId).then((chronicle) => {
      if (chronicle) downloadChronicleExport(chronicle);
    });
  }, [selectedItem]);

  const handleWizardGenerate = useCallback(async (wizardConfig: Record<string, unknown>) => {
    if (!worldContext?.toneFragments || !worldContext?.canonFactsWithMetadata) return;
    const narrativeStyle = wizardConfig.narrativeStyle || styleLibrary?.narrativeStyles?.find((s: { id: string }) => s.id === wizardConfig.narrativeStyleId);
    if (!narrativeStyle) return;
    const chronicleConfig = getCallConfig("chronicle.generation");
    const NORMAL_TOP_P = 1.0;
    const isLowSampling = ((chronicleConfig as Record<string, unknown>).topP as number ?? NORMAL_TOP_P) < NORMAL_TOP_P;
    const chronicleId = generateChronicleId();
    const selections = {
      roleAssignments: wizardConfig.roleAssignments,
      lens: wizardConfig.lens,
      selectedEventIds: wizardConfig.selectedEventIds,
      selectedRelationshipIds: wizardConfig.selectedRelationshipIds,
      entrypointId: wizardConfig.entryPointId,
    };
    const wc = { name: worldContext.name || "The World", description: worldContext.description || "", toneFragments: worldContext.toneFragments, canonFactsWithMetadata: worldContext.canonFactsWithMetadata, factSelection: worldContext.factSelection, worldDynamics: worldContext.worldDynamics };
    const entityIds = (wizardConfig.roleAssignments as Array<{ entityId: string }>).map((r) => r.entityId);
    const selectedEntities = navEntities?.filter((e: { id: string }) => entityIds.includes(e.id)) || [];
    const cultureIds = extractCultureIds(selectedEntities);
    let wizardNameBank: Record<string, string[]> = {};
    if (cultureIds.length > 0 && worldData?.schema?.cultures) {
      try { wizardNameBank = await generateNameBank(worldData.schema.cultures, cultureIds); } catch { /* ignore */ }
    }
    const proseHints: Record<string, string> = {};
    for (const [kind, guidance] of Object.entries(entityGuidance || {})) {
      if (guidance?.proseHint) proseHints[kind] = guidance.proseHint as string;
    }
    const context = buildChronicleContext(selections, chronicleWorldData, wc, narrativeStyle, wizardNameBank, proseHints, cultureIdentities?.descriptive, wizardConfig.temporalContext, wizardConfig.narrativeDirection);
    const title = deriveTitleFromRoles(wizardConfig.roleAssignments as Array<Record<string, unknown>>);
    const selectedEntityIds = (wizardConfig.roleAssignments as Array<{ entityId: string }>).map((r) => r.entityId);
    if (wizardConfig.lens && !(selectedEntityIds as string[]).includes((wizardConfig.lens as { entityId: string }).entityId)) {
      selectedEntityIds.push((wizardConfig.lens as { entityId: string }).entityId);
    }
    const chronicleMetadata = {
      chronicleId, title, format: (narrativeStyle as Record<string, unknown>).format,
      roleAssignments: wizardConfig.roleAssignments, lens: wizardConfig.lens,
      narrativeStyleId: wizardConfig.narrativeStyleId, narrativeStyle,
      selectedEntityIds, selectedEventIds: wizardConfig.selectedEventIds,
      selectedRelationshipIds: wizardConfig.selectedRelationshipIds,
      entrypointId: wizardConfig.entryPointId, temporalContext: wizardConfig.temporalContext,
      generationSampling: isLowSampling ? "low" : "normal", narrativeDirection: wizardConfig.narrativeDirection,
    };
    try {
      await createChronicleShell(chronicleId, {
        projectId: simulationRunId ? simulationRunId.split("_")[0] : "unknown",
        simulationRunId: simulationRunId || "unknown",
        model: "pending", title, format: (narrativeStyle as Record<string, unknown>).format,
        narrativeStyleId: wizardConfig.narrativeStyleId, narrativeStyle,
        roleAssignments: wizardConfig.roleAssignments, lens: wizardConfig.lens,
        selectedEntityIds, selectedEventIds: wizardConfig.selectedEventIds,
        selectedRelationshipIds: wizardConfig.selectedRelationshipIds,
        entrypointId: wizardConfig.entryPointId, temporalContext: wizardConfig.temporalContext,
        generationSampling: isLowSampling ? "low" : "normal", narrativeDirection: wizardConfig.narrativeDirection,
      });
      await refresh();
    } catch (err) {
      console.error("[Chronicle Wizard] Failed to create shell record:", err);
    }
    generateV2(chronicleId, context, chronicleMetadata);
    nav.setSelectedItemId(chronicleId);
    setShowWizard(false);
  }, [chronicleWorldData, worldContext, styleLibrary, generateV2, simulationRunId, refresh, entityGuidance, cultureIdentities, worldData, navEntities, nav, setShowWizard]);

  // Build review panel props helper
  const buildReviewPanelProps = useCallback((
    item: SelectedChronicleItem | undefined,
    imgCallbacks: Record<string, unknown>,
    isGenerating: boolean,
    navState: { wizardEras: WizardEra[]; wizardEvents: WizardEvent[] },
    histConfigured: boolean,
    isHistActive: boolean,
    onHistReview: ((id: string, tone: string) => void) | undefined,
    onBackport: ((id: string) => void) | undefined,
    onUpdateHistNote: (noteId: string) => void,
    onOpenImgSettings: () => void,
    imgModel: string,
    onNavToTab: (tab: string) => void,
  ) => {
    if (!item || (item.status !== "assembly_ready" && item.status !== "complete")) return null;

    // Build refinement state inline (needs queue from parent)
    return {
      item,
      onAddImages: imgCallbacks.handleGenerateImageRefs as () => void,
      onAccept: () => void handleAcceptChronicle(),
      onRegenerate: handleRegenerate,
      onGenerateSummary: handleGenerateSummary,
      onGenerateTitle: handleGenerateTitle,
      onAcceptPendingTitle: (t: string) => void handleAcceptPendingTitle(t),
      onRejectPendingTitle: () => void handleRejectPendingTitle(),
      onGenerateImageRefs: imgCallbacks.handleGenerateImageRefs as () => void,
      onGenerateCoverImageScene: imgCallbacks.handleGenerateCoverImageScene as () => void,
      onGenerateCoverImage: imgCallbacks.handleGenerateCoverImage as () => void,
      styleSelection: {} as StyleSelection, // filled by parent
      imageSize: "",
      imageQuality: "",
      imageModel: imgModel,
      imageGenSettings: {} as Record<string, unknown>,
      onOpenImageSettings: onOpenImgSettings,
      onRegenerateWithSampling: handleRegenerateWithSampling,
      onRegenerateFull: () => void handleRegenerateFull(),
      onRegenerateCreative: item.narrativeStyle?.format === "story" ? () => void handleRegenerateCreative() : undefined,
      onCompareVersions: handleCompareVersions,
      onCombineVersions: handleCombineVersions,
      onCopyEdit: handleCopyEdit,
      onTemporalCheck: handleTemporalCheck,
      onQuickCheck: handleQuickCheck,
      onGenerateChronicleImage: imgCallbacks.handleGenerateChronicleImage,
      onResetChronicleImage: imgCallbacks.handleResetChronicleImage,
      onRegenerateDescription: imgCallbacks.handleRegenerateDescription,
      onUpdateChronicleAnchorText: imgCallbacks.handleUpdateChronicleAnchorText,
      onUpdateChronicleImageSize: imgCallbacks.handleUpdateChronicleImageSize,
      onUpdateChronicleImageJustification: imgCallbacks.handleUpdateChronicleImageJustification,
      onApplyImageRefSelections: imgCallbacks.handleApplyImageRefSelections,
      onSelectExistingImage: imgCallbacks.handleSelectExistingImage,
      onSelectExistingCoverImage: imgCallbacks.handleSelectExistingCoverImage,
      onUpdateChronicleTemporalContext: handleUpdateTemporalContext,
      onUpdateChronicleActiveVersion: handleUpdateActiveVersion,
      onDeleteVersion: handleDeleteVersion,
      onUpdateCombineInstructions: handleUpdateCombineInstructions,
      onUnpublish: handleUnpublish,
      onExport: handleExport,
      onBackportLore: onBackport ? () => void onBackport(item.chronicleId) : undefined,
      onHistorianReview: onHistReview && histConfigured && item.status === "complete" ? (tone: string) => onHistReview(item.chronicleId, tone) : undefined,
      onSetAssignedTone: (tone: string) => handleSetAssignedTone(item.chronicleId, tone),
      onDetectTone: item.summary ? () => handleDetectTone(item.chronicleId, item.name) : undefined,
      isHistorianActive: isHistActive,
      onUpdateHistorianNote: onUpdateHistNote,
      onGeneratePrep: undefined, // Will be built in parent
      isGenerating,
      refinements: null, // Built in parent
      simulationRunId: "",
      worldSchema: { entityKinds: [], cultures: [] },
      entities: [],
      styleLibrary: null,
      cultures: undefined,
      entityGuidance: {},
      cultureIdentities: {},
      worldContext: {} as WorldContext,
      eras: navState.wizardEras,
      events: navState.wizardEvents,
      onNavigateToTab: onNavToTab,
    };
  }, [
    handleAcceptChronicle, handleRegenerate, handleGenerateSummary, handleGenerateTitle,
    handleAcceptPendingTitle, handleRejectPendingTitle, handleRegenerateWithSampling,
    handleRegenerateFull, handleRegenerateCreative, handleCompareVersions,
    handleCombineVersions, handleCopyEdit, handleTemporalCheck, handleQuickCheck,
    handleUpdateTemporalContext, handleUpdateActiveVersion, handleDeleteVersion,
    handleUpdateCombineInstructions, handleUnpublish, handleExport,
    handleSetAssignedTone, handleDetectTone,
  ]);

  return {
    generationContext,
    selectedNarrativeStyle,
    showRestartModal,
    handleRegenerate,
    handleRestartConfirm,
    handleRestartCancel,
    handleAcceptChronicle,
    handleGenerateSummary,
    handleGenerateTitle,
    handleAcceptPendingTitle,
    handleRejectPendingTitle,
    handleRegenerateWithSampling,
    handleRegenerateFull,
    handleRegenerateCreative,
    handleCompareVersions,
    handleCombineVersions,
    handleCopyEdit,
    handleTemporalCheck,
    handleQuickCheck,
    handleSetAssignedTone,
    handleDetectTone,
    handleUpdateTemporalContext,
    handleUpdateActiveVersion,
    handleDeleteVersion,
    handleUpdateCombineInstructions,
    handleUnpublish,
    handleExport,
    handleWizardGenerate,
    buildReviewPanelProps,
  };
}
