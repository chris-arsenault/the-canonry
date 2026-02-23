/**
 * useChronicleActions - Thin hook for enqueue-dependent chronicle actions.
 *
 * Receives onEnqueue from props (the enrichment queue system) and provides
 * action functions that read chronicle data from the Zustand store imperatively.
 * This separation keeps the store free of prop-dependent closures.
 */

import { useCallback } from 'react';
import type { ChronicleGenerationContext, ChronicleSampling } from '../lib/chronicleTypes';
import type { EnrichmentType, ChronicleStep } from '../lib/enrichmentTypes';
import { getEnqueue } from '../lib/db/enrichmentQueueBridge';
import { useChronicleStore } from '../lib/db/chronicleStore';
import type { ChronicleRecord } from '../lib/db/chronicleRepository';

// ============================================================================
// Types
// ============================================================================

export interface ChronicleMetadata {
  chronicleId: string;
  title?: string;
  format: 'story' | 'document';
  generationSampling: ChronicleSampling;
  roleAssignments: Array<{
    role: string;
    entityId: string;
    entityName: string;
    entityKind: string;
    isPrimary: boolean;
  }>;
  lens?: { entityId: string; entityName: string; entityKind: string };
  narrativeStyleId: string;
  narrativeStyle?: unknown;
  selectedEntityIds: string[];
  selectedEventIds: string[];
  selectedRelationshipIds: string[];
  entrypointId?: string;
  temporalContext?: unknown;
}

// OnEnqueue type removed — hooks now use getEnqueue() from enrichmentQueueBridge

// ============================================================================
// Helpers
// ============================================================================

function buildEntityRefFromContext(
  chronicleId: string,
  context: ChronicleGenerationContext,
  chronicle?: ChronicleRecord,
) {
  const primaryEntityId = context.focus.primaryEntityIds[0] || context.focus.selectedEntityIds[0];
  const primaryEntity = primaryEntityId
    ? context.entities.find((e) => e.id === primaryEntityId)
    : undefined;

  return primaryEntity
    ? {
        id: primaryEntity.id,
        name: primaryEntity.name,
        kind: primaryEntity.kind,
        subtype: primaryEntity.subtype || '',
        prominence: primaryEntity.prominence,
        culture: primaryEntity.culture || '',
        status: primaryEntity.status,
        description: primaryEntity.description || '',
        tags: primaryEntity.tags as Record<string, unknown>,
      }
    : {
        id: chronicleId,
        name: chronicle?.title || 'Chronicle',
        kind: 'chronicle',
        subtype: '',
        prominence: 'recognized',
        culture: '',
        status: 'active',
        description: '',
        tags: {},
      };
}

function buildEntityRefFromRecord(chronicleId: string, chronicle: ChronicleRecord) {
  const primaryRole =
    chronicle.roleAssignments?.find((r) => r.isPrimary) || chronicle.roleAssignments?.[0];

  return primaryRole
    ? {
        id: primaryRole.entityId,
        name: primaryRole.entityName,
        kind: primaryRole.entityKind,
        subtype: '',
        prominence: 'recognized',
        culture: '',
        status: 'active',
        description: '',
        tags: {},
      }
    : {
        id: chronicleId,
        name: chronicle.title || 'Chronicle',
        kind: 'chronicle',
        subtype: '',
        prominence: 'recognized',
        culture: '',
        status: 'active',
        description: '',
        tags: {},
      };
}

// ============================================================================
// Hook
// ============================================================================

export function useChronicleActions() {
  const getChronicle = useCallback(
    (chronicleId: string): ChronicleRecord | undefined =>
      useChronicleStore.getState().cache.get(chronicleId),
    [],
  );

  const generateV2 = useCallback(
    (
      chronicleId: string,
      context: ChronicleGenerationContext,
      metadata: ChronicleMetadata | undefined,
    ) => {
      if (!context.focus) {
        console.error('[Chronicle V2] Focus context required');
        return;
      }
      if (!context.narrativeStyle) {
        console.error('[Chronicle V2] Narrative style required for generation');
        return;
      }

      const chronicle = getChronicle(chronicleId);
      const entity = buildEntityRefFromContext(chronicleId, context, chronicle);

      getEnqueue()([
        {
          entity,
          type: 'entityChronicle' as EnrichmentType,
          prompt: '',
          chronicleContext: context,
          chronicleStep: 'generate_v2',
          chronicleId: metadata?.chronicleId || chronicleId,
          chronicleMetadata: metadata,
        },
      ]);
    },
    [getChronicle],
  );

  const generateSummary = useCallback(
    (chronicleId: string, context: ChronicleGenerationContext) => {
      const chronicle = getChronicle(chronicleId);
      if (!chronicle) {
        console.error('[Chronicle] No chronicle found for chronicleId', chronicleId);
        return;
      }
      if (chronicle.finalContent) {
        console.error('[Chronicle] Summary refinements are only available before acceptance');
        return;
      }
      if (!chronicle.assembledContent) {
        console.error('[Chronicle] No assembled content to summarize');
        return;
      }
      if (!context.narrativeStyle) {
        console.error('[Chronicle] Narrative style required to generate summary');
        return;
      }

      getEnqueue()([
        {
          entity: buildEntityRefFromContext(chronicleId, context, chronicle),
          type: 'entityChronicle' as EnrichmentType,
          prompt: '',
          chronicleContext: context,
          chronicleStep: 'summary',
          chronicleId,
        },
      ]);
    },
    [getChronicle],
  );

  const generateTitle = useCallback(
    (chronicleId: string) => {
      const chronicle = getChronicle(chronicleId);
      if (!chronicle) {
        console.error('[Chronicle] No chronicle found for chronicleId', chronicleId);
        return;
      }
      const content = chronicle.finalContent || chronicle.assembledContent;
      if (!content) {
        console.error('[Chronicle] No content to generate title from');
        return;
      }

      getEnqueue()([
        {
          entity: buildEntityRefFromRecord(chronicleId, chronicle),
          type: 'entityChronicle' as EnrichmentType,
          prompt: '',
          chronicleStep: 'title' as ChronicleStep,
          chronicleId,
        },
      ]);
    },
    [getChronicle],
  );

  const generateImageRefs = useCallback(
    (chronicleId: string, context: ChronicleGenerationContext) => {
      const chronicle = getChronicle(chronicleId);
      if (!chronicle) {
        console.error('[Chronicle] No chronicle found for chronicleId', chronicleId);
        return;
      }
      if (chronicle.finalContent) {
        console.error('[Chronicle] Image refs are only available before acceptance');
        return;
      }
      if (!chronicle.assembledContent) {
        console.error('[Chronicle] No assembled content to draft image refs');
        return;
      }
      if (!context.narrativeStyle) {
        console.error('[Chronicle] Narrative style required to generate image refs');
        return;
      }

      getEnqueue()([
        {
          entity: buildEntityRefFromContext(chronicleId, context, chronicle),
          type: 'entityChronicle' as EnrichmentType,
          prompt: '',
          chronicleContext: context,
          chronicleStep: 'image_refs',
          chronicleId,
        },
      ]);
    },
    [getChronicle],
  );

  const regenerateWithSampling = useCallback(
    (chronicleId: string) => {
      const chronicle = getChronicle(chronicleId);
      if (!chronicle) {
        console.error('[Chronicle] No chronicle found for chronicleId', chronicleId);
        return;
      }
      if (chronicle.finalContent || chronicle.status === 'complete') {
        console.error('[Chronicle] Sampling regeneration is only available before acceptance');
        return;
      }
      if (!chronicle.generationSystemPrompt || !chronicle.generationUserPrompt) {
        console.error('[Chronicle] Stored prompts missing; cannot regenerate');
        return;
      }

      getEnqueue()([
        {
          entity: buildEntityRefFromRecord(chronicleId, chronicle),
          type: 'entityChronicle' as EnrichmentType,
          prompt: '',
          chronicleStep: 'regenerate_temperature',
          chronicleId,
        },
      ]);
    },
    [getChronicle],
  );

  const compareVersions = useCallback(
    (chronicleId: string) => {
      const chronicle = getChronicle(chronicleId);
      if (!chronicle) {
        console.error('[Chronicle] No chronicle found for chronicleId', chronicleId);
        return;
      }
      if (!chronicle.assembledContent) {
        console.error('[Chronicle] No assembled content to compare');
        return;
      }
      const historyCount = chronicle.generationHistory?.length || 0;
      if (historyCount < 2) {
        console.error('[Chronicle] Need at least 2 versions to compare');
        return;
      }

      getEnqueue()([
        {
          entity: buildEntityRefFromRecord(chronicleId, chronicle),
          type: 'entityChronicle' as EnrichmentType,
          prompt: '',
          chronicleStep: 'compare',
          chronicleId,
        },
      ]);
    },
    [getChronicle],
  );

  const combineVersions = useCallback(
    (chronicleId: string) => {
      const chronicle = getChronicle(chronicleId);
      if (!chronicle) {
        console.error('[Chronicle] No chronicle found for chronicleId', chronicleId);
        return;
      }
      if (!chronicle.assembledContent) {
        console.error('[Chronicle] No assembled content to combine');
        return;
      }
      const historyCount = chronicle.generationHistory?.length || 0;
      if (historyCount < 2) {
        console.error('[Chronicle] Need at least 2 versions to combine');
        return;
      }

      getEnqueue()([
        {
          entity: buildEntityRefFromRecord(chronicleId, chronicle),
          type: 'entityChronicle' as EnrichmentType,
          prompt: '',
          chronicleStep: 'combine',
          chronicleId,
        },
      ]);
    },
    [getChronicle],
  );

  const copyEdit = useCallback(
    (chronicleId: string) => {
      const chronicle = getChronicle(chronicleId);
      if (!chronicle) {
        console.error('[Chronicle] No chronicle found for chronicleId', chronicleId);
        return;
      }
      if (!chronicle.assembledContent) {
        console.error('[Chronicle] No assembled content to copy-edit');
        return;
      }

      getEnqueue()([
        {
          entity: buildEntityRefFromRecord(chronicleId, chronicle),
          type: 'entityChronicle' as EnrichmentType,
          prompt: '',
          chronicleStep: 'copy_edit',
          chronicleId,
        },
      ]);
    },
    [getChronicle],
  );

  const temporalCheck = useCallback(
    (chronicleId: string) => {
      const chronicle = getChronicle(chronicleId);
      if (!chronicle) {
        console.error('[Chronicle] No chronicle found for chronicleId', chronicleId);
        return;
      }
      if (!chronicle.assembledContent) {
        console.error('[Chronicle] No assembled content for temporal check');
        return;
      }
      if (!chronicle.perspectiveSynthesis?.temporalNarrative) {
        console.error('[Chronicle] No temporal narrative available for temporal check');
        return;
      }

      getEnqueue()([
        {
          entity: buildEntityRefFromRecord(chronicleId, chronicle),
          type: 'entityChronicle' as EnrichmentType,
          prompt: '',
          chronicleStep: 'temporal_check',
          chronicleId,
        },
      ]);
    },
    [getChronicle],
  );

  /**
   * Full regeneration with new perspective synthesis.
   * Creates a new version by running the complete generation pipeline.
   * Unlike sampling regeneration, this generates fresh perspective synthesis.
   */
  const regenerateFull = useCallback(
    (chronicleId: string, context: ChronicleGenerationContext) => {
      const chronicle = getChronicle(chronicleId);
      if (!chronicle) {
        console.error('[Chronicle] No chronicle found for chronicleId', chronicleId);
        return;
      }
      if (chronicle.finalContent || chronicle.status === 'complete') {
        console.error('[Chronicle] Full regeneration requires unpublishing first');
        return;
      }
      if (!context.narrativeStyle) {
        console.error('[Chronicle] Narrative style required for full regeneration');
        return;
      }
      if (!context.toneFragments || !context.canonFactsWithMetadata) {
        console.error('[Chronicle] Full regeneration requires toneFragments and canonFactsWithMetadata');
        return;
      }

      getEnqueue()([
        {
          entity: buildEntityRefFromRecord(chronicleId, chronicle),
          type: 'entityChronicle' as EnrichmentType,
          prompt: '',
          chronicleContext: context,
          chronicleStep: 'regenerate_full',
          chronicleId,
        },
      ]);
    },
    [getChronicle],
  );

  /**
   * Creative freedom regeneration.
   * Stripped-down prompt — no PS, no prescribed structure/voice/style.
   * Same world data, more creative latitude. Story format only.
   */
  const regenerateCreative = useCallback(
    (chronicleId: string, context: ChronicleGenerationContext) => {
      const chronicle = getChronicle(chronicleId);
      if (!chronicle) {
        console.error('[Chronicle] No chronicle found for chronicleId', chronicleId);
        return;
      }
      if (chronicle.finalContent || chronicle.status === 'complete') {
        console.error('[Chronicle] Creative regeneration requires unpublishing first');
        return;
      }
      if (!context.narrativeStyle) {
        console.error('[Chronicle] Narrative style required for creative regeneration');
        return;
      }
      if (context.narrativeStyle.format !== 'story') {
        console.error('[Chronicle] Creative freedom mode is only available for story format');
        return;
      }

      getEnqueue()([
        {
          entity: buildEntityRefFromRecord(chronicleId, chronicle),
          type: 'entityChronicle' as EnrichmentType,
          prompt: '',
          chronicleContext: context,
          chronicleStep: 'regenerate_creative',
          chronicleId,
        },
      ]);
    },
    [getChronicle],
  );

  const quickCheck = useCallback(
    (chronicleId: string) => {
      const chronicle = getChronicle(chronicleId);
      if (!chronicle) {
        console.error('[Chronicle] No chronicle found for chronicleId', chronicleId);
        return;
      }
      if (!chronicle.assembledContent && !chronicle.finalContent) {
        console.error('[Chronicle] No content available for quick check');
        return;
      }

      getEnqueue()([
        {
          entity: buildEntityRefFromRecord(chronicleId, chronicle),
          type: 'entityChronicle' as EnrichmentType,
          prompt: '',
          chronicleStep: 'quick_check',
          chronicleId,
        },
      ]);
    },
    [getChronicle],
  );

  return {
    generateV2,
    generateSummary,
    generateTitle,
    generateImageRefs,
    regenerateWithSampling,
    regenerateFull,
    regenerateCreative,
    compareVersions,
    combineVersions,
    copyEdit,
    temporalCheck,
    quickCheck,
  };
}
