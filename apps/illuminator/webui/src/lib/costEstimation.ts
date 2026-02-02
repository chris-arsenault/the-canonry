/**
 * Cost Estimation and Tracking
 *
 * Published rates (as of Dec 2024):
 *
 * Anthropic Claude Models (per million tokens):
 * - Claude Sonnet 4.5: $3 input, $15 output
 * - Claude Haiku 4.5: $1 input, $5 output
 *
 * OpenAI DALL-E Models (per image):
 * - DALL-E 3 1024x1024: $0.04 standard, $0.08 hd
 * - DALL-E 3 1792x1024 / 1024x1792: $0.08 standard, $0.12 hd
 * - DALL-E 2 1024x1024: $0.02
 * - DALL-E 2 512x512: $0.018
 * - DALL-E 2 256x256: $0.016
 *
 * OpenAI GPT Image Models (token-based pricing per million tokens):
 * - GPT Image 1/1.5: $5 input, $40 output (includes image_tokens)
 * - Typical image generation uses ~300 input tokens, ~6500 output tokens
 */

import { LLM_CALL_METADATA, type LLMCallType } from './llmCallTypes';

// Rate per million tokens
export interface TextModelRates {
  inputPerMillion: number;
  outputPerMillion: number;
}

// Rate per image based on size and quality (for DALL-E models)
export interface DalleImageModelRates {
  type: 'per-image';
  standard: Record<string, number>;
  hd: Record<string, number>;
}

// Token-based rates for GPT image models
export interface GptImageModelRates {
  type: 'token-based';
  inputPerMillion: number;
  outputPerMillion: number;
  // Estimated output tokens by quality (includes image_tokens)
  estimatedOutputTokens: Record<string, number>;
}

export type ImageModelRates = DalleImageModelRates | GptImageModelRates;

export const TEXT_MODEL_RATES: Record<string, TextModelRates> = {
  'claude-sonnet-4-5-20250929': { inputPerMillion: 3, outputPerMillion: 15 },
  'claude-haiku-4-5-20251001': { inputPerMillion: 1, outputPerMillion: 5 },
  // Legacy models
  'claude-sonnet-4-20250514': { inputPerMillion: 3, outputPerMillion: 15 },
  'claude-3-5-sonnet-20241022': { inputPerMillion: 3, outputPerMillion: 15 },
  'claude-3-haiku-20240307': { inputPerMillion: 0.25, outputPerMillion: 1.25 },
};

export const IMAGE_MODEL_RATES: Record<string, ImageModelRates> = {
  'gpt-image-1.5': {
    type: 'token-based',
    inputPerMillion: 5,
    outputPerMillion: 40,
    // Output tokens vary by quality: high ~8000, medium ~6500, low ~4000
    estimatedOutputTokens: {
      'high': 8000,
      'medium': 6500,
      'low': 4000,
      'auto': 6500,
    },
  },
  'gpt-image-1': {
    type: 'token-based',
    inputPerMillion: 5,
    outputPerMillion: 40,
    estimatedOutputTokens: {
      'high': 8000,
      'medium': 6500,
      'low': 4000,
      'auto': 6500,
    },
  },
  'dall-e-3': {
    type: 'per-image',
    standard: {
      '1024x1024': 0.04,
      '1792x1024': 0.08,
      '1024x1792': 0.08,
    },
    hd: {
      '1024x1024': 0.08,
      '1792x1024': 0.12,
      '1024x1792': 0.12,
    },
  },
  'dall-e-2': {
    type: 'per-image',
    standard: {
      '1024x1024': 0.02,
      '512x512': 0.018,
      '256x256': 0.016,
    },
    hd: {
      '1024x1024': 0.02,
      '512x512': 0.018,
      '256x256': 0.016,
    },
  },
};

// Average tokens per word (rough estimate)
const TOKENS_PER_WORD = 1.3;

// Expected output tokens for different task types
const EXPECTED_OUTPUT_TOKENS: Record<string, number> = {
  description: 300, // ~230 words
};

const DEFAULT_CALL_OUTPUT_TOKENS = 300;

/**
 * Estimate tokens from text (word count based)
 */
export function estimateTokens(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.ceil(words * TOKENS_PER_WORD);
}

/**
 * Estimate cost for a text enrichment task
 */
export function estimateTextCost(
  prompt: string,
  type: 'description',
  model: string
): { inputTokens: number; outputTokens: number; estimatedCost: number } {
  const rates = TEXT_MODEL_RATES[model] || TEXT_MODEL_RATES['claude-sonnet-4-20250514'];
  const inputTokens = estimateTokens(prompt);
  const outputTokens = EXPECTED_OUTPUT_TOKENS[type] || 300;

  const inputCost = (inputTokens / 1_000_000) * rates.inputPerMillion;
  const outputCost = (outputTokens / 1_000_000) * rates.outputPerMillion;

  return {
    inputTokens,
    outputTokens,
    estimatedCost: inputCost + outputCost,
  };
}

function resolveOutputTokensForCall(callType: LLMCallType, override?: number): number {
  if (override && override > 0) {
    return override;
  }

  const defaultMaxTokens = LLM_CALL_METADATA[callType]?.defaults.maxTokens ?? 0;
  if (defaultMaxTokens > 0) {
    return defaultMaxTokens;
  }

  return DEFAULT_CALL_OUTPUT_TOKENS;
}

export function estimateTextCostForCall(
  prompt: string,
  callType: LLMCallType,
  model: string,
  outputTokensOverride?: number
): { inputTokens: number; outputTokens: number; estimatedCost: number } {
  const rates = TEXT_MODEL_RATES[model] || TEXT_MODEL_RATES['claude-sonnet-4-20250514'];
  const inputTokens = estimateTokens(prompt);
  const outputTokens = resolveOutputTokensForCall(callType, outputTokensOverride);

  const inputCost = (inputTokens / 1_000_000) * rates.inputPerMillion;
  const outputCost = (outputTokens / 1_000_000) * rates.outputPerMillion;

  return {
    inputTokens,
    outputTokens,
    estimatedCost: inputCost + outputCost,
  };
}

/**
 * Estimate cost for an image generation task
 */
export function estimateImageCost(
  model: string,
  size: string,
  quality: string
): number {
  const rates = IMAGE_MODEL_RATES[model] || IMAGE_MODEL_RATES['dall-e-3'];

  if (rates.type === 'token-based') {
    // GPT Image models use token-based pricing
    const estimatedInputTokens = 300; // Typical prompt size
    const estimatedOutputTokens = rates.estimatedOutputTokens[quality] || rates.estimatedOutputTokens['auto'] || 6500;

    const inputCost = (estimatedInputTokens / 1_000_000) * rates.inputPerMillion;
    const outputCost = (estimatedOutputTokens / 1_000_000) * rates.outputPerMillion;
    return inputCost + outputCost;
  } else {
    // DALL-E models use per-image pricing
    const qualityRates = quality === 'hd' ? rates.hd : rates.standard;
    return qualityRates[size] || qualityRates['1024x1024'] || 0.04;
  }
}

/**
 * Calculate actual cost from API response usage
 */
export function calculateActualTextCost(
  inputTokens: number,
  outputTokens: number,
  model: string
): number {
  const rates = TEXT_MODEL_RATES[model] || TEXT_MODEL_RATES['claude-sonnet-4-20250514'];
  const inputCost = (inputTokens / 1_000_000) * rates.inputPerMillion;
  const outputCost = (outputTokens / 1_000_000) * rates.outputPerMillion;
  return inputCost + outputCost;
}

/**
 * Calculate actual cost for image generation from API response usage
 * GPT Image models return token usage; DALL-E models use per-image pricing
 */
export function calculateActualImageCost(
  model: string,
  size: string,
  quality: string,
  usage?: { inputTokens: number; outputTokens: number }
): number {
  const rates = IMAGE_MODEL_RATES[model] || IMAGE_MODEL_RATES['dall-e-3'];

  if (rates.type === 'token-based' && usage) {
    // GPT Image models: use actual token counts from API response
    const inputCost = (usage.inputTokens / 1_000_000) * rates.inputPerMillion;
    const outputCost = (usage.outputTokens / 1_000_000) * rates.outputPerMillion;
    return inputCost + outputCost;
  } else if (rates.type === 'token-based') {
    // GPT Image models without usage data: fall back to estimate
    return estimateImageCost(model, size, quality);
  } else {
    // DALL-E models: per-image pricing (no token usage)
    const qualityRates = quality === 'hd' ? rates.hd : rates.standard;
    return qualityRates[size] || qualityRates['1024x1024'] || 0.04;
  }
}

/**
 * Cost metadata stored with enrichment results
 */
export interface CostMetadata {
  estimated: number;
  actual?: number;
  inputTokens?: number;
  outputTokens?: number;
  model: string;
  generatedAt: number;
}

/**
 * Aggregated cost data
 */
export interface CostSummary {
  totalEstimated: number;
  totalActual: number;
  textCosts: {
    estimated: number;
    actual: number;
    taskCount: number;
  };
  imageCosts: {
    estimated: number;
    actual: number;
    taskCount: number;
  };
  byModel: Record<string, { estimated: number; actual: number; count: number }>;
}

/**
 * Create empty cost summary
 */
export function createEmptyCostSummary(): CostSummary {
  return {
    totalEstimated: 0,
    totalActual: 0,
    textCosts: { estimated: 0, actual: 0, taskCount: 0 },
    imageCosts: { estimated: 0, actual: 0, taskCount: 0 },
    byModel: {},
  };
}

/**
 * Format cost for display
 */
export function formatCost(cost: number): string {
  if (cost < 0.001) return '<$0.001';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

/**
 * Format cost with estimate indicator
 */
export function formatEstimatedCost(cost: number): string {
  return `~${formatCost(cost)}`;
}
