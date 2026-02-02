/**
 * Run Slot Store
 *
 * IndexedDB persistence for simulation run slots, keyed by projectId + slotIndex.
 */

const DB_NAME = 'canonry-runs';
const DB_VERSION = 1;
const STORE_NAME = 'runs';

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: ['projectId', 'slotIndex'] });
        store.createIndex('projectId', 'projectId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
  return dbPromise;
}

async function idbGetByProject(projectId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('projectId');
    const request = index.getAll(projectId);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error || new Error('IDB read failed'));
  });
}

async function idbGet(projectId, slotIndex) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get([projectId, slotIndex]);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('IDB read failed'));
  });
}

async function idbSet(record) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('IDB write failed'));
    tx.objectStore(STORE_NAME).put(record);
  });
}

async function idbDelete(projectId, slotIndex) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('IDB delete failed'));
    tx.objectStore(STORE_NAME).delete([projectId, slotIndex]);
  });
}

async function idbDeleteProject(projectId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('projectId');
    const request = index.openCursor(IDBKeyRange.only(projectId));
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('IDB delete failed'));
  });
}

function stripRunRecord(record) {
  if (!record) return null;
  const { projectId, slotIndex, ...slotData } = record;
  return slotData;
}

function normalizeSlotIndex(slotIndex) {
  return Number.isFinite(slotIndex) ? slotIndex : Number(slotIndex);
}

export async function getRunSlots(projectId) {
  if (!projectId) return {};
  const records = await idbGetByProject(projectId);
  return records.reduce((acc, record) => {
    acc[record.slotIndex] = stripRunRecord(record);
    return acc;
  }, {});
}

export async function getRunSlot(projectId, slotIndex) {
  if (!projectId) return null;
  const normalized = normalizeSlotIndex(slotIndex);
  const record = await idbGet(projectId, normalized);
  return stripRunRecord(record);
}

export async function saveRunSlot(projectId, slotIndex, slotData) {
  if (!projectId) return;
  const normalized = normalizeSlotIndex(slotIndex);
  const record = {
    projectId,
    slotIndex: normalized,
    ...slotData
  };
  await idbSet(record);
}

export async function deleteRunSlot(projectId, slotIndex) {
  if (!projectId) return;
  const normalized = normalizeSlotIndex(slotIndex);
  await idbDelete(projectId, normalized);
}

export async function deleteRunSlotsForProject(projectId) {
  if (!projectId) return;
  await idbDeleteProject(projectId);
}
