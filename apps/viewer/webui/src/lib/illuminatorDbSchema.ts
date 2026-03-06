/**
 * Illuminator IndexedDB schema definition and low-level IDB helpers.
 *
 * Extracted from illuminatorDbWriter to keep the writer under max-lines.
 */

const DB_NAME = "illuminator";
const DB_VERSION = 8;

interface IndexSpec {
  name: string;
  keyPath: string | string[];
}

interface StoreSpec {
  name: string;
  keyPath: string | string[];
  indexes: IndexSpec[];
}

/** Helper: create index shorthand where name === keyPath */
function idx(name: string): IndexSpec {
  return { name, keyPath: name };
}

/** Helper: create index with compound keyPath */
function compoundIdx(name: string, keyPath: string[]): IndexSpec {
  return { name, keyPath };
}

const STORE_SPECS: StoreSpec[] = [
  { name: "entities", keyPath: "id", indexes: [
    idx("simulationRunId"), idx("kind"), compoundIdx("[simulationRunId+kind]", ["simulationRunId", "kind"]),
  ] },
  { name: "narrativeEvents", keyPath: "id", indexes: [idx("simulationRunId")] },
  { name: "relationships", keyPath: ["simulationRunId", "src", "dst", "kind"], indexes: [
    idx("simulationRunId"), idx("src"), idx("dst"), idx("kind"),
  ] },
  { name: "simulationSlots", keyPath: ["projectId", "slotIndex"], indexes: [
    idx("projectId"), idx("slotIndex"), idx("simulationRunId"),
  ] },
  { name: "worldSchemas", keyPath: "projectId", indexes: [] },
  { name: "coordinateStates", keyPath: "simulationRunId", indexes: [] },
  { name: "chronicles", keyPath: "chronicleId", indexes: [idx("simulationRunId"), idx("projectId")] },
  { name: "staticPages", keyPath: "pageId", indexes: [
    idx("projectId"), idx("slug"), idx("status"), idx("updatedAt"),
  ] },
  { name: "images", keyPath: "imageId", indexes: [
    idx("projectId"), idx("entityId"), idx("chronicleId"), idx("entityKind"),
    idx("entityCulture"), idx("model"), idx("imageType"), idx("generatedAt"),
  ] },
  { name: "imageBlobs", keyPath: "imageId", indexes: [] },
  { name: "costs", keyPath: "id", indexes: [
    idx("projectId"), idx("simulationRunId"), idx("entityId"), idx("chronicleId"),
    idx("type"), idx("model"), idx("timestamp"),
  ] },
  { name: "traitPalettes", keyPath: "id", indexes: [idx("projectId"), idx("entityKind")] },
  { name: "usedTraits", keyPath: "id", indexes: [
    idx("projectId"), idx("simulationRunId"), idx("entityKind"), idx("entityId"),
  ] },
  { name: "historianRuns", keyPath: "runId", indexes: [idx("projectId"), idx("status"), idx("createdAt")] },
  { name: "summaryRevisionRuns", keyPath: "runId", indexes: [idx("projectId"), idx("status"), idx("createdAt")] },
  { name: "dynamicsRuns", keyPath: "runId", indexes: [idx("projectId"), idx("status"), idx("createdAt")] },
  { name: "styleLibrary", keyPath: "id", indexes: [] },
  { name: "contentTrees", keyPath: ["projectId", "simulationRunId"], indexes: [] },
  { name: "eraNarratives", keyPath: "narrativeId", indexes: [
    idx("projectId"), idx("simulationRunId"), idx("eraId"), idx("status"), idx("createdAt"),
  ] },
];

function ensureStore(db: IDBDatabase, tx: IDBTransaction, spec: StoreSpec) {
  let store: IDBObjectStore;
  if (!db.objectStoreNames.contains(spec.name)) {
    store = db.createObjectStore(spec.name, { keyPath: spec.keyPath });
  } else {
    store = tx.objectStore(spec.name);
  }
  for (const index of spec.indexes) {
    if (!store.indexNames.contains(index.name)) {
      store.createIndex(index.name, index.keyPath, { unique: false });
    }
  }
}

export function openIlluminatorDbForWrite(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      const tx = request.transaction;
      if (!tx) return;
      for (const spec of STORE_SPECS) {
        ensureStore(db, tx, spec);
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error || new Error("Failed to open illuminator DB"));
  });
}

export function requestToPromise<T = unknown>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function waitForTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error || new Error("Transaction aborted"));
    tx.onerror = () => reject(tx.error || new Error("Transaction failed"));
  });
}

export async function bulkPut<T extends object>(store: IDBObjectStore, records: T[]) {
  if (!records || records.length === 0) return;
  await Promise.all(records.map((record) => requestToPromise(store.put(record))));
}

export async function deleteByIndex(store: IDBObjectStore, indexName: string, key: IDBValidKey) {
  if (!store.indexNames.contains(indexName)) return;
  await new Promise<void>((resolve, reject) => {
    const index = store.index(indexName);
    const request = index.openKeyCursor(IDBKeyRange.only(key));
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        store.delete(cursor.primaryKey);
        cursor.continue();
      } else {
        resolve();
      }
    };
    request.onerror = () => reject(request.error);
  });
}
