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
} from '../chronicleTypes';
import type { ChronicleTemporalContext, CohesionReport, ChronicleImageRefs, ChronicleCoverImage } from '../chronicleTypes';
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

function buildGenerationVersion(record: ChronicleRecord): ChronicleGenerationVersion | null {
  const content = record.finalContent || record.assembledContent || '';
  if (!content) return null;

  return {
    versionId: `version_${record.assembledAt || record.createdAt}`,
    generatedAt: record.assembledAt || record.createdAt,
    content,
    wordCount: countWords(content),
    model: record.model || 'unknown',
    temperature: record.generationTemperature,
    systemPrompt:
      record.generationSystemPrompt ||
      '(prompt not stored - chronicle generated before prompt storage was implemented)',
    userPrompt:
      record.generationUserPrompt ||
      '(prompt not stored - chronicle generated before prompt storage was implemented)',
  };
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
  const focusType = deriveFocusType(metadata.roleAssignments);
  const title = metadata.title || deriveTitleFromRoles(metadata.roleAssignments);
  const assembledAt = Date.now();
  const activeVersionId = `current_${assembledAt}`;
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

    // Mechanical
    entrypointId: metadata.entrypointId,

    // Generation result
    selectionSummary: metadata.selectionSummary,
    perspectiveSynthesis: metadata.perspectiveSynthesis,
    generationSystemPrompt: metadata.generationSystemPrompt,
    generationUserPrompt: metadata.generationUserPrompt,
    generationTemperature: metadata.generationTemperature,
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

  record.assembledContent = assembledContent;
  record.assembledAt = Date.now();
  record.status = 'assembly_ready';
  record.failureStep = undefined;
  record.failureReason = undefined;
  record.failedAt = undefined;
  record.summary = undefined;
  record.summaryGeneratedAt = undefined;
  record.summaryModel = undefined;
  record.summaryTargetVersionId = undefined;
  record.imageRefs = undefined;
  record.imageRefsGeneratedAt = undefined;
  record.imageRefsModel = undefined;
  record.imageRefsTargetVersionId = undefined;
  record.coverImage = undefined;
  record.coverImageGeneratedAt = undefined;
  record.coverImageModel = undefined;
  record.validationStale = false;
  record.updatedAt = Date.now();

  await db.chronicles.put(record);
}

/**
 * Replace chronicle assembled content via temperature regeneration.
 * Preserves prior version in generationHistory and clears refinements.
 */
export async function regenerateChronicleAssembly(
  chronicleId: string,
  updates: {
    assembledContent: string;
    systemPrompt: string;
    userPrompt: string;
    model: string;
    temperature?: number;
    cost: { estimated: number; actual: number; inputTokens: number; outputTokens: number };
  }
): Promise<void> {
  const record = await db.chronicles.get(chronicleId);
  if (!record) throw new Error(`Chronicle ${chronicleId} not found`);
  if (record.status === 'complete' || record.finalContent) {
    throw new Error(`Chronicle ${chronicleId} is already accepted`);
  }

  const historyVersion = buildGenerationVersion(record);
  if (historyVersion) {
    record.generationHistory = [...(record.generationHistory || []), historyVersion];
  }

  record.assembledContent = updates.assembledContent;
  record.assembledAt = Date.now();
  record.status = 'assembly_ready';
  record.generationSystemPrompt = updates.systemPrompt;
  record.generationUserPrompt = updates.userPrompt;
  record.generationTemperature = updates.temperature;
  record.activeVersionId = `current_${record.assembledAt}`;

  record.failureStep = undefined;
  record.failureReason = undefined;
  record.failedAt = undefined;
  record.cohesionReport = undefined;
  record.validatedAt = undefined;
  record.summary = undefined;
  record.summaryGeneratedAt = undefined;
  record.summaryModel = undefined;
  record.summaryTargetVersionId = undefined;
  record.imageRefs = undefined;
  record.imageRefsGeneratedAt = undefined;
  record.imageRefsModel = undefined;
  record.imageRefsTargetVersionId = undefined;
  record.coverImage = undefined;
  record.coverImageGeneratedAt = undefined;
  record.coverImageModel = undefined;
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

  record.assembledContent = assembledContent;
  record.assembledAt = Date.now();
  record.editedAt = Date.now();
  record.editVersion = (record.editVersion || 0) + 1;
  record.cohesionReport = undefined;
  record.validatedAt = undefined;
  record.summary = undefined;
  record.summaryGeneratedAt = undefined;
  record.summaryModel = undefined;
  record.imageRefs = undefined;
  record.imageRefsGeneratedAt = undefined;
  record.imageRefsModel = undefined;
  record.coverImage = undefined;
  record.coverImageGeneratedAt = undefined;
  record.coverImageModel = undefined;
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
  cost: { estimated: number; actual: number; inputTokens: number; outputTokens: number },
  model: string,
): Promise<void> {
  const record = await db.chronicles.get(chronicleId);
  if (!record) throw new Error(`Chronicle ${chronicleId} not found`);

  record.pendingTitle = title;
  record.pendingTitleCandidates = candidates;
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
 * Mark chronicle as complete (user accepted)
 */
export async function acceptChronicle(chronicleId: string, finalContent?: string): Promise<void> {
  const record = await db.chronicles.get(chronicleId);
  if (!record) throw new Error(`Chronicle ${chronicleId} not found`);

  record.finalContent = finalContent ?? record.assembledContent;
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
 * Mark a chronicle as having had its lore backported to cast entity descriptions.
 */
export async function updateChronicleLoreBackported(
  chronicleId: string,
  loreBackported: boolean
): Promise<void> {
  const record = await db.chronicles.get(chronicleId);
  if (!record) throw new Error(`Chronicle ${chronicleId} not found`);

  record.loreBackported = loreBackported;
  record.updatedAt = Date.now();

  await db.chronicles.put(record);
}

/**
 * Update historian notes on a chronicle.
 */
export async function updateChronicleHistorianNotes(
  chronicleId: string,
  historianNotes: HistorianNote[]
): Promise<void> {
  const record = await db.chronicles.get(chronicleId);
  if (!record) throw new Error(`Chronicle ${chronicleId} not found`);

  record.historianNotes = historianNotes;
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
export async function getChronicle(chronicleId: string): Promise<ChronicleRecord | undefined> {
  return db.chronicles.get(chronicleId);
}

/**
 * Get all chronicles for a specific simulation run
 */
export async function getChroniclesForSimulation(simulationRunId: string): Promise<ChronicleRecord[]> {
  return db.chronicles.where('simulationRunId').equals(simulationRunId).toArray();
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
