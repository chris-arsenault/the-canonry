/**
 * Chronicle Refinement Operations — updates for reports, image refs,
 * cover images, summaries, titles, historian annotations, temporal context,
 * era summary refresh, and combine instructions.
 */

import { db } from "./illuminatorDb";
import type {
  ChronicleRecord,
  ChronicleImageRefs,
  ChronicleCoverImage,
  ChronicleTemporalContext,
  EraTemporalInfo,
  BaseChronicleImageRef,
  PromptRequestRef,
  QuickCheckReport,
  FactCoverageReport,
  TertiaryCastEntry,
} from "../chronicleTypes";
import type { HistorianNote } from "../historianTypes";

// ============================================================================
// Comparison / temporal / quick-check reports
// ============================================================================

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
  report: QuickCheckReport
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
  report: FactCoverageReport
): Promise<void> {
  const record = await db.chronicles.get(chronicleId);
  if (!record) throw new Error(`Chronicle ${chronicleId} not found`);

  record.factCoverageReport = report;
  record.factCoverageReportGeneratedAt = Date.now();
  record.updatedAt = Date.now();

  await db.chronicles.put(record);
}

// ============================================================================
// Summary, title, and historian prep
// ============================================================================

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
 * Always writes to pending fields - user must accept via modal.
 */
export async function updateChronicleTitle(
  chronicleId: string,
  title: string,
  candidates: string[],
  fragments: string[],
  cost: { estimated: number; actual: number; inputTokens: number; outputTokens: number },
  model: string
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
 * Update chronicle tertiary cast (detected entity mentions not in declared cast)
 */
export async function updateChronicleTertiaryCast(
  chronicleId: string,
  entries: TertiaryCastEntry[]
): Promise<void> {
  const record = await db.chronicles.get(chronicleId);
  if (!record) throw new Error(`Chronicle ${chronicleId} not found`);

  record.tertiaryCast = entries;
  record.tertiaryCastDetectedAt = Date.now();
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
  reinforcedFacts?: string[]
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

// ============================================================================
// Image refs
// ============================================================================

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

/** Fields that can be updated on any image ref */
interface BaseImageRefUpdates {
  anchorText?: string;
  anchorIndex?: number;
  caption?: string;
  size?: BaseChronicleImageRef["size"];
  justification?: BaseChronicleImageRef["justification"] | null;
}

/** Fields that can be updated on a prompt_request image ref */
interface PromptRequestUpdates {
  sceneDescription?: string;
  status?: PromptRequestRef["status"];
  generatedImageId?: string;
  error?: string;
}

function applyBaseImageRefUpdates(ref: BaseChronicleImageRef, updates: BaseImageRefUpdates): void {
  if (updates.anchorText !== undefined) {
    ref.anchorText = updates.anchorText;
    if (updates.anchorIndex === undefined) ref.anchorIndex = undefined;
  }
  if (updates.anchorIndex !== undefined) ref.anchorIndex = updates.anchorIndex;
  if (updates.caption !== undefined) ref.caption = updates.caption;
  if (updates.size !== undefined) ref.size = updates.size;
  if (updates.justification !== undefined) {
    if (updates.justification) {
      ref.justification = updates.justification;
    } else {
      ref.justification = undefined;
    }
  }
}

function applyPromptRequestUpdates(ref: PromptRequestRef, updates: PromptRequestUpdates): void {
  if (updates.sceneDescription !== undefined) ref.sceneDescription = updates.sceneDescription;
  if (updates.status !== undefined) ref.status = updates.status;
  if (updates.generatedImageId !== undefined) {
    ref.generatedImageId = updates.generatedImageId || undefined;
  }
  if (updates.error !== undefined) {
    ref.error = updates.error || undefined;
  }
}

export async function updateChronicleImageRef(
  chronicleId: string,
  refId: string,
  updates: {
    status?: "pending" | "generating" | "complete" | "failed";
    generatedImageId?: string;
    error?: string;
    anchorText?: string;
    anchorIndex?: number;
    caption?: string;
    size?: "small" | "medium" | "large" | "full-width";
    justification?: "left" | "right" | null;
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
    updates.status !== undefined ||
    updates.generatedImageId !== undefined ||
    updates.error !== undefined ||
    updates.sceneDescription !== undefined;

  if (wantsPromptUpdates && ref.type !== "prompt_request") {
    throw new Error(`Image ref ${refId} is not a prompt request`);
  }

  applyBaseImageRefUpdates(ref, updates);
  if (ref.type === "prompt_request") {
    applyPromptRequestUpdates(ref, updates);
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
  selections: Array<{ refId: string; action: "reuse" | "regenerate" | "skip" }>,
  newTargetVersionId: string
): Promise<void> {
  const record = await db.chronicles.get(chronicleId);
  if (!record) throw new Error(`Chronicle ${chronicleId} not found`);
  if (!record.imageRefs) throw new Error(`Chronicle ${chronicleId} has no image refs`);

  const selectionMap = new Map(selections.map((s) => [s.refId, s.action]));

  // Filter and transform refs based on selections
  const updatedRefs = record.imageRefs.refs
    .filter((ref) => {
      const action = selectionMap.get(ref.refId) ?? "reuse";
      return action !== "skip";
    })
    .map((ref) => {
      const action = selectionMap.get(ref.refId) ?? "reuse";
      if (action === "regenerate" && ref.type === "prompt_request") {
        // Reset prompt request refs for regeneration
        return {
          ...ref,
          status: "pending" as const,
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

// ============================================================================
// Cover image
// ============================================================================

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
    status: "pending" | "generating" | "complete" | "failed";
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

// ============================================================================
// Temporal context and era summaries
// ============================================================================

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

function patchTemporalContext(
  record: ChronicleRecord,
  summaryMap: Map<string, string>
): boolean {
  if (!record.temporalContext) return false;
  let changed = false;

  const patchedAllEras = record.temporalContext.allEras.map((era) => {
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
    record.temporalContext = { ...record.temporalContext, allEras: patchedAllEras, focalEra: patchedFocalEra };
  }
  return changed;
}

function patchPerspectiveSynthesisFocalEra(
  record: ChronicleRecord,
  summaryMap: Map<string, string>
): boolean {
  const focalEra = record.perspectiveSynthesis?.focalEra;
  if (!focalEra?.id) return false;
  const newSummary = summaryMap.get(focalEra.id);
  if (newSummary === undefined || newSummary === focalEra.description) return false;
  record.perspectiveSynthesis = {
    ...record.perspectiveSynthesis,
    focalEra: { ...focalEra, description: newSummary },
  };
  return true;
}

/**
 * Refresh era summaries in all chronicles for a simulation run.
 */
export async function refreshEraSummariesInChronicles(
  simulationRunId: string,
  currentEras: EraTemporalInfo[]
): Promise<number> {
  const summaryMap = new Map(currentEras.map((e) => [e.id, e.summary || ""]));
  const records = await db.chronicles.where("simulationRunId").equals(simulationRunId).toArray();
  const toUpdate: ChronicleRecord[] = [];

  for (const record of records) {
    const changed = patchTemporalContext(record, summaryMap) || patchPerspectiveSynthesisFocalEra(record, summaryMap);
    if (changed) {
      record.updatedAt = Date.now();
      toUpdate.push(record);
    }
  }

  if (toUpdate.length > 0) await db.chronicles.bulkPut(toUpdate);
  return toUpdate.length;
}

// ============================================================================
// Combine instructions
// ============================================================================

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
