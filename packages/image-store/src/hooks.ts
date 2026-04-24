import { useEffect, useState, useMemo, useRef } from 'react';
import { useImageStore } from './store';
import type { ImageEntryMetadata, ImageSize, AlternateGroup } from './types';

export interface UseImageUrlResult {
  url: string | null;
  loading: boolean;
  error: string | null;
  metadata: ImageEntryMetadata | null;
}

/**
 * Load a single image URL on demand.
 * Returns { url, loading, error, metadata }.
 */
export function useImageUrl(
  imageId: string | null | undefined,
  size: ImageSize = 'thumb',
): UseImageUrlResult {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<ImageEntryMetadata | null>(null);
  const loadUrl = useImageStore((s) => s.loadUrl);
  const loadMetadata = useImageStore((s) => s.loadMetadata);
  const initialized = useImageStore((s) => s.initialized);

  useEffect(() => {
    if (!imageId || !initialized) {
      setUrl(null);
      setLoading(false);
      setError(null);
      setMetadata(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      loadUrl(imageId, size),
      loadMetadata([imageId]),
    ])
      .then(([result, metaMap]) => {
        if (cancelled) return;
        if (result) {
          setUrl(result);
          setMetadata(metaMap.get(imageId) ?? null);
        } else {
          setError('Image not found');
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load image');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [imageId, size, loadUrl, loadMetadata, initialized]);

  return { url, loading, error, metadata };
}

/**
 * Load multiple image URLs in batch.
 * Returns { urls: Map<imageId, url>, loading }.
 */
export function useImageUrls(
  imageIds: (string | null | undefined)[],
  size: ImageSize = 'thumb',
): { urls: Map<string, string>; loading: boolean } {
  const [urls, setUrls] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const loadUrls = useImageStore((s) => s.loadUrls);
  const initialized = useImageStore((s) => s.initialized);

  const validIds = useMemo(
    () => imageIds.filter((id): id is string => Boolean(id)),
    [imageIds],
  );
  const idsKey = validIds.join(',');

  useEffect(() => {
    if (validIds.length === 0 || !initialized) {
      setUrls(new Map());
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void loadUrls(validIds, size).then((result) => {
      if (!cancelled) {
        setUrls(result);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [idsKey, size, loadUrls, initialized]);

  return { urls, loading };
}

/**
 * Load metadata (dimensions, entity info) for a set of image IDs.
 * Metadata is lightweight and cached in the store.
 */
export function useImageMetadata(
  imageIds: (string | null | undefined)[],
): Map<string, ImageEntryMetadata> {
  const [metadata, setMetadata] = useState<Map<string, ImageEntryMetadata>>(
    new Map(),
  );
  const loadMetadata = useImageStore((s) => s.loadMetadata);
  const initialized = useImageStore((s) => s.initialized);

  const validIds = useMemo(
    () => imageIds.filter((id): id is string => Boolean(id)),
    [imageIds],
  );
  const idsKey = validIds.join(',');

  // Track previous idsKey to avoid re-fetching same data
  const prevIdsKeyRef = useRef('');

  useEffect(() => {
    if (validIds.length === 0 || !initialized) {
      setMetadata(new Map());
      return;
    }

    // Skip if IDs haven't changed
    if (idsKey === prevIdsKeyRef.current) return;
    prevIdsKeyRef.current = idsKey;

    let cancelled = false;

    void loadMetadata(validIds).then((result) => {
      if (!cancelled) {
        setMetadata(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [idsKey, loadMetadata, initialized]);

  return metadata;
}

export interface UseImageAlternatesResult {
  group: AlternateGroup | null;
  hasAlternates: boolean;
  count: number;
}

/**
 * Load alternate versions of an image (other generations at the same logical slot).
 * Returns { group, hasAlternates, count }.
 */
export function useImageAlternates(
  imageId: string | null | undefined,
): UseImageAlternatesResult {
  const [group, setGroup] = useState<AlternateGroup | null>(null);
  const loadAlternates = useImageStore((s) => s.loadAlternates);
  const initialized = useImageStore((s) => s.initialized);

  useEffect(() => {
    if (!imageId || !initialized) {
      setGroup(null);
      return;
    }

    let cancelled = false;
    void loadAlternates(imageId).then((result) => {
      if (!cancelled) setGroup(result);
    });

    return () => { cancelled = true; };
  }, [imageId, loadAlternates, initialized]);

  return {
    group,
    hasAlternates: group != null && group.versions.length > 1,
    count: group?.versions.length ?? 0,
  };
}
