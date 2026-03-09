/**
 * Image Type Definitions
 *
 * Extracted from workerStorage.ts — pure type declarations for image records,
 * metadata, search options, and export structures.
 */

/** Type of image. Legacy data may contain "chronicle" which is reclassified during backfill. */
export type ImageType = "entity" | "scene" | "cover" | "other";

/** Returns true for image types associated with chronicles (scene, cover, or legacy "chronicle"). */
export function isChronicleImage(imageType: string | undefined): boolean {
  return imageType === "scene" || imageType === "cover" || imageType === "chronicle";
}

/** Image aspect ratio classification */
export type ImageAspect = "portrait" | "landscape" | "square";

export interface ImageMetadata {
  entityId: string;
  projectId: string;
  entityName?: string;
  entityKind?: string;
  entityCulture?: string;
  /** The original prompt built from template (before Claude refinement) */
  originalPrompt?: string;
  /** The full prompt sent to Claude for formatting (template + globalImageRules + original prompt) */
  formattingPrompt?: string;
  /** The final prompt sent to image model (after Claude refinement, or same as original if no refinement) */
  finalPrompt?: string;
  generatedAt: number;
  model: string;
  /** The revised prompt returned by the model (DALL-E) */
  revisedPrompt?: string;
  /** Requested size string (e.g. "1024x1024") from generation settings */
  requestedSize?: string;
  estimatedCost?: number;
  actualCost?: number;
  inputTokens?: number;
  outputTokens?: number;

  // Image dimensions (added for aspect-aware display)
  /** Image width in pixels */
  width?: number;
  /** Image height in pixels */
  height?: number;
  /** Aspect ratio classification: portrait (<0.9), square (0.9-1.1), landscape (>1.1) */
  aspect?: ImageAspect;

  // Chronicle image fields (optional, present when imageType === 'chronicle')
  /** Type of image: entity, scene, cover, or other */
  imageType?: ImageType;
  /** For chronicle images: the chronicle this belongs to */
  chronicleId?: string;
  /** For chronicle images: the image ref ID from ChronicleImageRefs */
  imageRefId?: string;
  /** For chronicle images: the scene description from the LLM */
  sceneDescription?: string;

  // Catalog metadata (deterministic at generation time, backfilled for existing images)
  /** Artistic style ID from StyleSelection at generation time */
  artisticStyleId?: string;
  /** Composition style ID from StyleSelection at generation time */
  compositionStyleId?: string;
  /** Color palette ID from StyleSelection at generation time */
  colorPaletteId?: string;
  /** Human-readable display title (deterministic) */
  title?: string;
  /** Descriptive tags (from visualTags on chronicle refs, or LLM-generated) */
  tags?: string[];
}

export interface ImageRecord extends ImageMetadata {
  imageId: string;
  blob: Blob;
  mimeType: string;
  size: number;
  savedAt: number;
}

/** Blob-only record stored in the separate imageBlobs table (v3+) */
export interface ImageBlobRecord {
  imageId: string;
  blob: Blob;
}

/**
 * Lightweight image metadata for listing (no blob data)
 */
export interface ImageListItem {
  imageId: string;
  entityId: string;
  projectId: string;
  entityName?: string;
  entityKind?: string;
  generatedAt: number;
}

/**
 * Search options for paginated image queries
 */
export interface ImageSearchOptions {
  projectId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Exported prompt data for analysis (excludes image blob)
 */
export interface ImagePromptExport {
  imageId: string;
  entityId: string;
  entityName?: string;
  entityKind?: string;
  entityCulture?: string;
  generatedAt: number;
  model: string;
  /** The original prompt built from template (before Claude refinement) */
  originalPrompt?: string;
  /** The full prompt sent to Claude for formatting (template + globalImageRules + original prompt) */
  formattingPrompt?: string;
  /** The final prompt sent to image model (after Claude refinement) */
  finalPrompt?: string;
  /** The revised prompt returned by the image model (DALL-E's interpretation) */
  revisedPrompt?: string;
  imageType?: ImageType;
  chronicleId?: string;
  sceneDescription?: string;
}
