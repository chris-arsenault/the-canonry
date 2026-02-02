import { LLMClient } from '../lib/llmClient';
import { ImageClient } from '../lib/imageClient';
import type { WorkerConfig } from './types';

export function createClients(config: WorkerConfig): { llmClient: LLMClient; imageClient: ImageClient } {
  // LLMClient model is set per-call; use a default for the base client
  const llmClient = new LLMClient({
    enabled: Boolean(config.anthropicApiKey),
    apiKey: config.anthropicApiKey,
    model: 'claude-sonnet-4-5-20250929', // Default; overridden per call
  });

  const imageClient = new ImageClient({
    enabled: Boolean(config.openaiApiKey),
    apiKey: config.openaiApiKey,
    model: config.imageModel || 'dall-e-3',
    size: config.imageSize || '1024x1024',
    quality: config.imageQuality || 'standard',
  });

  return { llmClient, imageClient };
}
