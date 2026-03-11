/**
 * Upscale Task
 *
 * Upscales an image via fal.ai. Supports two modes:
 * - Production: saves the upscaled blob to the upscale table and updates image HQ metadata.
 * - Test: saves to an isolated test table for comparison before promotion.
 *
 * Source selection: uses the highest existing upscale blob if available,
 * otherwise falls back to the original image blob.
 */

import type { WorkerTask } from "../../lib/enrichmentTypes";
import type { TaskHandler } from "./taskTypes";
import { upscaleImage } from "../../lib/imageClient.fal";
import {
  getBestSourceBlob,
  saveUpscaleBlob,
  saveTestUpscaleBlob,
} from "../../lib/db/upscaleRepository";
import { extractImageDimensions } from "../../lib/db/imageRepository";

export const upscaleTask = {
  type: "upscale",
  async execute(task, context) {
    const { isAborted } = context;

    // Get best available source (highest upscale or original)
    const source = await getBestSourceBlob(task.imageId);
    if (!source.blob) {
      return { success: false, error: `No source blob for image ${task.imageId}` };
    }

    if (isAborted()) return { success: false, error: "Aborted" };

    // Convert source blob to base64 data URI
    const arrayBuffer = await source.blob.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce((s, b) => s + String.fromCharCode(b), "")
    );
    const mimeType = source.blob.type || "image/png";
    const dataUri = `data:${mimeType};base64,${base64}`;

    if (isAborted()) return { success: false, error: "Aborted" };

    // Call fal.ai upscaler
    const result = await upscaleImage({
      imageDataUri: dataUri,
      model: task.upscaleModel,
      factor: task.factor,
      creativity: task.creativity,
      resemblance: task.resemblance,
      prompt: task.prompt,
      negativePrompt: task.negativePrompt,
    });

    if (isAborted()) return { success: false, error: "Aborted" };

    if (result.error || !result.imageBlob) {
      return { success: false, error: result.error || "No image returned" };
    }

    // Extract actual dimensions from the result blob
    const dimensions = await extractImageDimensions(result.imageBlob);
    const width = dimensions.width || result.width;
    const height = dimensions.height || result.height;

    if (task.testMode) {
      // Save to test table (disconnected from primary store)
      const testId = `test_${task.imageId}_${Date.now()}`;
      await saveTestUpscaleBlob({
        testId,
        sourceImageId: task.imageId,
        blob: result.imageBlob,
        width,
        height,
        model: task.upscaleModel,
        factor: task.factor,
        creativity: task.creativity,
        resemblance: task.resemblance,
        prompt: task.prompt,
        negativePrompt: task.negativePrompt,
        sourceWidth: source.width,
        sourceHeight: source.height,
        createdAt: Date.now(),
      });

      return {
        success: true,
        result: { testId, width, height, model: task.upscaleModel },
      };
    }

    // Save to production upscale table
    const blobId = await saveUpscaleBlob({
      imageId: task.imageId,
      blob: result.imageBlob,
      width,
      height,
      model: task.upscaleModel,
      factor: task.factor,
      creativity: task.creativity,
      resemblance: task.resemblance,
      prompt: task.prompt,
      negativePrompt: task.negativePrompt,
      sourceWidth: source.width,
      sourceHeight: source.height,
      upscaledAt: Date.now(),
    });

    return {
      success: true,
      result: { blobId, width, height, model: task.upscaleModel },
    };
  },
} satisfies TaskHandler<WorkerTask & { type: "upscale" }>;
