/**
 * Upscale Prompt Builder
 *
 * Builds style-aware guidance prompts for diffusion-based upscalers from
 * the style library metadata stored on each image record.
 *
 * Design principles:
 * - Tell the upscaler what KIND of image it's looking at (medium, palette)
 *   so it hallucinates appropriate texture, NOT what to generate.
 * - Use style name + artist exemplar for medium anchoring.
 * - Use palette promptFragment for color constraints (includes "no X" directives).
 * - Use composition name (not promptFragment — that's scene direction, not upscale).
 * - Permanent anti-slop layer prevents regression to training corpus mean.
 */

import type { StyleLibrary } from "@canonry/world-schema";
import {
  findArtisticStyle,
  findCompositionStyle,
  findColorPalette,
} from "@canonry/world-schema";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WORLD_ANCHORS = [
  "Dark, weathered, world-weary tone",
  "Emperor penguin subjects, non-human world",
  "High detail, print quality",
].join(". ");

const ANTI_SLOP_NEGATIVE = [
  "human face",
  "human hands",
  "human skin",
  "humanoid features",
  "smooth plastic skin",
  "stock photography",
  "generic AI art",
  "bright cheerful lighting",
  "clean pristine surfaces",
  "modern clean aesthetic",
  "text",
  "watermark",
  "signature",
  "blurry",
  "low quality",
].join(", ");

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface UpscalePromptPair {
  prompt: string;
  negativePrompt: string;
}

/**
 * Build a prompt pair for a diffusion-based upscaler.
 *
 * Resolves style IDs against the style library to produce medium-anchoring
 * and color-constraint cues. Falls back gracefully when the library or any
 * individual ID is absent — the WORLD_ANCHORS and ANTI_SLOP_NEGATIVE layers
 * are always present.
 */
export function buildUpscalePrompt(
  styleLibrary: StyleLibrary | null,
  artisticStyleId?: string,
  compositionStyleId?: string,
  colorPaletteId?: string,
): UpscalePromptPair {
  const promptParts: string[] = [];
  const negativeParts: string[] = [];

  // 1. Artistic style — medium anchoring via name + artist exemplar
  if (styleLibrary && artisticStyleId) {
    const style = findArtisticStyle(styleLibrary, artisticStyleId);
    if (style) {
      const exemplarSuffix = style.artistExemplar
        ? `, ${style.artistExemplar} influence`
        : "";
      promptParts.push(`${style.name}${exemplarSuffix}`);

      if (style.negativePrompt) {
        negativeParts.push(style.negativePrompt);
      }
    }
  }

  // 2. Composition style — name only (promptFragment is scene direction)
  if (styleLibrary && compositionStyleId) {
    const comp = findCompositionStyle(styleLibrary, compositionStyleId);
    if (comp) {
      promptParts.push(`${comp.name} composition`);
    }
  }

  // 3. Color palette — name + full promptFragment for color constraints
  if (styleLibrary && colorPaletteId) {
    const palette = findColorPalette(styleLibrary, colorPaletteId);
    if (palette) {
      promptParts.push(`${palette.name} palette`);
      promptParts.push(palette.promptFragment);
    }
  }

  // 4. World anchors (always present)
  promptParts.push(WORLD_ANCHORS);

  // 5. Anti-slop negative layer (always present)
  negativeParts.push(ANTI_SLOP_NEGATIVE);

  return {
    prompt: promptParts.join(". "),
    negativePrompt: negativeParts.join(", "),
  };
}
