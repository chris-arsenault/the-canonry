import type { WorkerTask } from '../../lib/enrichmentTypes';
import { estimateImageCost, calculateActualImageCost } from '../../lib/costEstimation';
import { saveImage, generateImageId, extractImageDimensions } from '../../lib/db/imageRepository';
import { saveCostRecordWithDefaults } from '../../lib/db/costRepository';
import { runTextCall } from '../../lib/llmTextCall';
import { getCallConfig } from './llmCallConfig';
import type { TaskHandler } from './taskTypes';
import type { LLMClient } from '../../lib/llmClient';
import type { ResolvedLLMCallConfig } from '../../lib/llmModelSettings';

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
  config: { useClaudeForImagePrompt?: boolean; claudeImagePromptTemplate?: string; claudeChronicleImagePromptTemplate?: string; imageModel?: string; globalImageRules?: string },
  llmClient: LLMClient,
  callConfig: ResolvedLLMCallConfig,
  isChronicleImage?: boolean
): Promise<ImagePromptFormatResult> {
  const templateSource = isChronicleImage && config.claudeChronicleImagePromptTemplate
    ? config.claudeChronicleImagePromptTemplate
    : config.claudeImagePromptTemplate;

  if (!config.useClaudeForImagePrompt || !templateSource) {
    return { prompt: originalPrompt };
  }

  if (!llmClient.isEnabled()) {
    console.warn('[Worker] Claude not configured, skipping image prompt formatting');
    return { prompt: originalPrompt };
  }

  const imageModel = config.imageModel || 'dall-e-3';
  const globalRules = config.globalImageRules || '';
  const formattingPrompt = templateSource
    .replace(/\{\{modelName\}\}/g, imageModel)
    .replace(/\{\{prompt\}\}/g, originalPrompt)
    .replace(/\{\{globalImageRules\}\}/g, globalRules);

  try {
    const formattingCall = await runTextCall({
      llmClient,
      callType: isChronicleImage ? 'image.chronicleFormatting' : 'image.promptFormatting',
      callConfig,
      systemPrompt: 'You are a prompt engineer specializing in image generation. Respond only with the reformatted prompt, no explanations or preamble.',
      prompt: formattingPrompt,
      temperature: 0.3,
    });
    const result = formattingCall.result;

    if (result.text && !result.error) {
      console.log('[Worker] Formatted image prompt with Claude');

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
    console.warn('[Worker] Failed to format image prompt with Claude:', err);
  }

  return { prompt: originalPrompt, formattingPrompt };
}

export const imageTask = {
  type: 'image',
  async execute(task, context) {
    const { config, llmClient, imageClient, isAborted } = context;

    if (!imageClient.isEnabled()) {
      return { success: false, error: 'Image generation not configured - missing OpenAI API key' };
    }

    const imageModel = config.imageModel || 'dall-e-3';
    // Use task-level overrides if provided, otherwise fall back to global config
    const imageSize = task.imageSize || config.imageSize || '1024x1024';
    const imageQuality = task.imageQuality || config.imageQuality || 'standard';
    const estimatedCost = estimateImageCost(imageModel, imageSize, imageQuality);

    // Store original prompt before any refinement
    const originalPrompt = task.prompt;
    const isChronicleImage = task.imageType === 'chronicle';
    const formattingCallType = isChronicleImage ? 'image.chronicleFormatting' : 'image.promptFormatting';
    const formattingConfig = getCallConfig(config, formattingCallType);
    const formatResult = await formatImagePromptWithClaude(originalPrompt, config, llmClient, formattingConfig, isChronicleImage);
    const finalPrompt = formatResult.prompt;

    // Save imagePrompt cost record if Claude was used
    if (formatResult.cost) {
      await saveCostRecordWithDefaults({
        projectId: task.projectId,
        simulationRunId: task.simulationRunId,
        entityId: task.entityId,
        entityName: task.entityName,
        entityKind: task.entityKind,
        type: 'imagePrompt',
        model: formattingConfig.model,
        estimatedCost: formatResult.cost.estimated,
        actualCost: formatResult.cost.actual,
        inputTokens: formatResult.cost.inputTokens,
        outputTokens: formatResult.cost.outputTokens,
      });
    }

    if (isAborted()) {
      return { success: false, error: 'Task aborted' };
    }

    const result = await imageClient.generate({ prompt: finalPrompt });
    const debug = result.debug;

    if (isAborted()) {
      return { success: false, error: 'Task aborted' };
    }

    if (result.error) {
      return { success: false, error: result.error, debug };
    }

    if (!result.imageBlob) {
      return { success: false, error: 'No image data returned from API' };
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
      formattingPrompt: formatResult.formattingPrompt,
      finalPrompt,
      generatedAt,
      model: imageModel,
      size: imageSize,
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
      type: 'image',
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
} satisfies TaskHandler<WorkerTask & { type: 'image' }>;
