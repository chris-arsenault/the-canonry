/**
 * Entity Store — Zustand coordinator for entity data.
 *
 * In-memory coordinator only. Never mirrors full datasets.
 * No persistence middleware. State is safe to drop on reload.
 *
 * Responsibilities: entity ID list, bounded cache, loading/error/dirty state.
 */

import { create } from 'zustand';
import type { PersistedEntity } from './illuminatorDb';
import * as entityRepo from './entityRepository';

const CACHE_LIMIT = 50;

interface EntityStoreState {
  // --- Coordination ---
  simulationRunId: string | null;
  initialized: boolean;
  loading: boolean;
  error: string | null;
  dirtyIds: Set<string>;

  // --- Entity ID list (lightweight) ---
  entityIds: string[];

  // --- Bounded cache (safe to drop) ---
  cache: Map<string, PersistedEntity>;

  // --- Actions ---
  initialize: (simulationRunId: string) => Promise<void>;
  getEntity: (entityId: string) => Promise<PersistedEntity | undefined>;
  invalidate: (entityId: string) => void;
  invalidateAll: () => void;
  markDirty: (entityId: string) => void;
  clearDirty: (entityId: string) => void;
  reset: () => void;
}

export const useEntityStore = create<EntityStoreState>((set, get) => ({
  simulationRunId: null,
  initialized: false,
  loading: false,
  error: null,
  dirtyIds: new Set(),
  entityIds: [],
  cache: new Map(),

  async initialize(simulationRunId: string) {
    const state = get();
    if (state.simulationRunId === simulationRunId && state.initialized) return;

    set({ loading: true, error: null });
    try {
      const entities = await entityRepo.getEntitiesForRun(simulationRunId);
      const ids = entities.map((e) => e.id);
      set({
        simulationRunId,
        entityIds: ids,
        initialized: true,
        loading: false,
        cache: new Map(),
        dirtyIds: new Set(),
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : String(err),
        loading: false,
      });
    }
  },

  async getEntity(entityId: string) {
    const { cache } = get();
    const cached = cache.get(entityId);
    if (cached) return cached;

    const entity = await entityRepo.getEntity(entityId);
    if (entity) {
      set((state) => {
        const next = new Map(state.cache);
        next.set(entityId, entity);
        // Evict oldest if over limit
        if (next.size > CACHE_LIMIT) {
          const firstKey = next.keys().next().value;
          if (firstKey) next.delete(firstKey);
        }
        return { cache: next };
      });
    }
    return entity;
  },

  invalidate(entityId: string) {
    set((state) => {
      const next = new Map(state.cache);
      next.delete(entityId);
      return { cache: next };
    });
  },

  invalidateAll() {
    set({ cache: new Map() });
  },

  markDirty(entityId: string) {
    set((state) => {
      const next = new Set(state.dirtyIds);
      next.add(entityId);
      return { dirtyIds: next };
    });
  },

  clearDirty(entityId: string) {
    set((state) => {
      const next = new Set(state.dirtyIds);
      next.delete(entityId);
      return { dirtyIds: next };
    });
  },

  reset() {
    set({
      simulationRunId: null,
      initialized: false,
      loading: false,
      error: null,
      dirtyIds: new Set(),
      entityIds: [],
      cache: new Map(),
    });
  },
}));
