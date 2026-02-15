/**
 * Entity Store — Zustand reactive layer for entity data.
 *
 * ## Two-layer architecture (see entityNav.ts for the full picture)
 *
 * navItems (Map<id, EntityNavItem>):
 *   Always in memory. Lightweight projections (~1-2MB for ~900 entities).
 *   Built by initialize() which loads ALL entities from Dexie, projects
 *   each to an EntityNavItem via buildEntityNavItem(), then DISCARDS the
 *   full records. React components subscribe to these for list rendering.
 *
 * cache (Map<id, PersistedEntity>):
 *   Bounded FIFO cache of full records. Max CACHE_LIMIT entries.
 *   Populated on demand by loadEntity() / loadEntities() which read
 *   from Dexie. Used for detail views, buildPrompt, and queue operations.
 *   When the cache is full, the oldest entry is evicted.
 *
 * ## Store methods
 *
 * initialize(runId)      — Load all from Dexie → project to navItems → discard full records.
 *                           Called once per simulation run load. Idempotent.
 * loadEntity(id)         — Cache check → Dexie get → add to cache. Returns full PersistedEntity.
 *                           Used by detail views and single-entity queue operations.
 * loadEntities(ids)      — Batch version of loadEntity. Partitions into cached/uncached,
 *                           loads uncached from Dexie in one call. Used by bulk queue ops.
 * refreshEntities(ids)   — Reload specific entities from Dexie → update BOTH navItems AND cache.
 *                           Called after mutations (enrichment complete, rename, etc.).
 * refreshAll()           — Reload all from Dexie → rebuild navItems, clear cache.
 *                           Called on data sync (import world).
 * getEntity(id)          — Synchronous cache-only lookup. Returns undefined if not cached.
 *                           For imperative callbacks that know the entity was recently loaded.
 * reset()                — Clear everything. Called on project/run switch.
 *
 * ## Important: Dexie has no column projection
 *
 * Dexie (IndexedDB) always returns the full record — there's no SELECT columns.
 * So initialize() unavoidably loads all full records into memory temporarily,
 * but immediately discards them after projecting to nav items. The memory spike
 * is transient (~9MB during init, settling to ~1-2MB for nav items only).
 *
 * ## Relationship to other stores
 *
 * The same nav/detail split is used for chronicles (chronicleStore.ts / chronicleNav.ts).
 * Relationships, events, and indexes use simpler stores (full data in memory) because
 * they're small enough that the split isn't worth the complexity.
 */

import { create } from 'zustand';
import type { PersistedEntity } from './illuminatorDb';
import { buildEntityNavItem, type EntityNavItem } from './entityNav';
import * as entityRepo from './entityRepository';

// Max full PersistedEntity records held in memory at once.
// 50 × ~10KB = ~500KB worst case. Evicts oldest on overflow.
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
