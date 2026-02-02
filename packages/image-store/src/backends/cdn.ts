import type { ImageBackend, ImageEntryMetadata, ImageSize } from '../types';

/**
 * Shape of image data from a viewer bundle.
 * Paths are already resolved to absolute CDN URLs by normalizeBundle().
 */
export interface BundleImageResult {
  imageId: string;
  entityId?: string;
  entityName?: string;
  entityKind?: string;
  localPath?: string;
  thumbPath?: string;
  fullPath?: string;
  width?: number;
  height?: number;
  aspect?: 'portrait' | 'landscape' | 'square';
}

export interface BundleImageData {
  results: BundleImageResult[];
}

/**
 * Legacy format: flat { imageId → url } map.
 */
export type LegacyImageMap = Record<string, string>;

/**
 * CDN backend — resolves image URLs from a pre-loaded viewer bundle.
 * All URLs are known at initialization time, so lookups are synchronous.
 * No object URLs to revoke (CDN URLs are plain HTTP).
 */
export class CDNBackend implements ImageBackend {
  private urlMap = new Map<string, { thumb: string; full: string }>();
  private metadataMap = new Map<string, ImageEntryMetadata>();
  private bundleImageData: BundleImageData | null;
  private legacyImages: LegacyImageMap | null;

  constructor(
    bundleImageData: BundleImageData | null,
    legacyImages?: LegacyImageMap | null,
  ) {
    this.bundleImageData = bundleImageData;
    this.legacyImages = legacyImages ?? null;
  }

  async initialize(): Promise<void> {
    // Legacy format: flat { imageId → url } map
    if (this.legacyImages) {
      for (const [imageId, url] of Object.entries(this.legacyImages)) {
        if (url) this.urlMap.set(imageId, { thumb: url, full: url });
      }
    }

    // Modern format: rich metadata with optional optimized paths
    if (this.bundleImageData?.results) {
      for (const img of this.bundleImageData.results) {
        if (!img.imageId) continue;

        const thumb = img.thumbPath || img.localPath || '';
        const full = img.fullPath || img.localPath || '';

        if (thumb || full) {
          this.urlMap.set(img.imageId, { thumb, full });
        }

        this.metadataMap.set(img.imageId, {
          imageId: img.imageId,
          entityId: img.entityId,
          entityName: img.entityName,
          entityKind: img.entityKind,
          width: img.width,
          height: img.height,
          aspect: img.aspect,
        });
      }
    }
  }

  async getImageUrl(imageId: string, size: ImageSize = 'thumb'): Promise<string | null> {
    const entry = this.urlMap.get(imageId);
    if (!entry) return null;
    return size === 'full' ? entry.full : entry.thumb;
  }

  async getImageUrls(imageIds: string[], size: ImageSize = 'thumb'): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    for (const id of imageIds) {
      const entry = this.urlMap.get(id);
      if (entry) {
        result.set(id, size === 'full' ? entry.full : entry.thumb);
      }
    }
    return result;
  }

  async getMetadata(imageIds: string[]): Promise<Map<string, ImageEntryMetadata>> {
    const result = new Map<string, ImageEntryMetadata>();
    for (const id of imageIds) {
      const meta = this.metadataMap.get(id);
      if (meta) result.set(id, meta);
    }
    return result;
  }

  cleanup(): void {
    this.urlMap.clear();
    this.metadataMap.clear();
  }
}
