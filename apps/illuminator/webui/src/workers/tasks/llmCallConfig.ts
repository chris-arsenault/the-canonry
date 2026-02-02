import type { LLMCallType } from '../../lib/llmCallTypes';
import type { ResolvedLLMCallConfig } from '../../lib/llmModelSettings';
import type { WorkerConfig } from '../types';

export function getCallConfig(config: WorkerConfig, callType: LLMCallType): ResolvedLLMCallConfig {
  return config.llmCallSettings[callType];
}
