import { useEffect } from 'react';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { NarrativeEvent } from '@canonry/world-schema';

const DEFAULT_DB_NAME = 'illuminator';
const EVENTS_STORE = 'narrativeEvents';
const SIMULATION_INDEX = 'simulationRunId';

export interface NarrativeBackend {
  getEventsForEntity: (simulationRunId: string, entityId: string) => Promise<NarrativeEvent[]>;
  getAllEvents: (simulationRunId: string) => Promise<NarrativeEvent[]>;
}

export interface NarrativeStatus {
  loading: boolean;
  chunksLoaded: number;
  chunksTotal: number;
  totalExpected: number;
}

export interface NarrativeStoreState {
  backend: NarrativeBackend | null;
  simulationRunId: string | null;
  eventsById: Map<string, NarrativeEvent>;
  eventsByEntity: Map<string, NarrativeEvent[]>;
  eventIds: Set<string>;
  loadedEntityIds: Set<string>;
  loadingEntityIds: Set<string>;
  allEventsLoaded: boolean;
  allEventsLoading: boolean;
  status: NarrativeStatus;

  configureBackend: (backend: NarrativeBackend | null) => void;
  setSimulationRunId: (simulationRunId: string | null) => void;
  ensureEntityEvents: (entityId: string | null | undefined) => Promise<void>;
  ensureAllEventsLoaded: () => Promise<void>;
  ingestChunk: (items: NarrativeEvent[]) => void;
  setStatus: (partial: Partial<NarrativeStatus>) => void;
  reset: () => void;
  getAllEvents: () => NarrativeEvent[];
}

const EMPTY_EVENTS: NarrativeEvent[] = [];

const DEFAULT_STATUS: NarrativeStatus = {
  loading: false,
  chunksLoaded: 0,
  chunksTotal: 0,
  totalExpected: 0,
};

export const useNarrativeStore = create<NarrativeStoreState>()(
  subscribeWithSelector((set, get) => ({
    backend: null,
    simulationRunId: null,
    eventsById: new Map(),
    eventsByEntity: new Map(),
    eventIds: new Set(),
    loadedEntityIds: new Set(),
    loadingEntityIds: new Set(),
    allEventsLoaded: false,
    allEventsLoading: false,
    status: { ...DEFAULT_STATUS },

    configureBackend: (backend) => {
      set({ backend });
    },

    setSimulationRunId: (simulationRunId) => {
      set({
        simulationRunId: simulationRunId ?? null,
        eventsById: new Map(),
        eventsByEntity: new Map(),
        eventIds: new Set(),
        loadedEntityIds: new Set(),
        loadingEntityIds: new Set(),
        allEventsLoaded: false,
        allEventsLoading: false,
        status: { ...DEFAULT_STATUS },
      });
    },

    ensureEntityEvents: async (entityId) => {
      const { backend, simulationRunId, loadedEntityIds, loadingEntityIds } = get();
      if (!backend || !simulationRunId || !entityId) return;
      if (loadedEntityIds.has(entityId) || loadingEntityIds.has(entityId)) return;

      set((state) => {
        const nextLoading = new Set(state.loadingEntityIds);
        nextLoading.add(entityId);
        return {
          loadingEntityIds: nextLoading,
          status: {
            ...state.status,
            loading: true,
          },
        };
      });

      try {
        const events = await backend.getEventsForEntity(simulationRunId, entityId);
        set((state) => {
          const nextEventsById = new Map(state.eventsById);
          const nextEventsByEntity = new Map(state.eventsByEntity);
          const nextEventIds = new Set(state.eventIds);
          const uniqueEvents: NarrativeEvent[] = [];
          const seenIds = new Set<string>();

          for (const event of events || []) {
            if (!event?.id || seenIds.has(event.id)) continue;
            seenIds.add(event.id);
            nextEventIds.add(event.id);
            const existing = nextEventsById.get(event.id);
            if (!existing) {
              nextEventsById.set(event.id, event);
              uniqueEvents.push(event);
            } else {
              uniqueEvents.push(existing);
            }
          }

          nextEventsByEntity.set(entityId, uniqueEvents);
          const nextLoaded = new Set(state.loadedEntityIds);
          nextLoaded.add(entityId);

          return {
            eventsById: nextEventsById,
            eventsByEntity: nextEventsByEntity,
            eventIds: nextEventIds,
            loadedEntityIds: nextLoaded,
          };
        });
      } catch (err) {
        console.error('[NarrativeStore] Failed to load narrative events:', err);
      } finally {
        set((state) => {
          const nextLoading = new Set(state.loadingEntityIds);
          nextLoading.delete(entityId);
          return {
            loadingEntityIds: nextLoading,
            status: {
              ...state.status,
              loading: nextLoading.size > 0,
            },
          };
        });
      }
    },

    ensureAllEventsLoaded: async () => {
      const { backend, simulationRunId, allEventsLoaded, allEventsLoading } = get();
      if (!backend || !simulationRunId) return;
      if (allEventsLoaded || allEventsLoading) return;

      set({ allEventsLoading: true });

      try {
        const events = await backend.getAllEvents(simulationRunId);
        if (events && events.length > 0) {
          get().ingestChunk(events);
        }
        set({ allEventsLoaded: true });
      } catch (err) {
        console.error('[NarrativeStore] Failed to load narrative events:', err);
      } finally {
        set({ allEventsLoading: false });
      }
    },

    ingestChunk: (items) => {
      if (!items || items.length === 0) return;

      set((state) => {
        const nextEventsById = new Map(state.eventsById);
        const nextEventsByEntity = new Map(state.eventsByEntity);
        const nextEventIds = new Set(state.eventIds);
        const touched = new Map<string, NarrativeEvent[]>();
        let didChange = false;

        for (const event of items) {
          if (!event?.id || nextEventIds.has(event.id)) continue;
          nextEventIds.add(event.id);
          nextEventsById.set(event.id, event);
          didChange = true;

          const participants = Array.isArray(event.participantEffects)
            ? event.participantEffects
            : [];

          for (const participant of participants) {
            const entityId = participant?.entity?.id;
            if (!entityId) continue;

            let list = touched.get(entityId);
            if (!list) {
              const existing = nextEventsByEntity.get(entityId) ?? EMPTY_EVENTS;
              list = existing.length > 0 ? existing.slice() : [];
              touched.set(entityId, list);
            }
            list.push(event);
          }
        }

        if (!didChange && touched.size === 0) return {};

        for (const [entityId, list] of touched) {
          nextEventsByEntity.set(entityId, list);
        }

        return { eventsById: nextEventsById, eventsByEntity: nextEventsByEntity, eventIds: nextEventIds };
      });
    },

    setStatus: (partial) => {
      set((state) => ({
        status: {
          ...state.status,
          ...partial,
        },
      }));
    },

    reset: () => {
      set({
        eventsById: new Map(),
        eventsByEntity: new Map(),
        eventIds: new Set(),
        loadedEntityIds: new Set(),
        loadingEntityIds: new Set(),
        allEventsLoaded: false,
        allEventsLoading: false,
        status: { ...DEFAULT_STATUS },
      });
    },

    getAllEvents: () => Array.from(get().eventsById.values()),
  }))
);

export function useEntityNarrativeEvents(
  entityId: string | null | undefined
): NarrativeEvent[] {
  const ensureEntityEvents = useNarrativeStore((state) => state.ensureEntityEvents);
  const backend = useNarrativeStore((state) => state.backend);
  const simulationRunId = useNarrativeStore((state) => state.simulationRunId);
  useEffect(() => {
    if (!entityId) return;
    if (!backend || !simulationRunId) return;
    void ensureEntityEvents(entityId);
  }, [backend, entityId, ensureEntityEvents, simulationRunId]);

  return useNarrativeStore(
    (state) => (entityId ? state.eventsByEntity.get(entityId) ?? EMPTY_EVENTS : EMPTY_EVENTS)
  );
}

export function useNarrativeStatus(): NarrativeStatus {
  return useNarrativeStore((state) => state.status);
}

export function useNarrativeLoading(): boolean {
  return useNarrativeStore((state) => state.status.loading);
}

export function useEntityNarrativeLoading(entityId: string | null | undefined): boolean {
  return useNarrativeStore((state) => {
    if (!entityId) return false;
    return state.loadingEntityIds.has(entityId);
  });
}

export function useEntityNarrativeReady(entityId: string | null | undefined): boolean {
  return useNarrativeStore((state) => {
    if (!entityId) return true;
    return state.loadedEntityIds.has(entityId);
  });
}

export function useAllNarrativeEvents(): NarrativeEvent[] {
  return useNarrativeStore((state) => Array.from(state.eventsById.values()));
}

export function useAllNarrativeEventsLoading(): boolean {
  return useNarrativeStore((state) => state.allEventsLoading);
}

export function useAllNarrativeEventsLoaded(): boolean {
  return useNarrativeStore((state) => state.allEventsLoaded);
}

function openDb(dbName: string, onVersionChange?: () => void): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName);
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        onVersionChange?.();
      };
      resolve(db);
    };
    request.onerror = () => reject(new Error(`Failed to open ${dbName}: ${request.error?.message}`));
  });
}

function stripSimulationRunId<T extends { simulationRunId?: string }>(record: T): Omit<T, 'simulationRunId'> {
  const { simulationRunId: _omit, ...rest } = record;
  return rest;
}

function eventMatchesEntity(event: NarrativeEvent, entityId: string): boolean {
  const participants = Array.isArray(event.participantEffects) ? event.participantEffects : [];
  return participants.some((participant) => participant?.entity?.id === entityId);
}

/**
 * Fetch-based backend for the viewer context.
 * Loads pre-built per-entity timeline JSON files on demand.
 */
export class FetchBackend implements NarrativeBackend {
  private baseUrl: string;
  private timelineFiles: Record<string, { path: string; eventCount: number }>;

  constructor(baseUrl: string, timelineFiles: Record<string, { path: string; eventCount: number }>) {
    this.baseUrl = baseUrl;
    this.timelineFiles = timelineFiles;
  }

  async getEventsForEntity(_simulationRunId: string, entityId: string): Promise<NarrativeEvent[]> {
    const file = this.timelineFiles[entityId];
    if (!file) return [];
    const url = new URL(file.path, this.baseUrl).toString();
    const response = await fetch(url);
    if (!response.ok) return [];
    return response.json();
  }

  async getAllEvents(): Promise<NarrativeEvent[]> {
    // Not supported in fetch backend — per-entity loading only
    return [];
  }
}

export class IndexedDBBackend implements NarrativeBackend {
  private dbName: string;
  private storeName: string;

  constructor(options?: { dbName?: string; storeName?: string }) {
    this.dbName = options?.dbName ?? DEFAULT_DB_NAME;
    this.storeName = options?.storeName ?? EVENTS_STORE;
  }

  async getEventsForEntity(simulationRunId: string, entityId: string): Promise<NarrativeEvent[]> {
    const db = await openDb(this.dbName);

    return new Promise((resolve, reject) => {
      if (!db.objectStoreNames.contains(this.storeName)) {
        db.close();
        resolve([]);
        return;
      }

      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const hasIndex = store.indexNames.contains(SIMULATION_INDEX);
      const source = hasIndex ? store.index(SIMULATION_INDEX) : store;
      const keyRange = hasIndex ? IDBKeyRange.only(simulationRunId) : undefined;

      const results: NarrativeEvent[] = [];
      const request = keyRange ? source.openCursor(keyRange) : source.openCursor();

      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          db.close();
          resolve(results);
          return;
        }

        const record = cursor.value as NarrativeEvent & { simulationRunId?: string };
        if (!hasIndex && record.simulationRunId !== simulationRunId) {
          cursor.continue();
          return;
        }

        if (record && eventMatchesEntity(record, entityId)) {
          results.push(stripSimulationRunId(record) as NarrativeEvent);
        }

        cursor.continue();
      };

      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  }

  async getAllEvents(simulationRunId: string): Promise<NarrativeEvent[]> {
    const db = await openDb(this.dbName);

    return new Promise((resolve, reject) => {
      if (!db.objectStoreNames.contains(this.storeName)) {
        db.close();
        resolve([]);
        return;
      }

      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const hasIndex = store.indexNames.contains(SIMULATION_INDEX);
      const source = hasIndex ? store.index(SIMULATION_INDEX) : store;
      const keyRange = hasIndex ? IDBKeyRange.only(simulationRunId) : undefined;

      const results: NarrativeEvent[] = [];
      const request = keyRange ? source.openCursor(keyRange) : source.openCursor();

      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          db.close();
          resolve(results);
          return;
        }

        const record = cursor.value as NarrativeEvent & { simulationRunId?: string };
        if (!hasIndex && record.simulationRunId !== simulationRunId) {
          cursor.continue();
          return;
        }

        results.push(stripSimulationRunId(record) as NarrativeEvent);
        cursor.continue();
      };

      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  }
}
