/**
 * Chronicle status derivation.
 *
 * Derives chronicle status from what data is present in the record,
 * eliminating status synchronization issues.
 *
 * NOTE: The original useChronicleGeneration hook has been replaced by:
 *   - chronicleStore.ts — Zustand store for chronicle data
 *   - chronicleSelectors.ts — Granular selectors for nav list & selected chronicle
 *   - useChronicleActions.ts — Enqueue-dependent chronicle actions
 *   - useChronicleQueueWatcher.ts — Bridges queue completions to store refreshes
 */

import type { ChronicleRecord } from '../lib/db/chronicleRepository';

/**
 * Derive status from what's present in the record.
 * This eliminates status synchronization issues.
 */
export function deriveStatus(record: ChronicleRecord | undefined): string {
  if (!record) return 'not_started';

  if (record.status === 'failed') return 'failed';

  // Check for in-progress states (worker is running)
  if (record.status === 'generating') {
    return record.status;
  }

  // Derive from data presence (completed states)
  if (record.finalContent || record.status === 'complete') return 'complete';
  if (record.assembledContent) return 'assembly_ready';

  return 'not_started';
}
