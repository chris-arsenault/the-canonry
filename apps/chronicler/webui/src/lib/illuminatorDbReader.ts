/**
 * Read-only access to the Illuminator Dexie database.
 *
 * Opens the `illuminator` IndexedDB without specifying a version,
 * which uses the current version without triggering schema upgrades.
 * Dexie owns the schema — this module only reads.
 *
 * IMPORTANT: Connections are NOT cached. Each call opens a fresh
 * connection that the caller must close (or let GC close) after use.
 * Caching was removed because long-lived connections block Dexie
 * schema upgrades in the Illuminator MFE (same-page MFE architecture).
 */

import type { PageLayoutOverride } from '../types/world';

const DB_NAME = 'illuminator';
const PAGE_LAYOUTS_STORE = 'pageLayouts';

export function openIlluminatorDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);

    request.onsuccess = () => {
      const db = request.result;

      // If another connection triggers a version upgrade while we're
      // still open, close immediately so we don't block it.
      db.onversionchange = () => {
        db.close();
      };

      resolve(db);
    };
    request.onerror = () => {
      reject(request.error || new Error('Failed to open illuminator DB'));
    };
  });
}

/**
 * Read all page layout overrides for a simulation run.
 * Returns a Map keyed by pageId for fast lookup.
 * Gracefully returns empty map if the store doesn't exist yet (pre-v10 DB).
 */
export async function readPageLayouts(
  simulationRunId: string
): Promise<Map<string, PageLayoutOverride>> {
  const map = new Map<string, PageLayoutOverride>();
  if (!simulationRunId) return map;

  try {
    const db = await openIlluminatorDb();
    try {
      // Guard: store may not exist if Illuminator hasn't upgraded to v10 yet
      if (!db.objectStoreNames.contains(PAGE_LAYOUTS_STORE)) {
        return map;
      }

      return await new Promise((resolve, reject) => {
        const tx = db.transaction(PAGE_LAYOUTS_STORE, 'readonly');
        const store = tx.objectStore(PAGE_LAYOUTS_STORE);
        const index = store.index('simulationRunId');
        const request = index.getAll(IDBKeyRange.only(simulationRunId));

        request.onsuccess = () => {
          const records = request.result as PageLayoutOverride[];
          for (const r of records) {
            map.set(r.pageId, r);
          }
          resolve(map);
        };
        request.onerror = () => reject(request.error || new Error('Failed to read page layouts'));
      });
    } finally {
      db.close();
    }
  } catch (err) {
    console.error('[illuminatorDbReader] Failed to load page layouts:', err);
    return map;
  }
}
