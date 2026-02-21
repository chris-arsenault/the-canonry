/**
 * Chronicle Repository — Dexie-based access layer
 *
 * Drop-in replacement for chronicleStorage.ts, backed by the unified
 * IlluminatorDatabase instead of a standalone IndexedDB store.
 */

import { db } from './illuminatorDb';
import type {
  ChronicleRecord,
  ChronicleGenerationVersion,
  ChronicleShellMetadata,
  ChronicleMetadata,
  EntityUsageStats,
  NarrativeStyleUsageStats,
  VersionStep,
} from '../chronicleTypes';
import type { ChronicleTemporalContext, CohesionReport, ChronicleImageRefs, ChronicleCoverImage, EraTemporalInfo } from '../chronicleTypes';
import type { ChronicleStep } from '../enrichmentTypes';
import type { HistorianNote } from '../historianTypes';
import type { ChronicleRoleAssignment, ChronicleFocusType } from '../chronicleTypes';

// ============================================================================
// Re-exports (types stay in chronicleStorage for now)
// ============================================================================

export type {
  ChronicleRecord,
  ChronicleGenerationVersion,
  ChronicleShellMetadata,
  ChronicleMetadata,
  EntityUsageStats,
  NarrativeStyleUsageStats,
  VersionStep,
};

// ============================================================================
// Pure functions (no DB access)
// ============================================================================

/**
 * Generate a unique chronicle ID
 */
export function generateChronicleId(): string {
  return `chronicle_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Derive a title from role assignments
 */
export function deriveTitleFromRoles(roleAssignments: ChronicleRoleAssignment[]): string {
  const primary = roleAssignments.filter((r) => r.isPrimary);
  if (primary.length === 0) {
    const first = roleAssignments[0];
    return first ? `Chronicle of ${first.entityName}` : 'Untitled Chronicle';
  }
  if (primary.length === 1) {
    return `Chronicle of ${primary[0].entityName}`;
  }
  if (primary.length === 2) {
    return `${primary[0].entityName} and ${primary[1].entityName}`;
  }
  return `${primary[0].entityName} and ${primary.length - 1} others`;
}

/**
 * Determine focus type from role assignments
 */
export function deriveFocusType(roleAssignments: ChronicleRoleAssignment[]): ChronicleFocusType {
  const primaryCount = roleAssignments.filter((r) => r.isPrimary).length;
  if (primaryCount <= 1) return 'single';
  return 'ensemble';
}

// ============================================================================
// Private helpers
// ============================================================================

function countWords(text: string | undefined): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function normalizeVersionId(versionId: string | undefined): string | undefined {
  if (!versionId) return versionId;
  if (versionId.startsWith('current_')) {
    return `version_${versionId.slice('current_'.length)}`;
  }
  return versionId;
}

function parseVersionTimestamp(versionId: string | undefined): number | null {
  if (!versionId) return null;
  if (!versionId.startsWith('version_')) return null;
  const suffix = versionId.slice('version_'.length);
  const raw = suffix.split('_')[0];
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveVersionId(
  versions: ChronicleGenerationVersion[],
  versionId: string | undefined
): string | undefined {
  if (!versionId) return undefined;
  const normalized = normalizeVersionId(versionId);
  if (!normalized) return normalized;
  if (versions.some((v) => v.versionId === normalized)) return normalized;

  const ts = parseVersionTimestamp(normalized);
  if (ts === null) return normalized;
  const match = versions.find((v) => v.generatedAt === ts);
  return match?.versionId || normalized;
}

function getLatestVersion(
  versions: ChronicleGenerationVersion[]
): ChronicleGenerationVersion | undefined {
  if (versions.length === 0) return undefined;
  return versions.reduce(
    (latest, version) => (version.generatedAt > latest.generatedAt ? version : latest),
    versions[0]
  );
}

function getVersionIdForTimestamp(
  versions: ChronicleGenerationVersion[],
  generatedAt: number
): string | undefined {
  return versions.find((v) => v.generatedAt === generatedAt)?.versionId;
}

function createUniqueVersionId(
  existingIds: Set<string>,
  generatedAt: number
): string {
  const base = `version_${generatedAt}`;
  if (!existingIds.has(base)) return base;
  let counter = 1;
  while (existingIds.has(`${base}_${counter}`)) {
    counter += 1;
  }
  return `${base}_${counter}`;
}

function dedupeVersions(
  versions: ChronicleGenerationVersion[]
): { versions: ChronicleGenerationVersion[]; changed: boolean } {
  let changed = false;
  const byId = new Map<string, ChronicleGenerationVersion>();

  for (const version of versions) {
    const existing = byId.get(version.versionId);
    if (!existing) {
      byId.set(version.versionId, version);
      continue;
    }
    changed = true;
    if (version.generatedAt > existing.generatedAt) {
      byId.set(version.versionId, version);
      continue;
    }
    if (version.generatedAt === existing.generatedAt) {
      const existingScore = (existing.content?.length || 0) + (existing.step ? 1 : 0);
      const versionScore = (version.content?.length || 0) + (version.step ? 1 : 0);
      if (versionScore > existingScore) {
        byId.set(version.versionId, version);
      }
    }
  }

  const deduped = Array.from(byId.values()).sort((a, b) => a.generatedAt - b.generatedAt);
  if (deduped.length !== versions.length) {
    changed = true;
  }
  return { versions: deduped, changed };
}

function buildGenerationVersion(record: ChronicleRecord): ChronicleGenerationVersion | null {
  const content = record.finalContent || record.assembledContent || '';
  if (!content) return null;

  const generatedAt = record.assembledAt ?? record.createdAt;

  return {
    versionId: `version_${generatedAt}`,
    generatedAt,
    content,
    wordCount: countWords(content),
    model: record.model || 'unknown',
    sampling: record.generationSampling,
    systemPrompt:
      record.generationSystemPrompt ||
      '(prompt not stored - chronicle generated before prompt storage was implemented)',
    userPrompt:
      record.generationUserPrompt ||
      '(prompt not stored - chronicle generated before prompt storage was implemented)',
    step: record.generationStep,
  };
}

function ensureChronicleVersions(record: ChronicleRecord): boolean {
  let changed = false;
  const deduped = dedupeVersions(record.generationHistory || []);
  let versions = deduped.versions;
  if (deduped.changed) changed = true;

  const resolvedActive = resolveVersionId(versions, record.activeVersionId);
  if (resolvedActive !== record.activeVersionId) {
    record.activeVersionId = resolvedActive;
    changed = true;
  }
  const resolvedAccepted = resolveVersionId(versions, record.acceptedVersionId);
  if (resolvedAccepted !== record.acceptedVersionId) {
    record.acceptedVersionId = resolvedAccepted;
    changed = true;
  }
  const resolvedSummaryTarget = resolveVersionId(versions, record.summaryTargetVersionId);
  if (resolvedSummaryTarget !== record.summaryTargetVersionId) {
    record.summaryTargetVersionId = resolvedSummaryTarget;
    changed = true;
  }
  const resolvedImageRefsTarget = resolveVersionId(versions, record.imageRefsTargetVersionId);
  if (resolvedImageRefsTarget !== record.imageRefsTargetVersionId) {
    record.imageRefsTargetVersionId = resolvedImageRefsTarget;
    changed = true;
  }

  const hasAssembled = Boolean(record.assembledContent);
  if (hasAssembled) {
    const generatedAt = record.assembledAt ?? record.createdAt;
    const existingId = getVersionIdForTimestamp(versions, generatedAt);
    const currentVersionId = existingId
      || createUniqueVersionId(new Set(versions.map((v) => v.versionId)), generatedAt);
    const existingIndex = versions.findIndex((v) => v.versionId === currentVersionId);
    const systemPrompt =
      record.generationSystemPrompt ||
      '(prompt not stored - chronicle generated before prompt storage was implemented)';
    const userPrompt =
      record.generationUserPrompt ||
      '(prompt not stored - chronicle generated before prompt storage was implemented)';
    if (existingIndex === -1) {
      versions.push({
        versionId: currentVersionId,
        generatedAt,
        content: record.assembledContent || '',
        wordCount: countWords(record.assembledContent),
        model: record.model || 'unknown',
        sampling: record.generationSampling,
        systemPrompt,
        userPrompt,
        step: record.generationStep,
      });
      changed = true;
    } else {
      const existing = versions[existingIndex];
      const next = {
        ...existing,
        generatedAt,
        content: record.assembledContent || '',
        wordCount: countWords(record.assembledContent),
        model: record.model || existing.model,
        sampling: record.generationSampling ?? existing.sampling,
        systemPrompt: record.generationSystemPrompt || existing.systemPrompt || systemPrompt,
        userPrompt: record.generationUserPrompt || existing.userPrompt || userPrompt,
        step: record.generationStep ?? existing.step,
      };
      const changedEntry =
        next.generatedAt !== existing.generatedAt ||
        next.content !== existing.content ||
        next.wordCount !== existing.wordCount ||
        next.model !== existing.model ||
        next.sampling !== existing.sampling ||
        next.systemPrompt !== existing.systemPrompt ||
        next.userPrompt !== existing.userPrompt ||
        next.step !== existing.step;
      if (changedEntry) {
        versions[existingIndex] = next;
        changed = true;
      }
    }
  } else if (versions.length > 0) {
    const latest = getLatestVersion(versions);
    if (latest) {
      record.assembledContent = latest.content;
      record.assembledAt = latest.generatedAt;
      record.generationSampling = latest.sampling;
      record.generationStep = latest.step;
      record.model = latest.model || record.model;
      record.generationSystemPrompt = latest.systemPrompt;
      record.generationUserPrompt = latest.userPrompt;
      changed = true;
    }
  }

  if (versions.length > 0) {
    const latest = getLatestVersion(versions);
    if (!record.activeVersionId || !versions.some((v) => v.versionId === record.activeVersionId)) {
      record.activeVersionId = latest?.versionId;
      changed = true;
    }
    if (record.acceptedVersionId && !versions.some((v) => v.versionId === record.acceptedVersionId)) {
      record.acceptedVersionId = record.activeVersionId;
      changed = true;
    }
    if (record.summaryTargetVersionId && !versions.some((v) => v.versionId === record.summaryTargetVersionId)) {
      record.summaryTargetVersionId = record.activeVersionId;
      changed = true;
    }
    if (record.imageRefsTargetVersionId && !versions.some((v) => v.versionId === record.imageRefsTargetVersionId)) {
      record.imageRefsTargetVersionId = record.activeVersionId;
      changed = true;
    }
  }

  const finalDeduped = dedupeVersions(versions);
  versions = finalDeduped.versions;
  if (finalDeduped.changed) changed = true;

  if (!record.generationHistory || versions.length !== record.generationHistory.length || changed) {
    record.generationHistory = versions;
    changed = true;
  }

  // Migration: loreBackported boolean → entityBackportStatus map
  // We can't check entity backrefs from the chronicle read path, so just clear
  // the old flag. handleBackportLore detects actual backrefs live from entities.
  if ((record as any).loreBackported && !record.entityBackportStatus) {
    record.entityBackportStatus = {};
    delete (record as any).loreBackported;
    changed = true;
  }

  return changed;
}

// ============================================================================
// Create operations
// ============================================================================

/**
 * Create a shell chronicle record before generation starts.
 * This provides immediate UI feedback while generation is in progress.
 */
export async function createChronicleShell(
  chronicleId: string,
  metadata: ChronicleShellMetadata
): Promise<ChronicleRecord> {
  if (!metadata.generationSampling) {
    throw new Error(`Chronicle ${chronicleId} missing generationSampling (required)`);
  }
  const focusType = deriveFocusType(metadata.roleAssignments);
  const title = metadata.title || deriveTitleFromRoles(metadata.roleAssignments);
  const record: ChronicleRecord = {
    chronicleId,
    projectId: metadata.projectId,
    simulationRunId: metadata.simulationRunId,

    // Chronicle identity
    title,
    format: metadata.format,
    focusType,
    narrativeStyleId: metadata.narrativeStyleId,
    narrativeStyle: metadata.narrativeStyle,
    roleAssignments: metadata.roleAssignments,
    lens: metadata.lens,
    selectedEntityIds: metadata.selectedEntityIds,
    selectedEventIds: metadata.selectedEventIds,
    selectedRelationshipIds: metadata.selectedRelationshipIds,
    temporalContext: metadata.temporalContext,
    generationSampling: metadata.generationSampling,
    narrativeDirection: metadata.narrativeDirection,

    // Mechanical
    entrypointId: metadata.entrypointId,

    // Generation state - starts as 'generating'
    status: 'generating',
    editVersion: 0,
    validationStale: false,
    totalEstimatedCost: 0,
    totalActualCost: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    model: metadata.model,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await db.chronicles.put(record);
  return record;
}

/**
 * Create a chronicle record (single-shot generation, goes directly to assembly_ready)
 */
export async function createChronicle(
  chronicleId: string,
  metadata: ChronicleMetadata
): Promise<ChronicleRecord> {
  if (!metadata.generationSampling) {
    throw new Error(`Chronicle ${chronicleId} missing generationSampling (required)`);
  }
  const focusType = deriveFocusType(metadata.roleAssignments);
  const title = metadata.title || deriveTitleFromRoles(metadata.roleAssignments);
  const assembledAt = Date.now();
  const activeVersionId = createUniqueVersionId(new Set(), assembledAt);
  const initialVersion: ChronicleGenerationVersion = {
    versionId: activeVersionId,
    generatedAt: assembledAt,
    content: metadata.assembledContent,
    wordCount: countWords(metadata.assembledContent),
    model: metadata.model,
    sampling: metadata.generationSampling,
    systemPrompt: metadata.generationSystemPrompt,
    userPrompt: metadata.generationUserPrompt,
    step: 'generate',
  };
  const record: ChronicleRecord = {
    chronicleId,
    projectId: metadata.projectId,
    simulationRunId: metadata.simulationRunId,

    // Chronicle identity
    title,
    format: metadata.format,
    focusType,
    narrativeStyleId: metadata.narrativeStyleId,
    narrativeStyle: metadata.narrativeStyle,
    roleAssignments: metadata.roleAssignments,
    lens: metadata.lens,
    selectedEntityIds: metadata.selectedEntityIds,
    selectedEventIds: metadata.selectedEventIds,
    selectedRelationshipIds: metadata.selectedRelationshipIds,
    temporalContext: metadata.temporalContext,
    narrativeDirection: metadata.narrativeDirection,

    // Mechanical
    entrypointId: metadata.entrypointId,

    // Generation result
    selectionSummary: metadata.selectionSummary,
    perspectiveSynthesis: metadata.perspectiveSynthesis,
    generationSystemPrompt: metadata.generationSystemPrompt,
    generationUserPrompt: metadata.generationUserPrompt,
    generationSampling: metadata.generationSampling,
    generationStep: 'generate',
    generationHistory: [initialVersion],
    activeVersionId,
    status: 'assembly_ready',
    assembledContent: metadata.assembledContent,
    assembledAt,
    editVersion: 0,
    validationStale: false,
    totalEstimatedCost: metadata.cost.estimated,
    totalActualCost: metadata.cost.actual,
    totalInputTokens: metadata.cost.inputTokens,
    totalOutputTokens: metadata.cost.outputTokens,
    model: metadata.model,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await db.chronicles.put(record);
  return record;
}

// ============================================================================
// Read-modify-write operations
// ============================================================================

/**
 * Update chronicle with assembled content (regeneration)
 */
export async function updateChronicleAssembly(
  chronicleId: string,
  assembledContent: string
): Promise<void> {
  const record = await db.chronicles.get(chronicleId);
  if (!record) throw new Error(`Chronicle ${chronicleId} not found`);

  ensureChronicleVersions(record);
  const generatedAt = Date.now();
  const existingIds = new Set((record.generationHistory || []).map((v) => v.versionId));
  const versionId = createUniqueVersionId(existingIds, generatedAt);
  const systemPrompt =
    record.generationSystemPrompt ||
    '(prompt not stored - chronicle generated before prompt storage was implemented)';
  const userPrompt =
    record.generationUserPrompt ||
    '(prompt not stored - chronicle generated before prompt storage was implemented)';
  const nextVersion: ChronicleGenerationVersion = {
    versionId,
    generatedAt,
    content: assembledContent,
    wordCount: countWords(assembledContent),
    model: record.model || 'unknown',
    sampling: record.generationSampling,
    systemPrompt,
    userPrompt,
    step: record.generationStep,
  };
  record.generationHistory = [...(record.generationHistory || []), nextVersion];

  record.assembledContent = assembledContent;
  record.assembledAt = generatedAt;
  record.status = 'assembly_ready';
  record.failureStep = undefined;
  record.failureReason = undefined;
  record.failedAt = undefined;
  record.summary = undefined;
  record.summaryGeneratedAt = undefined;
  record.summaryModel = undefined;
  record.summaryTargetVersionId = undefined;
  // Preserve imageRefs and coverImage - user decides via keep/regenerate UI
  record.validationStale = false;
  record.updatedAt = Date.now();
  record.activeVersionId = nextVersion.versionId;

  await db.chronicles.put(record);
}

/**
 * Replace chronicle assembled content via sampling regeneration.
 * Appends a new version to generationHistory and clears refinements.
 */
export async function regenerateChronicleAssembly(
  chronicleId: string,
  updates: {
    assembledContent: string;
    systemPrompt: string;
    userPrompt: string;
    model: string;
    sampling?: ChronicleRecord['generationSampling'];
    cost: { estimated: number; actual: number; inputTokens: number; outputTokens: number };
    step?: VersionStep;
  }
): Promise<void> {
  const record = await db.chronicles.get(chronicleId);
  if (!record) throw new Error(`Chronicle ${chronicleId} not found`);
  if (record.status === 'complete' || record.finalContent) {
    throw new Error(`Chronicle ${chronicleId} is already accepted`);
  }
  if (!updates.sampling) {
    throw new Error(`Chronicle ${chronicleId} missing sampling for regeneration`);
  }

  ensureChronicleVersions(record);
  const generatedAt = Date.now();
  const existingIds = new Set((record.generationHistory || []).map((v) => v.versionId));
  const versionId = createUniqueVersionId(existingIds, generatedAt);
  const nextVersion: ChronicleGenerationVersion = {
    versionId,
    generatedAt,
    content: updates.assembledContent,
    wordCount: countWords(updates.assembledContent),
    model: updates.model,
    sampling: updates.sampling,
    systemPrompt: updates.systemPrompt,
    userPrompt: updates.userPrompt,
    step: updates.step,
  };
  record.generationHistory = [...(record.generationHistory || []), nextVersion];

  record.assembledContent = updates.assembledContent;
  record.assembledAt = generatedAt;
  record.status = 'assembly_ready';
  record.generationSystemPrompt = updates.systemPrompt;
  record.generationUserPrompt = updates.userPrompt;
  record.generationSampling = updates.sampling;
  record.generationStep = updates.step;
  record.activeVersionId = nextVersion.versionId;

  record.failureStep = undefined;
  record.failureReason = undefined;
  record.failedAt = undefined;
  record.cohesionReport = undefined;
  record.validatedAt = undefined;
  record.summary = undefined;
  record.summaryGeneratedAt = undefined;
  record.summaryModel = undefined;
  record.summaryTargetVersionId = undefined;
  // Preserve imageRefs and coverImage - user decides via keep/regenerate UI
  record.validationStale = false;
  record.editVersion = 0;
  record.editedAt = undefined;

  record.totalEstimatedCost += updates.cost.estimated;
  record.totalActualCost += updates.cost.actual;
  record.totalInputTokens += updates.cost.inputTokens;
  record.totalOutputTokens += updates.cost.outputTokens;
  record.model = updates.model;
  record.updatedAt = Date.now();

  await db.chronicles.put(record);
}

/**
 * Update chronicle with revised content (post-validation edits)
 */
export async function updateChronicleEdit(
  chronicleId: string,
  assembledContent: string,
  cost?: { estimated: number; actual: number; inputTokens: number; outputTokens: number }
): Promise<void> {
  const record = await db.chronicles.get(chronicleId);
  if (!record) throw new Error(`Chronicle ${chronicleId} not found`);

  ensureChronicleVersions(record);
  const generatedAt = Date.now();
  const existingIds = new Set((record.generationHistory || []).map((v) => v.versionId));
  const versionId = createUniqueVersionId(existingIds, generatedAt);
  const systemPrompt =
    record.generationSystemPrompt ||
    '(prompt not stored - chronicle generated before prompt storage was implemented)';
  const userPrompt =
    record.generationUserPrompt ||
    '(prompt not stored - chronicle generated before prompt storage was implemented)';
  const nextVersion: ChronicleGenerationVersion = {
    versionId,
    generatedAt,
    content: assembledContent,
    wordCount: countWords(assembledContent),
    model: record.model || 'unknown',
    sampling: record.generationSampling,
    systemPrompt,
    userPrompt,
    step: record.generationStep,
  };
  record.generationHistory = [...(record.generationHistory || []), nextVersion];

  record.assembledContent = assembledContent;
  record.assembledAt = generatedAt;
  record.editedAt = generatedAt;
  record.editVersion = (record.editVersion || 0) + 1;
  record.cohesionReport = undefined;
  record.validatedAt = undefined;
  record.summary = undefined;
  record.summaryGeneratedAt = undefined;
  record.summaryModel = undefined;
  // Preserve imageRefs and coverImage - user decides via keep/regenerate UI
  record.validationStale = false;
  record.status = 'editing';
  record.failureStep = undefined;
  record.failureReason = undefined;
  record.failedAt = undefined;
  if (cost) {
    record.totalEstimatedCost += cost.estimated;
    record.totalActualCost += cost.actual;
    record.totalInputTokens += cost.inputTokens;
    record.totalOutputTokens += cost.outputTokens;
  }
  record.activeVersionId = nextVersion.versionId;
  record.updatedAt = Date.now();

  await db.chronicles.put(record);
}

/**
 * Mark chronicle as failed (worker error)
 */
export async function updateChronicleFailure(
  chronicleId: string,
  step: ChronicleStep,
  reason: string
): Promise<void> {
  const record = await db.chronicles.get(chronicleId);
  if (!record) throw new Error(`Chronicle ${chronicleId} not found`);

  record.status = 'failed';
  record.failureStep = step;
  record.failureReason = reason;
  record.failedAt = Date.now();
  record.updatedAt = Date.now();

  await db.chronicles.put(record);
}

/**
 * Update chronicle with cohesion report (validation complete)
 */
export async function updateChronicleCohesion(
  chronicleId: string,
  cohesionReport: CohesionReport,
  cost: { estimated: number; actual: number; inputTokens: number; outputTokens: number }
): Promise<void> {
  const record = await db.chronicles.get(chronicleId);
  if (!record) throw new Error(`Chronicle ${chronicleId} not found`);

  record.cohesionReport = cohesionReport;
  record.validatedAt = Date.now();
  record.status = 'validation_ready';
  record.failureStep = undefined;
  record.failureReason = undefined;
  record.failedAt = undefined;
  record.validationStale = false;
  record.totalEstimatedCost += cost.estimated;
  record.totalActualCost += cost.actual;
  record.totalInputTokens += cost.inputTokens;
  record.totalOutputTokens += cost.outputTokens;
  record.updatedAt = Date.now();

  await db.chronicles.put(record);
}

/**
 * Store a version comparison report (text analysis, no new draft).
 */
export async function updateChronicleComparisonReport(
  chronicleId: string,
  report: string,
  combineInstructions?: string
): Promise<void> {
  const record = await db.chronicles.get(chronicleId);
  if (!record) throw new Error(`Chronicle ${chronicleId} not found`);

  record.comparisonReport = report;
  record.comparisonReportGeneratedAt = Date.now();
  if (combineInstructions) {
    record.combineInstructions = combineInstructions;
  }
  record.updatedAt = Date.now();

  await db.chronicles.put(record);
}

export async function updateChronicleTemporalCheckReport(
  chronicleId: string,
  report: string
): Promise<void> {
  const record = await db.chronicles.get(chronicleId);
  if (!record) throw new Error(`Chronicle ${chronicleId} not found`);

  record.temporalCheckReport = report;
  record.temporalCheckReportGeneratedAt = Date.now();
  record.updatedAt = Date.now();

  await db.chronicles.put(record);
}

export async function updateChronicleQuickCheckReport(
  chronicleId: string,
  report: import('../chronicleTypes').QuickCheckReport,
): Promise<void> {
  const record = await db.chronicles.get(chronicleId);
  if (!record) throw new Error(`Chronicle ${chronicleId} not found`);

  record.quickCheckReport = report;
  record.quickCheckReportGeneratedAt = Date.now();
  record.updatedAt = Date.now();

  await db.chronicles.put(record);
}

/**
 * Update chronicle fact coverage analysis report
 */
export async function updateChronicleFactCoverage(
  chronicleId: string,
  report: import('../chronicleTypes').FactCoverageReport,
): Promise<void> {
  const record = await db.chronicles.get(chronicleId);
  if (!record) throw new Error(`Chronicle ${chronicleId} not found`);

  record.factCoverageReport = report;
  record.factCoverageReportGeneratedAt = Date.now();
  record.updatedAt = Date.now();

  await db.chronicles.put(record);
}

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
      (record.perspectiveSynthesis?.facets ?? []).map((f: { factId: string }) => f.factId),
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
 * Returns a Map of factId → strength percentage (0-100).
 * Weighted: integral=3, prevalent=2, mentioned=1, missing=0, divided by max possible.
 */
export async function computeCorpusFactStrength(simulationRunId: string): Promise<Map<string, number>> {
  const chronicles = await db.chronicles.where('simulationRunId').equals(simulationRunId).toArray();
  const totals = new Map<string, { weighted: number; count: number }>();

  const ratingWeight: Record<string, number> = { integral: 3, prevalent: 2, mentioned: 1, missing: 0 };

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

/**
 * Count how many annotations have reinforced each canon fact.
 * Scans both chronicle.reinforcedFacts and entity.enrichment.reinforcedFacts.
 */
export async function computeAnnotationReinforcementCounts(
  simulationRunId: string,
): Promise<ReinforcementCounts> {
  const counts = new Map<string, number>();
  let totalAnnotationsWithGuidance = 0;

  // Chronicle reinforcements
  const chronicles = await db.chronicles.where('simulationRunId').equals(simulationRunId).toArray();
  for (const c of chronicles) {
    if (!c.reinforcedFacts?.length) continue;
    totalAnnotationsWithGuidance++;
    for (const factId of c.reinforcedFacts) {
      counts.set(factId, (counts.get(factId) ?? 0) + 1);
    }
  }

  // Entity reinforcements
  const entities = await db.entities.where('simulationRunId').equals(simulationRunId).toArray();
  for (const e of entities) {
    const rf = e.enrichment?.reinforcedFacts;
    if (!rf?.length) continue;
    totalAnnotationsWithGuidance++;
    for (const factId of rf) {
      counts.set(factId, (counts.get(factId) ?? 0) + 1);
    }
  }

  return { counts, totalAnnotationsWithGuidance };
}

/**
 * Update chronicle tertiary cast (detected entity mentions not in declared cast)
 */
export async function updateChronicleTertiaryCast(
  chronicleId: string,
  entries: import('../chronicleTypes').TertiaryCastEntry[],
): Promise<void> {
  const record = await db.chronicles.get(chronicleId);
  if (!record) throw new Error(`Chronicle ${chronicleId} not found`);

  record.tertiaryCast = entries;
  record.tertiaryCastDetectedAt = Date.now();
  record.updatedAt = Date.now();

  await db.chronicles.put(record);
}

/**
 * Update chronicle with historian prep brief
 */
export async function updateChronicleHistorianPrep(
  chronicleId: string,
  historianPrep: string
): Promise<void> {
  const record = await db.chronicles.get(chronicleId);
  if (!record) throw new Error(`Chronicle ${chronicleId} not found`);

  record.historianPrep = historianPrep;
  record.historianPrepGeneratedAt = Date.now();
  record.updatedAt = Date.now();

  await db.chronicles.put(record);
}

/**
 * Update chronicle with summary and title refinement
 */
export async function updateChronicleSummary(
  chronicleId: string,
  summary: string,
  cost: { estimated: number; actual: number; inputTokens: number; outputTokens: number },
  model: string,
  targetVersionId?: string
): Promise<void> {
  const record = await db.chronicles.get(chronicleId);
  if (!record) throw new Error(`Chronicle ${chronicleId} not found`);

  record.summary = summary;
  record.summaryGeneratedAt = Date.now();
  record.summaryModel = model;
  record.summaryTargetVersionId = targetVersionId;
  record.totalEstimatedCost += cost.estimated;
  record.totalActualCost += cost.actual;
  record.totalInputTokens += cost.inputTokens;
  record.totalOutputTokens += cost.outputTokens;
  record.updatedAt = Date.now();

  await db.chronicles.put(record);
}

/**
 * Update chronicle with title generation results.
 * Always writes to pending fields — user must accept via modal.
 */
export async function updateChronicleTitle(
  chronicleId: string,
  title: string,
  candidates: string[],
  fragments: string[],
  cost: { estimated: number; actual: number; inputTokens: number; outputTokens: number },
  model: string,
): Promise<void> {
  const record = await db.chronicles.get(chronicleId);
  if (!record) throw new Error(`Chronicle ${chronicleId} not found`);

  record.pendingTitle = title;
  record.pendingTitleCandidates = candidates;
  record.pendingTitleFragments = fragments;
  record.titleFragments = fragments;
  record.titleGeneratedAt = Date.now();
  record.titleModel = model;
  record.totalEstimatedCost += cost.estimated;
  record.totalActualCost += cost.actual;
  record.totalInputTokens += cost.inputTokens;
  record.totalOutputTokens += cost.outputTokens;
  record.updatedAt = Date.now();

  await db.chronicles.put(record);
}

/**
 * Accept a pending title
 */
export async function acceptPendingTitle(chronicleId: string, chosenTitle?: string): Promise<void> {
  const record = await db.chronicles.get(chronicleId);
  if (!record) throw new Error(`Chronicle ${chronicleId} not found`);
  if (!record.pendingTitle) throw new Error(`No pending title for chronicle ${chronicleId}`);

  record.title = chosenTitle || record.pendingTitle;
  record.titleCandidates = record.pendingTitleCandidates;
  record.pendingTitle = undefined;
  record.pendingTitleCandidates = undefined;
  record.pendingTitleFragments = undefined;
  record.updatedAt = Date.now();

  await db.chronicles.put(record);
}

/**
 * Reject a pending title on a published chronicle
 */
export async function rejectPendingTitle(chronicleId: string): Promise<void> {
  const record = await db.chronicles.get(chronicleId);
  if (!record) throw new Error(`Chronicle ${chronicleId} not found`);

  record.pendingTitle = undefined;
  record.pendingTitleCandidates = undefined;
  record.pendingTitleFragments = undefined;
  record.updatedAt = Date.now();

  await db.chronicles.put(record);
}

/**
 * Update chronicle with image refs refinement
 */
export async function updateChronicleImageRefs(
  chronicleId: string,
  imageRefs: ChronicleImageRefs,
  cost: { estimated: number; actual: number; inputTokens: number; outputTokens: number },
  model: string,
  targetVersionId?: string
): Promise<void> {
  const record = await db.chronicles.get(chronicleId);
  if (!record) throw new Error(`Chronicle ${chronicleId} not found`);

  record.imageRefs = imageRefs;
  record.imageRefsGeneratedAt = Date.now();
  record.imageRefsModel = model;
  record.imageRefsTargetVersionId = targetVersionId;
  record.totalEstimatedCost += cost.estimated;
  record.totalActualCost += cost.actual;
  record.totalInputTokens += cost.inputTokens;
  record.totalOutputTokens += cost.outputTokens;
  record.updatedAt = Date.now();

  await db.chronicles.put(record);
}

/**
 * Update a single image ref within a chronicle (e.g., after generating an image for a prompt request)
 */
export async function updateChronicleImageRef(
  chronicleId: string,
  refId: string,
  updates: {
    status?: 'pending' | 'generating' | 'complete' | 'failed';
    generatedImageId?: string;
    error?: string;
    anchorText?: string;
    anchorIndex?: number;
    caption?: string;
    size?: 'small' | 'medium' | 'large' | 'full-width';
    justification?: 'left' | 'right' | null;
    sceneDescription?: string;
  }
): Promise<void> {
  const record = await db.chronicles.get(chronicleId);
  if (!record) throw new Error(`Chronicle ${chronicleId} not found`);
  if (!record.imageRefs) throw new Error(`Chronicle ${chronicleId} has no image refs`);

  const refIndex = record.imageRefs.refs.findIndex((r) => r.refId === refId);
  if (refIndex === -1) {
    throw new Error(`Image ref ${refId} not found in chronicle ${chronicleId}`);
  }

  const ref = record.imageRefs.refs[refIndex];
  const wantsPromptUpdates =
    updates.status !== undefined || updates.generatedImageId !== undefined ||
    updates.error !== undefined || updates.sceneDescription !== undefined;

  if (wantsPromptUpdates && ref.type !== 'prompt_request') {
    throw new Error(`Image ref ${refId} is not a prompt request`);
  }

  // Apply base updates
  if (updates.anchorText !== undefined) {
    ref.anchorText = updates.anchorText;
    if (updates.anchorIndex === undefined) {
      ref.anchorIndex = undefined;
    }
  }
  if (updates.anchorIndex !== undefined) ref.anchorIndex = updates.anchorIndex;
  if (updates.caption !== undefined) ref.caption = updates.caption;
  if (updates.size !== undefined) ref.size = updates.size;
  if (updates.justification !== undefined) {
    if (updates.justification) {
      ref.justification = updates.justification;
    } else {
      delete ref.justification;
    }
  }

  // Apply prompt request updates
  if (ref.type === 'prompt_request') {
    if (updates.sceneDescription !== undefined) ref.sceneDescription = updates.sceneDescription;
    if (updates.status !== undefined) ref.status = updates.status;
    if (updates.generatedImageId !== undefined) {
      if (updates.generatedImageId) {
        ref.generatedImageId = updates.generatedImageId;
      } else {
        delete ref.generatedImageId;
      }
    }
    if (updates.error !== undefined) {
      if (updates.error) {
        ref.error = updates.error;
      } else {
        delete ref.error;
      }
    }
  }

  record.updatedAt = Date.now();

  await db.chronicles.put(record);
}

/**
 * Apply image ref selections after version change.
 * - 'reuse': Keep the ref as-is
 * - 'regenerate': Reset the ref (clear generated image, set status to pending)
 * - 'skip': Remove the ref entirely
 *
 * Also updates imageRefsTargetVersionId to the new version.
 */
export async function applyImageRefSelections(
  chronicleId: string,
  selections: Array<{ refId: string; action: 'reuse' | 'regenerate' | 'skip' }>,
  newTargetVersionId: string
): Promise<void> {
  const record = await db.chronicles.get(chronicleId);
  if (!record) throw new Error(`Chronicle ${chronicleId} not found`);
  if (!record.imageRefs) throw new Error(`Chronicle ${chronicleId} has no image refs`);

  const selectionMap = new Map(selections.map((s) => [s.refId, s.action]));

  // Filter and transform refs based on selections
  const updatedRefs = record.imageRefs.refs
    .filter((ref) => {
      const action = selectionMap.get(ref.refId) ?? 'reuse';
      return action !== 'skip';
    })
    .map((ref) => {
      const action = selectionMap.get(ref.refId) ?? 'reuse';
      if (action === 'regenerate' && ref.type === 'prompt_request') {
        // Reset prompt request refs for regeneration
        return {
          ...ref,
          status: 'pending' as const,
          generatedImageId: undefined,
          error: undefined,
        };
      }
      return ref;
    });

  record.imageRefs = {
    ...record.imageRefs,
    refs: updatedRefs,
  };
  record.imageRefsTargetVersionId = newTargetVersionId;
  record.updatedAt = Date.now();

  await db.chronicles.put(record);
}

/**
 * Update chronicle with cover image scene description
 */
export async function updateChronicleCoverImage(
  chronicleId: string,
  coverImage: ChronicleCoverImage,
  cost: { estimated: number; actual: number; inputTokens: number; outputTokens: number },
  model: string
): Promise<void> {
  const record = await db.chronicles.get(chronicleId);
  if (!record) throw new Error(`Chronicle ${chronicleId} not found`);

  record.coverImage = coverImage;
  record.coverImageGeneratedAt = Date.now();
  record.coverImageModel = model;
  record.totalEstimatedCost += cost.estimated;
  record.totalActualCost += cost.actual;
  record.totalInputTokens += cost.inputTokens;
  record.totalOutputTokens += cost.outputTokens;
  record.updatedAt = Date.now();

  await db.chronicles.put(record);
}

/**
 * Update cover image generation status (after image generation completes)
 */
export async function updateChronicleCoverImageStatus(
  chronicleId: string,
  updates: {
    status: 'pending' | 'generating' | 'complete' | 'failed';
    generatedImageId?: string;
    error?: string;
  }
): Promise<void> {
  const record = await db.chronicles.get(chronicleId);
  if (!record) throw new Error(`Chronicle ${chronicleId} not found`);
  if (!record.coverImage) throw new Error(`Chronicle ${chronicleId} has no cover image`);

  record.coverImage.status = updates.status;
  if (updates.generatedImageId !== undefined) {
    record.coverImage.generatedImageId = updates.generatedImageId || undefined;
  }
  if (updates.error !== undefined) {
    record.coverImage.error = updates.error || undefined;
  }
  record.updatedAt = Date.now();

  await db.chronicles.put(record);
}

/**
 * Update chronicle temporal context (e.g., post-publish corrections)
 */
export async function updateChronicleTemporalContext(
  chronicleId: string,
  temporalContext: ChronicleTemporalContext | undefined | null
): Promise<void> {
  const record = await db.chronicles.get(chronicleId);
  if (!record) throw new Error(`Chronicle ${chronicleId} not found`);

  if (temporalContext) {
    record.temporalContext = temporalContext;
  } else {
    delete record.temporalContext;
  }
  record.updatedAt = Date.now();

  await db.chronicles.put(record);
}

/**
 * Refresh era summaries in all chronicles for a simulation run.
 * Patches three snapshot locations where era summaries are stored:
 *   1. temporalContext.allEras[].summary
 *   2. temporalContext.focalEra.summary
 *   3. perspectiveSynthesis.focalEra.description
 * Returns count of chronicles that were actually updated.
 */
export async function refreshEraSummariesInChronicles(
  simulationRunId: string,
  currentEras: EraTemporalInfo[],
): Promise<number> {
  const summaryMap = new Map(currentEras.map(e => [e.id, e.summary || '']));
  const records = await db.chronicles.where('simulationRunId').equals(simulationRunId).toArray();

  const toUpdate: ChronicleRecord[] = [];

  for (const record of records) {
    let changed = false;

    // Patch temporalContext.allEras + focalEra
    if (record.temporalContext) {
      const patchedAllEras = record.temporalContext.allEras.map(era => {
        const newSummary = summaryMap.get(era.id);
        if (newSummary !== undefined && newSummary !== era.summary) {
          changed = true;
          return { ...era, summary: newSummary };
        }
        return era;
      });

      let patchedFocalEra = record.temporalContext.focalEra;
      const focalSummary = summaryMap.get(patchedFocalEra.id);
      if (focalSummary !== undefined && focalSummary !== patchedFocalEra.summary) {
        changed = true;
        patchedFocalEra = { ...patchedFocalEra, summary: focalSummary };
      }

      if (changed) {
        record.temporalContext = {
          ...record.temporalContext,
          allEras: patchedAllEras,
          focalEra: patchedFocalEra,
        };
      }
    }

    // Patch perspectiveSynthesis.focalEra.description
    if (record.perspectiveSynthesis?.focalEra?.id) {
      const newSummary = summaryMap.get(record.perspectiveSynthesis.focalEra.id);
      if (newSummary !== undefined && newSummary !== record.perspectiveSynthesis.focalEra.description) {
        changed = true;
        record.perspectiveSynthesis = {
          ...record.perspectiveSynthesis,
          focalEra: {
            ...record.perspectiveSynthesis.focalEra,
            description: newSummary,
          },
        };
      }
    }

    if (changed) {
      record.updatedAt = Date.now();
      toUpdate.push(record);
    }
  }

  if (toUpdate.length > 0) {
    await db.chronicles.bulkPut(toUpdate);
  }

  return toUpdate.length;
}

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
  const versions = record.generationHistory || [];
  const fallbackActive = getLatestVersion(versions)?.versionId;
  const activeVersionId = options?.acceptedVersionId || record.activeVersionId || fallbackActive;
  const activeVersion = versions.find((v) => v.versionId === activeVersionId);
  const acceptedVersionId = activeVersionId || record.acceptedVersionId;

  record.finalContent = options?.finalContent ?? activeVersion?.content ?? record.assembledContent;
  record.acceptedVersionId = acceptedVersionId;
  record.activeVersionId = acceptedVersionId;
  record.acceptedAt = Date.now();
  record.status = 'complete';
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
  record.status = 'assembly_ready';
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

  if (record.status === 'complete' || record.finalContent) {
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
 * Manually set or update combine instructions for a chronicle.
 */
export async function updateChronicleCombineInstructions(
  chronicleId: string,
  combineInstructions: string | undefined
): Promise<void> {
  const record = await db.chronicles.get(chronicleId);
  if (!record) throw new Error(`Chronicle ${chronicleId} not found`);

  if (combineInstructions) {
    record.combineInstructions = combineInstructions;
  } else {
    delete record.combineInstructions;
  }
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

  if (record.status === 'complete' || record.finalContent) {
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

  const latest = getLatestVersion(versions);
  const isCurrentVersion = latest?.versionId === versionId;
  const remaining = versions.filter((v) => v.versionId !== versionId);

  if (isCurrentVersion) {
    const nextLatest = getLatestVersion(remaining);
    if (!nextLatest) {
      throw new Error(`Cannot delete current version with no history to restore`);
    }
    record.assembledContent = nextLatest.content;
    record.assembledAt = nextLatest.generatedAt;
    record.model = nextLatest.model || record.model;
    record.generationSystemPrompt = nextLatest.systemPrompt;
    record.generationUserPrompt = nextLatest.userPrompt;
    record.generationSampling = nextLatest.sampling;
    record.generationStep = nextLatest.step;
  }

  record.generationHistory = remaining;

  if (record.activeVersionId === versionId) {
    record.activeVersionId = getLatestVersion(remaining)?.versionId;
  }
  if (record.summaryTargetVersionId === versionId) {
    record.summaryTargetVersionId = record.activeVersionId;
  }
  if (record.imageRefsTargetVersionId === versionId) {
    record.imageRefsTargetVersionId = record.activeVersionId;
  }

  record.updatedAt = Date.now();
  await db.chronicles.put(record);
}

/**
 * Merge per-entity backport status entries into a chronicle's entityBackportStatus map.
 */
export async function updateChronicleEntityBackportStatus(
  chronicleId: string,
  entries: import('../chronicleTypes').EntityBackportEntry[],
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

/**
 * Update historian notes on a chronicle.
 */
export async function updateChronicleHistorianNotes(
  chronicleId: string,
  historianNotes: HistorianNote[],
  prompts?: { systemPrompt: string; userPrompt: string },
  reinforcedFacts?: string[],
): Promise<void> {
  const record = await db.chronicles.get(chronicleId);
  if (!record) throw new Error(`Chronicle ${chronicleId} not found`);

  record.historianNotes = historianNotes;
  if (reinforcedFacts) {
    record.reinforcedFacts = reinforcedFacts;
  }
  if (prompts) {
    record.historianReviewSystemPrompt = prompts.systemPrompt;
    record.historianReviewUserPrompt = prompts.userPrompt;
  }
  record.updatedAt = Date.now();

  await db.chronicles.put(record);
}

/**
 * Start validation step (user approved assembly)
 */
export async function startChronicleValidation(chronicleId: string): Promise<void> {
  const record = await db.chronicles.get(chronicleId);
  if (!record) throw new Error(`Chronicle ${chronicleId} not found`);

  record.status = 'validating';
  record.updatedAt = Date.now();

  await db.chronicles.put(record);
}

// ============================================================================
// Read operations
// ============================================================================

/**
 * Get a chronicle record
 */
/**
 * Batch update historian-assigned era years for multiple chronicles.
 */
export async function batchUpdateChronicleEraYears(
  assignments: Array<{ chronicleId: string; eraYear: number; eraYearReasoning?: string }>
): Promise<number> {
  const ids = assignments.map(a => a.chronicleId);
  const records = await db.chronicles.where('chronicleId').anyOf(ids).toArray();
  const recordMap = new Map(records.map(r => [r.chronicleId, r]));
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

export async function getChronicle(chronicleId: string): Promise<ChronicleRecord | undefined> {
  const record = await db.chronicles.get(chronicleId);
  if (record && ensureChronicleVersions(record)) {
    await db.chronicles.put(record);
  }
  return record;
}

/**
 * Get all chronicles for a specific simulation run
 */
export async function getChroniclesForSimulation(simulationRunId: string): Promise<ChronicleRecord[]> {
  const records = await db.chronicles.where('simulationRunId').equals(simulationRunId).toArray();
  const updates: ChronicleRecord[] = [];
  for (const record of records) {
    if (ensureChronicleVersions(record)) {
      updates.push(record);
    }
  }
  if (updates.length > 0) {
    await db.chronicles.bulkPut(updates);
  }
  return records;
}

/**
 * Delete a chronicle
 */
export async function deleteChronicle(chronicleId: string): Promise<void> {
  await db.chronicles.delete(chronicleId);
}

/**
 * Delete all chronicles for a simulation run
 */
export async function deleteChroniclesForSimulation(simulationRunId: string): Promise<number> {
  const chronicles = await getChroniclesForSimulation(simulationRunId);
  if (chronicles.length === 0) return 0;

  const ids = chronicles.map((c) => c.chronicleId);
  await db.chronicles.bulkDelete(ids);
  return chronicles.length;
}

// ============================================================================
// Entity Rename Support
// ============================================================================

/**
 * Write a fully-updated chronicle record back to the database.
 * Used by the entity rename flow to persist chronicle patches.
 */
export async function putChronicle(record: ChronicleRecord): Promise<void> {
  await db.chronicles.put(record);
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
  const chronicles = await getChroniclesForSimulation(simulationRunId);
  const stats = new Map<string, EntityUsageStats>();

  for (const chronicle of chronicles) {
    // Only count chronicles that have been generated (not just shells)
    if (chronicle.status === 'generating') continue;

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

// ============================================================================
// Bulk Operations
// ============================================================================

/**
 * Reconcile entityBackportStatus on all chronicles from actual entity backref data.
 * For each chronicle, checks every eligible entity's chronicleBackrefs to see if
 * a backref exists for that chronicle. Sets 'backported' only where a real backref
 * exists; removes all other entries (including stale 'backported' or 'not_needed').
 * Returns the count of chronicles that were updated.
 */
export async function reconcileBackportStatusFromEntities(
  simulationRunId: string,
  entities: Array<{ id: string; enrichment?: { chronicleBackrefs?: Array<{ chronicleId: string }> } }>,
): Promise<number> {
  const chronicles = await getChroniclesForSimulation(simulationRunId);

  // Build entity → set of chronicleIds with backrefs
  const entityBackrefs = new Map<string, Set<string>>();
  for (const entity of entities) {
    const refs = entity.enrichment?.chronicleBackrefs;
    if (refs && refs.length > 0) {
      entityBackrefs.set(entity.id, new Set(refs.map(r => r.chronicleId)));
    }
  }

  const now = Date.now();
  const toUpdate: ChronicleRecord[] = [];

  for (const chronicle of chronicles) {
    // Determine eligible entity IDs for this chronicle
    const eligibleIds = new Set<string>();
    for (const r of chronicle.roleAssignments || []) eligibleIds.add(r.entityId);
    if (chronicle.lens) eligibleIds.add(chronicle.lens.entityId);
    for (const t of chronicle.tertiaryCast || []) {
      if (t.accepted) eligibleIds.add(t.entityId);
    }

    // Build new status map from actual backrefs only
    const newStatus: Record<string, import('../chronicleTypes').EntityBackportEntry> = {};
    for (const entityId of eligibleIds) {
      const backrefSet = entityBackrefs.get(entityId);
      if (backrefSet && backrefSet.has(chronicle.chronicleId)) {
        newStatus[entityId] = { entityId, status: 'backported', updatedAt: now };
      }
    }

    // Check if changed
    const oldStatus = chronicle.entityBackportStatus || {};
    const oldKeys = Object.keys(oldStatus).sort();
    const newKeys = Object.keys(newStatus).sort();
    const changed = oldKeys.length !== newKeys.length
      || oldKeys.some((k, i) => k !== newKeys[i])
      || oldKeys.some(k => oldStatus[k].status !== newStatus[k]?.status);

    if (changed) {
      chronicle.entityBackportStatus = newStatus;
      chronicle.updatedAt = now;
      toUpdate.push(chronicle);
    }
  }

  if (toUpdate.length > 0) {
    await db.chronicles.bulkPut(toUpdate);
  }

  return toUpdate.length;
}

/**
 * Reset entityBackportStatus on all chronicles in a simulation.
 * Returns the count of chronicles that were updated.
 */
export async function resetAllBackportFlags(simulationRunId: string): Promise<number> {
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
// Tone Ranking & Assignment
// ============================================================================

export async function updateChronicleToneRanking(
  chronicleId: string,
  ranking: [string, string, string],
  rationale: string,
  cost?: number,
  rationales?: Record<string, string>,
): Promise<void> {
  const record = await db.chronicles.get(chronicleId);
  if (!record) throw new Error(`Chronicle ${chronicleId} not found`);

  record.toneRanking = {
    ranking: ranking as [import('../historianTypes').HistorianTone, import('../historianTypes').HistorianTone, import('../historianTypes').HistorianTone],
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
  tone: string,
): Promise<void> {
  const record = await db.chronicles.get(chronicleId);
  if (!record) throw new Error(`Chronicle ${chronicleId} not found`);

  record.assignedTone = tone as import('../historianTypes').HistorianTone;
  record.updatedAt = Date.now();

  await db.chronicles.put(record);
}
