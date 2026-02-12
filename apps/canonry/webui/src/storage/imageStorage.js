/**
 * Image Storage - Import viewer bundle image references into the Illuminator Dexie DB
 *
 * Writes metadata-only records to the `images` store via raw IndexedDB.
 * Does NOT touch blobs.
 */

import { openIlluminatorDb } from '../lib/illuminatorDbReader';

const IMAGES_STORE_NAME = 'images';

const MIME_BY_EXTENSION = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
};

function normalizeSourcePath(value) {
  if (!value || typeof value !== 'string') return null;
  const cleaned = value.split('?')[0].split('#')[0];
  return cleaned || null;
}

function inferMimeType(path, fallback) {
  if (fallback) return fallback;
  if (!path || typeof path !== 'string') return 'application/octet-stream';
  const match = /\.([a-zA-Z0-9]+)$/.exec(path);
  if (!match) return 'application/octet-stream';
  const ext = match[1].toLowerCase();
  return MIME_BY_EXTENSION[ext] || 'application/octet-stream';
}

export async function importBundleImageReferences({
  projectId,
  imageData,
  images,
} = {}) {
  if (!projectId) return { imported: 0, skipped: 0 };
  const results = Array.isArray(imageData?.results) ? imageData.results : [];
  if (results.length === 0) return { imported: 0, skipped: 0 };

  const db = await openIlluminatorDb();
  let imported = 0;
  let overwritten = 0;
  let skipped = 0;

  try {
    if (!db.objectStoreNames.contains(IMAGES_STORE_NAME)) {
      throw new Error('Illuminator images store is unavailable.');
    }

    const now = Date.now();

    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IMAGES_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IMAGES_STORE_NAME);

      for (const entry of results) {
        const imageId = entry?.imageId;
        if (!imageId) {
          skipped += 1;
          continue;
        }

        const rawPath = (images && images[imageId]) || entry.localPath;
        const sourcePath = normalizeSourcePath(rawPath);
        const mimeType = inferMimeType(sourcePath);
        const incomingEntityId = entry.entityId || entry.chronicleId || null;

        const getReq = store.get(imageId);
        getReq.onsuccess = () => {
          const existing = getReq.result || {};
          if (getReq.result) overwritten += 1;
          const merged = {
            ...existing,
            imageId,
            projectId,
            entityId: incomingEntityId ?? existing.entityId ?? 'chronicle',
            entityName: entry.entityName ?? existing.entityName,
            entityKind: entry.entityKind ?? existing.entityKind,
            entityCulture: entry.entityCulture ?? existing.entityCulture,
            originalPrompt: entry.prompt ?? existing.originalPrompt,
            finalPrompt: entry.prompt ?? existing.finalPrompt,
            imageType: entry.imageType ?? existing.imageType,
            chronicleId: entry.chronicleId ?? existing.chronicleId,
            imageRefId: entry.imageRefId ?? existing.imageRefId,
            sceneDescription: entry.sceneDescription ?? existing.sceneDescription,
            generatedAt: existing.generatedAt ?? now,
            model: existing.model || 'imported',
            mimeType: existing.mimeType || mimeType,
            size: typeof existing.size === 'number' ? existing.size : 0,
            savedAt: existing.savedAt ?? now,
          };

          store.put(merged);
          imported += 1;
        };
        getReq.onerror = () => {
          skipped += 1;
        };
      }

      tx.oncomplete = () => resolve({ imported, overwritten, skipped });
      tx.onerror = () => reject(tx.error || new Error('Failed to import image references'));
    });
  } finally {
    db.close();
  }
}

export async function getImageCountForProject(projectId) {
  if (!projectId) return 0;
  const db = await openIlluminatorDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IMAGES_STORE_NAME, 'readonly');
      const store = tx.objectStore(IMAGES_STORE_NAME);
      const index = store.index('projectId');
      const request = index.count(projectId);
      request.onsuccess = () => resolve(request.result || 0);
      request.onerror = () => reject(request.error || new Error('Failed to count images'));
    });
  } finally {
    db.close();
  }
}
