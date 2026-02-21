/**
 * useHistorianActions — Localized hook for historian operations.
 *
 * Extracts historian-related callbacks that previously threaded from
 * IlluminatorRemote → EntityBrowser → EntityDetailView as props:
 *   - handleHistorianEdition(entityId, tone)
 *   - handleHistorianReview(entityId, tone)
 *   - handleUpdateHistorianNote(targetType, targetId, noteId, updates)
 *   - historianConfigured (derived from config store)
 *   - isHistorianEditionActive, isHistorianActive (from config store)
 *
 * ## Architecture
 *
 * The primitive hooks (useHistorianEdition, useHistorianReview) remain in
 * IlluminatorRemote because they own modal state (run objects, accept/cancel).
 * Their `start*` functions are exposed via registerHistorianStarters(),
 * and their `isActive` flags are synced to the config store.
 *
 * The edition preview flow (compression check before starting) lives here
 * since it's part of the action logic, not modal rendering.
 */

import { useState, useCallback } from 'react';
import { useEntityStore } from '../lib/db/entityStore';
import { useChronicleStore } from '../lib/db/chronicleStore';
import { useIlluminatorConfigStore } from '../lib/db/illuminatorConfigStore';
import { isHistorianConfigured } from '../lib/historianTypes';
import {
  buildHistorianEditionContext,
  buildHistorianReviewContext,
} from '../lib/historianContextBuilders';
import { compressDescriptionHistory, COMPRESSION_FLOOR } from '../lib/descriptionHistoryCompression';
import { reloadEntities } from './useEntityCrud';
import * as entityRepo from '../lib/db/entityRepository';
import { getChronicle, updateChronicleHistorianNotes } from '../lib/db/chronicleRepository';
import type { HistorianEditionConfig } from './useHistorianEdition';
import type { HistorianReviewConfig } from './useHistorianReview';

// ============================================================================
// Bridge — IlluminatorRemote registers the primitive hook start functions
// ============================================================================

interface HistorianStarters {
  startHistorianEdition: (config: HistorianEditionConfig) => void;
  startHistorianReview: (config: HistorianReviewConfig) => void;
}

let _starters: HistorianStarters | null = null;

/**
 * Called by IlluminatorRemote to register the primitive hook start functions.
 * The isActive flags are synced to useIlluminatorConfigStore instead.
 */
export function registerHistorianStarters(starters: HistorianStarters): void {
  _starters = starters;
}

function getStarters(): HistorianStarters {
  if (!_starters) {
    throw new Error('registerHistorianStarters must be called before using useHistorianActions');
  }
  return _starters;
}

// ============================================================================
// Edition preview type
// ============================================================================

export interface EditionPreview {
  config: HistorianEditionConfig;
  entityName: string;
  originalCount: number;
  compressed: Array<{ description: string; source?: string; replacedAt?: number }>;
}

// ============================================================================
// Hook
// ============================================================================

export function useHistorianActions() {
  const historianConfig = useIlluminatorConfigStore((s) => s.historianConfig);
  const historianConfigured = isHistorianConfigured(historianConfig);
  const isHistorianEditionActive = useIlluminatorConfigStore((s) => s.isHistorianEditionActive);
  const isHistorianActive = useIlluminatorConfigStore((s) => s.isHistorianActive);

  // Edition preview state (compression check before starting)
  const [editionPreview, setEditionPreview] = useState<EditionPreview | null>(null);

  const handleHistorianEdition = useCallback(async (entityId: string, tone: string, reEdition?: boolean) => {
    const config = await buildHistorianEditionContext(entityId, tone, reEdition);
    if (!config) return;

    const history = config.descriptionHistory || [];
    if (history.length > COMPRESSION_FLOOR) {
      const compressed = compressDescriptionHistory(history);
      if (compressed.length < history.length) {
        setEditionPreview({
          config,
          entityName: config.entityName,
          originalCount: history.length,
          compressed,
        });
        return;
      }
    }
    getStarters().startHistorianEdition(config);
  }, []);

  const handleEditionPreviewProceed = useCallback(() => {
    if (editionPreview?.config) getStarters().startHistorianEdition(editionPreview.config);
    setEditionPreview(null);
  }, [editionPreview]);

  const handleEditionPreviewCancel = useCallback(() => {
    setEditionPreview(null);
  }, []);

  const handleHistorianReview = useCallback(async (entityId: string, tone: string) => {
    const config = await buildHistorianReviewContext(entityId, tone);
    if (config) getStarters().startHistorianReview(config);
  }, []);

  const handleUpdateHistorianNote = useCallback(
    async (
      targetType: string,
      targetId: string,
      noteId: string,
      updates: Record<string, unknown>,
    ) => {
      if (targetType === 'entity' && targetId) {
        const entity = await useEntityStore.getState().loadEntity(targetId);
        if (!entity?.enrichment?.historianNotes) return;
        const updatedNotes = entity.enrichment.historianNotes.map((n) =>
          n.noteId === noteId ? { ...n, ...updates } : n,
        );
        await entityRepo.setHistorianNotes(targetId, updatedNotes);
        await reloadEntities([targetId]);
      } else if (targetType === 'chronicle' && targetId) {
        try {
          const chronicle = await getChronicle(targetId);
          if (!chronicle?.historianNotes) return;
          const updatedNotes = chronicle.historianNotes.map((n: { noteId: string }) =>
            n.noteId === noteId ? { ...n, ...updates } : n,
          );
          await updateChronicleHistorianNotes(targetId, updatedNotes);
          await useChronicleStore.getState().refreshChronicle(targetId);
        } catch (err) {
          console.error('[Historian] Failed to update note:', err);
        }
      }
    },
    [],
  );

  return {
    historianConfigured,
    isHistorianEditionActive,
    isHistorianActive,
    handleHistorianEdition,
    handleHistorianReview,
    handleUpdateHistorianNote,
    editionPreview,
    handleEditionPreviewProceed,
    handleEditionPreviewCancel,
  };
}
