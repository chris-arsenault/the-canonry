/**
 * Era Narrative Image Refs
 *
 * Image reference placement and cover image scene generation for era narratives.
 * Extracted from eraNarrativeTask.ts for file-length compliance.
 */

import type { WorkerTask } from "../../lib/enrichmentTypes";
import type { TaskContext } from "./taskTypes";
import type { TaskResult } from "../types";
import type {
  EraNarrativeRecord,
  EraNarrativeCoverImage,
  EraNarrativeImageRef,
  EraNarrativeImageRefs,
  EraNarrativeImageSize,
  ChronicleImageRef as EraNarrativeChronicleImageRef,
  EraNarrativePromptRequestRef,
} from "../../lib/eraNarrativeTypes";
import {
  resolveActiveContent,
  updateEraNarrativeCoverImage,
  updateEraNarrativeImageRefs,
} from "../../lib/db/eraNarrativeRepository";
import { runTextCall } from "../../lib/llmTextCall";
import { getCallConfig } from "./llmCallConfig";
import { saveCostRecordWithDefaults, type CostType } from "../../lib/db/costRepository";
import { buildCoverImageScenePrompt } from "./eraNarrativePrompts";

// ============================================================================
// Types
// ============================================================================

export interface AvailableChronicleImage {
  chronicleId: string;
  chronicleTitle: string;
  imageSource: "cover" | "image_ref";
  imageRefId?: string;
  imageId: string;
  sceneDescription: string;
}

// ============================================================================
// Image Refs Prompt & Parsing
// ============================================================================

function splitNarrativeIntoChunks(content: string): { index: number; text: string }[] {
  const words = content.split(/\s+/);
  const wordCount = words.length;
  let chunkCount: number;
  if (wordCount < 1500) chunkCount = 3;
  else if (wordCount < 3000) chunkCount = 4;
  else if (wordCount < 5000) chunkCount = 5;
  else if (wordCount < 7000) chunkCount = 6;
  else chunkCount = 7;
  // eslint-disable-next-line sonarjs/pseudo-random -- non-security chunk size jitter
  chunkCount += Math.random() < 0.5 ? -1 : 1;
  chunkCount = Math.max(3, Math.min(7, chunkCount));

  const chunkSize = Math.ceil(wordCount / chunkCount);
  const chunks: { index: number; text: string }[] = [];

  for (let i = 0; i < chunkCount; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, wordCount);
    if (start >= wordCount) break;
    chunks.push({ index: i, text: words.slice(start, end).join(" ") });
  }

  return chunks;
}

function buildImageRefsPrompt(
  content: string,
  eraName: string,
  availableImages: AvailableChronicleImage[]
): string {
  const chunks = splitNarrativeIntoChunks(content);

  const imageList =
    availableImages.length > 0
      ? availableImages
          .map((img) => {
            const source = img.imageSource === "cover" ? "cover image" : "scene image";
            const refSuffix = img.imageRefId ? `:${img.imageRefId}` : "";
            return `- [${img.chronicleId}${refSuffix}] "${img.chronicleTitle}" (${source}): ${img.sceneDescription}`;
          })
          .join("\n")
      : "(No chronicle images available — use prompt_request for all images)";

  const chunksDisplay = chunks
    .map((chunk) => `### CHUNK ${chunk.index + 1} of ${chunks.length}\n${chunk.text}\n----`)
    .join("\n\n");

  return `You are placing image references in an era narrative for ${eraName}. The era narrative is a mythic-historical text about cultural forces and world transformation.

## Available Chronicle Images
These illustrations come from the individual chronicles of this era. Reference them where the era narrative discusses the events or cultures those chronicles depict.

${imageList}

## Instructions
The narrative has been divided into ${chunks.length} chunks. For EACH chunk, decide whether it deserves an image (0 or 1 per chunk).

For each image, choose one type:

1. **Chronicle Reference** (type: "chronicle_ref") - Use an existing chronicle illustration
   - Use when the narrative discusses events or cultures depicted in an available chronicle image
   - Provide the chronicleId, chronicleTitle, imageSource, and imageId from the list above

2. **Prompt Request** (type: "prompt_request") - Request a new generated image
   - Use for scenes that have no matching chronicle image
   - Describe the scene at cultural/civilizational scale — landscapes, architecture, forces — not individual character portraits

## Output Format
Return a JSON object:
{
  "imageRefs": [
    {
      "type": "chronicle_ref",
      "chronicleId": "<chronicle id>",
      "chronicleTitle": "<chronicle title>",
      "imageSource": "cover|image_ref",
      "imageRefId": "<ref id if image_ref source, omit for cover>",
      "imageId": "<image id>",
      "anchorText": "<exact 5-15 word phrase from the narrative>",
      "size": "small|medium|large|full-width",
      "caption": "<optional>"
    },
    {
      "type": "prompt_request",
      "sceneDescription": "<vivid 1-2 sentence scene at cultural scale>",
      "anchorText": "<exact 5-15 word phrase from the narrative>",
      "size": "small|medium|large|full-width",
      "caption": "<optional>"
    }
  ]
}

## Size Guidelines
- small: 150px, supplementary/margin images
- medium: 300px, standard images
- large: 450px, key scenes
- full-width: 100%, establishing shots

## Rules
- Suggest 0 or 1 image per chunk (total 2-5 images for the whole narrative)
- anchorText MUST be an exact phrase from the chunk's text
- Prefer chronicle_ref when a matching image exists — reuse before generating new
- Return valid JSON only, no markdown

## Narrative Chunks
${chunksDisplay}`;
}

// ============================================================================
// Image Ref Parsing
// ============================================================================

interface RawImageRef {
  type: unknown;
  chronicleId?: unknown;
  chronicleTitle?: unknown;
  imageSource?: unknown;
  imageRefId?: unknown;
  imageId?: unknown;
  sceneDescription?: unknown;
  anchorText?: unknown;
  size?: unknown;
  caption?: unknown;
}

interface ParsedImageRefsResponse {
  imageRefs: RawImageRef[];
}

const VALID_SIZES: EraNarrativeImageSize[] = ["small", "medium", "large", "full-width"];

function parseChronicleRef(
  ref: RawImageRef,
  index: number,
  anchorText: string,
  size: EraNarrativeImageSize,
  caption: string | undefined,
  availableMap: Map<string, AvailableChronicleImage>
): EraNarrativeChronicleImageRef {
  const refId = `enimgref_${Date.now()}_${index}`;
  const chronicleId = typeof ref.chronicleId === "string" ? ref.chronicleId : "";
  const chronicleTitle = typeof ref.chronicleTitle === "string" ? ref.chronicleTitle : "";
  const imageSource =
    ref.imageSource === "image_ref" ? ("image_ref" as const) : ("cover" as const);
  const imageRefId = typeof ref.imageRefId === "string" ? ref.imageRefId : undefined;
  const imageId = typeof ref.imageId === "string" ? ref.imageId : "";

  const key = `${chronicleId}:${imageSource}:${imageRefId || ""}`;
  const available = availableMap.get(key);
  const resolvedImageId = available?.imageId || imageId || "";

  if (!resolvedImageId) {
    throw new Error(`chronicle_ref at index ${index} has no valid imageId`);
  }

  return {
    refId,
    type: "chronicle_ref",
    chronicleId,
    chronicleTitle: chronicleTitle || available?.chronicleTitle || "",
    imageSource,
    imageRefId,
    imageId: resolvedImageId,
    anchorText,
    size,
    caption,
  };
}

function parsePromptRequest(
  ref: RawImageRef,
  index: number,
  anchorText: string,
  size: EraNarrativeImageSize,
  caption: string | undefined
): EraNarrativePromptRequestRef {
  const refId = `enimgref_${Date.now()}_${index}`;
  const sceneDescription = typeof ref.sceneDescription === "string" ? ref.sceneDescription : "";
  if (!sceneDescription) {
    throw new Error(`prompt_request at index ${index} missing sceneDescription`);
  }
  return {
    refId,
    type: "prompt_request",
    sceneDescription,
    anchorText,
    size,
    caption,
    status: "pending",
  };
}

function parseEraNarrativeImageRefsResponse(
  text: string,
  availableImages: AvailableChronicleImage[]
): EraNarrativeImageRef[] {
  // eslint-disable-next-line sonarjs/slow-regex -- bounded LLM response text
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON object found");

  const parsed = JSON.parse(jsonMatch[0]) as ParsedImageRefsResponse;
  const rawRefs = parsed.imageRefs;
  if (!rawRefs || !Array.isArray(rawRefs)) {
    throw new Error("imageRefs array not found");
  }

  const availableMap = new Map(
    availableImages.map((img) => [
      `${img.chronicleId}:${img.imageSource}:${img.imageRefId || ""}`,
      img,
    ])
  );

  return rawRefs.map((ref, index) => {
    const anchorText = typeof ref.anchorText === "string" ? ref.anchorText : "";
    const rawSize = typeof ref.size === "string" ? ref.size : "medium";
    const size: EraNarrativeImageSize = VALID_SIZES.includes(rawSize as EraNarrativeImageSize)
      ? (rawSize as EraNarrativeImageSize)
      : "medium";
    const caption = typeof ref.caption === "string" ? ref.caption : undefined;

    if (ref.type === "chronicle_ref") {
      return parseChronicleRef(ref, index, anchorText, size, caption, availableMap);
    } else if (ref.type === "prompt_request") {
      return parsePromptRequest(ref, index, anchorText, size, caption);
    }
    throw new Error(`Unknown image ref type at index ${index}: ${String(ref.type)}`);
  });
}

function resolveAnchorPhrase(
  anchorText: string,
  content: string
): { phrase: string; index: number } | null {
  if (!anchorText) return null;
  const index = content.indexOf(anchorText);
  if (index >= 0) return { phrase: anchorText, index };
  const lowerContent = content.toLowerCase();
  const lowerAnchor = anchorText.toLowerCase();
  const lowerIndex = lowerContent.indexOf(lowerAnchor);
  if (lowerIndex >= 0) {
    return { phrase: content.slice(lowerIndex, lowerIndex + anchorText.length), index: lowerIndex };
  }
  return null;
}

// ============================================================================
// Cover Image Scene Response Parsing
// ============================================================================

interface CoverImageSceneResponse {
  coverImageScene?: string;
}

// ============================================================================
// Cover Image Scene Step
// ============================================================================

export async function executeCoverImageSceneStep(
  task: WorkerTask,
  record: EraNarrativeRecord,
  context: TaskContext
): Promise<TaskResult> {
  const { config, llmClient, isAborted } = context;

  const { content } = resolveActiveContent(record);
  if (!content) {
    return { success: false, error: "No narrative content for cover image scene" };
  }

  if (!record.threadSynthesis) {
    return { success: false, error: "Thread synthesis required for cover image scene" };
  }

  const callType = "historian.eraNarrative.coverImageScene" as const;
  const callConfig = getCallConfig(config, callType);

  const prompt = buildCoverImageScenePrompt(
    record.eraName,
    record.threadSynthesis.thesis,
    record.threadSynthesis.counterweight,
    record.threadSynthesis.threads,
    content
  );

  const callResult = await runTextCall({
    llmClient,
    callType,
    callConfig,
    systemPrompt:
      "You are a visual art director creating cover image compositions for mythic-historical texts. Always respond with valid JSON.",
    prompt,
    temperature: 0.5,
  });

  if (isAborted()) {
    return { success: false, error: "Task aborted" };
  }

  const resultText = callResult.result.text?.trim();
  if (callResult.result.error || !resultText) {
    return {
      success: false,
      error: `Cover image scene failed: ${callResult.result.error || "Empty response"}`,
    };
  }

  let sceneDescription: string;
  try {
    // eslint-disable-next-line sonarjs/slow-regex -- bounded LLM response text
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    const parsed = JSON.parse(jsonMatch[0]) as CoverImageSceneResponse;
    sceneDescription =
      typeof parsed.coverImageScene === "string" ? parsed.coverImageScene.trim() : "";
    if (!sceneDescription) throw new Error("Empty coverImageScene");
  } catch {
    return { success: false, error: "Failed to parse cover image scene response" };
  }

  const coverImage: EraNarrativeCoverImage = {
    sceneDescription,
    status: "pending",
  };

  const costs = {
    estimated: callResult.estimate.estimatedCost,
    actual: callResult.usage.actualCost,
    inputTokens: callResult.usage.inputTokens,
    outputTokens: callResult.usage.outputTokens,
  };

  await updateEraNarrativeCoverImage(record.narrativeId, coverImage, costs, callConfig.model);

  await saveCostRecordWithDefaults({
    projectId: task.projectId,
    simulationRunId: task.simulationRunId,
    type: "eraNarrativeCoverImageScene" as CostType,
    model: callConfig.model,
    estimatedCost: costs.estimated,
    actualCost: costs.actual,
    inputTokens: costs.inputTokens,
    outputTokens: costs.outputTokens,
  });

  return { success: true, result: { generatedAt: Date.now(), model: callConfig.model } };
}

// ============================================================================
// Image Refs Step
// ============================================================================

export async function executeImageRefsStep(
  task: WorkerTask,
  record: EraNarrativeRecord,
  context: TaskContext
): Promise<TaskResult> {
  const { config, llmClient, isAborted } = context;

  const { content } = resolveActiveContent(record);
  if (!content) {
    return { success: false, error: "No narrative content for image refs" };
  }

  const availableImages: AvailableChronicleImage[] =
    (task as unknown as { availableChronicleImages?: AvailableChronicleImage[] })
      .availableChronicleImages || [];

  const callType = "historian.eraNarrative.imageRefs" as const;
  const callConfig = getCallConfig(config, callType);
  const prompt = buildImageRefsPrompt(content, record.eraName, availableImages);

  const callResult = await runTextCall({
    llmClient,
    callType,
    callConfig,
    systemPrompt:
      "You are placing image references in a mythic-historical era narrative. Always respond with valid JSON.",
    prompt,
    temperature: 0.4,
  });

  if (isAborted()) {
    return { success: false, error: "Task aborted" };
  }

  const resultText = callResult.result.text?.trim();
  if (callResult.result.error || !resultText) {
    return {
      success: false,
      error: `Image refs failed: ${callResult.result.error || "Empty response"}`,
    };
  }

  let parsedRefs: EraNarrativeImageRef[];
  try {
    parsedRefs = parseEraNarrativeImageRefsResponse(resultText, availableImages);
  } catch (e) {
    return {
      success: false,
      error: `Failed to parse image refs: ${e instanceof Error ? e.message : "Unknown error"}`,
    };
  }

  if (parsedRefs.length === 0) {
    return { success: false, error: "No image refs found in response" };
  }

  for (const ref of parsedRefs) {
    if (ref.anchorText) {
      const resolved = resolveAnchorPhrase(ref.anchorText, content);
      if (resolved) {
        ref.anchorText = resolved.phrase;
        ref.anchorIndex = resolved.index;
      }
    }
  }

  const imageRefs: EraNarrativeImageRefs = {
    refs: parsedRefs,
    generatedAt: Date.now(),
    model: callConfig.model,
  };

  const costs = {
    estimated: callResult.estimate.estimatedCost,
    actual: callResult.usage.actualCost,
    inputTokens: callResult.usage.inputTokens,
    outputTokens: callResult.usage.outputTokens,
  };

  await updateEraNarrativeImageRefs(record.narrativeId, imageRefs, costs, callConfig.model);

  await saveCostRecordWithDefaults({
    projectId: task.projectId,
    simulationRunId: task.simulationRunId,
    type: "eraNarrativeImageRefs" as CostType,
    model: callConfig.model,
    estimatedCost: costs.estimated,
    actualCost: costs.actual,
    inputTokens: costs.inputTokens,
    outputTokens: costs.outputTokens,
  });

  return { success: true, result: { generatedAt: Date.now(), model: callConfig.model } };
}
