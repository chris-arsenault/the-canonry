/**
 * Page Layout Repository
 *
 * Persists per-page layout overrides to IndexedDB.
 * Each override is keyed by [simulationRunId, pageId].
 */

import { db } from './illuminatorDb';
import type { PageLayoutOverride } from '../preprint/prePrintTypes';

export async function getPageLayout(
  simulationRunId: string,
  pageId: string
): Promise<PageLayoutOverride | null> {
  const record = await db.pageLayouts.get([simulationRunId, pageId]);
  return record ?? null;
}

export async function putPageLayout(override: PageLayoutOverride): Promise<void> {
  await db.pageLayouts.put(override);
}

export async function deletePageLayout(
  simulationRunId: string,
  pageId: string
): Promise<void> {
  await db.pageLayouts.delete([simulationRunId, pageId]);
}

export async function getAllPageLayouts(
  simulationRunId: string
): Promise<PageLayoutOverride[]> {
  return db.pageLayouts.where('simulationRunId').equals(simulationRunId).toArray();
}

export async function getPageLayoutMap(
  simulationRunId: string
): Promise<Map<string, PageLayoutOverride>> {
  const all = await getAllPageLayouts(simulationRunId);
  const map = new Map<string, PageLayoutOverride>();
  for (const o of all) {
    map.set(o.pageId, o);
  }
  return map;
}
