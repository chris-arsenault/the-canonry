/**
 * catalogLlmFill — LLM-based metadata fill with two operations:
 *
 * 1. Classify: assign artisticStyleId, compositionStyleId, colorPaletteId, tags
 * 2. Title: generate evocative titles informed by style/composition context
 *
 * Each operation supports text mode (from prompts) and vision mode (from images).
 * That's 4 prompt variants sharing one batch runner.
 */

import { db } from "./db/illuminatorDb";
import type { LLMCallType } from "./llmCallTypes";
import { LLMClient } from "./llmClient";
import { getCallConfig } from "./llmModelSettings";
import { runTextCall } from "./llmTextCall";

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

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

export interface StyleIds {
  artisticStyleIds: string[];
  compositionStyleIds: string[];
  colorPaletteIds: string[];
}

/** Human-readable name lookup for title context. */
export interface StyleNameMap {
  artistic: Map<string, string>;
  composition: Map<string, string>;
  palette: Map<string, string>;
}

export interface FillOptions {
  projectId: string;
  apiKey: string;
  styleIds: StyleIds;
  useVision?: boolean;
  onProgress?: (progress: LlmFillProgress) => void;
}

export interface TitleFillOptions extends FillOptions {
  styleNames: StyleNameMap;
}

/** Per-image candidate with all context either fill might need. */
interface ImageCandidate {
  imageId: string;
  prompt: string;
  entityName: string;
  artisticStyleId: string;
  compositionStyleId: string;
  colorPaletteId: string;
  imageType: string;
  /** Current title — populated for retitle operations. */
  currentTitle?: string;
}

/** What a fill operation needs to produce per batch. */
interface FillSpec {
  name: string;
  callType: LLMCallType;
  textBatchSize: number;
  visionBatchSize: number;
  textSystemPrompt: string;
  visionSystemPrompt: string;
  buildTextEntry: (img: ImageCandidate, index: number) => string;
  buildVisionLabel: (img: ImageCandidate, index: number) => string;
  batchInstruction: string | ((batchIndex: number) => string);
  parseEntry: (entry: Record<string, unknown>, img: ImageCandidate) => Record<string, unknown> | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Vision Helpers (shared)
// ═══════════════════════════════════════════════════════════════════════════════

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function detectMediaType(blob: Blob): string {
  if (blob.type === "image/png") return "image/png";
  if (blob.type === "image/gif") return "image/gif";
  if (blob.type === "image/webp") return "image/webp";
  return "image/jpeg";
}

async function callVisionApi(
  apiKey: string,
  systemPrompt: string,
  contentBlocks: unknown[],
): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: contentBlocks }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vision API error ${response.status}: ${errorText}`);
  }

  const data = await response.json() as { content?: Array<{ type?: string; text?: string }> };
  return data.content?.find((b) => b.type === "text")?.text ?? "";
}

interface LoadedImage {
  candidate: ImageCandidate;
  base64: string;
  mediaType: string;
}

async function loadImageBlob(imageId: string): Promise<{ blob: Blob; base64: string; mediaType: string } | null> {
  const blobRec = await db.table("imageBlobs").get(imageId) as { blob?: Blob } | undefined;
  if (!blobRec?.blob) {
    console.warn(`[CatalogLlmFill] No blob for ${imageId}, skipping`);
    return null;
  }

  const rawSizeMB = blobRec.blob.size / 1024 / 1024;
  const base64 = await blobToBase64(blobRec.blob);
  console.log(`[CatalogLlmFill] ${imageId}: blob.size=${rawSizeMB.toFixed(2)}MB, base64=${(base64.length / 1024 / 1024).toFixed(2)}MB chars, type=${blobRec.blob.type}`);

  if (base64.length > 5 * 1024 * 1024) {
    console.warn(`[CatalogLlmFill] base64 for ${imageId} is ${(base64.length / 1024 / 1024).toFixed(1)}MB (>5MB limit), skipping`);
    return null;
  }

  return { blob: blobRec.blob, base64, mediaType: detectMediaType(blobRec.blob) };
}

// ═══════════════════════════════════════════════════════════════════════════════
// JSON Response Parsing (shared)
// ═══════════════════════════════════════════════════════════════════════════════

function extractJsonArray(text: string): Record<string, unknown>[] {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    return JSON.parse(match[0]) as Record<string, unknown>[];
  } catch (e) {
    console.warn("[CatalogLlmFill] Failed to parse JSON response:", e);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Batch Runner (shared by classify + title)
// ═══════════════════════════════════════════════════════════════════════════════

async function runBatchFill(
  candidates: ImageCandidate[],
  apiKey: string,
  useVision: boolean,
  spec: FillSpec,
  onProgress?: (progress: LlmFillProgress) => void,
): Promise<LlmFillResult> {
  const batchSize = useVision ? spec.visionBatchSize : spec.textBatchSize;
  const result: LlmFillResult = { updated: 0, skipped: 0, errors: 0, details: [] };

  const batches: ImageCandidate[][] = [];
  for (let i = 0; i < candidates.length; i += batchSize) {
    batches.push(candidates.slice(i, i + batchSize));
  }

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    onProgress?.({
      total: candidates.length,
      processed: batchIdx * batchSize,
      updated: result.updated,
      errors: result.errors,
      currentBatch: batchIdx + 1,
      totalBatches: batches.length,
    });

    try {
      let responseText: string;
      let activeBatch = batch;
      const instruction = typeof spec.batchInstruction === "function"
        ? spec.batchInstruction(batchIdx)
        : spec.batchInstruction;

      if (useVision) {
        // Build vision content blocks
        const contentBlocks: unknown[] = [];
        const loaded: ImageCandidate[] = [];

        for (let i = 0; i < batch.length; i++) {
          const img = batch[i];
          const blob = await loadImageBlob(img.imageId);
          if (!blob) continue;

          contentBlocks.push({ type: "text", text: spec.buildVisionLabel(img, i) });
          contentBlocks.push({
            type: "image",
            source: { type: "base64", media_type: blob.mediaType, data: blob.base64 },
          });
          loaded.push(img);
        }

        if (loaded.length === 0) {
          result.skipped += batch.length;
          continue;
        }

        contentBlocks.push({ type: "text", text: instruction });
        responseText = await callVisionApi(apiKey, spec.visionSystemPrompt, contentBlocks);
        activeBatch = loaded;
        result.skipped += batch.length - loaded.length;
      } else {
        // Build text prompt
        const entries = batch.map((img, i) => spec.buildTextEntry(img, i));
        const prompt = `${instruction}\n\n${entries.join("\n\n")}`;

        const llmClient = new LLMClient({ enabled: true, apiKey, model: "claude-haiku-4-5-20251001" });
        const callConfig = getCallConfig(spec.callType);
        const llmResult = await runTextCall({
          llmClient,
          callType: spec.callType,
          callConfig,
          systemPrompt: spec.textSystemPrompt,
          prompt,
        });
        responseText = llmResult.result.text;
      }

      // Parse and apply
      const parsed = extractJsonArray(responseText);
      for (const img of activeBatch) {
        const entry = parsed.find((e) => e.id === img.imageId);
        if (!entry) { result.skipped++; continue; }

        const updates = spec.parseEntry(entry, img);
        if (!updates) { result.skipped++; continue; }

        const fieldsSet = Object.keys(updates);
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
      console.error(`[CatalogLlmFill] ${spec.name} batch ${batchIdx + 1} failed:`, e);
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

// ═══════════════════════════════════════════════════════════════════════════════
// Classify Fill — styles + tags (NOT titles)
// ═══════════════════════════════════════════════════════════════════════════════

function buildStyleIdBlock(styleIds: StyleIds): string {
  return `ARTISTIC STYLES (pick one):
${styleIds.artisticStyleIds.join(", ")}

COMPOSITION STYLES (pick one):
${styleIds.compositionStyleIds.join(", ")}

COLOR PALETTES (pick one):
${styleIds.colorPaletteIds.join(", ")}`;
}

function classifySpec(styleIds: StyleIds): FillSpec {
  const styleBlock = buildStyleIdBlock(styleIds);
  const validArtistic = new Set(styleIds.artisticStyleIds);
  const validComposition = new Set(styleIds.compositionStyleIds);
  const validPalette = new Set(styleIds.colorPaletteIds);

  return {
    name: "classify",
    callType: "catalog.metadataFill",
    textBatchSize: 20,
    visionBatchSize: 5,

    textSystemPrompt: `You are a metadata classifier for a fantasy world image catalog. Given image generation prompts, classify each image into the correct style categories and generate tags.

For each image, you must select from EXACTLY these valid IDs:

${styleBlock}

Rules:
- artisticStyleId: Match based on the visual technique, medium, and artist references in the prompt.
- compositionStyleId: Match based on framing, subject arrangement, and scene type described.
- colorPaletteId: Match based on color references, mood, and tonal qualities in the prompt.
- tags: 3-8 descriptive tags. Subject matter, mood, setting, visual style. Lowercase, no punctuation.

You MUST use IDs from the lists above. Never invent new IDs.

Respond with valid JSON only. No markdown, no explanation.`,

    visionSystemPrompt: `You are a metadata classifier for a fantasy world image catalog. By looking at each image, classify it into the correct style categories and generate tags.

For each image, you must select from EXACTLY these valid IDs:

${styleBlock}

Rules:
- artisticStyleId: Match based on the visual technique and rendering style you see.
- compositionStyleId: Match based on the framing and subject arrangement.
- colorPaletteId: Match based on the dominant colors, mood, and tonal qualities visible.
- tags: 3-8 descriptive tags. Subject matter, mood, setting, visual style. Lowercase, no punctuation.

You MUST use IDs from the lists above. Never invent new IDs.

Respond with valid JSON only. No markdown, no explanation.`,

    buildTextEntry: (img, i) =>
      `[${i}] id="${img.imageId}"\nprompt: ${img.prompt.slice(0, 500)}`,

    buildVisionLabel: (img, i) =>
      `[${i}] id="${img.imageId}"`,

    batchInstruction: `Classify each image. Return a JSON array where each element has "id", "artisticStyleId", "compositionStyleId", "colorPaletteId", and "tags".`,

    parseEntry: (entry) => {
      const updates: Record<string, unknown> = {};
      if (typeof entry.artisticStyleId === "string" && validArtistic.has(entry.artisticStyleId)) {
        updates.artisticStyleId = entry.artisticStyleId;
      }
      if (typeof entry.compositionStyleId === "string" && validComposition.has(entry.compositionStyleId)) {
        updates.compositionStyleId = entry.compositionStyleId;
      }
      if (typeof entry.colorPaletteId === "string" && validPalette.has(entry.colorPaletteId)) {
        updates.colorPaletteId = entry.colorPaletteId;
      }
      if (Array.isArray(entry.tags) && entry.tags.length > 0) {
        updates.tags = entry.tags;
      }
      return Object.keys(updates).length > 0 ? updates : null;
    },
  };
}

export async function runClassifyFill(options: FillOptions): Promise<LlmFillResult> {
  const { projectId, apiKey, styleIds, useVision = false, onProgress } = options;

  const allImages = await db.images.where("projectId").equals(projectId).toArray();

  const candidates: ImageCandidate[] = [];
  for (const img of allImages) {
    const rec = img as unknown as Record<string, unknown>;
    const prompt = (rec.finalPrompt as string) || (rec.originalPrompt as string) || "";
    if (!useVision && !prompt) continue;

    const hasStyle = rec.artisticStyleId && rec.compositionStyleId && rec.colorPaletteId;
    const hasTags = (rec.tags as string[] | undefined)?.length;
    if (hasStyle && hasTags) continue;

    candidates.push({
      imageId: rec.imageId as string,
      prompt,
      entityName: (rec.entityName as string) || "",
      artisticStyleId: (rec.artisticStyleId as string) || "",
      compositionStyleId: (rec.compositionStyleId as string) || "",
      colorPaletteId: (rec.colorPaletteId as string) || "",
      imageType: (rec.imageType as string) || "",
    });
  }

  if (candidates.length === 0) {
    return { updated: 0, skipped: allImages.length, errors: 0, details: [] };
  }

  return runBatchFill(candidates, apiKey, useVision, classifySpec(styleIds), onProgress);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Title Fill — evocative titles informed by style context
// ═══════════════════════════════════════════════════════════════════════════════

const sharedTitleRules = `You are a gallery curator writing placards. Each title is 1-6 words. Single-word titles are rare and earn their brevity.

Your process:
1. Read the subject, style, and narrative context.
2. Identify what makes THIS image distinct from every other image in the collection.
3. Title that distinction. The viewer's eyes handle the visual; the title handles what the image means.

The artistic medium shapes the title's register and rhythm — a woodblock print title has different cadence than a baroque oil. Match the register to the image, not to a single gallery voice.

When an entity has a name, some titles in the batch should use it. The name becomes part of a larger phrase, not a label.

Scene titles name the turning point. Cover titles name the arc's defining tension.

Each title in this batch must use a different syntactic structure and different vocabulary from every other title in this batch. Vary sentence pattern, word count, register, and rhetorical strategy across the set. Titles can be fragments, questions, imperatives, compound nouns, complete sentences, or any other syntactic shape — use the full range. A batch of titles should read like the work of several different curators.

Respond with valid JSON only. No markdown, no explanation.`;

function resolveStyleContext(img: ImageCandidate, styleNames: StyleNameMap): string {
  const parts: string[] = [];
  if (img.artisticStyleId) {
    const name = styleNames.artistic.get(img.artisticStyleId) || img.artisticStyleId;
    parts.push(`artistic style: ${name}`);
  }
  if (img.compositionStyleId) {
    const name = styleNames.composition.get(img.compositionStyleId) || img.compositionStyleId;
    parts.push(`composition: ${name}`);
  }
  if (img.colorPaletteId) {
    const name = styleNames.palette.get(img.colorPaletteId) || img.colorPaletteId;
    parts.push(`palette: ${name}`);
  }
  if (img.entityName) parts.push(`entity: ${img.entityName}`);
  if (img.imageType) parts.push(`type: ${img.imageType}`);
  return parts.join(", ");
}

function titleSpec(styleNames: StyleNameMap): FillSpec {
  return {
    name: "title",
    callType: "catalog.titleFill",
    textBatchSize: 50,
    visionBatchSize: 5,

    textSystemPrompt: `You title artwork for a fantasy world gallery. You are given each image's generation prompt and style context. Use them to understand the narrative stakes, then title the subtext — what the image means, not what it shows.

${sharedTitleRules}`,

    visionSystemPrompt: `You title artwork for a fantasy world gallery. Look at each image and its style context. Title the subtext — what the image means, not what it shows.

${sharedTitleRules}`,

    buildTextEntry: (img, i) => {
      const context = resolveStyleContext(img, styleNames);
      return `[${i}] id="${img.imageId}"\n${context}\nprompt: ${img.prompt.slice(0, 400)}`;
    },

    buildVisionLabel: (img, i) => {
      const context = resolveStyleContext(img, styleNames);
      return `[${i}] id="${img.imageId}"\n${context}`;
    },

    batchInstruction: (batchIndex: number) => {
      // Rotate thematic lenses across batches to shift the model's conceptual neighborhood
      // and reduce formulaic repetition within and across batches.
      const lenses = [
        "Lean into irony, contradiction, or unexpected juxtaposition.",
        "Lean into stillness, absence, or what's been left behind.",
        "Lean into motion, transformation, or the moment just before change.",
        "Lean into names, places, or fragments of speech that carry narrative charge.",
        "Lean into texture, material, or the physical world — how things feel, not how they look.",
        "Lean into questions, ambiguity, or double meanings.",
        "Lean into the mythic register — titles that sound like they belong in oral tradition.",
        "Lean into brevity and punch — two or three words that land hard.",
      ];
      const lens = lenses[batchIndex % lenses.length];
      return `Title each image. ${lens} Return a JSON array where each element has "id" (string) and "title" (string).`;
    },

    parseEntry: (entry) => {
      if (typeof entry.title === "string" && entry.title.trim().length > 0) {
        return { title: entry.title.trim(), llmTitle: true };
      }
      return null;
    },
  };
}

/** Run title fill for a sample of images in a single batch. Returns the new titles. */
export async function runSampleTitles(
  imageIds: string[],
  apiKey: string,
  styleNames: StyleNameMap,
): Promise<{ imageId: string; title: string }[]> {
  const candidates: ImageCandidate[] = [];
  for (const imageId of imageIds) {
    const rec = await db.images.get(imageId) as unknown as Record<string, unknown> | undefined;
    if (!rec) continue;
    const prompt = (rec.finalPrompt as string) || (rec.originalPrompt as string) || "";
    if (!prompt) continue;
    candidates.push({
      imageId,
      prompt,
      entityName: (rec.entityName as string) || "",
      artisticStyleId: (rec.artisticStyleId as string) || "",
      compositionStyleId: (rec.compositionStyleId as string) || "",
      colorPaletteId: (rec.colorPaletteId as string) || "",
      imageType: (rec.imageType as string) || "",
    });
  }
  if (candidates.length === 0) return [];

  const spec = titleSpec(styleNames);
  const result = await runBatchFill(candidates, apiKey, false, spec);
  if (result.updated === 0) return [];

  // Read back the titles
  const titles: { imageId: string; title: string }[] = [];
  for (const c of candidates) {
    const updated = await db.images.get(c.imageId) as unknown as Record<string, unknown> | undefined;
    if (updated?.llmTitle && updated?.title) {
      titles.push({ imageId: c.imageId, title: updated.title as string });
    }
  }
  return titles;
}

export async function runTitleFill(options: TitleFillOptions): Promise<LlmFillResult> {
  const { projectId, apiKey, styleIds, styleNames, useVision = false, onProgress } = options;

  const allImages = await db.images.where("projectId").equals(projectId).toArray();

  const candidates: ImageCandidate[] = [];
  for (const img of allImages) {
    const rec = img as unknown as Record<string, unknown>;
    const prompt = (rec.finalPrompt as string) || (rec.originalPrompt as string) || "";

    // Candidate if llmTitle is not true (never had an LLM-generated title)
    if (rec.llmTitle) continue;

    // Text mode requires prompt and style context; vision mode can work without
    if (!useVision) {
      if (!prompt) continue;
      if (!rec.artisticStyleId || !rec.compositionStyleId) continue;
    }

    candidates.push({
      imageId: rec.imageId as string,
      prompt,
      entityName: (rec.entityName as string) || "",
      artisticStyleId: (rec.artisticStyleId as string) || "",
      compositionStyleId: (rec.compositionStyleId as string) || "",
      colorPaletteId: (rec.colorPaletteId as string) || "",
      imageType: (rec.imageType as string) || "",
    });
  }

  if (candidates.length === 0) {
    return { updated: 0, skipped: allImages.length, errors: 0, details: [] };
  }

  return runBatchFill(candidates, apiKey, useVision, titleSpec(styleNames), onProgress);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Retitle — replace existing titles with something structurally different
// ═══════════════════════════════════════════════════════════════════════════════

function retitleSpec(styleNames: StyleNameMap, corpus: string[]): FillSpec {
  const corpusBlock = corpus.length > 0
    ? `\nTITLES ALREADY IN THE COLLECTION (do not echo their patterns, sentence shapes, or vocabulary):\n${corpus.map((t) => `- ${t}`).join("\n")}\n`
    : "";

  const systemPrompt = `You are retitling artwork in a fantasy world gallery. Each image already has a title that was too similar to another title in the collection. Your job is to replace it with something in a completely different register, cadence, and syntactic shape.

${sharedTitleRules}${corpusBlock}`;

  return {
    name: "retitle",
    callType: "catalog.titleFill",
    textBatchSize: 50,
    visionBatchSize: 5,

    textSystemPrompt: systemPrompt,
    visionSystemPrompt: systemPrompt,

    buildTextEntry: (img, i) => {
      const context = resolveStyleContext(img, styleNames);
      const current = img.currentTitle ? `\ncurrent title (REPLACE — use different tone, structure, and vocabulary): "${img.currentTitle}"` : "";
      return `[${i}] id="${img.imageId}"\n${context}${current}\nprompt: ${img.prompt.slice(0, 400)}`;
    },

    buildVisionLabel: (img, i) => {
      const context = resolveStyleContext(img, styleNames);
      const current = img.currentTitle ? `\ncurrent title (REPLACE): "${img.currentTitle}"` : "";
      return `[${i}] id="${img.imageId}"\n${context}${current}`;
    },

    batchInstruction: (batchIndex: number) => {
      const lenses = [
        "Lean into irony, contradiction, or unexpected juxtaposition.",
        "Lean into stillness, absence, or what's been left behind.",
        "Lean into motion, transformation, or the moment just before change.",
        "Lean into names, places, or fragments of speech that carry narrative charge.",
        "Lean into texture, material, or the physical world — how things feel, not how they look.",
        "Lean into questions, ambiguity, or double meanings.",
        "Lean into the mythic register — titles that sound like they belong in oral tradition.",
        "Lean into brevity and punch — two or three words that land hard.",
      ];
      const lens = lenses[batchIndex % lenses.length];
      return `Retitle each image. Each new title must differ from its current title in tone, cadence, and word choice. ${lens} Return a JSON array where each element has "id" (string) and "title" (string).`;
    },

    parseEntry: (entry) => {
      if (typeof entry.title === "string" && entry.title.trim().length > 0) {
        return { title: entry.title.trim(), llmTitle: true };
      }
      return null;
    },
  };
}

export interface RetitleOptions {
  /** Image IDs to retitle. */
  imageIds: string[];
  apiKey: string;
  styleNames: StyleNameMap;
  /** Corpus of existing titles to avoid echoing. */
  corpus: string[];
  onProgress?: (progress: LlmFillProgress) => void;
}

export async function runRetitle(options: RetitleOptions): Promise<LlmFillResult> {
  const { imageIds, apiKey, styleNames, corpus, onProgress } = options;

  const candidates: ImageCandidate[] = [];
  for (const imageId of imageIds) {
    const rec = await db.images.get(imageId) as unknown as Record<string, unknown> | undefined;
    if (!rec) continue;
    candidates.push({
      imageId,
      prompt: (rec.finalPrompt as string) || (rec.originalPrompt as string) || "",
      entityName: (rec.entityName as string) || "",
      artisticStyleId: (rec.artisticStyleId as string) || "",
      compositionStyleId: (rec.compositionStyleId as string) || "",
      colorPaletteId: (rec.colorPaletteId as string) || "",
      imageType: (rec.imageType as string) || "",
      currentTitle: (rec.title as string) || "",
    });
  }

  if (candidates.length === 0) {
    return { updated: 0, skipped: 0, errors: 0, details: [] };
  }

  return runBatchFill(candidates, apiKey, false, retitleSpec(styleNames, corpus), onProgress);
}
