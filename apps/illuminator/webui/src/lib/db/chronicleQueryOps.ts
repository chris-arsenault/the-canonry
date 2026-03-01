/**
 * Chronicle Query Operations — read and delete operations.
 */

import { db } from "./illuminatorDb";
import type { ChronicleRecord } from "../chronicleTypes";
import { ensureChronicleVersions } from "./chronicleVersionHelpers";

// ============================================================================
// Read operations
// ============================================================================

export async function getChronicle(chronicleId: string): Promise<ChronicleRecord | undefined> {
  const record = await db.chronicles.get(chronicleId);
  if (record && ensureChronicleVersions(record)) {
    await db.chronicles.put(record);
  }
  return record;
}

/**
 * Get all chronicles for a specific simulation run
 */
export async function getChroniclesForSimulation(
  simulationRunId: string
): Promise<ChronicleRecord[]> {
  const records = await db.chronicles.where("simulationRunId").equals(simulationRunId).toArray();
  const updates: ChronicleRecord[] = [];
  for (const record of records) {
    if (ensureChronicleVersions(record)) {
      updates.push(record);
    }
  }
  if (updates.length > 0) {
    await db.chronicles.bulkPut(updates);
  }
  return records;
}

/**
 * Delete a chronicle
 */
export async function deleteChronicle(chronicleId: string): Promise<void> {
  await db.chronicles.delete(chronicleId);
}

/**
 * Delete all chronicles for a simulation run
 */
export async function deleteChroniclesForSimulation(simulationRunId: string): Promise<number> {
  const chronicles = await getChroniclesForSimulation(simulationRunId);
  if (chronicles.length === 0) return 0;

  const ids = chronicles.map((c) => c.chronicleId);
  await db.chronicles.bulkDelete(ids);
  return chronicles.length;
}

// ============================================================================
// Entity Rename Support
// ============================================================================

/**
 * Write a fully-updated chronicle record back to the database.
 * Used by the entity rename flow to persist chronicle patches.
 */
export async function putChronicle(record: ChronicleRecord): Promise<void> {
  await db.chronicles.put(record);
}
