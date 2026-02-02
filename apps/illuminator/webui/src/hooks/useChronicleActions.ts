/**
 * useChronicleActions - Thin hook for enqueue-dependent chronicle actions.
 *
 * Receives onEnqueue from props (the enrichment queue system) and provides
 * action functions that read chronicle data from the Zustand store imperatively.
 * This separation keeps the store free of prop-dependent closures.
 */

import { useCallback } from 'react';
import type { ChronicleGenerationContext } from '../lib/chronicleTypes';
import type { EnrichmentType, ChronicleStep } from '../lib/enrichmentTypes';
import { useChronicleStore } from '../lib/db/chronicleStore';
import type { ChronicleRecord } from '../lib/db/chronicleRepository';

// ============================================================================
// Types
// ============================================================================

export interface ChronicleMetadata {
  chronicleId: string;
  title?: string;
  format: 'story' | 'document';
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

interface EnqueueItem {
  entity: {
    id: string;
    name: string;
    kind: string;
    subtype: string;
    prominence: string;
    culture: string;
    status: string;
    description: string;
    tags: Record<string, unknown>;
  };
  type: EnrichmentType;
  prompt: string;
  chronicleContext?: ChronicleGenerationContext;
  chronicleStep?: ChronicleStep;
  chronicleId?: string;
  chronicleMetadata?: ChronicleMetadata;
  chronicleTemperature?: number;
}

type OnEnqueue = (items: EnqueueItem[]) => void;

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

export function useChronicleActions(onEnqueue: OnEnqueue) {
  const getChronicle = useCallback(
    (chronicleId: string): ChronicleRecord | undefined =>
      useChronicleStore.getState().chronicles[chronicleId],
    [],
  );

  const generateV2 = useCallback(
    (
      chronicleId: string,
      context: ChronicleGenerationContext,
      metadata?: ChronicleMetadata,
      temperatureOverride?: number,
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

      onEnqueue([
        {
          entity,
          type: 'entityChronicle' as EnrichmentType,
          prompt: '',
          chronicleContext: context,
          chronicleStep: 'generate_v2',
          chronicleId: metadata?.chronicleId || chronicleId,
          chronicleMetadata: metadata,
          chronicleTemperature: temperatureOverride,
        },
      ]);
    },
    [onEnqueue, getChronicle],
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

      onEnqueue([
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
    [onEnqueue, getChronicle],
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

      onEnqueue([
        {
          entity: buildEntityRefFromRecord(chronicleId, chronicle),
          type: 'entityChronicle' as EnrichmentType,
          prompt: '',
          chronicleStep: 'title' as ChronicleStep,
          chronicleId,
        },
      ]);
    },
    [onEnqueue, getChronicle],
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

      onEnqueue([
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
    [onEnqueue, getChronicle],
  );

  const regenerateWithTemperature = useCallback(
    (chronicleId: string, temperature: number) => {
      const chronicle = getChronicle(chronicleId);
      if (!chronicle) {
        console.error('[Chronicle] No chronicle found for chronicleId', chronicleId);
        return;
      }
      if (chronicle.finalContent || chronicle.status === 'complete') {
        console.error('[Chronicle] Temperature regeneration is only available before acceptance');
        return;
      }
      if (!chronicle.generationSystemPrompt || !chronicle.generationUserPrompt) {
        console.error('[Chronicle] Stored prompts missing; cannot regenerate');
        return;
      }

      onEnqueue([
        {
          entity: buildEntityRefFromRecord(chronicleId, chronicle),
          type: 'entityChronicle' as EnrichmentType,
          prompt: '',
          chronicleStep: 'regenerate_temperature',
          chronicleId,
          chronicleTemperature: temperature,
        },
      ]);
    },
    [onEnqueue, getChronicle],
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
      const historyCount = (chronicle.generationHistory?.length || 0) + 1;
      if (historyCount < 2) {
        console.error('[Chronicle] Need at least 2 versions to compare');
        return;
      }

      onEnqueue([
        {
          entity: buildEntityRefFromRecord(chronicleId, chronicle),
          type: 'entityChronicle' as EnrichmentType,
          prompt: '',
          chronicleStep: 'compare',
          chronicleId,
        },
      ]);
    },
    [onEnqueue, getChronicle],
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
      const historyCount = (chronicle.generationHistory?.length || 0) + 1;
      if (historyCount < 2) {
        console.error('[Chronicle] Need at least 2 versions to combine');
        return;
      }

      onEnqueue([
        {
          entity: buildEntityRefFromRecord(chronicleId, chronicle),
          type: 'entityChronicle' as EnrichmentType,
          prompt: '',
          chronicleStep: 'combine',
          chronicleId,
        },
      ]);
    },
    [onEnqueue, getChronicle],
  );

  return {
    generateV2,
    generateSummary,
    generateTitle,
    generateImageRefs,
    regenerateWithTemperature,
    compareVersions,
    combineVersions,
  };
}
