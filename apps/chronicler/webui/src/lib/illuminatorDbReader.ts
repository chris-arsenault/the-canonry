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

const DB_NAME = 'illuminator';

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
