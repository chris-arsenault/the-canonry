/**
 * Upscale Repository — Dexie-based CRUD for upscaled image blobs.
 *
 * Manages both production upscale blobs (linked to images via metadata)
 * and test upscale blobs (isolated experimentation area with promote-to-prod).
 */

import { db } from "./illuminatorDb";
import type { UpscaleBlobRecord, UpscaleTestBlobRecord } from "../imageTypes";

const LOG_PREFIX = "[UpscaleRepository]";

// ============================================================================
// Helpers
// ============================================================================

/**
 * Build the compound blob ID from image ID and dimensions.
 */
export function makeBlobId(imageId: string, width: number, height: number): string {
  return `${imageId}:${width}x${height}`;
}

// ============================================================================
// Production Upscale Blobs
// ============================================================================

/**
 * Save an upscale blob and update the parent image's HQ metadata.
 *
 * After saving the blob, queries all upscale blobs for the same imageId,
 * finds the one with the largest pixel area, and writes hqWidth/hqHeight/hqUpscaledAt
 * to the images table.
 */
export async function saveUpscaleBlob(
  record: Omit<UpscaleBlobRecord, "blobId">
): Promise<string> {
  const blobId = makeBlobId(record.imageId, record.width, record.height);
  const full: UpscaleBlobRecord = { ...record, blobId };

  await db.transaction("rw", [db.upscaleBlobs, db.images], async () => {
    await db.upscaleBlobs.put(full);

    // Find the highest-resolution upscale across all tiers for this image
    const allBlobs = await db.upscaleBlobs.where("imageId").equals(record.imageId).toArray();
    let best = allBlobs[0];
    for (const blob of allBlobs) {
      if (blob.width * blob.height > best.width * best.height) {
        best = blob;
      }
    }

    await db.images.update(record.imageId, {
      hqWidth: best.width,
      hqHeight: best.height,
      hqUpscaledAt: best.upscaledAt,
    });
  });

  console.log(`${LOG_PREFIX} Saved upscale blob`, {
    blobId,
    imageId: record.imageId,
    width: record.width,
    height: record.height,
  });

  return blobId;
}

/**
 * Get all upscale blobs for an image, sorted largest first (by pixel area).
 */
export async function getUpscaleBlobsForImage(imageId: string): Promise<UpscaleBlobRecord[]> {
  const blobs = await db.upscaleBlobs.where("imageId").equals(imageId).toArray();
  blobs.sort((a, b) => b.width * b.height - a.width * a.height);
  return blobs;
}

/**
 * Get the single largest upscale blob for an image.
 * Returns undefined if no upscales exist.
 */
export async function getHighestUpscaleBlob(
  imageId: string
): Promise<UpscaleBlobRecord | undefined> {
  const blobs = await getUpscaleBlobsForImage(imageId);
  return blobs[0];
}

/**
 * Get the best available source blob for an image.
 *
 * Returns the highest upscale blob if one exists, otherwise falls back to
 * the original blob in the imageBlobs table (using dimensions from the
 * images metadata table).
 *
 * Throws if no blob is found at all.
 */
export async function getBestSourceBlob(
  imageId: string
): Promise<{ blob: Blob; width: number; height: number }> {
  // Try upscale blobs first
  const highest = await getHighestUpscaleBlob(imageId);
  if (highest) {
    return { blob: highest.blob, width: highest.width, height: highest.height };
  }

  // Fall back to original
  const [blobRecord, metadata] = await Promise.all([
    db.imageBlobs.get(imageId),
    db.images.get(imageId),
  ]);

  if (!blobRecord?.blob) {
    throw new Error(`No blob found for image ${imageId} (neither upscale nor original)`);
  }

  if (!metadata?.width || !metadata?.height) {
    throw new Error(
      `Original blob found for image ${imageId} but images table has no width/height metadata`
    );
  }

  return { blob: blobRecord.blob, width: metadata.width, height: metadata.height };
}

/**
 * Delete all upscale blobs for an image and clear HQ metadata on the images table.
 */
export async function deleteUpscaleBlobsForImage(imageId: string): Promise<void> {
  await db.transaction("rw", [db.upscaleBlobs, db.images], async () => {
    const blobs = await db.upscaleBlobs.where("imageId").equals(imageId).toArray();
    const blobIds = blobs.map((b) => b.blobId);
    if (blobIds.length > 0) {
      await db.upscaleBlobs.bulkDelete(blobIds);
    }

    await db.images.update(imageId, {
      hqWidth: undefined,
      hqHeight: undefined,
      hqUpscaledAt: undefined,
    });
  });

  console.log(`${LOG_PREFIX} Deleted all upscale blobs for image ${imageId}`);
}

// ============================================================================
// Test Upscale Blobs
// ============================================================================

/**
 * Save a test upscale blob.
 */
export async function saveTestUpscaleBlob(record: UpscaleTestBlobRecord): Promise<void> {
  await db.upscaleTestBlobs.put(record);

  console.log(`${LOG_PREFIX} Saved test upscale blob`, {
    testId: record.testId,
    sourceImageId: record.sourceImageId,
    width: record.width,
    height: record.height,
  });
}

/**
 * Get all test blobs for a source image.
 */
export async function getTestBlobsForImage(
  sourceImageId: string
): Promise<UpscaleTestBlobRecord[]> {
  return db.upscaleTestBlobs.where("sourceImageId").equals(sourceImageId).toArray();
}

/**
 * Get all test blobs across all source images.
 */
export async function getAllTestBlobs(): Promise<UpscaleTestBlobRecord[]> {
  return db.upscaleTestBlobs.toArray();
}

/**
 * Promote a test blob to production.
 *
 * Reads the test blob, saves it as a production upscale blob (which also
 * updates images metadata), then deletes the test record.
 *
 * Returns the new production blobId.
 */
export async function promoteTestBlob(testId: string): Promise<string> {
  const testBlob = await db.upscaleTestBlobs.get(testId);
  if (!testBlob) {
    throw new Error(`Test blob ${testId} not found`);
  }

  const blobId = await saveUpscaleBlob({
    imageId: testBlob.sourceImageId,
    blob: testBlob.blob,
    width: testBlob.width,
    height: testBlob.height,
    model: testBlob.model,
    factor: testBlob.factor,
    creativity: testBlob.creativity,
    resemblance: testBlob.resemblance,
    prompt: testBlob.prompt,
    negativePrompt: testBlob.negativePrompt,
    sourceWidth: testBlob.sourceWidth,
    sourceHeight: testBlob.sourceHeight,
    upscaledAt: Date.now(),
  });

  await db.upscaleTestBlobs.delete(testId);

  console.log(`${LOG_PREFIX} Promoted test blob ${testId} -> ${blobId}`);
  return blobId;
}

/**
 * Delete a single test blob.
 */
export async function deleteTestBlob(testId: string): Promise<void> {
  await db.upscaleTestBlobs.delete(testId);
}

/**
 * Delete all test blobs.
 */
export async function clearAllTestBlobs(): Promise<void> {
  await db.upscaleTestBlobs.clear();
  console.log(`${LOG_PREFIX} Cleared all test blobs`);
}
