/**
 * Narrative Event Storage - Import events into the Illuminator Dexie DB
 *
 * Writes merged event records to the `narrativeEvents` store via raw IndexedDB.
 */

import { openIlluminatorDb } from '../lib/illuminatorDbReader';

const EVENTS_STORE_NAME = 'narrativeEvents';

function mergeDefined(target, source) {
  const merged = { ...target };
  for (const [key, value] of Object.entries(source || {})) {
    if (value !== undefined) merged[key] = value;
  }
  return merged;
}

export async function importNarrativeEvents(simulationRunId, events) {
  if (!simulationRunId || !Array.isArray(events) || events.length === 0) {
    return { imported: 0, overwritten: 0, skipped: 0 };
  }

  const db = await openIlluminatorDb();
  let imported = 0;
  let overwritten = 0;
  let skipped = 0;

  try {
    if (!db.objectStoreNames.contains(EVENTS_STORE_NAME)) {
      throw new Error('Illuminator narrativeEvents store is unavailable.');
    }

    return await new Promise((resolve, reject) => {
      const tx = db.transaction(EVENTS_STORE_NAME, 'readwrite');
      const store = tx.objectStore(EVENTS_STORE_NAME);

      for (const event of events) {
        if (!event?.id) {
          skipped += 1;
          continue;
        }

        const incoming = {
          ...event,
          simulationRunId: event.simulationRunId || simulationRunId,
        };

        const req = store.get(event.id);
        req.onsuccess = () => {
          const existing = req.result || {};
          if (req.result) overwritten += 1;
          const merged = mergeDefined(existing, incoming);
          merged.simulationRunId = incoming.simulationRunId || existing.simulationRunId || simulationRunId;
          store.put(merged);
          imported += 1;
        };
        req.onerror = () => {
          skipped += 1;
        };
      }

      tx.oncomplete = () => resolve({ imported, overwritten, skipped });
      tx.onerror = () => reject(tx.error || new Error('Failed to import narrative events'));
    });
  } finally {
    db.close();
  }
}

export async function getNarrativeEventCountForRun(simulationRunId) {
  if (!simulationRunId) return 0;
  const db = await openIlluminatorDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(EVENTS_STORE_NAME, 'readonly');
      const store = tx.objectStore(EVENTS_STORE_NAME);
      const index = store.index('simulationRunId');
      const request = index.count(simulationRunId);
      request.onsuccess = () => resolve(request.result || 0);
      request.onerror = () => reject(request.error || new Error('Failed to count narrative events'));
    });
  } finally {
    db.close();
  }
}
