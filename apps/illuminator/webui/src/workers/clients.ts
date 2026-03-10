import { LLMClient } from "../lib/llmClient";
import { ImageClient, WaveSpeedImageClient, BflImageClient, isWaveSpeedModel, isBflModel } from "../lib/imageClient";
import { resolveImageSize } from "../lib/imageSettings";
import type { ImageRequest, ImageResult } from "../lib/imageClient";
import type { WorkerConfig } from "./types";

export interface ImageClientInterface {
  isEnabled(): boolean;
  generate(req: ImageRequest): Promise<ImageResult>;
  getStats(): { generated: number };
}

function createImageClient(config: WorkerConfig): ImageClientInterface {
  const model = config.imageModel || "dall-e-3";
  const baseImageConfig = {
    model,
    size: resolveImageSize(model, config.imageSize || "auto"),
    quality: config.imageQuality || "standard",
  };

  if (isBflModel(model)) {
    return new BflImageClient({
      ...baseImageConfig,
      enabled: Boolean(config.bflApiKey),
      apiKey: config.bflApiKey,
    });
  }

  if (isWaveSpeedModel(model)) {
    return new WaveSpeedImageClient({
      ...baseImageConfig,
      enabled: Boolean(config.wavespeedApiKey),
      apiKey: config.wavespeedApiKey,
    });
  }

  return new ImageClient({
    ...baseImageConfig,
    enabled: Boolean(config.openaiApiKey),
    apiKey: config.openaiApiKey,
  });
}

export function createClients(config: WorkerConfig): {
  llmClient: LLMClient;
  imageClient: ImageClientInterface;
} {
  // LLMClient model is set per-call; use a default for the base client
  const llmClient = new LLMClient({
    enabled: Boolean(config.anthropicApiKey),
    apiKey: config.anthropicApiKey,
    model: "claude-sonnet-4-6", // Default; overridden per call
  });

  return { llmClient, imageClient: createImageClient(config) };
}
