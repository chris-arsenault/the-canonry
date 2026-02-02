export type ImageSize = 'thumb' | 'full';

/**
 * Metadata for a single image — lightweight, no blob data.
 * Used for layout decisions (aspect ratio) and entity identification.
 */
export interface ImageEntryMetadata {
  imageId: string;
  entityId?: string;
  entityName?: string;
  entityKind?: string;
  width?: number;
  height?: number;
  aspect?: 'portrait' | 'landscape' | 'square';
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
