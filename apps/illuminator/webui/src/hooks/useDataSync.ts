/**
 * useDataSync - Hook for data synchronization between hard state and Dexie
 *
 * Extracted from IlluminatorRemote. Manages:
 * - Hard state import (overwrite / patch modes)
 * - Entity update handling from enrichment queue
 * - Era summary refresh
 * - Store initialization from Dexie
 * - Entity/event reload helpers
 */

import { useState, useCallback, useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import * as entityRepo from "../lib/db/entityRepository";
import * as eventRepo from "../lib/db/eventRepository";
import * as relationshipRepo from "../lib/db/relationshipRepository";
import * as slotRepo from "../lib/db/slotRepository";
import * as schemaRepo from "../lib/db/schemaRepository";
import * as coordinateStateRepo from "../lib/db/coordinateStateRepository";
import { useEntityStore } from "../lib/db/entityStore";
import { useIndexStore } from "../lib/db/indexStore";
import { useNarrativeEventStore } from "../lib/db/narrativeEventStore";
import { useRelationshipStore } from "../lib/db/relationshipStore";
import { useChronicleStore } from "../lib/db/chronicleStore";
import { refreshEraSummariesInChronicles } from "../lib/db/chronicleRepository";
import { computeRunIndexes } from "../lib/db/indexComputation";
import { upsertRunIndexes } from "../lib/db/indexRepository";
import type { SimulationSlotRecord } from "../lib/db/illuminatorDb";
import type { ApplyEnrichmentOutput } from "../lib/enrichmentTypes";
import type { CanonrySchemaSlice, WorldEntity, NarrativeEvent, WorldRelationship, CoordinateState } from "@canonry/world-schema";
import type { EraTemporalEntry } from "../lib/db/indexTypes";

// --- Types ---

type SyncMode = "overwrite" | "patch";

interface DataSyncStatus {
  type: "success" | "error";
  message: string;
}

interface WorldData {
  schema?: CanonrySchemaSlice;
  hardState?: WorldEntity[];
  narrativeHistory?: NarrativeEvent[];
  relationships?: WorldRelationship[];
  metadata?: {
    simulationRunId?: string;
    tick?: number;
    era?: string;
    [key: string]: unknown;
  };
  coordinateState?: CoordinateState;
}

interface ValidationResult {
  error?: string;
  cancelled?: boolean;
  hardRunId?: string;
}

export interface UseDataSyncParams {
  projectId: string | null;
  activeSlotIndex: number;
  worldData: WorldData | null;
  hasHardState: boolean;
  slotRecord: SimulationSlotRecord | null;
  setSlotRecord: Dispatch<SetStateAction<SimulationSlotRecord | null>>;
  simulationRunId: string | undefined;
  eraTemporalInfo: EraTemporalEntry[];
}

export interface UseDataSyncReturn {
  dataSyncStatus: DataSyncStatus | null;
  isDataSyncing: boolean;
  handleDataSync: (mode: SyncMode) => Promise<void>;
  handleEntityUpdate: (entityId: string, output: ApplyEnrichmentOutput) => Promise<void>;
  handleRefreshEraSummaries: () => Promise<number>;
  reloadEntities: (invalidateIds?: string[], overrideRunId?: string) => Promise<void>;
  reloadEntitiesAndEvents: (invalidateIds?: string[], overrideRunId?: string) => Promise<void>;
}

// --- Extracted helpers for handleDataSync (cognitive complexity reduction) ---

function resolveFinalEraIdFromHardState(hardState: WorldEntity[] | undefined, eraValue: string | undefined): string | null {
  if (!eraValue) return null;
  const eraEntity = (hardState || []).find(
    (entity) =>
      entity.kind === "era" &&
      (entity.id === eraValue || entity.eraId === eraValue || entity.name === eraValue)
  );
  return eraEntity ? eraEntity.eraId || eraEntity.id || eraValue : eraValue;
}

function validateHardStateAvailable(worldData: WorldData | null, hasHardState: boolean): ValidationResult {
  const hardRunId = worldData?.metadata?.simulationRunId;
  if (!hardRunId) return { error: "Missing simulation run ID in hard state." };
  const hasData = hasHardState && worldData?.hardState?.length > 0;
  if (!hasData) return { error: "No hard state available to import." };
  return { hardRunId };
}

function validateDataSyncPreconditions(
  mode: SyncMode,
  worldData: WorldData | null,
  hasHardState: boolean,
  slotRecord: SimulationSlotRecord | null,
): ValidationResult {
  const result = validateHardStateAvailable(worldData, hasHardState);
  if (result.error) return result;
  const { hardRunId } = result;
  if (slotRecord?.simulationRunId && slotRecord.simulationRunId !== hardRunId) {
    const ok = window.confirm(
      `Hard state run ID (${hardRunId}) does not match this slot's run (${slotRecord.simulationRunId}). Importing will switch this slot to the hard state run. Continue?`
    );
    if (!ok) return { cancelled: true };
  }
  if (mode === "overwrite") {
    const ok = window.confirm(
      "Overwrite will replace ALL Dexie entities, events, and relationships for this run with hard state. This can delete local enrichment. Continue?"
    );
    if (!ok) return { cancelled: true };
  }
  return { hardRunId };
}

async function syncAncillaryData(hardRunId: string, projectId: string | null, worldData: WorldData | null): Promise<void> {
  if (projectId && worldData?.schema) {
    await schemaRepo.upsertSchema(projectId, worldData.schema);
  }
  if (worldData?.coordinateState) {
    await coordinateStateRepo.upsertCoordinateState(hardRunId, worldData.coordinateState);
  }
}

function resolveSlotLabel(slotRecord: SimulationSlotRecord | null, activeSlotIndex: number): string {
  if (slotRecord?.label) return slotRecord.label;
  return activeSlotIndex === 0 ? "Scratch" : `Slot ${activeSlotIndex}`;
}

function resolveFinalTick(metadata: WorldData["metadata"]): number | null {
  return Number.isFinite(metadata?.tick) ? metadata.tick : null;
}

function buildNextSlotRecord(
  hardRunId: string,
  projectId: string | null,
  activeSlotIndex: number,
  worldData: WorldData,
  slotRecord: SimulationSlotRecord | null,
): SimulationSlotRecord {
  return {
    projectId,
    slotIndex: activeSlotIndex,
    simulationRunId: hardRunId,
    finalTick: resolveFinalTick(worldData?.metadata),
    finalEraId: resolveFinalEraIdFromHardState(worldData.hardState, worldData?.metadata?.era),
    label: resolveSlotLabel(slotRecord, activeSlotIndex),
    isTemporary: slotRecord?.isTemporary ?? activeSlotIndex === 0,
    updatedAt: Date.now(),
  };
}

async function performOverwriteSync(hardRunId: string, worldData: WorldData): Promise<string> {
  await Promise.all([
    entityRepo.deleteEntitiesForRun(hardRunId),
    eventRepo.deleteEventsForRun(hardRunId),
    relationshipRepo.deleteRelationshipsForRun(hardRunId),
  ]);
  await entityRepo.seedEntities(hardRunId, worldData.hardState);
  if (worldData.narrativeHistory?.length) {
    await eventRepo.seedNarrativeEvents(hardRunId, worldData.narrativeHistory);
  }
  if (worldData.relationships?.length) {
    await relationshipRepo.seedRelationships(hardRunId, worldData.relationships);
  }
  return "Overwrite complete. Dexie now matches hard state for this run.";
}

async function performPatchSync(hardRunId: string, worldData: WorldData): Promise<string> {
  const { added, patched } = await entityRepo.patchEntitiesFromHardState(
    hardRunId,
    worldData.hardState
  );
  const eventsAdded = await eventRepo.patchNarrativeEvents(
    hardRunId,
    worldData.narrativeHistory || []
  );
  const relationshipsAdded = await relationshipRepo.patchRelationships(
    hardRunId,
    worldData.relationships || []
  );
  return `Patch complete. Entities added: ${added}, patched: ${patched}. Events added: ${eventsAdded}. Relationships added: ${relationshipsAdded}.`;
}

async function reinitializeStoresAfterSync(hardRunId: string): Promise<void> {
  const store = useEntityStore.getState();
  store.reset();
  await store.initialize(hardRunId);

  const allEntities = await entityRepo.getEntitiesForRun(hardRunId);
  const indexRecord = computeRunIndexes(hardRunId, allEntities);
  await upsertRunIndexes(indexRecord);
  const indexStore = useIndexStore.getState();
  indexStore.reset();
  await indexStore.initialize(hardRunId);

  useNarrativeEventStore.getState().reset();
  await useNarrativeEventStore.getState().initialize(hardRunId);
  useRelationshipStore.getState().reset();
  await useRelationshipStore.getState().initialize(hardRunId);

  window.dispatchEvent(
    new CustomEvent("illuminator:worlddata-changed", {
      detail: { simulationRunId: hardRunId, scope: "all" },
    })
  );
}

// --- Entity update dispatch helpers ---

async function applyEntityEnrichment(entityId: string, output: ApplyEnrichmentOutput): Promise<void> {
  if (output.enrichment?.image) {
    await entityRepo.applyImageResult(entityId, output.enrichment.image);
    return;
  }
  if (output.enrichment?.entityChronicle) {
    await entityRepo.applyEntityChronicleResult(entityId, output.enrichment.entityChronicle);
    return;
  }
  if (output.enrichment?.text && !output.description) {
    await entityRepo.applyVisualThesisResult(
      entityId,
      output.enrichment.text.visualThesis,
      output.enrichment.text.visualTraits || [],
      {
        generatedAt: output.enrichment.text.generatedAt,
        model: output.enrichment.text.model,
        estimatedCost: output.enrichment.text.estimatedCost,
        actualCost: output.enrichment.text.actualCost,
        inputTokens: output.enrichment.text.inputTokens,
        outputTokens: output.enrichment.text.outputTokens,
        chainDebug: output.enrichment.text.chainDebug,
      }
    );
    return;
  }
  await entityRepo.applyDescriptionResult(
    entityId,
    output.enrichment,
    output.summary,
    output.description
  );
}

// --- Reload helpers (module-level to reduce hook body) ---

function createReloadEntities(simulationRunId: string | undefined) {
  return async (invalidateIds?: string[], overrideRunId?: string) => {
    const runId = overrideRunId ?? simulationRunId;
    if (!runId) return;
    const store = useEntityStore.getState();
    if (invalidateIds?.length) {
      await store.refreshEntities(invalidateIds);
    } else {
      await store.refreshAll();
    }
    window.dispatchEvent(
      new CustomEvent("illuminator:worlddata-changed", {
        detail: { simulationRunId: runId, scope: "entities" },
      })
    );
  };
}

function createReloadEntitiesAndEvents(simulationRunId: string | undefined) {
  return async (invalidateIds?: string[], overrideRunId?: string) => {
    const runId = overrideRunId ?? simulationRunId;
    if (!runId) return;
    const entityStore = useEntityStore.getState();
    if (invalidateIds?.length) {
      await entityStore.refreshEntities(invalidateIds);
    } else {
      await entityStore.refreshAll();
    }
    await useNarrativeEventStore.getState().refreshAll();
    window.dispatchEvent(
      new CustomEvent("illuminator:worlddata-changed", {
        detail: { simulationRunId: runId, scope: "entities+events" },
      })
    );
  };
}

async function initializeStoresForRun(simulationRunId: string): Promise<void> {
  await useEntityStore.getState().initialize(simulationRunId);
  await useIndexStore.getState().initialize(simulationRunId);
  await useNarrativeEventStore.getState().initialize(simulationRunId);
  await useRelationshipStore.getState().initialize(simulationRunId);
}

// --- Main hook ---

export function useDataSync({
  projectId,
  activeSlotIndex,
  worldData,
  hasHardState,
  slotRecord,
  setSlotRecord,
  simulationRunId,
  eraTemporalInfo,
}: UseDataSyncParams): UseDataSyncReturn {
  const [dataSyncStatus, setDataSyncStatus] = useState<DataSyncStatus | null>(null);
  const [isDataSyncing, setIsDataSyncing] = useState<boolean>(false);

  const reloadEntities = useCallback(
    (invalidateIds?: string[], overrideRunId?: string) =>
      createReloadEntities(simulationRunId)(invalidateIds, overrideRunId),
    [simulationRunId]
  );
  const reloadEntitiesAndEvents = useCallback(
    (invalidateIds?: string[], overrideRunId?: string) =>
      createReloadEntitiesAndEvents(simulationRunId)(invalidateIds, overrideRunId),
    [simulationRunId]
  );

  const handleDataSync = useCallback(
    async (mode: SyncMode) => {
      const result = validateDataSyncPreconditions(mode, worldData, hasHardState, slotRecord);
      if (result.error) {
        setDataSyncStatus({ type: "error", message: result.error });
        return;
      }
      if (result.cancelled) return;
      setIsDataSyncing(true);
      setDataSyncStatus(null);
      try {
        const message =
          mode === "overwrite"
            ? await performOverwriteSync(result.hardRunId, worldData)
            : await performPatchSync(result.hardRunId, worldData);
        setDataSyncStatus({ type: "success", message });
        await syncAncillaryData(result.hardRunId, projectId, worldData);
        const nextSlot = buildNextSlotRecord(
          result.hardRunId,
          projectId,
          activeSlotIndex,
          worldData,
          slotRecord
        );
        await slotRepo.upsertSlot(nextSlot);
        setSlotRecord(nextSlot);
        await reinitializeStoresAfterSync(result.hardRunId);
      } catch (err) {
        setDataSyncStatus({
          type: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setIsDataSyncing(false);
      }
    },
    [activeSlotIndex, hasHardState, projectId, slotRecord, worldData, setSlotRecord]
  );

  const handleEntityUpdate = useCallback(
    async (entityId: string, output: ApplyEnrichmentOutput) => {
      await applyEntityEnrichment(entityId, output);
      await reloadEntities([entityId]);
    },
    [reloadEntities]
  );

  const handleRefreshEraSummaries = useCallback(async () => {
    if (!simulationRunId || !eraTemporalInfo.length) return 0;
    const count = await refreshEraSummariesInChronicles(simulationRunId, eraTemporalInfo);
    if (count > 0) await useChronicleStore.getState().refreshAll();
    return count;
  }, [simulationRunId, eraTemporalInfo]);

  useEffect(() => {
    const handler = (event: Event) => {
      if (!simulationRunId) return;
      const detail = (event as CustomEvent<{ entityIds?: string[] }>)?.detail;
      void reloadEntities(detail?.entityIds);
    };
    window.addEventListener("entities-updated", handler);
    return () => window.removeEventListener("entities-updated", handler);
  }, [reloadEntities, simulationRunId]);

  useEffect(() => {
    if (!simulationRunId) return;
    initializeStoresForRun(simulationRunId).catch((err) =>
      console.warn("[Illuminator] DAL load failed:", err)
    );
  }, [simulationRunId]);

  return {
    dataSyncStatus,
    isDataSyncing,
    handleDataSync,
    handleEntityUpdate,
    handleRefreshEraSummaries,
    reloadEntities,
    reloadEntitiesAndEvents,
  };
}
