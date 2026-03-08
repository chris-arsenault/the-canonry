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
// Flux 2 Pro — deterministic JSON with LLM-synthesized subject/scene fields.
// Style, palette, composition, background are extracted deterministically.
// Only subject descriptions, scene summary, lighting, and mood go to Claude.
// ---------------------------------------------------------------------------

export const FLUX_2_SUBJECT_SYNTHESIS_TEMPLATE = `Synthesize the visual description below into structured scene data for image generation.

Output this exact JSON — no code fences, no markdown, no explanation:

{
  "scene": "One sentence: the central subject/action and the key visual moment.",
  "subjects": [
    { "description": "Self-contained visual description with distinctive details and colors", "position": "spatial placement in frame" }
  ],
  "lighting": "Light sources, direction, quality — derived from the scene",
  "mood": "Emotional atmosphere in a few words"
}

Rules:
- Only visual and emotional content. Strip lore, names, backstory, world-building.
- Positive only — never write "avoid", "no", "without", or "don't".
- Maintain species exactly as specified — if the description says penguins, they must be penguins.
- Each subject must be a self-contained visual block with all its distinctive details.
- Use descriptive color language, not hex codes.
- Output valid JSON only.

Visual description:
{{subjectText}}`;

export const FLUX_2_CHRONICLE_SUBJECT_SYNTHESIS_TEMPLATE = `Synthesize the scene description below into structured scene data for image generation.

Output this exact JSON — no code fences, no markdown, no explanation:

{
  "scene": "One sentence: the central action and key moment.",
  "subjects": [
    { "description": "Self-contained visual description of character including species, distinctive details, and what they are doing", "position": "spatial placement in frame" }
  ],
  "lighting": "Light sources, direction, quality — derived from the scene",
  "mood": "Emotional atmosphere in a few words"
}

Rules:
- Only visual and emotional content. Strip lore, names, world-building.
- Positive only — never write "avoid", "no", "without", or "don't".
- Maintain species — characters must be described as their specified species.
- Each subject must be a self-contained visual block. Do not interleave attributes between characters.
- Use descriptive color language, not hex codes.
- Output valid JSON only.

Scene description:
{{subjectText}}`;

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

// ---------------------------------------------------------------------------
// Prompt section parser — extracts labeled sections from structured prompts
// ---------------------------------------------------------------------------

const PROMPT_SECTION_LABELS = [
  "IMAGE INSTRUCTIONS",
  "SPECIES REQUIREMENT",
  "SUBJECT",
  "CONTEXT",
  "VISUAL THESIS",
  "SUPPORTING TRAITS",
  "CULTURAL VISUAL IDENTITY",
  "STYLE",
  "COLOR PALETTE",
  "COMPOSITION",
  "RENDER",
  "SETTING",
  "AVOID",
  "SIZE HINT",
  "CAST",
  "SCENE",
  "FROM",
  "WORLD",
];

const _labelAlt = PROMPT_SECTION_LABELS
  .map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|");
const SECTION_HEADER_RE = new RegExp(`^(${_labelAlt})(?:\\s*\\([^)]*\\))?:\\s*(.*)$`);

export interface ParsedPromptSections {
  [label: string]: string;
}

/**
 * Parse a structured prompt into labeled sections.
 * Text before the first labeled section is stored under `_preamble`.
 */
export function parsePromptSections(prompt: string): ParsedPromptSections {
  const sections: ParsedPromptSections = {};
  const lines = prompt.split("\n");
  let currentLabel = "_preamble";
  let currentBody: string[] = [];

  for (const line of lines) {
    const match = line.match(SECTION_HEADER_RE);
    if (match) {
      const body = currentBody.join("\n").trim();
      if (body) sections[currentLabel] = body;
      currentLabel = match[1];
      currentBody = match[2] ? [match[2]] : [];
    } else {
      currentBody.push(line);
    }
  }
  const body = currentBody.join("\n").trim();
  if (body) sections[currentLabel] = body;

  return sections;
}

/**
 * Extract and remove [Artist exemplar: Name] from a style string.
 */
function extractArtistExemplar(style: string): { cleaned: string; exemplar: string } {
  const m = style.match(/\[Artist exemplar:\s*([^\]]+)\]/);
  if (!m) return { cleaned: style, exemplar: "" };
  return { cleaned: style.replace(m[0], "").trim(), exemplar: m[1].trim() };
}

/**
 * Extract deterministic JSON fields from parsed prompt sections.
 * These fields are mapped directly — no LLM involvement.
 */
export function extractDeterministicFlux2Fields(
  sections: ParsedPromptSections,
  isChronicle: boolean
): Record<string, string> {
  const rawStyle = sections["STYLE"] || "";
  const { cleaned: styleBase, exemplar } = extractArtistExemplar(rawStyle);
  let style = exemplar ? `${styleBase}, in the style of ${exemplar}` : styleBase;
  if (sections["RENDER"]) style = `${style}. ${sections["RENDER"]}`;

  // Strip duplicate "COLOR PALETTE:" prefix that buildCompositePrompt may add
  const palette = (sections["COLOR PALETTE"] || "").replace(/^COLOR PALETTE:\s*/i, "");
  const composition = sections["COMPOSITION"] || "";
  const background = isChronicle
    ? sections["WORLD"] || ""
    : sections["SETTING"] || "";

  return { style, color_palette: palette, composition, background };
}

/**
 * Extract the visual description text to send to Claude for subject/scene synthesis.
 * Includes only sections that need creative synthesis — not style/palette/composition.
 */
export function extractSubjectText(
  sections: ParsedPromptSections,
  isChronicle: boolean
): string {
  if (isChronicle) {
    const parts = [
      sections["SCENE"],
      sections["CAST"] ? `CAST: ${sections["CAST"]}` : "",
      sections["SPECIES REQUIREMENT"] ? `SPECIES: ${sections["SPECIES REQUIREMENT"]}` : "",
      sections["SIZE HINT"] ? `SIZE: ${sections["SIZE HINT"]}` : "",
    ];
    const text = parts.filter(Boolean).join("\n");
    return text || sections["_preamble"] || "";
  }

  const parts = [
    sections["IMAGE INSTRUCTIONS"] ? `FOCUS: ${sections["IMAGE INSTRUCTIONS"]}` : "",
    sections["SPECIES REQUIREMENT"] ? `SPECIES: ${sections["SPECIES REQUIREMENT"]}` : "",
    sections["SUBJECT"],
    sections["CONTEXT"],
    sections["VISUAL THESIS"],
    sections["SUPPORTING TRAITS"],
    sections["CULTURAL VISUAL IDENTITY"],
  ];
  const text = parts.filter(Boolean).join("\n");
  return text || sections["_preamble"] || "";
}

/**
 * Merge deterministic fields with Claude-synthesized subject/scene data into a Flux 2 JSON prompt.
 * Strips code fences from Claude's output before parsing.
 */
export function mergeFlux2JsonPrompt(
  deterministicFields: Record<string, string>,
  claudeOutput: string
): string {
  let cleaned = claudeOutput.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
  cleaned = cleaned.trim();

  let synthesized: Record<string, unknown>;
  try {
    synthesized = JSON.parse(cleaned);
  } catch {
    // If Claude output isn't valid JSON, wrap it as a simple prompt
    return JSON.stringify({
      scene: cleaned,
      subjects: [{ description: cleaned, position: "centered in frame" }],
      ...Object.fromEntries(Object.entries(deterministicFields).filter(([, v]) => v)),
    });
  }

  const merged: Record<string, unknown> = {
    scene: synthesized.scene || "",
    subjects: synthesized.subjects || [{ description: cleaned, position: "centered in frame" }],
    style: deterministicFields.style,
    color_palette: deterministicFields.color_palette,
    lighting: synthesized.lighting || "",
    mood: synthesized.mood || "",
    composition: deterministicFields.composition,
  };
  if (deterministicFields.background) merged.background = deterministicFields.background;

  // Drop empty string fields
  for (const [k, v] of Object.entries(merged)) {
    if (v === "") delete merged[k];
  }

  return JSON.stringify(merged);
}
