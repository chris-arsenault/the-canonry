/**
 * Zustand selectors for chronicle store.
 *
 * Provides granular subscriptions so components only re-render when
 * the specific data they care about changes.
 */

import { useMemo } from 'react';
import { useChronicleStore } from './chronicleStore';
import type { ChronicleRecord } from './chronicleRepository';

// ============================================================================
// Nav item type — lightweight projection for the chronicle list sidebar
// ============================================================================

export interface ChronicleNavItem {
  id: string;
  chronicleId: string;
  name: string;
  status: string;
  title?: string;
  format?: string;
  focusType?: string;
  primaryCount: number;
  supportingCount: number;
  narrativeStyleId?: string;
  narrativeStyleName?: string;
  perspectiveSynthesis: boolean;
  combineInstructions: boolean;
  coverImageComplete: boolean;
  loreBackported: boolean;
  lens?: { entityName: string };
  imageRefCompleteCount: number;
  failureStep?: string;
  createdAt: number;
  updatedAt: number;
  // Fields needed for filtering/sorting in the nav list
  selectedEntityIds?: string[];
  roleAssignments?: ChronicleRecord['roleAssignments'];
  wordCount: number;
  focalEraName?: string;
  focalEraOrder?: number;
}

function buildNavItem(
  record: ChronicleRecord,
  getEffectiveStatus: (chronicleId: string, record: ChronicleRecord) => string,
): ChronicleNavItem {
  const primaryCount = record.roleAssignments?.filter((r) => r.isPrimary).length || 0;
  const supportingCount = (record.roleAssignments?.length || 0) - primaryCount;
  const displayName =
    record.title ||
    (record.roleAssignments?.length > 0
      ? record.roleAssignments
          .filter((r) => r.isPrimary)
          .map((r) => r.entityName)
          .join(' & ') || record.roleAssignments[0]?.entityName
      : '') ||
    'Untitled Chronicle';

  return {
    id: record.chronicleId,
    chronicleId: record.chronicleId,
    name: displayName,
    status: getEffectiveStatus(record.chronicleId, record),
    title: record.title,
    format: record.format,
    focusType: record.focusType,
    primaryCount,
    supportingCount,
    narrativeStyleId: record.narrativeStyleId,
    narrativeStyleName: record.narrativeStyle?.name,
    perspectiveSynthesis: !!record.perspectiveSynthesis,
    combineInstructions: !!record.combineInstructions,
    coverImageComplete: record.coverImage?.status === 'complete',
    loreBackported: !!record.loreBackported,
    lens: record.lens ? { entityName: record.lens.entityName } : undefined,
    imageRefCompleteCount:
      record.imageRefs?.refs?.filter(
        (r: { type: string; status?: string }) => r.type === 'prompt_request' && r.status === 'complete',
      ).length || 0,
    failureStep: record.failureStep,
    createdAt: record.createdAt || 0,
    updatedAt: record.updatedAt || 0,
    selectedEntityIds: record.selectedEntityIds,
    roleAssignments: record.roleAssignments,
    wordCount: ((record.finalContent || record.assembledContent || '').trim().split(/\s+/).filter(Boolean).length),
    focalEraName: record.temporalContext?.focalEra?.name,
    focalEraOrder: typeof record.temporalContext?.focalEra?.order === 'number'
      ? record.temporalContext.focalEra.order
      : (typeof record.temporalContext?.focalEra?.startTick === 'number'
        ? record.temporalContext.focalEra.startTick
        : undefined),
  };
}

// ============================================================================
// Selectors
// ============================================================================

/**
 * Sorted nav items for the chronicle list sidebar.
 * Subscribes to the chronicles record (reference-stable per chronicle),
 * derives lightweight nav items in a useMemo.
 */
export function useChronicleNavItems(
  getEffectiveStatus: (chronicleId: string, record: ChronicleRecord) => string,
): ChronicleNavItem[] {
  const chronicles = useChronicleStore((state) => state.chronicles);

  return useMemo(() => {
    const items: ChronicleNavItem[] = [];
    for (const record of Object.values(chronicles)) {
      items.push(buildNavItem(record, getEffectiveStatus));
    }
    items.sort((a, b) => b.updatedAt - a.updatedAt);
    return items;
  }, [chronicles, getEffectiveStatus]);
}

/**
 * Single chronicle record for the review panel.
 * Only re-renders when this specific chronicle's record reference changes.
 */
export function useSelectedChronicle(chronicleId: string | null): ChronicleRecord | undefined {
  return useChronicleStore((state) => (chronicleId ? state.chronicles[chronicleId] : undefined));
}

/**
 * Chronicle count for stats display.
 */
export function useChronicleCount(): number {
  return useChronicleStore((state) => Object.keys(state.chronicles).length);
}

/**
 * Get a chronicle record imperatively (not a subscription).
 * For use in event handlers and callbacks.
 */
export function getChronicleFromStore(chronicleId: string): ChronicleRecord | undefined {
  return useChronicleStore.getState().chronicles[chronicleId];
}
