/**
 * Era Narrative Repository — Dexie-backed era narrative storage
 */

import { db } from "./illuminatorDb";
import type {
  EraNarrativeRecord,
  EraNarrativeCoverImage,
  EraNarrativeImageRefs,
  EraNarrativeContentVersion,
} from "../eraNarrativeTypes";

export type { EraNarrativeRecord };

export function generateEraNarrativeId(): string {
  return `eranarr_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
}

export function generateVersionId(): string {
  return `enver_${Date.now()}_${crypto.randomUUID().slice(0, 6)}`;
}

export async function createEraNarrative(record: EraNarrativeRecord): Promise<EraNarrativeRecord> {
  await db.eraNarratives.put(record);
  return record;
}

export async function getEraNarrative(
  narrativeId: string
): Promise<EraNarrativeRecord | undefined> {
  return db.eraNarratives.get(narrativeId);
}

export async function getEraNarrativesForEra(
  simulationRunId: string,
  eraId: string
): Promise<EraNarrativeRecord[]> {
  return db.eraNarratives.where({ simulationRunId, eraId }).toArray();
}

export async function getEraNarrativesForSimulation(
  simulationRunId: string
): Promise<EraNarrativeRecord[]> {
  return db.eraNarratives.where("simulationRunId").equals(simulationRunId).toArray();
}

export async function updateEraNarrative(
  narrativeId: string,
  updates: Partial<
    Pick<
      EraNarrativeRecord,
      | "status"
      | "error"
      | "currentStep"
      | "threadSynthesis"
      | "narrative"
      | "contentVersions"
      | "activeVersionId"
      | "coverImage"
      | "imageRefs"
      | "totalInputTokens"
      | "totalOutputTokens"
      | "totalActualCost"
      | "editInsertion"
    >
  >
): Promise<EraNarrativeRecord> {
  const record = await db.eraNarratives.get(narrativeId);
  if (!record) throw new Error(`Era narrative ${narrativeId} not found`);

  if (updates.status !== undefined) record.status = updates.status;
  if (updates.error !== undefined) record.error = updates.error;
  if (updates.currentStep !== undefined) record.currentStep = updates.currentStep;
  if (updates.threadSynthesis !== undefined) record.threadSynthesis = updates.threadSynthesis;
  if (updates.narrative !== undefined) record.narrative = updates.narrative;
  if (updates.contentVersions !== undefined) record.contentVersions = updates.contentVersions;
  if (updates.activeVersionId !== undefined) record.activeVersionId = updates.activeVersionId;
  if (updates.coverImage !== undefined) record.coverImage = updates.coverImage;
  if (updates.imageRefs !== undefined) record.imageRefs = updates.imageRefs;
  if (updates.totalInputTokens !== undefined) record.totalInputTokens = updates.totalInputTokens;
  if (updates.totalOutputTokens !== undefined) record.totalOutputTokens = updates.totalOutputTokens;
  if (updates.totalActualCost !== undefined) record.totalActualCost = updates.totalActualCost;
  if (updates.editInsertion !== undefined) record.editInsertion = updates.editInsertion;
  record.updatedAt = Date.now();

  await db.eraNarratives.put(record);
  return record;
}

export async function deleteEraNarrative(narrativeId: string): Promise<void> {
  await db.eraNarratives.delete(narrativeId);
}

// =============================================================================
// Version Management
// =============================================================================

/**
 * Materialize legacy `narrative` field into `contentVersions` if the record
 * hasn't been migrated yet. Mutates the record in place.
 */
function materializeLegacyVersions(record: EraNarrativeRecord): void {
  if (record.contentVersions && record.contentVersions.length > 0) return;
  if (!record.narrative) return;

  const versions: EraNarrativeContentVersion[] = [];
  versions.push({
    versionId: `legacy_gen_${record.narrative.generatedAt}`,
    content: record.narrative.content,
    wordCount: record.narrative.wordCount,
    step: "generate",
    generatedAt: record.narrative.generatedAt,
    model: record.narrative.model,
    systemPrompt: record.narrative.systemPrompt,
    userPrompt: record.narrative.userPrompt,
    inputTokens: record.narrative.inputTokens,
    outputTokens: record.narrative.outputTokens,
    actualCost: record.narrative.actualCost,
  });
  if (record.narrative.editedContent) {
    versions.push({
      versionId: `legacy_edit_${record.narrative.editedAt || record.narrative.generatedAt}`,
      content: record.narrative.editedContent,
      wordCount:
        record.narrative.editedWordCount ||
        record.narrative.editedContent.split(/\s+/).filter(Boolean).length,
      step: "edit",
      generatedAt: record.narrative.editedAt || record.narrative.generatedAt,
      model: record.narrative.model,
      systemPrompt: record.narrative.editSystemPrompt || "",
      userPrompt: record.narrative.editUserPrompt || "",
      inputTokens: record.narrative.editInputTokens || 0,
      outputTokens: record.narrative.editOutputTokens || 0,
      actualCost: record.narrative.editActualCost || 0,
    });
  }

  record.contentVersions = versions;
  record.activeVersionId = versions[versions.length - 1].versionId;
}

export async function deleteEraNarrativeVersion(
  narrativeId: string,
  versionId: string
): Promise<EraNarrativeRecord> {
  const record = await db.eraNarratives.get(narrativeId);
  if (!record) throw new Error(`Era narrative ${narrativeId} not found`);

  materializeLegacyVersions(record);

  const versions = record.contentVersions || [];
  const target = versions.find((v) => v.versionId === versionId);
  if (!target) throw new Error(`Version ${versionId} not found`);
  if (target.step === "generate") throw new Error("Cannot delete the generate version");

  record.contentVersions = versions.filter((v) => v.versionId !== versionId);

  // If deleted version was active, fall back to latest remaining
  if (record.activeVersionId === versionId) {
    const remaining = record.contentVersions;
    record.activeVersionId =
      remaining.length > 0 ? remaining[remaining.length - 1].versionId : undefined;
  }

  record.updatedAt = Date.now();
  await db.eraNarratives.put(record);
  return record;
}

export async function setEraNarrativeActiveVersion(
  narrativeId: string,
  versionId: string
): Promise<EraNarrativeRecord> {
  const record = await db.eraNarratives.get(narrativeId);
  if (!record) throw new Error(`Era narrative ${narrativeId} not found`);

  materializeLegacyVersions(record);

  const versions = record.contentVersions || [];
  if (!versions.some((v) => v.versionId === versionId)) {
    throw new Error(`Version ${versionId} not found`);
  }

  record.activeVersionId = versionId;
  record.updatedAt = Date.now();
  await db.eraNarratives.put(record);
  return record;
}

// =============================================================================
// Cover Image
// =============================================================================

export async function updateEraNarrativeCoverImage(
  narrativeId: string,
  coverImage: EraNarrativeCoverImage,
  costs: { estimated: number; actual: number; inputTokens: number; outputTokens: number },
  model: string
): Promise<void> {
  const record = await db.eraNarratives.get(narrativeId);
  if (!record) throw new Error(`Era narrative ${narrativeId} not found`);

  record.coverImage = coverImage;
  record.totalInputTokens += costs.inputTokens;
  record.totalOutputTokens += costs.outputTokens;
  record.totalActualCost += costs.actual;
  record.updatedAt = Date.now();
  await db.eraNarratives.put(record);
}

export async function updateEraNarrativeCoverImageStatus(
  narrativeId: string,
  status: "pending" | "generating" | "complete" | "failed",
  imageId?: string,
  error?: string
): Promise<void> {
  const record = await db.eraNarratives.get(narrativeId);
  if (!record || !record.coverImage) return;

  record.coverImage.status = status;
  if (imageId) record.coverImage.generatedImageId = imageId;
  if (error) record.coverImage.error = error;
  record.updatedAt = Date.now();
  await db.eraNarratives.put(record);
}

// =============================================================================
// Image Refs
// =============================================================================

export async function updateEraNarrativeImageRefs(
  narrativeId: string,
  imageRefs: EraNarrativeImageRefs,
  costs: { estimated: number; actual: number; inputTokens: number; outputTokens: number },
  model: string
): Promise<void> {
  const record = await db.eraNarratives.get(narrativeId);
  if (!record) throw new Error(`Era narrative ${narrativeId} not found`);

  record.imageRefs = imageRefs;
  record.totalInputTokens += costs.inputTokens;
  record.totalOutputTokens += costs.outputTokens;
  record.totalActualCost += costs.actual;
  record.updatedAt = Date.now();
  await db.eraNarratives.put(record);
}

export async function updateEraNarrativeImageRefStatus(
  narrativeId: string,
  refId: string,
  status: "pending" | "generating" | "complete" | "failed",
  imageId?: string,
  error?: string
): Promise<void> {
  const record = await db.eraNarratives.get(narrativeId);
  if (!record || !record.imageRefs) return;

  const ref = record.imageRefs.refs.find((r) => r.refId === refId);
  if (!ref || ref.type !== "prompt_request") return;

  ref.status = status;
  if (imageId) ref.generatedImageId = imageId;
  if (error) ref.error = error;
  record.updatedAt = Date.now();
  await db.eraNarratives.put(record);
}

/**
 * Update arbitrary fields on an image ref (anchor text, size, justification).
 */
export async function updateEraNarrativeImageRefField(
  narrativeId: string,
  refId: string,
  updates: { anchorText?: string; size?: string; justification?: "left" | "right" | null }
): Promise<void> {
  const record = await db.eraNarratives.get(narrativeId);
  if (!record || !record.imageRefs) return;

  const ref = record.imageRefs.refs.find((r) => r.refId === refId);
  if (!ref) return;

  if (updates.anchorText !== undefined) ref.anchorText = updates.anchorText;
  if (updates.size !== undefined) (ref as any).size = updates.size;
  if (updates.justification !== undefined) {
    if (updates.justification === null) {
      delete (ref as any).justification;
    } else {
      ref.justification = updates.justification;
    }
  }
  record.updatedAt = Date.now();
  await db.eraNarratives.put(record);
}

// =============================================================================
// Version Helpers
// =============================================================================

/**
 * Get the active version's content, falling back to legacy narrative field.
 * Returns the content string and the version list for display.
 */
export function resolveActiveContent(record: EraNarrativeRecord): {
  content: string | undefined;
  versions: EraNarrativeContentVersion[];
  activeVersionId: string | undefined;
} {
  const versions = record.contentVersions || [];

  if (versions.length > 0) {
    const activeId = record.activeVersionId || versions[versions.length - 1].versionId;
    const active = versions.find((v) => v.versionId === activeId) || versions[versions.length - 1];
    return { content: active.content, versions, activeVersionId: active.versionId };
  }

  // Legacy fallback: migrate from narrative field
  if (record.narrative) {
    const legacyVersions: EraNarrativeContentVersion[] = [];
    legacyVersions.push({
      versionId: `legacy_gen_${record.narrative.generatedAt}`,
      content: record.narrative.content,
      wordCount: record.narrative.wordCount,
      step: "generate",
      generatedAt: record.narrative.generatedAt,
      model: record.narrative.model,
      systemPrompt: record.narrative.systemPrompt,
      userPrompt: record.narrative.userPrompt,
      inputTokens: record.narrative.inputTokens,
      outputTokens: record.narrative.outputTokens,
      actualCost: record.narrative.actualCost,
    });
    if (record.narrative.editedContent) {
      legacyVersions.push({
        versionId: `legacy_edit_${record.narrative.editedAt || record.narrative.generatedAt}`,
        content: record.narrative.editedContent,
        wordCount:
          record.narrative.editedWordCount ||
          record.narrative.editedContent.split(/\s+/).filter(Boolean).length,
        step: "edit",
        generatedAt: record.narrative.editedAt || record.narrative.generatedAt,
        model: record.narrative.model,
        systemPrompt: record.narrative.editSystemPrompt || "",
        userPrompt: record.narrative.editUserPrompt || "",
        inputTokens: record.narrative.editInputTokens || 0,
        outputTokens: record.narrative.editOutputTokens || 0,
        actualCost: record.narrative.editActualCost || 0,
      });
    }

    const activeId = legacyVersions[legacyVersions.length - 1].versionId;
    return {
      content: legacyVersions[legacyVersions.length - 1].content,
      versions: legacyVersions,
      activeVersionId: activeId,
    };
  }

  return { content: undefined, versions: [], activeVersionId: undefined };
}
