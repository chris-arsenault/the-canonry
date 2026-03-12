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
  // BFL (Black Forest Labs) — direct Flux API
  { value: "flux-2-pro-preview", label: "Flux 2 Pro (Preview)", provider: "bfl" },
  { value: "flux-2-pro", label: "Flux 2 Pro (Pinned)", provider: "bfl" },
  { value: "flux-2-max", label: "Flux 2 Max", provider: "bfl" },
  { value: "flux-pro-1.1-ultra", label: "Flux 1.1 Pro Ultra", provider: "bfl" },
  { value: "flux-pro-1.1-ultra-raw", label: "Flux 1.1 Pro Ultra (Raw)", provider: "bfl" },
  // WaveSpeed
  { value: "wavespeed-ai/qwen-image-2.0-pro/text-to-image", label: "Qwen Image 2.0 Pro", provider: "wavespeed" },
  { value: "google/nano-banana-pro/text-to-image", label: "Nano Banana Pro", provider: "wavespeed" },
  { value: "bytedance/seedream-v4.5", label: "Seedream 4.5", provider: "wavespeed" },
  { value: "recraft-ai/recraft-v4-pro/text-to-image", label: "Recraft V4 Pro", provider: "wavespeed" },
] as const;

export function isWaveSpeedModel(model: string): boolean {
  return IMAGE_MODELS.some((m) => m.value === model && m.provider === "wavespeed");
}

export function isBflModel(model: string): boolean {
  return IMAGE_MODELS.some((m) => m.value === model && m.provider === "bfl");
}

export function getProviderForModel(model: string): "openai" | "wavespeed" | "bfl" {
  if (isBflModel(model)) return "bfl";
  if (isWaveSpeedModel(model)) return "wavespeed";
  return "openai";
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

// WaveSpeed fallback sizes (used by models without a per-model override)
const WAVESPEED_SIZES = [
  { value: "1024x1024", label: "1024x1024 (Square)" },
  { value: "1536x1024", label: "1536x1024 (Landscape)" },
  { value: "1024x1536", label: "1024x1536 (Portrait)" },
];
for (const m of IMAGE_MODELS) {
  if (m.provider === "wavespeed") IMAGE_SIZES_BY_MODEL[m.value] = WAVESPEED_SIZES;
}

// BFL Flux 2: ~1MP sweet spot for best color fidelity and detail.
// Higher resolutions degrade color saturation and prompt adherence.
const BFL_FLUX2_SIZES = [
  { value: "1024x1024", label: "1024x1024 (Square)" },
  { value: "1152x864", label: "1152x864 (Landscape)" },
  { value: "864x1152", label: "864x1152 (Portrait)" },
];
// BFL Flux 1.1 Ultra: aspect_ratio models. These don't accept width/height —
// BFL chooses the resolution internally. Constraining to ~1MP-equivalent
// aspect hints. The actual output resolution is BFL's decision.
const BFL_FLUX1_SIZES = [
  { value: "1024x1024", label: "1:1 (Square)" },
  { value: "1152x864", label: "4:3 (Landscape)" },
  { value: "864x1152", label: "3:4 (Portrait)" },
];
for (const m of IMAGE_MODELS) {
  if (m.provider === "bfl") {
    IMAGE_SIZES_BY_MODEL[m.value] = m.value.includes("flux-2") ? BFL_FLUX2_SIZES : BFL_FLUX1_SIZES;
  }
}

// Recraft V4 Pro: width and height must be between 256 and 1536
IMAGE_SIZES_BY_MODEL["recraft-ai/recraft-v4-pro/text-to-image"] = [
  { value: "1024x1024", label: "1024x1024 (Square)" },
  { value: "1536x1024", label: "1536x1024 (Landscape)" },
  { value: "1024x1536", label: "1024x1536 (Portrait)" },
];

// Nano Banana Pro: uses resolution tier + aspect_ratio instead of pixel dimensions.
// 2K is consensus best (same price as 1K, 4x pixels, minimal speed penalty).
// Values encode "resolution:aspect_ratio", decoded in getModelSizeParams.
IMAGE_SIZES_BY_MODEL["google/nano-banana-pro/text-to-image"] = [
  { value: "2k:1:1", label: "2K Square (2048x2048)" },
  { value: "2k:4:3", label: "2K Landscape 4:3 (2048x1536)" },
  { value: "2k:3:4", label: "2K Portrait 3:4 (1536x2048)" },
  { value: "2k:16:9", label: "2K Wide 16:9 (2048x1152)" },
  { value: "2k:9:16", label: "2K Tall 9:16 (1152x2048)" },
  { value: "2k:3:2", label: "2K Landscape 3:2 (2048x1365)" },
  { value: "2k:2:3", label: "2K Portrait 2:3 (1365x2048)" },
  { value: "1k:1:1", label: "1K Square (1024x1024)" },
  { value: "1k:4:3", label: "1K Landscape 4:3 (1024x768)" },
  { value: "1k:3:4", label: "1K Portrait 3:4 (768x1024)" },
];

// Qwen Image 2.0 Pro: trained at ~1.5-1.76MP. Official training resolutions from
// Qwen team (github.com/QwenLM/Qwen-Image/issues/7). Square aspect ratios have
// documented quality issues — prefer non-square ratios.
IMAGE_SIZES_BY_MODEL["wavespeed-ai/qwen-image-2.0-pro/text-to-image"] = [
  { value: "1328x1328", label: "1328x1328 (Square, trained)" },
  { value: "1472x1104", label: "1472x1104 (4:3, trained)" },
  { value: "1104x1472", label: "1104x1472 (3:4, trained)" },
  { value: "1584x1056", label: "1584x1056 (3:2, trained)" },
  { value: "1056x1584", label: "1056x1584 (2:3, trained)" },
  { value: "1664x928", label: "1664x928 (16:9, trained)" },
  { value: "928x1664", label: "928x1664 (9:16, trained)" },
];

// Seedream 4.5: WaveSpeed minimum 3,686,400 pixels. Default 2048x2048.
// Fine-tuned at 1024-4096 range. Recommended ratios from WaveSpeed docs.
IMAGE_SIZES_BY_MODEL["bytedance/seedream-v4.5"] = [
  { value: "2048x2048", label: "2048x2048 (Square, default)" },
  { value: "2688x2016", label: "2688x2016 (Landscape 4:3)" },
  { value: "2016x2688", label: "2016x2688 (Portrait 3:4)" },
  { value: "2688x1792", label: "2688x1792 (Landscape 3:2)" },
  { value: "1792x2688", label: "1792x2688 (Portrait 2:3)" },
  { value: "2560x1440", label: "2560x1440 (Landscape 16:9)" },
  { value: "1440x2560", label: "1440x2560 (Portrait 9:16)" },
];

// Abstract quality levels — model-agnostic, resolved to model-specific values at request time.
// Mapping: auto → gpt-image: auto, dall-e-3: standard
//          high → gpt-image: high, dall-e-3: hd
//          standard → gpt-image: medium, dall-e-3: standard
//          low → gpt-image: low, dall-e-3: standard
// BFL/WaveSpeed models ignore quality entirely.
export const IMAGE_QUALITY_BY_MODEL: Record<string, Array<{ value: string; label: string }>> = {
  "gpt-image-1.5": [
    { value: "auto", label: "Auto" },
    { value: "high", label: "High" },
    { value: "standard", label: "Standard" },
    { value: "low", label: "Low" },
  ],
  "gpt-image-1": [
    { value: "auto", label: "Auto" },
    { value: "high", label: "High" },
    { value: "standard", label: "Standard" },
    { value: "low", label: "Low" },
  ],
  "dall-e-3": [
    { value: "standard", label: "Standard" },
    { value: "high", label: "HD" },
  ],
  "dall-e-2": [{ value: "standard", label: "Standard" }],
};

// WaveSpeed and BFL models have no quality parameter
for (const m of IMAGE_MODELS) {
  if (m.provider === "wavespeed" || m.provider === "bfl") IMAGE_QUALITY_BY_MODEL[m.value] = [];
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
// Per-model Claude synthesis templates
// ---------------------------------------------------------------------------

export function isFluxModel(model: string): boolean {
  return model.includes("flux");
}

export function isOpenAiModel(model: string): boolean {
  return model.startsWith("gpt-image") || model.startsWith("dall-e");
}

export function getOpenAiModelFamily(model: string): "gpt-image" | "dall-e-3" | "dall-e-2" | null {
  if (model.startsWith("gpt-image")) return "gpt-image";
  if (model === "dall-e-3") return "dall-e-3";
  if (model === "dall-e-2") return "dall-e-2";
  return null;
}

// ---------------------------------------------------------------------------
// GPT Image 1 / 1.5 — structured labeled segments. This model is natively
// multimodal and handles long, constraint-heavy prompts well (32K char limit).
// Hex codes are reliable for color. Artist exemplars work. Biased toward
// realism — needs explicit style direction for fantasy/artistic content.
// ---------------------------------------------------------------------------

export const GPT_IMAGE_PROMPT_TEMPLATE = `Reformat the structured prompt below into an image generation prompt for GPT Image. Use labeled segments.

Output format:
STYLE: [one sentence]
SUBJECT: [species, attire, action]
MATERIALS: [surface properties for each material]
SCENE: [setting]
CAMERA: [lens, framing, lighting]
PALETTE: [hex codes tied to objects]
CONSTRAINTS: [species rules]

How to think about STYLE:
One sentence maximum. Name the medium and technique. NEVER include artist names — translate any [Artist exemplar: ...] tag into the visual technique it represents. Your detail budget belongs in SUBJECT and MATERIALS, not here.

How to think about SUBJECT:
Lead with species and attire, then action. The attire is the most important visual differentiator — without it, every character is a generic silhouette. Name what each garment and piece of equipment is MADE OF. The image model renders materials it can see described, and produces vague shapes for abstract adjectives. Every garment, armor piece, and held object needs its material specified.

How to think about MATERIALS:
This is the detail driver. For each material you mentioned in SUBJECT, describe three things: its surface texture, its wear or aging state, and how light behaves on it. The image model will only render fine detail that is explicitly described — unnamed surfaces become smooth and generic. Think like a props department: what would you tell a craftsperson to build this object? That level of physical specificity is what produces visible texture in the output.

How to think about SCENE:
One sentence. Where they are, physically and spatially. Concrete geography, not mood.

How to think about CAMERA:
Photography language forces the model to render detail. Specify a focal length, an aperture for depth of field, a framing distance, and a light direction. Closer framing means more pixel budget per detail. Specific light direction makes surface texture visible — without it, details hide in flat ambient light.

How to think about PALETTE:
Every hex code must be associated with a specific object. The image model handles color best when it knows which surface each color belongs to.

How to think about SPECIES RENDERING:
Image models have a strong bias toward cute, cartoon proportions for animal characters — round bodies, oversized eyes, stubby limbs. You must counteract this with explicit adult anatomical descriptors. For penguins: "tall adult emperor penguin with narrow pointed beak, small dark eyes proportional to skull, lean upright posture, sleek plumage." For any animal species, describe adult body proportions explicitly — the model defaults to juvenile cartoon proportions if you do not.

How to think about WEAR AND WEATHERING:
Nothing is clean or new. Every character is a war veteran in a harsh world. Add physical wear to each subject: scarred beaks, frost-cracked skin, soot-dusted plumage, matted feathers, chipped armor, mud-caked wraps. One or two concrete wear details per subject — not a list, just woven into the description naturally.

How to think about TONE:
This is a grimdark world — war-torn, world-weary veterans, dirt and ash everywhere, nothing pristine. The overall atmosphere should evoke a Warhammer-like grimness. Convey this through material choices, lighting, and environmental grit — not through explicit mood words.

Rules:
- Strip all lore, backstory, character names, world-building. Only concrete visual information.
- Positive descriptions only. Never "avoid", "no", "without."
- NEVER use "8K", "ultra-detailed", "hyperdetailed", "masterpiece" — the model ignores these. Describe specific textures instead.
- 200-300 words. Spend most of the budget on SUBJECT and MATERIALS.
{{globalImageRules}}
Original prompt:
{{prompt}}`;

export const GPT_IMAGE_CHRONICLE_PROMPT_TEMPLATE = `Reformat the chronicle scene prompt below into an image generation prompt for GPT Image. Use labeled segments.

Output format:
STYLE: [one sentence]
SCENE: [what is happening, where]
CHARACTERS: [each character: species, attire with materials, action]
MATERIALS: [surface properties for key materials]
CAMERA: [lens, framing, lighting]
PALETTE: [hex codes tied to objects]
CONSTRAINTS: [species rules]

How to think about STYLE:
One sentence. Medium and technique. NEVER artist names — translate any [Artist exemplar: ...] tag into the visual technique it represents. Detail budget belongs in CHARACTERS and MATERIALS.

How to think about SCENE:
The dramatic moment and setting. One sentence. Physical and spatial.

How to think about CHARACTERS:
Each character is a separate block. Lead with species, then attire described by its material composition. The image model produces generic silhouettes for abstract clothing descriptions and renders specific textures for named materials. Every garment and piece of equipment needs its material specified. Then the character's action. Do not interleave attributes between characters.

How to think about MATERIALS:
The detail driver. For each material you mentioned in CHARACTERS, describe: surface texture, wear or aging state, and how light behaves on it. The image model only renders fine detail that is explicitly described. Think like a props department — what would you tell a craftsperson to physically build each object? That specificity produces visible texture.

How to think about CAMERA:
Photography language forces detail rendering. Specify focal length, aperture, framing distance, and light direction. Closer framing = more detail per pixel. Specific light direction makes surface texture visible.

How to think about PALETTE:
Every hex code associated with a specific object. The model handles color best when it knows which surface owns each color.

How to think about SPECIES RENDERING:
Image models have a strong bias toward cute, cartoon proportions for animal characters — round bodies, oversized eyes, stubby limbs. You must counteract this with explicit adult anatomical descriptors. For penguins: "tall adult emperor penguin with narrow pointed beak, small dark eyes proportional to skull, lean upright posture, sleek plumage." For any animal species, describe adult body proportions explicitly — the model defaults to juvenile cartoon proportions if you do not.

How to think about WEAR AND WEATHERING:
Nothing is clean or new. Every character is a war veteran in a harsh world. Add physical wear to each character: scarred beaks, frost-cracked skin, soot-dusted plumage, matted feathers, chipped armor, mud-caked wraps. One or two concrete wear details per character — not a list, just woven into the description naturally.

How to think about TONE:
This is a grimdark world — war-torn, world-weary veterans, dirt and ash everywhere, nothing pristine. The overall atmosphere should evoke a Warhammer-like grimness. Convey this through material choices, lighting, and environmental grit — not through explicit mood words.

Rules:
- Strip lore, names, backstory. Only concrete visual information.
- Positive descriptions only.
- NEVER "8K", "ultra-detailed", "hyperdetailed" — describe specific textures instead.
- 200-300 words. Spend the budget on CHARACTERS and MATERIALS.
{{globalImageRules}}
Original prompt:
{{prompt}}`;

// ---------------------------------------------------------------------------
// DALL-E 3 — short, front-loaded prompts. Only ~30-40 "graphical tokens"
// are effective. Most important element FIRST. No artist names (OpenAI
// policy). No negations. Vivid color names, not hex codes.
// ---------------------------------------------------------------------------

export const DALLE3_IMAGE_PROMPT_TEMPLATE = `Reformat the structured prompt below into a DALL-E 3 image generation prompt. DALL-E 3 only processes about 30-40 visual concepts effectively — every word must count.

Structure: Most important visual element first → supporting details → technical.

Rules for DALL-E 3 specifically:
- NEVER include artist names or "in the style of" — this is forbidden by OpenAI policy. Describe the medium and technique instead: "oil painting with visible impasto brushstrokes" not "in the style of Sargent."
- NEVER use negations: "no", "avoid", "without", "don't". Describe only what IS present.
- Use vivid color names, not hex codes: "arterial crimson", "bone ivory", "molten gold." DALL-E 3 responds better to evocative color language.
- Front-load: medium/style in the first 5 words, then subject with species and attire, then scene.
- Keep total output under 120 words. Shorter prompts produce better results on this model.
- Strip ALL lore, backstory, character names, world-building. Only concrete visual information.
- SPECIES: Animal characters must use adult anatomical proportions — lean, tall, narrow features. For penguins: "tall adult emperor penguin with narrow pointed beak, small dark eyes, lean upright posture." The model defaults to cute cartoon proportions if you do not specify.
- WEAR: Nothing is clean or new. Every character shows physical wear — scarred, frost-cracked, soot-dusted, mud-caked. Weave one or two wear details into the description.
- TONE: Grimdark world — war-torn veterans, ash and dirt, Warhammer-like grimness conveyed through materials and environment.

Output a single flowing paragraph — no labels, no bullet points, no structure markers.
{{globalImageRules}}
Original prompt:
{{prompt}}`;

export const DALLE3_CHRONICLE_IMAGE_PROMPT_TEMPLATE = `Reformat the chronicle scene prompt below into a DALL-E 3 image generation prompt. DALL-E 3 only processes about 30-40 visual concepts effectively — every word must count.

Structure: Medium/style first → the scene/action → characters with species and attire → color and atmosphere.

Rules for DALL-E 3 specifically:
- NEVER include artist names or "in the style of" — forbidden by OpenAI policy. Describe the technique instead.
- NEVER use negations. Describe only what IS present.
- Use vivid color names, not hex codes.
- Each character is a self-contained phrase with species and attire. Do not interleave attributes.
- Keep total output under 120 words.
- Strip ALL lore, names, backstory. Only concrete visual information.
- SPECIES: Animal characters must use adult anatomical proportions — lean, tall, narrow features. For penguins: "tall adult emperor penguin with narrow pointed beak, small dark eyes, lean upright posture." The model defaults to cute cartoon proportions if you do not specify.
- WEAR: Nothing is clean or new. Every character shows physical wear — scarred, frost-cracked, soot-dusted, mud-caked. Weave one or two wear details into the description.
- TONE: Grimdark world — war-torn veterans, ash and dirt, Warhammer-like grimness conveyed through materials and environment.

Output a single flowing paragraph.
{{globalImageRules}}
Original prompt:
{{prompt}}`;

/** Distinguish Flux model generations — they need very different prompt formats. */
export function getFluxGeneration(model: string): "flux-1" | "flux-2" | null {
  if (!model.includes("flux")) return null;
  if (model.includes("flux-2")) return "flux-2";
  // BFL: "flux-pro-1.1-ultra"; WaveSpeed legacy: "flux-1.1-pro-ultra"
  if (model.includes("flux-pro-1.1") || model.includes("flux-1.1")) return "flux-1";
  return "flux-1";
}

// ---------------------------------------------------------------------------
// Flux 2 Pro — deterministic JSON with LLM-synthesized subject/scene fields.
// Style and color_palette are extracted deterministically and merged after.
// Claude synthesizes scene and subjects only.
// ---------------------------------------------------------------------------

export const FLUX_2_SUBJECT_SYNTHESIS_TEMPLATE = `You are converting a visual description into a BFL Flux 2 JSON prompt. Your output IS the complete prompt — scene and subjects are all the model receives. Style, color, and medium must be embedded in your scene description.

Output raw JSON, no fences, no explanation:
{"scene":"...","subjects":[{"type":"...","description":"...","position":"...","color_match":"exact","detail_preservation":"high"}]}

How to think about the SCENE:
The scene is ONE sentence that a cinematographer would use to frame the shot. It must contain: the rendering medium/technique, who is in the shot described by what they're wearing and what species they are, where they are, and how color punctuates the image. Use vivid color names ("bright crimson", "luminous gold") — never hex codes in the scene. The scene sets the artistic tone for the whole image.

How to think about SUBJECTS:
Each subject is a camera direction for one element in the frame. Ask yourself: if I could only tell an artist 20 words about this subject, what are the 2-3 details that make it visually unique?

For living beings, the most important visual signal is what they're WEARING — attire, armor, equipment. This must come first. A character without clothing is a generic silhouette. Start with "A [species] in [specific attire from the input]", then one distinctive visual detail, then their action. End with "strictly in color #HEX <name>".

For non-living elements (magic effects, objects, environments), lead with the most distinctive visual quality — shape, texture, behavior.

Subject types should be concrete: species + role for living beings, noun phrase for objects. Keep them short.

How to think about COLOR:
Each subject must get a different color from the palette so they're visually distinct from each other. Choose vivid, intense adjectives for the color tag — the image model desaturates, so you need to push brightness in language. Use PRIMARY COLORS for your focal subjects. Use SECONDARY COLORS for atmosphere or less important elements.

How to think about BREVITY:
Image models degrade with long prompts. Every word must earn its place. ~20 words per subject description before the color tag. Strip all lore, names, backstory, abstract concepts. Only concrete visual information survives the conversion to pixels.

How to think about SPECIES RENDERING:
Image models have a strong bias toward cute, cartoon proportions for animal characters — round bodies, oversized eyes, stubby limbs. You must counteract this with explicit adult anatomical descriptors. For penguins: "tall adult emperor penguin with narrow pointed beak, small dark eyes proportional to skull, lean upright posture, sleek plumage." For any animal species, describe adult body proportions explicitly — the model defaults to juvenile cartoon proportions if you do not. Include the species in the subject type field ("emperor penguin merchant", not "penguin merchant").

How to think about WEAR AND WEATHERING:
Nothing is clean or new. Every character is a war veteran in a harsh world. Add physical wear to each subject: scarred beaks, frost-cracked skin, soot-dusted plumage, matted feathers, chipped armor, mud-caked wraps. One or two concrete wear details per subject — not a list, just woven into the description naturally.

2-3 subjects. Merge minor elements into the scene. Positive descriptions only — never "avoid", "no", "without".

{{paletteContext}}
Visual description:
{{subjectText}}`;

export const FLUX_2_CHRONICLE_SUBJECT_SYNTHESIS_TEMPLATE = `You are converting a chronicle scene description into a BFL Flux 2 JSON prompt. Your output IS the complete prompt — scene and subjects are all the model receives. Style, color, and medium must be embedded in your scene description.

Output raw JSON, no fences, no explanation:
{"scene":"...","subjects":[{"type":"...","description":"...","position":"...","color_match":"exact","detail_preservation":"high"}]}

How to think about the SCENE:
The scene is ONE sentence that a cinematographer would use to frame the shot. It must contain: the rendering medium/technique, who is in the shot described by what they're wearing and what species they are, where they are, and how color punctuates the image. Use vivid color names ("bright crimson", "luminous gold") — never hex codes in the scene. The scene sets the artistic tone for the whole image.

How to think about SUBJECTS:
Each subject is a camera direction for one element in the frame. Ask yourself: if I could only tell an artist 20 words about this subject, what are the 2-3 details that make it visually unique?

For living beings, the most important visual signal is what they're WEARING — attire, armor, equipment. This must come first. A character without clothing is a generic silhouette. Start with "A [species] in [specific attire from the input]", then one distinctive visual detail, then their action. End with "strictly in color #HEX <name>".

For non-living elements (magic effects, objects, environments), lead with the most distinctive visual quality — shape, texture, behavior.

Subject types should be concrete: species + role for living beings, noun phrase for objects. Keep them short. Each subject describes only itself — do not interleave attributes between characters.

How to think about COLOR:
Each subject must get a different color from the palette so they're visually distinct from each other. Choose vivid, intense adjectives for the color tag — the image model desaturates, so you need to push brightness in language. Use PRIMARY COLORS for your focal subjects. Use SECONDARY COLORS for atmosphere or less important elements.

How to think about BREVITY:
Image models degrade with long prompts. Every word must earn its place. ~20 words per subject description before the color tag. Strip all lore, names, backstory, abstract concepts. Only concrete visual information survives the conversion to pixels.

How to think about SPECIES RENDERING:
Image models have a strong bias toward cute, cartoon proportions for animal characters — round bodies, oversized eyes, stubby limbs. You must counteract this with explicit adult anatomical descriptors. For penguins: "tall adult emperor penguin with narrow pointed beak, small dark eyes proportional to skull, lean upright posture, sleek plumage." For any animal species, describe adult body proportions explicitly — the model defaults to juvenile cartoon proportions if you do not. Include the species in the subject type field ("emperor penguin merchant", not "penguin merchant").

How to think about WEAR AND WEATHERING:
Nothing is clean or new. Every character is a war veteran in a harsh world. Add physical wear to each subject: scarred beaks, frost-cracked skin, soot-dusted plumage, matted feathers, chipped armor, mud-caked wraps. One or two concrete wear details per subject — not a list, just woven into the description naturally.

2-3 subjects. Merge minor elements into the scene. Positive descriptions only — never "avoid", "no", "without".

{{paletteContext}}
Scene description:
{{subjectText}}`;

// ---------------------------------------------------------------------------
// Flux 1.1 Pro Ultra — active prompt template (WIP, to be tuned from hypotheses)
// ---------------------------------------------------------------------------

// TODO: Replace with tuned template after hypothesis testing
export const FLUX_1_IMAGE_PROMPT_TEMPLATE = `{{prompt}}`;
export const FLUX_1_CHRONICLE_IMAGE_PROMPT_TEMPLATE = `{{prompt}}`;

// ---------------------------------------------------------------------------
// Flux narrative templates (formerly the Flux 1 templates) — long-form prose
// reformatter. Works well for Flux 2 with disable_pup. Produces prompts that
// are too long and dense for Flux 1.1 Ultra.
// ---------------------------------------------------------------------------

export const FLUX_1_NARRATIVE_IMAGE_PROMPT_TEMPLATE = `Synthesize the structured prompt below into an image generation prompt following this exact structure:

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
- SPECIES: Animal characters must use adult anatomical proportions — lean, tall, narrow features. For penguins: "tall adult emperor penguin with narrow pointed beak, small dark eyes, lean upright posture, sleek plumage." The model defaults to cute cartoon proportions without explicit descriptors.
- WEAR: Nothing is clean or new. Every character is a war veteran — scarred, frost-cracked, soot-dusted, mud-caked. Weave wear details into the description naturally.
- TONE: Grimdark world — war-torn world-weary veterans, dirt and ash on feathers, Warhammer-like grimness. Convey through material choices and environmental grit.
{{globalImageRules}}
Original prompt:
{{prompt}}`;

export const FLUX_1_NARRATIVE_CHRONICLE_IMAGE_PROMPT_TEMPLATE = `Synthesize the structured prompt below into an image generation prompt following this exact structure:

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
- SPECIES: Animal characters must use adult anatomical proportions — lean, tall, narrow features. For penguins: "tall adult emperor penguin with narrow pointed beak, small dark eyes, lean upright posture, sleek plumage." The model defaults to cute cartoon proportions without explicit descriptors.
- WEAR: Nothing is clean or new. Every character is a war veteran — scarred, frost-cracked, soot-dusted, mud-caked. Weave wear details into the description naturally.
- TONE: Grimdark world — war-torn world-weary veterans, dirt and ash on feathers, Warhammer-like grimness. Convey through material choices and environmental grit.
{{globalImageRules}}
Original prompt:
{{prompt}}`;

// ---------------------------------------------------------------------------
// WaveSpeed model templates (Qwen, Seedream, Recraft, Nano Banana)
// ---------------------------------------------------------------------------
// These models accept free-form text prompts similar to Flux 1 narrative.

export const WAVESPEED_IMAGE_PROMPT_TEMPLATE = `Synthesize the structured prompt below into an image generation prompt for {{modelName}}.

Output structure: Style → Subject → Action/Context → Technical details

Deduplicate the input — cut repetition ruthlessly but preserve all distinct visual details. Every word must contribute unique visual information.

1. STYLE FIRST. Open with the medium/artistic style.

2. If the input contains an [Artist exemplar: ...] tag, include "in the style of [artist name]" in your opening phrase.

3. Then SUBJECT — species, attire described by material composition, distinctive visual details. Lead with what they're wearing; a character without clothing is a generic silhouette. Name what each garment and piece of equipment is MADE OF.

4. Then CONTEXT — setting, action, mood.

5. Then TECHNICAL — lighting, camera, atmosphere.

Rules:
- Use rich color names, not hex codes. "Deep crimson", "molten gold", "bruised violet."
- Only visual and emotional content. Strip lore, backstory, names, world-building.
- Positive only. Never write "avoid", "no", "without", or "don't" — invert negatives into vivid positives.
- SPECIES: Animal characters must use adult anatomical proportions — lean, tall, narrow features. For penguins: "tall adult emperor penguin with narrow pointed beak, small dark eyes, lean upright posture, sleek plumage." The model defaults to cute cartoon proportions without explicit descriptors.
- WEAR: Nothing is clean or new. Every character is a war veteran — scarred, frost-cracked, soot-dusted, mud-caked. Weave wear details into the description naturally.
- TONE: Grimdark world — war-torn world-weary veterans, dirt and ash on feathers, Warhammer-like grimness. Convey through material choices and environmental grit.

Output 150-300 words of unified artistic direction — not sections or bullet lists.
{{globalImageRules}}
Original prompt:
{{prompt}}`;

export const WAVESPEED_CHRONICLE_IMAGE_PROMPT_TEMPLATE = `Synthesize the chronicle scene prompt below into an image generation prompt for {{modelName}}.

Output structure: Style → Scene/Action → Characters → Technical details

Deduplicate the input — cut repetition ruthlessly but preserve all distinct visual details. Every word must contribute unique visual information.

1. STYLE FIRST. Open with the medium/artistic style.

2. If the input contains an [Artist exemplar: ...] tag, include "in the style of [artist name]" in your opening phrase.

3. Then the SCENE — what is happening, the central action or moment.

4. Then CHARACTERS — each character is a self-contained block: species, attire described by material composition, distinctive visual details. Do not interleave attributes between characters.

5. Then TECHNICAL — lighting, camera, atmosphere.

Rules:
- Use rich color names, not hex codes. Painter's language.
- Only visual and emotional content. Strip lore, names, world-building.
- Positive only — invert negatives into vivid positives. Never write "avoid", "no", "without", or "don't".
- SPECIES: Animal characters must use adult anatomical proportions — lean, tall, narrow features. For penguins: "tall adult emperor penguin with narrow pointed beak, small dark eyes, lean upright posture, sleek plumage." The model defaults to cute cartoon proportions without explicit descriptors.
- WEAR: Nothing is clean or new. Every character is a war veteran — scarred, frost-cracked, soot-dusted, mud-caked. Weave wear details into the description naturally.
- TONE: Grimdark world — war-torn world-weary veterans, dirt and ash on feathers, Warhammer-like grimness. Convey through material choices and environmental grit.

Output 150-250 words of unified artistic direction — not sections or bullet lists.
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
  "flux-pro-1.1-ultra",
  "flux-pro-1.1-ultra-raw",
]);

function sizeToAspectRatio(size: string): string {
  const [w, h] = size.split("x").map(Number);
  if (!w || !h || w === h) return "1:1";
  return w > h ? "4:3" : "3:4";
}

/** Models that use `resolution` + `aspect_ratio` (e.g. Nano Banana Pro). */
const RESOLUTION_TIER_MODELS = new Set([
  "google/nano-banana-pro/text-to-image",
]);

/**
 * Convert a WxH size string to the model's expected size parameter(s).
 * Most models use `{ size: "W*H" }`. Some use `{ aspect_ratio: "W:H" }`.
 * Nano Banana uses `{ resolution: "2k", aspect_ratio: "4:3" }`.
 */
export function getModelSizeParams(model: string, size: string): Record<string, string> {
  if (RESOLUTION_TIER_MODELS.has(model)) {
    // Format: "2k:4:3" -> { resolution: "2k", aspect_ratio: "4:3" }
    const colonIdx = size.indexOf(":");
    if (colonIdx > 0) {
      const resolution = size.slice(0, colonIdx);
      const aspect_ratio = size.slice(colonIdx + 1);
      return { resolution, aspect_ratio };
    }
    return { resolution: "2k", aspect_ratio: "1:1" };
  }
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
  "PALETTE HEX",
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
 * Build the palette context string for the Flux 2 reformatter template.
 * Uses the primary/secondary structure from swatchColors: [primary[], secondary[]].
 */
export function buildPaletteContext(
  hexColors: [string[], string[]],
  paletteText: string,
): string {
  const lines: string[] = [];
  const [primary, secondary] = hexColors;
  if (primary.length) lines.push(`PRIMARY COLORS (use for subjects): ${JSON.stringify(primary)}`);
  if (secondary.length) lines.push(`SECONDARY COLORS (atmosphere/shadows): ${JSON.stringify(secondary)}`);
  if (paletteText) lines.push(`PALETTE DESCRIPTION: ${paletteText}`);
  return lines.join("\n");
}

export interface DeterministicFlux2Fields {
  style: string;
  color_palette_text: string;
  color_palette_hex: [string[], string[]];
}

/**
 * Extract deterministic JSON fields from parsed prompt sections.
 * These fields are mapped directly — no LLM involvement.
 */
export function extractDeterministicFlux2Fields(
  sections: ParsedPromptSections,
): DeterministicFlux2Fields {
  const rawStyle = sections["STYLE"] || "";
  const { cleaned: styleBase, exemplar } = extractArtistExemplar(rawStyle);
  let style = exemplar ? `${styleBase}, in the style of ${exemplar}` : styleBase;
  if (sections["RENDER"]) style = `${style}. ${sections["RENDER"]}`;

  // Strip duplicate "COLOR PALETTE:" prefix that buildCompositePrompt may add
  const color_palette_text = (sections["COLOR PALETTE"] || "").replace(/^COLOR PALETTE:\s*/i, "");

  // Parse hex array from PALETTE HEX section — supports [primary[], secondary[]] or flat string[]
  let color_palette_hex: [string[], string[]] = [[], []];
  const hexRaw = sections["PALETTE HEX"] || "";
  if (hexRaw) {
    try {
      const parsed = JSON.parse(hexRaw);
      if (Array.isArray(parsed)) {
        if (parsed.length === 2 && Array.isArray(parsed[0]) && Array.isArray(parsed[1])) {
          // 2D: [primary[], secondary[]]
          color_palette_hex = [parsed[0], parsed[1]];
        } else if (parsed.every((c: unknown) => typeof c === "string")) {
          // Legacy flat array — put all in primary
          color_palette_hex = [parsed, []];
        }
      }
    } catch { /* ignore parse failures */ }
  }

  return { style, color_palette_text, color_palette_hex };
}

/**
 * Extract the visual description text to send to Claude for subject/scene synthesis.
 * Includes visual description, style, setting, and composition — everything Claude
 * needs to build a rich scene description and subject list.
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
      sections["STYLE"] ? `STYLE: ${sections["STYLE"]}` : "",
      sections["WORLD"] ? `WORLD: ${sections["WORLD"]}` : "",
      sections["COMPOSITION"] ? `COMPOSITION: ${sections["COMPOSITION"]}` : "",
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
    sections["STYLE"] ? `STYLE: ${sections["STYLE"]}` : "",
    sections["SETTING"] ? `SETTING: ${sections["SETTING"]}` : "",
    sections["COMPOSITION"] ? `COMPOSITION: ${sections["COMPOSITION"]}` : "",
  ];
  const text = parts.filter(Boolean).join("\n");
  return text || sections["_preamble"] || "";
}

/**
 * Attempt to repair truncated JSON (e.g. from output token limit).
 * Closes any unterminated strings, arrays, and objects.
 * Returns null if the input doesn't look like JSON at all.
 */
function repairTruncatedJson(input: string): string | null {
  if (!input.includes("{")) return null;

  let result = input;
  // If we're inside an unterminated string, close it
  // Count unescaped quotes to determine if we're mid-string
  let inString = false;
  for (let i = 0; i < result.length; i++) {
    if (result[i] === "\\" && inString) { i++; continue; }
    if (result[i] === '"') inString = !inString;
  }
  if (inString) {
    // Truncate at last complete-looking content, close the string
    result += '"';
  }

  // Strip trailing comma
  result = result.replace(/,\s*$/, "");

  // Close open arrays and objects by counting brackets
  let openBraces = 0;
  let openBrackets = 0;
  inString = false;
  for (let i = 0; i < result.length; i++) {
    if (result[i] === "\\" && inString) { i++; continue; }
    if (result[i] === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (result[i] === "{") openBraces++;
    else if (result[i] === "}") openBraces--;
    else if (result[i] === "[") openBrackets++;
    else if (result[i] === "]") openBrackets--;
  }

  // Strip any trailing partial key like `"mood` or `"mood":` before closing
  result = result.replace(/,?\s*"[^"]*"?\s*:?\s*$/, "");

  while (openBrackets > 0) { result += "]"; openBrackets--; }
  while (openBraces > 0) { result += "}"; openBraces--; }

  return result;
}

/** Hex color pattern — matches #RRGGBB (6 hex digits). */
const HEX_COLOR_RE = /#[0-9A-Fa-f]{6}\b/;

/**
 * Ensure every subject has a direct hex color association.
 * BFL docs: "Always associate hex codes with specific objects."
 * If Claude omitted a hex tag, append one from the palette's primary colors
 * (cycling through them). Secondary colors are used once primaries are exhausted.
 */
function injectMissingHexColors(
  subjects: Array<Record<string, unknown>>,
  hexColors: [string[], string[]],
): void {
  const allColors = [...hexColors[0], ...hexColors[1]];
  if (allColors.length === 0) return;

  let colorIndex = 0;
  for (const subject of subjects) {
    const desc = typeof subject.description === "string" ? subject.description : "";
    if (!HEX_COLOR_RE.test(desc)) {
      const hex = allColors[colorIndex % allColors.length];
      subject.description = `${desc}, strictly in color ${hex}`.replace(/^, /, "");
      colorIndex++;
    }
  }
}

/**
 * Clean Claude's synthesized JSON output into a final Flux 2 prompt.
 * Only scene + subjects pass through — any style/color_palette fields Claude
 * emits are stripped. Style and color are expected to be embedded in the scene
 * and subject descriptions.
 *
 * After merge, subjects missing a hex color tag get one injected from the
 * palette's primary/secondary arrays to guarantee direct hex-object association.
 */
export function mergeFlux2JsonPrompt(
  deterministicFields: DeterministicFlux2Fields,
  claudeOutput: string
): string {
  let cleaned = claudeOutput.trim();
  // Strip code fences (```json ... ``` or ``` ... ```)
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
  // Strip trailing commas before } or ] (common LLM JSON error)
  cleaned = cleaned.replace(/,\s*([\]}])/g, "$1");
  cleaned = cleaned.trim();

  // If cleaning left non-JSON prefix/suffix, extract the outermost { ... }
  if (!cleaned.startsWith("{")) {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      cleaned = cleaned.substring(start, end + 1);
    }
  }

  let synthesized: Record<string, unknown>;
  try {
    synthesized = JSON.parse(cleaned);
  } catch {
    // Attempt truncation recovery: close unterminated strings/structures
    const repaired = repairTruncatedJson(cleaned);
    if (repaired) {
      try {
        synthesized = JSON.parse(repaired);
        console.warn("[Flux2 merge] Recovered truncated JSON");
      } catch (e2) {
        console.warn("[Flux2 merge] JSON repair also failed:", (e2 as Error).message, "\nFirst 200 chars:", cleaned.substring(0, 200));
        return JSON.stringify({
          scene: cleaned.substring(0, 300),
          subjects: [{ type: "Subject", description: cleaned.substring(0, 300), position: "centered in frame", color_match: "exact" }],
        });
      }
    } else {
      console.warn("[Flux2 merge] JSON parse failed, no recovery possible. First 200 chars:", cleaned.substring(0, 200));
      return JSON.stringify({
        scene: cleaned.substring(0, 300),
        subjects: [{ type: "Subject", description: cleaned.substring(0, 300), position: "centered in frame", color_match: "exact" }],
      });
    }
  }

  // Only scene + subjects in the final prompt — style and color information
  // is already baked into the scene description and subject color tags by the LLM.
  // Adding separate style/color_palette fields dilutes the scene signal.
  const subjects = (synthesized.subjects as Array<Record<string, unknown>>) || [
    { type: "Subject", description: cleaned, position: "centered in frame", color_match: "exact" },
  ];

  // Guarantee every subject has a direct hex-object color association.
  // Claude's template instructs this but compliance is inconsistent.
  injectMissingHexColors(subjects, deterministicFields.color_palette_hex);

  const [primary, secondary] = deterministicFields.color_palette_hex;
  const merged: Record<string, unknown> = {
    mood: "grimdark Warhammer tone, war-torn world-weary veterans, dirt and ash on feathers, nothing is clean or new",
    scene: synthesized.scene || "",
    subjects,
  };
  if (primary.length || secondary.length) {
    merged.color_palette = { primary, secondary };
  }

  return JSON.stringify(merged);
}
