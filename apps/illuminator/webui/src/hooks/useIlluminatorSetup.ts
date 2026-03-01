/**
 * useIlluminatorSetup - Secondary state and derived values for Illuminator
 *
 * Wraps: style library, image settings, world schema resolution,
 * derived state, subtypes, era entities, queue setup, config store sync,
 * and entity CRUD callbacks.
 */

import { useState, useMemo, useEffect, useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useStyleLibrary } from "./useStyleLibrary";
import { useImageGenSettings } from "./useImageGenSettings";
import type { ImageGenSettings } from "./useImageGenSettings";
import { useEnrichmentQueue } from "./useEnrichmentQueue";
import { useChronicleQueueWatcher } from "./useChronicleQueueWatcher";
import { useEntityStore } from "../lib/db/entityStore";
import { useIndexStore } from "../lib/db/indexStore";
import { useIlluminatorModals } from "../lib/db/modalStore";
import { useIlluminatorConfigStore } from "../lib/db/illuminatorConfigStore";
import { useEnrichmentQueueStore } from "../lib/db/enrichmentQueueStore";
import { registerQueue } from "../lib/db/enrichmentQueueBridge";
import { getResolvedLLMCallSettings } from "../lib/llmModelSettings";
import { computeRunIndexes } from "../lib/db/indexComputation";
import { upsertRunIndexes } from "../lib/db/indexRepository";
import * as entityRepo from "../lib/db/entityRepository";
import * as eventRepo from "../lib/db/eventRepository";
import type { CanonrySchemaSlice } from "@canonry/world-schema";
import type { SimulationSlotRecord, PersistedEntity } from "../lib/db/illuminatorDb";
import type { EntityNavItem } from "../lib/db/entityNav";
import type { EntityGuidance, CultureIdentities, WorldContext } from "../lib/promptBuilders";
import type { HistorianConfig } from "../lib/historianTypes";
import type { ApplyEnrichmentOutput } from "../lib/enrichmentTypes";

// --- Types ---

interface StyleSelection {
  artisticStyleId: string;
  compositionStyleId: string;
  colorPaletteId: string;
}

interface EraInfo {
  name: string;
  description?: string;
}

interface WorldData {
  schema?: CanonrySchemaSlice;
  hardState?: PersistedEntity[];
  narrativeHistory?: unknown[];
  relationships?: unknown[];
  metadata?: Record<string, unknown>;
  coordinateState?: unknown;
}

interface ApiKeys {
  anthropicApiKey: string;
  openaiApiKey: string;
}

interface IlluminatorConfig {
  imageModel?: string;
  useClaudeForImagePrompt?: boolean;
  claudeImagePromptTemplate?: string;
  globalImageRules?: string;
  [key: string]: unknown;
}

interface RenameArgs {
  targetEntityId: string | null;
  newName: string;
  entityPatches: Array<{ entityId: string; field: string; oldValue: string; newValue: string }>;
  eventPatches: Array<{ eventId: string; field: string; oldValue: string; newValue: string }>;
  addOldNameAsAlias?: boolean;
}

interface EraEntitySummary {
  id: string;
  name: string;
  description: string;
}

export interface UseIlluminatorSetupParams {
  projectId: string | null;
  worldData: WorldData | null;
  schema: CanonrySchemaSlice | null;
  onStyleSelectionChange: ((selection: StyleSelection) => void) | undefined;
  config: IlluminatorConfig;
  apiKeys: ApiKeys;
  slotRecord: SimulationSlotRecord | null;
  currentEra: EraInfo | null;
  simulationRunId: string | undefined;
  handleEntityUpdate: (entityId: string, output: ApplyEnrichmentOutput) => Promise<void>;
  reloadEntities: (invalidateIds?: string[], overrideRunId?: string) => Promise<void>;
  reloadEntitiesAndEvents: (invalidateIds?: string[], overrideRunId?: string) => Promise<void>;
  worldContext: WorldContext;
  historianConfig: HistorianConfig;
  entityGuidance: EntityGuidance;
  cultureIdentities: CultureIdentities;
  navEntities: EntityNavItem[];
  setChronicleRefreshTrigger: Dispatch<SetStateAction<number>>;
}

// --- Module-level helpers ---

function computeSubtypesByKind(worldSchema: CanonrySchemaSlice): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const kindDef of worldSchema?.entityKinds || []) {
    if (kindDef.kind && kindDef.subtypes?.length > 0) {
      map[kindDef.kind] = kindDef.subtypes.map((st) => st.id);
    }
  }
  return map;
}

function computeWorldSchema(worldData: WorldData | null, schema: CanonrySchemaSlice | null): CanonrySchemaSlice {
  if (worldData?.schema) return worldData.schema;
  return schema || { entityKinds: [], relationshipKinds: [], cultures: [], tagRegistry: [] };
}

function computeSimulationMetadata(slotRecord: SimulationSlotRecord | null, currentEra: EraInfo | null) {
  if (!slotRecord) return undefined;
  return {
    currentTick: typeof slotRecord.finalTick === "number" ? slotRecord.finalTick : undefined,
    currentEra: currentEra || undefined,
  };
}

function arrayLen(arr: unknown[] | undefined | null): number {
  return arr ? arr.length : 0;
}

function computeHardStateSummary(worldData: WorldData | null): string {
  const entityCount = arrayLen(worldData?.hardState);
  const eventCount = arrayLen(worldData?.narrativeHistory);
  const relCount = arrayLen(worldData?.relationships);
  if (entityCount === 0) return "No hard state available for import.";
  return `Hard state: ${entityCount} entities, ${eventCount} events, ${relCount} relationships.`;
}

async function handleRenameApply(
  args: RenameArgs,
  simulationRunId: string | undefined,
  reloadEntitiesAndEvents: (invalidateIds?: string[]) => Promise<void>,
  setChronicleRefreshTrigger: Dispatch<SetStateAction<number>>,
): Promise<void> {
  try {
    const updatedIds = await entityRepo.applyRename(
      args.targetEntityId,
      args.newName,
      args.entityPatches,
      simulationRunId,
      args.addOldNameAsAlias
    );
    if (args.eventPatches.length > 0) {
      await eventRepo.applyEventPatches(args.eventPatches, simulationRunId);
    }
    const allEntities = await entityRepo.getEntitiesForRun(simulationRunId);
    const indexRecord = computeRunIndexes(simulationRunId, allEntities);
    await upsertRunIndexes(indexRecord);
    await useIndexStore.getState().refreshAll();
    await reloadEntitiesAndEvents(updatedIds);
  } catch (err) {
    console.error("[Illuminator] Rename persist failed:", err);
  }
  useIlluminatorModals.getState().closeRename();
  setChronicleRefreshTrigger((n) => n + 1);
}

async function handleCreateApply(
  entityData: Record<string, unknown>,
  simulationRunId: string | undefined,
  reloadEntities: (invalidateIds?: string[]) => Promise<void>,
): Promise<void> {
  if (!simulationRunId) return;
  try {
    const created = await entityRepo.createEntity(simulationRunId, entityData);
    const allEntities = await entityRepo.getEntitiesForRun(simulationRunId);
    const indexRecord = computeRunIndexes(simulationRunId, allEntities);
    await upsertRunIndexes(indexRecord);
    await useIndexStore.getState().refreshAll();
    await reloadEntities([created.id]);
  } catch (err) {
    console.error("[Illuminator] Create entity failed:", err);
  }
  useIlluminatorModals.getState().closeCreateEntity();
}

async function handleEditApply(
  entityData: Record<string, unknown>,
  editEntityModal: { id: string } | null,
  reloadEntities: (invalidateIds?: string[]) => Promise<void>,
): Promise<void> {
  if (!editEntityModal) return;
  try {
    await entityRepo.updateEntityFields(editEntityModal.id, {
      ...entityData,
      updatedAt: Date.now(),
    });
    await reloadEntities([editEntityModal.id]);
  } catch (err) {
    console.error("[Illuminator] Edit entity failed:", err);
  }
  useIlluminatorModals.getState().closeEditEntity();
}

function buildWorkerConfig(apiKeys: ApiKeys, config: IlluminatorConfig, imageGenSettings: ImageGenSettings) {
  return {
    anthropicApiKey: apiKeys.anthropicApiKey,
    openaiApiKey: apiKeys.openaiApiKey,
    imageModel: config.imageModel,
    imageSize: imageGenSettings.imageSize,
    imageQuality: imageGenSettings.imageQuality,
    useClaudeForImagePrompt: config.useClaudeForImagePrompt,
    claudeImagePromptTemplate: config.claudeImagePromptTemplate,
    globalImageRules: config.globalImageRules,
    llmCallSettings: getResolvedLLMCallSettings(),
  };
}

// --- Main hook ---

export function useIlluminatorSetup({
  projectId,
  worldData,
  schema,
  onStyleSelectionChange,
  config,
  apiKeys,
  slotRecord,
  currentEra,
  simulationRunId,
  handleEntityUpdate,
  reloadEntities,
  reloadEntitiesAndEvents,
  worldContext,
  historianConfig,
  entityGuidance,
  cultureIdentities,
  navEntities,
  setChronicleRefreshTrigger,
}: UseIlluminatorSetupParams) {
  // Style library
  const styleLib = useStyleLibrary();

  // Image gen settings
  const [imageGenSettings, updateImageGenSettings] = useImageGenSettings(
    onStyleSelectionChange
      ? (s: ImageGenSettings) =>
          onStyleSelectionChange({
            artisticStyleId: s.artisticStyleId,
            compositionStyleId: s.compositionStyleId,
            colorPaletteId: s.colorPaletteId,
          })
      : undefined
  );
  const styleSelection = useMemo(
    () => ({
      artisticStyleId: imageGenSettings.artisticStyleId,
      compositionStyleId: imageGenSettings.compositionStyleId,
      colorPaletteId: imageGenSettings.colorPaletteId,
    }),
    [
      imageGenSettings.artisticStyleId,
      imageGenSettings.compositionStyleId,
      imageGenSettings.colorPaletteId,
    ]
  );

  // World schema + simulation metadata
  const worldSchema = useMemo(() => computeWorldSchema(worldData, schema), [worldData, schema]);
  const simulationMetadata = useMemo(
    () => computeSimulationMetadata(slotRecord, currentEra),
    [slotRecord, currentEra]
  );

  // Derived state
  const hasHardState = Boolean(worldData?.hardState?.length);
  const hardStateSummary = useMemo(() => computeHardStateSummary(worldData), [worldData]);
  const canImport = hasHardState;
  const hasWorldData = navEntities.length > 0;
  const isTemporarySlot = slotRecord?.isTemporary ?? false;

  // Subtypes
  const subtypesByKind = useMemo(() => computeSubtypesByKind(worldSchema), [worldSchema]);

  // Era entities (wrapped in async IIFE to satisfy set-state-in-effect rule)
  const [eraEntities, setEraEntities] = useState<EraEntitySummary[]>([]);
  useEffect(() => {
    (async () => {
      const eraNavs = navEntities.filter((e) => e.kind === "era");
      if (eraNavs.length === 0) {
        setEraEntities([]);
        return;
      }
      const full = await useEntityStore.getState().loadEntities(eraNavs.map((e) => e.id));
      setEraEntities(full.map((e) => ({ id: e.id, name: e.name, description: e.description })));
    })();
  }, [navEntities]);

  // Queue
  const {
    queue,
    isWorkerReady,
    stats,
    initialize: initializeWorker,
    enqueue,
    cancel,
    cancelAll,
    retry,
    clearCompleted,
  } = useEnrichmentQueue(handleEntityUpdate, projectId, simulationRunId);
  registerQueue(enqueue, cancel);
  useEffect(() => {
    useEnrichmentQueueStore.getState().setQueue(queue, stats);
  }, [queue, stats]);
  useChronicleQueueWatcher(queue);
  useEffect(() => {
    if (apiKeys.anthropicApiKey || apiKeys.openaiApiKey)
      initializeWorker(buildWorkerConfig(apiKeys, config, imageGenSettings));
  }, [apiKeys, config, imageGenSettings, initializeWorker]);

  // Config store sync
  useEffect(() => {
    useIlluminatorConfigStore.getState().setConfig({
      projectId: projectId || null,
      simulationRunId: simulationRunId || null,
      worldContext,
      historianConfig,
      entityGuidance,
      cultureIdentities,
    });
  }, [
    projectId,
    simulationRunId,
    worldContext,
    historianConfig,
    entityGuidance,
    cultureIdentities,
  ]);

  // Entity CRUD
  const editEntityModal = useIlluminatorModals((s) => s.editEntityModal);
  const handleRenameApplied = useCallback(
    (args: RenameArgs) =>
      handleRenameApply(args, simulationRunId, reloadEntitiesAndEvents, setChronicleRefreshTrigger),
    [simulationRunId, reloadEntitiesAndEvents, setChronicleRefreshTrigger]
  );
  const handleCreateEntity = useCallback(
    (entityData: Record<string, unknown>) => handleCreateApply(entityData, simulationRunId, reloadEntities),
    [simulationRunId, reloadEntities]
  );
  const handleEditEntity = useCallback(
    (entityData: Record<string, unknown>) => handleEditApply(entityData, editEntityModal, reloadEntities),
    [editEntityModal, reloadEntities]
  );

  return {
    ...styleLib,
    imageGenSettings,
    updateImageGenSettings,
    styleSelection,
    worldSchema,
    simulationMetadata,
    hasHardState,
    hardStateSummary,
    canImport,
    hasWorldData,
    isTemporarySlot,
    subtypesByKind,
    eraEntities,
    queue,
    isWorkerReady,
    stats,
    enqueue,
    cancel,
    cancelAll,
    retry,
    clearCompleted,
    handleRenameApplied,
    handleCreateEntity,
    handleEditEntity,
  };
}
