/**
 * Legacy Database Migration
 *
 * One-time migration from 9 separate raw IndexedDB databases into the single
 * Dexie `illuminator` database. Runs at app startup before any storage access.
 *
 * Each legacy DB is migrated independently. If one fails, the others still
 * succeed. Progress is tracked in localStorage so partial migrations resume.
 * The migration is idempotent — bulkPut overwrites by primary key.
 *
 * After migration, legacy databases are deleted.
 */

import { db } from './illuminatorDb';

const LOG_PREFIX = '[LegacyMigration]';
const STORAGE_KEY = 'illuminator:legacy-migration';

interface MigrationState {
  [dbName: string]: { migratedAt: number };
}

function getState(): MigrationState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function markMigrated(dbName: string): void {
  const state = getState();
  state[dbName] = { migratedAt: Date.now() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function isAlreadyMigrated(dbName: string): boolean {
  return dbName in getState();
}

/**
 * Open a legacy raw IndexedDB database. Returns null if it doesn't exist
 * or can't be opened (e.g., never created on this browser).
 */
function openLegacyDb(name: string, version: number): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(name, version);

      request.onupgradeneeded = () => {
        // If we're triggering an upgrade, the DB didn't exist with this version.
        // Close and delete it — nothing to migrate.
        request.transaction?.abort();
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Read all records from a raw IDB object store.
 */
function readAllFromStore<T>(idb: IDBDatabase, storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    if (!idb.objectStoreNames.contains(storeName)) {
      resolve([]);
      return;
    }
    const tx = idb.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete a legacy database after successful migration.
 */
function deleteLegacyDb(name: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve(); // Non-fatal
      request.onblocked = () => resolve(); // Non-fatal
    } catch {
      resolve();
    }
  });
}

// ---------------------------------------------------------------------------
// Individual migration functions
// ---------------------------------------------------------------------------

async function migrateChronicles(): Promise<void> {
  const dbName = 'canonry-chronicles';
  if (isAlreadyMigrated(dbName)) return;

  const idb = await openLegacyDb(dbName, 1);
  if (!idb) { markMigrated(dbName); return; }

  try {
    const records = await readAllFromStore(idb, 'chronicles');
    if (records.length > 0) {
      await db.chronicles.bulkPut(records);
      console.log(`${LOG_PREFIX} Migrated ${records.length} chronicles`);
    }
    idb.close();
    await deleteLegacyDb(dbName);
    markMigrated(dbName);
  } catch (err) {
    idb.close();
    console.error(`${LOG_PREFIX} Failed to migrate ${dbName}:`, err);
  }
}

async function migrateImages(): Promise<void> {
  const dbName = 'canonry-images';
  if (isAlreadyMigrated(dbName)) return;

  const idb = await openLegacyDb(dbName, 4);
  if (!idb) { markMigrated(dbName); return; }

  try {
    const records = await readAllFromStore<any>(idb, 'images');
    if (records.length > 0) {
      // Split into metadata (no blob) and blob records for v3 schema
      const metadataRecords = records.map(({ blob, ...rest }: any) => rest);
      const blobRecords = records
        .filter((r: any) => r.blob)
        .map((r: any) => ({ imageId: r.imageId, blob: r.blob }));

      await db.transaction('rw', [db.images, db.imageBlobs], async () => {
        await db.images.bulkPut(metadataRecords);
        await db.imageBlobs.bulkPut(blobRecords);
      });
      console.log(`${LOG_PREFIX} Migrated ${records.length} images (${blobRecords.length} blobs)`);
    }
    idb.close();
    await deleteLegacyDb(dbName);
    markMigrated(dbName);
  } catch (err) {
    idb.close();
    console.error(`${LOG_PREFIX} Failed to migrate ${dbName}:`, err);
  }
}

async function migrateCosts(): Promise<void> {
  const dbName = 'canonry-costs';
  if (isAlreadyMigrated(dbName)) return;

  const idb = await openLegacyDb(dbName, 2);
  if (!idb) { markMigrated(dbName); return; }

  try {
    const records = await readAllFromStore(idb, 'costs');
    if (records.length > 0) {
      await db.costs.bulkPut(records);
      console.log(`${LOG_PREFIX} Migrated ${records.length} cost records`);
    }
    idb.close();
    await deleteLegacyDb(dbName);
    markMigrated(dbName);
  } catch (err) {
    idb.close();
    console.error(`${LOG_PREFIX} Failed to migrate ${dbName}:`, err);
  }
}

async function migrateTraits(): Promise<void> {
  const dbName = 'canonry-traits';
  if (isAlreadyMigrated(dbName)) return;

  const idb = await openLegacyDb(dbName, 1);
  if (!idb) { markMigrated(dbName); return; }

  try {
    const palettes = await readAllFromStore(idb, 'palettes');
    const usedTraits = await readAllFromStore(idb, 'usedTraits');
    if (palettes.length > 0) {
      await db.traitPalettes.bulkPut(palettes);
      console.log(`${LOG_PREFIX} Migrated ${palettes.length} trait palettes`);
    }
    if (usedTraits.length > 0) {
      await db.usedTraits.bulkPut(usedTraits);
      console.log(`${LOG_PREFIX} Migrated ${usedTraits.length} used trait records`);
    }
    idb.close();
    await deleteLegacyDb(dbName);
    markMigrated(dbName);
  } catch (err) {
    idb.close();
    console.error(`${LOG_PREFIX} Failed to migrate ${dbName}:`, err);
  }
}

async function migrateHistorianRuns(): Promise<void> {
  const dbName = 'canonry-historian';
  if (isAlreadyMigrated(dbName)) return;

  const idb = await openLegacyDb(dbName, 1);
  if (!idb) { markMigrated(dbName); return; }

  try {
    const records = await readAllFromStore(idb, 'runs');
    if (records.length > 0) {
      await db.historianRuns.bulkPut(records);
      console.log(`${LOG_PREFIX} Migrated ${records.length} historian runs`);
    }
    idb.close();
    await deleteLegacyDb(dbName);
    markMigrated(dbName);
  } catch (err) {
    idb.close();
    console.error(`${LOG_PREFIX} Failed to migrate ${dbName}:`, err);
  }
}

async function migrateSummaryRevisionRuns(): Promise<void> {
  const dbName = 'canonry-summary-revision';
  if (isAlreadyMigrated(dbName)) return;

  const idb = await openLegacyDb(dbName, 1);
  if (!idb) { markMigrated(dbName); return; }

  try {
    const records = await readAllFromStore(idb, 'runs');
    if (records.length > 0) {
      await db.summaryRevisionRuns.bulkPut(records);
      console.log(`${LOG_PREFIX} Migrated ${records.length} summary revision runs`);
    }
    idb.close();
    await deleteLegacyDb(dbName);
    markMigrated(dbName);
  } catch (err) {
    idb.close();
    console.error(`${LOG_PREFIX} Failed to migrate ${dbName}:`, err);
  }
}

async function migrateDynamicsRuns(): Promise<void> {
  const dbName = 'canonry-dynamics-generation';
  if (isAlreadyMigrated(dbName)) return;

  const idb = await openLegacyDb(dbName, 1);
  if (!idb) { markMigrated(dbName); return; }

  try {
    const records = await readAllFromStore(idb, 'runs');
    if (records.length > 0) {
      await db.dynamicsRuns.bulkPut(records);
      console.log(`${LOG_PREFIX} Migrated ${records.length} dynamics runs`);
    }
    idb.close();
    await deleteLegacyDb(dbName);
    markMigrated(dbName);
  } catch (err) {
    idb.close();
    console.error(`${LOG_PREFIX} Failed to migrate ${dbName}:`, err);
  }
}

async function migrateStaticPages(): Promise<void> {
  const dbName = 'canonry-static-pages';
  if (isAlreadyMigrated(dbName)) return;

  const idb = await openLegacyDb(dbName, 1);
  if (!idb) { markMigrated(dbName); return; }

  try {
    const records = await readAllFromStore(idb, 'static-pages');
    if (records.length > 0) {
      await db.staticPages.bulkPut(records);
      console.log(`${LOG_PREFIX} Migrated ${records.length} static pages`);
    }
    idb.close();
    await deleteLegacyDb(dbName);
    markMigrated(dbName);
  } catch (err) {
    idb.close();
    console.error(`${LOG_PREFIX} Failed to migrate ${dbName}:`, err);
  }
}

async function migrateStyleLibrary(): Promise<void> {
  const dbName = 'illuminator-styles';
  if (isAlreadyMigrated(dbName)) return;

  const idb = await openLegacyDb(dbName, 1);
  if (!idb) { markMigrated(dbName); return; }

  try {
    const records = await readAllFromStore(idb, 'styleLibrary');
    if (records.length > 0) {
      await db.styleLibrary.bulkPut(records);
      console.log(`${LOG_PREFIX} Migrated ${records.length} style library records`);
    }
    idb.close();
    await deleteLegacyDb(dbName);
    markMigrated(dbName);
  } catch (err) {
    idb.close();
    console.error(`${LOG_PREFIX} Failed to migrate ${dbName}:`, err);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run all legacy migrations. Safe to call multiple times — already-migrated
 * databases are skipped via localStorage tracking.
 */
export async function migrateFromLegacyDbs(): Promise<void> {
  const state = getState();
  const allDbs = [
    'canonry-chronicles', 'canonry-images', 'canonry-costs', 'canonry-traits',
    'canonry-historian', 'canonry-summary-revision', 'canonry-dynamics-generation',
    'canonry-static-pages', 'illuminator-styles',
  ];

  const pending = allDbs.filter(name => !(name in state));
  if (pending.length === 0) return;

  console.log(`${LOG_PREFIX} Starting migration for ${pending.length} legacy databases:`, pending);

  // Run all migrations in parallel — they're independent
  await Promise.allSettled([
    migrateChronicles(),
    migrateImages(),
    migrateCosts(),
    migrateTraits(),
    migrateHistorianRuns(),
    migrateSummaryRevisionRuns(),
    migrateDynamicsRuns(),
    migrateStaticPages(),
    migrateStyleLibrary(),
  ]);

  console.log(`${LOG_PREFIX} Migration complete`);
}
