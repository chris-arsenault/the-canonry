import type { LLMCallType } from '../lib/llmCallTypes';
import type { ResolvedLLMCallConfig } from '../lib/llmModelSettings';
import type {
  WorkerTask,
  WorkerResult,
  EnrichmentResult,
  NetworkDebugInfo,
} from '../lib/enrichmentTypes';

/**
 * Resolved LLM call settings - model, thinking budget, and max tokens per call type.
 * All values are resolved (no undefined) - ready to use directly.
 */
export type ResolvedLLMCallSettings = Record<LLMCallType, ResolvedLLMCallConfig>;

export interface WorkerConfig {
  anthropicApiKey: string;
  openaiApiKey: string;
  imageModel: string;
  imageSize: string;
  imageQuality: string;
  numWorkers?: number;
  useClaudeForImagePrompt?: boolean;
  claudeImagePromptTemplate?: string;
  /** Global rules for image generation (e.g., species constraints). Injected into Claude image prompt template. */
  globalImageRules?: string;

  // Per-call LLM configuration (model + thinking budget + max tokens)
  llmCallSettings: ResolvedLLMCallSettings;
}

export type WorkerInbound =
  | { type: 'init'; config: WorkerConfig }
  | { type: 'execute'; task: WorkerTask }
  | { type: 'abort'; taskId?: string };

export type WorkerOutbound =
  | { type: 'ready' }
  | { type: 'started'; taskId: string }
  | { type: 'complete'; result: WorkerResult }
  | { type: 'error'; taskId: string; error: string; debug?: NetworkDebugInfo };

export type TaskResult = {
  success: true;
  result: EnrichmentResult;
  debug?: NetworkDebugInfo;
} | {
  success: false;
  error: string;
  debug?: NetworkDebugInfo;
};
