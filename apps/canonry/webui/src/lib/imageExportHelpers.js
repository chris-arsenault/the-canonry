/**
 * Image export helpers — raw IndexedDB reads from the Illuminator DB.
 *
 * Used only by the bundle export pipeline. Display/rendering goes
 * through the shared @penguin-tales/image-store package instead.
 */

const DB_NAME = 'illuminator';

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error(`Failed to open ${DB_NAME}`));
  });
}

/**
 * Get all image metadata records for a project (no blobs).
 */
export async function getImagesByProject(projectId) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('images', 'readonly');
      const store = tx.objectStore('images');
      const index = store.index('projectId');
      const request = index.getAll(projectId);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

/**
 * Get a single image metadata record by imageId (no blob).
 */
export async function getImageMetadata(imageId) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('images', 'readonly');
      const request = tx.objectStore('images').get(imageId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

/**
 * Get the raw blob for an image by imageId.
 */
export async function getImageBlob(imageId) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('imageBlobs', 'readonly');
      const request = tx.objectStore('imageBlobs').get(imageId);
      request.onsuccess = () => resolve(request.result?.blob || null);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}
