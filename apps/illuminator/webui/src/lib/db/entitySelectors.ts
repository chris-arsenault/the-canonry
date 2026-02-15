/**
 * Zustand selectors for the entity store.
 *
 * Nav item selectors for list rendering (lightweight, always in memory).
 * Full entity access via useEntity() backed by the bounded cache.
 */

import { useMemo } from 'react';
import { useEntityStore } from './entityStore';
import type { PersistedEntity } from './illuminatorDb';
import type { EntityNavItem } from './entityNav';

const EMPTY_ARRAY: EntityNavItem[] = [];

/** Full nav item map — re-renders when any nav item changes */
export function useEntityNavItems(): Map<string, EntityNavItem> {
  return useEntityStore((state) => state.navItems);
}

/** Nav item array — derived from map, re-renders when any nav item changes */
export function useEntityNavList(): EntityNavItem[] {
  const navItems = useEntityStore((state) => state.navItems);
  return useMemo(
    () => (navItems.size ? Array.from(navItems.values()) : EMPTY_ARRAY),
    [navItems],
  );
}

/** Single nav item by ID — only re-renders when this specific nav item changes */
export function useEntityNavItem(id: string | undefined): EntityNavItem | undefined {
  return useEntityStore((state) => (id ? state.navItems.get(id) : undefined));
}

/** Single full entity from cache — only re-renders when cache changes */
export function useEntity(id: string | undefined): PersistedEntity | undefined {
  return useEntityStore((state) => (id ? state.cache.get(id) : undefined));
}

/** Entity count — only re-renders when count changes */
export function useEntityCount(): number {
  return useEntityStore((state) => state.navItems.size);
}
