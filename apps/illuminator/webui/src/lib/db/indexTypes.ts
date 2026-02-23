/**
 * Types for precomputed run-scoped indexes persisted in Dexie.
 *
 * These indexes are computed once at seed/sync time from structural entity
 * fields (prominence, culture, kind, temporal) that do not change during
 * enrichment or backport operations.
 */

import type { ProminenceScale } from '@canonry/world-schema';

export interface EraTemporalEntry {
  id: string;
  name: string;
  summary: string;
  order: number;
  startTick: number;
  endTick: number;
  duration: number;
}

export interface RunIndexRecord {
  simulationRunId: string;
  prominenceScale: ProminenceScale;
  renownedThreshold: number;
  eraTemporalInfo: EraTemporalEntry[];
  /** entityId → eraId aliases for building eraTemporalInfoByKey */
  eraIdAliases: Record<string, string>;
  /** culture → [{id, name}] for entities at/above renowned threshold */
  prominentByCulture: Record<string, Array<{ id: string; name: string }>>;
  computedAt: number;
}
