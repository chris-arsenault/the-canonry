import type {
  CanonrySchemaSlice,
  CoordinateState,
  NarrativeEvent,
  WorldEntity,
  WorldRelationship,
  WorldOutput,
} from '@canonry/world-schema';

const DB_NAME = 'illuminator';
const ENTITIES_STORE = 'entities';
const RELATIONSHIPS_STORE = 'relationships';
const EVENTS_STORE = 'narrativeEvents';
const SLOTS_STORE = 'simulationSlots';
const SCHEMAS_STORE = 'worldSchemas';
const COORDINATE_STORE = 'coordinateStates';
const CHRONICLES_STORE = 'chronicles';
const STATIC_PAGES_STORE = 'staticPages';

export interface SimulationSlotRecord {
  projectId: string;
  slotIndex: number;
  simulationRunId?: string | null;
  finalTick?: number | null;
  finalEraId?: string | null;
  label?: string | null;
  isTemporary?: boolean | null;
  updatedAt: number;
}

export interface WorldSchemaRecord {
  projectId: string;
  schema: CanonrySchemaSlice;
  updatedAt: number;
}

export interface CoordinateStateRecord {
  simulationRunId: string;
  coordinateState: CoordinateState;
  updatedAt: number;
}

export interface ChronicleRecord {
  chronicleId: string;
  projectId?: string;
  simulationRunId?: string;
  title?: string;
  summary?: string;
  status?: string;
  acceptedAt?: number | null;
  updatedAt?: number | null;
}

export interface StaticPageRecord {
  pageId: string;
  projectId?: string;
  title?: string;
  summary?: string;
  status?: string;
  slug?: string;
  updatedAt?: number | null;
}

export function openIlluminatorDb(onVersionChange?: () => void): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        onVersionChange?.();
      };
      resolve(db);
    };
    request.onerror = () => reject(new Error(`Failed to open ${DB_NAME}: ${request.error?.message}`));
  });
}

function getRecord<T>(db: IDBDatabase, storeName: string, key: IDBValidKey): Promise<T | null> {
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(storeName)) {
      resolve(null);
      return;
    }
    const tx = db.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).get(key);
    request.onsuccess = () => resolve((request.result as T) ?? null);
    request.onerror = () => reject(new Error(request.error?.message ?? 'IDB get failed'));
  });
}

function getAllByIndex<T>(
  db: IDBDatabase,
  storeName: string,
  indexName: string,
  key: IDBValidKey,
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(storeName)) {
      resolve([]);
      return;
    }
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    if (!store.indexNames.contains(indexName)) {
      resolve([]);
      return;
    }
    const index = store.index(indexName);
    const results: T[] = [];
    const request = index.openCursor(IDBKeyRange.only(key));
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        results.push(cursor.value as T);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    request.onerror = () => reject(new Error(request.error?.message ?? 'IDB cursor failed'));
  });
}

function stripSimulationRunId<T extends { simulationRunId?: string }>(record: T): Omit<T, 'simulationRunId'> {
  const { simulationRunId: _omit, ...rest } = record; // eslint-disable-line sonarjs/no-unused-vars
  return rest;
}

export async function getSlotRecord(
  projectId: string,
  slotIndex: number,
): Promise<SimulationSlotRecord | null> {
  const db = await openIlluminatorDb();
  const record = await getRecord<SimulationSlotRecord>(db, SLOTS_STORE, [projectId, slotIndex]);
  db.close();
  return record;
}

export async function getWorldSchema(projectId: string): Promise<CanonrySchemaSlice | null> {
  const db = await openIlluminatorDb();
  const record = await getRecord<WorldSchemaRecord>(db, SCHEMAS_STORE, projectId);
  db.close();
  return record?.schema ?? null;
}

export async function getCoordinateState(simulationRunId: string): Promise<CoordinateState | null> {
  const db = await openIlluminatorDb();
  const record = await getRecord<CoordinateStateRecord>(db, COORDINATE_STORE, simulationRunId);
  db.close();
  return record?.coordinateState ?? null;
}

export async function getEntities(simulationRunId: string): Promise<WorldEntity[]> {
  const db = await openIlluminatorDb();
  const records = await getAllByIndex<WorldEntity & { simulationRunId?: string }>(
    db,
    ENTITIES_STORE,
    'simulationRunId',
    simulationRunId,
  );
  db.close();
  return records.map(stripSimulationRunId) as WorldEntity[];
}

export async function getRelationships(simulationRunId: string): Promise<WorldRelationship[]> {
  const db = await openIlluminatorDb();
  const records = await getAllByIndex<WorldRelationship & { simulationRunId?: string }>(
    db,
    RELATIONSHIPS_STORE,
    'simulationRunId',
    simulationRunId,
  );
  db.close();
  return records.map(stripSimulationRunId) as WorldRelationship[];
}

export async function getNarrativeEvents(simulationRunId: string): Promise<NarrativeEvent[]> {
  const db = await openIlluminatorDb();
  const records = await getAllByIndex<NarrativeEvent & { simulationRunId?: string }>(
    db,
    EVENTS_STORE,
    'simulationRunId',
    simulationRunId,
  );
  db.close();
  return records.map(stripSimulationRunId) as NarrativeEvent[];
}

export async function getChronicles(simulationRunId: string): Promise<ChronicleRecord[]> {
  const db = await openIlluminatorDb();
  const records = await getAllByIndex<ChronicleRecord>(
    db,
    CHRONICLES_STORE,
    'simulationRunId',
    simulationRunId,
  );
  db.close();
  return records;
}

export async function getStaticPages(projectId: string): Promise<StaticPageRecord[]> {
  const db = await openIlluminatorDb();
  const records = await getAllByIndex<StaticPageRecord>(
    db,
    STATIC_PAGES_STORE,
    'projectId',
    projectId,
  );
  db.close();
  return records;
}

function resolveEraName(entities: WorldEntity[], eraId?: string | null): string {
  if (!eraId) return '';
  const match = entities.find(
    (entity) => entity.kind === 'era' && (entity.id === eraId || entity.eraId === eraId || entity.name === eraId),
  );
  return match?.name || eraId;
}

export async function buildWorldStateForSlot(
  projectId: string,
  slotIndex: number,
): Promise<WorldOutput | null> {
  const slot = await getSlotRecord(projectId, slotIndex);
  if (!slot?.simulationRunId) return null;

  const [schema, entities, relationships, narrativeHistory, coordinateState] = await Promise.all([
    getWorldSchema(projectId),
    getEntities(slot.simulationRunId),
    getRelationships(slot.simulationRunId),
    getNarrativeEvents(slot.simulationRunId),
    getCoordinateState(slot.simulationRunId),
  ]);

  const eraName = resolveEraName(entities, slot.finalEraId);

  return {
    schema: schema || { entityKinds: [], relationshipKinds: [], cultures: [], tagRegistry: [] },
    metadata: {
      simulationRunId: slot.simulationRunId,
      tick: typeof slot.finalTick === 'number' ? slot.finalTick : 0,
      epoch: 0,
      era: eraName,
      entityCount: entities.length,
      relationshipCount: relationships.length,
    },
    hardState: entities,
    relationships,
    pressures: {},
    narrativeHistory: narrativeHistory.length > 0 ? narrativeHistory : undefined,
    coordinateState: coordinateState || undefined,
  };
}
