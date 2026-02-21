/**
 * EraNarrativeNavItem — lightweight projection of EraNarrativeRecord for nav list rendering.
 *
 * Same two-layer pattern as chronicleNav.ts / entityNav.ts.
 * Era narratives appear in the chronicle nav list alongside chronicle items,
 * distinguished by the `itemType: 'era_narrative'` discriminator and a prefixed ID.
 */
import type { EraNarrativeRecord } from '../eraNarrativeTypes';

export interface EraNarrativeNavItem {
  id: string;                    // prefixed: `eranarr:${narrativeId}`
  narrativeId: string;
  itemType: 'era_narrative';
  name: string;
  eraName: string;
  eraId: string;
  status: string;
  tone: string;
  currentStep: string;
  wordCount: number;
  totalActualCost: number;
  threadCount: number;
  movementCount: number;
  hasThesis: boolean;
  createdAt: number;
  updatedAt: number;
  // Fields for era-based sorting (match chronicle nav item field names)
  focalEraName: string;
  focalEraOrder: number | undefined;
  eraYear: undefined;
}

export function buildEraNarrativeNavItem(
  record: EraNarrativeRecord,
  eraOrder?: number,
): EraNarrativeNavItem {
  const wordCount = record.narrative?.editedWordCount
    ?? record.narrative?.wordCount
    ?? 0;

  return {
    id: `eranarr:${record.narrativeId}`,
    narrativeId: record.narrativeId,
    itemType: 'era_narrative',
    name: record.eraName,
    eraName: record.eraName,
    eraId: record.eraId,
    status: record.status,
    tone: record.tone,
    currentStep: record.currentStep,
    wordCount,
    totalActualCost: record.totalActualCost,
    threadCount: record.threadSynthesis?.threads?.length ?? 0,
    movementCount: record.threadSynthesis?.movements?.length ?? 0,
    hasThesis: !!record.threadSynthesis?.thesis,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    focalEraName: record.eraName,
    focalEraOrder: eraOrder,
    eraYear: undefined,
  };
}
