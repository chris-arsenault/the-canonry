/**
 * Narrative Event Store — Zustand reactive layer for narrative event data.
 *
 * Unlike entities and chronicles, events use a SIMPLE store pattern:
 * all records fully loaded in memory, no nav/detail split. This is because
 * events are moderately sized (~1.3MB for ~6400 records) and buildPrompt
 * needs synchronous access for bulk operations.
 *
 * Components subscribe via selectors in narrativeEventSelectors.ts.
 * Dexie remains the source of truth. Refreshes on rename or data sync.
 */

import { create } from 'zustand';
import type { PersistedNarrativeEvent } from './illuminatorDb';
import * as eventRepo from './eventRepository';

export interface NarrativeEventStoreState {
  simulationRunId: string | null;
  events: PersistedNarrativeEvent[];
  initialized: boolean;
  loading: boolean;
  error: string | null;

  initialize: (simulationRunId: string) => Promise<void>;
  refreshAll: () => Promise<void>;
  reset: () => void;
}

export const useNarrativeEventStore = create<NarrativeEventStoreState>((set, get) => ({
  simulationRunId: null,
  events: [],
  initialized: false,
  loading: false,
  error: null,

  async initialize(simulationRunId: string) {
    const state = get();
    if (state.simulationRunId === simulationRunId && state.initialized) return;

    set({ loading: true, error: null, simulationRunId });
    try {
      const events = await eventRepo.getNarrativeEventsForRun(simulationRunId);
      set({
        events,
        initialized: true,
        loading: false,
      });
    } catch (err) {
      console.error('[NarrativeEventStore] Failed to initialize:', err);
      set({
        error: err instanceof Error ? err.message : String(err),
        loading: false,
      });
    }
  },

  async refreshAll() {
    const { simulationRunId } = get();
    if (!simulationRunId) return;

    const events = await eventRepo.getNarrativeEventsForRun(simulationRunId);
    set({ events });
  },

  reset() {
    set({
      simulationRunId: null,
      events: [],
      initialized: false,
      loading: false,
      error: null,
    });
  },
}));
