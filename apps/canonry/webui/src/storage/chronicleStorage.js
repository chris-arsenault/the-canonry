/**
 * Chronicle Storage - Read-only access to chronicles in the illuminator DB
 */

import { openIlluminatorDb } from "@the-canonry/world-store";

const CHRONICLE_STORE_NAME = "chronicles";

function filterCompleted(records = []) {
  return records
    .filter((record) => record.status === "complete" && record.acceptedAt)
    .sort((a, b) => (b.acceptedAt || 0) - (a.acceptedAt || 0));
}

export async function getCompletedChroniclesForSimulation(simulationRunId) {
  if (!simulationRunId) return [];

  try {
    const db = await openIlluminatorDb();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(CHRONICLE_STORE_NAME, "readonly");
        const store = tx.objectStore(CHRONICLE_STORE_NAME);
        const index = store.index("simulationRunId");
        const request = index.getAll(IDBKeyRange.only(simulationRunId));

        request.onsuccess = () => resolve(filterCompleted(request.result || []));
        request.onerror = () => reject(request.error || new Error("Failed to get chronicles"));
      });
    } finally {
      db.close();
    }
  } catch (err) {
    console.error("[chronicleStorage] Failed to load chronicles:", err);
    return [];
  }
}

export async function getCompletedChroniclesForProject(projectId) {
  if (!projectId) return [];

  try {
    const db = await openIlluminatorDb();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(CHRONICLE_STORE_NAME, "readonly");
        const store = tx.objectStore(CHRONICLE_STORE_NAME);
        const index = store.index("projectId");
        const request = index.getAll(IDBKeyRange.only(projectId));

        request.onsuccess = () => resolve(filterCompleted(request.result || []));
        request.onerror = () => reject(request.error || new Error("Failed to get chronicles"));
      });
    } finally {
      db.close();
    }
  } catch (err) {
    console.error("[chronicleStorage] Failed to load chronicles:", err);
    return [];
  }
}

/**
 * Import chronicles into a project (overwrite-merge by chronicleId).
 *
 * @param {string} projectId
 * @param {Array} chronicles
 * @param {Object} options
 * @param {string} options.simulationRunId - Optional run ID to apply when missing
 */
export async function importChronicles(projectId, chronicles, options = {}) {
  if (!projectId || !Array.isArray(chronicles) || chronicles.length === 0) {
    return { imported: 0, overwritten: 0, skipped: 0 };
  }

  const db = await openIlluminatorDb();
  const { simulationRunId } = options;
  let imported = 0;
  let overwritten = 0;
  let skipped = 0;

  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(CHRONICLE_STORE_NAME, "readwrite");
      const store = tx.objectStore(CHRONICLE_STORE_NAME);

      for (const chronicle of chronicles) {
        if (!chronicle?.chronicleId) {
          skipped += 1;
          continue;
        }
        const record = {
          ...chronicle,
          projectId,
          simulationRunId: chronicle.simulationRunId || simulationRunId || null,
        };
        const req = store.get(record.chronicleId);
        req.onsuccess = () => {
          if (req.result) overwritten += 1;
          store.put(record);
          imported += 1;
        };
        req.onerror = () => {
          skipped += 1;
        };
      }

      tx.oncomplete = () => resolve({ imported, overwritten, skipped });
      tx.onerror = () => reject(tx.error || new Error("Failed to import chronicles"));
    });
  } finally {
    db.close();
  }
}

export async function getChronicleCountForProject(projectId) {
  if (!projectId) return 0;
  const db = await openIlluminatorDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(CHRONICLE_STORE_NAME, "readonly");
      const store = tx.objectStore(CHRONICLE_STORE_NAME);
      const index = store.index("projectId");
      const request = index.count(projectId);
      request.onsuccess = () => resolve(request.result || 0);
      request.onerror = () => reject(request.error || new Error("Failed to count chronicles"));
    });
  } finally {
    db.close();
  }
}
