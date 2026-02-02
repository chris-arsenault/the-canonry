/**
 * Chronicle Storage - Read-only access to chronicles in the illuminator DB
 *
 * Chronicles are stored in the 'illuminator' Dexie database by Illuminator.
 * Chronicler reads completed chronicles directly from here.
 */

import { openIlluminatorDb } from './illuminatorDbReader';

const CHRONICLE_STORE_NAME = 'chronicles';

/**
 * Role assignment (matching illuminator's ChronicleRoleAssignment)
 */
export interface ChronicleRoleAssignment {
  role: string;
  entityId: string;
  entityName: string;
  entityKind: string;
  isPrimary: boolean;
}

/**
 * Chronicle record structure (subset of fields needed for display)
 */
export interface ChronicleRecord {
  chronicleId: string;
  projectId: string;
  simulationRunId: string;

  status: string;

  // Chronicle identity (seed data)
  title: string;
  format: 'story' | 'document';
  focusType: 'single' | 'ensemble' | 'relationship' | 'event';
  narrativeStyleId: string;
  entrypointId?: string;
  roleAssignments: ChronicleRoleAssignment[];
  selectedEntityIds: string[];
  selectedEventIds: string[];
  selectedRelationshipIds: string[];
  temporalContext?: {
    focalEra?: { id: string; name: string; summary?: string };
    chronicleTickRange?: [number, number];
    temporalScope?: string;
    isMultiEra?: boolean;
    touchedEraIds?: string[];
    temporalDescription?: string;
    [key: string]: unknown;
  };

  // Content
  assembledContent?: string;
  finalContent?: string;
  summary?: string;

  // Image refs for inline images
  imageRefs?: {
    refs: Array<{
      refId: string;
      anchorText: string;
      anchorIndex?: number;
      size: 'small' | 'medium' | 'large' | 'full-width';
      justification?: 'left' | 'right';
      caption?: string;
      type: 'entity_ref' | 'prompt_request';
      entityId?: string;
      sceneDescription?: string;
      status?: 'pending' | 'generating' | 'complete' | 'failed';
      generatedImageId?: string;
    }>;
    generatedAt: number;
    model: string;
  };

  // Cover image (montage-style chronicle overview)
  coverImage?: {
    sceneDescription: string;
    involvedEntityIds: string[];
    status: 'pending' | 'generating' | 'complete' | 'failed';
    generatedImageId?: string;
    error?: string;
  };

  // Historian annotations
  historianNotes?: Array<{
    noteId: string;
    anchorPhrase: string;
    text: string;
    type: string;
    display?: 'disabled' | 'popout' | 'full';
    /** @deprecated Use `display` instead */
    enabled?: boolean;
  }>;

  // Timestamps
  acceptedAt?: number;
  createdAt: number;
  updatedAt: number;

  // Model info
  model: string;
}

/**
 * Get all completed chronicles for a simulation run
 */
export async function getCompletedChroniclesForSimulation(simulationRunId: string): Promise<ChronicleRecord[]> {
  if (!simulationRunId) return [];

  try {
    const db = await openIlluminatorDb();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(CHRONICLE_STORE_NAME, 'readonly');
        const store = tx.objectStore(CHRONICLE_STORE_NAME);
        const index = store.index('simulationRunId');
        const request = index.getAll(IDBKeyRange.only(simulationRunId));

        request.onsuccess = () => {
          const allChronicles = request.result as ChronicleRecord[];
          // Filter to only completed chronicles
          const completed = allChronicles.filter((c) => c.status === 'complete' && c.acceptedAt);
          // Sort by acceptedAt descending
          completed.sort((a, b) => (b.acceptedAt || 0) - (a.acceptedAt || 0));
          resolve(completed);
        };

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

/**
 * Get a single chronicle by ID
 */
export async function getChronicle(chronicleId: string): Promise<ChronicleRecord | null> {
  if (!chronicleId) return null;

  try {
    const db = await openIlluminatorDb();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(CHRONICLE_STORE_NAME, 'readonly');
        const request = tx.objectStore(CHRONICLE_STORE_NAME).get(chronicleId);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error || new Error('Failed to get chronicle'));
      });
    } finally {
      db.close();
    }
  } catch (err) {
    console.error('[chronicleStorage] Failed to load chronicle:', err);
    return null;
  }
}

/**
 * Get the content to display for a chronicle
 * Prefers finalContent (accepted), falls back to assembledContent
 */
export function getChronicleContent(chronicle: ChronicleRecord): string {
  return chronicle.finalContent || chronicle.assembledContent || '';
}
