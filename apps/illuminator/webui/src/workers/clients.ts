import { LLMClient } from "../lib/llmClient";
import { ImageClient, WaveSpeedImageClient, isWaveSpeedModel } from "../lib/imageClient";
import { resolveImageSize } from "../lib/imageSettings";
import type { ImageRequest, ImageResult } from "../lib/imageClient";
import type { WorkerConfig } from "./types";

export interface ImageClientInterface {
  isEnabled(): boolean;
  generate(req: ImageRequest): Promise<ImageResult>;
  getStats(): { generated: number };
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

  const model = config.imageModel || "dall-e-3";
  const baseImageConfig = {
    model,
    size: resolveImageSize(model, config.imageSize || "auto"),
    quality: config.imageQuality || "standard",
  };

  const imageClient: ImageClientInterface = isWaveSpeedModel(model)
    ? new WaveSpeedImageClient({
        ...baseImageConfig,
        enabled: Boolean(config.wavespeedApiKey),
        apiKey: config.wavespeedApiKey,
      })
    : new ImageClient({
        ...baseImageConfig,
        enabled: Boolean(config.openaiApiKey),
        apiKey: config.openaiApiKey,
      });

  return { llmClient, imageClient };
}
