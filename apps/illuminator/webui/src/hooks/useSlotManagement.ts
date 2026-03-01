import { useState, useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import * as slotRepo from "../lib/db/slotRepository";
import { useEntityStore } from "../lib/db/entityStore";
import { useIndexStore } from "../lib/db/indexStore";
import { useNarrativeEventStore } from "../lib/db/narrativeEventStore";
import { useRelationshipStore } from "../lib/db/relationshipStore";
import {
  useEraTemporalInfo,
  useEraTemporalInfoByKey,
  useProminentByCulture,
} from "../lib/db/indexSelectors";
import type { SimulationSlotRecord, PersistedEntity } from "../lib/db/illuminatorDb";
import type { EntityNavItem } from "../lib/db/entityNav";
import type { EraTemporalEntry } from "../lib/db/indexTypes";

// --- Types ---

interface EraInfo {
  name: string;
  description?: string;
}

interface ProjectSlotState {
  projectId: string | null;
  activeSlotIndex: number;
}

export interface UseSlotManagementParams {
  projectId: string | null;
  activeSlotIndex: number;
  navEntities: EntityNavItem[];
}

export interface UseSlotManagementReturn {
  slotRecord: SimulationSlotRecord | null;
  setSlotRecord: Dispatch<SetStateAction<SimulationSlotRecord | null>>;
  simulationRunId: string | null | undefined;
  currentEra: EraInfo | null;
  eraTemporalInfo: EraTemporalEntry[];
  eraTemporalInfoByKey: Map<string, EraTemporalEntry>;
  prominentByCulture: Record<string, Array<{ id: string; name: string }>>;
}

// --- Module-level helpers ---

function resolveCurrentEra(slotRecord: SimulationSlotRecord | null, navEntities: EntityNavItem[]) {
  const eraId = slotRecord?.finalEraId;
  if (!eraId) return { era: null, needsFullLoad: null };
  const eraNav = navEntities.find(
    (entity) =>
      entity.kind === "era" &&
      (entity.id === eraId || entity.eraId === eraId || entity.name === eraId)
  );
  if (!eraNav) return { era: { name: eraId }, needsFullLoad: null };
  return { era: null, needsFullLoad: eraNav.id };
}

function resolveEraRenderAdjustment(slotRecord: SimulationSlotRecord | null, navEntities: EntityNavItem[]) {
  const resolved = resolveCurrentEra(slotRecord, navEntities);
  if (resolved.era !== undefined && resolved.needsFullLoad === null) {
    return { changed: true, era: resolved.era };
  }
  return { changed: false };
}

function buildEraFromLoadedEntity(full: PersistedEntity | null, fallbackId: string): EraInfo {
  return full ? { name: full.name, description: full.description } : { name: fallbackId };
}

function resolveProjectSlotChange(projectId: string | null, prevProjectSlot: ProjectSlotState, activeSlotIndex: number) {
  if (
    projectId !== prevProjectSlot.projectId ||
    activeSlotIndex !== prevProjectSlot.activeSlotIndex
  ) {
    if (!projectId) {
      return { changed: true, clearSlot: true };
    }
    return { changed: true, clearSlot: false };
  }
  return { changed: false };
}

export default function useSlotManagement({ projectId, activeSlotIndex, navEntities }: UseSlotManagementParams): UseSlotManagementReturn {
  const [slotRecord, setSlotRecord] = useState<SimulationSlotRecord | null>(null);

  // Adjust state during render when projectId changes (avoids setState-in-effect)
  const [prevProjectSlot, setPrevProjectSlot] = useState<ProjectSlotState>({ projectId, activeSlotIndex });
  const projectSlotChange = resolveProjectSlotChange(projectId, prevProjectSlot, activeSlotIndex);
  if (projectSlotChange.changed) {
    setPrevProjectSlot({ projectId, activeSlotIndex });
    if (projectSlotChange.clearSlot) setSlotRecord(null);
  }

  // Load slot metadata from Dexie (async work stays in effect)
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    void (async () => {
      const slot = await slotRepo.getSlot(projectId, activeSlotIndex);
      if (cancelled) return;
      setSlotRecord(slot || null);
      useEntityStore.getState().reset();
      useIndexStore.getState().reset();
      useNarrativeEventStore.getState().reset();
      useRelationshipStore.getState().reset();
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, activeSlotIndex]);

  const [currentEra, setCurrentEra] = useState<EraInfo | null>(null);

  // Adjust current era during render for synchronous cases
  const [prevEraKey, setPrevEraKey] = useState<string | null | undefined>(slotRecord?.finalEraId);
  const currentEraId = slotRecord?.finalEraId;
  if (currentEraId !== prevEraKey) {
    setPrevEraKey(currentEraId);
    const result = resolveEraRenderAdjustment(slotRecord, navEntities);
    if (result.changed) setCurrentEra(result.era);
  }

  // Async full-entity load for era (when we have a nav match but need description)
  useEffect(() => {
    const resolved = resolveCurrentEra(slotRecord, navEntities);
    if (!resolved.needsFullLoad) return;
    void useEntityStore
      .getState()
      .loadEntity(resolved.needsFullLoad)
      .then((full: PersistedEntity | null) => {
        setCurrentEra(buildEraFromLoadedEntity(full, resolved.needsFullLoad));
      });
  }, [slotRecord, navEntities]);

  const eraTemporalInfo = useEraTemporalInfo();
  const eraTemporalInfoByKey = useEraTemporalInfoByKey();
  const prominentByCulture = useProminentByCulture();

  // Extract simulationRunId from slot metadata for content association
  const simulationRunId = slotRecord?.simulationRunId;

  return {
    slotRecord,
    setSlotRecord,
    simulationRunId,
    currentEra,
    eraTemporalInfo,
    eraTemporalInfoByKey,
    prominentByCulture,
  };
}
