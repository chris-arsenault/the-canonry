import { useEffect, useState, useMemo, useRef } from 'react';
import { useImageStore } from './store';
import type { ImageEntryMetadata, ImageSize } from './types';

/**
 * Load a single image URL on demand.
 * Returns { url, loading } — url is null while loading or if image not found.
 */
export function useImageUrl(
  imageId: string | null | undefined,
  size: ImageSize = 'thumb',
): { url: string | null; loading: boolean } {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const loadUrl = useImageStore((s) => s.loadUrl);
  const initialized = useImageStore((s) => s.initialized);

  useEffect(() => {
    if (!imageId || !initialized) {
      setUrl(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    loadUrl(imageId, size).then((result) => {
      if (!cancelled) {
        setUrl(result);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [imageId, size, loadUrl, initialized]);

  return { url, loading };
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

    loadUrls(validIds, size).then((result) => {
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

    loadMetadata(validIds).then((result) => {
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
