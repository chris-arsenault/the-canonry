/**
 * enrichmentQueueStore — Zustand store for reactive queue state.
 *
 * IlluminatorRemote syncs queue and stats from useEnrichmentQueue into this store
 * via useEffect. Components read reactively via selectors.
 *
 * ## What lives here
 *
 * - queue: QueueItem[] — the full queue array for status lookups and filtering
 * - stats: QueueStats — pre-computed counts (queued, running, completed, errored)
 *
 * ## What does NOT live here
 *
 * - enqueue/cancel actions → enrichmentQueueBridge (stable function references, not reactive)
 * - Worker management, retry logic → useEnrichmentQueue (the source-of-truth hook)
 */

import { create } from "zustand";
import type { QueueItem } from "../enrichmentTypes";
import type { QueueStats } from "../../hooks/useEnrichmentQueue";

interface EnrichmentQueueStoreState {
  queue: QueueItem[];
  stats: QueueStats;
  setQueue: (queue: QueueItem[], stats: QueueStats) => void;
}

export const useEnrichmentQueueStore = create<EnrichmentQueueStoreState>((set) => ({
  queue: [],
  stats: { queued: 0, running: 0, completed: 0, errored: 0, total: 0 },
  setQueue: (queue, stats) => set({ queue, stats }),
}));
