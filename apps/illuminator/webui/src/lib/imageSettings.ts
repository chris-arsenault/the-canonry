/**
 * Image generation settings constants
 *
 * Shared configuration for image model, size, and quality options.
 * Used by ConfigPanel for global settings and EntityBrowser for per-entity overrides.
 */

export const IMAGE_MODELS = [
  // OpenAI
  { value: "gpt-image-1.5", label: "GPT Image 1.5", provider: "openai" },
  { value: "gpt-image-1", label: "GPT Image 1", provider: "openai" },
  { value: "dall-e-3", label: "DALL-E 3", provider: "openai" },
  { value: "dall-e-2", label: "DALL-E 2 (cheaper)", provider: "openai" },
  // WaveSpeed
  { value: "wavespeed-ai/flux-1.1-pro-ultra", label: "Flux 1.1 Pro Ultra", provider: "wavespeed" },
  { value: "wavespeed-ai/flux-1.1-pro-ultra-raw", label: "Flux 1.1 Pro Ultra (Raw)", provider: "wavespeed" },
  { value: "wavespeed-ai/flux-2-pro/text-to-image", label: "Flux 2 Pro", provider: "wavespeed" },
  { value: "wavespeed-ai/qwen-image-2.0-pro/text-to-image", label: "Qwen Image 2.0 Pro", provider: "wavespeed" },
  { value: "google/nano-banana-pro/text-to-image", label: "Nano Banana Pro", provider: "wavespeed" },
  { value: "bytedance/seedream-v4.5", label: "Seedream 4.5", provider: "wavespeed" },
  { value: "recraft-ai/recraft-v4-pro/text-to-image", label: "Recraft V4 Pro", provider: "wavespeed" },
] as const;

export function isWaveSpeedModel(model: string): boolean {
  return IMAGE_MODELS.some((m) => m.value === model && m.provider === "wavespeed");
}

export function getProviderForModel(model: string): "openai" | "wavespeed" {
  return isWaveSpeedModel(model) ? "wavespeed" : "openai";
}

// Model-specific size options
export const IMAGE_SIZES_BY_MODEL: Record<string, Array<{ value: string; label: string }>> = {
  "gpt-image-1.5": [
    { value: "auto", label: "Auto" },
    { value: "1024x1024", label: "1024x1024 (Square)" },
    { value: "1536x1024", label: "1536x1024 (Landscape)" },
    { value: "1024x1536", label: "1024x1536 (Portrait)" },
  ],
  "gpt-image-1": [
    { value: "auto", label: "Auto" },
    { value: "1024x1024", label: "1024x1024 (Square)" },
    { value: "1536x1024", label: "1536x1024 (Landscape)" },
    { value: "1024x1536", label: "1024x1536 (Portrait)" },
  ],
  "dall-e-3": [
    { value: "1024x1024", label: "1024x1024 (Square)" },
    { value: "1792x1024", label: "1792x1024 (Landscape)" },
    { value: "1024x1792", label: "1024x1792 (Portrait)" },
  ],
  "dall-e-2": [
    { value: "1024x1024", label: "1024x1024" },
    { value: "512x512", label: "512x512" },
    { value: "256x256", label: "256x256" },
  ],
};

// WaveSpeed models share the same size options (unless overridden below)
const WAVESPEED_SIZES = [
  { value: "1024x1024", label: "1024x1024 (Square)" },
  { value: "1536x1024", label: "1536x1024 (Landscape)" },
  { value: "1024x1536", label: "1024x1536 (Portrait)" },
];
for (const m of IMAGE_MODELS) {
  if (m.provider === "wavespeed") IMAGE_SIZES_BY_MODEL[m.value] = WAVESPEED_SIZES;
}

// Recraft V4 Pro: width and height must be between 256 and 1536
IMAGE_SIZES_BY_MODEL["recraft-ai/recraft-v4-pro/text-to-image"] = [
  { value: "1024x1024", label: "1024x1024 (Square)" },
  { value: "1536x1024", label: "1536x1024 (Landscape)" },
  { value: "1024x1536", label: "1024x1536 (Portrait)" },
];

// Model-specific quality options
export const IMAGE_QUALITY_BY_MODEL: Record<string, Array<{ value: string; label: string }>> = {
  "gpt-image-1.5": [
    { value: "auto", label: "Auto" },
    { value: "high", label: "High" },
    { value: "medium", label: "Medium" },
    { value: "low", label: "Low" },
  ],
  "gpt-image-1": [
    { value: "auto", label: "Auto" },
    { value: "high", label: "High" },
    { value: "medium", label: "Medium" },
    { value: "low", label: "Low" },
  ],
  "dall-e-3": [
    { value: "standard", label: "Standard" },
    { value: "hd", label: "HD" },
  ],
  "dall-e-2": [{ value: "standard", label: "Standard" }],
};

// WaveSpeed models have no quality parameter
for (const m of IMAGE_MODELS) {
  if (m.provider === "wavespeed") IMAGE_QUALITY_BY_MODEL[m.value] = [];
}

/**
 * Get size options for a given model
 */
export function getSizeOptions(model: string): Array<{ value: string; label: string }> {
  return IMAGE_SIZES_BY_MODEL[model] || IMAGE_SIZES_BY_MODEL["dall-e-3"];
}

/**
 * Get quality options for a given model
 */
export function getQualityOptions(model: string): Array<{ value: string; label: string }> {
  return IMAGE_QUALITY_BY_MODEL[model] || IMAGE_QUALITY_BY_MODEL["dall-e-3"];
}

/**
 * Get the default size for a model
 */
export function getDefaultSize(model: string): string {
  const options = getSizeOptions(model);
  return options[0]?.value || "1024x1024";
}

/**
 * Get the default quality for a model
 */
export function getDefaultQuality(model: string): string {
  const options = getQualityOptions(model);
  return options[0]?.value || "standard";
}

/**
 * Check if a size is valid for a model
 */
export function isValidSize(model: string, size: string): boolean {
  const options = getSizeOptions(model);
  return options.some((opt) => opt.value === size);
}

/**
 * Check if a quality is valid for a model
 */
export function isValidQuality(model: string, quality: string): boolean {
  const options = getQualityOptions(model);
  return options.some((opt) => opt.value === quality);
}

/**
 * Get image size for a given aspect and model.
 * Aspects: "square", "landscape", "portrait".
 */
export function getSizeForAspect(model: string, aspect: string): string {
  const sizes = IMAGE_SIZES_BY_MODEL[model] || IMAGE_SIZES_BY_MODEL["dall-e-3"];
  const labels: Record<string, string> = {
    square: "Square",
    landscape: "Landscape",
    portrait: "Portrait",
  };
  const label = labels[aspect];
  if (label) {
    const match = sizes.find((s) => s.label.includes(label));
    if (match) return match.value;
  }
  return sizes.find((s) => s.label.includes("Square"))?.value || sizes[0]?.value || "1024x1024";
}

// ---------------------------------------------------------------------------
// Per-model Claude synthesis templates (Flux-optimized prompting)
// ---------------------------------------------------------------------------

export function isFluxModel(model: string): boolean {
  return model.includes("flux");
}

/** Distinguish Flux model generations — they need very different prompt formats. */
export function getFluxGeneration(model: string): "flux-1" | "flux-2" | null {
  if (!model.includes("flux")) return null;
  if (model.includes("flux-2")) return "flux-2";
  return "flux-1";
}

// ---------------------------------------------------------------------------
// Flux 2 Pro — structured, precise, hex-heavy. This model parses technical
// detail well and rewards specificity.
// ---------------------------------------------------------------------------

export const FLUX_2_IMAGE_PROMPT_TEMPLATE = `Rewrite the structured prompt below into a JSON image generation prompt optimized for Flux 2 Pro.

The input may be very long and redundant. Deduplicate and restructure — cut repetition ruthlessly but preserve all distinct visual details. Only visual and emotional content. Strip lore, backstory, names, world-building. Positive only — never write "avoid", "no", "without", or "don't". Honor the input style. Attach hex codes inline with colored objects.

Output this exact JSON structure:

{
  "scene": "One sentence: the style/medium, the central subject, and the key action.",
  "subjects": [
    { "description": "Self-contained visual description of subject with colors and distinctive details", "position": "spatial placement in frame" }
  ],
  "style": "The artistic medium and rendering approach",
  "color_palette": "Dominant colors with hex codes bound to objects",
  "lighting": "Light sources, direction, quality",
  "mood": "Emotional atmosphere in a few words",
  "background": "Setting and environment details",
  "composition": "Camera angle, framing, depth"
}

Output valid JSON only, no explanation.
{{globalImageRules}}
Original prompt:
{{prompt}}`;

export const FLUX_2_CHRONICLE_IMAGE_PROMPT_TEMPLATE = `Rewrite the structured prompt below into a JSON image generation prompt optimized for Flux 2 Pro.

The input may be very long and redundant. Deduplicate and restructure — cut repetition ruthlessly but preserve all distinct visual details. Only visual and emotional content. Strip lore, names, world-building. Positive only — never write "avoid", "no", "without", or "don't". Honor the input style. Maintain species — characters must be described as their specified species. Attach hex codes inline with colored objects.

Output this exact JSON structure:

{
  "scene": "One sentence: the style/medium, the central action, and the key moment.",
  "subjects": [
    { "description": "Self-contained visual description of character including species, colors, distinctive details, and what they are doing", "position": "spatial placement in frame" }
  ],
  "style": "The artistic medium and rendering approach",
  "color_palette": "Dominant colors with hex codes bound to objects",
  "lighting": "Light sources, direction, quality",
  "mood": "Emotional atmosphere in a few words",
  "background": "Setting and environment details",
  "composition": "Camera angle, framing, depth"
}

Output valid JSON only, no explanation.
{{globalImageRules}}
Original prompt:
{{prompt}}`;

// ---------------------------------------------------------------------------
// Flux 1.1 Pro Ultra — natural prose. This model responds to prompts that
// read like vivid scene descriptions, not technical specifications. Hex codes
// and structured lists degrade output. Use evocative color names instead.
// ---------------------------------------------------------------------------

export const FLUX_1_IMAGE_PROMPT_TEMPLATE = `Synthesize the structured prompt below into an image generation prompt following this exact structure:

Style → Subject → Action/Context → Technical details

The input may be very long and redundant. Deduplicate and restructure — cut repetition ruthlessly but preserve all distinct visual details. Every word in your output must contribute unique visual information. Front-load the most important elements since Flux weights earlier text more heavily.

Output structure guidelines:

1. STYLE FIRST. The very first words must establish the medium/style. This is the most important element — it must come before anything else.

2. If the input contains an [Artist exemplar: ...] tag, include "in the style of [artist name]" prominently in your opening style phrase. This anchors the visual medium on the target model. Always include the artist name when provided.

3. Then SUBJECT with its visually distinctive details — the things that make this character/scene unique and recognizable.

4. Then CONTEXT — setting, action, mood.

5. Then TECHNICAL — lighting, camera, atmosphere as a closing detail.

Additional rules:

- Use rich color names, not hex codes. "Deep crimson", "molten gold", "bruised violet" — painter's language.
- Only visual and emotional content. Strip lore, backstory, names, world-building.
- Positive only. Never write "avoid", "no", "without", or "don't" — invert negatives into vivid positives.
{{globalImageRules}}
Original prompt:
{{prompt}}`;

export const FLUX_1_CHRONICLE_IMAGE_PROMPT_TEMPLATE = `Synthesize the structured prompt below into an image generation prompt following this exact structure:

Style → Scene/Action → Characters with distinctive details → Technical details

The input may be very long and redundant. Deduplicate and restructure — cut repetition ruthlessly but preserve all distinct visual details. Every word in your output must contribute unique visual information. Front-load the most important elements since Flux weights earlier text more heavily.

Output structure guidelines:

1. STYLE FIRST. The very first words must establish the medium/style. This is the most important element.

2. If the input contains an [Artist exemplar: ...] tag, include "in the style of [artist name]" prominently in your opening style phrase. This anchors the visual medium on the target model. Always include the artist name when provided.

3. Then the SCENE — what is happening, the central action or moment.

4. Then CHARACTERS — maintain species, describe each character as a self-contained block with their distinctive visual details. Do not interleave attributes between characters.

5. Then TECHNICAL — lighting, camera, atmosphere as a closing detail.

Additional rules:

- Use rich color names, not hex codes. Painter's language.
- Only visual and emotional content. Strip lore, names, world-building.
- Positive only — invert negatives into vivid positives. Never write "avoid", "no", "without", or "don't".
{{globalImageRules}}
Original prompt:
{{prompt}}`;

// ---------------------------------------------------------------------------
// Abstract aspect options (stored in settings, resolved at generation time)
// ---------------------------------------------------------------------------

export const IMAGE_ASPECTS = [
  { value: "auto", label: "Auto" },
  { value: "square", label: "Square" },
  { value: "landscape", label: "Landscape" },
  { value: "portrait", label: "Portrait" },
] as const;

export type ImageAspect = (typeof IMAGE_ASPECTS)[number]["value"];

/**
 * Resolve an abstract aspect (or legacy WxH size) to a concrete WxH size
 * string for a given model.
 */
export function resolveImageSize(model: string, aspect: string): string {
  // GPT Image models support "auto" natively
  if (aspect === "auto" && model.startsWith("gpt-image")) return "auto";
  // Map named aspects to model-specific sizes
  if (aspect === "auto" || aspect === "square" || aspect === "landscape" || aspect === "portrait") {
    return getSizeForAspect(model, aspect === "auto" ? "square" : aspect);
  }
  // Already a concrete WxH size (legacy or override) — pass through
  return aspect;
}

// ---------------------------------------------------------------------------
// Per-model size parameter format
// ---------------------------------------------------------------------------

/** Models that use `aspect_ratio` (e.g. "16:9") instead of `size` (e.g. "1536*1024"). */
const ASPECT_RATIO_MODELS = new Set([
  "wavespeed-ai/flux-1.1-pro-ultra",
  "wavespeed-ai/flux-1.1-pro-ultra-raw",
]);

function sizeToAspectRatio(size: string): string {
  const [w, h] = size.split("x").map(Number);
  if (!w || !h || w === h) return "1:1";
  return w > h ? "16:9" : "9:16";
}

/**
 * Convert a WxH size string to the model's expected size parameter(s).
 * Most models use `{ size: "W*H" }`. Some use `{ aspect_ratio: "W:H" }`.
 */
export function getModelSizeParams(model: string, size: string): Record<string, string> {
  if (ASPECT_RATIO_MODELS.has(model)) {
    return { aspect_ratio: sizeToAspectRatio(size) };
  }
  return { size: size.replace("x", "*") };
}

// ---------------------------------------------------------------------------
// Per-model extra request body params (merged into WaveSpeed request)
// ---------------------------------------------------------------------------

const MODEL_EXTRA_PARAMS: Record<string, Record<string, unknown>> = {
  "wavespeed-ai/flux-1.1-pro-ultra": { raw: false },
  "wavespeed-ai/flux-1.1-pro-ultra-raw": { raw: true },
};

// ---------------------------------------------------------------------------
// Model alias resolution — virtual model IDs that map to a real API endpoint
// ---------------------------------------------------------------------------

const MODEL_API_ALIASES: Record<string, string> = {
  "wavespeed-ai/flux-1.1-pro-ultra-raw": "wavespeed-ai/flux-1.1-pro-ultra",
};

/**
 * Resolve a model ID to its actual API endpoint model ID.
 * Most models map to themselves; virtual variants (e.g. raw mode) map to the real endpoint.
 */
export function resolveApiModel(model: string): string {
  return MODEL_API_ALIASES[model] || model;
}

/**
 * Get extra request body parameters for a model (e.g. `raw: false` for Flux Ultra).
 */
export function getModelExtraParams(model: string): Record<string, unknown> | undefined {
  return MODEL_EXTRA_PARAMS[model];
}

// ---------------------------------------------------------------------------
// Per-model prompt suffix (appended AFTER Claude resynthesis)
// ---------------------------------------------------------------------------

const MODEL_PROMPT_SUFFIX: Record<string, string> = {
  // Flux models: no suffix — the Flux-specific template handles vibrancy direction
};

/**
 * Get a model-specific prompt suffix appended AFTER Claude resynthesis.
 * Returns undefined if the model has no special suffix.
 */
export function getModelPromptSuffix(model: string): string | undefined {
  return MODEL_PROMPT_SUFFIX[model];
}
