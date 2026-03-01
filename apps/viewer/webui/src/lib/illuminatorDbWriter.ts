import type {
  WorldOutput,
  WorldEntity,
  WorldRelationship,
  NarrativeEvent,
  CanonrySchemaSlice,
  CoordinateState,
} from "@canonry/world-schema";
import type {
  ChronicleRecord,
  StaticPageRecord,
} from "@the-canonry/world-store";
import {
  openIlluminatorDbForWrite,
  requestToPromise,
  waitForTransaction,
  bulkPut,
  deleteByIndex,
} from "./illuminatorDbSchema";

// ---------------------------------------------------------------------------
// Persisted record types (extend schema types with simulationRunId FK)
// ---------------------------------------------------------------------------

interface PersistedEntity extends WorldEntity {
  simulationRunId: string;
}

interface PersistedRelationship extends WorldRelationship {
  simulationRunId: string;
}

interface PersistedNarrativeEvent extends NarrativeEvent {
  simulationRunId: string;
}

interface PersistedChronicle extends ChronicleRecord {
  projectId: string;
  simulationRunId: string;
}

interface PersistedStaticPage extends StaticPageRecord {
  projectId: string;
}

/** Minimal era narrative shape for IndexedDB writes */
interface EraNarrativeWriteRecord {
  narrativeId: string;
  projectId: string;
  simulationRunId: string;
  eraId?: string;
  eraName?: string;
  status?: string;
  content?: string;
  [key: string]: unknown;
}

interface SlotRecord {
  projectId: string;
  slotIndex: number;
  simulationRunId: string;
  finalTick: number | null;
  finalEraId: string | null;
  label: null;
  isTemporary: boolean;
  updatedAt: number;
}

interface SchemaRecord {
  projectId: string;
  schema: CanonrySchemaSlice;
  updatedAt: number;
}

interface CoordinateRecord {
  simulationRunId: string;
  coordinateState: CoordinateState;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Record builders
// ---------------------------------------------------------------------------

function buildPersistedEntities(worldData: WorldOutput, simulationRunId: string): PersistedEntity[] {
  if (!Array.isArray(worldData.hardState)) return [];
  return worldData.hardState.map((entity) => ({ ...entity, simulationRunId }));
}

function buildPersistedRelationships(worldData: WorldOutput, simulationRunId: string): PersistedRelationship[] {
  if (!Array.isArray(worldData.relationships)) return [];
  return worldData.relationships.map((rel) => ({ ...rel, simulationRunId }));
}

function buildPersistedNarrativeEvents(worldData: WorldOutput, simulationRunId: string): PersistedNarrativeEvent[] {
  if (!Array.isArray(worldData.narrativeHistory)) return [];
  return worldData.narrativeHistory.map((event) => ({ ...event, simulationRunId }));
}

function buildSlotRecord(
  projectId: string, slotIndex: number, simulationRunId: string, worldData: WorldOutput,
): SlotRecord {
  return {
    projectId, slotIndex, simulationRunId,
    finalTick: Number.isFinite(worldData.metadata?.tick) ? worldData.metadata.tick : null,
    finalEraId: worldData.metadata?.era ?? null,
    label: null,
    isTemporary: slotIndex === 0,
    updatedAt: Date.now(),
  };
}

function normalizeChronicles(
  chronicles: ChronicleRecord[], projectId: string, simulationRunId: string,
): PersistedChronicle[] {
  return chronicles.map((record) => ({
    ...record,
    projectId: record.projectId || projectId,
    simulationRunId: record.simulationRunId || simulationRunId,
  }));
}

function normalizeStaticPages(staticPages: StaticPageRecord[], projectId: string): PersistedStaticPage[] {
  return staticPages.map((page) => ({
    ...page,
    projectId: page.projectId || projectId,
  }));
}

function normalizeEraNarratives(
  eraNarratives: EraNarrativeWriteRecord[], projectId: string, simulationRunId: string,
): EraNarrativeWriteRecord[] {
  return eraNarratives.map((record) => ({
    ...record,
    projectId: record.projectId || projectId,
    simulationRunId: record.simulationRunId || simulationRunId,
  }));
}

// ---------------------------------------------------------------------------
// Transaction orchestration
// ---------------------------------------------------------------------------

interface WriteStores {
  entities: IDBObjectStore;
  relationships: IDBObjectStore;
  events: IDBObjectStore;
  slots: IDBObjectStore;
  schemas: IDBObjectStore;
  coordinates: IDBObjectStore;
  chronicles: IDBObjectStore;
  staticPages: IDBObjectStore;
  eraNarratives: IDBObjectStore | null;
}

function openWriteTransaction(db: IDBDatabase): { tx: IDBTransaction; stores: WriteStores } {
  const storeNames = [
    "entities", "relationships", "narrativeEvents", "simulationSlots",
    "worldSchemas", "coordinateStates", "chronicles", "staticPages",
  ];
  const hasEraNarrativesStore = db.objectStoreNames.contains("eraNarratives");
  if (hasEraNarrativesStore) {
    storeNames.push("eraNarratives");
  }
  const tx = db.transaction(storeNames, "readwrite");
  return {
    tx,
    stores: {
      entities: tx.objectStore("entities"),
      relationships: tx.objectStore("relationships"),
      events: tx.objectStore("narrativeEvents"),
      slots: tx.objectStore("simulationSlots"),
      schemas: tx.objectStore("worldSchemas"),
      coordinates: tx.objectStore("coordinateStates"),
      chronicles: tx.objectStore("chronicles"),
      staticPages: tx.objectStore("staticPages"),
      eraNarratives: hasEraNarrativesStore ? tx.objectStore("eraNarratives") : null,
    },
  };
}

async function deleteExistingRecords(
  stores: Pick<WriteStores, "entities" | "relationships" | "events" | "chronicles" | "staticPages" | "eraNarratives">,
  simulationRunId: string, projectId: string,
): Promise<void> {
  const deleteOps = [
    deleteByIndex(stores.entities, "simulationRunId", simulationRunId),
    deleteByIndex(stores.relationships, "simulationRunId", simulationRunId),
    deleteByIndex(stores.events, "simulationRunId", simulationRunId),
    deleteByIndex(stores.chronicles, "simulationRunId", simulationRunId),
    deleteByIndex(stores.staticPages, "projectId", projectId),
  ];
  if (stores.eraNarratives) {
    deleteOps.push(deleteByIndex(stores.eraNarratives, "simulationRunId", simulationRunId));
  }
  await Promise.all(deleteOps);
}

async function writeWorldRecords(
  stores: Pick<WriteStores, "entities" | "relationships" | "events" | "slots" | "schemas" | "coordinates">,
  worldData: WorldOutput, projectId: string, slotIndex: number, simulationRunId: string,
): Promise<void> {
  const schemaOp = worldData.schema
    ? requestToPromise(stores.schemas.put({ projectId, schema: worldData.schema, updatedAt: Date.now() } satisfies SchemaRecord))
    : Promise.resolve();

  const coordOp = worldData.coordinateState
    ? requestToPromise(stores.coordinates.put({
        simulationRunId, coordinateState: worldData.coordinateState, updatedAt: Date.now(),
      } satisfies CoordinateRecord))
    : Promise.resolve();

  await Promise.all([
    bulkPut(stores.entities, buildPersistedEntities(worldData, simulationRunId)),
    bulkPut(stores.relationships, buildPersistedRelationships(worldData, simulationRunId)),
    bulkPut(stores.events, buildPersistedNarrativeEvents(worldData, simulationRunId)),
    requestToPromise(stores.slots.put(buildSlotRecord(projectId, slotIndex, simulationRunId, worldData))),
    schemaOp,
    coordOp,
  ]);
}

async function writeSupplementalRecords(
  stores: Pick<WriteStores, "chronicles" | "staticPages" | "eraNarratives">,
  chronicles: ChronicleRecord[], staticPages: StaticPageRecord[],
  eraNarratives: EraNarrativeWriteRecord[], projectId: string, simulationRunId: string,
): Promise<void> {
  if (chronicles.length > 0) {
    await bulkPut(stores.chronicles, normalizeChronicles(chronicles, projectId, simulationRunId));
  }
  if (staticPages.length > 0) {
    await bulkPut(stores.staticPages, normalizeStaticPages(staticPages, projectId));
  }
  if (stores.eraNarratives && eraNarratives.length > 0) {
    await bulkPut(stores.eraNarratives, normalizeEraNarratives(eraNarratives, projectId, simulationRunId));
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

interface OverwriteWorldDataParams {
  projectId: string;
  slotIndex?: number;
  worldData: WorldOutput;
  chronicles?: ChronicleRecord[];
  staticPages?: StaticPageRecord[];
  eraNarratives?: EraNarrativeWriteRecord[];
}

export async function overwriteWorldDataInDexie({
  projectId, slotIndex = 0, worldData,
  chronicles = [], staticPages = [], eraNarratives = [],
}: OverwriteWorldDataParams) {
  if (!projectId || !worldData) return;
  const simulationRunId = worldData.metadata?.simulationRunId;
  if (!simulationRunId) return;

  const db = await openIlluminatorDbForWrite();
  try {
    const { tx, stores } = openWriteTransaction(db);
    await deleteExistingRecords(stores, simulationRunId, projectId);
    await writeWorldRecords(stores, worldData, projectId, slotIndex, simulationRunId);
    await writeSupplementalRecords(stores, chronicles, staticPages, eraNarratives, projectId, simulationRunId);
    await waitForTransaction(tx);
  } finally {
    db.close();
  }
}

export async function appendNarrativeEventsToDexie(simulationRunId: string, events: NarrativeEvent[]) {
  if (!simulationRunId || !Array.isArray(events) || events.length === 0) return;

  const db = await openIlluminatorDbForWrite();
  try {
    const tx = db.transaction(["narrativeEvents"], "readwrite");
    const store = tx.objectStore("narrativeEvents");
    const records: PersistedNarrativeEvent[] = events.map((event) => ({ ...event, simulationRunId }));
    await bulkPut(store, records);
    await waitForTransaction(tx);
  } finally {
    db.close();
  }
}
