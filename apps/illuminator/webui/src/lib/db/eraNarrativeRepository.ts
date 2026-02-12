/**
 * Era Narrative Repository — Dexie-backed era narrative storage
 */

import { db } from './illuminatorDb';
import type { EraNarrativeRecord } from '../eraNarrativeTypes';

export type { EraNarrativeRecord };

export function generateEraNarrativeId(): string {
  return `eranarr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export async function createEraNarrative(record: EraNarrativeRecord): Promise<EraNarrativeRecord> {
  await db.eraNarratives.put(record);
  return record;
}

export async function getEraNarrative(narrativeId: string): Promise<EraNarrativeRecord | undefined> {
  return db.eraNarratives.get(narrativeId);
}

export async function getEraNarrativesForEra(
  simulationRunId: string,
  eraId: string
): Promise<EraNarrativeRecord[]> {
  return db.eraNarratives
    .where({ simulationRunId, eraId })
    .toArray();
}

export async function updateEraNarrative(
  narrativeId: string,
  updates: Partial<Pick<EraNarrativeRecord,
    | 'status'
    | 'error'
    | 'currentStep'
    | 'currentChapterIndex'
    | 'threadSynthesis'
    | 'chapters'
    | 'titleCandidates'
    | 'titleFragments'
    | 'selectedTitle'
    | 'totalInputTokens'
    | 'totalOutputTokens'
    | 'totalActualCost'
  >>
): Promise<EraNarrativeRecord> {
  const record = await db.eraNarratives.get(narrativeId);
  if (!record) throw new Error(`Era narrative ${narrativeId} not found`);

  if (updates.status !== undefined) record.status = updates.status;
  if (updates.error !== undefined) record.error = updates.error;
  if (updates.currentStep !== undefined) record.currentStep = updates.currentStep;
  if (updates.currentChapterIndex !== undefined) record.currentChapterIndex = updates.currentChapterIndex;
  if (updates.threadSynthesis !== undefined) record.threadSynthesis = updates.threadSynthesis;
  if (updates.chapters !== undefined) record.chapters = updates.chapters;
  if (updates.titleCandidates !== undefined) record.titleCandidates = updates.titleCandidates;
  if (updates.titleFragments !== undefined) record.titleFragments = updates.titleFragments;
  if (updates.selectedTitle !== undefined) record.selectedTitle = updates.selectedTitle;
  if (updates.totalInputTokens !== undefined) record.totalInputTokens = updates.totalInputTokens;
  if (updates.totalOutputTokens !== undefined) record.totalOutputTokens = updates.totalOutputTokens;
  if (updates.totalActualCost !== undefined) record.totalActualCost = updates.totalActualCost;
  record.updatedAt = Date.now();

  await db.eraNarratives.put(record);
  return record;
}

export async function deleteEraNarrative(narrativeId: string): Promise<void> {
  await db.eraNarratives.delete(narrativeId);
}
