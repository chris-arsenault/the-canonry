import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { NarrativeEvent } from '@canonry/world-schema';

export interface NarrativeStatus {
  loading: boolean;
  chunksLoaded: number;
  chunksTotal: number;
  totalExpected: number;
}

export interface NarrativeStoreState {
  eventsById: Map<string, NarrativeEvent>;
  eventsByEntity: Map<string, NarrativeEvent[]>;
  eventIds: Set<string>;
  status: NarrativeStatus;
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
    eventsById: new Map(),
    eventsByEntity: new Map(),
    eventIds: new Set(),
    status: { ...DEFAULT_STATUS },

    ingestChunk: (items) => {
      if (!items || items.length === 0) return;

      set((state) => {
        const { eventsById, eventsByEntity, eventIds } = state;
        const touched = new Map<string, NarrativeEvent[]>();
        let didChange = false;

        for (const event of items) {
          if (!event?.id || eventIds.has(event.id)) continue;
          eventIds.add(event.id);
          eventsById.set(event.id, event);
          didChange = true;

          const participants = Array.isArray(event.participantEffects)
            ? event.participantEffects
            : [];

          for (const participant of participants) {
            const entityId = participant?.entity?.id;
            if (!entityId) continue;

            let list = touched.get(entityId);
            if (!list) {
              const existing = eventsByEntity.get(entityId) ?? EMPTY_EVENTS;
              list = existing.length > 0 ? existing.slice() : [];
              touched.set(entityId, list);
            }
            list.push(event);
          }
        }

        if (!didChange && touched.size === 0) return {};

        for (const [entityId, list] of touched) {
          eventsByEntity.set(entityId, list);
        }

        return { eventsById, eventsByEntity, eventIds };
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
        status: { ...DEFAULT_STATUS },
      });
    },

    getAllEvents: () => Array.from(get().eventsById.values()),
  }))
);

export function useEntityNarrativeEvents(
  entityId: string | null | undefined
): NarrativeEvent[] {
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
