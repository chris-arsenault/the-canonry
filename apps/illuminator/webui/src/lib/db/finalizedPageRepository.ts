/**
 * Finalized Page Repository — CRUD for WYSIWYG-edited chronicle HTML.
 *
 * Finalized pages are completely separate entities from source chronicles.
 * The original chronicle content is never modified.
 */

import { db, type FinalizedPageRecord } from "./illuminatorDb";

export type { FinalizedPageRecord };

export async function getFinalizedPage(
  simulationRunId: string,
  pageId: string
): Promise<FinalizedPageRecord | null> {
  const record = await db.finalizedPages.get([simulationRunId, pageId]);
  return record ?? null;
}

export async function putFinalizedPage(record: FinalizedPageRecord): Promise<void> {
  await db.finalizedPages.put(record);
}

export async function deleteFinalizedPage(
  simulationRunId: string,
  pageId: string
): Promise<void> {
  await db.finalizedPages.delete([simulationRunId, pageId]);
}

export async function getAllFinalizedPages(
  simulationRunId: string
): Promise<FinalizedPageRecord[]> {
  return db.finalizedPages.where("simulationRunId").equals(simulationRunId).toArray();
}

export async function getFinalizedPageMap(
  simulationRunId: string
): Promise<Map<string, FinalizedPageRecord>> {
  const all = await getAllFinalizedPages(simulationRunId);
  const map = new Map<string, FinalizedPageRecord>();
  for (const record of all) {
    map.set(record.pageId, record);
  }
  return map;
}
