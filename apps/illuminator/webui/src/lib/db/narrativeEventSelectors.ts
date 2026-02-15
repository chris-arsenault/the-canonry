/**
 * Zustand selectors for the narrative event store.
 *
 * Provides granular subscriptions so components only re-render when
 * the specific event data they care about changes.
 */

import { useNarrativeEventStore } from './narrativeEventStore';

/** Full narrative events array — re-renders when events change */
export function useNarrativeEvents() {
  return useNarrativeEventStore((state) => state.events);
}

/** Event count — re-renders when count changes */
export function useNarrativeEventCount(): number {
  return useNarrativeEventStore((state) => state.events.length);
}
