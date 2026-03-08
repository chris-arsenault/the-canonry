import type { WorkerTask } from "../../lib/enrichmentTypes";
import { estimateImageCost, calculateActualImageCost } from "../../lib/costEstimation";
import { saveImage, generateImageId, extractImageDimensions } from "../../lib/db/imageRepository";
import { saveCostRecordWithDefaults } from "../../lib/db/costRepository";
import { runTextCall } from "../../lib/llmTextCall";
import { getCallConfig } from "./llmCallConfig";
import {
  getModelPromptSuffix,
  resolveImageSize,
  isFluxModel,
  getFluxGeneration,
  FLUX_1_IMAGE_PROMPT_TEMPLATE,
  FLUX_1_CHRONICLE_IMAGE_PROMPT_TEMPLATE,
  FLUX_2_IMAGE_PROMPT_TEMPLATE,
  FLUX_2_CHRONICLE_IMAGE_PROMPT_TEMPLATE,
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
  // Select template: Flux generation-specific templates take priority,
  // then chronicle-specific, then the user's configured entity template.
  const imageModel = config.imageModel || "dall-e-3";
  let templateSource: string | undefined;
  const fluxGen = getFluxGeneration(imageModel);
  if (fluxGen === "flux-2") {
    templateSource = isChronicleImage
      ? FLUX_2_CHRONICLE_IMAGE_PROMPT_TEMPLATE
      : FLUX_2_IMAGE_PROMPT_TEMPLATE;
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
      const isChronicleImage = task.imageType === "chronicle";
      const formattingCallType = isChronicleImage
        ? "image.chronicleFormatting"
        : "image.promptFormatting";
      const formattingConfig = getCallConfig(config, formattingCallType);
      const formatResult = await formatImagePromptWithClaude(
        originalPrompt,
        config,
        llmClient,
        formattingConfig,
        isChronicleImage
      );
      formattingPrompt = formatResult.formattingPrompt;
      formatCost = formatResult.cost;
      // Append per-model positive cues after Claude resynthesis
      const modelSuffix = getModelPromptSuffix(imageModel);
      finalPrompt = modelSuffix
        ? `${formatResult.prompt}\n\n${modelSuffix}`
        : formatResult.prompt;
    }

    // Save imagePrompt cost record if Claude was used
    if (formatCost) {
      const isChronicleImage = task.imageType === "chronicle";
      const costCallType = isChronicleImage
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

    const actualCost = calculateActualImageCost(imageModel, imageSize, imageQuality, result.usage);
    const generatedAt = Date.now();
    const imageId = generateImageId(task.entityId);

    // Extract image dimensions for aspect-aware display
    const dimensions = await extractImageDimensions(result.imageBlob);

    // Save directly to IndexedDB
    await saveImage(imageId, result.imageBlob, {
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
