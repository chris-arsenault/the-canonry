/**
 * catalogLlmFill — LLM-based metadata fill for images missing title/tags.
 *
 * Operates on images that have prompt data (finalPrompt or originalPrompt)
 * but are still missing title or tags after deterministic fill.
 *
 * Batches images into groups and sends one LLM call per batch.
 * Uses Haiku for cost efficiency — prompt-to-metadata is straightforward.
 */

import { db } from "./db/illuminatorDb";
import { LLMClient } from "./llmClient";
import { getCallConfig } from "./llmModelSettings";
import { runTextCall } from "./llmTextCall";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LlmFillProgress {
  total: number;
  processed: number;
  updated: number;
  errors: number;
  currentBatch: number;
  totalBatches: number;
}

export interface LlmFillResult {
  updated: number;
  skipped: number;
  errors: number;
  details: { imageId: string; fieldsSet: string[] }[];
}

interface ImageForFill {
  imageId: string;
  prompt: string;
  missingTitle: boolean;
  missingTags: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const BATCH_SIZE = 20;

const SYSTEM_PROMPT = `You are a metadata tagger for a fantasy world image catalog. Given image generation prompts, produce structured metadata.

For each image, generate:
- title: A concise, evocative title (3-8 words). Capture the scene's essence, not its technical details.
- tags: 3-8 descriptive tags. Include subject matter, mood, setting type, and visual style. Use lowercase, no punctuation.

Respond with valid JSON only. No markdown, no explanation.`;

// ─── Core ────────────────────────────────────────────────────────────────────

function buildBatchPrompt(images: ImageForFill[]): string {
  const entries = images.map((img, i) => {
    const needs: string[] = [];
    if (img.missingTitle) needs.push("title");
    if (img.missingTags) needs.push("tags");
    return `[${i}] id="${img.imageId}"\nneeds: ${needs.join(", ")}\nprompt: ${img.prompt.slice(0, 500)}`;
  });

  return `Generate metadata for these ${images.length} images. Return a JSON array where each element has "id" (string), and whichever of "title" (string) and "tags" (string[]) was requested.

${entries.join("\n\n")}`;
}

function parseBatchResponse(
  text: string,
  images: ImageForFill[]
): Map<string, { title?: string; tags?: string[] }> {
  const result = new Map<string, { title?: string; tags?: string[] }>();

  // Extract JSON from response (may have markdown fences)
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return result;

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      id?: string;
      title?: string;
      tags?: string[];
    }>;

    for (const entry of parsed) {
      if (!entry.id) continue;
      const img = images.find((i) => i.imageId === entry.id);
      if (!img) continue;

      const data: { title?: string; tags?: string[] } = {};
      if (entry.title && img.missingTitle) data.title = entry.title;
      if (entry.tags?.length && img.missingTags) data.tags = entry.tags;
      if (data.title || data.tags) {
        result.set(entry.id, data);
      }
    }
  } catch (e) {
    console.warn("[CatalogLlmFill] Failed to parse batch response:", e);
  }

  return result;
}

export async function runLlmFill(
  projectId: string,
  apiKey: string,
  onProgress?: (progress: LlmFillProgress) => void
): Promise<LlmFillResult> {
  // 1. Find images missing title or tags that have prompt data
  const allImages = await db.images
    .where("projectId")
    .equals(projectId)
    .toArray();

  const candidates: ImageForFill[] = [];
  for (const img of allImages) {
    const rec = img as unknown as Record<string, unknown>;
    const prompt = (rec.finalPrompt as string) || (rec.originalPrompt as string);
    if (!prompt) continue;

    const title = rec.title as string | undefined;
    const tags = rec.tags as string[] | undefined;
    const missingTitle = !title;
    const missingTags = !tags || tags.length === 0;

    if (missingTitle || missingTags) {
      candidates.push({
        imageId: rec.imageId as string,
        prompt,
        missingTitle,
        missingTags,
      });
    }
  }

  if (candidates.length === 0) {
    return { updated: 0, skipped: allImages.length, errors: 0, details: [] };
  }

  // 2. Create LLM client
  const llmClient = new LLMClient({
    enabled: true,
    apiKey,
    model: "claude-haiku-4-5-20251001",
  });

  const callConfig = getCallConfig("catalog.metadataFill");
  const result: LlmFillResult = { updated: 0, skipped: 0, errors: 0, details: [] };

  // 3. Process in batches
  const batches: ImageForFill[][] = [];
  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    batches.push(candidates.slice(i, i + BATCH_SIZE));
  }

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];

    onProgress?.({
      total: candidates.length,
      processed: batchIdx * BATCH_SIZE,
      updated: result.updated,
      errors: result.errors,
      currentBatch: batchIdx + 1,
      totalBatches: batches.length,
    });

    try {
      const prompt = buildBatchPrompt(batch);
      const llmResult = await runTextCall({
        llmClient,
        callType: "catalog.metadataFill",
        callConfig,
        systemPrompt: SYSTEM_PROMPT,
        prompt,
      });

      const parsed = parseBatchResponse(llmResult.result.text, batch);

      // Apply results to Dexie
      for (const img of batch) {
        const data = parsed.get(img.imageId);
        if (!data) {
          result.skipped++;
          continue;
        }

        const updates: Record<string, unknown> = {};
        const fieldsSet: string[] = [];

        if (data.title) {
          updates.title = data.title;
          fieldsSet.push("title");
        }
        if (data.tags) {
          updates.tags = data.tags;
          fieldsSet.push("tags");
        }

        if (fieldsSet.length > 0) {
          try {
            await db.images.update(img.imageId, updates);
            result.updated++;
            result.details.push({ imageId: img.imageId, fieldsSet });
          } catch (e) {
            console.error(`[CatalogLlmFill] DB update failed for ${img.imageId}:`, e);
            result.errors++;
          }
        } else {
          result.skipped++;
        }
      }
    } catch (e) {
      console.error(`[CatalogLlmFill] Batch ${batchIdx + 1} failed:`, e);
      result.errors += batch.length;
    }
  }

  onProgress?.({
    total: candidates.length,
    processed: candidates.length,
    updated: result.updated,
    errors: result.errors,
    currentBatch: batches.length,
    totalBatches: batches.length,
  });

  return result;
}
