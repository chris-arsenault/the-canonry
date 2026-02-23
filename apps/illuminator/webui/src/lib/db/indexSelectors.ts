/**
 * Zustand selectors for the index store.
 *
 * Provides granular subscriptions so components only re-render when
 * the specific index they care about changes.
 */

import { useMemo } from 'react';
import { useIndexStore } from './indexStore';
import type { ProminenceScale } from '@canonry/world-schema';
import {
  buildProminenceScale,
  DEFAULT_PROMINENCE_DISTRIBUTION,
} from '@canonry/world-schema';
import type { EraTemporalEntry } from './indexTypes';

const EMPTY_ERA_TEMPORAL: EraTemporalEntry[] = [];
const EMPTY_PROMINENT: Record<string, Array<{ id: string; name: string }>> = {};
const EMPTY_MAP = new Map<string, EraTemporalEntry>();

const FALLBACK_SCALE = buildProminenceScale([], {
  distribution: DEFAULT_PROMINENCE_DISTRIBUTION,
});

export function useProminenceScale(): ProminenceScale {
  return useIndexStore((state) => state.indexes?.prominenceScale ?? FALLBACK_SCALE);
}

export function useRenownedThreshold(): number {
  return useIndexStore((state) => state.indexes?.renownedThreshold ?? 0);
}

export function useEraTemporalInfo(): EraTemporalEntry[] {
  return useIndexStore((state) => state.indexes?.eraTemporalInfo ?? EMPTY_ERA_TEMPORAL);
}

export function useEraTemporalInfoByKey(): Map<string, EraTemporalEntry> {
  const eraTemporalInfo = useIndexStore((state) => state.indexes?.eraTemporalInfo);
  const eraIdAliases = useIndexStore((state) => state.indexes?.eraIdAliases);

  return useMemo(() => {
    if (!eraTemporalInfo?.length) return EMPTY_MAP;

    const byId = new Map<string, EraTemporalEntry>(
      eraTemporalInfo.map((era) => [era.id, era]),
    );
    const map = new Map(byId);

    if (eraIdAliases) {
      for (const [entityId, eraId] of Object.entries(eraIdAliases)) {
        const eraInfo = byId.get(entityId) || byId.get(eraId);
        if (eraInfo) {
          map.set(eraId, eraInfo);
          map.set(entityId, eraInfo);
        }
      }
    }

    return map;
  }, [eraTemporalInfo, eraIdAliases]);
}

export function useProminentByCulture(): Record<string, Array<{ id: string; name: string }>> {
  return useIndexStore((state) => state.indexes?.prominentByCulture ?? EMPTY_PROMINENT);
}
