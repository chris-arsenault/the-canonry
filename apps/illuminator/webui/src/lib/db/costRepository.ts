/**
 * Cost Repository — Dexie-backed cost record storage
 *
 * Independent store for tracking all LLM costs.
 * Costs are never deleted when entities/chronicles are regenerated.
 */

import { db } from './illuminatorDb';
import type { CostRecord, CostType, CostRecordInput, CostSummary } from '../costTypes';

// Re-export types for consumers
export type { CostRecord, CostType, CostRecordInput, CostSummary };

const LOG_PREFIX = '[CostStorage]';

export function generateCostId(): string {
  return `cost_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function createCostRecord(input: CostRecordInput): CostRecord {
  return {
    id: input.id ?? generateCostId(),
    timestamp: input.timestamp ?? Date.now(),
    projectId: input.projectId,
    simulationRunId: input.simulationRunId,
    entityId: input.entityId,
    entityName: input.entityName,
    entityKind: input.entityKind,
    chronicleId: input.chronicleId,
    type: input.type,
    model: input.model,
    estimatedCost: input.estimatedCost,
    actualCost: input.actualCost,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
  };
}

export async function saveCostRecord(record: CostRecord): Promise<void> {
  console.debug(`${LOG_PREFIX} Save start`, {
    id: record.id,
    type: record.type,
    model: record.model,
  });
  await db.costs.put(record);
  console.debug(`${LOG_PREFIX} Save complete`, {
    id: record.id,
    type: record.type,
    model: record.model,
  });
}

export async function saveCostRecordWithDefaults(input: CostRecordInput): Promise<void> {
  return saveCostRecord(createCostRecord(input));
}

export async function getCostsForProject(projectId: string): Promise<CostRecord[]> {
  return db.costs.where('projectId').equals(projectId).toArray();
}

export async function getCostsForSimulation(simulationRunId: string): Promise<CostRecord[]> {
  return db.costs.where('simulationRunId').equals(simulationRunId).toArray();
}

export async function getAllCosts(): Promise<CostRecord[]> {
  return db.costs.toArray();
}

export async function getCostsInRange(startTime: number, endTime: number): Promise<CostRecord[]> {
  return db.costs
    .where('timestamp')
    .between(startTime, endTime, true, true)
    .toArray();
}

export function summarizeCosts(records: CostRecord[]): CostSummary {
  const summary: CostSummary = {
    totalEstimated: 0,
    totalActual: 0,
    count: records.length,
    byType: {} as Record<CostType, { estimated: number; actual: number; count: number }>,
    byModel: {},
  };

  for (const record of records) {
    summary.totalEstimated += record.estimatedCost;
    summary.totalActual += record.actualCost;

    if (!summary.byType[record.type]) {
      summary.byType[record.type] = { estimated: 0, actual: 0, count: 0 };
    }
    summary.byType[record.type].estimated += record.estimatedCost;
    summary.byType[record.type].actual += record.actualCost;
    summary.byType[record.type].count++;

    if (!summary.byModel[record.model]) {
      summary.byModel[record.model] = { estimated: 0, actual: 0, count: 0 };
    }
    summary.byModel[record.model].estimated += record.estimatedCost;
    summary.byModel[record.model].actual += record.actualCost;
    summary.byModel[record.model].count++;
  }

  return summary;
}

export async function clearAllCosts(): Promise<void> {
  await db.costs.clear();
}

export async function getCostCount(): Promise<number> {
  return db.costs.count();
}
