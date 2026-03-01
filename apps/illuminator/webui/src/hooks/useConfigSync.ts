import type { SetStateAction } from "react";
import { useState, useCallback, useEffect, useRef } from "react";

// ============================================================================
// Types
// ============================================================================

export interface EnrichmentConfig {
  imageModel: string;
  minProminenceForImage: string;
  numWorkers: number;
  requireDescription: boolean;
  useClaudeForImagePrompt: boolean;
  claudeImagePromptTemplate: string;
  globalImageRules: string;
  minEventSignificance: number;
  [key: string]: unknown;
}

export interface UseConfigSyncProps {
  externalEnrichmentConfig?: EnrichmentConfig | null;
  onEnrichmentConfigChange?: (config: EnrichmentConfig) => void;
}

export interface UseConfigSyncReturn {
  config: EnrichmentConfig;
  setConfig: (updater: SetStateAction<EnrichmentConfig>) => void;
  updateConfig: (updates: Partial<EnrichmentConfig>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_IMAGE_PROMPT_TEMPLATE = `Transform the structured prompt below into a single, coherent image prompt for {{modelName}}. Do NOT simply reformat—actively synthesize and reshape:

Honor the VISUAL THESIS: This is the primary visual signal. The thesis describes the dominant silhouette feature that makes this entity instantly recognizable. Build the entire image around it.

Synthesize, don't list:
- Merge SUBJECT + CONTEXT + CULTURAL IDENTITY into a unified visual
- Apply STYLE (artistic approach) and COMPOSITION (framing/perspective) to shape the rendering
- Translate SUPPORTING TRAITS into concrete visual details that reinforce the thesis
- Incorporate COLOR PALETTE if provided

Establish clear composition and perspective:
- Honor the COMPOSITION directive for framing and vantage point
- Use environmental storytelling (objects, weathering, traces) to convey history
- The SETTING provides world context but the subject is the focus

Create specific visual instructions: Rather than listing adjectives, use concrete visual language: "weathered by decades of X," "visible scars of Y," "rendered in the style of Z"

Respect the AVOID list: These are hard constraints—elements that break the visual language.

Condense to a single, authoritative prompt: Output should be 150-300 words, reading as clear artistic direction that could be handed to a concept artist—not a bulleted list.
{{globalImageRules}}
Original prompt:
{{prompt}}`;

const DEFAULT_CONFIG: EnrichmentConfig = {
  imageModel: "gpt-image-1.5",
  minProminenceForImage: "mythic",
  numWorkers: 4,
  requireDescription: false,
  useClaudeForImagePrompt: false,
  claudeImagePromptTemplate: DEFAULT_IMAGE_PROMPT_TEMPLATE,
  globalImageRules: "",
  minEventSignificance: 0.25,
};

const LEGACY_MODEL_FIELDS: string[] = [
  "textModel",
  "chronicleModel",
  "textModal",
  "chronicleModal",
  "thinkingModel",
  "thinkingBudget",
  "useThinkingForDescriptions",
];

const normalizeEnrichmentConfig = (config: Record<string, unknown> | null): EnrichmentConfig | null => {
  if (!config) return null;
  const cleaned = Object.fromEntries(
    Object.entries(config).filter(([key]) => !LEGACY_MODEL_FIELDS.includes(key))
  );
  return { ...DEFAULT_CONFIG, ...cleaned };
};

function initializeEnrichmentConfig(externalConfig: EnrichmentConfig | null | undefined): EnrichmentConfig {
  if (externalConfig) return normalizeEnrichmentConfig(externalConfig) || DEFAULT_CONFIG;
  try {
    const saved = localStorage.getItem("illuminator:config");
    if (saved) return normalizeEnrichmentConfig(JSON.parse(saved)) || DEFAULT_CONFIG;
  } catch {
    /* ignored */
  }
  return DEFAULT_CONFIG;
}

export default function useConfigSync({ externalEnrichmentConfig, onEnrichmentConfigChange }: UseConfigSyncProps): UseConfigSyncReturn {
  const [localConfig, setLocalConfig] = useState<EnrichmentConfig>(() =>
    initializeEnrichmentConfig(externalEnrichmentConfig)
  );
  const pendingConfigSyncRef = useRef<EnrichmentConfig | null>(null);
  const skipConfigSyncRef = useRef<boolean>(false);

  // Detect external config changes during render (no ref access)
  const [prevExternalConfig, setPrevExternalConfig] = useState<EnrichmentConfig | null | undefined>(externalEnrichmentConfig);
  if (externalEnrichmentConfig !== prevExternalConfig) {
    setPrevExternalConfig(externalEnrichmentConfig);
    if (externalEnrichmentConfig) {
      setLocalConfig(normalizeEnrichmentConfig(externalEnrichmentConfig) || DEFAULT_CONFIG);
    }
  }

  // Mark skip flag in effect (runs before sync effect due to declaration order)
  useEffect(() => {
    if (externalEnrichmentConfig) {
      skipConfigSyncRef.current = true;
      pendingConfigSyncRef.current = null;
    }
  }, [externalEnrichmentConfig]);

  const config = localConfig;

  const setConfig = useCallback((updater: SetStateAction<EnrichmentConfig>) => {
    setLocalConfig((prev: EnrichmentConfig) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      pendingConfigSyncRef.current = next;
      return next;
    });
  }, []);

  // Sync local changes to parent (or localStorage)
  useEffect(() => {
    if (skipConfigSyncRef.current) {
      skipConfigSyncRef.current = false;
      pendingConfigSyncRef.current = null;
      return;
    }
    const pending = pendingConfigSyncRef.current;
    if (!pending) return;
    pendingConfigSyncRef.current = null;
    if (onEnrichmentConfigChange) {
      onEnrichmentConfigChange(pending);
    } else {
      try {
        localStorage.setItem("illuminator:config", JSON.stringify(pending));
      } catch {
        /* ignored */
      }
    }
  }, [localConfig, onEnrichmentConfigChange]);

  const updateConfig = useCallback(
    (updates: Partial<EnrichmentConfig>) => {
      setConfig((prev: EnrichmentConfig) => ({ ...prev, ...updates }));
    },
    [setConfig]
  );

  return { config, setConfig, updateConfig };
}
