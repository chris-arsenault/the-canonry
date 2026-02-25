/**
 * Era Narrative Storage - Read-only access to era narratives in the illuminator DB
 *
 * Era narratives are stored in the 'illuminator' IndexedDB by Illuminator.
 * Chronicler reads completed era narratives directly from here.
 */

import { openIlluminatorDb } from "./illuminatorDbReader";

const ERA_NARRATIVE_STORE_NAME = "eraNarratives";

/**
 * Viewer-facing era narrative record.
 * Subset of IlluminatorEraNarrativeRecord with only display-relevant fields.
 */
export interface EraNarrativeViewRecord {
  narrativeId: string;
  projectId: string;
  simulationRunId: string;
  eraId: string;
  eraName: string;
  status: string;
  tone: string;

  /** Final prose text (editedContent preferred, falls back to content) */
  content: string;
  wordCount: number;

  /** Analytical thesis — one-sentence summary of the era's transformation */
  thesis?: string;

  /** Cover image metadata */
  coverImage?: {
    sceneDescription: string;
    status: string;
    generatedImageId?: string;
  };

  /** Inline image refs (chronicle refs + generated scenes) */
  imageRefs?: {
    refs: Array<{
      refId: string;
      type: string;
      anchorText: string;
      anchorIndex?: number;
      size: string;
      justification?: "left" | "right";
      caption?: string;
      // chronicle_ref fields
      imageId?: string;
      chronicleId?: string;
      // prompt_request fields
      sceneDescription?: string;
      status?: string;
      generatedImageId?: string;
    }>;
    generatedAt: number;
    model: string;
  };

  /** Source chronicle IDs and titles */
  sourceChronicles: Array<{ chronicleId: string; chronicleTitle: string }>;

  createdAt: number;
  updatedAt: number;
}

/**
 * Project a raw IndexedDB era narrative record into a view record.
 * Picks the best content (edited > draft) and strips generation metadata.
 */
function projectToViewRecord(raw: Record<string, unknown>): EraNarrativeViewRecord | null {
  if (!raw || raw.status !== "complete") return null;

  const narrative = raw.narrative as
    | {
        editedContent?: string;
        content?: string;
        editedWordCount?: number;
        wordCount?: number;
      }
    | undefined;

  // Support both full records (content under narrative) and viewer-projected records (content at top level)
  const content =
    narrative?.editedContent ||
    narrative?.content ||
    (typeof raw.content === "string" ? raw.content : "");
  if (!content) return null;

  const threadSynthesis = raw.threadSynthesis as { thesis?: string } | undefined;
  const prepBriefs = Array.isArray(raw.prepBriefs)
    ? (raw.prepBriefs as Array<{ chronicleId: string; chronicleTitle: string }>).map((b) => ({
        chronicleId: b.chronicleId,
        chronicleTitle: b.chronicleTitle,
      }))
    : Array.isArray(raw.sourceChronicles)
      ? (raw.sourceChronicles as Array<{ chronicleId: string; chronicleTitle: string }>)
      : [];

  const coverImage = raw.coverImage as EraNarrativeViewRecord["coverImage"] | undefined;
  const imageRefs = raw.imageRefs as EraNarrativeViewRecord["imageRefs"] | undefined;

  return {
    narrativeId: raw.narrativeId as string,
    projectId: raw.projectId as string,
    simulationRunId: raw.simulationRunId as string,
    eraId: raw.eraId as string,
    eraName: raw.eraName as string,
    status: raw.status as string,
    tone: raw.tone as string,
    content,
    wordCount:
      narrative?.editedWordCount ||
      narrative?.wordCount ||
      (typeof raw.wordCount === "number" ? raw.wordCount : 0),
    thesis: threadSynthesis?.thesis || (typeof raw.thesis === "string" ? raw.thesis : undefined),
    coverImage:
      coverImage?.status === "complete" && coverImage?.generatedImageId ? coverImage : undefined,
    imageRefs: imageRefs?.refs?.length ? imageRefs : undefined,
    sourceChronicles: prepBriefs,
    createdAt: raw.createdAt as number,
    updatedAt: raw.updatedAt as number,
  };
}

/**
 * Get all completed era narratives for a simulation run.
 * Returns at most one narrative per era (the most recently updated).
 */
export async function getCompletedEraNarrativesForSimulation(
  simulationRunId: string
): Promise<EraNarrativeViewRecord[]> {
  if (!simulationRunId) return [];

  try {
    const db = await openIlluminatorDb();
    try {
      // Check if the store exists (older DB versions may not have it)
      if (!db.objectStoreNames.contains(ERA_NARRATIVE_STORE_NAME)) {
        return [];
      }

      return await new Promise((resolve, reject) => {
        const tx = db.transaction(ERA_NARRATIVE_STORE_NAME, "readonly");
        const store = tx.objectStore(ERA_NARRATIVE_STORE_NAME);
        const index = store.index("simulationRunId");
        const request = index.getAll(IDBKeyRange.only(simulationRunId));

        request.onsuccess = () => {
          const allRecords = request.result as Record<string, unknown>[];
          const projected = allRecords
            .map(projectToViewRecord)
            .filter((r): r is EraNarrativeViewRecord => r !== null);

          // Keep only the latest completed narrative per era
          const byEra = new Map<string, EraNarrativeViewRecord>();
          for (const record of projected) {
            const existing = byEra.get(record.eraId);
            if (!existing || record.updatedAt > existing.updatedAt) {
              byEra.set(record.eraId, record);
            }
          }

          resolve(Array.from(byEra.values()));
        };

        request.onerror = () => reject(request.error || new Error("Failed to get era narratives"));
      });
    } finally {
      db.close();
    }
  } catch (err) {
    console.error("[eraNarrativeStorage] Failed to load era narratives:", err);
    return [];
  }
}

/**
 * Get the display content for an era narrative.
 */
export function getEraNarrativeContent(narrative: EraNarrativeViewRecord): string {
  return narrative.content;
}
