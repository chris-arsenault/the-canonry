/**
 * enrichmentQueueBridge — Module-level singleton for stable enqueue/cancel callbacks.
 *
 * IlluminatorRemote registers the callbacks once via registerQueue().
 * Hooks call getEnqueue() imperatively — no prop threading needed.
 *
 * ## Why a bridge and not a store
 *
 * enqueue/cancel are *actions* (stable function references), not reactive state.
 * A Zustand store would work but adds unnecessary subscription overhead. A module-level
 * singleton is simpler and sufficient — the functions never change identity.
 *
 * The companion enrichmentQueueStore holds the *reactive* queue state (QueueItem[], stats)
 * that components subscribe to for re-renders.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EnqueueFn = (items: any[]) => void;
type CancelFn = (itemId: string) => void;

let _enqueue: EnqueueFn | null = null;
let _cancel: CancelFn | null = null;

/**
 * Called by IlluminatorRemote to register the enrichment queue functions.
 */
export function registerQueue(enqueue: EnqueueFn, cancel: CancelFn): void {
  _enqueue = enqueue;
  _cancel = cancel;
}

export function getEnqueue(): EnqueueFn {
  if (!_enqueue) {
    throw new Error('registerQueue must be called before getEnqueue');
  }
  return _enqueue;
}

export function getCancel(): CancelFn {
  if (!_cancel) {
    throw new Error('registerQueue must be called before getCancel');
  }
  return _cancel;
}
