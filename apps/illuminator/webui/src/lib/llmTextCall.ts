import type { LLMClient, LLMResult } from './llmClient';
import type { LLMCallType } from './llmCallTypes';
import type { ResolvedLLMCallConfig } from './llmModelSettings';
import { calcTokenBudget, type TokenBudget } from './llmBudget';
import { estimateTextCostForCall, calculateActualTextCost } from './costEstimation';

export interface LLMTextCallOptions {
  llmClient: LLMClient;
  callType: LLMCallType;
  callConfig: ResolvedLLMCallConfig;
  systemPrompt: string;
  prompt: string;
  temperature?: number;
  autoMaxTokens?: number;
}

export interface LLMTextCallEstimate {
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
}

export interface LLMTextCallUsage {
  inputTokens: number;
  outputTokens: number;
  actualCost: number;
}

export interface LLMTextCallResult {
  result: LLMResult;
  budget: TokenBudget;
  estimate: LLMTextCallEstimate;
  usage: LLMTextCallUsage;
}

export async function runTextCall(options: LLMTextCallOptions): Promise<LLMTextCallResult> {
  const budget = calcTokenBudget(options.callType, options.callConfig, {
    autoMaxTokens: options.autoMaxTokens,
  });
  const estimate = estimateTextCostForCall(
    options.prompt,
    options.callType,
    options.callConfig.model,
    budget.responseBudget
  );

  const result = await options.llmClient.complete({
    systemPrompt: options.systemPrompt,
    prompt: options.prompt,
    model: options.callConfig.model,
    maxTokens: budget.totalMaxTokens,
    temperature: options.temperature,
    thinkingBudget: budget.thinkingBudget,
  });

  const usage = result.usage
    ? {
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        actualCost: calculateActualTextCost(
          result.usage.inputTokens,
          result.usage.outputTokens,
          options.callConfig.model
        ),
      }
    : {
        inputTokens: estimate.inputTokens,
        outputTokens: estimate.outputTokens,
        actualCost: estimate.estimatedCost,
      };

  return { result, budget, estimate, usage };
}
