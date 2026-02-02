import type { ResolvedLLMCallConfig } from './llmModelSettings';
import { LLM_CALL_METADATA, type LLMCallType } from './llmCallTypes';

const DEFAULT_AUTO_MAX_TOKENS = 256;

export interface TokenBudget {
  responseBudget: number;
  thinkingBudget?: number;
  totalMaxTokens: number;
}

export interface TokenBudgetOptions {
  autoMaxTokens?: number;
}

export function calcTokenBudget(
  callType: LLMCallType,
  callConfig: ResolvedLLMCallConfig,
  options: TokenBudgetOptions = {}
): TokenBudget {
  const defaultMaxTokens = LLM_CALL_METADATA[callType]?.defaults.maxTokens ?? 0;
  const fallbackMaxTokens = defaultMaxTokens > 0
    ? defaultMaxTokens
    : (options.autoMaxTokens ?? DEFAULT_AUTO_MAX_TOKENS);
  const responseBudget = callConfig.maxTokens > 0 ? callConfig.maxTokens : fallbackMaxTokens;
  const safeResponseBudget = responseBudget > 0 ? responseBudget : DEFAULT_AUTO_MAX_TOKENS;
  const thinkingBudget = callConfig.thinkingBudget > 0 ? callConfig.thinkingBudget : undefined;
  const totalMaxTokens = thinkingBudget ? thinkingBudget + safeResponseBudget : safeResponseBudget;
  return { responseBudget: safeResponseBudget, thinkingBudget, totalMaxTokens };
}
