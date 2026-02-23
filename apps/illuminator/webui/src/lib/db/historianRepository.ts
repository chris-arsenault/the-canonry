/**
 * Historian Repository — Dexie-backed historian run storage
 */

import { db } from './illuminatorDb';
import type { HistorianRun, HistorianRunStatus, HistorianNote } from '../historianTypes';

export type { HistorianRun, HistorianRunStatus, HistorianNote };

export function generateHistorianRunId(): string {
  return `histrun_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export async function createHistorianRun(run: HistorianRun): Promise<HistorianRun> {
  await db.historianRuns.put(run);
  return run;
}

export async function getHistorianRun(runId: string): Promise<HistorianRun | undefined> {
  return db.historianRuns.get(runId);
}

export async function updateHistorianRun(
  runId: string,
  updates: Partial<Pick<HistorianRun,
    | 'status'
    | 'error'
    | 'notes'
    | 'noteDecisions'
    | 'chronologyAssignments'
    | 'inputTokens'
    | 'outputTokens'
    | 'actualCost'
    | 'systemPrompt'
    | 'userPrompt'
  >>
): Promise<HistorianRun> {
  const run = await db.historianRuns.get(runId);
  if (!run) throw new Error(`Historian run ${runId} not found`);

  if (updates.status !== undefined) run.status = updates.status;
  if (updates.error !== undefined) run.error = updates.error;
  if (updates.notes !== undefined) run.notes = updates.notes;
  if (updates.noteDecisions !== undefined) run.noteDecisions = updates.noteDecisions;
  if (updates.chronologyAssignments !== undefined) run.chronologyAssignments = updates.chronologyAssignments;
  if (updates.inputTokens !== undefined) run.inputTokens = updates.inputTokens;
  if (updates.outputTokens !== undefined) run.outputTokens = updates.outputTokens;
  if (updates.actualCost !== undefined) run.actualCost = updates.actualCost;
  if (updates.systemPrompt !== undefined) run.systemPrompt = updates.systemPrompt;
  if (updates.userPrompt !== undefined) run.userPrompt = updates.userPrompt;
  run.updatedAt = Date.now();

  await db.historianRuns.put(run);
  return run;
}

export async function deleteHistorianRun(runId: string): Promise<void> {
  await db.historianRuns.delete(runId);
}
