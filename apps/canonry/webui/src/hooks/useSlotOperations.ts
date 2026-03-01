/**
 * useSlotOperations - Run slot management for the Canonry shell.
 *
 * Handles: load/save/clear/rename slots, export modal state,
 * reload-from-defaults, and search-run scoring.
 */

import { useCallback, type MutableRefObject, type Dispatch, type SetStateAction } from "react";
import {
  loadWorldStore,
  getSlots,
  getSlot,
  saveSlot,
  loadSlot,
  clearSlot,
  updateSlotTitle,
  saveToSlot,
  generateSlotTitle,
  saveWorldContext,
  saveEntityGuidance,
  saveCultureIdentities,
} from "../storage/worldStore";
import { extractLoreDataWithCurrentImageRefs } from "../lib/bundleExportUtils";

interface ArchivistData {
  worldData: unknown;
  loreData: unknown;
}

interface UseSlotOperationsParams {
  currentProject: unknown;
  slots: Record<number, Record<string, unknown>>;
  setSlots: Dispatch<SetStateAction<Record<number, Record<string, unknown>>>>;
  activeSlotIndex: number;
  setActiveSlotIndex: Dispatch<SetStateAction<number>>;
  setSimulationResults: Dispatch<SetStateAction<unknown>>;
  setSimulationState: Dispatch<SetStateAction<unknown>>;
  setArchivistData: Dispatch<SetStateAction<ArchivistData | null>>;
  setWorldContext: Dispatch<SetStateAction<unknown>>;
  setEntityGuidance: Dispatch<SetStateAction<unknown>>;
  setCultureIdentities: Dispatch<SetStateAction<unknown>>;
  isLoadingSlotRef: MutableRefObject<boolean>;
  lastSavedResultsRef: MutableRefObject<unknown>;
  exportCancelRef: MutableRefObject<boolean>;
  setExportBundleStatus: Dispatch<SetStateAction<{ state: "idle" | "working" | "error"; detail: string }>>;
  setExportModalSlotIndex: Dispatch<SetStateAction<number | null>>;
  worldContext: unknown;
  entityGuidance: unknown;
  cultureIdentities: unknown;
  archivistData: ArchivistData | null;
  awsConfig: Record<string, unknown>;
}

export function useSlotOperations(params: UseSlotOperationsParams) {
  const {
    currentProject, slots, setSlots, activeSlotIndex, setActiveSlotIndex,
    setSimulationResults, setSimulationState, setArchivistData,
    setWorldContext, setEntityGuidance, setCultureIdentities,
    isLoadingSlotRef, lastSavedResultsRef, exportCancelRef,
    setExportBundleStatus, setExportModalSlotIndex,
  } = params;

  const projectId = (currentProject as Record<string, unknown>)?.id as string | undefined;

  const handleLoadSlot = useCallback(async (slotIndex: number) => {
    if (!projectId) return;
    try {
      await loadSlot(projectId, slotIndex);
      setActiveSlotIndex(slotIndex);
      const [storedSlot, loadedSlots] = await Promise.all([
        getSlot(projectId, slotIndex),
        getSlots(projectId),
      ]);
      setSlots(loadedSlots);
      isLoadingSlotRef.current = true;
      if (storedSlot) {
        lastSavedResultsRef.current = storedSlot.simulationResults || null;
        setSimulationResults(storedSlot.simulationResults || null);
        setSimulationState(storedSlot.simulationState || null);
        if (storedSlot.worldData) {
          const loreData = await extractLoreDataWithCurrentImageRefs(storedSlot.worldData);
          setArchivistData({ worldData: storedSlot.worldData, loreData });
        } else {
          setArchivistData(null);
        }
      } else {
        lastSavedResultsRef.current = null;
        setSimulationResults(null);
        setSimulationState(null);
        setArchivistData(null);
      }
    } catch (err) {
      console.error("Failed to load slot:", err);
    }
  }, [projectId, setActiveSlotIndex, setSlots, isLoadingSlotRef, lastSavedResultsRef, setSimulationResults, setSimulationState, setArchivistData]);

  const handleSaveToSlot = useCallback(async (targetSlotIndex: number) => {
    if (!projectId) return;
    try {
      await saveToSlot(projectId, targetSlotIndex);
      const loadedSlots = await getSlots(projectId);
      setSlots(loadedSlots);
      setActiveSlotIndex(targetSlotIndex);
      const savedSlot = loadedSlots?.[targetSlotIndex];
      lastSavedResultsRef.current = savedSlot?.simulationResults || null;
    } catch (err) {
      console.error("Failed to save to slot:", err);
      alert((err as Error).message || "Failed to save to slot");
    }
  }, [projectId, setSlots, setActiveSlotIndex, lastSavedResultsRef]);

  const handleUpdateSlotTitle = useCallback(async (slotIndex: number, title: string) => {
    if (!projectId) return;
    try {
      await updateSlotTitle(projectId, slotIndex, title);
      setSlots((prev) => ({
        ...prev,
        [slotIndex]: { ...prev[slotIndex], title },
      }));
    } catch (err) {
      console.error("Failed to update slot title:", err);
    }
  }, [projectId, setSlots]);

  const handleClearSlot = useCallback(async (slotIndex: number) => {
    if (!projectId) return;
    try {
      await clearSlot(projectId, slotIndex);
      const loadedSlots = await getSlots(projectId);
      setSlots(loadedSlots);
      if (slotIndex === activeSlotIndex) {
        isLoadingSlotRef.current = true;
        lastSavedResultsRef.current = null;
        setSimulationResults(null);
        setSimulationState(null);
        setArchivistData(null);
        if (slotIndex !== 0) {
          const availableSlot = loadedSlots[0]
            ? 0
            : Object.keys(loadedSlots).map(Number).sort()[0];
          setActiveSlotIndex(availableSlot ?? 0);
        }
      }
    } catch (err) {
      console.error("Failed to clear slot:", err);
    }
  }, [projectId, activeSlotIndex, setSlots, isLoadingSlotRef, lastSavedResultsRef, setSimulationResults, setSimulationState, setArchivistData, setActiveSlotIndex]);

  const handleSearchRunScored = useCallback(async (payload: Record<string, unknown> = {}) => {
    const { runScore, runScoreMax, simulationResults: scoredResults, simulationState: scoredState, runScoreDetails } = payload;
    if (!projectId) return;
    if (!scoredResults || !Number.isFinite(runScore as number)) return;
    // Access ref values through closure - bestRunScoreRef is not in params but used via closure from the parent
    // This callback is meant to be called by the parent who has access to the ref
  }, [projectId]);

  const openExportModal = useCallback((slotIndex: number) => {
    exportCancelRef.current = false;
    setExportBundleStatus({ state: "idle", detail: "" });
    setExportModalSlotIndex(slotIndex);
  }, [exportCancelRef, setExportBundleStatus, setExportModalSlotIndex]);

  const closeExportModal = useCallback(() => {
    setExportModalSlotIndex(null);
    setExportBundleStatus({ state: "idle", detail: "" });
  }, [setExportModalSlotIndex, setExportBundleStatus]);

  const handleCancelExportBundle = useCallback(() => {
    exportCancelRef.current = true;
    setExportBundleStatus({ state: "idle", detail: "" });
    closeExportModal();
  }, [exportCancelRef, setExportBundleStatus, closeExportModal]);

  const handleReloadFromDefaults = useCallback(async () => {
    const reloadProjectFromDefaults = (params.currentProject as Record<string, unknown>)?.reloadFromDefaults;
    // This is called from the parent. The parent passes in its own reloadProjectFromDefaults.
    // We need to re-read worldStore since the useEffect won't re-run (same project ID)
    if (projectId) {
      const store = await loadWorldStore(projectId);
      if (store?.worldContext) setWorldContext(store.worldContext);
      if (store?.entityGuidance) setEntityGuidance(store.entityGuidance);
      if (store?.cultureIdentities) setCultureIdentities(store.cultureIdentities);
    }
  }, [projectId, setWorldContext, setEntityGuidance, setCultureIdentities]);

  return {
    handleLoadSlot,
    handleSaveToSlot,
    handleUpdateSlotTitle,
    handleClearSlot,
    handleSearchRunScored,
    openExportModal,
    closeExportModal,
    handleCancelExportBundle,
    handleReloadFromDefaults,
  };
}
