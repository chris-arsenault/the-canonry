/**
 * useImageUrl - Hook to load images from Dexie storage
 *
 * Takes an imageId and returns an object URL that can be used in img tags.
 * Handles loading state and cleanup of object URLs.
 */

import { useState, useEffect, useRef } from 'react';
import { db } from '../lib/db/illuminatorDb';

interface UseImageUrlResult {
  url: string | null;
  loading: boolean;
  error: string | null;
  metadata: {
    entityId?: string;
    entityName?: string;
    entityKind?: string;
    entityCulture?: string;
    originalPrompt?: string;
    finalPrompt?: string;
    generatedAt?: number;
    model?: string;
    revisedPrompt?: string;
    size?: number;
  } | null;
}

/**
 * Load an image from local storage by imageId
 * Returns an object URL that can be used in img src
 */
export function useImageUrl(imageId: string | null | undefined): UseImageUrlResult {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<UseImageUrlResult['metadata']>(null);

  // Track current URL for cleanup
  const currentUrlRef = useRef<string | null>(null);

  useEffect(() => {
    // Cleanup previous URL
    if (currentUrlRef.current) {
      URL.revokeObjectURL(currentUrlRef.current);
      currentUrlRef.current = null;
    }

    // Reset state
    setUrl(null);
    setError(null);
    setMetadata(null);

    if (!imageId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    Promise.all([
      db.images.get(imageId),
      db.imageBlobs.get(imageId),
    ])
      .then(([record, blobRecord]) => {
        if (record && blobRecord?.blob) {
          const objectUrl = URL.createObjectURL(blobRecord.blob);
          setUrl(objectUrl);
          currentUrlRef.current = objectUrl;
          setMetadata({
            entityId: record.entityId,
            entityName: record.entityName,
            entityKind: record.entityKind,
            entityCulture: record.entityCulture,
            originalPrompt: record.originalPrompt,
            finalPrompt: record.finalPrompt,
            generatedAt: record.generatedAt,
            model: record.model,
            revisedPrompt: record.revisedPrompt,
            size: record.size,
          });
        } else {
          setError('Image not found in storage');
        }
      })
      .catch((err) => {
        setError(err.message || 'Failed to load image');
      })
      .finally(() => {
        setLoading(false);
      });

    // Cleanup on unmount or imageId change
    return () => {
      if (currentUrlRef.current) {
        URL.revokeObjectURL(currentUrlRef.current);
        currentUrlRef.current = null;
      }
    };
  }, [imageId]);

  return { url, loading, error, metadata };
}

/**
 * Load multiple images - useful for gallery views
 */
export function useImageUrls(imageIds: (string | null | undefined)[]): Map<string, UseImageUrlResult> {
  const [results, setResults] = useState<Map<string, UseImageUrlResult>>(new Map());
  const urlsRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    // Cleanup old URLs
    for (const [, oldUrl] of urlsRef.current) {
      URL.revokeObjectURL(oldUrl);
    }
    urlsRef.current.clear();

    const validIds = imageIds.filter((id): id is string => Boolean(id));

    if (validIds.length === 0) {
      setResults(new Map());
      return;
    }

    // Initialize loading state for all
    const initialResults = new Map<string, UseImageUrlResult>();
    for (const id of validIds) {
      initialResults.set(id, { url: null, loading: true, error: null, metadata: null });
    }
    setResults(initialResults);

    // Load metadata and blobs in parallel from split tables
    Promise.all([
      db.images.bulkGet(validIds),
      db.imageBlobs.bulkGet(validIds),
    ])
      .then(([metadataRecords, blobRecords]) => {
        const newResults = new Map<string, UseImageUrlResult>();

        for (let i = 0; i < validIds.length; i++) {
          const id = validIds[i];
          const record = metadataRecords[i];
          const blobRecord = blobRecords[i];

          if (record && blobRecord?.blob) {
            const objectUrl = URL.createObjectURL(blobRecord.blob);
            urlsRef.current.set(id, objectUrl);
            newResults.set(id, {
              url: objectUrl,
              loading: false,
              error: null,
              metadata: {
                entityId: record.entityId,
                entityName: record.entityName,
                entityKind: record.entityKind,
                entityCulture: record.entityCulture,
                originalPrompt: record.originalPrompt,
                finalPrompt: record.finalPrompt,
                generatedAt: record.generatedAt,
                model: record.model,
                revisedPrompt: record.revisedPrompt,
                size: record.size,
              },
            });
          } else {
            newResults.set(id, {
              url: null,
              loading: false,
              error: 'Image not found',
              metadata: null,
            });
          }
        }

        setResults(newResults);
      })
      .catch(() => {
        // Fallback: mark all as errored
        const errorResults = new Map<string, UseImageUrlResult>();
        for (const id of validIds) {
          errorResults.set(id, { url: null, loading: false, error: 'Failed to load', metadata: null });
        }
        setResults(errorResults);
      });

    // Cleanup on unmount
    return () => {
      for (const [, oldUrl] of urlsRef.current) {
        URL.revokeObjectURL(oldUrl);
      }
      urlsRef.current.clear();
    };
  }, [imageIds.join(',')]); // Re-run when the list of IDs changes

  return results;
}
