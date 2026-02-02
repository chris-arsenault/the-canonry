/**
 * Dynamics Generation Repository — Dexie-backed dynamics run storage
 */

import { db } from './illuminatorDb';
import type { DynamicsRun, DynamicsRunStatus } from '../dynamicsGenerationTypes';

export type { DynamicsRun, DynamicsRunStatus };

export function generateRunId(): string {
  return `dynrun_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export async function createDynamicsRun(
  runId: string,
  projectId: string,
  simulationRunId: string
): Promise<DynamicsRun> {
  const now = Date.now();

  const run: DynamicsRun = {
    runId,
    projectId,
    simulationRunId,
    status: 'pending',
    messages: [],
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalActualCost: 0,
    createdAt: now,
    updatedAt: now,
  };

  await db.dynamicsRuns.put(run);
  return run;
}

export async function getDynamicsRun(runId: string): Promise<DynamicsRun | undefined> {
  return db.dynamicsRuns.get(runId);
}

export async function updateDynamicsRun(
  runId: string,
  updates: Partial<Pick<DynamicsRun,
    | 'status'
    | 'messages'
    | 'proposedDynamics'
    | 'userFeedback'
    | 'error'
    | 'totalInputTokens'
    | 'totalOutputTokens'
    | 'totalActualCost'
  >>
): Promise<DynamicsRun> {
  const run = await db.dynamicsRuns.get(runId);
  if (!run) throw new Error(`Dynamics run ${runId} not found`);

  if (updates.status !== undefined) run.status = updates.status;
  if (updates.messages !== undefined) run.messages = updates.messages;
  if (updates.proposedDynamics !== undefined) run.proposedDynamics = updates.proposedDynamics;
  if (updates.userFeedback !== undefined) run.userFeedback = updates.userFeedback;
  if (updates.error !== undefined) run.error = updates.error;
  if (updates.totalInputTokens !== undefined) run.totalInputTokens = updates.totalInputTokens;
  if (updates.totalOutputTokens !== undefined) run.totalOutputTokens = updates.totalOutputTokens;
  if (updates.totalActualCost !== undefined) run.totalActualCost = updates.totalActualCost;
  run.updatedAt = Date.now();

  await db.dynamicsRuns.put(run);
  return run;
}

export async function deleteDynamicsRun(runId: string): Promise<void> {
  await db.dynamicsRuns.delete(runId);
}
