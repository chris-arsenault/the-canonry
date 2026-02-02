/**
 * Content Tree Repository
 *
 * Persists the pre-print content tree to IndexedDB.
 * One tree per project+simulationRun, stored as a single record.
 */

import { db } from './illuminatorDb';
import type { ContentTreeState } from '../preprint/prePrintTypes';

export async function loadTree(
  projectId: string,
  simulationRunId: string
): Promise<ContentTreeState | null> {
  const record = await db.contentTrees.get([projectId, simulationRunId]);
  return record ?? null;
}

export async function saveTree(tree: ContentTreeState): Promise<void> {
  await db.contentTrees.put(tree);
}

export async function deleteTree(
  projectId: string,
  simulationRunId: string
): Promise<void> {
  await db.contentTrees.delete([projectId, simulationRunId]);
}
