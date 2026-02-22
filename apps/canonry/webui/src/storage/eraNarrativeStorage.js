/**
 * Era Narrative Storage - Read-only access to era narratives in the illuminator DB
 *
 * Reads completed era narratives for bundle export.
 * Returns at most one narrative per era (the most recently updated).
 */

import { openIlluminatorDb } from '../lib/illuminatorDbReader';

const STORE_NAME = 'eraNarratives';

/**
 * Project a raw era narrative record into a viewer-friendly format.
 * Strips generation metadata, keeps only display-relevant fields.
 */
function projectForExport(raw) {
  if (!raw || raw.status !== 'complete') return null;

  const narrative = raw.narrative;
  const content = narrative?.editedContent || narrative?.content || '';
  if (!content) return null;

  return {
    narrativeId: raw.narrativeId,
    projectId: raw.projectId,
    simulationRunId: raw.simulationRunId,
    eraId: raw.eraId,
    eraName: raw.eraName,
    status: raw.status,
    tone: raw.tone,
    content,
    wordCount: narrative?.editedWordCount || narrative?.wordCount || 0,
    thesis: raw.threadSynthesis?.thesis || undefined,
    coverImage: raw.coverImage || undefined,
    imageRefs: raw.imageRefs || undefined,
    sourceChronicles: Array.isArray(raw.prepBriefs)
      ? raw.prepBriefs.map((b) => ({
          chronicleId: b.chronicleId,
          chronicleTitle: b.chronicleTitle,
        }))
      : [],
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export async function getCompletedEraNarrativesForSimulation(simulationRunId) {
  if (!simulationRunId) return [];

  try {
    const db = await openIlluminatorDb();
    try {
      // Check if the store exists (older DB versions may not have it)
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        return [];
      }

      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const index = store.index('simulationRunId');
        const request = index.getAll(IDBKeyRange.only(simulationRunId));

        request.onsuccess = () => {
          const allRecords = request.result || [];
          const projected = allRecords
            .map(projectForExport)
            .filter(Boolean);

          // Keep only the latest completed narrative per era
          const byEra = new Map();
          for (const record of projected) {
            const existing = byEra.get(record.eraId);
            if (!existing || record.updatedAt > existing.updatedAt) {
              byEra.set(record.eraId, record);
            }
          }

          resolve(Array.from(byEra.values()));
        };

        request.onerror = () =>
          reject(request.error || new Error('Failed to get era narratives'));
      });
    } finally {
      db.close();
    }
  } catch (err) {
    console.error('[eraNarrativeStorage] Failed to load era narratives:', err);
    return [];
  }
}
