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
]);

function sizeToAspectRatio(size: string): string {
  const [w, h] = size.split("x").map(Number);
  if (!w || !h || w === h) return "1:1";
  // Find GCD to simplify ratio
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const d = gcd(w, h);
  return `${w / d}:${h / d}`;
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
};

/**
 * Get extra request body parameters for a model (e.g. `raw: false` for Flux Ultra).
 */
export function getModelExtraParams(model: string): Record<string, unknown> | undefined {
  return MODEL_EXTRA_PARAMS[model];
}

// ---------------------------------------------------------------------------
// Per-model negative prompt fragments (appended AFTER Claude resynthesis)
// ---------------------------------------------------------------------------

const MODEL_NEGATIVE_PROMPTS: Record<string, string> = {
  "wavespeed-ai/flux-1.1-pro-ultra":
    "AVOID: desaturated colors, film grain haze, washed-out tones, muted palette, white film overlay",
  "wavespeed-ai/flux-2-pro/text-to-image":
    "AVOID: desaturated colors, film grain haze, washed-out tones, muted palette, white film overlay",
};

/**
 * Get a model-specific negative prompt fragment that should be appended to
 * the final image prompt AFTER Claude resynthesis.  Returns undefined if
 * the model has no special negative cues.
 */
export function getModelNegativePrompt(model: string): string | undefined {
  return MODEL_NEGATIVE_PROMPTS[model];
}
