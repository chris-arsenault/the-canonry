/**
 * Chronicle Lifecycle Operations — accept, unpublish, version management,
 * backport reconciliation, tone ranking, era years, fact coverage repair,
 * and corpus-wide analysis queries.
 */

import { db } from "./illuminatorDb";
import type {
  ChronicleRecord,
  EntityUsageStats,
  NarrativeStyleUsageStats,
  EntityBackportEntry,
} from "../chronicleTypes";
import type { HistorianTone } from "../historianTypes";
import {
  ensureChronicleVersions,
  getLatestVersion,
  restoreRecordFromVersion,
  cascadeVersionIdRefs,
  resolveAcceptTarget,
} from "./chronicleVersionHelpers";

// ============================================================================
// Accept / Unpublish / Active version
// ============================================================================

/**
 * Mark chronicle as complete (user accepted)
 */
export async function acceptChronicle(
  chronicleId: string,
  options?: { finalContent?: string; acceptedVersionId?: string }
): Promise<void> {
  const record = await db.chronicles.get(chronicleId);
  if (!record) throw new Error(`Chronicle ${chronicleId} not found`);

  ensureChronicleVersions(record);
  const target = resolveAcceptTarget(record, options);

  record.finalContent = target.content;
  record.acceptedVersionId = target.versionId;
  record.activeVersionId = target.versionId;
  record.acceptedAt = Date.now();
  record.status = "complete";
  record.updatedAt = Date.now();

  await db.chronicles.put(record);
}

/**
 * Unpublish a completed chronicle, reverting it to assembly_ready.
 */
export async function unpublishChronicle(chronicleId: string): Promise<void> {
  const record = await db.chronicles.get(chronicleId);
  if (!record) throw new Error(`Chronicle ${chronicleId} not found`);

  delete record.finalContent;
  delete record.acceptedAt;
  delete record.acceptedVersionId;
  record.status = "assembly_ready";
  record.updatedAt = Date.now();

  await db.chronicles.put(record);
}

/**
 * Update which generation version should be published when accepting.
 */
export async function updateChronicleActiveVersion(
  chronicleId: string,
  versionId: string
): Promise<void> {
  const record = await db.chronicles.get(chronicleId);
  if (!record) throw new Error(`Chronicle ${chronicleId} not found`);

  if (record.status === "complete" || record.finalContent) {
    throw new Error(`Chronicle ${chronicleId} is accepted; unpublish before changing versions`);
  }

  ensureChronicleVersions(record);
  if (!record.generationHistory?.some((v) => v.versionId === versionId)) {
    throw new Error(`Version ${versionId} not found in chronicle ${chronicleId}`);
  }
  record.activeVersionId = versionId;
  record.updatedAt = Date.now();

  await db.chronicles.put(record);
}

/**
 * Delete a specific version from a chronicle's generation history.
 * If the deleted version was the current or active version, switches to the most recent remaining version.
 */
export async function deleteChronicleVersion(
  chronicleId: string,
  versionId: string
): Promise<void> {
  const record = await db.chronicles.get(chronicleId);
  if (!record) throw new Error(`Chronicle ${chronicleId} not found`);

  if (record.status === "complete" || record.finalContent) {
    throw new Error(`Chronicle ${chronicleId} is accepted; unpublish before deleting versions`);
  }

  ensureChronicleVersions(record);
  const versions = record.generationHistory || [];
  const matchIndex = versions.findIndex((v) => v.versionId === versionId);
  if (matchIndex === -1) {
    throw new Error(`Version ${versionId} not found in chronicle ${chronicleId}`);
  }
  if (versions.length <= 1) {
    throw new Error(`Cannot delete the only version of chronicle ${chronicleId}`);
  }

  const isCurrentVersion = getLatestVersion(versions)?.versionId === versionId;
  const remaining = versions.filter((v) => v.versionId !== versionId);

  if (isCurrentVersion) {
    const nextLatest = getLatestVersion(remaining);
    if (!nextLatest) {
      throw new Error(`Cannot delete current version with no history to restore`);
    }
    restoreRecordFromVersion(record, nextLatest);
  }

  record.generationHistory = remaining;
  cascadeVersionIdRefs(record, versionId);
  record.updatedAt = Date.now();
  await db.chronicles.put(record);
}

// ============================================================================
// Backport status
// ============================================================================

/**
 * Merge per-entity backport status entries into a chronicle's entityBackportStatus map.
 */
export async function updateChronicleEntityBackportStatus(
  chronicleId: string,
  entries: EntityBackportEntry[]
): Promise<void> {
  const record = await db.chronicles.get(chronicleId);
  if (!record) throw new Error(`Chronicle ${chronicleId} not found`);

  const existing = record.entityBackportStatus || {};
  for (const entry of entries) {
    existing[entry.entityId] = entry;
  }
  record.entityBackportStatus = existing;
  record.updatedAt = Date.now();

  await db.chronicles.put(record);
}

function buildEntityBackrefIndex(
  entities: Array<{ id: string; enrichment?: { chronicleBackrefs?: Array<{ chronicleId: string }> } }>
): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();
  for (const entity of entities) {
    const refs = entity.enrichment?.chronicleBackrefs;
    if (refs && refs.length > 0) {
      index.set(entity.id, new Set(refs.map((r) => r.chronicleId)));
    }
  }
  return index;
}

function getEligibleEntityIds(chronicle: ChronicleRecord): Set<string> {
  const eligible = new Set<string>();
  for (const r of chronicle.roleAssignments || []) eligible.add(r.entityId);
  if (chronicle.lens) eligible.add(chronicle.lens.entityId);
  for (const t of chronicle.tertiaryCast || []) {
    if (t.accepted) eligible.add(t.entityId);
  }
  return eligible;
}

function hasBackportStatusChanged(
  oldStatus: Record<string, { status: string }>,
  newStatus: Record<string, { status: string }>
): boolean {
  const oldKeys = Object.keys(oldStatus).sort((a, b) => a.localeCompare(b));
  const newKeys = Object.keys(newStatus).sort((a, b) => a.localeCompare(b));
  if (oldKeys.length !== newKeys.length) return true;
  return oldKeys.some((k, i) => k !== newKeys[i] || oldStatus[k].status !== newStatus[k]?.status);
}

/**
 * Reconcile entityBackportStatus on all chronicles from actual entity backref data.
 */
export async function reconcileBackportStatusFromEntities(
  simulationRunId: string,
  entities: Array<{
    id: string;
    enrichment?: { chronicleBackrefs?: Array<{ chronicleId: string }> };
  }>
): Promise<number> {
  // Inline import to avoid circular dependency
  const { getChroniclesForSimulation } = await import("./chronicleQueryOps");
  const chronicles = await getChroniclesForSimulation(simulationRunId);
  const entityBackrefs = buildEntityBackrefIndex(entities);
  const now = Date.now();
  const toUpdate: ChronicleRecord[] = [];

  for (const chronicle of chronicles) {
    const eligibleIds = getEligibleEntityIds(chronicle);
    const newStatus: Record<string, EntityBackportEntry> = {};
    for (const entityId of eligibleIds) {
      const backrefSet = entityBackrefs.get(entityId);
      if (backrefSet && backrefSet.has(chronicle.chronicleId)) {
        newStatus[entityId] = { entityId, status: "backported", updatedAt: now };
      }
    }

    if (hasBackportStatusChanged(chronicle.entityBackportStatus || {}, newStatus)) {
      chronicle.entityBackportStatus = newStatus;
      chronicle.updatedAt = now;
      toUpdate.push(chronicle);
    }
  }

  if (toUpdate.length > 0) await db.chronicles.bulkPut(toUpdate);
  return toUpdate.length;
}

/**
 * Reset entityBackportStatus on all chronicles in a simulation.
 * Returns the count of chronicles that were updated.
 */
export async function resetAllBackportFlags(simulationRunId: string): Promise<number> {
  const { getChroniclesForSimulation } = await import("./chronicleQueryOps");
  const chronicles = await getChroniclesForSimulation(simulationRunId);
  const toUpdate = chronicles.filter((c) => {
    const status = c.entityBackportStatus;
    return status && Object.keys(status).length > 0;
  });

  if (toUpdate.length === 0) return 0;

  const now = Date.now();
  await db.chronicles.bulkPut(
    toUpdate.map((c) => ({
      ...c,
      entityBackportStatus: {},
      updatedAt: now,
    }))
  );

  return toUpdate.length;
}

// ============================================================================
// Era year assignments
// ============================================================================

/**
 * Batch update historian-assigned era years for multiple chronicles.
 */
export async function batchUpdateChronicleEraYears(
  assignments: Array<{ chronicleId: string; eraYear: number; eraYearReasoning?: string }>
): Promise<number> {
  const ids = assignments.map((a) => a.chronicleId);
  const records = await db.chronicles.where("chronicleId").anyOf(ids).toArray();
  const recordMap = new Map(records.map((r) => [r.chronicleId, r]));
  const now = Date.now();

  const toUpdate: ChronicleRecord[] = [];
  for (const assignment of assignments) {
    const record = recordMap.get(assignment.chronicleId);
    if (!record) continue;
    record.eraYear = assignment.eraYear;
    record.eraYearReasoning = assignment.eraYearReasoning;
    record.updatedAt = now;
    toUpdate.push(record);
  }

  if (toUpdate.length > 0) {
    await db.chronicles.bulkPut(toUpdate);
  }

  return toUpdate.length;
}

// ============================================================================
// Tone ranking & assignment
// ============================================================================

export async function updateChronicleToneRanking(
  chronicleId: string,
  ranking: [string, string, string],
  rationale: string,
  cost?: number,
  rationales?: Record<string, string>
): Promise<void> {
  const record = await db.chronicles.get(chronicleId);
  if (!record) throw new Error(`Chronicle ${chronicleId} not found`);

  record.toneRanking = {
    ranking: ranking as [HistorianTone, HistorianTone, HistorianTone],
    rationale,
    rationales,
    generatedAt: Date.now(),
    actualCost: cost,
  };
  record.updatedAt = Date.now();

  await db.chronicles.put(record);
}

export async function updateChronicleAssignedTone(
  chronicleId: string,
  tone: string
): Promise<void> {
  const record = await db.chronicles.get(chronicleId);
  if (!record) throw new Error(`Chronicle ${chronicleId} not found`);

  record.assignedTone = tone as HistorianTone;
  record.updatedAt = Date.now();

  await db.chronicles.put(record);
}

// ============================================================================
// Fact coverage repair & corpus analysis
// ============================================================================

/**
 * One-shot fixup: recompute wasFaceted on all stored factCoverageReports
 * using perspectiveSynthesis.facets[].factId instead of fuzzy text matching.
 */
export async function repairFactCoverageWasFaceted(): Promise<number> {
  const all = await db.chronicles.toArray();
  let patched = 0;
  for (const record of all) {
    if (!record.factCoverageReport?.entries?.length) continue;
    const facetedIds = new Set(
      (record.perspectiveSynthesis?.facets ?? []).map((f: { factId: string }) => f.factId)
    );
    let changed = false;
    for (const entry of record.factCoverageReport.entries) {
      const correct = facetedIds.has(entry.factId);
      if (entry.wasFaceted !== correct) {
        entry.wasFaceted = correct;
        changed = true;
      }
    }
    if (changed) {
      record.updatedAt = Date.now();
      await db.chronicles.put(record);
      patched++;
    }
  }
  console.log(`[repairFactCoverageWasFaceted] Patched ${patched} chronicles`);
  return patched;
}

/**
 * Compute corpus-wide fact strength scores from all chronicles with coverage reports.
 * Returns a Map of factId -> strength percentage (0-100).
 * Weighted: integral=3, prevalent=2, mentioned=1, missing=0, divided by max possible.
 */
export async function computeCorpusFactStrength(
  simulationRunId: string
): Promise<Map<string, number>> {
  const chronicles = await db.chronicles.where("simulationRunId").equals(simulationRunId).toArray();
  const totals = new Map<string, { weighted: number; count: number }>();

  const ratingWeight: Record<string, number> = {
    integral: 3,
    prevalent: 2,
    mentioned: 1,
    missing: 0,
  };

  for (const chronicle of chronicles) {
    if (!chronicle.factCoverageReport?.entries?.length) continue;
    for (const entry of chronicle.factCoverageReport.entries) {
      const agg = totals.get(entry.factId) || { weighted: 0, count: 0 };
      agg.weighted += ratingWeight[entry.rating] ?? 0;
      agg.count += 1;
      totals.set(entry.factId, agg);
    }
  }

  const result = new Map<string, number>();
  for (const [factId, agg] of totals) {
    result.set(factId, agg.count > 0 ? Math.round((agg.weighted / (agg.count * 3)) * 100) : 0);
  }
  return result;
}

export interface ReinforcementCounts {
  /** Per-fact reinforcement count across all annotations (chronicle + entity) */
  counts: Map<string, number>;
  /** Number of annotations that carried fact guidance (denominator for fair-share) */
  totalAnnotationsWithGuidance: number;
}

function tallyReinforcedFacts(
  factIds: string[],
  counts: Map<string, number>
): void {
  for (const factId of factIds) {
    counts.set(factId, (counts.get(factId) ?? 0) + 1);
  }
}

/**
 * Count how many annotations have reinforced each canon fact.
 * Scans both chronicle.reinforcedFacts and entity.enrichment.reinforcedFacts.
 */
export async function computeAnnotationReinforcementCounts(
  simulationRunId: string
): Promise<ReinforcementCounts> {
  const counts = new Map<string, number>();
  let totalAnnotationsWithGuidance = 0;

  // Chronicle reinforcements
  const chronicles = await db.chronicles.where("simulationRunId").equals(simulationRunId).toArray();
  for (const c of chronicles) {
    if (!c.reinforcedFacts?.length) continue;
    totalAnnotationsWithGuidance++;
    tallyReinforcedFacts(c.reinforcedFacts, counts);
  }

  // Entity reinforcements
  const entities = await db.entities.where("simulationRunId").equals(simulationRunId).toArray();
  for (const e of entities) {
    const rf = e.enrichment?.reinforcedFacts;
    if (!rf?.length) continue;
    totalAnnotationsWithGuidance++;
    tallyReinforcedFacts(rf, counts);
  }

  return { counts, totalAnnotationsWithGuidance };
}

// ============================================================================
// Computed queries
// ============================================================================

/**
 * Compute entity usage statistics from existing chronicles.
 * Returns a map of entityId -> usage stats.
 */
export async function getEntityUsageStats(
  simulationRunId: string
): Promise<Map<string, EntityUsageStats>> {
  const { getChroniclesForSimulation } = await import("./chronicleQueryOps");
  const chronicles = await getChroniclesForSimulation(simulationRunId);
  const stats = new Map<string, EntityUsageStats>();

  for (const chronicle of chronicles) {
    // Only count chronicles that have been generated (not just shells)
    if (chronicle.status === "generating") continue;

    for (const entityId of chronicle.selectedEntityIds) {
      const existing = stats.get(entityId);
      if (existing) {
        existing.usageCount += 1;
        existing.chronicleIds.push(chronicle.chronicleId);
      } else {
        stats.set(entityId, {
          entityId,
          usageCount: 1,
          chronicleIds: [chronicle.chronicleId],
        });
      }
    }
  }

  return stats;
}

/**
 * Compute narrative style usage statistics from existing chronicles.
 * Returns a map of styleId -> usage stats.
 */
export async function getNarrativeStyleUsageStats(
  simulationRunId: string
): Promise<Map<string, NarrativeStyleUsageStats>> {
  const { getChroniclesForSimulation } = await import("./chronicleQueryOps");
  const chronicles = await getChroniclesForSimulation(simulationRunId);
  const stats = new Map<string, NarrativeStyleUsageStats>();

  for (const chronicle of chronicles) {
    if (!chronicle.narrativeStyleId) continue;

    const existing = stats.get(chronicle.narrativeStyleId);
    if (existing) {
      existing.usageCount += 1;
      existing.chronicleIds.push(chronicle.chronicleId);
    } else {
      stats.set(chronicle.narrativeStyleId, {
        styleId: chronicle.narrativeStyleId,
        usageCount: 1,
        chronicleIds: [chronicle.chronicleId],
      });
    }
  }

  return stats;
}
