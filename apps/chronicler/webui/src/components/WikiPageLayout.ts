/**
 * WikiPageLayout - Layout engine utilities for wiki page rendering
 *
 * Determines optimal layout mode for chronicle sections based on
 * narrative style, content length, and image density.
 */

import type { Optional } from "@the-canonry/shared-components";
import type { WikiSection, WikiSectionImage, ImageAspect } from "../types/world.ts";
import styles from "./WikiPage.module.css";

/**
 * Layout modes for chronicle sections:
 * - 'flow': Text wraps around floated images/callouts (traditional Wikipedia style).
 *           Best for long prose with 1-2 images.
 * - 'margin': 3-column grid with images/callouts in side margins, text in center.
 *             Text flows uninterrupted. Best for short content, verse, documents.
 * - 'centered': Text centered, no floats. For verse/poetry without images.
 */
export type LayoutMode = "flow" | "margin" | "centered";

/** Narrative styles that use centered/verse layout */
const CENTERED_STYLES = new Set(["folk-song", "nursery-rhymes", "haiku-collection"]);

/** Narrative styles where floats shouldn't interrupt text */
const NO_FLOAT_STYLES = new Set([
  "wanted-notice",
  "sacred-text",
  "tavern-notices",
  "interrogation-record",
  "diplomatic-accord",
]);

/**
 * Choose layout for a narrative-style override (centered or no-float styles).
 * Returns null if no special style applies.
 */
function layoutForNarrativeStyle(
  narrativeStyleId: string,
  hasFloats: boolean,
): LayoutMode | null {
  if (CENTERED_STYLES.has(narrativeStyleId)) {
    return hasFloats ? "margin" : "centered";
  }
  if (NO_FLOAT_STYLES.has(narrativeStyleId)) {
    return hasFloats ? "margin" : "flow";
  }
  return null;
}

/**
 * Analyze a section's content to determine the optimal layout mode.
 *
 * Decision factors:
 * - Narrative style (centered/no-float styles override other logic)
 * - Word count vs float element count ratio
 * - Total float elements (images + full historian notes)
 *
 * Rules:
 * 1. Centered styles with floats -> 'margin' (images in margins, text centered)
 * 2. Centered styles without floats -> 'centered' (just centered text)
 * 3. No-float styles with floats -> 'margin'
 * 4. Short content (<150 words) with any floats -> 'margin'
 * 5. High float density (< 100 words per float element) -> 'margin'
 * 6. Otherwise -> 'flow'
 */
export function analyzeLayout(
  section: WikiSection,
  fullNoteCount: number,
  narrativeStyleId: Optional<string>,
): LayoutMode {
  const imageCount = section.images?.length ?? 0;
  // Callouts are absolutely positioned in sidenote column — they don't affect text flow.
  // Only images (which use CSS float) count for layout decisions.
  const floatCount = imageCount;

  if (narrativeStyleId) {
    const override = layoutForNarrativeStyle(narrativeStyleId, floatCount > 0);
    if (override) return override;
  }

  if (floatCount === 0) return "flow";

  const wordCount = section.content.split(/\s+/).length;

  // Short content with float elements -> margin to avoid awkward wrapping
  if (wordCount < 150) return "margin";

  // High float density -> margin to avoid float collisions
  if (wordCount / floatCount < 100) return "margin";

  return "flow";
}

/**
 * Check if image size is a float (small/medium) vs block (large/full-width)
 */
export function isFloatImage(size: WikiSectionImage["size"]): boolean {
  return size === "small" || size === "medium" || size === "large";
}

/**
 * Get the combined className for an image in flow layout mode.
 * Float images (small/medium/large): thumb frame + size width
 * Block images (full-width): centered block style
 */
export function getImageClassName(
  size: WikiSectionImage["size"],
  position: "left" | "right" = "left",
): string {
  if (isFloatImage(size)) {
    const thumbClass = position === "left" ? "image-thumb-left" : "image-thumb-right";
    let sizeClass = "image-large";
    if (size === "small") sizeClass = "image-small";
    else if (size === "medium") sizeClass = "image-medium";
    return `${thumbClass} ${sizeClass}`;
  }

  // Block images
  if (size === "full-width") return "image-full-width";
  const alignClass = position === "right" ? "image-large-right" : "image-large-left";
  return `$"image-large" ${alignClass}`;
}

/**
 * Classify aspect ratio from width/height (for runtime detection fallback)
 */
export function classifyAspect(width: number, height: number): ImageAspect {
  const ratio = width / height;
  if (ratio < 0.9) return "portrait";
  if (ratio > 1.1) return "landscape";
  return "square";
}

/**
 * Get infobox image CSS class based on aspect ratio.
 * Uses dynamic key lookup to avoid switch/fallback branching.
 */
export function getInfoboxImageClass(aspect: Optional<ImageAspect>, isMobile: boolean): string {
  const fallback = isMobile ? "infobox-image-mobile" : "infobox-image";
  if (!aspect) return fallback;
  const capitalized = aspect.charAt(0).toUpperCase() + aspect.slice(1);
  const mobileKey = `infoboxImage${capitalized}Mobile`;
  const baseKey = `infoboxImage${capitalized}`;
  const s = styles as Record<string, string>;
  if (isMobile) return s[mobileKey] ?? s[baseKey] ?? fallback;
  return s[baseKey] ?? fallback;
}
