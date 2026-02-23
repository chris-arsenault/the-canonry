/**
 * useEntityCrud — Localized hook for entity CRUD operations.
 *
 * Extracts 8 mutation callbacks that previously threaded from IlluminatorRemote →
 * EntityBrowser → EntityDetailView as props. Each follows the same pattern:
 *   1. Call an entityRepository method
 *   2. Refresh the entity store
 *   3. Dispatch worlddata-changed event
 *
 * The hook reads simulationRunId imperatively from entityStore, so it has zero
 * dependencies on props or parent component state.
 *
 * ## Usage
 *
 *   const { handleAssignImage, handleDeleteEntity, ... } = useEntityCrud();
 *
 * ## Exported helper
 *
 *   reloadEntities(ids?) — standalone function for use outside of React components
 *   (e.g. in other action hooks). Reads simulationRunId from entity store.
 */

import { useCallback } from 'react';
import * as entityRepo from '../lib/db/entityRepository';
import { useEntityStore } from '../lib/db/entityStore';

// ============================================================================
// Module-level helper — reusable by other hooks without prop threading
// ============================================================================

/**
 * Refresh entity store and notify the host shell.
 * Reads simulationRunId imperatively from the entity store.
 */
export async function reloadEntities(invalidateIds?: string[]): Promise<void> {
  const store = useEntityStore.getState();
  const { simulationRunId } = store;
  if (!simulationRunId) return;

  if (invalidateIds?.length) {
    await store.refreshEntities(invalidateIds);
  } else {
    await store.refreshAll();
  }

  window.dispatchEvent(
    new CustomEvent('illuminator:worlddata-changed', {
      detail: { simulationRunId, scope: 'entities' },
    }),
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useEntityCrud() {
  const handleAssignImage = useCallback(
    async (entityId: string, imageId: string, imageMetadata?: { generatedAt?: number; model?: string; revisedPrompt?: string }) => {
      await entityRepo.assignImage(entityId, imageId, imageMetadata);
      await reloadEntities([entityId]);
    },
    [],
  );

  const handleUpdateBackrefs = useCallback(
    async (entityId: string, updatedBackrefs: Parameters<typeof entityRepo.updateBackrefs>[1]) => {
      await entityRepo.updateBackrefs(entityId, updatedBackrefs);
      await reloadEntities([entityId]);
    },
    [],
  );

  const handleUndoDescription = useCallback(async (entityId: string) => {
    await entityRepo.undoDescription(entityId);
    await reloadEntities([entityId]);
  }, []);

  const handleUpdateAliases = useCallback(async (entityId: string, aliases: string[]) => {
    await entityRepo.updateAliases(entityId, aliases);
    await reloadEntities([entityId]);
  }, []);

  const handleUpdateDescription = useCallback(async (entityId: string, description: string) => {
    await entityRepo.updateDescriptionManual(entityId, description);
    await reloadEntities([entityId]);
  }, []);

  const handleUpdateSummary = useCallback(async (entityId: string, summary: string) => {
    await entityRepo.updateSummaryManual(entityId, summary);
    await reloadEntities([entityId]);
  }, []);

  const handleClearNotes = useCallback(async (entityId: string) => {
    await entityRepo.setHistorianNotes(entityId, []);
    await reloadEntities([entityId]);
  }, []);

  const handleRestoreDescription = useCallback(async (entityId: string, historyIndex: number) => {
    await entityRepo.restoreDescriptionFromHistory(entityId, historyIndex);
    await reloadEntities([entityId]);
  }, []);

  const handleDeleteEntity = useCallback(async (entity: { id: string; name: string }) => {
    if (!entity.id.startsWith('manual_')) return;
    if (!confirm(`Delete "${entity.name}"? This cannot be undone.`)) return;
    try {
      await entityRepo.deleteEntity(entity.id);
      await reloadEntities([entity.id]);
    } catch (err) {
      console.error('[Illuminator] Delete entity failed:', err);
    }
  }, []);

  return {
    handleAssignImage,
    handleUpdateBackrefs,
    handleUndoDescription,
    handleUpdateAliases,
    handleUpdateDescription,
    handleUpdateSummary,
    handleClearNotes,
    handleRestoreDescription,
    handleDeleteEntity,
  };
}
