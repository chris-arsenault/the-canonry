/**
 * useChronicleQueueWatcher - Bridges the enrichment queue to the chronicle store.
 *
 * Watches for entityChronicle task completions in the queue and triggers
 * targeted refreshChronicle() calls on the Zustand store.
 */

import { useEffect, useRef } from 'react';
import type { QueueItem } from '../lib/enrichmentTypes';
import { useChronicleStore } from '../lib/db/chronicleStore';

export function useChronicleQueueWatcher(queue: QueueItem[]): void {
  const processedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const chronicleTasks = queue.filter((item) => item.type === 'entityChronicle');

    const completedTasks = chronicleTasks.filter(
      (item) =>
        (item.status === 'complete' || item.status === 'error') &&
        !processedRef.current.has(item.id),
    );

    if (completedTasks.length > 0) {
      const chronicleIds = new Set<string>();
      for (const task of completedTasks) {
        processedRef.current.add(task.id);
        if (task.chronicleId) {
          chronicleIds.add(task.chronicleId);
        }
        console.log(
          `[Chronicle] Task ${task.id} completed (${task.status}), refreshing chronicle ${task.chronicleId ?? '(unknown)'}`,
        );
      }

      const store = useChronicleStore.getState();
      if (chronicleIds.size > 0) {
        for (const id of chronicleIds) {
          store.refreshChronicle(id);
        }
      } else {
        store.refreshAll();
      }
    }
  }, [queue]);
}
