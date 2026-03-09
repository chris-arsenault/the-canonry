import type { WorkerTask } from "../../lib/enrichmentTypes";
import { isChronicleImage } from "../../lib/imageTypes";
import { estimateImageCost, calculateActualImageCost } from "../../lib/costEstimation";
import { saveImage, generateImageId, extractImageDimensions } from "../../lib/db/imageRepository";
import { saveCostRecordWithDefaults } from "../../lib/db/costRepository";
import { runTextCall } from "../../lib/llmTextCall";
import { boostSaturation } from "../../lib/imagePostProcess";
import { getCallConfig } from "./llmCallConfig";
import {
  getModelPromptSuffix,
  resolveImageSize,
  getFluxGeneration,
  getOpenAiModelFamily,
  FLUX_1_IMAGE_PROMPT_TEMPLATE,
  FLUX_1_CHRONICLE_IMAGE_PROMPT_TEMPLATE,
  FLUX_2_SUBJECT_SYNTHESIS_TEMPLATE,
  FLUX_2_CHRONICLE_SUBJECT_SYNTHESIS_TEMPLATE,
  GPT_IMAGE_PROMPT_TEMPLATE,
  GPT_IMAGE_CHRONICLE_PROMPT_TEMPLATE,
  DALLE3_IMAGE_PROMPT_TEMPLATE,
  DALLE3_CHRONICLE_IMAGE_PROMPT_TEMPLATE,
  parsePromptSections,
  extractDeterministicFlux2Fields,
  extractSubjectText,
  mergeFlux2JsonPrompt,
  buildPaletteContext,
} from "../../lib/imageSettings";
import type { TaskHandler } from "./taskTypes";
import type { LLMClient } from "../../lib/llmClient";
import type { ResolvedLLMCallConfig } from "../../lib/llmModelSettings";

interface ImagePromptFormatResult {
  prompt: string;
  /** The full prompt sent to Claude for formatting (template + globalImageRules + original prompt) */
  formattingPrompt?: string;
  cost?: {
    estimated: number;
    actual: number;
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * Format an image prompt using Claude (multishot prompting)
 */
async function formatImagePromptWithClaude(
  originalPrompt: string,
  config: {
    useClaudeForImagePrompt?: boolean;
    claudeImagePromptTemplate?: string;
    claudeChronicleImagePromptTemplate?: string;
    imageModel?: string;
    globalImageRules?: string;
  },
  llmClient: LLMClient,
  callConfig: ResolvedLLMCallConfig,
  isChronicleImage?: boolean
): Promise<ImagePromptFormatResult> {
  // Select template by model family. Each model family has a specialized
  // reformatter. Flux 2 is handled separately via formatFlux2Prompt.
  const imageModel = config.imageModel || "dall-e-3";
  let templateSource: string | undefined;
  const fluxGen = getFluxGeneration(imageModel);
  const openAiFamily = getOpenAiModelFamily(imageModel);
  if (openAiFamily === "gpt-image") {
    templateSource = isChronicleImage
      ? GPT_IMAGE_CHRONICLE_PROMPT_TEMPLATE
      : GPT_IMAGE_PROMPT_TEMPLATE;
  } else if (openAiFamily === "dall-e-3") {
    templateSource = isChronicleImage
      ? DALLE3_CHRONICLE_IMAGE_PROMPT_TEMPLATE
      : DALLE3_IMAGE_PROMPT_TEMPLATE;
  } else if (fluxGen === "flux-1") {
    templateSource = isChronicleImage
      ? FLUX_1_CHRONICLE_IMAGE_PROMPT_TEMPLATE
      : FLUX_1_IMAGE_PROMPT_TEMPLATE;
  } else {
    templateSource =
      isChronicleImage && config.claudeChronicleImagePromptTemplate
        ? config.claudeChronicleImagePromptTemplate
        : config.claudeImagePromptTemplate;
  }

  if (!config.useClaudeForImagePrompt || !templateSource) {
    return { prompt: originalPrompt };
  }

  if (!llmClient.isEnabled()) {
    console.warn("[Worker] Claude not configured, skipping image prompt formatting");
    return { prompt: originalPrompt };
  }

  const globalRules = config.globalImageRules || "";
  const formattingPrompt = templateSource
    .replace(/\{\{modelName\}\}/g, imageModel)
    .replace(/\{\{prompt\}\}/g, originalPrompt)
    .replace(/\{\{globalImageRules\}\}/g, globalRules);

  try {
    const formattingCall = await runTextCall({
      llmClient,
      callType: isChronicleImage ? "image.chronicleFormatting" : "image.promptFormatting",
      callConfig,
      systemPrompt:
        "You are a prompt engineer specializing in image generation. Respond only with the reformatted prompt, no explanations or preamble.",
      prompt: formattingPrompt,
      temperature: 0.3,
    });
    const result = formattingCall.result;

    if (result.text && !result.error) {
      console.log("[Worker] Formatted image prompt with Claude");

      return {
        prompt: result.text.trim(),
        formattingPrompt,
        cost: {
          estimated: formattingCall.estimate.estimatedCost,
          actual: formattingCall.usage.actualCost,
          inputTokens: formattingCall.usage.inputTokens,
          outputTokens: formattingCall.usage.outputTokens,
        },
      };
    }
  } catch (err) {
    console.warn("[Worker] Failed to format image prompt with Claude:", err);
  }

  return { prompt: originalPrompt, formattingPrompt };
}

/**
 * Format a Flux 2 prompt: deterministic JSON fields + LLM-synthesized subjects/scene.
 * Style, palette, composition, background come directly from parsed sections.
 * Claude only synthesizes scene, subjects, lighting, mood from the visual description.
 */
async function formatFlux2Prompt(
  originalPrompt: string,
  config: {
    useClaudeForImagePrompt?: boolean;
    imageModel?: string;
  },
  llmClient: LLMClient,
  callConfig: ResolvedLLMCallConfig,
  isChronicle: boolean
): Promise<ImagePromptFormatResult> {
  const sections = parsePromptSections(originalPrompt);
  const deterministic = extractDeterministicFlux2Fields(sections);
  const subjectText = extractSubjectText(sections, isChronicle);

  // If no subject text, wrap preamble/original in minimal JSON with deterministic fields
  if (!subjectText.trim()) {
    const fallback = sections["_preamble"] || originalPrompt;
    const json = mergeFlux2JsonPrompt(deterministic, JSON.stringify({
      scene: fallback,
      subjects: [{ type: "Subject", description: fallback, position: "centered in frame", color_match: "exact" }],
    }));
    return { prompt: json };
  }

  // If Claude is disabled or not configured, use raw subject text in JSON structure
  if (!config.useClaudeForImagePrompt || !llmClient.isEnabled()) {
    const json = mergeFlux2JsonPrompt(deterministic, JSON.stringify({
      scene: subjectText.substring(0, 300),
      subjects: [{ type: "Subject", description: subjectText, position: "centered in frame", color_match: "exact" }],
    }));
    return { prompt: json };
  }

  const template = isChronicle
    ? FLUX_2_CHRONICLE_SUBJECT_SYNTHESIS_TEMPLATE
    : FLUX_2_SUBJECT_SYNTHESIS_TEMPLATE;

  // Build palette context — primary (for subjects) and secondary (for atmosphere)
  const paletteContext = buildPaletteContext(
    deterministic.color_palette_hex,
    deterministic.color_palette_text,
  );

  const formattingPrompt = template
    .replace(/\{\{subjectText\}\}/g, subjectText)
    .replace(/\{\{paletteContext\}\}/g, paletteContext);

  try {
    const formattingCall = await runTextCall({
      llmClient,
      callType: isChronicle ? "image.chronicleFormatting" : "image.promptFormatting",
      callConfig,
      systemPrompt:
        "You are a prompt engineer for image generation. Output valid JSON only — no code fences, no markdown, no explanation.",
      prompt: formattingPrompt,
      temperature: 0.3,
    });
    const result = formattingCall.result;

    if (result.text && !result.error) {
      console.log("[Worker] Flux 2: synthesized subjects, merged with deterministic fields");
      return {
        prompt: mergeFlux2JsonPrompt(deterministic, result.text),
        formattingPrompt,
        cost: {
          estimated: formattingCall.estimate.estimatedCost,
          actual: formattingCall.usage.actualCost,
          inputTokens: formattingCall.usage.inputTokens,
          outputTokens: formattingCall.usage.outputTokens,
        },
      };
    }
  } catch (err) {
    console.warn("[Worker] Flux 2 subject synthesis failed:", err);
  }

  // Fallback: deterministic fields + raw subject text
  const json = mergeFlux2JsonPrompt(deterministic, JSON.stringify({
    scene: subjectText.substring(0, 300),
    subjects: [{ type: "Subject", description: subjectText, position: "centered in frame", color_match: "exact" }],
  }));
  return { prompt: json, formattingPrompt };
}

export const imageTask = {
  type: "image",
  async execute(task, context) {
    const { config, llmClient, imageClient, isAborted } = context;

    if (!imageClient.isEnabled()) {
      return { success: false, error: "Image generation not configured - missing API key for selected image model" };
    }

    const imageModel = config.imageModel || "dall-e-3";
    // Use task-level overrides if provided, otherwise fall back to global config
    const imageSize = resolveImageSize(imageModel, task.imageSize || config.imageSize || "auto");
    const imageQuality = task.imageQuality || config.imageQuality || "standard";
    const estimatedCost = estimateImageCost(imageModel, imageSize, imageQuality);

    // Store original prompt before any refinement
    const originalPrompt = task.prompt;

    let finalPrompt: string;
    let formattingPrompt: string | undefined;
    let formatCost: ImagePromptFormatResult["cost"] | undefined;

    if (task.skipPromptFormatting) {
      // Raw mode: send prompt directly to image API without Claude formatting
      finalPrompt = originalPrompt;
    } else {
      const isChronicle = isChronicleImage(task.imageType);
      const formattingCallType = isChronicle
        ? "image.chronicleFormatting"
        : "image.promptFormatting";
      const formattingConfig = getCallConfig(config, formattingCallType);

      const fluxGen = getFluxGeneration(imageModel);
      if (fluxGen === "flux-2") {
        // Flux 2: deterministic JSON fields + LLM-synthesized subjects/scene
        const formatResult = await formatFlux2Prompt(
          originalPrompt, config, llmClient, formattingConfig, isChronicle
        );
        formattingPrompt = formatResult.formattingPrompt;
        formatCost = formatResult.cost;
        finalPrompt = formatResult.prompt;
      } else {
        // Flux 1 and other models: full Claude reformatting
        const formatResult = await formatImagePromptWithClaude(
          originalPrompt, config, llmClient, formattingConfig, isChronicle
        );
        formattingPrompt = formatResult.formattingPrompt;
        formatCost = formatResult.cost;
        const modelSuffix = getModelPromptSuffix(imageModel);
        finalPrompt = modelSuffix
          ? `${formatResult.prompt}\n\n${modelSuffix}`
          : formatResult.prompt;
      }
    }

    // Save imagePrompt cost record if Claude was used
    if (formatCost) {
      const isChronicle2 = isChronicleImage(task.imageType);
      const costCallType = isChronicle2
        ? "image.chronicleFormatting"
        : "image.promptFormatting";
      const costCallConfig = getCallConfig(config, costCallType);
      await saveCostRecordWithDefaults({
        projectId: task.projectId,
        simulationRunId: task.simulationRunId,
        entityId: task.entityId,
        entityName: task.entityName,
        entityKind: task.entityKind,
        type: "imagePrompt",
        model: costCallConfig.model,
        estimatedCost: formatCost.estimated,
        actualCost: formatCost.actual,
        inputTokens: formatCost.inputTokens,
        outputTokens: formatCost.outputTokens,
      });
    }

    if (isAborted()) {
      return { success: false, error: "Task aborted" };
    }

    const result = await imageClient.generate({ prompt: finalPrompt, size: imageSize });
    const debug = result.debug;

    if (isAborted()) {
      return { success: false, error: "Task aborted" };
    }

    if (result.error) {
      return { success: false, error: result.error, debug };
    }

    if (!result.imageBlob) {
      return { success: false, error: "No image data returned from API" };
    }

    // Boost saturation 3x for Flux 2 — compensates for washed-out API output
    const fluxGenForPost = getFluxGeneration(imageModel);
    const imageBlob = fluxGenForPost === "flux-2"
      ? await boostSaturation(result.imageBlob, 3.0)
      : result.imageBlob;

    const actualCost = calculateActualImageCost(imageModel, imageSize, imageQuality, result.usage);
    const generatedAt = Date.now();
    const imageId = generateImageId(task.entityId);

    // Extract image dimensions for aspect-aware display
    const dimensions = await extractImageDimensions(imageBlob);

    // Save directly to IndexedDB
    await saveImage(imageId, imageBlob, {
      entityId: task.entityId,
      projectId: task.projectId,
      entityName: task.entityName,
      entityKind: task.entityKind,
      entityCulture: task.entityCulture,
      originalPrompt,
      formattingPrompt,
      finalPrompt,
      generatedAt,
      model: imageModel,
      requestedSize: imageSize,
      revisedPrompt: result.revisedPrompt,
      estimatedCost,
      actualCost,
      inputTokens: result.usage?.inputTokens,
      outputTokens: result.usage?.outputTokens,
      // Image dimensions for aspect-aware display
      width: dimensions.width,
      height: dimensions.height,
      aspect: dimensions.aspect,
      // Chronicle image fields
      imageType: task.imageType,
      chronicleId: task.chronicleId,
      imageRefId: task.imageRefId,
      sceneDescription: task.sceneDescription,
    });

    // Save cost record independently
    await saveCostRecordWithDefaults({
      projectId: task.projectId,
      simulationRunId: task.simulationRunId,
      entityId: task.entityId,
      entityName: task.entityName,
      entityKind: task.entityKind,
      type: "image",
      model: imageModel,
      estimatedCost,
      actualCost,
      inputTokens: result.usage?.inputTokens || 0,
      outputTokens: result.usage?.outputTokens || 0,
    });

    return {
      success: true,
      result: {
        imageId,
        revisedPrompt: result.revisedPrompt,
        generatedAt,
        model: imageModel,
        estimatedCost,
        actualCost,
        inputTokens: result.usage?.inputTokens,
        outputTokens: result.usage?.outputTokens,
        // Image dimensions for aspect-aware display
        width: dimensions.width,
        height: dimensions.height,
        aspect: dimensions.aspect,
      },
      debug,
    };
  },
} satisfies TaskHandler<WorkerTask & { type: "image" }>;
