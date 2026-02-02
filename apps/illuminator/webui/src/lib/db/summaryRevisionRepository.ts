/**
 * Summary Revision Repository — Dexie-backed revision run storage
 */

import { db } from './illuminatorDb';
import type { SummaryRevisionRun, SummaryRevisionRunStatus, SummaryRevisionBatch } from '../summaryRevisionTypes';

export type { SummaryRevisionRun, SummaryRevisionRunStatus, SummaryRevisionBatch };

export function generateRevisionRunId(): string {
  return `revrun_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export async function createRevisionRun(
  runId: string,
  projectId: string,
  simulationRunId: string,
  batches: SummaryRevisionBatch[],
  context: {
    worldDynamicsContext: string;
    staticPagesContext: string;
    schemaContext: string;
    revisionGuidance: string;
  }
): Promise<SummaryRevisionRun> {
  const now = Date.now();

  const run: SummaryRevisionRun = {
    runId,
    projectId,
    simulationRunId,
    status: 'pending',
    batches,
    currentBatchIndex: 0,
    patchDecisions: {},
    worldDynamicsContext: context.worldDynamicsContext,
    staticPagesContext: context.staticPagesContext,
    schemaContext: context.schemaContext,
    revisionGuidance: context.revisionGuidance,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalActualCost: 0,
    createdAt: now,
    updatedAt: now,
  };

  await db.summaryRevisionRuns.put(run);
  return run;
}

export async function getRevisionRun(runId: string): Promise<SummaryRevisionRun | undefined> {
  return db.summaryRevisionRuns.get(runId);
}

export async function updateRevisionRun(
  runId: string,
  updates: Partial<Pick<SummaryRevisionRun,
    | 'status'
    | 'batches'
    | 'currentBatchIndex'
    | 'patchDecisions'
    | 'error'
    | 'totalInputTokens'
    | 'totalOutputTokens'
    | 'totalActualCost'
  >>
): Promise<SummaryRevisionRun> {
  const run = await db.summaryRevisionRuns.get(runId);
  if (!run) throw new Error(`Revision run ${runId} not found`);

  if (updates.status !== undefined) run.status = updates.status;
  if (updates.batches !== undefined) run.batches = updates.batches;
  if (updates.currentBatchIndex !== undefined) run.currentBatchIndex = updates.currentBatchIndex;
  if (updates.patchDecisions !== undefined) run.patchDecisions = updates.patchDecisions;
  if (updates.error !== undefined) (run as any).error = updates.error;
  if (updates.totalInputTokens !== undefined) run.totalInputTokens = updates.totalInputTokens;
  if (updates.totalOutputTokens !== undefined) run.totalOutputTokens = updates.totalOutputTokens;
  if (updates.totalActualCost !== undefined) run.totalActualCost = updates.totalActualCost;
  run.updatedAt = Date.now();

  await db.summaryRevisionRuns.put(run);
  return run;
}

export async function deleteRevisionRun(runId: string): Promise<void> {
  await db.summaryRevisionRuns.delete(runId);
}
