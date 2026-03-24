/**
 * Page Layout Storage - Read/write access to layout overrides in the illuminator DB
 *
 * Layout overrides are stored in the 'illuminator' Dexie database.
 * Both Illuminator's DisplayOptionsPanel and the chronicler's LayoutEditor write here.
 */

import { openIlluminatorDb } from "@the-canonry/world-store";
import type { PageLayoutOverride } from "../types/world.ts";

const PAGE_LAYOUTS_STORE = "pageLayouts";

/**
 * Save a layout override record.
 */
export async function putPageLayout(record: PageLayoutOverride): Promise<void> {
  try {
    const db = await openIlluminatorDb();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(PAGE_LAYOUTS_STORE, "readwrite");
        const request = tx.objectStore(PAGE_LAYOUTS_STORE).put(record);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error ?? new Error("Failed to save page layout"));
      });
    } finally {
      db.close();
    }
  } catch (err) {
    console.error("[pageLayoutStorage] Failed to save layout:", err);
    throw err;
  }
}

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
