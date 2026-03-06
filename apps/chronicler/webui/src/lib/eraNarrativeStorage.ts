/**
 * Era Narrative Storage - Read-only access to era narratives in the illuminator DB
 *
 * Era narratives are stored in the 'illuminator' IndexedDB by Illuminator.
 * Chronicler reads completed era narratives directly from here.
 */

import { openIlluminatorDb } from "@the-canonry/world-store";
import type { Optional } from "@the-canonry/shared-components";

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
  thesis: Optional<string>;

  /** Cover image metadata */
  coverImage: Optional<{
    sceneDescription: string;
    status: string;
    generatedImageId: Optional<string>;
  }>;

  /** Inline image refs (chronicle refs + generated scenes) */
  imageRefs: Optional<{
    refs: Array<{
      refId: string;
      type: string;
      anchorText: string;
      anchorIndex: Optional<number>;
      size: string;
      justification: Optional<"left" | "right">;
      caption: Optional<string>;
      // chronicle_ref fields
      imageId: Optional<string>;
      chronicleId: Optional<string>;
      // prompt_request fields
      sceneDescription: Optional<string>;
      status: Optional<string>;
      generatedImageId: Optional<string>;
    }>;
    generatedAt: number;
    model: string;
  }>;

  /** Source chronicle IDs and titles */
  sourceChronicles: Array<{ chronicleId: string; chronicleTitle: string }>;

  createdAt: number;
  updatedAt: number;
}

interface RawNarrativeContent {
  editedContent: Optional<string>;
  content: Optional<string>;
  editedWordCount: Optional<number>;
  wordCount: Optional<number>;
}

// eslint-disable-next-line complexity -- projects untyped IndexedDB records with legacy field layouts; each typeof/optional check handles a different storage format version
function resolveContent(raw: Record<string, unknown>): { content: string; wordCount: number } | null {
  const narrative = raw.narrative as RawNarrativeContent | undefined;
  const content =
    narrative?.editedContent ||
    narrative?.content ||
    (typeof raw.content === "string" ? raw.content : "");
  if (!content) return null;
  const wordCount =
    narrative?.editedWordCount ||
    narrative?.wordCount ||
    (typeof raw.wordCount === "number" ? raw.wordCount : 0);
  return { content, wordCount };
}

/** Extract source chronicles from prepBriefs or sourceChronicles fields */
function resolveSourceChronicles(raw: Record<string, unknown>): Array<{ chronicleId: string; chronicleTitle: string }> {
  if (Array.isArray(raw.prepBriefs)) {
    return (raw.prepBriefs as Array<{ chronicleId: string; chronicleTitle: string }>).map((b) => ({
      chronicleId: b.chronicleId,
      chronicleTitle: b.chronicleTitle,
    }));
  }
  if (Array.isArray(raw.sourceChronicles)) {
    return raw.sourceChronicles as Array<{ chronicleId: string; chronicleTitle: string }>;
  }
  return [];
}

/** Resolve thesis from threadSynthesis or top-level thesis field */
function resolveThesis(raw: Record<string, unknown>): string | undefined {
  const threadSynthesis = raw.threadSynthesis as { thesis: Optional<string> } | undefined;
  return threadSynthesis?.thesis || (typeof raw.thesis === "string" ? raw.thesis : undefined);
}

/**
 * Project a raw IndexedDB era narrative record into a view record.
 * Picks the best content (edited > draft) and strips generation metadata.
 */
// eslint-disable-next-line complexity -- maps untyped IndexedDB fields to a typed view record; each conditional handles an independent field projection
function projectToViewRecord(raw: Record<string, unknown>): EraNarrativeViewRecord | null {
  if (!raw || raw.status !== "complete") return null;

  const resolved = resolveContent(raw);
  if (!resolved) return null;

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
    content: resolved.content,
    wordCount: resolved.wordCount,
    thesis: resolveThesis(raw),
    coverImage:
      coverImage?.status === "complete" && coverImage?.generatedImageId ? coverImage : undefined,
    imageRefs: imageRefs?.refs?.length ? imageRefs : undefined,
    sourceChronicles: resolveSourceChronicles(raw),
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
