/**
 * Chronicle Image Operations — image ref and cover image updates.
 */

import { db } from "./illuminatorDb";
import type {
  ChronicleImageRefs,
  ChronicleCoverImage,
  BaseChronicleImageRef,
  PromptRequestRef,
} from "../chronicleTypes";

// ============================================================================
// Image refs
// ============================================================================

/**
 * Clear all image refs from a chronicle, resetting it to no-refs state.
 */
export async function clearChronicleImageRefs(chronicleId: string): Promise<void> {
  const record = await db.chronicles.get(chronicleId);
  if (!record) return;
  record.imageRefs = undefined;
  record.imageRefsGeneratedAt = undefined;
  record.imageRefsModel = undefined;
  record.imageRefsTargetVersionId = undefined;
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

/**
 * Clear generated images from all prompt_request refs (keeps the ref, clears the image).
 */
export async function clearChronicleSceneImages(chronicleId: string): Promise<number> {
  const record = await db.chronicles.get(chronicleId);
  if (!record?.imageRefs?.refs) return 0;

  let cleared = 0;
  for (const ref of record.imageRefs.refs) {
    if (ref.type === "prompt_request" && ref.generatedImageId) {
      ref.generatedImageId = undefined;
      ref.status = "pending";
      ref.error = undefined;
      cleared++;
    }
  }
  if (cleared > 0) {
    record.updatedAt = Date.now();
    await db.chronicles.put(record);
  }
  return cleared;
}

/**
 * Clear the cover image if its composition matches any of the given style IDs.
 * Returns true if an image was cleared.
 */
export async function clearCoverImageByComposition(
  chronicleId: string,
  compositionIds: Set<string>,
): Promise<boolean> {
  const record = await db.chronicles.get(chronicleId);
  if (!record?.coverImage?.generatedImageId) return false;
  if (!record.coverImage.suggestedCompositionStyleId) return false;
  if (!compositionIds.has(record.coverImage.suggestedCompositionStyleId)) return false;

  record.coverImage.generatedImageId = undefined;
  record.coverImage.status = "pending";
  record.coverImage.error = undefined;
  record.updatedAt = Date.now();
  await db.chronicles.put(record);
  return true;
}

/**
 * Clear the generated image from a cover image (keeps scene description and tags).
 */
export async function clearChronicleCoverImage(chronicleId: string): Promise<boolean> {
  const record = await db.chronicles.get(chronicleId);
  if (!record?.coverImage?.generatedImageId) return false;

  record.coverImage.generatedImageId = undefined;
  record.coverImage.status = "pending";
  record.coverImage.error = undefined;
  record.updatedAt = Date.now();
  await db.chronicles.put(record);
  return true;
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
