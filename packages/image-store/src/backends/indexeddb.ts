import type { ImageBackend, ImageEntryMetadata, ImageSize } from '../types';

const DB_NAME = 'illuminator';
const IMAGES_STORE = 'images';
const BLOBS_STORE = 'imageBlobs';

/**
 * Open the illuminator IndexedDB without specifying a version.
 * This opens it at whatever version it's currently at, avoiding
 * any upgrade triggers or conflicts with Illuminator's Dexie instance.
 */
function openDb(onVersionChange?: () => void): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);
    request.onsuccess = () => {
      const db = request.result;

      // Close this connection when another context (e.g. Dexie in Illuminator)
      // needs to upgrade the schema. Without this, cached connections block
      // schema upgrades indefinitely in same-page MFE architectures.
      db.onversionchange = () => {
        db.close();
        onVersionChange?.();
      };

      resolve(db);
    };
    request.onerror = () => reject(new Error(`Failed to open ${DB_NAME}: ${request.error?.message}`));
  });
}

/**
 * Read a single record from an IDB object store by key.
 */
interface BlobRecord {
  blob: Blob;
}

interface ImageRecord {
  imageId: string;
  entityId?: string;
  entityName?: string;
  entityKind?: string;
  width?: number;
  height?: number;
  aspect?: 'portrait' | 'landscape' | 'square';
}

function getRecord<T>(db: IDBDatabase, storeName: string, key: string): Promise<T | null> {
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(storeName)) {
      resolve(null);
      return;
    }
    const tx = db.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).get(key);
    request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
    request.onerror = () => reject(new Error(request.error?.message ?? 'IDB get failed'));
  });
}

/**
 * Read multiple records from an IDB object store by keys.
 * Returns results in the same order as keys (null for missing).
 */
function getRecords<T>(db: IDBDatabase, storeName: string, keys: string[]): Promise<(T | null)[]> {
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(storeName)) {
      resolve(keys.map(() => null));
      return;
    }
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const results: (T | null)[] = new Array<T | null>(keys.length).fill(null);
    let pending = keys.length;

    if (pending === 0) {
      resolve(results);
      return;
    }

    for (let i = 0; i < keys.length; i++) {
      const request = store.get(keys[i]);
      request.onsuccess = () => {
        results[i] = (request.result as T | undefined) ?? null;
        if (--pending === 0) resolve(results);
      };
      request.onerror = () => {
        if (--pending === 0) resolve(results);
      };
    }

    tx.onerror = () => reject(new Error(tx.error?.message ?? 'IDB transaction failed'));
  });
}

/**
 * IndexedDB backend — reads from Illuminator's Dexie database using the
 * raw IndexedDB API to avoid version conflicts.
 *
 * - Blobs come from the `imageBlobs` object store
 * - Metadata comes from the `images` object store
 * - Object URLs are tracked for cleanup
 */
export class IndexedDBBackend implements ImageBackend {
  private db: IDBDatabase | null = null;
  private objectUrls = new Set<string>();

  async initialize(): Promise<void> {
    if (this.db) return;
    this.db = await openDb(() => {
      // Connection was closed due to a schema upgrade in another context.
      // Clear the cached reference so the next operation reconnects.
      this.db = null;
    });
  }

  async getImageUrl(imageId: string, _size?: ImageSize): Promise<string | null> {
    if (!this.db) await this.initialize();

    const record = await getRecord<BlobRecord>(this.db!, BLOBS_STORE, imageId);
    if (!record?.blob) return null;

    const url = URL.createObjectURL(record.blob);
    this.objectUrls.add(url);
    return url;
  }

  async getImageUrls(imageIds: string[], _size?: ImageSize): Promise<Map<string, string>> {
    if (!this.db) await this.initialize();

    const records = await getRecords<BlobRecord>(this.db!, BLOBS_STORE, imageIds);
    const result = new Map<string, string>();

    for (let i = 0; i < imageIds.length; i++) {
      const record = records[i];
      if (record?.blob) {
        const url = URL.createObjectURL(record.blob);
        this.objectUrls.add(url);
        result.set(imageIds[i], url);
      }
    }

    return result;
  }

  async getMetadata(imageIds: string[]): Promise<Map<string, ImageEntryMetadata>> {
    if (!this.db) await this.initialize();

    const records = await getRecords<ImageRecord>(this.db!, IMAGES_STORE, imageIds);
    const result = new Map<string, ImageEntryMetadata>();

    for (let i = 0; i < imageIds.length; i++) {
      const record = records[i];
      if (record) {
        result.set(imageIds[i], {
          imageId: record.imageId,
          entityId: record.entityId,
          entityName: record.entityName,
          entityKind: record.entityKind,
          width: record.width,
          height: record.height,
          aspect: record.aspect,
        });
      }
    }

    return result;
  }

  cleanup(): void {
    for (const url of this.objectUrls) {
      URL.revokeObjectURL(url);
    }
    this.objectUrls.clear();

    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
