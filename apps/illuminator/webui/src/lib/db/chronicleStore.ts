/**
 * Zustand store for chronicle data.
 *
 * Holds a lightweight nav index plus a bounded cache of full ChronicleRecords.
 * Components subscribe via selectors in chronicleSelectors.ts for granular re-renders.
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
import { buildNavItem, type ChronicleNavItem } from './chronicleNav';

const CACHE_LIMIT = 20;

export interface ChronicleStoreState {
  simulationRunId: string | null;
  navItems: Record<string, ChronicleNavItem>;
  navOrder: string[];
  cache: Map<string, ChronicleRecord>;
  initialized: boolean;
  loading: boolean;

  initialize: (simulationRunId: string) => Promise<void>;
  loadChronicle: (chronicleId: string) => Promise<ChronicleRecord | undefined>;
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
  navItems: {},
  navOrder: [],
  cache: new Map(),
  initialized: false,
  loading: false,

  async initialize(simulationRunId: string) {
    const state = get();
    if (state.simulationRunId === simulationRunId && state.initialized) return;

    set({ loading: true, simulationRunId });

    try {
      const records = await getChroniclesForSimulation(simulationRunId);
      const navItems: Record<string, ChronicleNavItem> = {};
      for (const record of records) {
        navItems[record.chronicleId] = buildNavItem(record);
      }
      const navOrder = Object.values(navItems)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map((item) => item.chronicleId);
      set({
        navItems,
        navOrder,
        cache: new Map(),
        initialized: true,
        loading: false,
      });
    } catch (err) {
      console.error('[ChronicleStore] Failed to initialize:', err);
      set({ loading: false });
    }
  },

  async loadChronicle(chronicleId: string) {
    const cached = get().cache.get(chronicleId);
    if (cached) return cached;

    try {
      const record = await getChronicle(chronicleId);
      if (!record) return undefined;

      set((state) => {
        const nextCache = new Map(state.cache);
        nextCache.set(chronicleId, record);
        if (nextCache.size > CACHE_LIMIT) {
          const firstKey = nextCache.keys().next().value;
          if (firstKey) nextCache.delete(firstKey);
        }
        return { cache: nextCache };
      });
      return record;
    } catch (err) {
      console.error(`[ChronicleStore] Failed to load chronicle ${chronicleId}:`, err);
      return undefined;
    }
  },

  async refreshChronicle(chronicleId: string) {
    console.log('[ChronicleStore] refreshChronicle called for:', chronicleId);
    try {
      const record = await getChronicle(chronicleId);
      if (!record) {
        console.log('[ChronicleStore] No record found for:', chronicleId);
        return;
      }
      console.log('[ChronicleStore] Fetched record, updatedAt:', record.updatedAt, 'status:', record.status);

      const navItem = buildNavItem(record);
      set((state) => {
        const nextNavItems = { ...state.navItems, [chronicleId]: navItem };
        // Update cache with fresh record (bypass loadChronicle's cache check)
        const nextCache = new Map(state.cache);
        nextCache.set(chronicleId, record);
        if (nextCache.size > CACHE_LIMIT) {
          const firstKey = nextCache.keys().next().value;
          if (firstKey && firstKey !== chronicleId) nextCache.delete(firstKey);
        }
        // If this is a new chronicle, add it to navOrder and re-sort
        const isNew = !state.navOrder.includes(chronicleId);
        if (isNew) {
          const nextNavOrder = Object.values(nextNavItems)
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .map((item) => item.chronicleId);
          return { navItems: nextNavItems, navOrder: nextNavOrder, cache: nextCache };
        }
        return { navItems: nextNavItems, cache: nextCache };
      });
      console.log('[ChronicleStore] Store updated for chronicle:', chronicleId);
    } catch (err) {
      console.error(`[ChronicleStore] Failed to refresh chronicle ${chronicleId}:`, err);
    }
  },

  async refreshAll() {
    const { simulationRunId } = get();
    if (!simulationRunId) return;

    try {
      const records = await getChroniclesForSimulation(simulationRunId);
      const navItems: Record<string, ChronicleNavItem> = {};
      for (const record of records) {
        navItems[record.chronicleId] = buildNavItem(record);
      }
      const navOrder = Object.values(navItems)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map((item) => item.chronicleId);
      set({ navItems, navOrder });
    } catch (err) {
      console.error('[ChronicleStore] Failed to refresh all:', err);
    }
  },

  removeChronicle(chronicleId: string) {
    set((state) => {
      const { [chronicleId]: _, ...rest } = state.navItems;
      const nextOrder = state.navOrder.filter((id) => id !== chronicleId);
      const nextCache = new Map(state.cache);
      nextCache.delete(chronicleId);
      return { navItems: rest, navOrder: nextOrder, cache: nextCache };
    });
  },

  reset() {
    set({
      simulationRunId: null,
      navItems: {},
      navOrder: [],
      cache: new Map(),
      initialized: false,
      loading: false,
    });
  },

  async acceptChronicle(chronicleId: string) {
    const chronicle = (await get().loadChronicle(chronicleId)) || (await getChronicle(chronicleId));
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

      await acceptChronicleInDb(chronicleId, {
        finalContent: activeContent,
        acceptedVersionId: activeVersionId,
      });
      await get().refreshChronicle(chronicleId);

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
