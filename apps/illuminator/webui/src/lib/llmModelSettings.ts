/**
 * LLM Model Settings - localStorage persistence for per-call LLM configuration
 *
 * Settings are stored globally (not per-project) so that model preferences
 * persist across all projects.
 */

import {
  type LLMCallType,
  type LLMCallConfig,
  LLM_CALL_METADATA,
  ALL_LLM_CALL_TYPES,
  THINKING_CAPABLE_MODELS,
} from './llmCallTypes';

// Re-export for convenience
export type { LLMCallType, LLMCallConfig };
export { LLM_CALL_METADATA, ALL_LLM_CALL_TYPES } from './llmCallTypes';

const STORAGE_KEY = 'illuminator:llmModelSettings';
const CURRENT_VERSION = 1;

/**
 * Per-call settings (can override defaults)
 */
export interface LLMCallConfigStored {
  model?: string;           // undefined = use default
  thinkingBudget?: number;  // undefined = use default, 0 = disabled
  maxTokens?: number;       // undefined = use default, 0 = auto (style-derived)
}

/**
 * Global LLM settings stored in localStorage
 */
export interface LLMModelSettings {
  // Per-call overrides (sparse - only non-default values stored)
  callOverrides: Partial<Record<LLMCallType, LLMCallConfigStored>>;

  // Version for migrations
  version: number;
}

/**
 * Resolved configuration for a call (always has values)
 */
export interface ResolvedLLMCallConfig {
  model: string;
  thinkingBudget: number;
  maxTokens: number;
}

/**
 * All resolved settings for passing to worker
 */
export type ResolvedLLMCallSettings = Record<LLMCallType, ResolvedLLMCallConfig>;

/**
 * Migrate settings from older versions
 */
function migrateSettings(stored: unknown): LLMModelSettings {
  if (!stored || typeof stored !== 'object') {
    return { callOverrides: {}, version: CURRENT_VERSION };
  }

  const settings = stored as Record<string, unknown>;

  // Already current version
  if (settings.version === CURRENT_VERSION) {
    return settings as LLMModelSettings;
  }

  // Future migrations go here
  // if (settings.version === 1) { ... migrate to v2 ... }

  // Default: return with current version
  return {
    callOverrides: (settings.callOverrides as LLMModelSettings['callOverrides']) || {},
    version: CURRENT_VERSION,
  };
}

/**
 * Load settings from localStorage
 */
export function getLLMModelSettings(): LLMModelSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return migrateSettings(parsed);
    }
  } catch (err) {
    console.warn('[LLMModelSettings] Failed to load settings:', err);
  }
  return { callOverrides: {}, version: CURRENT_VERSION };
}

/**
 * Save settings to localStorage
 */
export function saveLLMModelSettings(settings: LLMModelSettings): void {
  try {
    // Clean up: remove entries that match defaults
    const cleanOverrides: LLMModelSettings['callOverrides'] = {};
    for (const [callType, config] of Object.entries(settings.callOverrides)) {
      if (!config) continue;
      const metadata = LLM_CALL_METADATA[callType as LLMCallType];
      if (!metadata) continue;

      const hasModelOverride = config.model && config.model !== metadata.defaults.model;
      const hasThinkingOverride = config.thinkingBudget !== undefined && config.thinkingBudget !== metadata.defaults.thinkingBudget;
      const hasMaxTokensOverride = config.maxTokens !== undefined && config.maxTokens !== metadata.defaults.maxTokens;

      if (hasModelOverride || hasThinkingOverride || hasMaxTokensOverride) {
        cleanOverrides[callType as LLMCallType] = {
          ...(hasModelOverride ? { model: config.model } : {}),
          ...(hasThinkingOverride ? { thinkingBudget: config.thinkingBudget } : {}),
          ...(hasMaxTokensOverride ? { maxTokens: config.maxTokens } : {}),
        };
      }
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      callOverrides: cleanOverrides,
      version: settings.version,
    }));
  } catch (err) {
    console.warn('[LLMModelSettings] Failed to save settings:', err);
  }
}

/**
 * Get the model for a specific call type
 */
export function getModelForCall(callType: LLMCallType): string {
  const settings = getLLMModelSettings();
  const override = settings.callOverrides[callType];
  return override?.model ?? LLM_CALL_METADATA[callType].defaults.model;
}

/**
 * Get the thinking budget for a specific call type
 */
export function getThinkingBudgetForCall(callType: LLMCallType): number {
  const settings = getLLMModelSettings();
  const override = settings.callOverrides[callType];
  return override?.thinkingBudget ?? LLM_CALL_METADATA[callType].defaults.thinkingBudget;
}

/**
 * Get the max tokens (pre-reasoning budget) for a specific call type
 */
export function getMaxTokensForCall(callType: LLMCallType): number {
  const settings = getLLMModelSettings();
  const override = settings.callOverrides[callType];
  return override?.maxTokens ?? LLM_CALL_METADATA[callType].defaults.maxTokens;
}

/**
 * Get complete resolved config for a call
 */
export function getCallConfig(callType: LLMCallType): ResolvedLLMCallConfig {
  const model = getModelForCall(callType);
  let thinkingBudget = getThinkingBudgetForCall(callType);
  const maxTokens = getMaxTokensForCall(callType);

  // Ensure thinking is disabled for models that don't support it
  if (!THINKING_CAPABLE_MODELS.includes(model)) {
    thinkingBudget = 0;
  }

  return { model, thinkingBudget, maxTokens };
}

/**
 * Get all resolved settings for passing to worker
 */
export function getResolvedLLMCallSettings(): ResolvedLLMCallSettings {
  const result = {} as ResolvedLLMCallSettings;
  for (const callType of ALL_LLM_CALL_TYPES) {
    result[callType] = getCallConfig(callType);
  }
  return result;
}

/**
 * Update configuration for a specific call type
 */
export function updateCallConfig(callType: LLMCallType, config: LLMCallConfigStored): void {
  const settings = getLLMModelSettings();
  settings.callOverrides[callType] = config;
  saveLLMModelSettings(settings);
}

/**
 * Reset all settings to defaults
 */
export function resetToDefaults(): void {
  saveLLMModelSettings({ callOverrides: {}, version: CURRENT_VERSION });
}

/**
 * Check if a call type has any overrides from default
 */
export function hasOverrides(callType: LLMCallType): boolean {
  const settings = getLLMModelSettings();
  const override = settings.callOverrides[callType];
  if (!override) return false;

  const metadata = LLM_CALL_METADATA[callType];
  return (
    (override.model !== undefined && override.model !== metadata.defaults.model) ||
    (override.thinkingBudget !== undefined && override.thinkingBudget !== metadata.defaults.thinkingBudget) ||
    (override.maxTokens !== undefined && override.maxTokens !== metadata.defaults.maxTokens)
  );
}

/**
 * Get count of call types with overrides
 */
export function getOverrideCount(): number {
  let count = 0;
  for (const callType of ALL_LLM_CALL_TYPES) {
    if (hasOverrides(callType)) count++;
  }
  return count;
}
