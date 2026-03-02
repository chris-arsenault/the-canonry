import { create } from 'zustand';
import type { ImageBackend, ImageEntryMetadata, ImageSize, CachedUrl } from './types';

export interface ImageStoreState {
  backend: ImageBackend | null;
  initialized: boolean;
  urlCache: Map<string, CachedUrl>;
  metadataCache: Map<string, ImageEntryMetadata>;

  /** Set the backend and initialize it. Cleans up previous backend. */
  configure: (backend: ImageBackend) => Promise<void>;

  /** Load a single image URL (cache-first). */
  loadUrl: (imageId: string, size?: ImageSize) => Promise<string | null>;

  /** Load multiple image URLs in batch (cache-first for each). */
  loadUrls: (imageIds: string[], size?: ImageSize) => Promise<Map<string, string>>;

  /** Load metadata for a set of image IDs (cache-first). */
  loadMetadata: (imageIds: string[]) => Promise<Map<string, ImageEntryMetadata>>;

  /** Revoke all object URLs and release backend resources. */
  cleanup: () => void;
}

function cacheKey(imageId: string, size?: ImageSize): string {
  return size === 'full' ? `${imageId}:full` : `${imageId}:thumb`;
}

function revokeAllUrls(urlCache: Map<string, CachedUrl>): void {
  for (const cached of urlCache.values()) {
    if (cached.needsRevoke) URL.revokeObjectURL(cached.url);
  }
}

async function fetchUrls(
  backend: ImageBackend,
  imageIds: string[],
  urlCache: Map<string, CachedUrl>,
  size?: ImageSize
): Promise<{ result: Map<string, string>; newCache: Map<string, CachedUrl> }> {
  const result = new Map<string, string>();
  const uncached: string[] = [];

  for (const id of imageIds) {
    const key = cacheKey(id, size);
    const cached = urlCache.get(key);
    if (cached) {
      result.set(id, cached.url);
    } else {
      uncached.push(id);
    }
  }

  const newCache = new Map(urlCache);
  if (uncached.length > 0) {
    const urls = await backend.getImageUrls(uncached, size);
    for (const [id, url] of urls) {
      const key = cacheKey(id, size);
      newCache.set(key, { url, needsRevoke: true });
      result.set(id, url);
    }
  }

  return { result, newCache };
}

async function fetchMetadata(
  backend: ImageBackend,
  imageIds: string[],
  metadataCache: Map<string, ImageEntryMetadata>
): Promise<{ result: Map<string, ImageEntryMetadata>; newCache: Map<string, ImageEntryMetadata> }> {
  const result = new Map<string, ImageEntryMetadata>();
  const uncached: string[] = [];

  for (const id of imageIds) {
    const cached = metadataCache.get(id);
    if (cached) {
      result.set(id, cached);
    } else {
      uncached.push(id);
    }
  }

  const newCache = new Map(metadataCache);
  if (uncached.length > 0) {
    const metadata = await backend.getMetadata(uncached);
    for (const [id, meta] of metadata) {
      newCache.set(id, meta);
      result.set(id, meta);
    }
  }

  return { result, newCache };
}

export const useImageStore = create<ImageStoreState>((set, get) => ({
  backend: null,
  initialized: false,
  urlCache: new Map(),
  metadataCache: new Map(),

  configure: async (backend: ImageBackend) => {
    const prev = get().backend;
    if (prev) {
      revokeAllUrls(get().urlCache);
      prev.cleanup();
    }
    set({ backend, initialized: false, urlCache: new Map(), metadataCache: new Map() });
    await backend.initialize();
    set({ initialized: true });
  },

  loadUrl: async (imageId: string, size?: ImageSize) => {
    const { backend, urlCache } = get();
    if (!backend) return null;
    const key = cacheKey(imageId, size);
    const cached = urlCache.get(key);
    if (cached) return cached.url;
    const url = await backend.getImageUrl(imageId, size);
    if (url) {
      const newCache = new Map(get().urlCache);
      newCache.set(key, { url, needsRevoke: true });
      set({ urlCache: newCache });
    }
    return url;
  },

  loadUrls: async (imageIds: string[], size?: ImageSize) => {
    const { backend, urlCache } = get();
    if (!backend || imageIds.length === 0) return new Map();
    const { result, newCache } = await fetchUrls(backend, imageIds, urlCache, size);
    set({ urlCache: newCache });
    return result;
  },

  loadMetadata: async (imageIds: string[]) => {
    const { backend, metadataCache } = get();
    if (!backend || imageIds.length === 0) return new Map();
    const { result, newCache } = await fetchMetadata(backend, imageIds, metadataCache);
    set({ metadataCache: newCache });
    return result;
  },

  cleanup: () => {
    const { backend, urlCache } = get();
    revokeAllUrls(urlCache);
    if (backend) backend.cleanup();
    set({ backend: null, initialized: false, urlCache: new Map(), metadataCache: new Map() });
  },
}));
