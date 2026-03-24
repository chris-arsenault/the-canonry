/**
 * Finalized Page Storage - Read-only access to finalized pages in the illuminator DB.
 *
 * Finalized pages are WYSIWYG-edited HTML stored as separate entities.
 * When present, the chronicler renders the finalized HTML directly
 * instead of running the normal build pipeline.
 */

import { openIlluminatorDb } from "@the-canonry/world-store";

const FINALIZED_PAGES_STORE = "finalizedPages";

export interface FinalizedPageRecord {
  pageId: string;
  simulationRunId: string;
  sourceChronicleId: string;
  title: string;
  htmlContent: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Get all finalized pages for a simulation run, keyed by pageId.
 */
export async function getFinalizedPageMap(
  simulationRunId: string
): Promise<Map<string, FinalizedPageRecord>> {
  if (!simulationRunId) return new Map();

  try {
    const db = await openIlluminatorDb();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(FINALIZED_PAGES_STORE, "readonly");
        const store = tx.objectStore(FINALIZED_PAGES_STORE);
        const index = store.index("simulationRunId");
        const request = index.getAll(IDBKeyRange.only(simulationRunId));

        request.onsuccess = () => {
          const map = new Map<string, FinalizedPageRecord>();
          for (const record of request.result as FinalizedPageRecord[]) {
            map.set(record.pageId, record);
          }
          resolve(map);
        };
        request.onerror = () => reject(request.error ?? new Error("Failed to get finalized pages"));
      });
    } finally {
      db.close();
    }
  } catch (err) {
    console.error("[finalizedPageStorage] Failed to load finalized pages:", err);
    return new Map();
  }
}
