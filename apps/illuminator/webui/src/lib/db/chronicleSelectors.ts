/**
 * Zustand selectors for chronicle store.
 *
 * Provides granular subscriptions so components only re-render when
 * the specific data they care about changes.
 */

import { useMemo, useEffect } from 'react';
import { useChronicleStore } from './chronicleStore';
import type { ChronicleRecord } from './chronicleRepository';
import type { ChronicleNavItem } from './chronicleNav';

// ============================================================================
// Nav item type — lightweight projection for the chronicle list sidebar
// ============================================================================

// ============================================================================
// Selectors
// ============================================================================

/**
 * Sorted nav items for the chronicle list sidebar.
 * Subscribes to the chronicles record (reference-stable per chronicle),
 * derives lightweight nav items in a useMemo.
 */
export function useChronicleNavItems(
  getEffectiveStatus?: (chronicleId: string, baseStatus: string) => string,
): ChronicleNavItem[] {
  const navItems = useChronicleStore((state) => state.navItems);
  const navOrder = useChronicleStore((state) => state.navOrder);

  return useMemo(() => {
    const items = navOrder
      .map((id) => navItems[id])
      .filter(Boolean) as ChronicleNavItem[];
    if (!getEffectiveStatus) return items;
    return items.map((item) => ({
      ...item,
      status: getEffectiveStatus(item.chronicleId, item.status),
    }));
  }, [navItems, navOrder, getEffectiveStatus]);
}

/**
 * Single chronicle record for the review panel.
 * Only re-renders when this specific chronicle's record reference changes.
 */
export function useSelectedChronicle(chronicleId: string | null): ChronicleRecord | undefined {
  const record = useChronicleStore((state) => (
    chronicleId ? state.cache.get(chronicleId) : undefined
  ));
  const loadChronicle = useChronicleStore((state) => state.loadChronicle);

  useEffect(() => {
    if (chronicleId) {
      loadChronicle(chronicleId);
    }
  }, [chronicleId, loadChronicle]);

  return record;
}

/**
 * Chronicle count for stats display.
 */
export function useChronicleCount(): number {
  return useChronicleStore((state) => state.navOrder.length);
}

/**
 * Get a chronicle record imperatively (not a subscription).
 * For use in event handlers and callbacks.
 */
export function getChronicleFromStore(chronicleId: string): ChronicleRecord | undefined {
  return useChronicleStore.getState().cache.get(chronicleId);
}
