/**
 * Zustand store for precomputed run-scoped indexes.
 *
 * Reads a single RunIndexRecord from Dexie on initialize.
 * Components subscribe via selectors in indexSelectors.ts for granular re-renders.
 *
 * Indexes are computed at seed/sync time and persisted to Dexie.
 * This store never computes indexes — it only reads them.
 */

import { create } from "zustand";
import { getRunIndexes } from "./indexRepository";
import type { RunIndexRecord } from "./indexTypes";

export interface IndexStoreState {
  simulationRunId: string | null;
  indexes: RunIndexRecord | null;
  initialized: boolean;
  loading: boolean;
  error: string | null;

  initialize: (simulationRunId: string) => Promise<void>;
  refreshAll: () => Promise<void>;
  reset: () => void;
}

export const useIndexStore = create<IndexStoreState>((set, get) => ({
  simulationRunId: null,
  indexes: null,
  initialized: false,
  loading: false,
  error: null,

  async initialize(simulationRunId: string) {
    const state = get();
    if (state.simulationRunId === simulationRunId && state.initialized) return;

    set({ loading: true, error: null, simulationRunId });
    try {
      const record = await getRunIndexes(simulationRunId);
      set({
        indexes: record ?? null,
        initialized: true,
        loading: false,
      });
    } catch (err) {
      console.error("[IndexStore] Failed to initialize:", err);
      set({
        error: err instanceof Error ? err.message : String(err),
        loading: false,
      });
    }
  },

  async refreshAll() {
    const { simulationRunId } = get();
    if (!simulationRunId) return;

    try {
      const record = await getRunIndexes(simulationRunId);
      set({ indexes: record ?? null });
    } catch (err) {
      console.error("[IndexStore] Failed to refresh:", err);
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  reset() {
    set({
      simulationRunId: null,
      indexes: null,
      initialized: false,
      loading: false,
      error: null,
    });
  },
}));
