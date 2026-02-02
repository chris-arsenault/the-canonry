/**
 * Chronicle Storage - Read-only access to chronicles in the illuminator DB
 */

import { openIlluminatorDb } from '../lib/illuminatorDbReader';

const CHRONICLE_STORE_NAME = 'chronicles';

function filterCompleted(records = []) {
  return records
    .filter((record) => record.status === 'complete' && record.acceptedAt)
    .sort((a, b) => (b.acceptedAt || 0) - (a.acceptedAt || 0));
}

export async function getCompletedChroniclesForSimulation(simulationRunId) {
  if (!simulationRunId) return [];

  try {
    const db = await openIlluminatorDb();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(CHRONICLE_STORE_NAME, 'readonly');
        const store = tx.objectStore(CHRONICLE_STORE_NAME);
        const index = store.index('simulationRunId');
        const request = index.getAll(IDBKeyRange.only(simulationRunId));

        request.onsuccess = () => resolve(filterCompleted(request.result || []));
        request.onerror = () => reject(request.error || new Error('Failed to get chronicles'));
      });
    } finally {
      db.close();
    }
  } catch (err) {
    console.error('[chronicleStorage] Failed to load chronicles:', err);
    return [];
  }
}

export async function getCompletedChroniclesForProject(projectId) {
  if (!projectId) return [];

  try {
    const db = await openIlluminatorDb();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(CHRONICLE_STORE_NAME, 'readonly');
        const store = tx.objectStore(CHRONICLE_STORE_NAME);
        const index = store.index('projectId');
        const request = index.getAll(IDBKeyRange.only(projectId));

        request.onsuccess = () => resolve(filterCompleted(request.result || []));
        request.onerror = () => reject(request.error || new Error('Failed to get chronicles'));
      });
    } finally {
      db.close();
    }
  } catch (err) {
    console.error('[chronicleStorage] Failed to load chronicles:', err);
    return [];
  }
}
