/**
 * Zustand store for chronicle data.
 *
 * Holds all ChronicleRecords for the current simulation run as a plain object
 * keyed by chronicleId. Components subscribe via selectors in chronicleSelectors.ts
 * for granular re-renders.
 *
 * Queue-dependent actions (generate, enqueue) live in useChronicleActions hook,
 * not here — Zustand stores should not hold prop-dependent closures.
 */

import { create } from 'zustand';
import {
  getChroniclesForSimulation,
  getChronicle,
  deleteChronicle as deleteChronicleInDb,
  acceptChronicle as acceptChronicleInDb,
  updateChronicleFailure,
  type ChronicleRecord,
} from './chronicleRepository';

export interface ChronicleStoreState {
  simulationRunId: string | null;
  chronicles: Record<string, ChronicleRecord>;
  initialized: boolean;
  loading: boolean;

  initialize: (simulationRunId: string) => Promise<void>;
  refreshChronicle: (chronicleId: string) => Promise<void>;
  refreshAll: () => Promise<void>;
  removeChronicle: (chronicleId: string) => void;
  reset: () => void;

  // Lifecycle actions that mutate IndexedDB then update store
  acceptChronicle: (chronicleId: string) => Promise<{
    chronicleId: string;
    title?: string;
    format?: string;
    content: string;
    summary?: string;
    imageRefs?: ChronicleRecord['imageRefs'];
    entrypointId?: string;
    entityIds?: string[];
    generatedAt?: number;
    acceptedAt: number;
    model?: string;
  } | null>;
  cancelChronicle: (chronicleId: string) => Promise<void>;
  restartChronicle: (chronicleId: string) => Promise<void>;
}

export const useChronicleStore = create<ChronicleStoreState>((set, get) => ({
  simulationRunId: null,
  chronicles: {},
  initialized: false,
  loading: false,

  async initialize(simulationRunId: string) {
    const state = get();
    if (state.simulationRunId === simulationRunId && state.initialized) return;

    set({ loading: true, simulationRunId });

    try {
      const records = await getChroniclesForSimulation(simulationRunId);
      const chronicles: Record<string, ChronicleRecord> = {};
      for (const r of records) {
        chronicles[r.chronicleId] = r;
      }
      set({ chronicles, initialized: true, loading: false });
    } catch (err) {
      console.error('[ChronicleStore] Failed to initialize:', err);
      set({ loading: false });
    }
  },

  async refreshChronicle(chronicleId: string) {
    try {
      const record = await getChronicle(chronicleId);
      if (!record) return;
      set((state) => ({
        chronicles: { ...state.chronicles, [chronicleId]: record },
      }));
    } catch (err) {
      console.error(`[ChronicleStore] Failed to refresh chronicle ${chronicleId}:`, err);
    }
  },

  async refreshAll() {
    const { simulationRunId } = get();
    if (!simulationRunId) return;

    try {
      const records = await getChroniclesForSimulation(simulationRunId);
      const chronicles: Record<string, ChronicleRecord> = {};
      for (const r of records) {
        chronicles[r.chronicleId] = r;
      }
      set({ chronicles });
    } catch (err) {
      console.error('[ChronicleStore] Failed to refresh all:', err);
    }
  },

  removeChronicle(chronicleId: string) {
    set((state) => {
      const { [chronicleId]: _, ...rest } = state.chronicles;
      return { chronicles: rest };
    });
  },

  reset() {
    set({
      simulationRunId: null,
      chronicles: {},
      initialized: false,
      loading: false,
    });
  },

  async acceptChronicle(chronicleId: string) {
    const chronicle = get().chronicles[chronicleId];
    if (!chronicle) {
      console.error('[ChronicleStore] No chronicle found for chronicleId', chronicleId);
      return null;
    }
    if (!chronicle.assembledContent) {
      console.error('[ChronicleStore] Cannot accept without assembled content');
      return null;
    }

    try {
      const currentVersionId = `current_${chronicle.assembledAt ?? chronicle.createdAt}`;
      const activeVersionId = chronicle.activeVersionId || currentVersionId;
      const historyMatch = chronicle.generationHistory?.find((v) => v.versionId === activeVersionId);
      const activeContent = historyMatch?.content || chronicle.assembledContent;

      await acceptChronicleInDb(chronicleId, activeContent);
      await get().refreshAll();

      return {
        chronicleId,
        title: chronicle.title,
        format: chronicle.format,
        content: activeContent,
        summary: chronicle.summary,
        imageRefs: chronicle.imageRefs,
        entrypointId: chronicle.entrypointId,
        entityIds: chronicle.selectedEntityIds,
        generatedAt: chronicle.assembledAt,
        acceptedAt: Date.now(),
        model: chronicle.model,
      };
    } catch (err) {
      console.error('[ChronicleStore] Failed to accept chronicle:', err);
      return null;
    }
  },

  async cancelChronicle(chronicleId: string) {
    try {
      await updateChronicleFailure(chronicleId, 'generate_v2', 'Cancelled by user');
      console.log(`[ChronicleStore] Cancelled chronicle ${chronicleId}`);
      await get().refreshChronicle(chronicleId);
    } catch (err) {
      console.error('[ChronicleStore] Failed to cancel chronicle:', err);
    }
  },

  async restartChronicle(chronicleId: string) {
    try {
      await deleteChronicleInDb(chronicleId);
      console.log(`[ChronicleStore] Deleted chronicle ${chronicleId}`);
    } catch (err) {
      console.error('[ChronicleStore] Failed to delete chronicle:', err);
    }
    get().removeChronicle(chronicleId);
  },
}));
