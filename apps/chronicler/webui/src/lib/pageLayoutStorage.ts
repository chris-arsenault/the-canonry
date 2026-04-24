/**
 * Page Layout Storage - Read-only access to layout overrides in the illuminator DB
 *
 * Layout overrides are stored in the 'illuminator' Dexie database by Illuminator's
 * PrePrint PageLayoutEditor. Chronicler reads them to apply per-page display settings.
 */

import { openIlluminatorDb } from "@the-canonry/world-store";
import type { PageLayoutOverride } from "../types/world.ts";

const PAGE_LAYOUTS_STORE = "pageLayouts";

/**
 * Get all layout overrides for a simulation run, keyed by pageId.
 */
export async function getPageLayoutMap(
  simulationRunId: string
): Promise<Map<string, PageLayoutOverride>> {
  if (!simulationRunId) return new Map();

  try {
    const db = await openIlluminatorDb();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(PAGE_LAYOUTS_STORE, "readonly");
        const store = tx.objectStore(PAGE_LAYOUTS_STORE);
        const index = store.index("simulationRunId");
        const request = index.getAll(IDBKeyRange.only(simulationRunId));

        request.onsuccess = () => {
          const map = new Map<string, PageLayoutOverride>();
          for (const record of request.result as PageLayoutOverride[]) {
            map.set(record.pageId, record);
          }
          resolve(map);
        };
        request.onerror = () => reject(request.error ?? new Error("Failed to get page layouts"));
      });
    } finally {
      db.close();
    }
  } catch (err) {
    console.error("[pageLayoutStorage] Failed to load page layouts:", err);
    return new Map();
  }
}
