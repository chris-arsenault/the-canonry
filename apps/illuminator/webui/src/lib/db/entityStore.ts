/**
 * Entity Store — Zustand reactive layer for entity data.
 *
 * Holds lightweight nav items in memory for list rendering.
 * Full entity records are loaded on demand into a bounded FIFO cache.
 *
 * Follows the chronicle store pattern: initialize projects all records
 * to nav items then discards the full records. loadEntity/loadEntities
 * fetch from Dexie on demand with cache.
 *
 * Dexie remains the source of truth.
 */

import { create } from 'zustand';
import type { PersistedEntity } from './illuminatorDb';
import { buildEntityNavItem, type EntityNavItem } from './entityNav';
import * as entityRepo from './entityRepository';

const CACHE_LIMIT = 50;

export interface EntityStoreState {
  simulationRunId: string | null;
  navItems: Map<string, EntityNavItem>;
  cache: Map<string, PersistedEntity>;
  initialized: boolean;
  loading: boolean;
  error: string | null;

  initialize: (simulationRunId: string) => Promise<void>;
  loadEntity: (entityId: string) => Promise<PersistedEntity | undefined>;
  loadEntities: (entityIds: string[]) => Promise<PersistedEntity[]>;
  refreshEntities: (entityIds: string[]) => Promise<void>;
  refreshAll: () => Promise<void>;
  getEntity: (entityId: string) => PersistedEntity | undefined;
  reset: () => void;
}

function addToCache(cache: Map<string, PersistedEntity>, id: string, entity: PersistedEntity): void {
  cache.set(id, entity);
  if (cache.size > CACHE_LIMIT) {
    const firstKey = cache.keys().next().value;
    if (firstKey && firstKey !== id) cache.delete(firstKey);
  }
}

export const useEntityStore = create<EntityStoreState>((set, get) => ({
  simulationRunId: null,
  navItems: new Map(),
  cache: new Map(),
  initialized: false,
  loading: false,
  error: null,

  async initialize(simulationRunId: string) {
    const state = get();
    if (state.simulationRunId === simulationRunId && state.initialized) return;

    set({ loading: true, error: null, simulationRunId });
    try {
      const entities = await entityRepo.getEntitiesForRun(simulationRunId);
      const navItems = new Map<string, EntityNavItem>();
      for (const entity of entities) {
        navItems.set(entity.id, buildEntityNavItem(entity));
      }
      // Project to nav items and discard full records
      set({
        navItems,
        cache: new Map(),
        initialized: true,
        loading: false,
      });
    } catch (err) {
      console.error('[EntityStore] Failed to initialize:', err);
      set({
        error: err instanceof Error ? err.message : String(err),
        loading: false,
      });
    }
  },

  async loadEntity(entityId: string) {
    const cached = get().cache.get(entityId);
    if (cached) return cached;

    try {
      const entity = await entityRepo.getEntity(entityId);
      if (!entity) return undefined;

      set((state) => {
        const nextCache = new Map(state.cache);
        addToCache(nextCache, entityId, entity);
        return { cache: nextCache };
      });
      return entity;
    } catch (err) {
      console.error(`[EntityStore] Failed to load entity ${entityId}:`, err);
      return undefined;
    }
  },

  async loadEntities(entityIds: string[]) {
    if (!entityIds.length) return [];
    const { cache } = get();

    // Partition into cached and uncached
    const results: PersistedEntity[] = [];
    const uncachedIds: string[] = [];
    for (const id of entityIds) {
      const cached = cache.get(id);
      if (cached) {
        results.push(cached);
      } else {
        uncachedIds.push(id);
      }
    }

    if (uncachedIds.length === 0) return results;

    try {
      const freshEntities = await entityRepo.getEntitiesByIds(uncachedIds);
      set((state) => {
        const nextCache = new Map(state.cache);
        for (const entity of freshEntities) {
          addToCache(nextCache, entity.id, entity);
        }
        return { cache: nextCache };
      });
      results.push(...freshEntities);
      return results;
    } catch (err) {
      console.error('[EntityStore] Failed to load entities:', err);
      return results;
    }
  },

  async refreshEntities(entityIds: string[]) {
    if (!entityIds.length) return;

    const freshEntities = await entityRepo.getEntitiesByIds(entityIds);
    const freshById = new Map(freshEntities.map((e) => [e.id, e]));

    set((state) => {
      const nextNavItems = new Map(state.navItems);
      const nextCache = new Map(state.cache);

      for (const id of entityIds) {
        const fresh = freshById.get(id);
        if (fresh) {
          nextNavItems.set(id, buildEntityNavItem(fresh));
          // Update cache only if entity was already cached
          if (nextCache.has(id)) {
            nextCache.set(id, fresh);
          }
        } else {
          // Entity deleted
          nextNavItems.delete(id);
          nextCache.delete(id);
        }
      }

      return { navItems: nextNavItems, cache: nextCache };
    });
  },

  async refreshAll() {
    const { simulationRunId } = get();
    if (!simulationRunId) return;

    const entities = await entityRepo.getEntitiesForRun(simulationRunId);
    const navItems = new Map<string, EntityNavItem>();
    for (const entity of entities) {
      navItems.set(entity.id, buildEntityNavItem(entity));
    }
    set({ navItems, cache: new Map() });
  },

  getEntity(entityId: string) {
    return get().cache.get(entityId);
  },

  reset() {
    set({
      simulationRunId: null,
      navItems: new Map(),
      cache: new Map(),
      initialized: false,
      loading: false,
      error: null,
    });
  },
}));
