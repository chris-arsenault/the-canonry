/**
 * Pure computation of run-scoped indexes from entity data.
 *
 * Called once at seed/sync time. Result is persisted to Dexie and served
 * via the index store. Enrichment and backport operations never call this.
 */

import type { WorldEntity } from "@canonry/world-schema";
import {
  buildProminenceScale,
  DEFAULT_PROMINENCE_DISTRIBUTION,
  prominenceThresholdFromScale,
} from "@canonry/world-schema";
import type { RunIndexRecord, EraTemporalEntry } from "./indexTypes";

function resolveEntityEraId(entity: WorldEntity): string | undefined {
  if (!entity) return undefined;
  if (typeof entity.eraId === "string" && entity.eraId) return entity.eraId;
  return undefined;
}

export function computeRunIndexes(
  simulationRunId: string,
  entities: WorldEntity[]
): RunIndexRecord {
  // --- Prominence scale (exclude manual_ entities) ---
  const prominenceValues = entities
    .filter((e) => !e.id.startsWith("manual_"))
    .map((e) => e.prominence)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));

  const prominenceScale = buildProminenceScale(prominenceValues, {
    distribution: DEFAULT_PROMINENCE_DISTRIBUTION,
  });

  const renownedThreshold = prominenceThresholdFromScale("renowned", prominenceScale);

  // --- Era temporal info ---
  const eraEntities = entities.filter(
    (e) => e.kind === "era" && e.temporal?.startTick != null
  );
  const sortedEras = [...eraEntities].sort(
    (a, b) => (a.temporal?.startTick ?? 0) - (b.temporal?.startTick ?? 0)
  );

  const eraTemporalInfo: EraTemporalEntry[] = sortedEras.map((era, index) => {
    const temporal = era.temporal;
    const startTick: number = temporal.startTick;
    const endTick: number = temporal.end.occurred ? temporal.end.tick : startTick;
    const eraId = resolveEntityEraId(era) || era.id;
    return {
      id: eraId,
      name: era.name,
      summary: era.summary || "",
      order: index,
      startTick,
      endTick,
      duration: endTick - startTick,
    };
  });

  // --- Era ID aliases (entityId -> eraId for eraTemporalInfoByKey) ---
  const eraIdAliases: Record<string, string> = {};
  for (const entity of entities) {
    if (entity.kind !== "era") continue;
    const eraId = resolveEntityEraId(entity);
    if (eraId) {
      eraIdAliases[entity.id] = eraId;
    }
  }

  // --- Prominent by culture (all entities, threshold from scale) ---
  const prominentByCulture: Record<string, Array<{ id: string; name: string }>> = {};
  for (const entity of entities) {
    if (!entity.culture) continue;
    if (typeof entity.prominence !== "number" || entity.prominence < renownedThreshold) continue;
    if (!prominentByCulture[entity.culture]) {
      prominentByCulture[entity.culture] = [];
    }
    prominentByCulture[entity.culture].push({ id: entity.id, name: entity.name });
  }

  return {
    simulationRunId,
    prominenceScale,
    renownedThreshold,
    eraTemporalInfo,
    eraIdAliases,
    prominentByCulture,
    computedAt: Date.now(),
  };
}
