export type ImageSize = 'thumb' | 'full';

/** Entity this image depicts — null when image is not entity-associated. */
export interface ImageEntityInfo {
  id: string;
  name: string;
  kind: string;
  culture: string;
}

/** Measured pixel dimensions — null when image hasn't been loaded/measured. */
export interface ImageDimensions {
  width: number;
  height: number;
  aspect: 'portrait' | 'landscape' | 'square';
}

/** Generation provenance — null when not captured by the generator. */
export interface ImageGenerationInfo {
  originalPrompt: string;
  finalPrompt: string;
  revisedPrompt: string;
  generatedAt: number;
  model: string;
}

/**
 * Metadata for a single image — lightweight, no blob data.
 * Used for layout decisions (aspect ratio), entity identification,
 * and generation provenance (prompt, model, etc.).
 */
export interface ImageEntryMetadata {
  imageId: string;
  entity: ImageEntityInfo | null;
  dimensions: ImageDimensions | null;
  generation: ImageGenerationInfo | null;
  size: number | null;
}

/**
 * Pluggable backend for the image store.
 * IndexedDBBackend reads from local Dexie DB.
 * CDNBackend resolves pre-known CloudFront URLs.
 */
export interface ImageBackend {
  /** Open DB connection or build internal indexes */
  initialize(): Promise<void>;

  /** Resolve a single image to a displayable URL */
  getImageUrl(imageId: string, size?: ImageSize): Promise<string | null>;

  /** Resolve multiple images in one batch (optimized for IDB transactions) */
  getImageUrls(imageIds: string[], size?: ImageSize): Promise<Map<string, string>>;

  /** Load metadata (dimensions, entity info) for a set of images */
  getMetadata(imageIds: string[]): Promise<Map<string, ImageEntryMetadata>>;

  /** Release resources (revoke object URLs, close DB connections) */
  cleanup(): void;
}

/**
 * Internal cache entry for a resolved image URL.
 */
export interface CachedUrl {
  url: string;
  /** Whether URL.revokeObjectURL() is needed on cleanup */
  needsRevoke: boolean;
}
