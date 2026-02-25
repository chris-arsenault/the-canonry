import { useState, useCallback, useEffect, useRef } from "react";

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

const DEFAULT_CONFIG = {
  imageModel: "gpt-image-1.5",
  minProminenceForImage: "mythic",
  numWorkers: 4,
  requireDescription: false,
  useClaudeForImagePrompt: false,
  claudeImagePromptTemplate: DEFAULT_IMAGE_PROMPT_TEMPLATE,
  globalImageRules: "",
  minEventSignificance: 0.25,
};

const LEGACY_MODEL_FIELDS = [
  "textModel", "chronicleModel", "textModal", "chronicleModal",
  "thinkingModel", "thinkingBudget", "useThinkingForDescriptions",
];

const normalizeEnrichmentConfig = (config) => {
  if (!config) return null;
  const cleaned = Object.fromEntries(
    Object.entries(config).filter(([key]) => !LEGACY_MODEL_FIELDS.includes(key))
  );
  return { ...DEFAULT_CONFIG, ...cleaned };
};

function initializeEnrichmentConfig(externalConfig) {
  if (externalConfig) return normalizeEnrichmentConfig(externalConfig) || DEFAULT_CONFIG;
  try {
    const saved = localStorage.getItem("illuminator:config");
    if (saved) return normalizeEnrichmentConfig(JSON.parse(saved)) || DEFAULT_CONFIG;
  } catch { /* ignored */ }
  return DEFAULT_CONFIG;
}

export default function useConfigSync({ externalEnrichmentConfig, onEnrichmentConfigChange }) {
  const [localConfig, setLocalConfig] = useState(
    () => initializeEnrichmentConfig(externalEnrichmentConfig)
  );
  const pendingConfigSyncRef = useRef(null);
  const skipConfigSyncRef = useRef(false);

  // Detect external config changes during render (no ref access)
  const [prevExternalConfig, setPrevExternalConfig] = useState(externalEnrichmentConfig);
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

  const setConfig = useCallback((updater) => {
    setLocalConfig((prev) => {
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
      try { localStorage.setItem("illuminator:config", JSON.stringify(pending)); } catch { /* ignored */ }
    }
  }, [localConfig, onEnrichmentConfigChange]);

  const updateConfig = useCallback((updates) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  }, [setConfig]);

  return { config, setConfig, updateConfig };
}
