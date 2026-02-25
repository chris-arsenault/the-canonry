/**
 * Zustand selectors for the entity store.
 *
 * ## Choosing the right selector
 *
 * For LIST views (EntityBrowser, EntityLinkPicker, dropdowns):
 *   useEntityNavList()  → EntityNavItem[] — sorted array of lightweight projections
 *   useEntityNavItems() → Map<id, EntityNavItem> — for O(1) lookup by id
 *
 * For DETAIL views (EntityDetailView, entity modal):
 *   useEntity(id)       → PersistedEntity | undefined — from bounded cache
 *   NOTE: This only returns data if the entity has been loaded via
 *   store.loadEntity(id). Typical pattern:
 *     useEffect(() => { store.loadEntity(id); }, [id]);
 *     const entity = useEntity(id); // undefined until loaded
 *
 * For COUNTS (stats, badges):
 *   useEntityCount()    → number
 *
 * ## What NOT to do
 *
 * There is intentionally no useEntities() or useEntityById() that returns
 * all full PersistedEntity records. Those selectors were deleted because they
 * forced ~9MB of entity data into memory. If you need full records for a bulk
 * operation, use store.loadEntities(ids) in an async callback — don't subscribe
 * to them reactively.
 *
 * ## Re-render granularity
 *
 * useEntityNavItems() and useEntityNavList() re-render when the navItems Map
 * reference changes (which happens on initialize, refreshEntities, refreshAll).
 * useEntity(id) re-renders when the cache Map reference changes (any cache
 * add/evict). For finer granularity, use useEntityNavItem(id) which only
 * re-renders when that specific nav item changes.
 */

import { useMemo } from "react";
import { useEntityStore } from "./entityStore";
import type { PersistedEntity } from "./illuminatorDb";
import type { EntityNavItem } from "./entityNav";

const EMPTY_ARRAY: EntityNavItem[] = [];

/** Full nav item map for O(1) lookups — re-renders when any nav item changes */
export function useEntityNavItems(): Map<string, EntityNavItem> {
  return useEntityStore((state) => state.navItems);
}

/** Nav item array for list rendering — derived from map via useMemo */
export function useEntityNavList(): EntityNavItem[] {
  const navItems = useEntityStore((state) => state.navItems);
  return useMemo(() => (navItems.size ? Array.from(navItems.values()) : EMPTY_ARRAY), [navItems]);
}

/** Single nav item by ID — only re-renders when this specific nav item changes */
export function useEntityNavItem(id: string | undefined): EntityNavItem | undefined {
  return useEntityStore((state) => (id ? state.navItems.get(id) : undefined));
}

/**
 * Single full entity from the bounded cache.
 * Returns undefined if the entity hasn't been loaded yet.
 * Pair with store.loadEntity(id) in a useEffect to trigger the load.
 */
export function useEntity(id: string | undefined): PersistedEntity | undefined {
  return useEntityStore((state) => (id ? state.cache.get(id) : undefined));
}

/** Entity count — only re-renders when count changes */
export function useEntityCount(): number {
  return useEntityStore((state) => state.navItems.size);
}
