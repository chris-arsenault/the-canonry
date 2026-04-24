import type { ImageBackend, ImageEntryMetadata, ImageSize, AlternateGroup } from '../types';

/**
 * Shape of image data from a viewer bundle (wire format from JSON).
 * Paths are already resolved to absolute CDN URLs by normalizeBundle().
 * Fields use `| null` because the JSON may omit them.
 */
export interface BundleImageResult {
  imageId: string;
  entityId: string | null;
  entityName: string | null;
  entityKind: string | null;
  localPath: string | null;
  thumbPath: string | null;
  fullPath: string | null;
  width: number | null;
  height: number | null;
  aspect: 'portrait' | 'landscape' | 'square' | null;
}

export interface BundleImageData {
  results: BundleImageResult[];
}

/**
 * Legacy format: flat { imageId → url } map.
 */
export type LegacyImageMap = Record<string, string>;

/**
 * Alternate image versions embedded in the bundle (S3 mode only).
 * Keyed by the active/referenced imageId.
 */
export type BundleAlternatesData = Record<string, AlternateGroup>;

function bundleResultToMetadata(img: BundleImageResult): ImageEntryMetadata {
  return {
    imageId: img.imageId,
    entity: img.entityId && img.entityName && img.entityKind
      ? { id: img.entityId, name: img.entityName, kind: img.entityKind, culture: '' }
      : null,
    dimensions: img.width != null && img.height != null && img.aspect
      ? { width: img.width, height: img.height, aspect: img.aspect }
      : null,
    generation: null,
    size: null,
  };
}

/**
 * CDN backend — resolves image URLs from a pre-loaded viewer bundle.
 * All URLs are known at initialization time, so lookups are synchronous.
 * No object URLs to revoke (CDN URLs are plain HTTP).
 */
export class CDNBackend implements ImageBackend {
  private urlMap = new Map<string, { thumb: string; full: string }>();
  private metadataMap = new Map<string, ImageEntryMetadata>();
  private alternatesMap = new Map<string, AlternateGroup>();
  private bundleImageData: BundleImageData | null;
  private legacyImages: LegacyImageMap | null;
  private bundleAlternates: BundleAlternatesData | null;

  constructor(
    bundleImageData: BundleImageData | null,
    legacyImages?: LegacyImageMap | null,
    bundleAlternates?: BundleAlternatesData | null,
  ) {
    this.bundleImageData = bundleImageData;
    this.legacyImages = legacyImages ?? null;
    this.bundleAlternates = bundleAlternates ?? null;
  }

  initialize(): Promise<void> {
    this.loadLegacyImages();
    this.loadBundleImages();
    this.loadAlternates();
    return Promise.resolve();
  }

  private loadLegacyImages(): void {
    if (!this.legacyImages) return;
    for (const [imageId, url] of Object.entries(this.legacyImages)) {
      if (url) this.urlMap.set(imageId, { thumb: url, full: url });
    }
  }

  private loadBundleImages(): void {
    if (!this.bundleImageData?.results) return;
    for (const img of this.bundleImageData.results) {
      if (!img.imageId) continue;
      this.indexBundleImage(img);
    }
  }

  private indexBundleImage(img: BundleImageResult): void {
    const thumb = img.thumbPath || img.localPath || '';
    const full = img.fullPath || img.localPath || '';
    if (thumb || full) {
      this.urlMap.set(img.imageId, { thumb, full });
    }
    this.metadataMap.set(img.imageId, bundleResultToMetadata(img));
  }

  private loadAlternates(): void {
    if (!this.bundleAlternates) return;
    for (const [activeId, group] of Object.entries(this.bundleAlternates)) {
      if (group.versions.length > 1) {
        this.alternatesMap.set(activeId, group);
      }
    }
  }

  getImageUrl(imageId: string, size: ImageSize = 'thumb'): Promise<string | null> {
    const entry = this.urlMap.get(imageId);
    if (!entry) return Promise.resolve(null);
    return Promise.resolve(size === 'full' ? entry.full : entry.thumb);
  }

  getImageUrls(imageIds: string[], size: ImageSize = 'thumb'): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    for (const id of imageIds) {
      const entry = this.urlMap.get(id);
      if (entry) {
        result.set(id, size === 'full' ? entry.full : entry.thumb);
      }
    }
    return Promise.resolve(result);
  }

  getMetadata(imageIds: string[]): Promise<Map<string, ImageEntryMetadata>> {
    const result = new Map<string, ImageEntryMetadata>();
    for (const id of imageIds) {
      const meta = this.metadataMap.get(id);
      if (meta) result.set(id, meta);
    }
    return Promise.resolve(result);
  }

  getAlternates(imageId: string): Promise<AlternateGroup | null> {
    return Promise.resolve(this.alternatesMap.get(imageId) ?? null);
  }

  cleanup(): void {
    this.urlMap.clear();
    this.metadataMap.clear();
    this.alternatesMap.clear();
  }
}
