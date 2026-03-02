/**
 * Bundle export utilities for the Canonry app.
 *
 * Extracted from App.jsx to reduce file size and complexity.
 * Contains pure/async helper functions for building viewer bundles,
 * image asset gathering, entity hydration, and import/export logic.
 */

import type { Optional } from "@the-canonry/shared-components";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LoreRecord {
  id: string;
  type: string;
  targetId: string;
  text: string;
  metadata: { generatedAt: string; model: string };
}

interface LoreData {
  llmEnabled: boolean;
  model: string;
  records: LoreRecord[];
}

export interface WorldEntity {
  id: string;
  kind: string;
  name: string;
  enrichment: Optional<{
    image: Optional<{ imageId: string }>;
    eraNarrative: Optional<{ text: string; generatedAt: string; model: string }>;
  }>;
  [key: string]: unknown;
}

export interface WorldData {
  hardState: WorldEntity[];
  relationships: unknown[];
  narrativeHistory: Optional<unknown[]>;
  coordinateState: Optional<unknown>;
  schema: unknown;
  metadata: Record<string, unknown>;
  pressures: unknown;
  [key: string]: unknown;
}

interface HydrateParams {
  worldData: WorldData;
  projectId: string;
  simulationRunId: string;
}

// ---------------------------------------------------------------------------
// Lore data extraction
// ---------------------------------------------------------------------------

export function extractLoreDataFromEntities(worldData: WorldData | null): LoreData | null {
  if (!worldData?.hardState) return null;
  const records: LoreRecord[] = [];
  for (const entity of worldData.hardState) {
    const enrichment = entity.enrichment;
    if (!enrichment) continue;
    if (enrichment.eraNarrative?.text) {
      records.push({
        id: `era_${entity.id}`,
        type: entity.kind === "era" ? "era_chapter" : "entity_chronicle",
        targetId: entity.id,
        text: enrichment.eraNarrative.text,
        metadata: {
          generatedAt: enrichment.eraNarrative.generatedAt,
          model: enrichment.eraNarrative.model,
        },
      });
    }
  }
  if (records.length === 0) return null;
  return { llmEnabled: true, model: "mixed", records };
}

/**
 * Async wrapper kept for caller compatibility.
 * Delegates to the synchronous extractLoreDataFromEntities.
 */
export function extractLoreDataWithCurrentImageRefs(
  worldData: WorldData | null,
): LoreData | null {
  return extractLoreDataFromEntities(worldData);
}

// ---------------------------------------------------------------------------
// Dexie entity merge
// ---------------------------------------------------------------------------

function stripSimulationRunId<T extends Record<string, unknown>>(
  record: T,
): Omit<T, "simulationRunId"> {
  if (!record || typeof record !== "object") return record;
  const result = { ...record };
  delete (result as Record<string, unknown>).simulationRunId;
  return result as Omit<T, "simulationRunId">;
}

function mergeEntitiesWithDexie(
  baseEntities: WorldEntity[],
  dexieEntities: WorldEntity[],
): WorldEntity[] {
  if (!Array.isArray(baseEntities) || baseEntities.length === 0) {
    return Array.isArray(dexieEntities)
      ? dexieEntities.map(stripSimulationRunId) as WorldEntity[]
      : [];
  }
  if (!Array.isArray(dexieEntities) || dexieEntities.length === 0) {
    return baseEntities;
  }
  const dexieById = new Map(dexieEntities.map((entity) => [entity.id, entity]));
  const merged: WorldEntity[] = baseEntities.map((entity) => {
    const updated = dexieById.get(entity.id);
    if (!updated) return entity;
    return { ...entity, ...stripSimulationRunId(updated) };
  });
  const baseIds = new Set(baseEntities.map((entity) => entity.id));
  for (const entity of dexieEntities) {
    if (entity?.id && !baseIds.has(entity.id)) {
      merged.push(stripSimulationRunId(entity) as WorldEntity);
    }
  }
  return merged;
}

function pickDexieArrayOrFallback(
  dexieData: Record<string, unknown>[],
  fallback: unknown[] | undefined,
): unknown[] {
  return Array.isArray(dexieData) && dexieData.length > 0
    ? dexieData.map(stripSimulationRunId)
    : fallback || [];
}

function buildMergedWorldData(
  worldData: WorldData,
  dexieEntities: WorldEntity[],
  dexieEvents: Record<string, unknown>[],
  dexieRelationships: Record<string, unknown>[],
  coordinateRecord: Record<string, unknown> | null,
  schemaRecord: Record<string, unknown> | null,
): WorldData {
  const mergedEntities = mergeEntitiesWithDexie(worldData.hardState || [], dexieEntities);
  const relationships = pickDexieArrayOrFallback(dexieRelationships, worldData.relationships);
  const narrativeHistory = pickDexieArrayOrFallback(dexieEvents, worldData.narrativeHistory);
  return {
    ...worldData,
    schema: schemaRecord?.schema || worldData.schema,
    hardState: mergedEntities,
    relationships,
    narrativeHistory,
    coordinateState: coordinateRecord?.coordinateState || worldData.coordinateState,
    metadata: {
      ...(worldData.metadata || {}),
      entityCount: mergedEntities.length,
      relationshipCount: relationships.length,
    },
  };
}

export async function hydrateWorldDataFromDexie({
  worldData,
  projectId,
  simulationRunId,
}: HydrateParams): Promise<WorldData> {
  const missingParams = [
    !worldData && "worldData",
    !simulationRunId && "simulationRunId",
    !projectId && "projectId",
  ].filter(Boolean);
  if (missingParams.length > 0) {
    throw new Error(`Cannot hydrate export: missing ${missingParams.join(", ")}`);
  }

  const [
    { getEntitiesForRun },
    { getNarrativeEventsForRun },
    { getRelationshipsForRun },
    { getCoordinateState },
    { getSchema },
  ] = await Promise.all([
    import("illuminator/entityRepository") as Promise<{ getEntitiesForRun: (id: string) => Promise<WorldEntity[]> }>,
    import("illuminator/eventRepository") as Promise<{ getNarrativeEventsForRun: (id: string) => Promise<Record<string, unknown>[]> }>,
    import("illuminator/relationshipRepository") as Promise<{ getRelationshipsForRun: (id: string) => Promise<Record<string, unknown>[]> }>,
    import("illuminator/coordinateStateRepository") as Promise<{ getCoordinateState: (id: string) => Promise<Record<string, unknown> | null> }>,
    import("illuminator/schemaRepository") as Promise<{ getSchema: (id: string) => Promise<Record<string, unknown> | null> }>,
  ]);

  const [dexieEntities, dexieEvents, dexieRelationships, coordinateRecord, schemaRecord] =
    await Promise.all([
      getEntitiesForRun(simulationRunId),
      getNarrativeEventsForRun(simulationRunId),
      getRelationshipsForRun(simulationRunId),
      getCoordinateState(simulationRunId),
      getSchema(projectId),
    ]);

  return buildMergedWorldData(worldData, dexieEntities, dexieEvents, dexieRelationships, coordinateRecord, schemaRecord);
}

// ---------------------------------------------------------------------------
// World output detection & export helpers
// ---------------------------------------------------------------------------

export function isWorldOutput(candidate: unknown): boolean {
  if (!candidate || typeof candidate !== "object") return false;
  const c = candidate as Record<string, unknown>;
  return Boolean(
    c.schema &&
      c.metadata &&
      Array.isArray(c.hardState) &&
      Array.isArray(c.relationships) &&
      c.pressures &&
      typeof c.pressures === "object",
  );
}

export function mergeDefined<T>(value: T | undefined, fallback: T): T {
  return value === undefined ? fallback : value;
}

export function buildExportBase(value: string | undefined, fallback: string): string {
  const raw = value || fallback || "export";
  return raw
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function normalizeWorldContextForExport(
  worldContext: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!worldContext || typeof worldContext !== "object") return null;
  const worldDynamics = Array.isArray(worldContext.worldDynamics)
    ? worldContext.worldDynamics
    : [];
  return { ...worldContext, worldDynamics };
}
