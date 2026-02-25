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

const STORE_SPECS: StoreSpec[] = [
  {
    name: "entities",
    keyPath: "id",
    indexes: [
      { name: "simulationRunId", keyPath: "simulationRunId" },
      { name: "kind", keyPath: "kind" },
      { name: "[simulationRunId+kind]", keyPath: ["simulationRunId", "kind"] },
    ],
  },
  {
    name: "narrativeEvents",
    keyPath: "id",
    indexes: [{ name: "simulationRunId", keyPath: "simulationRunId" }],
  },
  {
    name: "relationships",
    keyPath: ["simulationRunId", "src", "dst", "kind"],
    indexes: [
      { name: "simulationRunId", keyPath: "simulationRunId" },
      { name: "src", keyPath: "src" },
      { name: "dst", keyPath: "dst" },
      { name: "kind", keyPath: "kind" },
    ],
  },
  {
    name: "simulationSlots",
    keyPath: ["projectId", "slotIndex"],
    indexes: [
      { name: "projectId", keyPath: "projectId" },
      { name: "slotIndex", keyPath: "slotIndex" },
      { name: "simulationRunId", keyPath: "simulationRunId" },
    ],
  },
  { name: "worldSchemas", keyPath: "projectId", indexes: [] },
  { name: "coordinateStates", keyPath: "simulationRunId", indexes: [] },
  {
    name: "chronicles",
    keyPath: "chronicleId",
    indexes: [
      { name: "simulationRunId", keyPath: "simulationRunId" },
      { name: "projectId", keyPath: "projectId" },
    ],
  },
  {
    name: "staticPages",
    keyPath: "pageId",
    indexes: [
      { name: "projectId", keyPath: "projectId" },
      { name: "slug", keyPath: "slug" },
      { name: "status", keyPath: "status" },
      { name: "updatedAt", keyPath: "updatedAt" },
    ],
  },
  {
    name: "images",
    keyPath: "imageId",
    indexes: [
      { name: "projectId", keyPath: "projectId" },
      { name: "entityId", keyPath: "entityId" },
      { name: "chronicleId", keyPath: "chronicleId" },
      { name: "entityKind", keyPath: "entityKind" },
      { name: "entityCulture", keyPath: "entityCulture" },
      { name: "model", keyPath: "model" },
      { name: "imageType", keyPath: "imageType" },
      { name: "generatedAt", keyPath: "generatedAt" },
    ],
  },
  {
    name: "imageBlobs",
    keyPath: "imageId",
    indexes: [],
  },
  {
    name: "costs",
    keyPath: "id",
    indexes: [
      { name: "projectId", keyPath: "projectId" },
      { name: "simulationRunId", keyPath: "simulationRunId" },
      { name: "entityId", keyPath: "entityId" },
      { name: "chronicleId", keyPath: "chronicleId" },
      { name: "type", keyPath: "type" },
      { name: "model", keyPath: "model" },
      { name: "timestamp", keyPath: "timestamp" },
    ],
  },
  {
    name: "traitPalettes",
    keyPath: "id",
    indexes: [
      { name: "projectId", keyPath: "projectId" },
      { name: "entityKind", keyPath: "entityKind" },
    ],
  },
  {
    name: "usedTraits",
    keyPath: "id",
    indexes: [
      { name: "projectId", keyPath: "projectId" },
      { name: "simulationRunId", keyPath: "simulationRunId" },
      { name: "entityKind", keyPath: "entityKind" },
      { name: "entityId", keyPath: "entityId" },
    ],
  },
  {
    name: "historianRuns",
    keyPath: "runId",
    indexes: [
      { name: "projectId", keyPath: "projectId" },
      { name: "status", keyPath: "status" },
      { name: "createdAt", keyPath: "createdAt" },
    ],
  },
  {
    name: "summaryRevisionRuns",
    keyPath: "runId",
    indexes: [
      { name: "projectId", keyPath: "projectId" },
      { name: "status", keyPath: "status" },
      { name: "createdAt", keyPath: "createdAt" },
    ],
  },
  {
    name: "dynamicsRuns",
    keyPath: "runId",
    indexes: [
      { name: "projectId", keyPath: "projectId" },
      { name: "status", keyPath: "status" },
      { name: "createdAt", keyPath: "createdAt" },
    ],
  },
  {
    name: "styleLibrary",
    keyPath: "id",
    indexes: [],
  },
  {
    name: "contentTrees",
    keyPath: ["projectId", "simulationRunId"],
    indexes: [],
  },
  {
    name: "eraNarratives",
    keyPath: "narrativeId",
    indexes: [
      { name: "projectId", keyPath: "projectId" },
      { name: "simulationRunId", keyPath: "simulationRunId" },
      { name: "eraId", keyPath: "eraId" },
      { name: "status", keyPath: "status" },
      { name: "createdAt", keyPath: "createdAt" },
    ],
  },
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

function openIlluminatorDbForWrite(): Promise<IDBDatabase> {
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

function requestToPromise<T = unknown>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function waitForTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error || new Error("Transaction aborted"));
    tx.onerror = () => reject(tx.error || new Error("Transaction failed"));
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function bulkPut(store: IDBObjectStore, records: any[]) {
  if (!records || records.length === 0) return;
  await Promise.all(records.map((record) => requestToPromise(store.put(record))));
}

async function deleteByIndex(store: IDBObjectStore, indexName: string, key: IDBValidKey) {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function overwriteWorldDataInDexie({
  projectId,
  slotIndex = 0,
  worldData,
  chronicles = [],
  staticPages = [],
  eraNarratives = [],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}: {
  projectId: string;
  slotIndex?: number;
  worldData: any;
  chronicles?: any[];
  staticPages?: any[];
  eraNarratives?: any[];
}) {
  if (!projectId || !worldData) return;

  const simulationRunId = worldData?.metadata?.simulationRunId;
  if (!simulationRunId) return;

  const db = await openIlluminatorDbForWrite();
  try {
    // Determine which stores to include in the transaction
    const storeNames = [
      "entities",
      "relationships",
      "narrativeEvents",
      "simulationSlots",
      "worldSchemas",
      "coordinateStates",
      "chronicles",
      "staticPages",
    ];
    const hasEraNarrativesStore = db.objectStoreNames.contains("eraNarratives");
    if (hasEraNarrativesStore) {
      storeNames.push("eraNarratives");
    }

    const tx = db.transaction(storeNames, "readwrite");

    const entitiesStore = tx.objectStore("entities");
    const relationshipsStore = tx.objectStore("relationships");
    const eventsStore = tx.objectStore("narrativeEvents");
    const slotsStore = tx.objectStore("simulationSlots");
    const schemasStore = tx.objectStore("worldSchemas");
    const coordinateStore = tx.objectStore("coordinateStates");
    const chroniclesStore = tx.objectStore("chronicles");
    const staticPagesStore = tx.objectStore("staticPages");
    const eraNarrativesStore = hasEraNarrativesStore ? tx.objectStore("eraNarratives") : null;

    const deleteOps = [
      deleteByIndex(entitiesStore, "simulationRunId", simulationRunId),
      deleteByIndex(relationshipsStore, "simulationRunId", simulationRunId),
      deleteByIndex(eventsStore, "simulationRunId", simulationRunId),
      deleteByIndex(chroniclesStore, "simulationRunId", simulationRunId),
      deleteByIndex(staticPagesStore, "projectId", projectId),
    ];
    if (eraNarrativesStore) {
      deleteOps.push(deleteByIndex(eraNarrativesStore, "simulationRunId", simulationRunId));
    }
    await Promise.all(deleteOps);

    const entities = Array.isArray(worldData.hardState)
      ? worldData.hardState.map((entity: any) => ({ ...entity, simulationRunId }))
      : [];
    const relationships = Array.isArray(worldData.relationships)
      ? worldData.relationships.map((rel: any) => ({ ...rel, simulationRunId }))
      : [];
    const narrativeEvents = Array.isArray(worldData.narrativeHistory)
      ? worldData.narrativeHistory.map((event: any) => ({ ...event, simulationRunId }))
      : [];

    const slotRecord = {
      projectId,
      slotIndex,
      simulationRunId,
      finalTick: Number.isFinite(worldData.metadata?.tick) ? worldData.metadata.tick : null,
      finalEraId: worldData.metadata?.era ?? null,
      label: null,
      isTemporary: slotIndex === 0,
      updatedAt: Date.now(),
    };

    await Promise.all([
      bulkPut(entitiesStore, entities),
      bulkPut(relationshipsStore, relationships),
      bulkPut(eventsStore, narrativeEvents),
      requestToPromise(slotsStore.put(slotRecord)),
      worldData.schema
        ? requestToPromise(
            schemasStore.put({ projectId, schema: worldData.schema, updatedAt: Date.now() })
          )
        : Promise.resolve(),
      worldData.coordinateState
        ? requestToPromise(
            coordinateStore.put({
              simulationRunId,
              coordinateState: worldData.coordinateState,
              updatedAt: Date.now(),
            })
          )
        : Promise.resolve(),
    ]);

    if (Array.isArray(chronicles) && chronicles.length > 0) {
      const normalizedChronicles = chronicles.map((record: any) => ({
        ...record,
        projectId: record.projectId || projectId,
        simulationRunId: record.simulationRunId || simulationRunId,
      }));
      await bulkPut(chroniclesStore, normalizedChronicles);
    }

    if (Array.isArray(staticPages) && staticPages.length > 0) {
      const normalizedPages = staticPages.map((page: any) => ({
        ...page,
        projectId: page.projectId || projectId,
      }));
      await bulkPut(staticPagesStore, normalizedPages);
    }

    if (eraNarrativesStore && Array.isArray(eraNarratives) && eraNarratives.length > 0) {
      const normalizedNarratives = eraNarratives.map((record: any) => ({
        ...record,
        projectId: record.projectId || projectId,
        simulationRunId: record.simulationRunId || simulationRunId,
      }));
      await bulkPut(eraNarrativesStore, normalizedNarratives);
    }

    await waitForTransaction(tx);
  } finally {
    db.close();
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function appendNarrativeEventsToDexie(simulationRunId: string, events: any[]) {
  if (!simulationRunId || !Array.isArray(events) || events.length === 0) return;

  const db = await openIlluminatorDbForWrite();
  try {
    const tx = db.transaction(["narrativeEvents"], "readwrite");
    const store = tx.objectStore("narrativeEvents");
    const records = events.map((event) => ({ ...event, simulationRunId }));
    await bulkPut(store, records);
    await waitForTransaction(tx);
  } finally {
    db.close();
  }
}
