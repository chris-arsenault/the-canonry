/**
 * useProjectPersistence - Data persistence effects for the Canonry shell.
 *
 * Handles: project data loading, simulation auto-save, world context/guidance
 * debounced saves, and search-run scoring.
 */

import { useEffect, useCallback, type MutableRefObject, type Dispatch, type SetStateAction } from "react";
import {
  loadWorldStore,
  saveWorldData,
  saveWorldContext,
  saveEntityGuidance,
  saveCultureIdentities,
  saveEnrichmentConfig,
  saveStyleSelection,
  saveHistorianConfig,
  getSlots,
  getSlot,
  saveSlot,
  setActiveSlotIndex as persistActiveSlotIndex,
} from "../storage/worldStore";
import { extractLoreDataWithCurrentImageRefs } from "../lib/bundleExportUtils";

interface ArchivistData {
  worldData: unknown;
  loreData: unknown;
}

interface UseProjectPersistenceParams {
  currentProject: unknown;
  slots: Record<number, Record<string, unknown>>;
  setSlots: Dispatch<SetStateAction<Record<number, Record<string, unknown>>>>;
  activeSlotIndex: number;
  setActiveSlotIndex: Dispatch<SetStateAction<number>>;
  simulationResults: unknown;
  setSimulationResults: Dispatch<SetStateAction<unknown>>;
  simulationState: unknown;
  setSimulationState: Dispatch<SetStateAction<unknown>>;
  archivistData: ArchivistData | null;
  setArchivistData: Dispatch<SetStateAction<ArchivistData | null>>;
  worldContext: unknown;
  setWorldContext: Dispatch<SetStateAction<unknown>>;
  entityGuidance: unknown;
  setEntityGuidance: Dispatch<SetStateAction<unknown>>;
  cultureIdentities: unknown;
  setCultureIdentities: Dispatch<SetStateAction<unknown>>;
  enrichmentConfig: unknown;
  setEnrichmentConfig: Dispatch<SetStateAction<unknown>>;
  styleSelection: unknown;
  setStyleSelection: Dispatch<SetStateAction<unknown>>;
  historianConfig: unknown;
  setHistorianConfig: Dispatch<SetStateAction<unknown>>;
  simulationOwnerRef: MutableRefObject<string | null>;
  isLoadingSlotRef: MutableRefObject<boolean>;
  lastSavedResultsRef: MutableRefObject<unknown>;
  bestRunScoreRef: MutableRefObject<number>;
  bestRunSaveQueueRef: MutableRefObject<Promise<void>>;
  reloadProjectFromDefaults: () => Promise<void>;
  save: (data: Record<string, unknown>) => void;
}

export function useProjectPersistence(params: UseProjectPersistenceParams): void {
  const {
    currentProject, slots, setSlots, activeSlotIndex, setActiveSlotIndex,
    simulationResults, setSimulationResults, simulationState, setSimulationState,
    archivistData, setArchivistData,
    worldContext, setWorldContext, entityGuidance, setEntityGuidance,
    cultureIdentities, setCultureIdentities,
    enrichmentConfig, setEnrichmentConfig, styleSelection, setStyleSelection,
    historianConfig, setHistorianConfig,
    simulationOwnerRef, isLoadingSlotRef, lastSavedResultsRef,
    bestRunScoreRef, bestRunSaveQueueRef,
  } = params;

  const projectId = (currentProject as Record<string, unknown>)?.id as string | undefined;

  // Track best run score from slots
  useEffect(() => {
    const score = (slots[1] as Record<string, unknown>)?.runScore;
    bestRunScoreRef.current = typeof score === "number" ? score : -Infinity;
  }, [slots, bestRunScoreRef]);

  // Load project data when project changes
  useEffect(() => {
    let cancelled = false;
    if (!projectId) {
      simulationOwnerRef.current = null;
      setSimulationResults(null);
      setSimulationState(null);
      setArchivistData(null);
      setSlots({});
      setActiveSlotIndex(0);
      return undefined;
    }
    simulationOwnerRef.current = null;
    isLoadingSlotRef.current = false;
    lastSavedResultsRef.current = null;
    setSimulationResults(null);
    setSimulationState(null);
    setArchivistData(null);
    setWorldContext(null);
    setEntityGuidance(null);
    setCultureIdentities(null);
    setEnrichmentConfig(null);
    setStyleSelection(null);
    setHistorianConfig(null);
    setSlots({});
    setActiveSlotIndex(0);

    Promise.all([loadWorldStore(projectId), getSlots(projectId)]).then(
      ([store, loadedSlots]) => {
        if (cancelled) return;
        simulationOwnerRef.current = projectId;
        const loadedActiveIndex = store?.activeSlotIndex ?? 0;
        setSlots(loadedSlots);
        setActiveSlotIndex(loadedActiveIndex);

        const activeSlot = loadedSlots[loadedActiveIndex];
        isLoadingSlotRef.current = Boolean(
          activeSlot?.simulationResults || activeSlot?.simulationState || activeSlot?.worldData,
        );
        if (activeSlot) {
          lastSavedResultsRef.current = activeSlot.simulationResults || null;
          setSimulationResults(activeSlot.simulationResults || null);
          setSimulationState(activeSlot.simulationState || null);
          if (activeSlot.worldData) {
            extractLoreDataWithCurrentImageRefs(activeSlot.worldData).then((loreData) => {
              if (cancelled) return;
              setArchivistData({ worldData: activeSlot.worldData, loreData });
            });
          }
        }
        if (store?.worldContext) setWorldContext(store.worldContext);
        if (store?.entityGuidance) setEntityGuidance(store.entityGuidance);
        if (store?.cultureIdentities) setCultureIdentities(store.cultureIdentities);
        if (store?.enrichmentConfig) setEnrichmentConfig(store.enrichmentConfig);
        if (store?.styleSelection) setStyleSelection(store.styleSelection);
        if (store?.historianConfig) setHistorianConfig(store.historianConfig);
      },
    );
    return () => { cancelled = true; };
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save simulation results to scratch slot
  useEffect(() => {
    if (!projectId) return;
    if (simulationOwnerRef.current !== projectId) return;
    if (!simulationResults && !simulationState) return;
    const status = (simulationState as Record<string, unknown>)?.status;
    if (status && status !== "complete" && status !== "error") return;
    if (isLoadingSlotRef.current) {
      isLoadingSlotRef.current = false;
      return;
    }
    const isNewSimulation = Boolean(
      simulationResults && simulationResults !== lastSavedResultsRef.current,
    );
    const worldData = simulationResults ?? null;
    const now = Date.now();
    let cancelled = false;

    const persist = async () => {
      const existingSlot = (await getSlot(projectId, 0)) || {};
      let title = existingSlot.title || "Scratch";
      let createdAt = existingSlot.createdAt || now;
      if (isNewSimulation && (simulationResults as Record<string, unknown>)?.hardState) {
        const entityCount = ((simulationResults as Record<string, unknown>).hardState as unknown[]).length;
        const date = new Date(now);
        const timeStr = date.toLocaleString("en-US", {
          month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
        });
        title = `Run - ${timeStr} (${entityCount} entities)`;
        createdAt = now;
      }
      const slotData = { ...existingSlot, simulationResults, simulationState, worldData, title, createdAt };
      await saveSlot(projectId, 0, slotData);
      await persistActiveSlotIndex(projectId, 0);
      if (cancelled) return;
      setSlots((prev) => ({ ...prev, 0: slotData }));
      lastSavedResultsRef.current = simulationResults || null;
      if (worldData) {
        extractLoreDataWithCurrentImageRefs(worldData).then((loreData) => {
          if (cancelled) return;
          setArchivistData({ worldData, loreData });
        });
      }
      setActiveSlotIndex(0);
    };
    persist().catch((err) => console.error("Failed to save simulation results:", err));
    return () => { cancelled = true; };
  }, [projectId, simulationResults, simulationState]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist archivistData world data
  useEffect(() => {
    if (!projectId || !archivistData?.worldData) return;
    saveWorldData(projectId, archivistData.worldData);
  }, [projectId, archivistData]);

  // Debounced persistence for world context
  useEffect(() => {
    if (!projectId || !worldContext) return;
    const timeoutId = setTimeout(() => saveWorldContext(projectId, worldContext), 300);
    return () => clearTimeout(timeoutId);
  }, [projectId, worldContext]);

  // Debounced persistence for entity guidance
  useEffect(() => {
    if (!projectId || !entityGuidance) return;
    const timeoutId = setTimeout(() => saveEntityGuidance(projectId, entityGuidance), 300);
    return () => clearTimeout(timeoutId);
  }, [projectId, entityGuidance]);

  // Debounced persistence for culture identities
  useEffect(() => {
    if (!projectId || !cultureIdentities) return;
    const timeoutId = setTimeout(() => saveCultureIdentities(projectId, cultureIdentities), 300);
    return () => clearTimeout(timeoutId);
  }, [projectId, cultureIdentities]);

  // Debounced persistence for enrichment config
  useEffect(() => {
    if (!projectId || !enrichmentConfig) return;
    const timeoutId = setTimeout(() => saveEnrichmentConfig(projectId, enrichmentConfig), 300);
    return () => clearTimeout(timeoutId);
  }, [projectId, enrichmentConfig]);

  // Debounced persistence for style selection
  useEffect(() => {
    if (!projectId || !styleSelection) return;
    const timeoutId = setTimeout(() => saveStyleSelection(projectId, styleSelection), 300);
    return () => clearTimeout(timeoutId);
  }, [projectId, styleSelection]);

  // Debounced persistence for historian config
  useEffect(() => {
    if (!projectId || !historianConfig) return;
    const timeoutId = setTimeout(() => saveHistorianConfig(projectId, historianConfig), 300);
    return () => clearTimeout(timeoutId);
  }, [projectId, historianConfig]);
}
