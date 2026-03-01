/**
 * Chronicle Write Operations — create and content-update functions.
 *
 * Covers shell creation, single-shot creation, assembly updates,
 * regeneration, editing, failure marking, cohesion updates,
 * and validation start.
 */

import { db } from "./illuminatorDb";
import type {
  ChronicleRecord,
  ChronicleGenerationVersion,
  ChronicleShellMetadata,
  ChronicleMetadata,
  VersionStep,
} from "../chronicleTypes";
import type {
  CohesionReport,
} from "../chronicleTypes";
import type { ChronicleStep } from "../enrichmentTypes";
import { deriveTitleFromRoles, deriveFocusType } from "./chronicleRepository";
import {
  countWords,
  createUniqueVersionId,
  ensureChronicleVersions,
} from "./chronicleVersionHelpers";

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
    status: "generating",
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
    step: "generate",
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
    generationStep: "generate",
    generationHistory: [initialVersion],
    activeVersionId,
    status: "assembly_ready",
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
// Content update operations
// ============================================================================

const PROMPT_NOT_STORED = "(prompt not stored - chronicle generated before prompt storage was implemented)";

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
  const nextVersion: ChronicleGenerationVersion = {
    versionId,
    generatedAt,
    content: assembledContent,
    wordCount: countWords(assembledContent),
    model: record.model || "unknown",
    sampling: record.generationSampling,
    systemPrompt: record.generationSystemPrompt || PROMPT_NOT_STORED,
    userPrompt: record.generationUserPrompt || PROMPT_NOT_STORED,
    step: record.generationStep,
  };
  record.generationHistory = [...(record.generationHistory || []), nextVersion];

  record.assembledContent = assembledContent;
  record.assembledAt = generatedAt;
  record.status = "assembly_ready";
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
    sampling?: ChronicleRecord["generationSampling"];
    cost: { estimated: number; actual: number; inputTokens: number; outputTokens: number };
    step?: VersionStep;
  }
): Promise<void> {
  const record = await db.chronicles.get(chronicleId);
  if (!record) throw new Error(`Chronicle ${chronicleId} not found`);
  if (record.status === "complete" || record.finalContent) {
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
  record.status = "assembly_ready";
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
  const nextVersion: ChronicleGenerationVersion = {
    versionId,
    generatedAt,
    content: assembledContent,
    wordCount: countWords(assembledContent),
    model: record.model || "unknown",
    sampling: record.generationSampling,
    systemPrompt: record.generationSystemPrompt || PROMPT_NOT_STORED,
    userPrompt: record.generationUserPrompt || PROMPT_NOT_STORED,
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
  record.status = "editing";
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

  record.status = "failed";
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
  record.status = "validation_ready";
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
 * Start validation step (user approved assembly)
 */
export async function startChronicleValidation(chronicleId: string): Promise<void> {
  const record = await db.chronicles.get(chronicleId);
  if (!record) throw new Error(`Chronicle ${chronicleId} not found`);

  record.status = "validating";
  record.updatedAt = Date.now();

  await db.chronicles.put(record);
}
