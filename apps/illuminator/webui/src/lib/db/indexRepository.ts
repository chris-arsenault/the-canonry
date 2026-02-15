/**
 * Index Repository — Dexie query wrapper for precomputed run indexes.
 *
 * Stateless. No caching, no subscriptions.
 */

import { db } from './illuminatorDb';
import type { RunIndexRecord } from './indexTypes';

export async function getRunIndexes(
  simulationRunId: string,
): Promise<RunIndexRecord | undefined> {
  return db.runIndexes.get(simulationRunId);
}

export async function upsertRunIndexes(record: RunIndexRecord): Promise<void> {
  await db.runIndexes.put(record);
}

export async function deleteRunIndexes(simulationRunId: string): Promise<void> {
  await db.runIndexes.delete(simulationRunId);
}
